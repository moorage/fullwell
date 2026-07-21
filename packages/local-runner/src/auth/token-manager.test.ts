import { describe, expect, it, vi } from "vitest";
import type { KeychainPort, RunnerSecretName } from "./keychain.js";
import { OAuthTokenManager } from "./token-manager.js";

class MemoryKeychain implements KeychainPort {
  readonly values = new Map<RunnerSecretName, string>([
    ["oauth-refresh-token", "refresh-one"],
    ["oauth-client-id", "client-one"],
  ]);
  async read(name: RunnerSecretName) { return this.values.get(name) ?? null; }
  async write(name: RunnerSecretName, value: string) { this.values.set(name, value); }
  async delete(name: RunnerSecretName) { this.values.delete(name); }
}

describe("OAuthTokenManager", () => {
  it("rotates refresh tokens, caches access tokens, and refreshes after invalidation", async () => {
    const keychain = new MemoryKeychain();
    let requestCount = 0;
    const fetcher: typeof fetch = vi.fn(async (_input, init): Promise<Response> => {
      requestCount += 1;
      if (!(init?.body instanceof URLSearchParams)) throw new Error("Expected an OAuth form body");
      expect(init.body.get("refresh_token")).toMatch(/^refresh-/);
      return new Response(JSON.stringify({
        access_token: `access-${requestCount}`,
        token_type: "Bearer",
        expires_in: 900,
        refresh_token: `refresh-${requestCount + 1}`,
        scope: "journal:read runner:messages",
      }), { status: 200 });
    });
    const manager = new OAuthTokenManager(new URL("https://fullwell.example.test"), keychain, fetcher, () => 1_000);
    expect(await manager.accessToken()).toBe("access-1");
    expect(await manager.accessToken()).toBe("access-1");
    expect(requestCount).toBe(1);
    manager.invalidate();
    expect(await manager.accessToken()).toBe("access-2");
    expect(keychain.values.get("oauth-refresh-token")).toBe("refresh-3");
  });

  it("fails when disconnected or when refresh is rejected", async () => {
    const empty = new MemoryKeychain();
    empty.values.clear();
    await expect(new OAuthTokenManager(new URL("https://fullwell.example.test"), empty).accessToken()).rejects.toThrow(/not connected/);
    const unavailable = new OAuthTokenManager(new URL("https://fullwell.example.test"), new MemoryKeychain(), async () => new Response(null, { status: 401 }));
    await expect(unavailable.accessToken()).rejects.toThrow(/status 401/);
  });
});
