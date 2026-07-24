import {
  ActorIdSchema,
  HouseholdIdSchema,
  UserIdSchema,
  type GitObjectId,
} from "@hfj/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, NoopTelemetry } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { MutationRunner } from "./mutation-runner.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000901");
const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000901"),
  actorId: ActorIdSchema.parse("act_0000000000000901"),
  displayName: "Meal Planner",
  scopes: new Set(["journal:write"]),
  client: "test",
};

describe("MutationRunner", () => {
  let store: MemoryOperationalStore;
  let repository: MemoryHouseholdRepository;
  let runner: MutationRunner;
  let initialHead: GitObjectId;

  beforeEach(async () => {
    store = new MemoryOperationalStore();
    repository = new MemoryHouseholdRepository();
    initialHead = await repository.provision(householdId, "Meal Plan", principal.actorId, "2026-07-20T16:00:00.000Z");
    await store.createHousehold(
      {
        id: householdId,
        name: "Meal Plan",
        repositoryHead: initialHead,
        provisioningState: "ready",
        createdAt: "2026-07-20T16:00:00.000Z",
      },
      {
        householdId,
        userId: principal.userId,
        actorId: principal.actorId,
        role: "owner",
        projectionHead: initialHead,
        removedAt: null,
      },
    );
    runner = new MutationRunner(
      store,
      repository,
      new FixedClock(new Date("2026-07-20T16:00:00.000Z")),
      new DeterministicRandomSource(),
      new NoopTelemetry(),
    );
  });

  function appendOptions(idempotencyKey: string, fingerprint = idempotencyKey) {
    return {
      principal,
      tool: "hfj_append_evidence" as const,
      householdId,
      idempotencyKey,
      requestFingerprint: fingerprint,
      conflictPolicy: "append_to_current_head" as const,
      minimumRole: "editor" as const,
      requiredScope: "journal:write" as const,
      summary: "meal-plans: append proposal",
      buildChanges: async (requestId: string) => [{
        path: `meal-plans/2026-07-20/proposals/${requestId}.json`,
        content: JSON.stringify({ request_id: requestId }),
        appendOnly: true,
      }],
      applyProjection: async (_commitId: GitObjectId, requestId: string) => ({
        status: "completed",
        request_id: requestId,
      }),
    };
  }

  it("fans concurrent exact-key calls into one durable mutation and one commit", async () => {
    const [first, second] = await Promise.all([
      runner.run(appendOptions("same-append-0901")),
      runner.run(appendOptions("same-append-0901")),
    ]);

    expect(second).toEqual(first);
    expect(repository.commitCount(householdId)).toBe(1);
    expect((await store.getMutation(principal.userId, "hfj_append_evidence", "same-append-0901"))?.requestId).toBe(first.requestId);
  });

  it("rejects changed semantic input for an append idempotency key", async () => {
    await runner.run(appendOptions("changed-append-0901", "first-fingerprint"));

    await expect(runner.run(appendOptions("changed-append-0901", "second-fingerprint")))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(repository.commitCount(householdId)).toBe(1);
  });

  it("serializes unique current-head appends without dropping either path", async () => {
    const [first, second] = await Promise.all([
      runner.run(appendOptions("unique-append-0901")),
      runner.run(appendOptions("unique-append-0902")),
    ]);
    const snapshot = await repository.snapshot(householdId);

    expect(first.head).not.toBe(second.head);
    expect(snapshot.files.filter((file) => file.path.startsWith("meal-plans/"))).toHaveLength(2);
    expect(repository.commitCount(householdId)).toBe(2);
  });

  it("keeps strict expected-head conflicts unchanged", async () => {
    await runner.run(appendOptions("advance-head-0901"));

    await expect(runner.run({
      ...appendOptions("strict-write-0901"),
      conflictPolicy: "strict_expected_head",
      expectedHead: initialHead,
    })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("rejects mutable or multi-file changes under the current-head append policy", async () => {
    await expect(runner.run({
      ...appendOptions("mutable-append-0901"),
      buildChanges: async () => [{
        path: "profiles/meal-planning.md",
        content: "# Changed",
        appendOnly: false,
      }],
    })).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
