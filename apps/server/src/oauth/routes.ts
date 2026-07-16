import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Principal } from "../core/types.js";
import { OAuthProtocolError } from "./errors.js";
import type { OAuthService } from "./service.js";

const AuthorizationFormSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string(),
  scope: z.string(),
  state: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
  resource: z.string(),
  approve: z.union([z.literal(true), z.literal("true")]),
  csrf_token: z.string().min(32).max(512),
}).strict();

const TokenRequestSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(32).max(512),
    client_id: z.string().min(1).max(2048),
    redirect_uri: z.string().max(4096),
    code_verifier: z.string().min(43).max(128),
  }).strict(),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(32).max(512),
    client_id: z.string().min(1).max(2048),
  }).strict(),
]);

const RevokeRequestSchema = z.object({ token: z.string().min(32).max(512) }).strict();
const OAUTH_AUTHORIZE_RATE_LIMIT = { max: 60, timeWindow: 15 * 60_000, groupId: "oauth-authorize" } as const;

export interface OAuthRouteDependencies {
  readonly oauth: OAuthService;
  readonly resolveBrowserPrincipal: (request: FastifyRequest) => Promise<Principal>;
  readonly verifyCsrf: (request: FastifyRequest, submittedToken: string) => Promise<void>;
}

export async function registerOAuthRoutes(app: FastifyInstance, dependencies: OAuthRouteDependencies): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      const form = Object.fromEntries(new URLSearchParams(body.toString()));
      done(null, form);
    });
  }

  app.post("/oauth/register", { config: { rateLimit: { max: 10, timeWindow: 60 * 60_000 } } }, async (request, reply) => oauthReply(reply, async () => {
    const client = await dependencies.oauth.registerClient(request.body);
    return reply.code(201).send({
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  }));

  app.get("/oauth/authorize", { config: { rateLimit: OAUTH_AUTHORIZE_RATE_LIMIT } }, async (request, reply) => oauthReply(reply, async () => {
    await dependencies.resolveBrowserPrincipal(request);
    const authorization = await dependencies.oauth.validateAuthorizationRequest(request.query);
    return reply.send({
      client_id: authorization.clientId,
      redirect_uri: authorization.redirectUri,
      state: authorization.state,
      resource: authorization.resource,
      scopes: authorization.scopes,
      code_challenge: authorization.codeChallenge,
      code_challenge_method: "S256",
    });
  }));

  app.post("/oauth/authorize", { config: { rateLimit: OAUTH_AUTHORIZE_RATE_LIMIT } }, async (request, reply) => oauthReply(reply, async () => {
    const form = AuthorizationFormSchema.parse(request.body);
    await dependencies.verifyCsrf(request, form.csrf_token);
    const principal = await dependencies.resolveBrowserPrincipal(request);
    const authorization = await dependencies.oauth.validateAuthorizationRequest({
      response_type: form.response_type,
      client_id: form.client_id,
      redirect_uri: form.redirect_uri,
      scope: form.scope,
      state: form.state,
      code_challenge: form.code_challenge,
      code_challenge_method: form.code_challenge_method,
      resource: form.resource,
    });
    return reply.redirect((await dependencies.oauth.approve(authorization, principal)).toString());
  }));

  app.post("/oauth/token", { config: { rateLimit: { max: 30, timeWindow: 60_000 } } }, async (request, reply) => oauthReply(reply, async () => {
    const form = TokenRequestSchema.parse(request.body);
    reply.header("cache-control", "no-store");
    reply.header("pragma", "no-cache");
    const response = form.grant_type === "authorization_code"
      ? await dependencies.oauth.exchangeAuthorizationCode({ code: form.code, clientId: form.client_id, redirectUri: form.redirect_uri, codeVerifier: form.code_verifier })
      : await dependencies.oauth.exchangeRefreshToken({ refreshToken: form.refresh_token, clientId: form.client_id });
    return reply.send(response);
  }));

  app.post("/oauth/revoke", { config: { rateLimit: { max: 60, timeWindow: 60_000 } } }, async (request, reply) => oauthReply(reply, async () => {
    const form = RevokeRequestSchema.parse(request.body);
    await dependencies.oauth.revoke(form.token);
    return reply.code(200).send();
  }));
}

async function oauthReply(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OAuthProtocolError) {
      return reply.code(error.statusCode).send({ error: error.code, error_description: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "invalid_request", error_description: "The request is invalid" });
    }
    throw error;
  }
}
