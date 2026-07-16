import { describe, expect, it } from "vitest";
import { UserIdSchema } from "@hfj/contracts";
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
import type { PasskeyCredential, PasskeyProvider } from "./types.js";

class CapturingMail implements MailPort {
  magicLink: URL | null = null;
  async sendMagicLink(_recipient: string, url: URL): Promise<void> { this.magicLink = url; }
  async sendInvitation(): Promise<void> {}
}

class DeterministicPasskeyProvider implements PasskeyProvider {
  async beginRegistration() {
    return { challenge: "registration-challenge", publicOptions: { challenge: "registration-challenge" } };
  }
  async completeRegistration() {
    return {
      credentialId: "credential_01",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports: ["internal" as const],
      deviceType: "multiDevice" as const,
      backedUp: true,
    };
  }
  async beginAuthentication() {
    return { challenge: "authentication-challenge", publicOptions: { challenge: "authentication-challenge" } };
  }
  authenticationCredentialId(response: unknown): string {
    if (typeof response !== "object" || response === null || !("id" in response) || typeof response.id !== "string") {
      throw new Error("Missing credential ID");
    }
    return response.id;
  }
  async completeAuthentication(_response: unknown, _expectedChallenge: string, credential: PasskeyCredential) {
    return { newCounter: credential.counter === 0 ? 0 : credential.counter + 1 };
  }
}

function fixture(passkeys: PasskeyProvider = new UnsupportedPasskeyProvider()) {
  const mail = new CapturingMail();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const store = new MemoryAuthStore();
  const auth = new BrowserAuthService(
    store, clock, new DeterministicRandomSource(), new HmacTokenHasher("auth-test-pepper-long-enough"),
    mail, new UnconfiguredAppleIdentityProvider(), passkeys, new URL("https://journal.example.test"),
  );
  return { auth, mail, clock, store };
}

async function magicLinkSession(auth: BrowserAuthService, mail: CapturingMail) {
  await auth.requestMagicLink("member@example.test");
  return auth.completeMagicLink(
    mail.magicLink?.searchParams.get("token") ?? "",
    mail.magicLink?.searchParams.get("transaction") ?? "",
  );
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
    await expect(auth.beginPasskeyAuthentication()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("enrolls, authenticates, lists, and removes a session-bound discoverable passkey", async () => {
    const { auth, mail } = fixture(new DeterministicPasskeyProvider());
    const initialSession = await magicLinkSession(auth, mail);
    const principal = await auth.authenticateSession(initialSession.sessionToken);
    const registration = await auth.beginPasskeyRegistration(principal.userId, initialSession.sessionToken);
    expect(registration.publicOptions).toEqual({ challenge: "registration-challenge" });
    await expect(auth.completePasskeyRegistration({
      userId: principal.userId,
      rawSessionToken: "different-session-token",
      transaction: registration.transaction,
      response: { id: "credential_01" },
    })).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(auth.completePasskeyRegistration({
      userId: UserIdSchema.parse("usr_0000000000000999"),
      rawSessionToken: initialSession.sessionToken,
      transaction: registration.transaction,
      response: { id: "credential_01" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const retry = await auth.beginPasskeyRegistration(principal.userId, initialSession.sessionToken);
    const credential = await auth.completePasskeyRegistration({
      userId: principal.userId,
      rawSessionToken: initialSession.sessionToken,
      transaction: retry.transaction,
      response: { id: "credential_01" },
    });
    expect(credential).toMatchObject({ credentialId: "credential_01", backedUp: true, deviceType: "multiDevice" });
    expect(await auth.listPasskeys(principal.userId)).toHaveLength(1);
    const duplicate = await auth.beginPasskeyRegistration(principal.userId, initialSession.sessionToken);
    await expect(auth.completePasskeyRegistration({
      userId: principal.userId,
      rawSessionToken: initialSession.sessionToken,
      transaction: duplicate.transaction,
      response: { id: "credential_01" },
    })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const authentication = await auth.beginPasskeyAuthentication("/account");
    const signedIn = await auth.completePasskeyAuthentication({
      transaction: authentication.transaction,
      browserBinding: authentication.browserBinding,
      response: { id: "credential_01" },
    });
    expect(signedIn.pendingIntent).toBe("/account");
    expect((await auth.authenticateSession(signedIn.sessionToken)).userId).toBe(principal.userId);
    await expect(auth.completePasskeyAuthentication({
      transaction: authentication.transaction,
      browserBinding: authentication.browserBinding,
      response: { id: "credential_01" },
    })).rejects.toMatchObject({ code: "AUTH_REQUIRED" });

    await auth.removePasskey(principal.userId, "credential_01");
    expect(await auth.listPasskeys(principal.userId)).toEqual([]);
    await expect(auth.removePasskey(principal.userId, "credential_01")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
