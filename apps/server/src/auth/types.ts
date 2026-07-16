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

export type PasskeyTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export interface PasskeyCredential {
  readonly credentialId: string;
  readonly userId: UserId;
  readonly publicKey: Uint8Array;
  readonly counter: number;
  readonly transports: readonly PasskeyTransport[];
  readonly deviceType: "singleDevice" | "multiDevice";
  readonly backedUp: boolean;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
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
  getUserById(userId: UserId): Promise<AuthUser | null>;
  savePasskeyCredential(credential: PasskeyCredential): Promise<boolean>;
  getPasskeyCredential(credentialId: string): Promise<PasskeyCredential | null>;
  listPasskeyCredentials(userId: UserId): Promise<readonly PasskeyCredential[]>;
  updatePasskeyCounter(input: {
    readonly credentialId: string;
    readonly expectedCounter: number;
    readonly newCounter: number;
    readonly usedAt: string;
  }): Promise<boolean>;
  revokePasskeyCredential(input: { readonly credentialId: string; readonly userId: UserId; readonly revokedAt: string }): Promise<boolean>;
  saveSession(session: WebSession): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<{ readonly session: WebSession; readonly user: AuthUser } | null>;
  revokeSession(tokenHash: string, revokedAt: string): Promise<void>;
  revokeUserSessions(userId: UserId, revokedAt: string): Promise<void>;
}

export interface PasskeyProvider {
  beginRegistration(input: {
    readonly user: AuthUser;
    readonly credentials: readonly PasskeyCredential[];
  }): Promise<{ readonly challenge: string; readonly publicOptions: object }>;
  completeRegistration(response: unknown, expectedChallenge: string): Promise<{
    readonly credentialId: string;
    readonly publicKey: Uint8Array;
    readonly counter: number;
    readonly transports: readonly PasskeyTransport[];
    readonly deviceType: PasskeyCredential["deviceType"];
    readonly backedUp: boolean;
  }>;
  beginAuthentication(): Promise<{ readonly challenge: string; readonly publicOptions: object }>;
  authenticationCredentialId(response: unknown): string;
  completeAuthentication(
    response: unknown,
    expectedChallenge: string,
    credential: PasskeyCredential,
  ): Promise<{ readonly newCounter: number }>;
}

export interface IssuedWebSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: string;
  readonly pendingIntent: string | null;
  readonly user: AuthUser;
}
