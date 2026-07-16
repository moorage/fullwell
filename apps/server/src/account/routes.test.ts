import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, UnconfiguredAppleIdentityProvider } from "../adapters/providers.js";
import { MemoryAuthStore } from "../auth/memory-store.js";
import { UnsupportedPasskeyProvider } from "../auth/providers.js";
import { BrowserAuthService } from "../auth/service.js";
import type { MailPort } from "../core/ports.js";
import { AppError } from "../core/errors.js";
import { MemoryOAuthStore } from "../oauth/memory-store.js";
import { AccountService } from "./service.js";
import { registerAccountRoutes } from "./routes.js";

class CapturingMail implements MailPort {
  magicLink: URL | null = null;
  async sendMagicLink(_recipient: string, url: URL): Promise<void> { this.magicLink = url; }
  async sendInvitation(): Promise<void> {}
}

async function fixture() {
  const authStore = new MemoryAuthStore();
  const operational = new MemoryOperationalStore();
  const oauth = new MemoryOAuthStore();
  const mail = new CapturingMail();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const auth = new BrowserAuthService(
    authStore,
    clock,
    new DeterministicRandomSource(),
    new HmacTokenHasher("account-route-test-pepper"),
    mail,
    new UnconfiguredAppleIdentityProvider(),
    new UnsupportedPasskeyProvider(),
    new URL("https://journal.example.test"),
  );
  await auth.requestMagicLink("member@example.test");
  const session = await auth.completeMagicLink(
    mail.magicLink?.searchParams.get("token") ?? "",
    mail.magicLink?.searchParams.get("transaction") ?? "",
  );
  const userId = (await auth.authenticateSession(session.sessionToken)).userId;
  const app = Fastify();
  await app.register(cookie);
  await app.register(formbody);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) return reply.code(error.code === "AUTH_REQUIRED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400).send({ error: error.code });
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
  await registerAccountRoutes(app, {
    auth,
    accounts: new AccountService(authStore, operational, oauth, clock, new MemoryHouseholdRepository(), new DeterministicRandomSource()),
  });
  return { app, authStore, clock, oauth, session, userId };
}

describe("account routes", () => {
  it("requires session CSRF and recent authentication for account mutations", async () => {
    const { app, authStore, clock, oauth, session, userId } = await fixture();
    await oauth.registerClient({ clientId: "codex", name: "Codex", redirectUris: ["https://example.test/callback"], tokenEndpointAuthMethod: "none" });
    await oauth.saveGrant({ id: "grant-route", userId, clientId: "codex", scopes: ["journal:read"], resource: "https://journal.example.test/mcp", revokedAt: null });
    const cookieHeader = `hfj_session=${session.sessionToken}`;

    const rejected = await app.inject({ method: "POST", url: "/account/profile", headers: { cookie: cookieHeader }, payload: { csrf: "x".repeat(32), display_name: "Updated Member" } });
    expect(rejected.statusCode).toBe(403);
    const renamed = await app.inject({ method: "POST", url: "/account/profile", headers: { cookie: cookieHeader }, payload: { csrf: session.csrfToken, display_name: "Updated Member" } });
    expect(renamed.statusCode).toBe(303);
    expect((await authStore.getUserById(userId))?.displayName).toBe("Updated Member");

    const revoked = await app.inject({ method: "POST", url: "/account/grants/grant-route/revoke", headers: { cookie: cookieHeader }, payload: { csrf: session.csrfToken } });
    expect(revoked.statusCode).toBe(303);
    expect(await oauth.listActiveGrants(userId)).toEqual([]);

    clock.advance(16 * 60_000);
    const stale = await app.inject({ method: "POST", url: "/account/delete", headers: { cookie: cookieHeader }, payload: { csrf: session.csrfToken, confirmation: "DELETE" } });
    expect(stale.statusCode).toBe(401);
    await app.close();
  });

  it("deletes an eligible account and clears browser credentials", async () => {
    const { app, authStore, session, userId } = await fixture();
    const response = await app.inject({
      method: "POST",
      url: "/account/delete",
      headers: { cookie: `hfj_session=${session.sessionToken}` },
      payload: { csrf: session.csrfToken, confirmation: "DELETE" },
    });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/install");
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("hfj_session=;"), expect.stringContaining("hfj_csrf=;")]));
    expect(await authStore.getUserById(userId)).toBeNull();
    await app.close();
  });

  it("requires exact destructive confirmations and routes identity removal", async () => {
    const { app, authStore, session, userId } = await fixture();
    const cookie = `hfj_session=${session.sessionToken}`;
    await authStore.linkIdentityMethod(userId, "apple", "route-apple");
    const removed = await app.inject({
      method: "POST", url: "/account/sign-in-methods/apple/remove", headers: { cookie }, payload: { csrf: session.csrfToken },
    });
    expect(removed.statusCode).toBe(303);
    expect(await authStore.listIdentityMethods(userId)).toEqual(["magic_link"]);
    const leave = await app.inject({
      method: "POST", url: "/account/households/hsh_0000000000000999/leave", headers: { cookie },
      payload: { csrf: session.csrfToken, confirmation: "leave" },
    });
    expect(leave.statusCode).toBe(400);
    const deletion = await app.inject({
      method: "POST", url: "/account/delete", headers: { cookie }, payload: { csrf: session.csrfToken, confirmation: "delete" },
    });
    expect(deletion.statusCode).toBe(400);
    const missingSession = await app.inject({
      method: "POST", url: "/account/profile", payload: { csrf: session.csrfToken, display_name: "No session" },
    });
    expect(missingSession.statusCode).toBe(401);
    await app.close();
  });
});
