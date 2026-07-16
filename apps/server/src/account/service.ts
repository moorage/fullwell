import { RequestIdSchema } from "@hfj/contracts";
import type { HouseholdId, UserId } from "@hfj/contracts";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { Clock, HouseholdRepositoryPort, OperationalStorePort, RandomSource } from "../core/ports.js";
import type { AuthStore, IdentityMethodProvider } from "../auth/types.js";
import type { OAuthGrantSummary, OAuthStore } from "../oauth/types.js";
import { markdownDocument } from "../domain/journal-validation.js";

const DisplayNameSchema = z.string().trim().min(1).max(120);

export class AccountService {
  constructor(
    private readonly auth: AuthStore,
    private readonly operational: OperationalStorePort,
    private readonly oauth: OAuthStore,
    private readonly clock: Clock,
    private readonly repository: HouseholdRepositoryPort,
    private readonly random: RandomSource,
  ) {}

  async summary(userId: UserId): Promise<{
    readonly methods: readonly IdentityMethodProvider[];
    readonly grants: readonly OAuthGrantSummary[];
  }> {
    return {
      methods: await this.auth.listIdentityMethods(userId),
      grants: await this.oauth.listActiveGrants(userId),
    };
  }

  async rename(userId: UserId, displayNameInput: string) {
    const user = await this.auth.updateUserDisplayName(userId, DisplayNameSchema.parse(displayNameInput), this.clock.now().toISOString());
    if (user === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    return user;
  }

  async removeIdentityMethod(userId: UserId, provider: IdentityMethodProvider): Promise<void> {
    const result = await this.auth.removeIdentityMethod(userId, provider);
    if (result === "not_found") throw new AppError("NOT_FOUND", "Sign-in method not found");
    if (result === "last_method") throw new AppError("VALIDATION_FAILED", "Add another sign-in method before removing this one");
  }

  async revokeGrant(userId: UserId, grantId: string): Promise<void> {
    if (!await this.oauth.revokeGrantForUser(userId, grantId, this.clock.now().toISOString())) {
      throw new AppError("NOT_FOUND", "Connected agent access not found");
    }
  }

  async leaveHousehold(userId: UserId, householdId: HouseholdId): Promise<void> {
    const user = await this.auth.getUserById(userId);
    if (user === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    await this.operational.withHouseholdLock(householdId, async () => {
      const membership = await this.operational.getMembership(householdId, userId);
      if (membership === null) throw new AppError("NOT_FOUND", "Household membership not found");
      const activeMembers = await this.operational.listHouseholdMemberships(householdId);
      if (membership.role === "owner" && activeMembers.filter(({ role }) => role === "owner").length <= 1) {
        throw new AppError("VALIDATION_FAILED", "Transfer ownership or delete the household before leaving");
      }
      const removedAt = this.clock.now().toISOString();
      const expectedHead = await this.repository.head(householdId);
      const head = await this.repository.commit(householdId, expectedHead, [{
        path: `members/${membership.actorId}.md`,
        content: markdownDocument({ actor_id: membership.actorId, former_member: true, removed_at: removedAt, schema_version: 1 }, ""),
        appendOnly: false,
      }], {
        requestId: RequestIdSchema.parse(this.random.opaqueId("req")), householdId, actorId: user.actorId,
        tool: "hfj_remove_member", client: "web", summary: "members: leave household", occurredAt: removedAt,
      });
      const result = await this.operational.leaveMembership(userId, householdId, removedAt);
      if (result !== "left") throw new AppError("RECONCILIATION_REQUIRED", "The membership change requires reconciliation");
      for (const member of activeMembers) {
        member.projectionHead = head;
        if (member.userId === userId) member.removedAt = removedAt;
        await this.operational.upsertMembership(member);
      }
      await this.operational.updateHouseholdHead(householdId, head);
    });
  }

  async deleteAccount(userId: UserId): Promise<void> {
    const user = await this.auth.getUserById(userId);
    if (user === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    const memberships = await this.operational.listMemberships(userId);
    for (const { household, membership } of memberships) {
      const members = await this.operational.listHouseholdMemberships(household.id);
      if (membership.role === "owner" && members.filter(({ role }) => role === "owner").length <= 1) {
        throw new AppError("VALIDATION_FAILED", "Transfer ownership or delete each household you solely own before deleting your account");
      }
    }
    for (const { household } of [...memberships].sort((left, right) => left.household.id.localeCompare(right.household.id))) {
      await this.leaveHousehold(userId, household.id);
    }
    const deletedAt = this.clock.now().toISOString();
    await this.oauth.revokeUserAccess(userId, deletedAt);
    const formerMemberName = `Former member ${user.actorId.slice(-8)}`;
    if (!await this.auth.deleteUser(userId, formerMemberName, deletedAt)) throw new AppError("AUTH_REQUIRED", "Sign in is required");
  }
}
