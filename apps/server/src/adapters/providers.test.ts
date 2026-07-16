import { exportPKCS8, generateKeyPair, SignJWT } from "jose";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { MemoryOperationalStore } from "./memory.js";
import {
  AppleIdentityProvider,
  BearerSessionAuthenticator,
  ConsoleTelemetry,
  CryptoRandomSource,
  DeterministicRandomSource,
  DeterministicTestAuthenticator,
  FixedClock,
  HmacTokenHasher,
  NoopTelemetry,
  ResendMailProvider,
  SystemClock,
  UnconfiguredAppleIdentityProvider,
  UnconfiguredBackupProvider,
  UnconfiguredMailProvider,
} from "./providers.js";

describe("production identity and mail providers", () => {
  it("exchanges an Apple code and verifies issuer, audience, signature, and nonce", async () => {
    const appleSigning = await generateKeyPair("ES256", { extractable: true });
    const appSigning = await generateKeyPair("ES256", { extractable: true });
    const appPrivateKey = await exportPKCS8(appSigning.privateKey);
    const idToken = await new SignJWT({ nonce: "expected-nonce", email: "person@privaterelay.appleid.com" })
      .setProtectedHeader({ alg: "ES256", kid: "apple-test-key" })
      .setIssuer("https://appleid.apple.com")
      .setAudience("com.example.fullwell")
      .setSubject("apple-subject")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(appleSigning.privateKey);
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.body).toBeInstanceOf(URLSearchParams);
      expect((init?.body as URLSearchParams).get("grant_type")).toBe("authorization_code");
      return new Response(JSON.stringify({ id_token: idToken }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const provider = new AppleIdentityProvider("com.example.fullwell", "TEAMID", "KEYID", appPrivateKey, fetcher, async () => appleSigning.publicKey);

    await expect(provider.exchangeAppleCode("one-time-code", "https://journal.example.com/auth/apple/callback", "expected-nonce"))
      .resolves.toEqual({ subject: "apple-subject", email: "person@privaterelay.appleid.com", name: null });
    await expect(provider.exchangeAppleCode("one-time-code", "https://journal.example.com/auth/apple/callback", "wrong-nonce"))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("sends transactional mail without putting provider errors into a success shape", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.headers).toMatchObject({ authorization: "Bearer resend-test-key" });
      expect(init?.body).toContain("Fullwell");
      return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
    });
    const provider = new ResendMailProvider("resend-test-key", "Fullwell <sign-in@example.test>", fetcher);
    await provider.sendMagicLink("person@example.test", new URL("https://journal.example.test/auth/complete?token=secret"));
    await provider.sendInvitation("person@example.test", new URL("https://journal.example.test/invite/secret"));
    expect(fetcher).toHaveBeenCalledTimes(2);

    const failing = new ResendMailProvider("resend-test-key", "Fullwell <sign-in@example.test>", async () => new Response(null, { status: 503 }));
    await expect(failing.sendInvitation("person@example.test", new URL("https://journal.example.test/invite/secret")))
      .rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("implements clocks, random sources, hashing, and session authentication", async () => {
    expect(new SystemClock().now()).toBeInstanceOf(Date);
    const crypto = new CryptoRandomSource();
    expect(crypto.opaqueId("req")).toMatch(/^req_[a-f0-9]{32}$/);
    expect(crypto.token(16)).toHaveLength(22);

    const deterministic = new DeterministicRandomSource();
    expect(deterministic.opaqueId("req")).toBe("req_0000000000000001");
    expect(deterministic.token(4)).toBe("AgICAg");
    const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
    clock.advance(1_000);
    expect(clock.now().toISOString()).toBe("2026-07-15T12:00:01.000Z");

    const hasher = new HmacTokenHasher("provider-test-pepper");
    const digest = hasher.hash("token");
    expect(hasher.matches("token", digest)).toBe(true);
    expect(hasher.matches("wrong", digest)).toBe(false);
    expect(hasher.matches("token", "short")).toBe(false);

    const sessions = new MemoryOperationalStore();
    sessions.addSession("session-token", {
      userId: UserIdSchema.parse("usr_0000000000000501"),
      actorId: ActorIdSchema.parse("act_0000000000000501"),
      displayName: "Session User",
      scopes: new Set(["journal:read"]),
      client: "web",
    });
    const authenticator = new BearerSessionAuthenticator(sessions);
    await expect(authenticator.authenticate("Bearer session-token")).resolves.toMatchObject({ displayName: "Session User" });
    await expect(authenticator.authenticate(undefined)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(authenticator.authenticate("Bearer missing")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(new DeterministicTestAuthenticator().authenticate("Bearer test-member-token")).resolves.toMatchObject({ displayName: "Test Member" });
    await expect(new DeterministicTestAuthenticator().authenticate("Basic invalid")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("fails closed for unconfigured external providers and emits safe telemetry", async () => {
    const mail = new UnconfiguredMailProvider();
    await expect(mail.sendMagicLink()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(mail.sendInvitation()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(new UnconfiguredAppleIdentityProvider().exchangeAppleCode()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(new UnconfiguredBackupProvider().uploadBundle())
      .rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const telemetry = new ConsoleTelemetry();
    telemetry.event("test.event", { count: 1 });
    telemetry.error("test.error", new Error("private detail"), { retryable: false });
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"event":"test.event"'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('"error":"Error"'));
    const noop = new NoopTelemetry();
    noop.event();
    noop.error();
  });

  it("rejects failed Apple token exchange and omits non-string email claims", async () => {
    const appSigning = await generateKeyPair("ES256", { extractable: true });
    const appPrivateKey = await exportPKCS8(appSigning.privateKey);
    const unavailable = new AppleIdentityProvider("com.example.fullwell", "TEAMID", "KEYID", appPrivateKey, async () => new Response(null, { status: 503 }));
    await expect(unavailable.exchangeAppleCode("code", "https://example.test/callback", "nonce")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    const appleSigning = await generateKeyPair("ES256", { extractable: true });
    const idToken = await new SignJWT({ nonce: "nonce", email: 123 })
      .setProtectedHeader({ alg: "ES256" }).setIssuer("https://appleid.apple.com").setAudience("com.example.fullwell")
      .setSubject("apple-subject").setIssuedAt().setExpirationTime("5m").sign(appleSigning.privateKey);
    const provider = new AppleIdentityProvider(
      "com.example.fullwell", "TEAMID", "KEYID", appPrivateKey,
      async () => new Response(JSON.stringify({ id_token: idToken }), { status: 200 }),
      async () => appleSigning.publicKey,
    );
    await expect(provider.exchangeAppleCode("code", "https://example.test/callback", "nonce"))
      .resolves.toMatchObject({ email: null });
  });
});
