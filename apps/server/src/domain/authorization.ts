import type { HouseholdId, OAuthScope, Role } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { OperationalStorePort } from "../core/ports.js";
import type { MembershipRecord, Principal } from "../core/types.js";

const rank: Readonly<Record<Role, number>> = { viewer: 0, editor: 1, owner: 2 };

export function requireScope(principal: Principal, scope: OAuthScope): void {
  if (!principal.scopes.has(scope)) throw new AppError("FORBIDDEN", `The ${scope} permission is required`);
}

export async function requireMembership(
  store: OperationalStorePort,
  principal: Principal,
  householdId: HouseholdId,
  minimumRole: Role,
): Promise<MembershipRecord> {
  const membership = await store.getMembership(householdId, principal.userId);
  if (membership === null || rank[membership.role] < rank[minimumRole]) {
    throw new AppError("FORBIDDEN", "Your household role does not allow this operation");
  }
  const household = await store.getHousehold(householdId);
  if (household === null || household.provisioningState !== "ready") {
    throw new AppError("PROJECTION_DRIFT", "Household authorization is unavailable while its projection is reconciled", true);
  }
  if (membership.projectionHead !== household.repositoryHead) {
    throw new AppError("PROJECTION_DRIFT", "Household authorization is stale and must be reconciled", true);
  }
  return membership;
}
