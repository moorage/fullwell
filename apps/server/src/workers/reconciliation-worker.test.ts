import { ActorIdSchema, GitObjectIdSchema, HouseholdIdSchema, RequestIdSchema, UserIdSchema } from "@hfj/contracts";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore, stableJson } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { TelemetryPort } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { markdownDocument } from "../domain/journal-validation.js";
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

  it("repairs a projected household name from the authoritative Git document", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", {
      name: "Authoritative Name",
      idempotency_key: "household-name-rebuild-0801",
    }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    await store.updateHouseholdName(householdId, "Stale Projection");

    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({
      checked: 1,
      rebuilt: 1,
      quarantined: 0,
    });
    expect((await store.getHousehold(householdId))?.name).toBe("Authoritative Name");
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

  it("rebuilds the complete meal-plan projection from Git", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const service = createService(store, repository);
    const created = await service.call("hfj_create_household", {
      name: "Meal rebuild",
      idempotency_key: "meal-rebuild-create-0801",
    }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({ household_id: z.string() }).parse(created.data).household_id);
    const constraints = await service.call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: created.repository_head,
      idempotency_key: "meal-rebuild-constraints-0801",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    }, principal);
    if (!constraints.ok) throw new Error(constraints.error.code);
    const constraintRevision = GitObjectIdSchema.parse(constraints.repository_head);
    const review = await service.call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: constraintRevision,
      idempotency_key: "meal-rebuild-review-0801",
    }, principal);
    if (!review.ok) throw new Error(review.error.code);
    const reviewEventId = z.object({ event_id: z.string() }).parse(review.data).event_id;
    const proposal = await service.call("hfj_add_meal_proposal", {
      household_id: householdId,
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: { kind: "freeform", title: "Soup" },
      servings: 4,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients need review.",
      idempotency_key: "meal-rebuild-proposal-0801",
    }, principal);
    if (!proposal.ok) throw new Error(proposal.error.code);
    const proposalId = z.object({ proposal_id: z.string() }).parse(proposal.data).proposal_id;
    const projection = await store.projection(householdId);
    projection.mealPlanningProfile = null;
    projection.mealProposals.clear();
    projection.mealPlanEvents.clear();

    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({
      checked: 1,
      rebuilt: 1,
      quarantined: 0,
    });
    const rebuilt = await store.projection(householdId);
    expect(rebuilt.mealPlanningProfile?.revision).toBe(constraintRevision);
    expect(rebuilt.mealProposals.get(proposalId)?.proposal.source).toMatchObject({ title: "Soup" });
    expect(rebuilt.mealPlanEvents.get(reviewEventId)?.event.kind).toBe("constraints_reviewed");
  });

  it("rebuilds validated delivery history from Git and quarantines malformed delivery state", async () => {
    const store = new MemoryOperationalStore();
    const repository = new MemoryHouseholdRepository();
    const created = await createService(store, repository).call("hfj_create_household", {
      name: "Delivery rebuild",
      idempotency_key: "delivery-rebuild-create-0801",
    }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const householdId = HouseholdIdSchema.parse(z.object({
      household_id: z.string(),
    }).parse(created.data).household_id);
    const head = GitObjectIdSchema.parse(created.repository_head);
    await repository.commit(householdId, head, deliveryRepositoryChanges(), {
      requestId: RequestIdSchema.parse("req_0000000000000810"),
      householdId,
      actorId: principal.actorId,
      tool: "hfj_commit_delivery_index",
      client: "test",
      summary: "delivery: recovery fixture",
      occurredAt: "2026-07-15T12:00:00.000Z",
    });

    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({
      checked: 1,
      rebuilt: 1,
      quarantined: 0,
    });
    expect((await store.projection(householdId)).items.get("itm_0000000000000810"))
      .toMatchObject({ item: { kind: "delivery_dish", dish_name: "Wintermelon boba" } });

    const rebuiltHead = await repository.head(householdId);
    await repository.commit(householdId, rebuiltHead, [{
      path: "delivery/evidence/2026/evd_0000000000000810.json",
      content: "{}",
      appendOnly: false,
    }], {
      requestId: RequestIdSchema.parse("req_0000000000000811"),
      householdId,
      actorId: principal.actorId,
      tool: "hfj_commit_delivery_index",
      client: "test",
      summary: "delivery: corrupt recovery fixture",
      occurredAt: "2026-07-15T12:01:00.000Z",
    });
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({
      checked: 1,
      rebuilt: 0,
      quarantined: 1,
    });
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

function deliveryRepositoryChanges() {
  const evidence = {
    id: "evd_0000000000000810",
    kind: "delivery_order_line",
    observed_at: "2026-07-15T12:00:00.000Z",
    evidence_date: "2026-07-14",
    date_precision: "day",
    source_type: "delivery_provider",
    source_label: "DoorDash",
    stable_locator: "delivery/line-0810",
    summary: "Wintermelon boba",
    actor_id: principal.actorId,
    limitations: [],
    schema_version: 1,
    delivery_order_line: {
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example.test",
      provider_order_locator: "private-order-0810",
      order_group_locator: "private-group-0810",
      order_date: "2026-07-14",
      completion_status: "completed",
      fulfillment_mode: "delivery",
      group_complete: true,
      declared_line_count: 1,
      line_key: "line-1",
      restaurant: {
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
        public_merchant_address: { locality: "Palo Alto", region: "CA" },
        merchant_locator: "private-merchant-0810",
      },
      dish_name: "Wintermelon boba",
      quantity: 1,
      modifiers_complete: true,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
      historical_menu_item_locator: "private-menu-0810",
      classification: { kind: "food", authored_by: "agent" },
    },
  };
  const item = {
    id: "itm_0000000000000810",
    kind: "delivery_dish",
    dish_name: "Wintermelon boba",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example.test",
    restaurant_name: "Wanpo",
    public_location_label: "Palo Alto",
    public_merchant_address: { locality: "Palo Alto", region: "CA" },
    merchant_locator: "private-merchant-0810",
    known_menu_item_locators: ["private-menu-0810"],
    known_modifier_occurrences: [{
      evidence_id: evidence.id,
      modifiers_complete: true,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
    }],
    classification: { kind: "food", authored_by: "agent" },
    evidence_ids: [evidence.id],
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
  };
  const report = {
    report_type: "delivery_index",
    assertions: [{
      row_id: "wanpo-wintermelon",
      item_ids: [item.id],
      evidence_ids: [evidence.id],
      distinct_order_count: 1,
      last_date: "2026-07-14",
    }],
    schema_version: 1,
  };
  return [
    {
      path: `delivery/evidence/2026/${evidence.id}.json`,
      content: stableJson(evidence),
      appendOnly: true,
    },
    {
      path: `delivery/items/${item.id}.md`,
      content: markdownDocument(item, "A familiar order."),
      appendOnly: false,
    },
    {
      path: "profiles/delivery.md",
      content: markdownDocument({
        providers: [{
          provider_label: "DoorDash",
          provider_origin: "https://delivery.example.test",
          history_start: "2026-01-01",
          history_end: "2026-07-15",
          completed_history_cursor: {
            completed_order_date: "2026-07-14",
            provider_order_locator: "private-order-0810",
          },
        }],
        interpretation_preferences: [],
        schema_version: 1,
      }, "Private provider setup."),
      appendOnly: false,
    },
    {
      path: "delivery/reports/delivery-index.md",
      content: markdownDocument(report, "# Delivery"),
      appendOnly: false,
    },
  ];
}
