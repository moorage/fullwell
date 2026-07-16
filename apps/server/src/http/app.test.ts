import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { ToolInputSchemas } from "@hfj/contracts";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import {
  DeterministicRandomSource,
  DeterministicTestAuthenticator,
  FixedClock,
  HmacTokenHasher,
  NoopTelemetry,
  UnconfiguredAppleIdentityProvider,
  UnconfiguredMailProvider,
} from "../adapters/providers.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { buildApp } from "./app.js";
import { WebViewModelService } from "./web-view-model.js";

async function fixture() {
  const store = new MemoryOperationalStore();
  const repository = new MemoryHouseholdRepository();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const random = new DeterministicRandomSource();
  const hasher = new HmacTokenHasher("test-pepper-that-is-long-enough-0001");
  const authentication = new DeterministicTestAuthenticator();
  const publicOrigin = new URL("https://example.test");
  const service = new HouseholdFoodJournalService(store, repository, clock, random, hasher, new NoopTelemetry(), publicOrigin);
  const app = await buildApp({ service, authentication, store, repository, mail: new UnconfiguredMailProvider(), identity: new UnconfiguredAppleIdentityProvider(), random, publicOrigin });
  return { app, repository, service, store, authentication, hasher, random, publicOrigin };
}

describe("Fastify application", () => {
  it("publishes and invokes the complete MCP tool catalog", async () => {
    const { app } = await fixture();
    const list = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(list.statusCode).toBe(200);
    const names = list.json().result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(Object.keys(ToolInputSchemas));

    const create = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hfj_create_household", arguments: { name: "Our Kitchen", idempotency_key: "household-key-1" } } } });
    expect(create.statusCode).toBe(200);
    const envelope = create.json().result.structuredContent;
    expect(envelope.ok).toBe(true);
    expect(envelope.data.role).toBe("owner");

    const context = await app.inject({ method: "POST", url: "/api/tools/hfj_get_context", headers: { authorization: "Bearer test-owner-token" }, payload: {} });
    expect(context.statusCode).toBe(200);
    expect(context.json().data.households).toHaveLength(1);
    await app.close();
  });

  it("replays a mutation response without a second commit", async () => {
    const { app, repository } = await fixture();
    const headers = { authorization: "Bearer test-owner-token" };
    const created = await app.inject({ method: "POST", url: "/api/tools/hfj_create_household", headers, payload: { name: "Our Kitchen", idempotency_key: "household-key-1" } });
    const householdId = created.json().data.household_id;
    const head = created.json().repository_head;
    const payload = { household_id: householdId, expected_head: head, profile: "snacks", markdown: "# Shops\n", idempotency_key: "profile-key-0001" };
    const first = await app.inject({ method: "POST", url: "/api/tools/hfj_update_profile", headers, payload });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: "POST", url: "/api/tools/hfj_update_profile", headers, payload });
    expect(second.json()).toEqual(first.json());
    expect(repository.commitCount(householdId)).toBe(1);
    await app.close();
  });

  it("rejects unauthenticated calls and keeps readiness public", async () => {
    const { app } = await fixture();
    const unauthorized = await app.inject({ method: "POST", url: "/mcp", payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json().error.code).toBe("AUTH_REQUIRED");
    expect(unauthorized.headers["www-authenticate"]).toContain("oauth-protected-resource");
    const unauthorizedGet = await app.inject({ method: "GET", url: "/mcp" });
    expect(unauthorizedGet.statusCode).toBe(401);
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.headers["referrer-policy"]).toBe("no-referrer");
    await app.close();
  });

  it("serves the production React build with server-owned public state", async () => {
    const base = await fixture();
    await base.app.close();
    const viewModels = await WebViewModelService.create({
      service: base.service,
      store: base.store,
      authentication: base.authentication,
      hasher: base.hasher,
      random: base.random,
      publicOrigin: base.publicOrigin,
      installMetadataPath: resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json"),
    });
    const app = await buildApp({
      service: base.service,
      authentication: base.authentication,
      store: base.store,
      repository: base.repository,
      mail: new UnconfiguredMailProvider(),
      identity: new UnconfiguredAppleIdentityProvider(),
      random: base.random,
      publicOrigin: base.publicOrigin,
      web: { assetsRoot: resolve(import.meta.dirname, "../../../web/dist"), contextFor: (request) => viewModels.contextFor(request) },
    });
    const response = await app.inject({ method: "GET", url: "/c/not-a-real-token" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.body).toContain("We could not open this collection");
    expect(response.body).not.toContain("Alvarez");
    expect(response.body).toMatch(/assets\/index-[^"]+\.js/);
    const noJavaScriptPlan = await app.inject({
      method: "POST",
      url: "/c/not-a-real-token/import/plan",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "itemIds=collection-item-1&csrf=cccccccccccccccc&idempotencyKey=plan-key-0001",
    });
    expect(noJavaScriptPlan.statusCode).toBe(200);
    expect(noJavaScriptPlan.body).toContain("We could not open this collection");
    const repeatedSelectionPlan = await app.inject({
      method: "POST",
      url: "/c/not-a-real-token/import/plan",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "itemIds=collection-item-1&itemIds=collection-item-2&csrf=cccccccccccccccc&idempotencyKey=plan-key-0002",
    });
    expect(repeatedSelectionPlan.statusCode).toBe(200);
    const unconfiguredImport = await app.inject({
      method: "POST",
      url: "/c/not-a-real-token/import",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "householdId=household-1&itemIds=collection-item-1&csrf=cccccccccccccccc&idempotencyKey=import-key-0001",
    });
    expect(unconfiguredImport.statusCode).toBe(501);
    const nonWeb = await app.inject({ method: "GET", url: "/not-a-web-route" });
    expect(nonWeb.statusCode).toBe(404);
    const unauthorizedMcp = await app.inject({ method: "GET", url: "/mcp" });
    expect(unauthorizedMcp.statusCode).toBe(401);
    expect(unauthorizedMcp.headers["www-authenticate"]).toContain("resource_metadata");
    await app.close();
  });

  it("maps tool and public-preview failures to stable HTTP statuses", async () => {
    const { app } = await fixture();
    const headers = { authorization: "Bearer test-owner-token" };
    const created = await app.inject({ method: "POST", url: "/api/tools/hfj_create_household", headers, payload: { name: "Status Kitchen", idempotency_key: "status-household-0001" } });
    const householdId = created.json().data.household_id;
    const head = created.json().repository_head;

    const forbidden = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_profile",
      headers: { authorization: "Bearer test-member-token" },
      payload: { household_id: householdId, profile: "household" },
    });
    expect(forbidden.statusCode).toBe(403);

    const missing = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_item",
      headers,
      payload: { household_id: householdId, item_id: "itm_0000000000000999" },
    });
    expect(missing.statusCode).toBe(404);

    const conflict = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_update_profile",
      headers,
      payload: { household_id: householdId, expected_head: "f".repeat(40), profile: "household", markdown: "# Stale", idempotency_key: "status-conflict-0001" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(head).not.toBe("f".repeat(40));

    const preview = await app.inject({ method: "GET", url: "/api/collections/short" });
    expect(preview.statusCode).toBe(400);
    expect(preview.headers["cache-control"]).toBe("no-store");
    expect(preview.headers["x-robots-tag"]).toBe("noindex, nofollow");
    await app.close();
  });
});
