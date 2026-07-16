import { describe, expect, it } from "vitest";
import { ActorIdSchema, GitObjectIdSchema, HouseholdIdSchema, UserIdSchema } from "@hfj/contracts";
import { MemoryOperationalStore } from "../adapters/memory.js";
import type { HouseholdRecord, Principal } from "../core/types.js";
import { requireMembership, requireScope } from "./authorization.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000301");
const userId = UserIdSchema.parse("usr_0000000000000301");
const actorId = ActorIdSchema.parse("act_0000000000000301");
const head = GitObjectIdSchema.parse("3".repeat(40));
const principal: Principal = { userId, actorId, displayName: "Owner", scopes: new Set(["journal:read"]), client: "test" };

describe("authorization", () => {
  it("requires explicit scopes", () => {
    expect(() => requireScope(principal, "journal:read")).not.toThrow();
    expect(() => requireScope(principal, "journal:write")).toThrow("journal:write permission is required");
  });

  it("requires a current membership with a sufficient role and ready projection", async () => {
    const store = new MemoryOperationalStore();
    await expect(requireMembership(store, principal, householdId, "viewer")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const membership = { householdId, userId, actorId, role: "viewer" as const, projectionHead: head, removedAt: null };
    const household: HouseholdRecord = { id: householdId, name: "Kitchen", repositoryHead: head, provisioningState: "ready", createdAt: "2026-07-15T12:00:00.000Z" };
    await store.createHousehold(household, membership);
    await expect(requireMembership(store, principal, householdId, "editor")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireMembership(store, principal, householdId, "viewer")).resolves.toBe(membership);

    household.provisioningState = "quarantined";
    await expect(requireMembership(store, principal, householdId, "viewer")).rejects.toMatchObject({ code: "PROJECTION_DRIFT", retryable: true });
    household.provisioningState = "ready";
    household.repositoryHead = GitObjectIdSchema.parse("4".repeat(40));
    await expect(requireMembership(store, principal, householdId, "viewer")).rejects.toMatchObject({ code: "PROJECTION_DRIFT", retryable: true });
  });
});
