import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { z } from "zod";
import type { Clock, IdentityProviderPort, MailPort, RandomSource, TokenHasher } from "../core/ports.js";
import { AppError } from "../core/errors.js";
import type { Principal } from "../core/types.js";
import type { AuthStore, IssuedWebSession, PasskeyProvider } from "./types.js";

const PendingIntentSchema = z.string().max(2048).refine((value) => value.startsWith("/"), "Pending intents must be local paths");

export class BrowserAuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly hasher: TokenHasher,
    private readonly mail: MailPort,
    private readonly apple: IdentityProviderPort,
    private readonly passkeys: PasskeyProvider,
    private readonly publicOrigin: URL,
  ) {}

  async requestMagicLink(emailInput: string, pendingIntentInput?: string): Promise<void> {
    const email = z.email().parse(emailInput).trim().toLowerCase();
    const pendingIntent = pendingIntentInput === undefined ? null : PendingIntentSchema.parse(pendingIntentInput);
    const token = this.random.token(32);
    const transaction = this.random.token(24);
    await this.store.saveChallenge({
      id: this.random.opaqueId("challenge"),
      kind: "magic_link",
      tokenHash: this.hasher.hash(token),
      browserBindingHash: this.hasher.hash(transaction),
      payload: { subject_hash: this.hasher.hash(email), ...(pendingIntent === null ? {} : { pending_intent: pendingIntent }) },
      expiresAt: addMinutes(this.clock.now(), 15),
      consumedAt: null,
    });
    const url = new URL("/auth/magic-link/complete", this.publicOrigin);
    url.searchParams.set("token", token);
    url.searchParams.set("transaction", transaction);
    await this.mail.sendMagicLink(email, url);
  }

  async completeMagicLink(token: string, transaction: string): Promise<IssuedWebSession> {
    const challenge = await this.consumeChallenge("magic_link", token, transaction);
    const subjectHash = requiredPayload(challenge.payload, "subject_hash");
    const user = await this.resolveOrCreateUser("magic_link", subjectHash, "Household member");
    return this.issueSession(user, challenge.payload.pending_intent ?? null);
  }

  async beginApple(pendingIntentInput?: string): Promise<{ readonly state: string; readonly browserBinding: string }> {
    const state = this.random.token(32);
    const browserBinding = this.random.token(32);
    const pendingIntent = pendingIntentInput === undefined ? null : PendingIntentSchema.parse(pendingIntentInput);
    await this.store.saveChallenge({
      id: this.random.opaqueId("challenge"), kind: "apple", tokenHash: this.hasher.hash(state),
      browserBindingHash: this.hasher.hash(browserBinding),
      payload: pendingIntent === null ? {} : { pending_intent: pendingIntent },
      expiresAt: addMinutes(this.clock.now(), 10), consumedAt: null,
    });
    return { state, browserBinding };
  }

  async completeApple(input: { readonly code: string; readonly state: string; readonly browserBinding: string; readonly redirectUri: string }): Promise<IssuedWebSession> {
    const challenge = await this.consumeChallenge("apple", input.state, input.browserBinding);
    const identity = await this.apple.exchangeAppleCode(input.code, input.redirectUri, input.state);
    const user = await this.resolveOrCreateUser("apple", this.hasher.hash(identity.subject), identity.name?.trim() || "Household member");
    return this.issueSession(user, challenge.payload.pending_intent ?? null);
  }

  async beginPasskey(userId: Principal["userId"] | null) {
    return this.passkeys.beginAuthentication(userId);
  }

  async authenticateSession(rawToken: string): Promise<Principal> {
    const resolved = await this.store.getSessionByTokenHash(this.hasher.hash(rawToken));
    const now = this.clock.now();
    if (resolved === null || resolved.session.revokedAt !== null || new Date(resolved.session.expiresAt) <= now) {
      throw new AppError("AUTH_REQUIRED", "The sign-in session is invalid or expired");
    }
    return {
      userId: resolved.user.id,
      actorId: ActorIdSchema.parse(resolved.user.actorId),
      displayName: resolved.user.displayName,
      scopes: new Set(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
      client: "web",
    };
  }

  async verifyCsrf(rawSessionToken: string, submittedToken: string): Promise<void> {
    const resolved = await this.store.getSessionByTokenHash(this.hasher.hash(rawSessionToken));
    if (resolved === null || resolved.session.revokedAt !== null || !this.hasher.matches(submittedToken, resolved.session.csrfHash)) {
      throw new AppError("FORBIDDEN", "The form expired; reload and try again");
    }
  }

  async signOut(rawSessionToken: string): Promise<void> {
    await this.store.revokeSession(this.hasher.hash(rawSessionToken), this.clock.now().toISOString());
  }

  private async consumeChallenge(kind: "magic_link" | "apple", rawToken: string, browserBinding: string) {
    const now = this.clock.now();
    const challenge = await this.store.consumeChallenge({
      tokenHash: this.hasher.hash(rawToken), kind, browserBindingHash: this.hasher.hash(browserBinding), consumedAt: now.toISOString(),
    });
    if (challenge === null || new Date(challenge.expiresAt) <= now) throw new AppError("AUTH_REQUIRED", "The sign-in request is invalid or expired");
    return challenge;
  }

  private async issueSession(user: Awaited<ReturnType<AuthStore["resolveOrCreateUser"]>>, pendingIntent: string | null): Promise<IssuedWebSession> {
    const sessionToken = this.random.token(32);
    const csrfToken = this.random.token(32);
    const expiresAt = addMinutes(this.clock.now(), 60 * 24 * 30);
    await this.store.saveSession({
      id: this.random.opaqueId("ses"), userId: user.id, tokenHash: this.hasher.hash(sessionToken), csrfHash: this.hasher.hash(csrfToken),
      pendingIntent, expiresAt, revokedAt: null,
    });
    return { sessionToken, csrfToken, expiresAt, pendingIntent, user };
  }

  private async resolveOrCreateUser(provider: "apple" | "magic_link", subjectHash: string, displayName: string) {
    return this.store.resolveOrCreateUser({
      provider,
      subjectHash,
      displayName,
      candidateUserId: UserIdSchema.parse(this.random.opaqueId("usr")),
      candidateActorId: ActorIdSchema.parse(this.random.opaqueId("act")),
    });
  }
}

function requiredPayload(payload: Readonly<Record<string, string>>, key: string): string {
  const value = payload[key];
  if (value === undefined) throw new AppError("INTERNAL_ERROR", "The sign-in request is incomplete");
  return value;
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}
