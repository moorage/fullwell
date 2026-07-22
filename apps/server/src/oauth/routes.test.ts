import { createHash } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { MemoryOAuthStore } from "./memory-store.js";
import { registerOAuthRoutes } from "./routes.js";
import { OAuthService } from "./service.js";

const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000001"), actorId: ActorIdSchema.parse("act_0000000000000001"),
  displayName: "Test Owner", scopes: new Set(["journal:read"]), client: "web",
};

describe("OAuth routes", () => {
  it("registers a public client and completes the form-encoded authorization flow", async () => {
    const store = new MemoryOAuthStore();
    store.addIdentity({ userId: principal.userId, actorId: principal.actorId, displayName: principal.displayName });
    const oauth = new OAuthService(store, new FixedClock(new Date("2026-07-15T12:00:00.000Z")), new DeterministicRandomSource(), new HmacTokenHasher("route-test-pepper-long-enough"), new URL("https://journal.example.test/mcp"));
    const app = Fastify();
    await registerOAuthRoutes(app, { oauth, resolveBrowserPrincipal: async () => principal, verifyCsrf: async (_request, token) => { expect(token).toBe("c".repeat(32)); } });

    const registration = await app.inject({
      method: "POST",
      url: "/oauth/register",
      payload: {
        client_name: "Codex",
        redirect_uris: ["http://127.0.0.1:1455/callback"],
        application_type: "native",
        scope: "journal:read journal:write",
        client_uri: "https://openai.com/codex",
        contacts: ["security@example.test"],
        software_id: "codex-cli",
        software_version: "0.144.4",
      },
    });
    expect(registration.statusCode).toBe(201);
    expect(registration.headers["cache-control"]).toBe("no-store");
    const clientId = registration.json().client_id as string;
    const verifier = "v".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorization = new URLSearchParams({
      response_type: "code", client_id: clientId, redirect_uri: "http://127.0.0.1:1455/callback",
      scope: "journal:read", state: "state-value-0001", code_challenge: challenge,
      code_challenge_method: "S256", resource: "https://journal.example.test/mcp",
    });
    const consent = await app.inject({ method: "GET", url: `/oauth/authorize?${authorization}` });
    expect(consent.statusCode).toBe(302);
    const consentUrl = new URL(consent.headers.location ?? "", "https://journal.example.test");
    expect(consentUrl.pathname).toBe("/authorize");
    expect(consentUrl.searchParams.get("client_name")).toBe("Codex");
    expect(consentUrl.searchParams.get("client_id")).toBe(clientId);
    const tamperedApproval = await app.inject({
      method: "POST", url: "/oauth/authorize", headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ ...Object.fromEntries(authorization), client_name: "Trusted Agent", approve: "true", csrf_token: "c".repeat(32) }).toString(),
    });
    expect(tamperedApproval.statusCode).toBe(400);
    expect(await store.listActiveGrants(principal.userId)).toEqual([]);
    const approval = await app.inject({
      method: "POST", url: "/oauth/authorize", headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ ...Object.fromEntries(authorization), client_name: "Codex", approve: "true", csrf_token: "c".repeat(32) }).toString(),
    });
    expect(approval.statusCode).toBe(303);
    const code = new URL(approval.headers.location ?? "", "http://localhost").searchParams.get("code") ?? "";
    const token = await app.inject({
      method: "POST", url: "/oauth/token", headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: "http://127.0.0.1:1455/callback", code_verifier: verifier, resource: "https://journal.example.test/mcp" }).toString(),
    });
    expect(token.statusCode).toBe(200);
    expect(token.headers["cache-control"]).toBe("no-store");
    expect(token.json().token_type).toBe("Bearer");
    const refreshed = await app.inject({
      method: "POST", url: "/oauth/token", headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.json().refresh_token as string,
        client_id: clientId,
        scope: token.json().scope as string,
      }).toString(),
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refresh_token).not.toBe(token.json().refresh_token);
    await app.close();
  });

  it("uses protocol errors without disclosing validation detail", async () => {
    const oauth = new OAuthService(new MemoryOAuthStore(), new FixedClock(new Date("2026-07-15T12:00:00.000Z")), new DeterministicRandomSource(), new HmacTokenHasher("route-test-pepper-long-enough"), new URL("https://journal.example.test/mcp"));
    const app = Fastify();
    await registerOAuthRoutes(app, { oauth, resolveBrowserPrincipal: async () => principal, verifyCsrf: async () => undefined });
    const response = await app.inject({ method: "POST", url: "/oauth/token", payload: { grant_type: "password" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_request", error_description: "The request is invalid" });
    await app.close();
  });
});
