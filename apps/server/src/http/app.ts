import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { ToolInputSchemas, ToolNameSchema, type ToolName } from "@hfj/contracts";
import { z } from "zod";
import type { AuthenticationPort, Clock, ExportArtifactPort, HouseholdRepositoryPort, IdentityProviderPort, MailPort, OperationalStorePort, RandomSource, TokenHasher } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { AppError } from "../core/errors.js";
import { HealthService } from "../health/health.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { registerBrowserAuthRoutes, type BrowserAuthRouteDependencies } from "../auth/routes.js";
import { registerAccountRoutes, type AccountRouteDependencies } from "../account/routes.js";
import { registerOAuthRoutes, type OAuthRouteDependencies } from "../oauth/routes.js";
import { registerWebExperience, type WebExperience } from "./web.js";
import type { ObservabilityPort } from "../telemetry/observability.js";

const ToolCallSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.literal("tools/call"),
  params: z.object({ name: ToolNameSchema, arguments: z.unknown() }).strict(),
}).strict();

const McpRequestSchema = z.union([
  z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]), method: z.literal("initialize"), params: z.unknown().optional() }).strict(),
  z.object({ jsonrpc: z.literal("2.0"), method: z.literal("notifications/initialized"), params: z.unknown().optional() }).strict(),
  z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]), method: z.literal("tools/list"), params: z.unknown().optional() }).strict(),
  ToolCallSchema,
]);
const RateLimitErrorSchema = z.object({
  statusCode: z.literal(429),
  error: z.object({ code: z.literal("RATE_LIMITED"), message: z.string(), retry_after_seconds: z.number().int().positive() }).strict(),
}).strict();
const ContentParserErrorSchema = z.object({
  code: z.enum([
    "FST_ERR_CTP_BODY_TOO_LARGE",
    "FST_ERR_CTP_EMPTY_JSON_BODY",
    "FST_ERR_CTP_INVALID_JSON_BODY",
    "FST_ERR_CTP_INVALID_MEDIA_TYPE",
  ]),
}).passthrough();

export interface AppDependencies {
  readonly service: HouseholdFoodJournalService;
  readonly authentication: AuthenticationPort;
  readonly store: OperationalStorePort;
  readonly repository: HouseholdRepositoryPort;
  readonly mail: MailPort;
  readonly identity: IdentityProviderPort;
  readonly random: RandomSource;
  readonly publicOrigin: URL;
  readonly health?: HealthService;
  readonly observability?: ObservabilityPort;
  readonly rateLimit?: { readonly max: number; readonly timeWindowMs: number };
  readonly operatorAuthentication?: (authorization: string | undefined) => void;
  readonly web?: WebExperience;
  readonly browserAuth?: BrowserAuthRouteDependencies;
  readonly account?: AccountRouteDependencies;
  readonly oauth?: OAuthRouteDependencies;
  readonly exportDownloads?: {
    readonly artifacts: ExportArtifactPort;
    readonly hasher: TokenHasher;
    readonly clock: Clock;
    resolveBrowserPrincipal?(request: FastifyRequest): Promise<Principal | null>;
  };
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_000_000,
    requestIdHeader: false,
    genReqId: () => dependencies.random.opaqueId("req"),
    trustProxy: 1,
  });
  await app.register(rateLimit, {
    global: true,
    max: dependencies.rateLimit?.max ?? 300,
    timeWindow: dependencies.rateLimit?.timeWindowMs ?? 60_000,
    cache: 20_000,
    skipOnError: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: { code: "RATE_LIMITED", message: "Too many requests", retry_after_seconds: Math.ceil(context.ttl / 1_000) },
    }),
    onExceeded: (request) => {
      const route = safeRoute(request.routeOptions.url);
      dependencies.observability?.rateLimited(route);
      dependencies.observability?.event("rate_limit.exceeded", { request_id: String(request.id), route });
    },
  });
  await app.register(cookie);
  await app.register(formbody);
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", String(request.id));
  });
  app.addHook("onResponse", async (request, reply) => {
    const durationSeconds = reply.elapsedTime / 1_000;
    const route = safeRoute(request.routeOptions.url);
    dependencies.observability?.observeHttp({ method: request.method, route, statusCode: reply.statusCode, durationSeconds });
    dependencies.observability?.event("http.request_completed", {
      request_id: String(request.id), method: request.method, route, status_code: reply.statusCode, duration_ms: Math.round(durationSeconds * 1_000),
    });
    const authCategory = authenticationCategory(route);
    if (authCategory !== null) {
      dependencies.observability?.event(authCategory.startsWith("oauth_") ? "oauth.request_completed" : "auth.request_completed", {
        request_id: String(request.id), auth_category: authCategory,
        outcome: reply.statusCode < 400 ? "success" : reply.statusCode === 429 ? "rate_limited" : "failure",
        status_code: reply.statusCode, duration_ms: Math.round(durationSeconds * 1_000),
      });
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const route = safeRoute(request.routeOptions.url);
    const rateLimitError = RateLimitErrorSchema.safeParse(error);
    if (rateLimitError.success) {
      dependencies.observability?.error("http.request_failed", new Error("RateLimitExceeded"), { request_id: String(request.id), method: request.method, route, status_code: 429, error_code: "RATE_LIMITED" });
      return reply.code(429).send({ error: rateLimitError.data.error });
    }
    const contentParserError = ContentParserErrorSchema.safeParse(error);
    if (contentParserError.success) {
      const statusCode = contentParserError.data.code === "FST_ERR_CTP_BODY_TOO_LARGE"
        ? 413
        : contentParserError.data.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" ? 415 : 400;
      dependencies.observability?.error("http.request_failed", new Error("RequestContentRejected"), { request_id: String(request.id), method: request.method, route, status_code: statusCode, error_code: "VALIDATION_FAILED" });
      return reply.code(statusCode).send({ error: { code: "VALIDATION_FAILED", message: "Request content was rejected" } });
    }
    if (error instanceof z.ZodError) {
      dependencies.observability?.error("http.request_failed", error, { request_id: String(request.id), method: request.method, route, status_code: 400, error_code: "VALIDATION_FAILED" });
      return reply.code(400).send({ error: { code: "VALIDATION_FAILED", message: "Request validation failed" } });
    }
    if (error instanceof AppError) {
      if (error.code === "AUTH_REQUIRED") {
        reply.header("www-authenticate", route === "/metrics" || route === "/health/operator"
          ? 'Bearer realm="operator"'
          : `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource", dependencies.publicOrigin)}"`);
      }
      dependencies.observability?.error("http.request_failed", error, { request_id: String(request.id), method: request.method, route, status_code: httpStatus(error.code), error_code: error.code });
      return reply.code(httpStatus(error.code)).send({ error: { code: error.code, message: error.message } });
    }
    dependencies.observability?.error("http.request_failed", error instanceof Error ? error : new Error("Unknown request failure"), { request_id: String(request.id), method: request.method, route, status_code: 500, error_code: "INTERNAL_ERROR" });
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } });
  });
  if (dependencies.browserAuth !== undefined) await registerBrowserAuthRoutes(app, dependencies.browserAuth);
  if (dependencies.account !== undefined) await registerAccountRoutes(app, dependencies.account);
  if (dependencies.oauth !== undefined) await registerOAuthRoutes(app, dependencies.oauth);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    reply.header("content-security-policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://appleid.apple.com");
    return payload;
  });

  const health = dependencies.health ?? new HealthService(dependencies.store, dependencies.repository);
  app.get("/health/live", { config: { rateLimit: false } }, async () => ({ live: true }));
  app.get("/health/ready", { config: { rateLimit: false } }, async (_request, reply) => {
    const report = await health.readiness();
    return reply.code(report.ready ? 200 : 503).send(report);
  });
  app.get("/health/operator", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "operator" } } }, async (request, reply) => {
    if (dependencies.operatorAuthentication === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Operator health is not configured");
    dependencies.operatorAuthentication(request.headers.authorization);
    const report = await health.operatorHealth();
    observeOperatorHealth(dependencies.observability, report);
    return reply.send(report);
  });
  app.get("/metrics", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "operator" } } }, async (request, reply) => {
    if (dependencies.operatorAuthentication === undefined || dependencies.observability === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Metrics are not configured");
    dependencies.operatorAuthentication(request.headers.authorization);
    observeOperatorHealth(dependencies.observability, await health.operatorHealth());
    return reply.header("content-type", dependencies.observability.metricsContentType).send(await dependencies.observability.metrics());
  });

  app.get("/.well-known/oauth-protected-resource", async () => ({ resource: new URL("/mcp", dependencies.publicOrigin).toString(), authorization_servers: [dependencies.publicOrigin.toString()], scopes_supported: ["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"] }));
  app.get("/.well-known/oauth-authorization-server", async () => ({ issuer: dependencies.publicOrigin.toString(), authorization_endpoint: new URL("/oauth/authorize", dependencies.publicOrigin), token_endpoint: new URL("/oauth/token", dependencies.publicOrigin), revocation_endpoint: new URL("/oauth/revoke", dependencies.publicOrigin), registration_endpoint: new URL("/oauth/register", dependencies.publicOrigin), response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"] }));
  app.get("/mcp", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "mcp" } } }, async (request) => {
    await authenticate(request.headers.authorization, dependencies.authentication);
    throw new AppError("VALIDATION_FAILED", "MCP requests must use POST");
  });

  app.post("/mcp", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "mcp" } } }, async (request, reply) => {
    const principal = await authenticate(request.headers.authorization, dependencies.authentication);
    const rpc = McpRequestSchema.parse(request.body);
    if (rpc.method === "initialize") return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "household-food-journal", version: "0.1.0" } } });
    if (rpc.method === "notifications/initialized") return reply.code(202).send();
    if (rpc.method === "tools/list") return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { tools: toolCatalog() } });
    const toolStartedAt = performance.now();
    const result = await dependencies.service.call(rpc.params.name, rpc.params.arguments, principal);
    dependencies.observability?.event("mcp.tool_completed", {
      request_id: String(request.id), tool: rpc.params.name, outcome: result.ok ? "success" : result.error.code,
      duration_ms: Math.round(performance.now() - toolStartedAt),
    });
    return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: !result.ok } });
  });

  app.post<{ Params: { name: string } }>("/api/tools/:name", { config: { rateLimit: { max: 120, timeWindow: 60_000 } } }, async (request, reply) => {
    const principal = await authenticate(request.headers.authorization, dependencies.authentication);
    const name = ToolNameSchema.parse(request.params.name);
    const result = await dependencies.service.call(name, request.body, principal);
    return reply.code(result.ok ? 200 : httpStatus(result.error.code)).send(result);
  });

  app.get<{ Params: { token: string } }>("/api/collections/:token", { config: { rateLimit: { max: 60, timeWindow: 60_000 } } }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    const result = await dependencies.service.preview(request.params.token);
    return reply.code(result.ok ? 200 : httpStatus(result.error.code)).send(result);
  });

  if (dependencies.exportDownloads !== undefined) {
    const exportDownloads = dependencies.exportDownloads;
    app.get<{ Params: { token: string } }>("/exports/:token", { config: { rateLimit: { max: 20, timeWindow: 15 * 60_000 } } }, async (request, reply) => {
      const browserPrincipal = await exportDownloads.resolveBrowserPrincipal?.(request) ?? null;
      const principal = browserPrincipal ?? await authenticate(request.headers.authorization, dependencies.authentication);
      const downloadedAt = exportDownloads.clock.now().toISOString();
      const tokenHash = exportDownloads.hasher.hash(request.params.token);
      const candidate = await dependencies.store.getActiveExportDownload(tokenHash, principal.userId, downloadedAt);
      if (candidate === null) throw new AppError("NOT_FOUND", "Export download was not found or has expired");
      const content = await exportDownloads.artifacts.read(candidate.objectPath);
      if (createHash("sha256").update(content).digest("hex") !== candidate.contentHash) throw new AppError("INTERNAL_ERROR", "Export artifact verification failed");
      const record = await dependencies.store.claimExportDownload(tokenHash, principal.userId, downloadedAt);
      if (record === null) throw new AppError("NOT_FOUND", "Export download was not found or has expired");
      reply.header("cache-control", "private, no-store");
      reply.header("content-type", record.format === "readable_zip" ? "application/zip" : "application/x-git-bundle");
      reply.header("content-disposition", `attachment; filename="fullwell-household.${record.format === "readable_zip" ? "zip" : "bundle"}"`);
      return reply.send(Buffer.from(content));
    });
  }

  if (dependencies.web !== undefined) await registerWebExperience(app, dependencies.web);

  return app;
}

async function authenticate(header: string | undefined, provider: AuthenticationPort) { return await provider.authenticate(header); }
function toolCatalog(): Array<{ name: ToolName; description: string; inputSchema: object }> {
  return Object.entries(ToolInputSchemas).map(([name, schema]) => ({ name: ToolNameSchema.parse(name), description: name.replaceAll("_", " "), inputSchema: z.toJSONSchema(schema) }));
}
function httpStatus(code: string): number {
  if (code === "AUTH_REQUIRED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  if (["REVISION_CONFLICT", "PROJECTION_DRIFT", "RECONCILIATION_REQUIRED"].includes(code)) return 409;
  if (code === "RATE_LIMITED") return 429;
  if (code === "PROVIDER_UNAVAILABLE") return 503;
  return code === "INTERNAL_ERROR" ? 500 : 400;
}

function safeRoute(route: string | undefined): string {
  return route !== undefined && route.startsWith("/") && route.length <= 160 ? route : "unmatched";
}

function observeOperatorHealth(observability: ObservabilityPort | undefined, report: Awaited<ReturnType<HealthService["operatorHealth"]>>): void {
  observability?.observeOperatorHealth({
    incompleteMutations: report.reconciliation.incomplete_mutations,
    quarantinedHouseholds: report.reconciliation.quarantined_households,
    householdsWithoutBackup: report.backup.households_without_backup,
    oldestIncompleteAgeSeconds: report.reconciliation.oldest_incomplete_age_seconds,
    oldestBackupAgeSeconds: report.backup.oldest_backup_age_seconds,
    fsckFailures: report.repository.fsck_failures,
    signatureFailures: report.repository.signature_failures,
    restoreDrillHealthy: report.backup.restore_drill_healthy,
    volumeUsedPercent: report.volume.usedPercent,
  });
}

export function authenticationCategory(route: string): string | null {
  if (route.startsWith("/auth/magic-link")) return "magic_link";
  if (route.startsWith("/auth/apple")) return "apple";
  if (route.startsWith("/auth/passkey")) return "passkey";
  if (route.startsWith("/account/sign-in-methods")) return "identity_management";
  if (route === "/oauth/register") return "oauth_registration";
  if (route === "/oauth/authorize") return "oauth_authorization";
  if (route === "/oauth/token") return "oauth_token";
  if (route === "/oauth/revoke") return "oauth_revocation";
  return null;
}
