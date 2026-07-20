import { createHash } from "node:crypto";
import type { OAuthScope } from "@hfj/contracts";
import { OAuthScopeSchema } from "@hfj/contracts";
import { z } from "zod";
import type { Clock, RandomSource, TokenHasher } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { OAuthProtocolError } from "./errors.js";
import type {
  AuthorizationRequest,
  OAuthAccessIdentity,
  OAuthClient,
  OAuthStore,
  OAuthTokenRecord,
  TokenResponse,
} from "./types.js";
import { OAuthScopes } from "./types.js";

const AuthorizationInputSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.url().max(4096),
  scope: z.string().min(1).max(512),
  state: z.string().min(16).max(1024),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  resource: z.url().max(4096),
}).strict();

const ClientRegistrationSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.url().max(4096)).min(1).max(20),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
  application_type: z.literal("native").optional(),
  scope: z.string().min(1).max(512).optional(),
  client_uri: z.url().max(4096).optional(),
  logo_uri: z.url().max(4096).optional(),
  contacts: z.array(z.email().max(320)).max(20).optional(),
  tos_uri: z.url().max(4096).optional(),
  policy_uri: z.url().max(4096).optional(),
  software_id: z.string().min(1).max(200).optional(),
  software_version: z.string().min(1).max(200).optional(),
}).strict();

export class OAuthService {
  constructor(
    private readonly store: OAuthStore,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly hasher: TokenHasher,
    private readonly resource: URL,
  ) {}

  async registerClient(input: unknown): Promise<OAuthClient> {
    const parsed = ClientRegistrationSchema.parse(input);
    const client: OAuthClient = {
      clientId: this.random.opaqueId("client"),
      name: parsed.client_name,
      redirectUris: parsed.redirect_uris.map(normalizeRedirectUri),
      tokenEndpointAuthMethod: parsed.token_endpoint_auth_method,
    };
    await this.store.registerClient(client);
    return client;
  }

  async validateAuthorizationRequest(input: unknown): Promise<AuthorizationRequest> {
    const parsed = AuthorizationInputSchema.parse(input);
    const client = await this.store.getClient(parsed.client_id);
    if (client === null) throw new OAuthProtocolError("invalid_client", "The client is not registered", 401);
    const redirectUri = normalizeRedirectUri(parsed.redirect_uri);
    if (!client.redirectUris.includes(redirectUri)) {
      throw new OAuthProtocolError("invalid_request", "The redirect URI is not registered");
    }
    const resource = validateResource(parsed.resource, this.resource);
    return {
      clientId: client.clientId,
      clientName: client.name,
      redirectUri,
      state: parsed.state,
      codeChallenge: parsed.code_challenge,
      scopes: parseScopes(parsed.scope),
      resource,
    };
  }

  async approve(request: AuthorizationRequest, principal: Principal): Promise<URL> {
    const now = this.clock.now();
    const grantId = this.random.opaqueId("grant");
    await this.store.saveGrant({
      id: grantId,
      userId: principal.userId,
      clientId: request.clientId,
      scopes: request.scopes,
      resource: request.resource,
      revokedAt: null,
    });
    const code = this.random.token(32);
    await this.store.saveToken({
      id: this.random.opaqueId("oauth"),
      grantId,
      kind: "authorization_code",
      tokenHash: this.hasher.hash(code),
      familyId: null,
      parentId: null,
      pkceChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
      audience: request.resource,
      expiresAt: addSeconds(now, 300),
      usedAt: null,
      revokedAt: null,
    });
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", request.state);
    return redirect;
  }

  async exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly codeVerifier: string;
    readonly resource?: string | undefined;
  }): Promise<TokenResponse> {
    validateVerifier(input.codeVerifier);
    if (input.resource !== undefined) validateResource(input.resource, this.resource);
    const now = this.clock.now();
    const consumed = await this.store.consumeAuthorizationCode({
      tokenHash: this.hasher.hash(input.code),
      clientId: input.clientId,
      redirectUri: normalizeRedirectUri(input.redirectUri),
      pkceChallenge: s256(input.codeVerifier),
      usedAt: now.toISOString(),
    });
    if (consumed === null || isInactive(consumed.token, now)) throw new OAuthProtocolError("invalid_grant", "The authorization code is invalid");
    return this.issueTokenPair(consumed.token.grantId, consumed.grant.scopes, consumed.token.audience, null);
  }

  async exchangeRefreshToken(input: { readonly refreshToken: string; readonly clientId: string; readonly resource?: string | undefined }): Promise<TokenResponse> {
    if (input.resource !== undefined) validateResource(input.resource, this.resource);
    const now = this.clock.now();
    const tokenHash = this.hasher.hash(input.refreshToken);
    const existing = await this.store.getToken(tokenHash);
    if (existing === null || existing.kind !== "refresh" || existing.familyId === null || isInactive(existing, now)) {
      if (existing?.familyId !== null && existing?.familyId !== undefined && existing.usedAt !== null) {
        await this.store.revokeFamily(existing.familyId, now.toISOString());
      }
      throw new OAuthProtocolError("invalid_grant", "The refresh token is invalid");
    }
    const grant = await this.store.getGrant(existing.grantId);
    if (grant === null || grant.clientId !== input.clientId || grant.revokedAt !== null) {
      throw new OAuthProtocolError("invalid_grant", "The refresh token is invalid");
    }
    const pair = this.buildTokenPair(existing.grantId, existing.audience, existing.familyId, existing.id, grant.scopes);
    const result = await this.store.rotateRefreshToken({ tokenHash, usedAt: now.toISOString(), access: pair.access, refresh: pair.refresh });
    if (result !== "rotated") {
      if (result === "reuse") await this.store.revokeFamily(existing.familyId, now.toISOString());
      throw new OAuthProtocolError("invalid_grant", "The refresh token is invalid");
    }
    return pair.response;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.store.revokeToken(this.hasher.hash(rawToken), this.clock.now().toISOString());
  }

  async authenticate(rawToken: string): Promise<OAuthAccessIdentity | null> {
    return this.store.resolveAccessToken(this.hasher.hash(rawToken), this.clock.now().toISOString());
  }

  private async issueTokenPair(grantId: string, scopes: ReadonlyArray<OAuthScope>, audience: string, familyId: string | null): Promise<TokenResponse> {
    const pair = this.buildTokenPair(grantId, audience, familyId ?? this.random.opaqueId("family"), null, scopes);
    await this.store.saveToken(pair.access);
    await this.store.saveToken(pair.refresh);
    return pair.response;
  }

  private buildTokenPair(grantId: string, audience: string, familyId: string, parentId: string | null, scopes: ReadonlyArray<OAuthScope> = OAuthScopes) {
    const now = this.clock.now();
    const accessRaw = this.random.token(32);
    const refreshRaw = this.random.token(48);
    const access: OAuthTokenRecord = {
      id: this.random.opaqueId("oauth"), grantId, kind: "access", tokenHash: this.hasher.hash(accessRaw),
      familyId, parentId: null, pkceChallenge: null, redirectUri: null, audience,
      expiresAt: addSeconds(now, 900), usedAt: null, revokedAt: null,
    };
    const refresh: OAuthTokenRecord = {
      id: this.random.opaqueId("oauth"), grantId, kind: "refresh", tokenHash: this.hasher.hash(refreshRaw),
      familyId, parentId, pkceChallenge: null, redirectUri: null, audience,
      expiresAt: addSeconds(now, 30 * 24 * 60 * 60), usedAt: null, revokedAt: null,
    };
    return {
      access,
      refresh,
      response: { access_token: accessRaw, token_type: "Bearer" as const, expires_in: 900, refresh_token: refreshRaw, scope: scopes.join(" ") },
    };
  }
}

function parseScopes(value: string): ReadonlyArray<OAuthScope> {
  const requested = [...new Set(value.split(" ").filter(Boolean))];
  const parsed = requested.map((scope) => OAuthScopeSchema.safeParse(scope));
  if (parsed.some((scope) => !scope.success)) throw new OAuthProtocolError("invalid_scope", "One or more requested permissions are unavailable");
  return parsed.flatMap((scope) => scope.success ? [scope.data] : []);
}

function normalizeRedirectUri(value: string): string {
  const url = new URL(value);
  if (url.hash !== "" || url.username !== "" || url.password !== "") throw new OAuthProtocolError("invalid_request", "The redirect URI is invalid");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost"))) {
    throw new OAuthProtocolError("invalid_request", "The redirect URI must use HTTPS");
  }
  return url.toString();
}

function normalizeResource(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function validateResource(value: string, expected: URL): string {
  const resource = normalizeResource(value);
  if (resource !== normalizeResource(expected.toString())) {
    throw new OAuthProtocolError("invalid_request", "The requested resource is not available");
  }
  return resource;
}

function validateVerifier(value: string): void {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(value)) throw new OAuthProtocolError("invalid_grant", "The code verifier is invalid");
}

function s256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function isInactive(token: OAuthTokenRecord, now: Date): boolean {
  return token.revokedAt !== null || token.usedAt !== null || new Date(token.expiresAt) <= now;
}
