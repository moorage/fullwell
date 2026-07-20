import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
import { authenticationCategory, buildApp, type AppDependencies } from "./app.js";
import { WebViewModelService } from "./web-view-model.js";
import { MemoryExportArtifactStore } from "../exports/artifact-store.js";
import { ServiceObservability } from "../telemetry/observability.js";
import { createOperatorAuthenticator, HealthService } from "../health/health.js";
import { AppError } from "../core/errors.js";

async function fixture(options: Pick<AppDependencies, "observability" | "operatorAuthentication" | "rateLimit"> = {}) {
  const store = new MemoryOperationalStore();
  const repository = new MemoryHouseholdRepository();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const random = new DeterministicRandomSource();
  const hasher = new HmacTokenHasher("test-pepper-that-is-long-enough-0001");
  const authentication = new DeterministicTestAuthenticator();
  const publicOrigin = new URL("https://example.test");
  const artifacts = new MemoryExportArtifactStore();
  const service = new HouseholdFoodJournalService(store, repository, clock, random, hasher, new NoopTelemetry(), publicOrigin, artifacts);
  const browserOwner = await authentication.authenticate("Bearer test-owner-token");
  const healthRoot = await mkdtemp(join(tmpdir(), "hfj-app-health-"));
  await writeFile(join(healthRoot, ".hfj-volume-id"), "test-volume\n");
  const health = new HealthService(store, repository, { clock, expectedSchemaVersion: "memory", repositoryRoot: healthRoot, signingConfigured: true });
  const app = await buildApp({
    service, authentication, store, repository, mail: new UnconfiguredMailProvider(), identity: new UnconfiguredAppleIdentityProvider(), random, publicOrigin,
    health,
    exportDownloads: { artifacts, hasher, clock, resolveBrowserPrincipal: async (request) => request.headers["x-test-browser-session"] === "owner" ? browserOwner : null },
    ...options,
  });
  app.addHook("onClose", async () => rm(healthRoot, { recursive: true, force: true }));
  return { app, repository, service, store, authentication, hasher, random, publicOrigin, artifacts, clock };
}

describe("Fastify application", () => {
  it("classifies bounded authentication telemetry categories", () => {
    expect([
      "/auth/magic-link", "/auth/apple/start", "/auth/passkey/options", "/account/sign-in-methods/apple/start",
      "/oauth/register", "/oauth/authorize", "/oauth/token", "/oauth/revoke", "/households",
    ].map(authenticationCategory)).toEqual([
      "magic_link", "apple", "passkey", "identity_management",
      "oauth_registration", "oauth_authorization", "oauth_token", "oauth_revocation", null,
    ]);
  });

  it("publishes and invokes the complete MCP tool catalog", async () => {
    const { app } = await fixture();
    const initialized = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(initialized.statusCode).toBe(202);
    expect(initialized.body).toBe("");
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

  it("serves a readable ZIP once to the authenticated requester", async () => {
    const { app, clock } = await fixture();
    const headers = { authorization: "Bearer test-owner-token" };
    const created = await app.inject({ method: "POST", url: "/api/tools/hfj_create_household", headers, payload: { name: "Export Kitchen", idempotency_key: "export-household-key" } });
    const requested = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_export_household",
      headers,
      payload: { household_id: created.json().data.household_id, format: "readable_zip", idempotency_key: "readable-export-key" },
    });
    expect(requested.statusCode).toBe(200);
    const downloadPath = new URL(requested.json().data.download_url).pathname;
    const crossUser = await app.inject({ method: "GET", url: downloadPath, headers: { authorization: "Bearer test-member-token" } });
    expect(crossUser.statusCode).toBe(404);
    const downloaded = await app.inject({ method: "GET", url: downloadPath, headers });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("application/zip");
    expect(downloaded.headers["content-disposition"]).toBe('attachment; filename="fullwell-household.zip"');
    expect(downloaded.headers["cache-control"]).toBe("private, no-store");
    expect(downloaded.rawPayload.subarray(0, 2).toString("ascii")).toBe("PK");
    expect((await app.inject({ method: "GET", url: downloadPath, headers })).statusCode).toBe(404);

    const browserBundle = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_export_household",
      headers,
      payload: { household_id: created.json().data.household_id, format: "git_bundle", idempotency_key: "browser-bundle-export-key" },
    });
    const browserDownload = await app.inject({
      method: "GET",
      url: new URL(browserBundle.json().data.download_url).pathname,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(browserDownload.statusCode).toBe(200);
    expect(browserDownload.headers["content-type"]).toContain("application/x-git-bundle");
    expect(browserDownload.headers["content-disposition"]).toBe('attachment; filename="fullwell-household.bundle"');

    const concurrentPayload = { household_id: created.json().data.household_id, format: "readable_zip", idempotency_key: "concurrent-export-key" };
    const concurrentExports = await Promise.all([
      app.inject({ method: "POST", url: "/api/tools/hfj_export_household", headers, payload: concurrentPayload }),
      app.inject({ method: "POST", url: "/api/tools/hfj_export_household", headers, payload: concurrentPayload }),
    ]);
    expect(concurrentExports[1]?.json()).toEqual(concurrentExports[0]?.json());
    expect((await app.inject({ method: "GET", url: new URL(concurrentExports[0]?.json().data.download_url).pathname, headers })).statusCode).toBe(200);

    const expiring = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_export_household",
      headers,
      payload: { household_id: created.json().data.household_id, format: "git_bundle", idempotency_key: "expiring-export-key" },
    });
    clock.advance(15 * 60_000);
    expect((await app.inject({ method: "GET", url: new URL(expiring.json().data.download_url).pathname, headers })).statusCode).toBe(404);

    const racing = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_export_household",
      headers,
      payload: { household_id: created.json().data.household_id, format: "readable_zip", idempotency_key: "racing-export-key" },
    });
    const racingPath = new URL(racing.json().data.download_url).pathname;
    const racingResponses = await Promise.all([
      app.inject({ method: "GET", url: racingPath, headers }),
      app.inject({ method: "GET", url: racingPath, headers }),
    ]);
    expect(racingResponses.map((response) => response.statusCode).sort()).toEqual([200, 404]);
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
    const oauthMetadata = await app.inject({ method: "GET", url: "/.well-known/oauth-authorization-server" });
    expect(oauthMetadata.json()).toMatchObject({
      registration_endpoint: "https://example.test/oauth/register",
      token_endpoint_auth_methods_supported: ["none"],
    });
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.headers["referrer-policy"]).toBe("no-referrer");
    expect(ready.headers["content-security-policy"]).toContain("form-action 'self' https://appleid.apple.com");
    expect((await app.inject({ method: "GET", url: "/health/operator" })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/metrics" })).statusCode).toBe(503);
    await app.close();
  });

  it("rate limits by trusted client IP and protects OpenMetrics with the operator credential", async () => {
    const logs: string[] = [];
    const observability = new ServiceObservability({ runtimeMetrics: false, stdout: (line) => logs.push(line), stderr: (line) => logs.push(line) });
    const operatorAuthentication = createOperatorAuthenticator("operator-test-token-that-is-long-enough", new HmacTokenHasher("operator-metrics-pepper-that-is-long-enough"));
    const { app } = await fixture({ observability, operatorAuthentication, rateLimit: { max: 1, timeWindowMs: 60_000 } });
    const first = await app.inject({ method: "GET", url: "/.well-known/oauth-protected-resource", headers: { "x-request-id": "private-caller-value" } });
    expect(first.statusCode).toBe(200);
    expect(first.headers["x-request-id"]).toMatch(/^req_/);
    expect(first.headers["x-request-id"]).not.toBe("private-caller-value");
    const limited = await app.inject({ method: "GET", url: "/.well-known/oauth-protected-resource" });
    expect(limited.statusCode, `${limited.body}\n${logs.join("")}`).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer test-owner-token" } })).statusCode).toBe(401);
    const metrics = await app.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer operator-test-token-that-is-long-enough" } });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers["content-type"]).toContain("openmetrics-text");
    expect(metrics.body).toContain("hfj_rate_limited_total");
    const operatorHealth = await app.inject({ method: "GET", url: "/health/operator", headers: { authorization: "Bearer operator-test-token-that-is-long-enough" } });
    expect(operatorHealth.statusCode).toBe(200);
    expect(operatorHealth.json()).toMatchObject({ status: "healthy", reconciliation: { incomplete_mutations: 0 } });
    expect(logs.join("")).not.toContain("private-caller-value");
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
      resolvePrincipal: async (request) => request.headers["x-test-browser-session"] === "owner" ? await base.authentication.authenticate("Bearer test-owner-token") : null,
      verifyCsrf: async (_request, submittedToken) => {
        if (submittedToken !== "c".repeat(32)) throw new AppError("FORBIDDEN", "CSRF validation failed");
      },
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
      web: {
        assetsRoot: resolve(import.meta.dirname, "../../../web/dist"),
        contextFor: (request) => viewModels.contextFor(request),
        createHousehold: (request, input) => viewModels.createHousehold(request, input),
      },
    });
    const response = await app.inject({ method: "GET", url: "/c/not-a-real-token" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.body).toContain("We could not open this collection");
    expect(response.body).not.toContain("Alvarez");
    expect(response.body).toMatch(/assets\/index-[^"]+\.js/);
    const account = await app.inject({ method: "GET", url: "/account" });
    expect(account.statusCode).toBe(303);
    expect(account.headers.location).toBe("/sign-in?returnTo=%2Faccount");
    const createPayload = new URLSearchParams({
      name: "Recovery Kitchen",
      csrf: "c".repeat(32),
      idempotencyKey: "web-household-create-0001",
    }).toString();
    const unauthenticatedCreate = await app.inject({
      method: "POST", url: "/households", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: createPayload,
    });
    expect(unauthenticatedCreate.statusCode).toBe(401);
    const rejectedCreate = await app.inject({
      method: "POST", url: "/households", headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: new URLSearchParams({ name: "Recovery Kitchen", csrf: "x".repeat(32), idempotencyKey: "web-household-create-0001" }).toString(),
    });
    expect(rejectedCreate.statusCode).toBe(403);
    const created = await app.inject({
      method: "POST", url: "/households", headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" }, payload: createPayload,
    });
    expect(created.statusCode).toBe(303);
    expect(created.headers.location).toMatch(/^\/households\/hsh_/);
    const replayed = await app.inject({
      method: "POST", url: "/households", headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" }, payload: createPayload,
    });
    expect(replayed.headers.location).toBe(created.headers.location);
    expect(await base.store.listHouseholds()).toHaveLength(1);
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
