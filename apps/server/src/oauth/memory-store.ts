import type {
  OAuthAccessIdentity,
  OAuthClient,
  OAuthGrant,
  OAuthStore,
  OAuthTokenRecord,
} from "./types.js";

export class MemoryOAuthStore implements OAuthStore {
  private readonly clients = new Map<string, OAuthClient>();
  private readonly grants = new Map<string, OAuthGrant>();
  private readonly tokens = new Map<string, OAuthTokenRecord>();
  private readonly identities = new Map<string, Omit<OAuthAccessIdentity, "clientId" | "scopes">>();

  addIdentity(identity: Omit<OAuthAccessIdentity, "clientId" | "scopes">): void {
    this.identities.set(identity.userId, identity);
  }

  async getClient(clientId: string): Promise<OAuthClient | null> { return this.clients.get(clientId) ?? null; }
  async registerClient(client: OAuthClient): Promise<void> { this.clients.set(client.clientId, client); }
  async saveGrant(grant: OAuthGrant): Promise<void> { this.grants.set(grant.id, grant); }
  async getGrant(grantId: string): Promise<OAuthGrant | null> { return this.grants.get(grantId) ?? null; }
  async saveToken(token: OAuthTokenRecord): Promise<void> { this.tokens.set(token.tokenHash, token); }

  async consumeAuthorizationCode(input: { readonly tokenHash: string; readonly clientId: string; readonly redirectUri: string; readonly pkceChallenge: string; readonly usedAt: string }): Promise<{ readonly token: OAuthTokenRecord; readonly grant: OAuthGrant } | null> {
    const token = this.tokens.get(input.tokenHash);
    const grant = token === undefined ? undefined : this.grants.get(token.grantId);
    if (
      token === undefined || grant === undefined || token.kind !== "authorization_code" || token.usedAt !== null || token.revokedAt !== null ||
      token.redirectUri !== input.redirectUri || token.pkceChallenge !== input.pkceChallenge || grant.clientId !== input.clientId || grant.revokedAt !== null
    ) return null;
    this.tokens.set(input.tokenHash, { ...token, usedAt: input.usedAt });
    return { token, grant };
  }

  async getToken(tokenHash: string): Promise<OAuthTokenRecord | null> { return this.tokens.get(tokenHash) ?? null; }

  async rotateRefreshToken(input: { readonly tokenHash: string; readonly usedAt: string; readonly access: OAuthTokenRecord; readonly refresh: OAuthTokenRecord }): Promise<"rotated" | "reuse" | "invalid"> {
    const current = this.tokens.get(input.tokenHash);
    if (current === undefined || current.kind !== "refresh" || current.revokedAt !== null) return "invalid";
    if (current.usedAt !== null) return "reuse";
    this.tokens.set(input.tokenHash, { ...current, usedAt: input.usedAt });
    this.tokens.set(input.access.tokenHash, input.access);
    this.tokens.set(input.refresh.tokenHash, input.refresh);
    return "rotated";
  }

  async revokeToken(tokenHash: string, revokedAt: string): Promise<void> {
    const token = this.tokens.get(tokenHash);
    if (token !== undefined) this.tokens.set(tokenHash, { ...token, revokedAt });
  }

  async revokeFamily(familyId: string, revokedAt: string): Promise<void> {
    for (const [hash, token] of this.tokens) {
      if (token.familyId === familyId) this.tokens.set(hash, { ...token, revokedAt });
    }
  }

  async resolveAccessToken(tokenHash: string, now: string): Promise<OAuthAccessIdentity | null> {
    const token = this.tokens.get(tokenHash);
    if (token === undefined || token.kind !== "access" || token.revokedAt !== null || token.expiresAt <= now) return null;
    const grant = this.grants.get(token.grantId);
    const identity = grant === undefined ? undefined : this.identities.get(grant.userId);
    if (grant === undefined || identity === undefined || grant.revokedAt !== null || grant.resource !== token.audience) return null;
    return { ...identity, clientId: grant.clientId, scopes: grant.scopes };
  }
}
