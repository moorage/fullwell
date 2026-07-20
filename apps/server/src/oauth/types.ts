import type { OAuthScope, UserId } from "@hfj/contracts";

export const OAuthScopes = [
  "journal:read",
  "journal:write",
  "household:manage",
  "collection:share",
  "journal:export",
] as const satisfies ReadonlyArray<OAuthScope>;

export interface OAuthClient {
  readonly clientId: string;
  readonly name: string;
  readonly redirectUris: ReadonlyArray<string>;
  readonly tokenEndpointAuthMethod: "none";
}

export interface OAuthGrant {
  readonly id: string;
  readonly userId: UserId;
  readonly clientId: string;
  readonly scopes: ReadonlyArray<OAuthScope>;
  readonly resource: string;
  readonly revokedAt: string | null;
}

export interface OAuthGrantSummary {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly scopes: ReadonlyArray<OAuthScope>;
}

export interface OAuthTokenRecord {
  readonly id: string;
  readonly grantId: string;
  readonly kind: "authorization_code" | "access" | "refresh";
  readonly tokenHash: string;
  readonly familyId: string | null;
  readonly parentId: string | null;
  readonly pkceChallenge: string | null;
  readonly redirectUri: string | null;
  readonly audience: string;
  readonly expiresAt: string;
  readonly usedAt: string | null;
  readonly revokedAt: string | null;
}

export interface OAuthAccessIdentity {
  readonly userId: UserId;
  readonly actorId: string;
  readonly displayName: string;
  readonly clientId: string;
  readonly scopes: ReadonlyArray<OAuthScope>;
}

export interface OAuthStore {
  getClient(clientId: string): Promise<OAuthClient | null>;
  registerClient(client: OAuthClient): Promise<void>;
  saveGrant(grant: OAuthGrant): Promise<void>;
  getGrant(grantId: string): Promise<OAuthGrant | null>;
  listActiveGrants(userId: UserId): Promise<readonly OAuthGrantSummary[]>;
  revokeGrantForUser(userId: UserId, grantId: string, revokedAt: string): Promise<boolean>;
  revokeUserAccess(userId: UserId, revokedAt: string): Promise<void>;
  saveToken(token: OAuthTokenRecord): Promise<void>;
  consumeAuthorizationCode(input: {
    readonly tokenHash: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly pkceChallenge: string;
    readonly usedAt: string;
  }): Promise<{ readonly token: OAuthTokenRecord; readonly grant: OAuthGrant } | null>;
  getToken(tokenHash: string): Promise<OAuthTokenRecord | null>;
  rotateRefreshToken(input: {
    readonly tokenHash: string;
    readonly usedAt: string;
    readonly access: OAuthTokenRecord;
    readonly refresh: OAuthTokenRecord;
  }): Promise<"rotated" | "reuse" | "invalid">;
  revokeToken(tokenHash: string, revokedAt: string): Promise<void>;
  revokeFamily(familyId: string, revokedAt: string): Promise<void>;
  resolveAccessToken(tokenHash: string, now: string): Promise<OAuthAccessIdentity | null>;
}

export interface AuthorizationRequest {
  readonly clientId: string;
  readonly clientName: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly scopes: ReadonlyArray<OAuthScope>;
  readonly resource: string;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: "Bearer";
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly scope: string;
}
