import type { UserId } from "@hfj/contracts";
import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import type { AuthChallenge, AuthStore, AuthUser, WebSession } from "./types.js";

export class MemoryAuthStore implements AuthStore {
  private readonly challenges = new Map<string, AuthChallenge>();
  private readonly identities = new Map<string, AuthUser>();
  private readonly users = new Map<UserId, AuthUser>();
  private readonly sessions = new Map<string, WebSession>();

  async saveChallenge(challenge: AuthChallenge): Promise<void> { this.challenges.set(challenge.tokenHash, challenge); }

  async consumeChallenge(input: { readonly tokenHash: string; readonly kind: AuthChallenge["kind"]; readonly browserBindingHash: string | null; readonly consumedAt: string }): Promise<AuthChallenge | null> {
    const challenge = this.challenges.get(input.tokenHash);
    if (
      challenge === undefined || challenge.kind !== input.kind || challenge.consumedAt !== null ||
      challenge.browserBindingHash !== input.browserBindingHash
    ) return null;
    this.challenges.set(input.tokenHash, { ...challenge, consumedAt: input.consumedAt });
    return challenge;
  }

  async resolveOrCreateUser(input: { readonly provider: "apple" | "magic_link"; readonly subjectHash: string; readonly displayName: string; readonly candidateUserId: UserId; readonly candidateActorId: string }): Promise<AuthUser> {
    const key = `${input.provider}:${input.subjectHash}`;
    const found = this.identities.get(key);
    if (found !== undefined) return found;
    const user = { id: UserIdSchema.parse(input.candidateUserId), actorId: ActorIdSchema.parse(input.candidateActorId), displayName: input.displayName };
    this.users.set(user.id, user);
    this.identities.set(key, user);
    return user;
  }

  async saveSession(session: WebSession): Promise<void> { this.sessions.set(session.tokenHash, session); }

  async getSessionByTokenHash(tokenHash: string): Promise<{ readonly session: WebSession; readonly user: AuthUser } | null> {
    const session = this.sessions.get(tokenHash);
    const user = session === undefined ? undefined : this.users.get(session.userId);
    return session === undefined || user === undefined ? null : { session, user };
  }

  async revokeSession(tokenHash: string, revokedAt: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session !== undefined) this.sessions.set(tokenHash, { ...session, revokedAt });
  }

  async revokeUserSessions(userId: UserId, revokedAt: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.set(hash, { ...session, revokedAt });
    }
  }
}
