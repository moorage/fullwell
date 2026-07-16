import { ActorIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import type { AuthChallenge, PasskeyCredential, WebSession } from "./types.js";
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

  it("stores passkeys by user and updates counters without exposing mutable key bytes", async () => {
    const store = new MemoryAuthStore();
    const userId = UserIdSchema.parse("usr_0000000000000911");
    const user = await store.resolveOrCreateUser({
      provider: "magic_link",
      subjectHash: "passkey-owner",
      displayName: "Passkey Owner",
      candidateUserId: userId,
      candidateActorId: ActorIdSchema.parse("act_0000000000000911"),
    });
    expect(await store.getUserById(userId)).toEqual(user);
    expect(await store.getUserById(UserIdSchema.parse("usr_0000000000000912"))).toBeNull();

    const credential: PasskeyCredential = {
      credentialId: "credential_11",
      userId,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 1,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
      name: "Passkey",
      createdAt: "2026-07-15T12:00:00.000Z",
      lastUsedAt: null,
    };
    await expect(store.savePasskeyCredential({ ...credential, userId: UserIdSchema.parse("usr_0000000000000999") })).resolves.toBe(false);
    await expect(store.savePasskeyCredential(credential)).resolves.toBe(true);
    await expect(store.savePasskeyCredential(credential)).resolves.toBe(false);
    credential.publicKey[0] = 9;
    expect((await store.getPasskeyCredential(credential.credentialId))?.publicKey).toEqual(new Uint8Array([1, 2, 3]));
    expect(await store.listPasskeyCredentials(userId)).toHaveLength(1);
    await expect(store.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 0, newCounter: 2, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(false);
    await expect(store.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 1, newCounter: 1, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(false);
    await expect(store.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 1, newCounter: 0, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(false);
    await expect(store.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 1, newCounter: 2, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(true);
    expect(await store.getPasskeyCredential(credential.credentialId)).toMatchObject({ counter: 2, lastUsedAt: "2026-07-15T12:01:00.000Z" });
    await expect(store.revokePasskeyCredential({ credentialId: credential.credentialId, userId: UserIdSchema.parse("usr_0000000000000999"), revokedAt: "2026-07-15T12:02:00.000Z" })).resolves.toBe(false);
    await expect(store.revokePasskeyCredential({ credentialId: credential.credentialId, userId, revokedAt: "2026-07-15T12:02:00.000Z" })).resolves.toBe(true);
    expect(await store.getPasskeyCredential(credential.credentialId)).toBeNull();
  });
});
