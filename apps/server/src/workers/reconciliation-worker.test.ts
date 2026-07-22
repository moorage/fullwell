import { ActorIdSchema, GitObjectIdSchema, HouseholdIdSchema, RequestIdSchema, UserIdSchema } from "@hfj/contracts";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { TelemetryPort } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { ReconciliationWorker } from "./reconciliation-worker.js";

const principal: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000801"),
  actorId: ActorIdSchema.parse("act_0000000000000801"),
  displayName: "Recovery Owner",
  scopes: new Set(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
  client: "test",
};

describe("ReconciliationWorker", () => {
  it("emits a blocked event only when the operational store is unhealthy", async () => {
    const event = vi.fn<TelemetryPort["event"]>();
    const telemetry: TelemetryPort = { event, error: vi.fn<TelemetryPort["error"]>() };
    const repository = new MemoryHouseholdRepository();
    await new ReconciliationWorker(new MemoryOperationalStore(), repository, telemetry).checkHealth();
    expect(event).not.toHaveBeenCalled();

    const store = new MemoryOperationalStore();
    store.health = async () => ({ ready: false, detail: "database unavailable" });
    const worker = new ReconciliationWorker(store, repository, telemetry);
    await worker.checkHealth();
    expect(event).toHaveBeenCalledWith("reconciliation.blocked", { reason: "database unavailable" });
    expect(await worker.run()).toEqual({ checked: 0, rebuilt: 0, quarantined: 0 });
  });

  it("rebuilds a failed projection from Git and leaves the request replayable", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = createService(store, repository);
    const created = await service.call("hfj_create_household", { name: "Recovery", idempotency_key: "reconcile-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const expectedHead = GitObjectIdSchema.parse(created.repository_head);
    const loadProjection = store.projection.bind(store);
    let failProjection = true;
    store.projection = async (id) => {
      if (failProjection) {
        failProjection = false;
        throw new Error("simulated projection outage");
      }
      return await loadProjection(id);
    };
    const input = { household_id: householdId, expected_head: expectedHead, idempotency_key: "reconcile-profile-0801", profile: "household", markdown: "# Git authority" };
    const failed = await service.call("hfj_update_profile", input, principal);
    expect(failed).toMatchObject({ ok: false, error: { code: "RECONCILIATION_REQUIRED" } });

    const result = await new ReconciliationWorker(store, repository, new NoopTelemetry()).run();
    expect(result).toEqual({ checked: 1, rebuilt: 1, quarantined: 0 });
    expect((await store.projection(householdId)).profiles.get("household")?.markdown).toBe("# Git authority");
    expect((await store.getMutation(principal.userId, "hfj_update_profile", input.idempotency_key))?.state).toBe("projections_applied");

    const replay = await service.call("hfj_update_profile", input, principal);
    expect(replay).toMatchObject({ ok: true, data: { profile: "household", status: "completed" } });
    expect(repository.commitCount(householdId)).toBe(1);
  });

  it("recovers deferred onboarding skips after the canonical Git commit", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = createService(store, repository);
    const created = await service.call("hfj_create_household", { name: "Onboarding recovery", idempotency_key: "reconcile-onboarding-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const compareAndSet = store.compareAndSetOnboarding.bind(store);
    let failSkip = true;
    store.compareAndSetOnboarding = async (record, expectedRevision) => {
      if (failSkip) {
        failSkip = false;
        return false;
      }
      return await compareAndSet(record, expectedRevision);
    };
    const input = {
      household_id: householdId,
      expected_head: created.repository_head,
      idempotency_key: "reconcile-onboarding-commit-0801",
      sections: [
        { section: "snacks" as const, outcome: "complete" as const, expected_revision: 0 },
        { section: "recipes" as const, outcome: "skip" as const, reason: "not_now" as const, expected_revision: 0 },
      ],
      reports: [{ report_type: "recurring_snacks" as const, markdown: "# No recurring snacks", assertions: [], schema_version: 1 }],
    };
    expect(await service.call("hfj_commit_onboarding", input, principal)).toMatchObject({
      ok: false,
      error: { code: "RECONCILIATION_REQUIRED" },
    });

    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 1, quarantined: 0 });
    expect((await store.listOnboardingRecords(principal.userId, householdId))[0]).toMatchObject({
      section: "recipes",
      status: "skipped",
      skip_reason: "not_now",
      revision: 1,
    });
    expect((await store.getMutation(principal.userId, "hfj_commit_onboarding", input.idempotency_key))?.state).toBe("projections_applied");
    expect(await service.call("hfj_commit_onboarding", input, principal)).toMatchObject({
      ok: true,
      data: { onboarding: { snacks: { status: "complete" }, recipes: { status: "skipped" } } },
    });
    expect(repository.commitCount(householdId)).toBe(1);
  });

  it("leaves a synchronized household unchanged", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", { name: "Current", idempotency_key: "unchanged-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 0, quarantined: 0 });
  });

  it("marks an abandoned pre-commit request as failed", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", { name: "Abandoned", idempotency_key: "abandoned-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const requestId = RequestIdSchema.parse("req_0000000000000803");
    await store.saveMutation({
      requestId,
      userId: principal.userId,
      tool: "hfj_update_profile",
      idempotencyKey: "abandoned-profile-0801",
      householdId,
      state: "received",
      commitId: null,
      response: null,
      failure: null,
      createdAt: "2026-07-15T12:00:00.000Z",
      updatedAt: "2026-07-15T12:00:00.000Z",
    });
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 0, quarantined: 0 });
    expect((await store.getMutation(principal.userId, "hfj_update_profile", "abandoned-profile-0801"))?.state).toBe("failed_before_commit");
  });

  it("repairs projection content drift even when repository heads match", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = createService(store, repository);
    const created = await service.call("hfj_create_household", { name: "Content drift", idempotency_key: "content-drift-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const updated = await service.call("hfj_update_profile", {
      household_id: householdId,
      expected_head: created.repository_head,
      idempotency_key: "content-drift-profile-0801",
      profile: "household",
      markdown: "# Authoritative",
    }, principal);
    if (!updated.ok) throw new Error(updated.error.code);
    (await store.projection(householdId)).profiles.clear();

    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 1, quarantined: 0 });
    expect((await store.projection(householdId)).profiles.get("household")?.markdown).toBe("# Authoritative");
  });

  it("quarantines a database membership that has no Git authority", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", { name: "Drift", idempotency_key: "drift-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const head = GitObjectIdSchema.parse(created.repository_head);
    await store.upsertMembership({
      householdId,
      userId: UserIdSchema.parse("usr_0000000000000802"),
      actorId: ActorIdSchema.parse("act_0000000000000802"),
      role: "viewer",
      projectionHead: head,
      removedAt: null,
    });
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 0, quarantined: 1 });
  });

  it("quarantines a Git member without a private identity mapping", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", { name: "Unknown member", idempotency_key: "unknown-member-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const head = GitObjectIdSchema.parse(created.repository_head);
    const unknownActorId = ActorIdSchema.parse("act_0000000000000804");
    await repository.commit(householdId, head, [{ path: `members/${unknownActorId}.md`, content: `---\nactor_id: "${unknownActorId}"\nrole: "viewer"\nschema_version: 1\n---\n`, appendOnly: false }], {
      requestId: RequestIdSchema.parse("req_0000000000000804"),
      householdId,
      actorId: unknownActorId,
      tool: "hfj_accept_family_invite",
      client: "test",
      summary: "members: unknown fixture",
      occurredAt: "2026-07-15T12:00:00.000Z",
    });
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({ checked: 1, rebuilt: 0, quarantined: 1 });
  });

  it("quarantines a household when authoritative documents cannot be projected", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = createService(store, repository);
    const created = await service.call("hfj_create_household", { name: "Unsafe", idempotency_key: "quarantine-create-0801" }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const head = GitObjectIdSchema.parse(created.repository_head);
    await repository.commit(householdId, head, [{ path: `members/${principal.actorId}.md`, content: "not frontmatter\n", appendOnly: false }], {
      requestId: RequestIdSchema.parse("req_0000000000000801"),
      householdId,
      actorId: principal.actorId,
      tool: "hfj_update_member",
      client: "test",
      summary: "members: corrupt fixture",
      occurredAt: "2026-07-15T12:00:00.000Z",
    });
    const result = await new ReconciliationWorker(store, repository, new NoopTelemetry()).run();
    expect(result).toEqual({ checked: 1, rebuilt: 0, quarantined: 1 });
    expect((await store.getHousehold(householdId))?.provisioningState).toBe("quarantined");
  });
});

function createService(store: MemoryOperationalStore, repository: MemoryHouseholdRepository): HouseholdFoodJournalService {
  return new HouseholdFoodJournalService(
    store,
    repository,
    new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
    new DeterministicRandomSource(),
    new HmacTokenHasher("reconciliation-worker-test-pepper"),
    new NoopTelemetry(),
    new URL("https://journal.example.test"),
  );
}
