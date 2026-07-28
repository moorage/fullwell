import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GitObjectIdSchema, HouseholdIdSchema, MealPlanEventIdSchema, MealProposalIdSchema, ToolInputSchemas } from "@hfj/contracts";
import { z } from "zod";
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
import { authenticationCategory, buildApp, MCP_BODY_LIMIT_BYTES, type AppDependencies } from "./app.js";
import { WebViewModelService } from "./web-view-model.js";
import { MemoryExportArtifactStore } from "../exports/artifact-store.js";
import { ServiceObservability } from "../telemetry/observability.js";
import { createOperatorAuthenticator, HealthService } from "../health/health.js";
import { AppError } from "../core/errors.js";

type FixtureOptions = Pick<AppDependencies, "observability" | "operatorAuthentication" | "rateLimit"> & {
  readonly publicOrigin?: URL;
};

async function fixture(options: FixtureOptions = {}) {
  const { publicOrigin: configuredPublicOrigin, ...appOptions } = options;
  const store = new MemoryOperationalStore();
  const repository = new MemoryHouseholdRepository();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const random = new DeterministicRandomSource();
  const hasher = new HmacTokenHasher("test-pepper-that-is-long-enough-0001");
  const authentication = new DeterministicTestAuthenticator();
  const publicOrigin = configuredPublicOrigin ?? new URL("https://example.test");
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
    ...appOptions,
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

  it("derives public metadata from the configured origin instead of the request host", async () => {
    const { app } = await fixture({ publicOrigin: new URL("https://fullwell.ai") });
    const authorization = await app.inject({
      method: "GET",
      url: "/.well-known/oauth-authorization-server",
      headers: { host: "attacker.example" },
    });
    expect(authorization.json()).toMatchObject({
      issuer: "https://fullwell.ai/",
      authorization_endpoint: "https://fullwell.ai/oauth/authorize",
      token_endpoint: "https://fullwell.ai/oauth/token",
      revocation_endpoint: "https://fullwell.ai/oauth/revoke",
      registration_endpoint: "https://fullwell.ai/oauth/register",
    });
    const resource = await app.inject({
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
      headers: { host: "attacker.example" },
    });
    expect(resource.json()).toMatchObject({
      resource: "https://fullwell.ai/mcp",
      authorization_servers: ["https://fullwell.ai/"],
    });
    expect(`${authorization.body}${resource.body}`).not.toContain("attacker.example");
    await app.close();
  });

  it("publishes and invokes the complete MCP tool catalog", async () => {
    const { app } = await fixture();
    const initialized = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", method: "notifications/initialized" } });
    expect(initialized.statusCode).toBe(202);
    expect(initialized.body).toBe("");
    const list = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(list.statusCode).toBe(200);
    const tools = list.json().result.tools as Array<{
      name: string;
      description: string;
      inputSchema: { type?: string };
      annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
    }>;
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(Object.keys(ToolInputSchemas));
    expect(tools.filter(({ inputSchema }) => inputSchema.type !== "object").map(({ name }) => name)).toEqual([]);
    expect(tools.find(({ name }) => name === "hfj_update_onboarding")?.description).toContain("Start, skip, or resume");
    expect(tools.find(({ name }) => name === "hfj_get_context")?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
    expect(tools.find(({ name }) => name === "hfj_commit_onboarding")?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(tools.find(({ name }) => name === "hfj_search_delivery_history")?.description).toContain("bounded household delivery history");
    expect(tools.find(({ name }) => name === "hfj_commit_delivery_index")?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });

    const create = await app.inject({ method: "POST", url: "/mcp", headers: { authorization: "Bearer test-owner-token" }, payload: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hfj_create_household", arguments: { name: "Our Kitchen", idempotency_key: "household-key-1" } } } });
    expect(create.statusCode).toBe(200);
    const envelope = create.json().result.structuredContent;
    expect(envelope.ok).toBe(true);
    expect(envelope.data.role).toBe("owner");

    const context = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: "Bearer test-owner-token" },
      payload: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "hfj_get_context", arguments: {}, _meta: { progressToken: 3 } },
      },
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().result.structuredContent.data.households).toHaveLength(1);

    const malformedMetadata = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: "Bearer test-owner-token" },
      payload: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "hfj_get_context", arguments: {}, _meta: "progress" },
      },
    });
    expect(malformedMetadata.statusCode).toBe(400);
    expect(malformedMetadata.json().error.code).toBe("VALIDATION_FAILED");
    await app.close();
  });

  it("accepts large MCP envelopes without widening other HTTP routes", async () => {
    const { app } = await fixture();
    const headers = { authorization: "Bearer test-owner-token", "content-type": "application/json" };
    const request = (paddingBytes: number) => JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "hfj_get_context", arguments: {}, _meta: { padding: "x".repeat(paddingBytes) } },
    });
    const aboveGlobalDefault = await app.inject({ method: "POST", url: "/mcp", headers, payload: request(1_100_000) });
    expect(aboveGlobalDefault.statusCode).toBe(200);
    const aboveMcpLimit = await app.inject({ method: "POST", url: "/mcp", headers, payload: request(MCP_BODY_LIMIT_BYTES) });
    expect(aboveMcpLimit.statusCode).toBe(413);
    const directTool = await app.inject({ method: "POST", url: "/api/tools/hfj_get_context", headers, payload: JSON.stringify({ padding: "x".repeat(1_100_000) }) });
    expect(directTool.statusCode).toBe(413);
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
    expect(ready.headers["content-security-policy"]).toContain("form-action 'self' https://appleid.apple.com https://wa.me https://api.whatsapp.com");
    expect(ready.headers["content-security-policy"]).not.toContain("http://127.0.0.1");
    const nativeConsent = await app.inject({ method: "GET", url: "/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Foauth%2Fcallback" });
    expect(nativeConsent.headers["content-security-policy"]).toContain("http://127.0.0.1:1455");
    const mergedDesktopConsent = await app.inject({ method: "GET", url: "/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A65525%2Fcallback%2FIWD1EUkzXzJu" });
    expect(mergedDesktopConsent.headers["content-security-policy"]).toContain("http://127.0.0.1:65525");
    const claudeConsent = await app.inject({ method: "GET", url: "/authorize?redirect_uri=http%3A%2F%2Flocalhost%3A3118%2Fcallback" });
    expect(claudeConsent.headers["content-security-policy"]).toContain("http://localhost:3118");
    for (const redirectUri of [
      "http://127.0.0.1:65525/callback",
      "http://127.0.0.1:65525/callback/nonce/extra",
      "http://127.0.0.1:65525/callback/nonce?unexpected=true",
      "http://127.0.0.1:65525/unrelated/nonce",
      "http://person@127.0.0.1:65525/callback/nonce",
      "http://localhost:65525/callback/nonce",
      "http://localhost:3118/oauth/callback",
      "http://localhost:3118/callback/extra",
      "http://localhost:3118/callback?unexpected=true",
      "http://localhost:3118/callback#unexpected",
      "http://person@localhost:3118/callback",
      "http://localhost/callback",
    ]) {
      const invalidConsent = await app.inject({ method: "GET", url: `/authorize?${new URLSearchParams({ redirect_uri: redirectUri })}` });
      expect(invalidConsent.headers["content-security-policy"]).not.toContain(new URL(redirectUri).origin);
    }
    const remoteConsent = await app.inject({ method: "GET", url: "/authorize?redirect_uri=https%3A%2F%2Fattacker.example%2Foauth%2Fcallback" });
    expect(remoteConsent.headers["content-security-policy"]).not.toContain("attacker.example");
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
    const browserOwner = await base.authentication.authenticate("Bearer test-owner-token");
    const browserEditor = await base.authentication.authenticate("Bearer test-member-token");
    const viewModels = await WebViewModelService.create({
      service: base.service,
      store: base.store,
      authentication: base.authentication,
      hasher: base.hasher,
      random: base.random,
      clock: base.clock,
      publicOrigin: base.publicOrigin,
      installMetadataPath: resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json"),
      resolvePrincipal: async (request) => {
        if (request.headers["x-test-browser-session"] === "owner") return browserOwner;
        if (request.headers["x-test-browser-session"] === "editor") return browserEditor;
        return null;
      },
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
        renameHousehold: (request, input) => viewModels.renameHousehold(request, input),
        reviewMealConstraints: (request, input) => viewModels.reviewMealConstraints(request, input),
        addMealProposal: (request, input) => viewModels.addMealProposal(request, input),
        withdrawMealProposal: (request, input) => viewModels.withdrawMealProposal(request, input),
        journalItems: (request, input) => viewModels.journalItems(request, input),
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
    expect(response.body).not.toContain('rel="canonical"');
    const homepage = await app.inject({ method: "GET", url: "/" });
    expect(homepage.statusCode).toBe(200);
    expect(homepage.headers["x-robots-tag"]).toBeUndefined();
    expect(homepage.body).toContain("Fullwell by Sous Chef Studio");
    expect(homepage.body).toContain("household assistant");
    expect(homepage.body).toContain("Sous Chef Studio, Inc.");
    expect(homepage.body).toContain("WhatsApp");
    expect(homepage.body).toContain("<title>Fullwell Household Assistant | By Sous Chef Studio</title>");
    expect(homepage.body).toContain('<meta name="description"');
    expect(homepage.body).toContain('<link rel="canonical" href="https://example.test/">');
    expect(homepage.body).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/assets/fullwell-icon-32.png">');
    expect(homepage.body).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/assets/fullwell-icon-180.png">');
    expect(homepage.body).toContain('<link rel="manifest" href="/site.webmanifest">');
    expect(homepage.body).toContain('<meta property="og:site_name" content="Fullwell">');
    expect(homepage.body).toContain('<meta property="og:image:type" content="image/png">');
    expect(homepage.body).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(homepage.body).toContain('<meta name="twitter:image" content="https://example.test/assets/fullwell-social-card.png">');
    const structuredDataMatch = /<script type="application\/ld\+json">([^<]+)<\/script>/.exec(homepage.body);
    if (structuredDataMatch?.[1] === undefined) throw new Error("homepage structured data is missing");
    const structuredData = z.object({
      "@context": z.literal("https://schema.org"),
      "@graph": z.array(z.object({ "@type": z.string(), name: z.string() }).passthrough()),
    }).parse(JSON.parse(structuredDataMatch[1]));
    expect(structuredData["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "Organization", name: "Sous Chef Studio, Inc." }),
      expect.objectContaining({
        "@type": "WebApplication",
        name: "Fullwell",
        image: "https://example.test/assets/fullwell-icon.png",
        thumbnailUrl: "https://example.test/assets/fullwell-icon.png",
        brand: expect.objectContaining({
          "@type": "Brand",
          name: "Fullwell",
          logo: "https://example.test/assets/fullwell-icon.png",
        }),
      }),
    ]));
    for (const publicPath of ["/about", "/company", "/privacy", "/terms"]) {
      const publicPage = await app.inject({ method: "GET", url: publicPath });
      expect(publicPage.statusCode, publicPath).toBe(200);
      expect(publicPage.headers["x-robots-tag"], publicPath).toBeUndefined();
      expect(publicPage.body, publicPath).toContain("Fullwell");
      expect(publicPage.body, publicPath).toContain("Sous Chef Studio, Inc.");
      expect(publicPage.body, publicPath).toContain(`rel="canonical" href="https://example.test${publicPath}"`);
      expect(publicPage.body, publicPath).not.toContain("@fullwell.example");
    }
    const socialImage = await app.inject({ method: "GET", url: "/assets/fullwell-social-card.png" });
    expect(socialImage.statusCode).toBe(200);
    expect(socialImage.headers["content-type"]).toContain("image/png");
    const favicon = await app.inject({ method: "GET", url: "/favicon.ico" });
    expect(favicon.statusCode).toBe(200);
    expect(favicon.headers["content-type"]).toContain("image/x-icon");
    expect(favicon.headers["cache-control"]).toContain("immutable");
    const siteManifest = await app.inject({ method: "GET", url: "/site.webmanifest" });
    expect(siteManifest.statusCode).toBe(200);
    expect(siteManifest.headers["content-type"]).toContain("application/manifest+json");
    expect(siteManifest.json()).toMatchObject({
      name: "Fullwell",
      icons: [
        { src: "/assets/fullwell-icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/fullwell-icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
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
    const householdId = HouseholdIdSchema.parse(created.headers.location?.split("/").at(-1));
    const createdHousehold = await base.store.getHousehold(householdId);
    if (createdHousehold === null) throw new Error("created household missing");
    const anonymousRecipes = await app.inject({ method: "GET", url: `/households/${householdId}/recipes` });
    expect(anonymousRecipes.statusCode).toBe(303);
    expect(anonymousRecipes.headers.location).toBe(`/sign-in?returnTo=${encodeURIComponent(`/households/${householdId}/recipes`)}`);
    const emptyRecipes = await app.inject({
      method: "GET",
      url: `/households/${householdId}/recipes`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(emptyRecipes.statusCode).toBe(200);
    expect(emptyRecipes.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(emptyRecipes.body).toContain("No recipes recorded yet");
    const anonymousTakeout = await app.inject({ method: "GET", url: `/households/${householdId}/takeout` });
    expect(anonymousTakeout.statusCode).toBe(303);
    expect(anonymousTakeout.headers.location).toBe(`/sign-in?returnTo=${encodeURIComponent(`/households/${householdId}/takeout`)}`);
    const emptyTakeout = await app.inject({
      method: "GET",
      url: `/households/${householdId}/takeout`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(emptyTakeout.statusCode).toBe(200);
    expect(emptyTakeout.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(emptyTakeout.body).toContain("No takeout items yet");
    const anonymousJournalBatch = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=recipes`,
    });
    expect(anonymousJournalBatch.statusCode).toBe(401);
    const emptyJournalBatch = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=recipes`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(emptyJournalBatch.statusCode).toBe(200);
    expect(emptyJournalBatch.headers["cache-control"]).toBe("private, no-store");
    expect(emptyJournalBatch.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(emptyJournalBatch.json()).toMatchObject({ householdId, section: "recipes", total: 0, items: [], nextCursor: null });
    const cursorJournalBatch = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=recipes&cursor=v1_0`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(cursorJournalBatch.statusCode).toBe(200);
    expect(cursorJournalBatch.json()).toMatchObject({ householdId, section: "recipes", items: [] });
    const emptyTakeoutBatch = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=takeout&snapshotRevision=${createdHousehold.repositoryHead}`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(emptyTakeoutBatch.statusCode).toBe(200);
    expect(emptyTakeoutBatch.json()).toMatchObject({
      householdId,
      section: "takeout",
      snapshotRevision: createdHousehold.repositoryHead,
      total: 0,
      items: [],
    });
    const staleTakeoutBatch = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=takeout&snapshotRevision=${"0".repeat(40)}`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(staleTakeoutBatch.statusCode).toBe(409);
    const invalidJournalCursor = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=recipes&cursor=not-a-cursor`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(invalidJournalCursor.statusCode).toBe(400);
    const invited = await base.service.call("hfj_create_family_invite", {
      household_id: householdId,
      role: "editor",
      expected_head: createdHousehold.repositoryHead,
      idempotency_key: "web-meal-editor-invite-0001",
    }, browserOwner);
    if (!invited.ok) throw new Error(invited.error.message);
    const invitationUrl = z.object({ url: z.url() }).parse(invited.data).url;
    const invitationToken = new URL(invitationUrl).pathname.split("/").at(-1);
    if (invitationToken === undefined) throw new Error("editor invitation token missing");
    const accepted = await base.service.call("hfj_accept_family_invite", {
      token: invitationToken,
      accept: true,
      idempotency_key: "web-meal-editor-accept-0001",
    }, browserEditor);
    if (!accepted.ok) throw new Error(accepted.error.message);
    const household = await base.store.getHousehold(householdId);
    if (household === null) throw new Error("accepted household missing");
    const owner = browserOwner;
    const constraints = await base.service.call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: household.repositoryHead,
      idempotency_key: "web-meal-constraints-0001",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-15T12:00:00.000Z",
      },
    }, owner);
    if (!constraints.ok) throw new Error(constraints.error.message);
    const constraintRevision = GitObjectIdSchema.parse(
      z.object({ constraint_revision: z.string() }).parse(constraints.data).constraint_revision,
    );
    const mealPlanUrl = `/households/${householdId}/meal-plan?week=2026-07-13`;
    const anonymousMealPlan = await app.inject({ method: "GET", url: mealPlanUrl });
    expect(anonymousMealPlan.statusCode).toBe(303);
    expect(anonymousMealPlan.headers.location).toBe(`/sign-in?returnTo=${encodeURIComponent(mealPlanUrl)}`);
    const unreviewedMealPlan = await app.inject({ method: "GET", url: mealPlanUrl, headers: { "x-test-browser-session": "owner" } });
    expect(unreviewedMealPlan.statusCode).toBe(200);
    expect(unreviewedMealPlan.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(unreviewedMealPlan.body).toContain("Review updated household constraints");

    const reviewPayload = new URLSearchParams({
      week: "2026-07-13",
      constraintRevision,
      csrf: "c".repeat(32),
      idempotencyKey: "web-meal-review-0001",
    }).toString();
    const unauthenticatedReview = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/review`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: reviewPayload,
    });
    expect(unauthenticatedReview.statusCode).toBe(401);
    expect(unauthenticatedReview.body).toContain("Sign in before changing this meal plan.");
    const rejectedReview = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/review`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(reviewPayload)), csrf: "x".repeat(32) }).toString(),
    });
    expect(rejectedReview.statusCode).toBe(403);
    const reviewed = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/review`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: reviewPayload,
    });
    expect(reviewed.statusCode).toBe(303);
    expect(reviewed.headers.location).toContain("changed=constraints-reviewed");
    const projected = await base.service.call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-13",
    }, owner);
    if (!projected.ok) throw new Error(projected.error.message);
    const reviewEventId = MealPlanEventIdSchema.parse(z.object({
      events: z.array(z.object({ id: z.string(), kind: z.string() })),
    }).parse(projected.data).events.find(({ kind }) => kind === "constraints_reviewed")?.id);
    const proposalPayload = (title: string, idempotencyKey: string) => new URLSearchParams({
      week: "2026-07-13",
      mealDate: "2026-07-13",
      slotKind: "lunch",
      title,
      servings: "",
      notes: "",
      constraintRevision,
      constraintReviewEventId: reviewEventId,
      csrf: "c".repeat(32),
      idempotencyKey,
    }).toString();
    const proposalHeaders = { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" };
    const editorProposalHeaders = { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "editor" };
    const detailedProposal = new URLSearchParams({
      ...Object.fromEntries(new URLSearchParams(proposalPayload("Egg salad sandwich", "web-meal-proposal-egg-0001"))),
      servings: "3",
      notes: "Use the fresh loaf",
    }).toString();
    const [firstProposal, secondProposal] = await Promise.all([
      app.inject({ method: "POST", url: `/households/${householdId}/meal-plan/proposals`, headers: proposalHeaders, payload: detailedProposal }),
      app.inject({ method: "POST", url: `/households/${householdId}/meal-plan/proposals`, headers: editorProposalHeaders, payload: proposalPayload("Pizza", "web-meal-proposal-pizza-0001") }),
    ]);
    expect(firstProposal.statusCode).toBe(303);
    expect(secondProposal.statusCode).toBe(303);
    expect(firstProposal.headers.location).toContain("#slot-2026-07-13-lunch");
    const replayedProposal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: proposalHeaders,
      payload: detailedProposal,
    });
    expect(replayedProposal.statusCode).toBe(303);
    const conflictingRetry = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: proposalHeaders,
      payload: proposalPayload("Changed retry", "web-meal-proposal-egg-0001"),
    });
    expect(conflictingRetry.statusCode).toBe(409);
    expect(conflictingRetry.headers["content-type"]).toContain("text/html");
    expect(conflictingRetry.body).toContain("The meal plan changed before this request completed.");
    expect(conflictingRetry.body).toContain("Return to the meal plan and try again");
    const malformedProposal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: proposalHeaders,
      payload: new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(proposalPayload("Bad date", "web-meal-proposal-invalid-0001"))),
        mealDate: "not-a-date",
      }).toString(),
    });
    expect(malformedProposal.statusCode).toBe(400);
    expect(malformedProposal.headers["content-type"]).toContain("text/html");
    expect(malformedProposal.body).toContain("submitted meal details were not valid");
    const unreadableProposal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: { "content-type": "application/json", "x-test-browser-session": "owner" },
      payload: "{",
    });
    expect(unreadableProposal.statusCode).toBe(400);
    expect(unreadableProposal.headers["content-type"]).toContain("text/html");
    expect(unreadableProposal.body).toContain("submitted meal details could not be read");
    const populatedMealPlan = await app.inject({ method: "GET", url: mealPlanUrl, headers: { "x-test-browser-session": "owner" } });
    expect(populatedMealPlan.body).toContain("Egg salad sandwich");
    expect(populatedMealPlan.body).toContain("Pizza");
    expect(populatedMealPlan.body.match(/meal-card/g)?.length).toBeGreaterThanOrEqual(2);
    const invalidWeek = await app.inject({
      method: "GET",
      url: `/households/${householdId}/meal-plan?week=2026-07-14`,
      headers: { "x-test-browser-session": "owner" },
    });
    expect(invalidWeek.statusCode).toBe(400);
    const populatedProjection = await base.service.call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-13",
    }, owner);
    if (!populatedProjection.ok) throw new Error(populatedProjection.error.message);
    const proposalRows = z.object({
      proposals: z.array(z.object({
        proposal: z.object({ id: z.string(), source: z.object({ title: z.string() }).passthrough() }).passthrough(),
      })),
    }).parse(populatedProjection.data).proposals;
    const eggProposalId = MealProposalIdSchema.parse(
      proposalRows.find(({ proposal }) => proposal.source.title === "Egg salad sandwich")?.proposal.id,
    );
    const pizzaProposalId = MealProposalIdSchema.parse(
      proposalRows.find(({ proposal }) => proposal.source.title === "Pizza")?.proposal.id,
    );
    const forbiddenEditorWithdrawal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals/${eggProposalId}/withdraw`,
      headers: editorProposalHeaders,
      payload: new URLSearchParams({
        week: "2026-07-13",
        csrf: "c".repeat(32),
        idempotencyKey: "web-meal-withdraw-other-editor-0001",
      }).toString(),
    });
    expect(forbiddenEditorWithdrawal.statusCode).toBe(403);
    expect(forbiddenEditorWithdrawal.headers["content-type"]).toContain("text/html");
    const withdrawalPayload = new URLSearchParams({
      week: "2026-07-13",
      csrf: "c".repeat(32),
      idempotencyKey: "web-meal-withdraw-pizza-0001",
    }).toString();
    const withdrawn = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals/${pizzaProposalId}/withdraw`,
      headers: editorProposalHeaders,
      payload: withdrawalPayload,
    });
    expect(withdrawn.statusCode).toBe(303);
    expect(withdrawn.headers.location).toContain("changed=proposal-withdrawn");
    const replayedWithdrawal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals/${pizzaProposalId}/withdraw`,
      headers: editorProposalHeaders,
      payload: withdrawalPayload,
    });
    expect(replayedWithdrawal.statusCode).toBe(303);
    const afterWithdrawal = await app.inject({ method: "GET", url: mealPlanUrl, headers: { "x-test-browser-session": "owner" } });
    expect(afterWithdrawal.body).toContain("Egg salad sandwich");
    expect(afterWithdrawal.body).not.toContain(">Pizza<");
    const ownerWithdrawal = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals/${eggProposalId}/withdraw`,
      headers: proposalHeaders,
      payload: new URLSearchParams({
        week: "2026-07-13",
        reason: "Choosing a different lunch",
        csrf: "c".repeat(32),
        idempotencyKey: "web-meal-withdraw-egg-owner-0001",
      }).toString(),
    });
    expect(ownerWithdrawal.statusCode).toBe(303);
    const secondHousehold = await base.service.call("hfj_create_household", {
      name: "Owner-only Kitchen",
      idempotency_key: "web-meal-cross-tenant-household-0001",
    }, owner);
    if (!secondHousehold.ok) throw new Error(secondHousehold.error.message);
    const secondHouseholdId = HouseholdIdSchema.parse(
      z.object({ household_id: z.string() }).parse(secondHousehold.data).household_id,
    );
    const crossTenantRead = await app.inject({
      method: "GET",
      url: `/households/${secondHouseholdId}/meal-plan?week=2026-07-13`,
      headers: { "x-test-browser-session": "editor" },
    });
    expect(crossTenantRead.statusCode).toBe(200);
    expect(crossTenantRead.body).toContain("Household not found");
    expect(crossTenantRead.body).not.toContain("Owner-only Kitchen");
    expect(crossTenantRead.body).not.toContain("Egg salad sandwich");
    const crossTenantJournalBatch = await app.inject({
      method: "GET",
      url: `/households/${secondHouseholdId}/journal-items?section=recipes`,
      headers: { "x-test-browser-session": "editor" },
    });
    expect(crossTenantJournalBatch.statusCode).toBe(404);
    const crossTenantAdd = await app.inject({
      method: "POST",
      url: `/households/${secondHouseholdId}/meal-plan/proposals`,
      headers: editorProposalHeaders,
      payload: proposalPayload("Cross-tenant idea", "web-meal-cross-tenant-0001"),
    });
    expect(crossTenantAdd.statusCode).toBe(403);
    const editorMembership = (await base.store.listMemberships(browserEditor.userId))[0]?.membership;
    if (editorMembership === undefined) throw new Error("editor membership missing");
    await base.store.upsertMembership({ ...editorMembership, removedAt: "2026-07-15T13:00:00.000Z" });
    const removedEditorAdd = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: editorProposalHeaders,
      payload: proposalPayload("Removed editor idea", "web-meal-removed-editor-0001"),
    });
    expect(removedEditorAdd.statusCode).toBe(403);
    const removedEditorJournal = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=groceries`,
      headers: { "x-test-browser-session": "editor" },
    });
    expect(removedEditorJournal.statusCode).toBe(404);
    await base.store.upsertMembership({
      ...editorMembership,
      projectionHead: GitObjectIdSchema.parse("0".repeat(40)),
      removedAt: null,
    });
    const staleEditorAdd = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: editorProposalHeaders,
      payload: proposalPayload("Stale editor idea", "web-meal-stale-editor-0001"),
    });
    expect(staleEditorAdd.statusCode).toBe(409);
    const staleEditorJournal = await app.inject({
      method: "GET",
      url: `/households/${householdId}/journal-items?section=groceries`,
      headers: { "x-test-browser-session": "editor" },
    });
    expect(staleEditorJournal.statusCode).toBe(409);
    const householdBeforeRename = await base.store.getHousehold(householdId);
    if (householdBeforeRename === null) throw new Error("household missing before rename");
    const headBeforeRename = householdBeforeRename.repositoryHead;
    const renamePayload = new URLSearchParams({
      name: "Garden Table",
      expectedHead: headBeforeRename,
      csrf: "c".repeat(32),
      idempotencyKey: "web-household-rename-0001",
    }).toString();
    const renamed = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: renamePayload,
    });
    expect(renamed.statusCode).toBe(303);
    expect(renamed.headers.location).toBe(`/households/${householdId}?renamed=1#household-name`);
    const replayedRename = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: renamePayload,
    });
    expect(replayedRename.statusCode).toBe(303);
    const renamedPage = await app.inject({ method: "GET", url: `/households/${householdId}`, headers: { "x-test-browser-session": "owner" } });
    expect(renamedPage.body).toContain("Garden Table");
    const staleRename = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: new URLSearchParams({
        name: "Old Page Name",
        expectedHead: headBeforeRename,
        csrf: "c".repeat(32),
        idempotencyKey: "web-household-rename-stale-0001",
      }).toString(),
    });
    expect(staleRename.statusCode).toBe(409);
    expect(staleRename.body).toContain("changed after this page opened");
    expect(staleRename.headers["x-robots-tag"]).toBe("noindex, nofollow");
    const householdAfterRename = await base.store.getHousehold(householdId);
    if (householdAfterRename === null) throw new Error("household missing after rename");
    const invalidName = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: new URLSearchParams({
        name: "Bad\nName",
        expectedHead: householdAfterRename.repositoryHead,
        csrf: "c".repeat(32),
        idempotencyKey: "web-household-rename-invalid-0001",
      }).toString(),
    });
    expect(invalidName.statusCode).toBe(400);
    expect(invalidName.body).toContain("between 1 and 120 characters");
    const rejectedRenameCsrf = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "owner" },
      payload: new URLSearchParams({
        name: "CSRF Bypass",
        expectedHead: householdAfterRename.repositoryHead,
        csrf: "x".repeat(32),
        idempotencyKey: "web-household-rename-csrf-0001",
      }).toString(),
    });
    expect(rejectedRenameCsrf.statusCode).toBe(403);
    expect(rejectedRenameCsrf.body).toContain("do not have permission");
    await base.store.upsertMembership({
      ...editorMembership,
      projectionHead: householdAfterRename.repositoryHead,
      removedAt: null,
    });
    const forbiddenEditorRename = await app.inject({
      method: "POST",
      url: `/households/${householdId}/name`,
      headers: { "content-type": "application/x-www-form-urlencoded", "x-test-browser-session": "editor" },
      payload: new URLSearchParams({
        name: "Editor Bypass",
        expectedHead: householdAfterRename.repositoryHead,
        csrf: "c".repeat(32),
        idempotencyKey: "web-household-rename-editor-0001",
      }).toString(),
    });
    expect(forbiddenEditorRename.statusCode).toBe(403);
    expect(forbiddenEditorRename.body).toContain("do not have permission");
    const ownerMembership = (await base.store.listMemberships(owner.userId))[0]?.membership;
    if (ownerMembership === undefined) throw new Error("owner membership missing");
    await base.store.upsertMembership({ ...ownerMembership, role: "viewer" });
    const viewerMealPlan = await app.inject({ method: "GET", url: mealPlanUrl, headers: { "x-test-browser-session": "owner" } });
    expect(viewerMealPlan.body).toContain("only household owners and editors can change it");
    expect(viewerMealPlan.body).not.toContain("Add meal idea");
    const forbiddenViewerAdd = await app.inject({
      method: "POST",
      url: `/households/${householdId}/meal-plan/proposals`,
      headers: proposalHeaders,
      payload: proposalPayload("Viewer idea", "web-meal-proposal-viewer-0001"),
    });
    expect(forbiddenViewerAdd.statusCode).toBe(403);
    const publicAfterPlanning = await app.inject({ method: "GET", url: "/c/not-a-real-token" });
    expect(publicAfterPlanning.body).not.toContain("Egg salad sandwich");
    expect(publicAfterPlanning.body).not.toContain("Pizza");
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

  it("returns explicit unavailable responses for omitted browser capabilities", async () => {
    const base = await fixture();
    await base.app.close();
    const viewModels = await WebViewModelService.create({
      service: base.service,
      store: base.store,
      authentication: base.authentication,
      hasher: base.hasher,
      random: base.random,
      clock: base.clock,
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
      web: {
        assetsRoot: resolve(import.meta.dirname, "../../../web/dist"),
        contextFor: (request) => viewModels.contextFor(request),
      },
    });
    const householdId = "hsh_0000000000000901";
    const responses = await Promise.all([
      app.inject({ method: "POST", url: "/households" }),
      app.inject({ method: "POST", url: `/households/${householdId}/name` }),
      app.inject({ method: "POST", url: `/households/${householdId}/meal-plan/review` }),
      app.inject({ method: "POST", url: `/households/${householdId}/meal-plan/proposals` }),
      app.inject({ method: "POST", url: `/households/${householdId}/meal-plan/proposals/mlp_0000000000000901/withdraw` }),
      app.inject({ method: "GET", url: `/households/${householdId}/journal-items?section=recipes` }),
    ]);
    expect(responses.map(({ statusCode }) => statusCode)).toEqual([501, 501, 501, 501, 501, 501]);
    expect(responses.every(({ json }) => json().error.code === "PROVIDER_UNAVAILABLE")).toBe(true);
    await app.close();
  });

  it("handles MCP initialization and rejects malformed HTTP content at the boundary", async () => {
    const observability = new ServiceObservability({ runtimeMetrics: false, stdout: () => undefined, stderr: () => undefined });
    const { app } = await fixture({ observability });
    const initialized = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: "Bearer test-owner-token" },
      payload: { jsonrpc: "2.0", id: 99, method: "initialize" },
    });
    expect(initialized.json().result).toMatchObject({
      protocolVersion: "2025-06-18",
      serverInfo: { name: "fullwell-cloud" },
    });

    const unsupported = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_context",
      headers: { authorization: "Bearer test-owner-token", "content-type": "application/xml" },
      payload: "not-json",
    });
    expect(unsupported.statusCode).toBe(415);
    const malformed = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_context",
      headers: { authorization: "Bearer test-owner-token", "content-type": "application/json" },
      payload: "{",
    });
    expect(malformed.statusCode).toBe(400);
    const oversized = await app.inject({
      method: "POST",
      url: "/api/tools/hfj_get_context",
      headers: { authorization: "Bearer test-owner-token", "content-type": "application/json" },
      payload: JSON.stringify({ padding: "x".repeat(1_100_000) }),
    });
    expect(oversized.statusCode).toBe(413);
    const invalidNativeRedirect = await app.inject({
      method: "GET",
      url: "/authorize?redirect_uri=not-a-url",
    });
    expect(invalidNativeRedirect.headers["content-security-policy"]).not.toContain("not-a-url");
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
