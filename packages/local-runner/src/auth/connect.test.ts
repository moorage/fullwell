import { describe, expect, it } from "vitest";
import { connectNativeRunner } from "./connect.js";
import type { KeychainPort, RunnerSecretName } from "./keychain.js";

class MemoryKeychain implements KeychainPort {
  readonly values = new Map<RunnerSecretName, string>();
  async read(name: RunnerSecretName) { return this.values.get(name) ?? null; }
  async write(name: RunnerSecretName, value: string) { this.values.set(name, value); }
  async delete(name: RunnerSecretName) { this.values.delete(name); }
}

describe("connectNativeRunner", () => {
  it("performs native PKCE and stores only the client and refresh token", async () => {
    const keychain = new MemoryKeychain();
    let redirectUri = "";
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/oauth/register") {
        if (typeof init?.body !== "string") throw new Error("Expected registration JSON");
        const body = JSON.parse(init.body) as { redirect_uris?: string[] };
        redirectUri = body.redirect_uris?.[0] ?? "";
        return new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 });
      }
      if (url.pathname === "/oauth/token") {
        if (!(init?.body instanceof URLSearchParams)) throw new Error("Expected token form");
        expect(init.body.get("redirect_uri")).toBe(redirectUri);
        expect(init.body.get("code_verifier")).toHaveLength(43);
        return new Response(JSON.stringify({
          access_token: "access-token-one",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "r".repeat(48),
          scope: "journal:read runner:messages",
        }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    };
    const connected = await connectNativeRunner({
      origin: new URL("https://fullwell.example.test"),
      keychain,
      fetcher,
      openBrowser: async (authorization) => {
        const state = authorization.searchParams.get("state");
        const callback = authorization.searchParams.get("redirect_uri");
        if (state === null || callback === null) throw new Error("Missing authorization state");
        expect((await fetch(new URL("/not-the-callback", callback))).status).toBe(404);
        const redirect = new URL(callback);
        redirect.searchParams.set("code", "c".repeat(32));
        redirect.searchParams.set("state", state);
        expect((await fetch(redirect)).status).toBe(200);
      },
      timeoutMilliseconds: 1_000,
    });
    expect(connected).toEqual({ accessToken: "access-token-one", clientId: "native-client-one" });
    expect(keychain.values).toEqual(new Map([
      ["oauth-client-id", "native-client-one"],
      ["oauth-refresh-token", "r".repeat(48)],
    ]));
  });

  it("rejects a callback with the wrong state", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/oauth/register") return new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 });
      throw new Error("Token exchange must not run");
    };
    await expect(connectNativeRunner({
      origin: new URL("https://fullwell.example.test"),
      keychain: new MemoryKeychain(),
      fetcher,
      openBrowser: async (authorization) => {
        const callback = authorization.searchParams.get("redirect_uri");
        if (callback === null) throw new Error("Missing callback");
        const redirect = new URL(callback);
        redirect.searchParams.set("code", "c".repeat(32));
        redirect.searchParams.set("state", "wrong-state");
        expect((await fetch(redirect)).status).toBe(400);
      },
      timeoutMilliseconds: 1_000,
    })).rejects.toThrow(/state did not match/);
  });

  it("rejects registration, callback, token, permission, and timeout failures", async () => {
    const base = {
      origin: new URL("https://fullwell.example.test"),
      keychain: new MemoryKeychain(),
      timeoutMilliseconds: 100,
    };
    await expect(connectNativeRunner({
      ...base,
      fetcher: async () => new Response(null, { status: 503 }),
      openBrowser: async () => undefined,
    })).rejects.toThrow(/registration failed/);

    const registration: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/oauth/register") return new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 });
      if (url.pathname === "/oauth/token") return new Response(null, { status: 502 });
      throw new Error(`Unexpected request: ${url.pathname}`);
    };
    await expect(connectNativeRunner({
      ...base,
      fetcher: registration,
      openBrowser: async (authorization) => {
        const callback = authorization.searchParams.get("redirect_uri");
        const state = authorization.searchParams.get("state");
        if (callback === null || state === null) throw new Error("Missing callback input");
        const redirect = new URL(callback);
        redirect.searchParams.set("code", "c".repeat(32));
        redirect.searchParams.set("state", state);
        await fetch(redirect);
      },
    })).rejects.toThrow(/token exchange failed/);

    await expect(connectNativeRunner({
      ...base,
      fetcher: async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (url.pathname === "/oauth/register") return new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 });
        return new Response(JSON.stringify({
          access_token: "access-token-one", token_type: "Bearer", expires_in: 900,
          refresh_token: "r".repeat(48), scope: "journal:read",
        }), { status: 200 });
      },
      openBrowser: async (authorization) => {
        const callback = authorization.searchParams.get("redirect_uri");
        const state = authorization.searchParams.get("state");
        if (callback === null || state === null) throw new Error("Missing callback input");
        const redirect = new URL(callback);
        redirect.searchParams.set("code", "c".repeat(32));
        redirect.searchParams.set("state", state);
        await fetch(redirect);
      },
    })).rejects.toThrow(/required runner permissions/);

    await expect(connectNativeRunner({
      ...base,
      fetcher: async () => new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 }),
      openBrowser: async (authorization) => {
        const callback = authorization.searchParams.get("redirect_uri");
        const state = authorization.searchParams.get("state");
        if (callback === null || state === null) throw new Error("Missing callback input");
        const redirect = new URL(callback);
        redirect.searchParams.set("state", state);
        await fetch(redirect);
      },
    })).rejects.toThrow(/did not return a code/);

    await expect(connectNativeRunner({
      ...base,
      timeoutMilliseconds: 10,
      fetcher: async () => new Response(JSON.stringify({ client_id: "native-client-one" }), { status: 201 }),
      openBrowser: async () => undefined,
    })).rejects.toThrow(/timed out/);
  });
});
