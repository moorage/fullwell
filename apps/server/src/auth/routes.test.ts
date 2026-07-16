import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { AppError } from "../core/errors.js";
import {
  DeterministicRandomSource,
  FixedClock,
  HmacTokenHasher,
  UnconfiguredAppleIdentityProvider,
} from "../adapters/providers.js";
import type { MailPort } from "../core/ports.js";
import { MemoryAuthStore } from "./memory-store.js";
import { UnsupportedPasskeyProvider } from "./providers.js";
import { registerBrowserAuthRoutes } from "./routes.js";
import { BrowserAuthService } from "./service.js";
import type { PasskeyCredential, PasskeyProvider } from "./types.js";

class CapturingMail implements MailPort {
  url: URL | null = null;
  async sendMagicLink(_recipient: string, url: URL): Promise<void> { this.url = url; }
  async sendInvitation(): Promise<void> {}
}

class DeterministicPasskeyProvider implements PasskeyProvider {
  async beginRegistration() { return { challenge: "registration-challenge", publicOptions: { challenge: "registration-challenge" } }; }
  async completeRegistration() {
    return {
      credentialId: "credential_31", publicKey: new Uint8Array([1, 2, 3]), counter: 0,
      transports: ["internal" as const], deviceType: "multiDevice" as const, backedUp: true,
    };
  }
  async beginAuthentication() { return { challenge: "authentication-challenge", publicOptions: { challenge: "authentication-challenge" } }; }
  authenticationCredentialId(response: unknown): string {
    if (typeof response !== "object" || response === null || !("id" in response) || typeof response.id !== "string") throw new Error("Missing credential ID");
    return response.id;
  }
  async completeAuthentication(_response: unknown, _expectedChallenge: string, credential: PasskeyCredential) {
    return { newCounter: credential.counter };
  }
}

async function fixture(
  appleAuthorization?: { readonly clientId: string; readonly redirectUri: string },
  passkeys: PasskeyProvider = new UnsupportedPasskeyProvider(),
) {
  const mail = new CapturingMail();
  const auth = new BrowserAuthService(
    new MemoryAuthStore(), new FixedClock(new Date("2026-07-15T12:00:00.000Z")), new DeterministicRandomSource(),
    new HmacTokenHasher("route-auth-pepper-long-enough"), mail, new UnconfiguredAppleIdentityProvider(),
    passkeys, new URL("https://journal.example.test"),
  );
  const app = Fastify();
  await app.register(cookie);
  await registerBrowserAuthRoutes(app, { auth, secureCookies: true, ...(appleAuthorization === undefined ? {} : { appleAuthorization }) });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) return reply.code(error.code === "PROVIDER_UNAVAILABLE" ? 503 : 400).send({ error: { code: error.code } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "VALIDATION_FAILED" } });
    return reply.code(500).send();
  });
  return { app, auth, mail };
}

async function authenticatedCookies(app: ReturnType<typeof Fastify>, mail: CapturingMail) {
  await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "passkey@example.test" } });
  if (mail.url === null) throw new Error("Magic link was not sent");
  const completed = await app.inject({ method: "GET", url: `${mail.url.pathname}${mail.url.search}` });
  const setCookies = z.array(z.string()).parse(completed.headers["set-cookie"]);
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = /hfj_csrf=([^;]+)/.exec(cookie)?.[1];
  if (csrf === undefined) throw new Error("CSRF cookie was not set");
  return { cookie, csrf };
}

describe("browser auth routes", () => {
  it("sets HttpOnly session and readable CSRF cookies after magic-link completion", async () => {
    const { app, mail } = await fixture();
    const request = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "member@example.test", pending_intent: "/households" } });
    expect(request.statusCode).toBe(202);
    const link = mail.url;
    if (link === null) throw new Error("Magic link was not sent");
    const completed = await app.inject({ method: "GET", url: `${link.pathname}${link.search}` });
    expect(completed.statusCode).toBe(302);
    const cookies = completed.headers["set-cookie"];
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining("hfj_session="),
      expect.stringContaining("hfj_csrf="),
    ]));
    expect((cookies as string[]).find((value) => value.startsWith("hfj_session="))).toContain("HttpOnly");
    expect((cookies as string[]).find((value) => value.startsWith("hfj_csrf="))).not.toContain("HttpOnly");
    await app.close();
  });

  it("starts Apple with a server-generated state and browser-binding cookie", async () => {
    const { app } = await fixture();
    const response = await app.inject({ method: "POST", url: "/auth/apple/start", payload: { pending_intent: "/invite/family/example" } });
    expect(response.statusCode).toBe(202);
    expect(response.json().state).toHaveLength(43);
    expect(response.headers["set-cookie"]).toContain("hfj_auth_binding=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    await app.close();
  });

  it("exposes the UI passkey start route and fails explicitly without a provider", async () => {
    const { app } = await fixture();
    const response = await app.inject({ method: "POST", url: "/auth/passkey/start", payload: {} });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("PROVIDER_UNAVAILABLE");
    const options = await app.inject({ method: "POST", url: "/auth/passkey/options", payload: {} });
    expect(options.statusCode).toBe(503);
    await app.close();
  });

  it("enrolls, signs in, and revokes a passkey through browser-bound routes", async () => {
    const { app, mail } = await fixture(undefined, new DeterministicPasskeyProvider());
    const authenticated = await authenticatedCookies(app, mail);
    const registration = await app.inject({
      method: "POST",
      url: "/auth/passkey/registration/options",
      headers: { cookie: authenticated.cookie },
      payload: { csrf: authenticated.csrf },
    });
    expect(registration.statusCode).toBe(200);
    expect(registration.json().publicOptions).toEqual({ challenge: "registration-challenge" });
    const enrolled = await app.inject({
      method: "POST",
      url: "/auth/passkey/registration/complete",
      headers: { cookie: authenticated.cookie },
      payload: { csrf: authenticated.csrf, transaction: registration.json().transaction, response: { id: "credential_31" } },
    });
    expect(enrolled.statusCode).toBe(200);
    expect(enrolled.json()).toMatchObject({ id: "credential_31", name: "Passkey" });

    const started = await app.inject({ method: "POST", url: "/auth/passkey/start", payload: { pending_intent: "/account" } });
    expect(started.statusCode).toBe(200);
    const bindingCookie = started.headers["set-cookie"];
    if (typeof bindingCookie !== "string") throw new Error("Passkey binding cookie was not set");
    expect(bindingCookie).toContain("HttpOnly");
    expect(bindingCookie).toContain("SameSite=Strict");
    const signedIn = await app.inject({
      method: "POST",
      url: "/auth/passkey/authentication/complete",
      headers: { cookie: bindingCookie.split(";", 1)[0] ?? "" },
      payload: { transaction: started.json().transaction, response: { id: "credential_31" } },
    });
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json()).toMatchObject({ authenticated: true, redirect_to: "/account" });
    expect(signedIn.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("hfj_session="), expect.stringContaining("hfj_csrf=")]));

    const removed = await app.inject({
      method: "POST",
      url: "/auth/passkeys/credential_31/remove",
      headers: { cookie: authenticated.cookie, accept: "text/html" },
      payload: { csrf: authenticated.csrf },
    });
    expect(removed.statusCode).toBe(303);
    expect(removed.headers.location).toBe("/account");
    const missing = await app.inject({
      method: "POST",
      url: "/auth/passkeys/credential_31/remove",
      headers: { cookie: authenticated.cookie },
      payload: { csrf: authenticated.csrf },
    });
    expect(missing.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });

  it("redirects HTML magic-link requests and signs out with cookie-bound CSRF", async () => {
    const { app, mail } = await fixture();
    const request = await app.inject({
      method: "POST",
      url: "/auth/magic-link",
      headers: { accept: "text/html" },
      payload: { email: "member@example.test" },
    });
    expect(request.statusCode).toBe(303);
    expect(request.headers.location).toBe("/sign-in?emailSent=1");
    const link = mail.url;
    if (link === null) throw new Error("Magic link was not sent");
    const completed = await app.inject({ method: "GET", url: `${link.pathname}${link.search}` });
    expect(completed.headers.location).toBe("/households");
    const setCookies = completed.headers["set-cookie"];
    if (!Array.isArray(setCookies)) throw new Error("session cookies were not set");
    const cookieHeader = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
    const csrf = /hfj_csrf=([^;]+)/.exec(cookieHeader)?.[1];
    if (csrf === undefined) throw new Error("CSRF cookie was not set");
    const signedOut = await app.inject({
      method: "POST",
      url: "/auth/sign-out",
      headers: { accept: "text/html", cookie: cookieHeader },
      payload: { csrf_token: csrf },
    });
    expect(signedOut.statusCode).toBe(303);
    expect(signedOut.headers.location).toBe("/install");
    expect(signedOut.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("hfj_session=;"), expect.stringContaining("hfj_csrf=;")]));
    const missingSession = await app.inject({ method: "POST", url: "/auth/sign-out", payload: { csrf: "c".repeat(32) } });
    expect(missingSession.json().error.code).toBe("AUTH_REQUIRED");

    await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "member@example.test" } });
    const secondLink = mail.url;
    if (secondLink === null) throw new Error("Second magic link was not sent");
    const secondCompleted = await app.inject({ method: "GET", url: `${secondLink.pathname}${secondLink.search}` });
    const secondCookies = secondCompleted.headers["set-cookie"];
    if (!Array.isArray(secondCookies)) throw new Error("Second session cookies were not set");
    const secondCookieHeader = secondCookies.map((value) => value.split(";", 1)[0]).join("; ");
    const secondCsrf = /hfj_csrf=([^;]+)/.exec(secondCookieHeader)?.[1];
    if (secondCsrf === undefined) throw new Error("Second CSRF cookie was not set");
    const passkey = await app.inject({ method: "POST", url: "/auth/passkey/start", headers: { cookie: secondCookieHeader }, payload: {} });
    expect(passkey.statusCode).toBe(503);
    const jsonSignOut = await app.inject({ method: "POST", url: "/auth/sign-out", headers: { cookie: secondCookieHeader }, payload: { csrf: secondCsrf } });
    expect(jsonSignOut.statusCode).toBe(204);
    await app.close();
  });

  it("builds the configured Apple authorization redirect and rejects invalid callbacks", async () => {
    const { app } = await fixture({ clientId: "com.example.fullwell", redirectUri: "https://journal.example.test/auth/apple/callback" });
    const started = await app.inject({ method: "POST", url: "/auth/apple/start", payload: {} });
    expect(started.statusCode).toBe(302);
    const authorization = new URL(started.headers.location ?? "https://invalid.test");
    expect(authorization.origin).toBe("https://appleid.apple.com");
    expect(authorization.searchParams.get("client_id")).toBe("com.example.fullwell");

    const issuedState = authorization.searchParams.get("state");
    const bindingCookies = started.headers["set-cookie"];
    const bindingHeader = Array.isArray(bindingCookies) ? bindingCookies.join("; ") : bindingCookies ?? "";
    const binding = /hfj_auth_binding=([^;]+)/.exec(bindingHeader)?.[1];
    if (issuedState === null || binding === undefined) throw new Error("Apple start state or binding missing");
    const missingBinding = await app.inject({ method: "POST", url: "/auth/apple/callback", payload: { code: "code", state: issuedState } });
    expect(missingBinding.json().error.code).toBe("AUTH_REQUIRED");
    const explicitBinding = await app.inject({
      method: "POST",
      url: "/auth/apple/callback",
      payload: { code: "code", state: issuedState, browser_binding: binding, redirect_uri: "https://journal.example.test/auth/apple/callback" },
    });
    expect(explicitBinding.json().error.code).toBe("PROVIDER_UNAVAILABLE");

    const cookieStarted = await app.inject({ method: "POST", url: "/auth/apple/start", payload: {} });
    const cookieAuthorization = new URL(cookieStarted.headers.location ?? "https://invalid.test");
    const cookieState = cookieAuthorization.searchParams.get("state");
    const cookieSetHeader = cookieStarted.headers["set-cookie"];
    const cookieHeader = Array.isArray(cookieSetHeader) ? cookieSetHeader.map((value) => value.split(";", 1)[0]).join("; ") : cookieSetHeader?.split(";", 1)[0];
    if (cookieState === null || cookieHeader === undefined) throw new Error("Cookie callback fixture missing");
    const cookieCallback = await app.inject({
      method: "POST",
      url: "/auth/apple/callback",
      headers: { cookie: cookieHeader },
      payload: { code: "code", state: cookieState },
    });
    expect(cookieCallback.json().error.code).toBe("PROVIDER_UNAVAILABLE");
    await app.close();
  });
});
