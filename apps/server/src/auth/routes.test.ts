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

class CapturingMail implements MailPort {
  url: URL | null = null;
  async sendMagicLink(_recipient: string, url: URL): Promise<void> { this.url = url; }
  async sendInvitation(): Promise<void> {}
}

async function fixture() {
  const mail = new CapturingMail();
  const auth = new BrowserAuthService(
    new MemoryAuthStore(), new FixedClock(new Date("2026-07-15T12:00:00.000Z")), new DeterministicRandomSource(),
    new HmacTokenHasher("route-auth-pepper-long-enough"), mail, new UnconfiguredAppleIdentityProvider(),
    new UnsupportedPasskeyProvider(), new URL("https://journal.example.test"),
  );
  const app = Fastify();
  await app.register(cookie);
  await registerBrowserAuthRoutes(app, { auth, secureCookies: true });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) return reply.code(error.code === "PROVIDER_UNAVAILABLE" ? 503 : 400).send({ error: { code: error.code } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "VALIDATION_FAILED" } });
    return reply.code(500).send();
  });
  return { app, mail };
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
    await app.close();
  });
});
