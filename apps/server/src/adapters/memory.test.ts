import {
  ActorIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  RequestIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import type { CommitMetadata } from "../core/ports.js";
import type { HouseholdRecord, MembershipRecord, MutationRecord } from "../core/types.js";
import { MemoryHouseholdRepository, MemoryOperationalStore, stableJson, validateRepositoryPath } from "./memory.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000801");
const missingHouseholdId = HouseholdIdSchema.parse("hsh_0000000000000899");
const userId = UserIdSchema.parse("usr_0000000000000801");
const actorId = ActorIdSchema.parse("act_0000000000000801");

function metadata(request = "req_0000000000000801"): CommitMetadata {
  return {
    requestId: RequestIdSchema.parse(request), householdId, actorId, tool: "hfj_update_profile", client: "test",
    summary: "test mutation", occurredAt: "2026-07-15T12:00:00.000Z",
  };
}

describe("memory adapters", () => {
  it("enforces repository existence, expected heads, append-only files, audit uniqueness, and safe paths", async () => {
    const repository = new MemoryHouseholdRepository();
    await expect(repository.head(missingHouseholdId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repository.read(missingHouseholdId, "household.md")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repository.bundle(missingHouseholdId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await repository.verify(missingHouseholdId)).toEqual({ valid: false, detail: "missing" });
    expect(repository.commitCount(missingHouseholdId)).toBe(0);

    const head = await repository.provision(householdId, "Kitchen", actorId, "2026-07-15T12:00:00.000Z");
    expect(await repository.provision(householdId, "Ignored", actorId, "2026-07-15T12:01:00.000Z")).toBe(head);
    expect(await repository.read(householdId, "missing.md")).toBeNull();
    await expect(repository.commit(missingHouseholdId, head, [], metadata())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repository.commit(householdId, GitObjectIdSchema.parse("f".repeat(40)), [], metadata())).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(repository.commit(householdId, head, [{ path: "../escape", content: "bad", appendOnly: false }], metadata())).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const appendHead = await repository.commit(householdId, head, [{ path: "evidence/event.json", content: "{}\n", appendOnly: true }], metadata());
    await expect(repository.commit(householdId, appendHead, [{ path: "evidence/event.json", content: "{}\n", appendOnly: true }], metadata("req_0000000000000802")))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const nextHead = await repository.commit(householdId, appendHead, [{ path: "profiles/one.md", content: "one\n", appendOnly: false }], metadata("req_0000000000000803"));
    await expect(repository.commit(householdId, nextHead, [{ path: "profiles/two.md", content: "two\n", appendOnly: false }], metadata("req_0000000000000803")))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await repository.read(householdId, "profiles/two.md")).toBeNull();
    expect(repository.commitCount(householdId)).toBe(2);
    expect((await repository.bundle(householdId)).byteLength).toBeGreaterThan(0);
  });

  it("stores household, membership, mutation, projection, session, and lock state explicitly", async () => {
    const store = new MemoryOperationalStore();
    const head = GitObjectIdSchema.parse("8".repeat(40));
    const household: HouseholdRecord = { id: householdId, name: "Kitchen", repositoryHead: head, provisioningState: "ready", createdAt: "2026-07-15T12:00:00.000Z" };
    const membership: MembershipRecord = { householdId, userId, actorId, role: "owner", projectionHead: head, removedAt: null };
    await store.createHousehold(household, membership);
    await expect(store.createHousehold(household, membership)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(store.updateHouseholdHead(missingHouseholdId, head)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await store.getDefaultHousehold(userId)).toBeNull();
    expect(await store.getInvitation("missing")).toBeNull();
    expect(await store.findInvitationByTokenHash("missing")).toBeNull();
    expect(await store.getShareByTokenHash("missing")).toBeNull();
    expect(await store.getShareByCollection(householdId, "missing")).toBeNull();
    expect(await store.getMutation(userId, "hfj_update_profile", "missing")).toBeNull();
    await expect(store.projection(missingHouseholdId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    membership.removedAt = "2026-07-15T13:00:00.000Z";
    await store.upsertMembership(membership);
    expect(await store.getMembership(householdId, userId)).toBeNull();
    expect(await store.listMemberships(userId)).toEqual([]);
    expect(await store.listHouseholdMemberships(householdId)).toEqual([]);
    membership.removedAt = null;
    await store.upsertMembership(membership);
    await store.setDefaultHousehold(userId, householdId);
    expect(await store.getDefaultHousehold(userId)).toBe(householdId);

    const mutation: MutationRecord = {
      requestId: RequestIdSchema.parse("req_0000000000000810"), userId, tool: "hfj_update_profile", idempotencyKey: "memory-mutation-0810",
      householdId, state: "received", commitId: null, response: null, failure: null,
      createdAt: "2026-07-15T12:00:00.000Z", updatedAt: "2026-07-15T12:00:00.000Z",
    };
    await store.saveMutation(mutation);
    await store.transitionMutation(mutation.requestId, "completed", { commitId: head, response: { status: "completed" }, failure: "test" });
    expect(await store.getMutation(userId, mutation.tool, mutation.idempotencyKey)).toMatchObject({ state: "completed", commitId: head, failure: "test" });
    await expect(store.transitionMutation(RequestIdSchema.parse("req_0000000000000899"), "completed")).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    const order: string[] = [];
    await Promise.all([
      store.withHouseholdLock(householdId, async () => { order.push("one"); await Promise.resolve(); }),
      store.withHouseholdLock(householdId, async () => { order.push("two"); }),
    ]);
    expect(order).toEqual(["one", "two"]);

    expect(await store.getByToken("missing")).toBeNull();
    store.addSession("one", { userId, actorId, displayName: "Owner", scopes: new Set(["journal:read"]), client: "web" });
    store.addSession("two", { userId: UserIdSchema.parse("usr_0000000000000802"), actorId: ActorIdSchema.parse("act_0000000000000802"), displayName: "Other", scopes: new Set(["journal:read"]), client: "web" });
    await store.revokeUser(userId);
    expect(await store.getByToken("one")).toBeNull();
    expect(await store.getByToken("two")).not.toBeNull();
    expect(await store.health()).toEqual({ ready: true, detail: "memory" });
  });

  it("serializes JSON deterministically and rejects every unsafe repository path shape", () => {
    expect(stableJson({ z: [2, { b: true, a: null }], a: "first" })).toBe('{\n  "a": "first",\n  "z": [\n    2,\n    {\n      "a": null,\n      "b": true\n    }\n  ]\n}\n');
    expect(() => validateRepositoryPath("valid/path.json")).not.toThrow();
    for (const path of ["", "/absolute", "trailing/", "double//slash", "../escape", "bad space", "x".repeat(501)]) {
      expect(() => validateRepositoryPath(path)).toThrow("Repository path is invalid");
    }
  });
});
