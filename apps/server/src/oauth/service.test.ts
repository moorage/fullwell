import { createHash } from "node:crypto";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { OAuthProtocolError } from "./errors.js";
import { MemoryOAuthStore } from "./memory-store.js";
import { OAuthService } from "./service.js";

const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000001"),
  actorId: ActorIdSchema.parse("act_0000000000000001"),
  displayName: "Test Owner",
  scopes: new Set(["journal:read", "journal:write"]),
  client: "web",
};

function fixture() {
  const store = new MemoryOAuthStore();
  store.addIdentity({ userId: principal.userId, actorId: principal.actorId, displayName: principal.displayName });
  const service = new OAuthService(
    store,
    new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
    new DeterministicRandomSource(),
    new HmacTokenHasher("oauth-test-pepper-long-enough"),
    new URL("https://journal.example.test/mcp"),
  );
  return { service };
}

async function authorize(service: OAuthService) {
  const client = await service.registerClient({
    client_name: "Codex",
    redirect_uris: ["http://127.0.0.1:1455/callback"],
  });
  const request = await service.validateAuthorizationRequest({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: "http://127.0.0.1:1455/callback",
    scope: "journal:read journal:write",
    state: "state-value-0001",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: "https://journal.example.test/mcp",
  });
  const redirect = await service.approve(request, principal);
  const code = redirect.searchParams.get("code");
  if (code === null) throw new Error("Authorization did not issue a code");
  return { client, code, redirect };
}

describe("OAuthService", () => {
  it("requires an exact registered redirect and preserves state", async () => {
    const { service } = fixture();
    const { redirect } = await authorize(service);
    expect(redirect.origin + redirect.pathname).toBe("http://127.0.0.1:1455/callback");
    expect(redirect.searchParams.get("state")).toBe("state-value-0001");
    await expect(service.validateAuthorizationRequest({
      response_type: "code",
      client_id: "missing",
      redirect_uri: "https://attacker.example/callback",
      scope: "journal:read",
      state: "state-value-0001",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: "https://journal.example.test/mcp",
    })).rejects.toMatchObject({ code: "invalid_client" });
  });

  it("exchanges a code once with PKCE S256 and authenticates the access token", async () => {
    const { service } = fixture();
    const { client, code } = await authorize(service);
    await expect(service.exchangeAuthorizationCode({ code, clientId: client.clientId, redirectUri: client.redirectUris[0] ?? "", codeVerifier: "b".repeat(43) }))
      .rejects.toBeInstanceOf(OAuthProtocolError);

    const second = await authorize(service);
    const tokens = await service.exchangeAuthorizationCode({ code: second.code, clientId: second.client.clientId, redirectUri: second.client.redirectUris[0] ?? "", codeVerifier: verifier });
    expect(tokens.scope).toBe("journal:read journal:write");
    expect((await service.authenticate(tokens.access_token))?.userId).toBe(principal.userId);
    await expect(service.exchangeAuthorizationCode({ code: second.code, clientId: second.client.clientId, redirectUri: second.client.redirectUris[0] ?? "", codeVerifier: verifier }))
      .rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("rotates refresh tokens and revokes the family after reuse", async () => {
    const { service } = fixture();
    const { client, code } = await authorize(service);
    const first = await service.exchangeAuthorizationCode({ code, clientId: client.clientId, redirectUri: client.redirectUris[0] ?? "", codeVerifier: verifier });
    const rotated = await service.exchangeRefreshToken({ refreshToken: first.refresh_token, clientId: client.clientId });
    expect(rotated.refresh_token).not.toBe(first.refresh_token);
    await expect(service.exchangeRefreshToken({ refreshToken: first.refresh_token, clientId: client.clientId }))
      .rejects.toMatchObject({ code: "invalid_grant" });
    expect(await service.authenticate(rotated.access_token)).toBeNull();
  });

  it("rejects unknown permissions and insecure remote redirects", async () => {
    const { service } = fixture();
    await expect(service.registerClient({ client_name: "Bad", redirect_uris: ["http://remote.example/callback"] }))
      .rejects.toMatchObject({ code: "invalid_request" });
    const client = await service.registerClient({ client_name: "Claude", redirect_uris: ["https://claude.example/callback"] });
    await expect(service.validateAuthorizationRequest({
      response_type: "code", client_id: client.clientId, redirect_uri: client.redirectUris[0], scope: "admin", state: "state-value-0002",
      code_challenge: challenge, code_challenge_method: "S256", resource: "https://journal.example.test/mcp",
    })).rejects.toMatchObject({ code: "invalid_scope" });
  });
});
