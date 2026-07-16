import { createHash } from "node:crypto";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { OAuthBearerAuthenticator } from "./authenticator.js";
import { MemoryOAuthStore } from "./memory-store.js";
import { OAuthService } from "./service.js";

const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000601"),
  actorId: ActorIdSchema.parse("act_0000000000000601"),
  displayName: "OAuth User",
  scopes: new Set(["journal:read"]),
  client: "web",
};

describe("OAuthBearerAuthenticator", () => {
  it("authenticates a valid access token and assigns the registered client kind", async () => {
    const store = new MemoryOAuthStore();
    store.addIdentity({ userId: principal.userId, actorId: principal.actorId, displayName: principal.displayName });
    const service = new OAuthService(store, new FixedClock(new Date("2026-07-15T12:00:00.000Z")), new DeterministicRandomSource(), new HmacTokenHasher("authenticator-test-pepper"), new URL("https://journal.example.test/mcp"));
    const client = await service.registerClient({ client_name: "Codex", redirect_uris: ["http://127.0.0.1:1455/callback"] });
    const request = await service.validateAuthorizationRequest({
      response_type: "code", client_id: client.clientId, redirect_uri: client.redirectUris[0], scope: "journal:read",
      state: "state-value-0000601", code_challenge: challenge, code_challenge_method: "S256", resource: "https://journal.example.test/mcp",
    });
    const redirect = await service.approve(request, principal);
    const code = redirect.searchParams.get("code");
    if (code === null) throw new Error("authorization code missing");
    const tokens = await service.exchangeAuthorizationCode({ code, clientId: client.clientId, redirectUri: client.redirectUris[0] ?? "", codeVerifier: verifier });
    const authenticator = new OAuthBearerAuthenticator(service, async () => "codex");
    await expect(authenticator.authenticate(`Bearer ${tokens.access_token}`)).resolves.toMatchObject({ displayName: "OAuth User", client: "codex" });
    await expect(authenticator.authenticate(undefined)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(authenticator.authenticate("Bearer invalid")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
