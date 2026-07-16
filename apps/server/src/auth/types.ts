import type { UserId } from "@hfj/contracts";

export type AuthChallengeKind = "magic_link" | "apple" | "webauthn_registration" | "webauthn_authentication";

export interface AuthUser {
  readonly id: UserId;
  readonly actorId: string;
  readonly displayName: string;
}

export interface AuthChallenge {
  readonly id: string;
  readonly kind: AuthChallengeKind;
  readonly tokenHash: string;
  readonly browserBindingHash: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}

export interface WebSession {
  readonly id: string;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly csrfHash: string;
  readonly pendingIntent: string | null;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface AuthStore {
  saveChallenge(challenge: AuthChallenge): Promise<void>;
  consumeChallenge(input: {
    readonly tokenHash: string;
    readonly kind: AuthChallengeKind;
    readonly browserBindingHash: string | null;
    readonly consumedAt: string;
  }): Promise<AuthChallenge | null>;
  resolveOrCreateUser(input: {
    readonly provider: "apple" | "magic_link";
    readonly subjectHash: string;
    readonly displayName: string;
    readonly candidateUserId: UserId;
    readonly candidateActorId: string;
  }): Promise<AuthUser>;
  saveSession(session: WebSession): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<{ readonly session: WebSession; readonly user: AuthUser } | null>;
  revokeSession(tokenHash: string, revokedAt: string): Promise<void>;
  revokeUserSessions(userId: UserId, revokedAt: string): Promise<void>;
}

export interface PasskeyProvider {
  beginAuthentication(userId: UserId | null): Promise<{ readonly challenge: string; readonly publicOptions: Readonly<Record<string, object | string | boolean>> }>;
  completeAuthentication(response: unknown, expectedChallenge: string): Promise<{ readonly credentialSubjectHash: string }>;
}

export interface IssuedWebSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: string;
  readonly pendingIntent: string | null;
  readonly user: AuthUser;
}
