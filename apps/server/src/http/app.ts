import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance } from "fastify";
import { ToolInputSchemas, ToolNameSchema, type ToolName } from "@hfj/contracts";
import { z } from "zod";
import type { AuthenticationPort, HouseholdRepositoryPort, IdentityProviderPort, MailPort, OperationalStorePort, RandomSource } from "../core/ports.js";
import { AppError } from "../core/errors.js";
import { HealthService } from "../health/health.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { registerBrowserAuthRoutes, type BrowserAuthRouteDependencies } from "../auth/routes.js";
import { registerOAuthRoutes, type OAuthRouteDependencies } from "../oauth/routes.js";
import { registerWebExperience, type WebExperience } from "./web.js";

const ToolCallSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.literal("tools/call"),
  params: z.object({ name: ToolNameSchema, arguments: z.unknown() }).strict(),
}).strict();

const McpRequestSchema = z.union([
  z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]), method: z.literal("initialize"), params: z.unknown().optional() }).strict(),
  z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]), method: z.literal("tools/list"), params: z.unknown().optional() }).strict(),
  ToolCallSchema,
]);

export interface AppDependencies {
  readonly service: HouseholdFoodJournalService;
  readonly authentication: AuthenticationPort;
  readonly store: OperationalStorePort;
  readonly repository: HouseholdRepositoryPort;
  readonly mail: MailPort;
  readonly identity: IdentityProviderPort;
  readonly random: RandomSource;
  readonly publicOrigin: URL;
  readonly web?: WebExperience;
  readonly browserAuth?: BrowserAuthRouteDependencies;
  readonly oauth?: OAuthRouteDependencies;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000, requestIdHeader: "x-request-id" });
  await app.register(cookie);
  await app.register(formbody);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "VALIDATION_FAILED", message: "Request validation failed" } });
    if (error instanceof AppError) {
      if (error.code === "AUTH_REQUIRED") reply.header("www-authenticate", `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource", dependencies.publicOrigin)}"`);
      return reply.code(httpStatus(error.code)).send({ error: { code: error.code, message: error.message } });
    }
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } });
  });
  if (dependencies.browserAuth !== undefined) await registerBrowserAuthRoutes(app, dependencies.browserAuth);
  if (dependencies.oauth !== undefined) await registerOAuthRoutes(app, dependencies.oauth);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    reply.header("content-security-policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return payload;
  });

  const health = new HealthService(dependencies.store, dependencies.repository);
  app.get("/health/live", async () => ({ live: true }));
  app.get("/health/ready", async (_request, reply) => {
    const report = await health.readiness();
    return reply.code(report.ready ? 200 : 503).send(report);
  });
  app.get("/health/operator", async (request, reply) => {
    await authenticate(request.headers.authorization, dependencies.authentication);
    return reply.send(await health.readiness());
  });

  app.get("/.well-known/oauth-protected-resource", async () => ({ resource: new URL("/mcp", dependencies.publicOrigin).toString(), authorization_servers: [dependencies.publicOrigin.toString()], scopes_supported: ["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"] }));
  app.get("/.well-known/oauth-authorization-server", async () => ({ issuer: dependencies.publicOrigin.toString(), authorization_endpoint: new URL("/oauth/authorize", dependencies.publicOrigin), token_endpoint: new URL("/oauth/token", dependencies.publicOrigin), revocation_endpoint: new URL("/oauth/revoke", dependencies.publicOrigin), response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"] }));
  app.get("/mcp", async (request) => {
    await authenticate(request.headers.authorization, dependencies.authentication);
    throw new AppError("VALIDATION_FAILED", "MCP requests must use POST");
  });

  app.post("/mcp", async (request, reply) => {
    const principal = await authenticate(request.headers.authorization, dependencies.authentication);
    const rpc = McpRequestSchema.parse(request.body);
    if (rpc.method === "initialize") return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "household-food-journal", version: "0.1.0" } } });
    if (rpc.method === "tools/list") return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { tools: toolCatalog() } });
    const result = await dependencies.service.call(rpc.params.name, rpc.params.arguments, principal);
    return reply.send({ jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: !result.ok } });
  });

  app.post<{ Params: { name: string } }>("/api/tools/:name", async (request, reply) => {
    const principal = await authenticate(request.headers.authorization, dependencies.authentication);
    const name = ToolNameSchema.parse(request.params.name);
    const result = await dependencies.service.call(name, request.body, principal);
    return reply.code(result.ok ? 200 : httpStatus(result.error.code)).send(result);
  });

  app.get<{ Params: { token: string } }>("/api/collections/:token", async (request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    const result = await dependencies.service.preview(request.params.token);
    return reply.code(result.ok ? 200 : httpStatus(result.error.code)).send(result);
  });

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
