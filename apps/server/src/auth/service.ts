import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { z } from "zod";
import type { Clock, IdentityProviderPort, MailPort, RandomSource, TokenHasher } from "../core/ports.js";
import { AppError } from "../core/errors.js";
import type { Principal } from "../core/types.js";
import type { AuthChallengeKind, AuthStore, AuthUser, IssuedWebSession, PasskeyCredential, PasskeyProvider } from "./types.js";

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

  async requestMagicLinkIdentity(userId: Principal["userId"], rawSessionToken: string, emailInput: string): Promise<void> {
    await this.assertSessionUser(rawSessionToken, userId);
    const email = z.email().parse(emailInput).trim().toLowerCase();
    const token = this.random.token(32);
    await this.store.saveChallenge({
      id: this.random.opaqueId("challenge"),
      kind: "magic_link",
      tokenHash: this.hasher.hash(token),
      browserBindingHash: this.hasher.hash(rawSessionToken),
      payload: { subject_hash: this.hasher.hash(email), link_user_id: userId },
      expiresAt: addMinutes(this.clock.now(), 15),
      consumedAt: null,
    });
    const url = new URL("/account/sign-in-methods/magic_link/complete", this.publicOrigin);
    url.searchParams.set("token", token);
    await this.mail.sendMagicLink(email, url);
  }

  async completeMagicLinkIdentity(token: string, rawSessionToken: string): Promise<void> {
    const challenge = await this.consumeChallenge("magic_link", token, rawSessionToken);
    const userId = UserIdSchema.parse(requiredPayload(challenge.payload, "link_user_id"));
    await this.assertSessionUser(rawSessionToken, userId);
    await this.linkIdentity(userId, "magic_link", requiredPayload(challenge.payload, "subject_hash"));
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

  async beginAppleIdentity(userId: Principal["userId"], rawSessionToken: string): Promise<{ readonly state: string; readonly browserBinding: string }> {
    await this.assertSessionUser(rawSessionToken, userId);
    const state = this.random.token(32);
    const browserBinding = this.random.token(32);
    await this.store.saveChallenge({
      id: this.random.opaqueId("challenge"), kind: "apple", tokenHash: this.hasher.hash(state),
      browserBindingHash: this.hasher.hash(browserBinding), payload: { link_user_id: userId, pending_intent: "/account" },
      expiresAt: addMinutes(this.clock.now(), 10), consumedAt: null,
    });
    return { state, browserBinding };
  }

  async completeApple(input: { readonly code: string; readonly state: string; readonly browserBinding: string; readonly redirectUri: string; readonly rawSessionToken?: string }): Promise<IssuedWebSession> {
    const challenge = await this.consumeChallenge("apple", input.state, input.browserBinding);
    const identity = await this.apple.exchangeAppleCode(input.code, input.redirectUri, input.state);
    const subjectHash = this.hasher.hash(identity.subject);
    const linkUserId = challenge.payload.link_user_id;
    const user = linkUserId === undefined
      ? await this.resolveOrCreateUser("apple", subjectHash, identity.name?.trim() || "Household member")
      : await this.completeAppleIdentity(UserIdSchema.parse(linkUserId), input.rawSessionToken, subjectHash);
    return this.issueSession(user, challenge.payload.pending_intent ?? null);
  }

  async beginPasskeyAuthentication(pendingIntentInput?: string): Promise<{
    readonly browserBinding: string;
    readonly transaction: string;
    readonly publicOptions: object;
  }> {
    const pendingIntent = pendingIntentInput === undefined ? null : PendingIntentSchema.parse(pendingIntentInput);
    const started = await this.passkeys.beginAuthentication();
    const transaction = this.random.token(32);
    const browserBinding = this.random.token(32);
    await this.savePasskeyChallenge({
      kind: "webauthn_authentication",
      transaction,
      browserBinding,
      challenge: started.challenge,
      payload: pendingIntent === null ? {} : { pending_intent: pendingIntent },
    });
    return { browserBinding, transaction, publicOptions: started.publicOptions };
  }

  async completePasskeyAuthentication(input: {
    readonly transaction: string;
    readonly browserBinding: string;
    readonly response: unknown;
  }): Promise<IssuedWebSession> {
    const challenge = await this.consumeChallenge("webauthn_authentication", input.transaction, input.browserBinding);
    const credentialId = this.passkeys.authenticationCredentialId(input.response);
    const credential = await this.store.getPasskeyCredential(credentialId);
    if (credential === null) throw new AppError("AUTH_REQUIRED", "The passkey sign-in request is invalid or expired");
    const verified = await this.passkeys.completeAuthentication(
      input.response,
      requiredPayload(challenge.payload, "expected_challenge"),
      credential,
    );
    const usedAt = this.clock.now().toISOString();
    if (!await this.store.updatePasskeyCounter({
      credentialId,
      expectedCounter: credential.counter,
      newCounter: verified.newCounter,
      usedAt,
    })) throw new AppError("AUTH_REQUIRED", "The passkey sign-in request is invalid or expired");
    const user = await this.store.getUserById(credential.userId);
    if (user === null) throw new AppError("AUTH_REQUIRED", "The passkey sign-in request is invalid or expired");
    return this.issueSession(user, challenge.payload.pending_intent ?? null);
  }

  async beginPasskeyRegistration(userId: Principal["userId"], rawSessionToken: string): Promise<{
    readonly transaction: string;
    readonly publicOptions: object;
  }> {
    const user = await this.store.getUserById(userId);
    if (user === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    const started = await this.passkeys.beginRegistration({ user, credentials: await this.store.listPasskeyCredentials(userId) });
    const transaction = this.random.token(32);
    await this.savePasskeyChallenge({
      kind: "webauthn_registration",
      transaction,
      browserBinding: rawSessionToken,
      challenge: started.challenge,
      payload: { user_id: userId },
    });
    return { transaction, publicOptions: started.publicOptions };
  }

  async completePasskeyRegistration(input: {
    readonly userId: Principal["userId"];
    readonly rawSessionToken: string;
    readonly transaction: string;
    readonly response: unknown;
  }): Promise<PasskeyCredential> {
    const challenge = await this.consumeChallenge("webauthn_registration", input.transaction, input.rawSessionToken);
    if (requiredPayload(challenge.payload, "user_id") !== input.userId) {
      throw new AppError("FORBIDDEN", "The passkey enrollment belongs to a different account");
    }
    const registered = await this.passkeys.completeRegistration(
      input.response,
      requiredPayload(challenge.payload, "expected_challenge"),
    );
    const credential: PasskeyCredential = {
      ...registered,
      userId: input.userId,
      name: "Passkey",
      createdAt: this.clock.now().toISOString(),
      lastUsedAt: null,
    };
    if (!await this.store.savePasskeyCredential(credential)) {
      throw new AppError("VALIDATION_FAILED", "That passkey is already registered");
    }
    return credential;
  }

  async listPasskeys(userId: Principal["userId"]): Promise<readonly PasskeyCredential[]> {
    return this.store.listPasskeyCredentials(userId);
  }

  async removePasskey(userId: Principal["userId"], credentialId: string): Promise<void> {
    const result = await this.store.revokePasskeyCredential({ credentialId, userId, revokedAt: this.clock.now().toISOString() });
    if (result === "not_found") throw new AppError("NOT_FOUND", "Passkey not found");
    if (result === "last_method") throw new AppError("VALIDATION_FAILED", "Add another sign-in method before removing this passkey");
  }

  async authenticateSession(rawToken: string): Promise<Principal> {
    const resolved = await this.store.getSessionByTokenHash(this.hasher.hash(rawToken));
    const now = this.clock.now();
    if (resolved === null || resolved.session.revokedAt !== null || new Date(resolved.session.expiresAt) <= now) {
      throw new AppError("AUTH_REQUIRED", "The sign-in session is invalid or expired");
    }
    return principalFor(resolved.user);
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

  async requireRecentAuthentication(rawSessionToken: string, maximumAgeMinutes = 15): Promise<Principal> {
    const resolved = await this.store.getSessionByTokenHash(this.hasher.hash(rawSessionToken));
    const cutoff = this.clock.now().getTime() - maximumAgeMinutes * 60_000;
    if (
      resolved === null || resolved.session.revokedAt !== null || new Date(resolved.session.expiresAt) <= this.clock.now() ||
      Date.parse(resolved.session.authenticatedAt) < cutoff
    ) {
      throw new AppError("AUTH_REQUIRED", "Sign in again before completing this action");
    }
    return principalFor(resolved.user);
  }

  private async assertSessionUser(rawSessionToken: string, userId: Principal["userId"]): Promise<AuthUser> {
    const principal = await this.authenticateSession(rawSessionToken);
    if (principal.userId !== userId) throw new AppError("FORBIDDEN", "The sign-in method belongs to a different account");
    const user = await this.store.getUserById(userId);
    if (user === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    return user;
  }

  private async completeAppleIdentity(userId: Principal["userId"], rawSessionToken: string | undefined, subjectHash: string) {
    if (rawSessionToken === undefined) throw new AppError("AUTH_REQUIRED", "Sign in is required to link Apple");
    const user = await this.assertSessionUser(rawSessionToken, userId);
    await this.linkIdentity(userId, "apple", subjectHash);
    return user;
  }

  private async linkIdentity(userId: Principal["userId"], provider: "apple" | "magic_link", subjectHash: string): Promise<void> {
    const result = await this.store.linkIdentityMethod(userId, provider, subjectHash);
    if (result === "identity_in_use") throw new AppError("VALIDATION_FAILED", "That sign-in method belongs to another account");
    if (result === "user_not_found") throw new AppError("AUTH_REQUIRED", "Sign in is required");
  }

  private async consumeChallenge(kind: AuthChallengeKind, rawToken: string, browserBinding: string) {
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
      pendingIntent, authenticatedAt: this.clock.now().toISOString(), expiresAt, revokedAt: null,
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

  private async savePasskeyChallenge(input: {
    readonly kind: "webauthn_registration" | "webauthn_authentication";
    readonly transaction: string;
    readonly browserBinding: string;
    readonly challenge: string;
    readonly payload: Readonly<Record<string, string>>;
  }): Promise<void> {
    await this.store.saveChallenge({
      id: this.random.opaqueId("challenge"),
      kind: input.kind,
      tokenHash: this.hasher.hash(input.transaction),
      browserBindingHash: this.hasher.hash(input.browserBinding),
      payload: { ...input.payload, expected_challenge: input.challenge },
      expiresAt: addMinutes(this.clock.now(), 5),
      consumedAt: null,
    });
  }
}

function principalFor(user: Awaited<ReturnType<AuthStore["resolveOrCreateUser"]>>): Principal {
  return {
    userId: user.id,
    actorId: ActorIdSchema.parse(user.actorId),
    displayName: user.displayName,
    scopes: new Set(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
    client: "web",
  };
}

function requiredPayload(payload: Readonly<Record<string, string>>, key: string): string {
  const value = payload[key];
  if (value === undefined) throw new AppError("INTERNAL_ERROR", "The sign-in request is incomplete");
  return value;
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}
