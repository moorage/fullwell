import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import type { AuthChallenge, WebSession } from "./types.js";
import { MemoryAuthStore } from "./memory-store.js";

describe("MemoryAuthStore", () => {
  it("consumes only a matching unused challenge", async () => {
    const store = new MemoryAuthStore();
    const challenge: AuthChallenge = {
      id: "challenge-1", kind: "magic_link", tokenHash: "token-hash", browserBindingHash: "binding-hash",
      payload: { subject: "person@example.test" }, expiresAt: "2026-07-15T13:00:00.000Z", consumedAt: null,
    };
    await expect(store.consumeChallenge({ tokenHash: "missing", kind: "magic_link", browserBindingHash: "binding-hash", consumedAt: "2026-07-15T12:00:00.000Z" })).resolves.toBeNull();
    await store.saveChallenge(challenge);
    await expect(store.consumeChallenge({ tokenHash: challenge.tokenHash, kind: "apple", browserBindingHash: "binding-hash", consumedAt: "2026-07-15T12:00:00.000Z" })).resolves.toBeNull();
    await expect(store.consumeChallenge({ tokenHash: challenge.tokenHash, kind: "magic_link", browserBindingHash: "wrong", consumedAt: "2026-07-15T12:00:00.000Z" })).resolves.toBeNull();
    await expect(store.consumeChallenge({ tokenHash: challenge.tokenHash, kind: "magic_link", browserBindingHash: "binding-hash", consumedAt: "2026-07-15T12:00:00.000Z" })).resolves.toEqual(challenge);
    await expect(store.consumeChallenge({ tokenHash: challenge.tokenHash, kind: "magic_link", browserBindingHash: "binding-hash", consumedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBeNull();
  });

  it("reuses identities and handles present, orphaned, revoked, and user-wide sessions", async () => {
    const store = new MemoryAuthStore();
    const userId = UserIdSchema.parse("usr_0000000000000901");
    const actorId = ActorIdSchema.parse("act_0000000000000901");
    const user = await store.resolveOrCreateUser({ provider: "magic_link", subjectHash: "subject", displayName: "First", candidateUserId: userId, candidateActorId: actorId });
    expect(await store.resolveOrCreateUser({ provider: "magic_link", subjectHash: "subject", displayName: "Ignored", candidateUserId: UserIdSchema.parse("usr_0000000000000999"), candidateActorId: ActorIdSchema.parse("act_0000000000000999") })).toBe(user);
    expect(await store.getSessionByTokenHash("missing")).toBeNull();

    const orphan: WebSession = { id: "session-orphan", userId: UserIdSchema.parse("usr_0000000000000998"), tokenHash: "orphan", csrfHash: "csrf", pendingIntent: null, expiresAt: "2026-08-15T12:00:00.000Z", revokedAt: null };
    await store.saveSession(orphan);
    expect(await store.getSessionByTokenHash(orphan.tokenHash)).toBeNull();

    const session: WebSession = { ...orphan, id: "session-1", userId, tokenHash: "session-1" };
    await store.saveSession(session);
    expect(await store.getSessionByTokenHash(session.tokenHash)).toEqual({ session, user });
    await store.revokeSession("missing", "2026-07-15T12:00:00.000Z");
    await store.revokeSession(session.tokenHash, "2026-07-15T12:00:00.000Z");
    expect((await store.getSessionByTokenHash(session.tokenHash))?.session.revokedAt).toBe("2026-07-15T12:00:00.000Z");
    await store.revokeUserSessions(UserIdSchema.parse("usr_0000000000000997"), "2026-07-15T12:01:00.000Z");
    await store.revokeUserSessions(userId, "2026-07-15T12:02:00.000Z");
    expect((await store.getSessionByTokenHash(session.tokenHash))?.session.revokedAt).toBe("2026-07-15T12:02:00.000Z");
  });
});
