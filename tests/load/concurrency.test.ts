import { setTimeout as delay } from "node:timers/promises";
import {
  GitObjectIdSchema,
  HouseholdIdSchema,
  MEAL_PLAN_MAX_PROPOSALS_PER_WEEK,
  MealProposalSchema,
} from "@hfj/contracts";
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

async function createFixture(): Promise<{
  app: FastifyInstance;
  repository: MemoryHouseholdRepository;
  store: MemoryOperationalStore;
}> {
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
  return { app, repository, store };
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

  it("serves the maximum meal week once and rejects an oversized projection before paging it", async () => {
    const { app, store } = await createFixture();
    const headers = { authorization: "Bearer test-owner-token", "x-forwarded-for": "198.51.100.32" };
    const created = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_create_household",
      headers,
      payload: { name: "Bounded Load Kitchen", idempotency_key: "load-meal-household-0001" },
    });
    const householdId = HouseholdIdSchema.parse(created.json().data.household_id);
    const constraints = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_update_meal_planning_constraints",
      headers,
      payload: {
        household_id: householdId,
        expected_head: created.json().repository_head,
        idempotency_key: "load-meal-constraints-0001",
        constraints: {
          status: "confirmed_none",
          time_zone: "America/Los_Angeles",
          reviewed_at: "2026-07-20T16:00:00.000Z",
        },
      },
    });
    const constraintRevision = GitObjectIdSchema.parse(constraints.json().data.constraint_revision);
    const review = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_review_meal_constraints",
      headers,
      payload: {
        household_id: householdId,
        week_start: "2026-07-20",
        constraint_revision: constraintRevision,
        idempotency_key: "load-meal-review-0001",
      },
    });
    const reviewEventId = review.json().data.event_id as string;
    const projection = await store.projection(householdId);
    const proposalFor = (index: number) => MealProposalSchema.parse({
      id: `mlp_${index.toString(36).padStart(16, "0")}`,
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "custom", label: `Slot ${index}` },
      proposed_by: "act_0000000000000001",
      source: { kind: "freeform", title: `Synthetic meal ${index}` },
      servings: null,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients still need review.",
      created_at: "2026-07-20T16:00:00.000Z",
      schema_version: 1,
    });
    for (let index = 0; index < MEAL_PLAN_MAX_PROPOSALS_PER_WEEK; index += 1) {
      const proposal = proposalFor(index);
      projection.mealProposals.set(proposal.id, { proposal, revision: constraintRevision });
    }

    const startedAt = performance.now();
    const bounded = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_meal_plan",
      headers,
      payload: { household_id: householdId, week_start: "2026-07-20", limit: 500 },
    });
    expect(bounded.statusCode).toBe(200);
    expect(bounded.json().data.proposals).toHaveLength(MEAL_PLAN_MAX_PROPOSALS_PER_WEEK);
    expect(performance.now() - startedAt).toBeLessThan(2_000);

    const overflow = proposalFor(MEAL_PLAN_MAX_PROPOSALS_PER_WEEK);
    projection.mealProposals.set(overflow.id, { proposal: overflow, revision: constraintRevision });
    const rejected = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_meal_plan",
      headers,
      payload: { household_id: householdId, week_start: "2026-07-20", limit: 500 },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json().error).toMatchObject({ code: "PROJECTION_DRIFT" });
    expect(rejected.body).not.toContain("Synthetic meal");
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
