import { z } from "zod";
import type { KeychainPort } from "./keychain.js";

const TokenResponseSchema = z.object({
  access_token: z.string().min(1).max(4_096),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive().max(86_400),
  refresh_token: z.string().min(1).max(4_096),
  scope: z.string(),
}).passthrough();

export interface AccessTokenPort {
  accessToken(): Promise<string>;
  invalidate(): void;
}

export class OAuthTokenManager implements AccessTokenPort {
  private cached: { readonly value: string; readonly expiresAt: number } | null = null;

  constructor(
    private readonly origin: URL,
    private readonly keychain: KeychainPort,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async accessToken(): Promise<string> {
    if (this.cached !== null && this.cached.expiresAt - 30_000 > this.now()) return this.cached.value;
    const [refreshToken, clientId] = await Promise.all([
      this.keychain.read("oauth-refresh-token"),
      this.keychain.read("oauth-client-id"),
    ]);
    if (refreshToken === null || clientId === null) throw new Error("The local runner is not connected to Fullwell");
    const response = await this.fetcher(new URL("/oauth/token", this.origin), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Fullwell OAuth refresh failed with status ${response.status}`);
    const parsed = TokenResponseSchema.parse(await response.json());
    await this.keychain.write("oauth-refresh-token", parsed.refresh_token);
    this.cached = { value: parsed.access_token, expiresAt: this.now() + parsed.expires_in * 1_000 };
    return parsed.access_token;
  }

  invalidate(): void {
    this.cached = null;
  }
}
