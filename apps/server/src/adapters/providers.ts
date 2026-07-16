import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { z } from "zod";
import type { OAuthScope } from "@hfj/contracts";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type {
  AuthenticationPort,
  BackupPort,
  Clock,
  IdentityProviderPort,
  MailPort,
  RandomSource,
  SessionStorePort,
  TelemetryPort,
  TokenHasher,
} from "../core/ports.js";
import type { Principal } from "../core/types.js";

export class SystemClock implements Clock {
  now(): Date { return new Date(); }
}

export class CryptoRandomSource implements RandomSource {
  opaqueId(prefix: string): string {
    return `${prefix}_${randomBytes(16).toString("hex")}`;
  }
  token(bytes: number): string { return randomBytes(bytes).toString("base64url"); }
}

export class HmacTokenHasher implements TokenHasher {
  constructor(private readonly pepper: string) {}
  hash(token: string): string { return createHmac("sha256", this.pepper).update(token).digest("hex"); }
  matches(token: string, digest: string): boolean {
    const calculated = Buffer.from(this.hash(token), "hex");
    const expected = Buffer.from(digest, "hex");
    return calculated.length === expected.length && timingSafeEqual(calculated, expected);
  }
}

export class BearerSessionAuthenticator implements AuthenticationPort {
  constructor(private readonly sessions: SessionStorePort) {}
  async authenticate(authorization: string | undefined): Promise<Principal> {
    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      throw new AppError("AUTH_REQUIRED", "Authentication is required");
    }
    const session = await this.sessions.getByToken(authorization.slice(7));
    if (session === null) throw new AppError("AUTH_REQUIRED", "The session is invalid or expired");
    return {
      userId: session.userId,
      actorId: ActorIdSchema.parse(session.actorId),
      displayName: session.displayName,
      scopes: session.scopes,
      client: session.client,
    };
  }
}

export class DeterministicTestAuthenticator implements AuthenticationPort {
  private readonly principals = new Map<string, Principal>();
  constructor() {
    this.principals.set("test-owner-token", {
      userId: UserIdSchema.parse("usr_0000000000000001"),
      actorId: ActorIdSchema.parse("act_0000000000000001"),
      displayName: "Test Owner",
      scopes: new Set<OAuthScope>(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
      client: "test",
    });
    this.principals.set("test-member-token", {
      userId: UserIdSchema.parse("usr_0000000000000002"),
      actorId: ActorIdSchema.parse("act_0000000000000002"),
      displayName: "Test Member",
      scopes: new Set<OAuthScope>(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
      client: "test",
    });
  }
  async authenticate(authorization: string | undefined): Promise<Principal> {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const principal = this.principals.get(token);
    if (principal === undefined) throw new AppError("AUTH_REQUIRED", "Authentication is required");
    return principal;
  }
}

export class ConsoleTelemetry implements TelemetryPort {
  event(name: string, attributes: Readonly<Record<string, string | number | boolean>>): void {
    process.stdout.write(`${JSON.stringify({ level: "info", event: name, ...attributes })}\n`);
  }
  error(name: string, error: Error, attributes: Readonly<Record<string, string | number | boolean>>): void {
    process.stderr.write(`${JSON.stringify({ level: "error", event: name, error: error.name, ...attributes })}\n`);
  }
}

export class NoopTelemetry implements TelemetryPort {
  event(): void {}
  error(): void {}
}

export class UnconfiguredMailProvider implements MailPort {
  async sendMagicLink(): Promise<void> { throw new AppError("PROVIDER_UNAVAILABLE", "Email delivery is not configured"); }
  async sendInvitation(): Promise<void> { throw new AppError("PROVIDER_UNAVAILABLE", "Email delivery is not configured"); }
}

export class UnconfiguredAppleIdentityProvider implements IdentityProviderPort {
  async exchangeAppleCode(): Promise<never> { throw new AppError("PROVIDER_UNAVAILABLE", "Apple sign-in is not configured"); }
}

const AppleTokenResponseSchema = z.object({ id_token: z.string().min(1) });

export class AppleIdentityProvider implements IdentityProviderPort {
  constructor(
    private readonly clientId: string,
    private readonly teamId: string,
    private readonly keyId: string,
    private readonly privateKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly verificationKey: Parameters<typeof jwtVerify>[1] = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
  ) {}

  async exchangeAppleCode(code: string, redirectUri: string, nonce: string): Promise<{ subject: string; email: string | null; name: string | null }> {
    const signingKey = await importPKCS8(this.privateKey, "ES256");
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.keyId })
      .setIssuer(this.teamId)
      .setSubject(this.clientId)
      .setAudience("https://appleid.apple.com")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signingKey);
    const response = await this.fetcher("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError("PROVIDER_UNAVAILABLE", "Apple sign-in could not validate the authorization code");
    const token = AppleTokenResponseSchema.parse(await response.json());
    const verified = await jwtVerify(token.id_token, this.verificationKey, {
      issuer: "https://appleid.apple.com",
      audience: this.clientId,
      requiredClaims: ["sub", "nonce"],
    });
    if (verified.payload.nonce !== nonce) throw new AppError("AUTH_REQUIRED", "The Apple identity response did not match the sign-in request");
    return {
      subject: z.string().min(1).parse(verified.payload.sub),
      email: typeof verified.payload.email === "string" ? verified.payload.email : null,
      name: null,
    };
  }
}

export class ResendMailProvider implements MailPort {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetcher: typeof fetch = fetch) {}

  async sendMagicLink(recipient: string, url: URL): Promise<void> {
    await this.send(recipient, "Sign in to Fullwell", `Use this one-time link to sign in to Fullwell. It expires in 15 minutes.\n\n${url}`, url);
  }

  async sendInvitation(recipient: string, url: URL): Promise<void> {
    await this.send(recipient, "You were invited to a Fullwell household", `Review the household invitation before choosing whether to join.\n\n${url}`, url);
  }

  private async send(recipient: string, subject: string, text: string, url: URL): Promise<void> {
    const response = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": createHash("sha256").update(url.toString()).digest("hex"),
      },
      body: JSON.stringify({ from: this.from, to: [recipient], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError("PROVIDER_UNAVAILABLE", "Email delivery is temporarily unavailable");
  }
}

export class UnconfiguredBackupProvider implements BackupPort {
  async uploadBundle(): Promise<void> { throw new AppError("PROVIDER_UNAVAILABLE", "Off-site backup is not configured"); }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date { return new Date(this.current); }
  advance(milliseconds: number): void { this.current = new Date(this.current.getTime() + milliseconds); }
}

export class DeterministicRandomSource implements RandomSource {
  private sequence = 0;
  opaqueId(prefix: string): string { this.sequence += 1; return `${prefix}_${this.sequence.toString(16).padStart(16, "0")}`; }
  token(bytes: number): string { this.sequence += 1; return Buffer.alloc(bytes, this.sequence % 255).toString("base64url"); }
}
