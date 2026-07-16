import { describe, expect, it } from "vitest";
import {
  DeterministicRandomSource,
  FixedClock,
  HmacTokenHasher,
  UnconfiguredAppleIdentityProvider,
} from "../adapters/providers.js";
import type { MailPort } from "../core/ports.js";
import { MemoryAuthStore } from "./memory-store.js";
import { UnsupportedPasskeyProvider } from "./providers.js";
import { BrowserAuthService } from "./service.js";

class CapturingMail implements MailPort {
  magicLink: URL | null = null;
  async sendMagicLink(_recipient: string, url: URL): Promise<void> { this.magicLink = url; }
  async sendInvitation(): Promise<void> {}
}

function fixture() {
  const mail = new CapturingMail();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const auth = new BrowserAuthService(
    new MemoryAuthStore(), clock, new DeterministicRandomSource(), new HmacTokenHasher("auth-test-pepper-long-enough"),
    mail, new UnconfiguredAppleIdentityProvider(), new UnsupportedPasskeyProvider(), new URL("https://journal.example.test"),
  );
  return { auth, mail, clock };
}

describe("BrowserAuthService", () => {
  it("issues one-time magic links bound to the browser transaction", async () => {
    const { auth, mail } = fixture();
    await auth.requestMagicLink("MEMBER@example.test", "/invite/family/example");
    const token = mail.magicLink?.searchParams.get("token");
    const transaction = mail.magicLink?.searchParams.get("transaction");
    if (token === undefined || token === null || transaction === undefined || transaction === null) throw new Error("Missing magic-link values");
    await expect(auth.completeMagicLink(token, "wrong-transaction-value-that-is-long"))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    const session = await auth.completeMagicLink(token, transaction);
    expect(session.pendingIntent).toBe("/invite/family/example");
    expect((await auth.authenticateSession(session.sessionToken)).client).toBe("web");
    await expect(auth.completeMagicLink(token, transaction)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("expires challenges and rejects open redirect intents", async () => {
    const { auth, mail, clock } = fixture();
    await expect(auth.requestMagicLink("member@example.test", "https://attacker.example"))
      .rejects.toThrow(/local paths/);
    await auth.requestMagicLink("member@example.test");
    clock.advance(16 * 60_000);
    const token = mail.magicLink?.searchParams.get("token") ?? "";
    const transaction = mail.magicLink?.searchParams.get("transaction") ?? "";
    await expect(auth.completeMagicLink(token, transaction)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("enforces CSRF and revokes the session at sign-out", async () => {
    const { auth, mail } = fixture();
    await auth.requestMagicLink("member@example.test");
    const session = await auth.completeMagicLink(mail.magicLink?.searchParams.get("token") ?? "", mail.magicLink?.searchParams.get("transaction") ?? "");
    await expect(auth.verifyCsrf(session.sessionToken, "wrong-csrf-token-that-is-long-enough"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await auth.verifyCsrf(session.sessionToken, session.csrfToken);
    await auth.signOut(session.sessionToken);
    await expect(auth.authenticateSession(session.sessionToken)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("fails explicitly when passkeys are not configured", async () => {
    const { auth } = fixture();
    await expect(auth.beginPasskey(null)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
