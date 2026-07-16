import { exportPKCS8, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { AppleIdentityProvider, ResendMailProvider } from "./providers.js";

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
      expect(init?.body).toContain("Sign in to Fullwell");
      return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
    });
    const provider = new ResendMailProvider("resend-test-key", "Fullwell <sign-in@example.test>", fetcher);
    await provider.sendMagicLink("person@example.test", new URL("https://journal.example.test/auth/complete?token=secret"));
    expect(fetcher).toHaveBeenCalledOnce();

    const failing = new ResendMailProvider("resend-test-key", "Fullwell <sign-in@example.test>", async () => new Response(null, { status: 503 }));
    await expect(failing.sendInvitation("person@example.test", new URL("https://journal.example.test/invite/secret")))
      .rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
