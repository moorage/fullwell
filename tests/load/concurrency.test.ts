import { setTimeout as delay } from "node:timers/promises";
import { HouseholdIdSchema } from "@hfj/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../../apps/server/src/adapters/memory.js";
import {
  DeterministicRandomSource,
  DeterministicTestAuthenticator,
  FixedClock,
  HmacTokenHasher,
  NoopTelemetry,
  UnconfiguredAppleIdentityProvider,
  UnconfiguredMailProvider,
} from "../../apps/server/src/adapters/providers.js";
import { buildApp } from "../../apps/server/src/http/app.js";
import { HouseholdFoodJournalService } from "../../apps/server/src/services/household-food-journal.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createFixture(): Promise<{ app: FastifyInstance; repository: MemoryHouseholdRepository }> {
  const store = new MemoryOperationalStore();
  const repository = new MemoryHouseholdRepository();
  const random = new DeterministicRandomSource();
  const service = new HouseholdFoodJournalService(
    store,
    repository,
    new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
    random,
    new HmacTokenHasher("load-test-pepper-that-is-long-enough"),
    new NoopTelemetry(),
    new URL("https://load.example.test"),
  );
  const app = await buildApp({
    service,
    authentication: new DeterministicTestAuthenticator(),
    store,
    repository,
    mail: new UnconfiguredMailProvider(),
    identity: new UnconfiguredAppleIdentityProvider(),
    random,
    publicOrigin: new URL("https://load.example.test"),
  });
  apps.push(app);
  return { app, repository };
}

describe("bounded load and race behavior", () => {
  it("serves concurrent MCP discovery within its budget and rate limits preview bursts", async () => {
    const { app } = await createFixture();
    const startedAt = performance.now();
    const mcpResponses = await Promise.all(Array.from({ length: 100 }, (_, id) => app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: "Bearer test-owner-token", "x-forwarded-for": "198.51.100.20" },
      payload: { jsonrpc: "2.0", id, method: "tools/list" },
    })));
    expect(performance.now() - startedAt).toBeLessThan(5_000);
    expect(mcpResponses.every((response) => response.statusCode === 200)).toBe(true);
    expect(new Set(mcpResponses.map((response) => response.headers["x-request-id"])).size).toBe(mcpResponses.length);

    const { app: previewApp } = await createFixture();
    const baselinePreview = await previewApp.inject({
      method: "GET",
      url: `/api/collections/load_999_${"x".repeat(34)}`,
      headers: { "x-forwarded-for": "198.51.100.21" },
    });
    expect(baselinePreview.statusCode).toBe(404);
    const previewResponses = await Promise.all(Array.from({ length: 80 }, (_, index) => previewApp.inject({
      method: "GET",
      url: `/api/collections/load_${index.toString().padStart(3, "0")}_${"x".repeat(34)}`,
      headers: { "x-forwarded-for": "198.51.100.21" },
    })));
    expect(previewResponses.every((response) => response.statusCode === 404 || response.statusCode === 429)).toBe(true);
    expect(previewResponses.some((response) => response.statusCode === 429 && response.headers["retry-after"] !== undefined)).toBe(true);
    expect(previewResponses.every((response) => !response.body.includes("load_") && !response.body.includes("Alvarez"))).toBe(true);
  }, 15_000);

  it("coalesces idempotent fan-in and rejects competing stale household writes", async () => {
    const { app, repository } = await createFixture();
    const ownerHeaders = { authorization: "Bearer test-owner-token", "x-forwarded-for": "198.51.100.30" };
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_create_household",
      headers: ownerHeaders,
      payload: { name: "Load Kitchen", idempotency_key: "load-household-0001" },
    });
    const householdId = created.json().data.household_id as string;
    const firstHead = created.json().repository_head as string;
    const update = {
      household_id: householdId,
      expected_head: firstHead,
      profile: "household",
      markdown: "# Load Kitchen\n",
      idempotency_key: "fan-in-profile-0001",
    };
    const fanIn = await Promise.all(Array.from({ length: 32 }, () => app.inject({
      method: "POST", url: "/api/tools/hfj_update_profile", headers: ownerHeaders, payload: update,
    })));
    expect(fanIn.every((response) => response.statusCode === 200)).toBe(true);
    expect(new Set(fanIn.map((response) => response.body)).size).toBe(1);
    expect(repository.commitCount(HouseholdIdSchema.parse(householdId))).toBe(1);

    const currentHead = fanIn[0]!.json().repository_head as string;
    const competitors = await Promise.all(Array.from({ length: 16 }, (_, index) => app.inject({
      method: "POST",
      url: "/api/tools/hfj_update_profile",
      headers: ownerHeaders,
      payload: {
        household_id: householdId,
        expected_head: currentHead,
        profile: "snacks",
        markdown: `# Candidate ${index}\n`,
        idempotency_key: `competing-profile-${index.toString().padStart(4, "0")}`,
      },
    })));
    expect(competitors.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(competitors.filter((response) => response.statusCode === 409)).toHaveLength(15);
    expect(repository.commitCount(HouseholdIdSchema.parse(householdId))).toBe(2);

    const crossTenant = await Promise.all(Array.from({ length: 50 }, () => app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_profile",
      headers: { authorization: "Bearer test-member-token", "x-forwarded-for": "198.51.100.31" },
      payload: { household_id: householdId, profile: "household" },
    })));
    expect(crossTenant.every((response) => response.statusCode === 403)).toBe(true);
    expect(crossTenant.every((response) => !response.body.includes("Load Kitchen"))).toBe(true);
  }, 15_000);

  it("serializes same-household maintenance work without blocking another household", async () => {
    const store = new MemoryOperationalStore();
    const householdA = HouseholdIdSchema.parse("hsh_0000000000000701");
    const householdB = HouseholdIdSchema.parse("hsh_0000000000000702");
    let releaseFirst = (): void => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstEntered = (): void => {};
    const entered = new Promise<void>((resolve) => { firstEntered = resolve; });
    const first = store.withHouseholdLock(householdA, async () => {
      firstEntered();
      await firstGate;
    });
    await entered;
    let otherHouseholdCompleted = false;
    await store.withHouseholdLock(householdB, async () => { otherHouseholdCompleted = true; });
    expect(otherHouseholdCompleted).toBe(true);
    releaseFirst();
    await first;

    let active = 0;
    let maximumActive = 0;
    const order: number[] = [];
    await Promise.all(Array.from({ length: 100 }, (_, index) => store.withHouseholdLock(householdA, async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await delay(1);
      order.push(index);
      active -= 1;
    })));
    expect(maximumActive).toBe(1);
    expect(order).toEqual(Array.from({ length: 100 }, (_, index) => index));
  }, 15_000);
});
