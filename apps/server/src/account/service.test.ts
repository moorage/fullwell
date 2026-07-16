import { ActorIdSchema, HouseholdIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock } from "../adapters/providers.js";
import { MemoryAuthStore } from "../auth/memory-store.js";
import { MemoryOAuthStore } from "../oauth/memory-store.js";
import { AccountService } from "./service.js";

async function fixture() {
  const auth = new MemoryAuthStore();
  const operational = new MemoryOperationalStore();
  const oauth = new MemoryOAuthStore();
  const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
  const repository = new MemoryHouseholdRepository();
  const random = new DeterministicRandomSource();
  const userId = UserIdSchema.parse("usr_0000000000000961");
  const actorId = ActorIdSchema.parse("act_0000000000000961");
  await auth.resolveOrCreateUser({ provider: "magic_link", subjectHash: "account-owner", displayName: "Account Owner", candidateUserId: userId, candidateActorId: actorId });
  await oauth.registerClient({ clientId: "codex-client", name: "Codex", redirectUris: ["https://example.test/callback"], tokenEndpointAuthMethod: "none" });
  await oauth.saveGrant({ id: "grant-1", userId, clientId: "codex-client", scopes: ["journal:read"], resource: "https://journal.example.test/mcp", revokedAt: null });
  return { auth, operational, oauth, clock, repository, userId, actorId, accounts: new AccountService(auth, operational, oauth, clock, repository, random) };
}

describe("AccountService", () => {
  it("renames the user and lists and revokes connected access", async () => {
    const { accounts, auth, oauth, userId } = await fixture();
    await expect(accounts.rename(userId, "  Kitchen Owner  ")).resolves.toMatchObject({ displayName: "Kitchen Owner" });
    await expect(accounts.summary(userId)).resolves.toMatchObject({
      methods: ["magic_link"],
      grants: [{ id: "grant-1", clientName: "Codex", scopes: ["journal:read"] }],
    });
    await accounts.revokeGrant(userId, "grant-1");
    expect(await oauth.listActiveGrants(userId)).toEqual([]);
    await expect(accounts.revokeGrant(userId, "grant-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await auth.getUserById(userId))?.displayName).toBe("Kitchen Owner");
  });

  it("retains at least one sign-in method", async () => {
    const { accounts, auth, userId } = await fixture();
    await expect(accounts.removeIdentityMethod(userId, "magic_link")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await auth.linkIdentityMethod(userId, "apple", "account-owner-apple");
    await accounts.removeIdentityMethod(userId, "magic_link");
    await expect(accounts.removeIdentityMethod(userId, "magic_link")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects account actions for missing users and memberships", async () => {
    const { accounts, userId } = await fixture();
    const missingUserId = UserIdSchema.parse("usr_0000000000000999");
    await expect(accounts.rename(missingUserId, "Missing")).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(accounts.leaveHousehold(missingUserId, HouseholdIdSchema.parse("hsh_0000000000000999"))).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(accounts.leaveHousehold(userId, HouseholdIdSchema.parse("hsh_0000000000000999"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(accounts.deleteAccount(missingUserId)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("blocks a sole owner from leaving or deleting and completes deletion after another owner exists", async () => {
    const { accounts, auth, operational, oauth, repository, userId, actorId } = await fixture();
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000961");
    const head = await repository.provision(householdId, "Account Kitchen", actorId, "2026-07-15T12:00:00.000Z");
    await operational.createHousehold(
      { id: householdId, name: "Account Kitchen", repositoryHead: head, provisioningState: "ready", createdAt: "2026-07-15T12:00:00.000Z" },
      { householdId, userId, actorId, role: "owner", projectionHead: head, removedAt: null },
    );
    await expect(accounts.leaveHousehold(userId, householdId)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(accounts.deleteAccount(userId)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await operational.upsertMembership({
      householdId,
      userId: UserIdSchema.parse("usr_0000000000000962"),
      actorId: ActorIdSchema.parse("act_0000000000000962"),
      role: "owner",
      projectionHead: head,
      removedAt: null,
    });
    await accounts.deleteAccount(userId);
    expect(await auth.getUserById(userId)).toBeNull();
    expect(await operational.getMembership(householdId, userId)).toBeNull();
    expect(await oauth.listActiveGrants(userId)).toEqual([]);
    expect(await repository.read(householdId, `members/${actorId}.md`)).toContain("former_member: true");
  });
});
