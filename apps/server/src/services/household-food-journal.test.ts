import { z } from "zod";
import {
  ActorIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ItemIdSchema,
  OnboardingStatusSchema,
  UserIdSchema,
  type GitObjectId,
  type HouseholdId,
  type ToolName,
} from "@hfj/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { JsonValue, Principal } from "../core/types.js";
import { HouseholdFoodJournalService } from "./household-food-journal.js";

const owner: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000201"),
  actorId: ActorIdSchema.parse("act_0000000000000201"),
  displayName: "Kitchen Owner",
  scopes: new Set(["journal:read", "journal:write", "household:manage", "collection:share", "journal:export"]),
  client: "test",
};
const member: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000202"),
  actorId: ActorIdSchema.parse("act_0000000000000202"),
  displayName: "Kitchen Member",
  scopes: owner.scopes,
  client: "test",
};
const objectDataSchema = z.record(z.string(), z.json());

describe("HouseholdFoodJournalService", () => {
  let store: MemoryOperationalStore;
  let repository: MemoryHouseholdRepository;
  let service: HouseholdFoodJournalService;

  beforeEach(() => {
    store = new MemoryOperationalStore();
    repository = new MemoryHouseholdRepository();
    service = new HouseholdFoodJournalService(
      store,
      repository,
      new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      new DeterministicRandomSource(),
      new HmacTokenHasher("journal-service-test-pepper"),
      new NoopTelemetry(),
      new URL("https://journal.example.test"),
    );
  });

  async function call(name: ToolName, input: unknown, principal: Principal = owner): Promise<{ data: Record<string, JsonValue>; head: string }> {
    const envelope = await service.call(name, input, principal);
    if (!envelope.ok) throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
    return {
      data: objectDataSchema.parse(envelope.data),
      head: GitObjectIdSchema.parse(envelope.repository_head),
    };
  }

  it("runs the household, journal, collection, import, and export lifecycle", async () => {
    const created = await call("hfj_create_household", { name: "Our Kitchen", idempotency_key: "household-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    let head = created.head;

    const replay = await call("hfj_create_household", { name: "Ignored replay name", idempotency_key: "household-create-0201" });
    expect(replay).toEqual(created);
    expect((await call("hfj_get_context", {})).data.households).toHaveLength(1);
    expect((await call("hfj_get_context", { household_id: householdId })).data.default_household_id).toBe(householdId);
    expect((await call("hfj_select_household", { household_id: householdId })).data.status).toBe("completed");

    const invite = await call("hfj_create_family_invite", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "invite-create-0201",
      role: "editor",
      intended_email_hint: "member@example.test",
      expires_in_days: 7,
    });
    head = invite.head;
    const inviteUrl = z.url().parse(invite.data.url);
    const inviteToken = new URL(inviteUrl).pathname.split("/").at(-1);
    expect(inviteToken).toBeTruthy();
    const accepted = await call("hfj_accept_family_invite", {
      token: inviteToken,
      accept: true,
      idempotency_key: "invite-accept-0201",
    }, member);
    head = accepted.head;
    expect((await call("hfj_list_members", { household_id: householdId })).data.members).toHaveLength(2);

    const demoted = await call("hfj_update_member", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "member-update-0201",
      member_actor_id: member.actorId,
      role: "viewer",
    });
    head = demoted.head;
    const promoted = await call("hfj_update_member", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "member-update-0202",
      member_actor_id: member.actorId,
      role: "editor",
    });
    head = promoted.head;

    const profile = await call("hfj_update_profile", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "profile-update-0201",
      profile: "snacks",
      markdown: "# Favorite shops",
    });
    head = profile.head;
    expect(await call("hfj_update_profile", {
      household_id: householdId,
      expected_head: profile.head,
      idempotency_key: "profile-update-0201",
      profile: "snacks",
      markdown: "ignored replay",
    })).toEqual(profile);
    expect((await call("hfj_get_profile", { household_id: householdId, profile: "snacks" })).data.markdown).toBe("# Favorite shops");
    expect((await call("hfj_get_profile", { household_id: householdId, profile: "recipes" })).data.revision).toBeNull();

    const purchaseId = "evd_0000000000000201";
    const discoveryId = "evd_0000000000000202";
    const cookingId = "evd_0000000000000203";
    const confirmationId = "evd_0000000000000204";
    const evidence = await call("hfj_append_evidence", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "evidence-append-0201",
      evidence: [
        {
          id: purchaseId, kind: "purchase", observed_at: "2026-07-15T10:00:00.000Z", evidence_date: "2026-07-15", date_precision: "day",
          source_type: "receipt", source_label: "Market receipt", stable_locator: "order-0201", summary: "Bought apples", actor_id: owner.actorId,
          limitations: [], schema_version: 1, purchase: { store: "Market", order_reference: "0201", line_item_title: "Apples", order_date: "2026-07-15" },
        },
        {
          id: discoveryId, kind: "recipe_discovery", observed_at: "2026-07-15T10:01:00.000Z", evidence_date: "2026-07-15", date_precision: "day",
          source_type: "web", source_label: "Recipe page", stable_locator: "https://example.test/soup", summary: "Saved soup", actor_id: owner.actorId,
          limitations: [], schema_version: 1, recipe_discovery: { canonical_recipe_url: "https://example.test/soup", audited_page_url: "https://example.test/soup", author_or_publisher: "Test Kitchen", source_scope: "saved" },
        },
        {
          id: cookingId, kind: "cooking", observed_at: "2026-07-15T10:02:00.000Z", evidence_date: "2026-07-15", date_precision: "day",
          source_type: "journal", source_label: "Cooking note", stable_locator: "cook-0201", summary: "Cooked soup", actor_id: owner.actorId,
          limitations: [], schema_version: 1, cooking: { recipe_candidate: "Tomato soup", cooked_on: "2026-07-15", result: "Good", changes: [] },
        },
        {
          id: confirmationId, kind: "user_confirmation", observed_at: "2026-07-15T10:03:00.000Z", evidence_date: "2026-07-15", date_precision: "day",
          source_type: "conversation", source_label: "Owner", stable_locator: "confirmation-0201", summary: "Liked soup", actor_id: owner.actorId,
          limitations: [], schema_version: 1,
        },
      ],
    });
    head = evidence.head;

    const snackId = ItemIdSchema.parse("itm_0000000000000201");
    const recipeId = ItemIdSchema.parse("itm_0000000000000202");
    const changeSet = await call("hfj_commit_change_set", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "change-set-0201",
      items: [
        {
          id: snackId, kind: "snack", display_name: "Honeycrisp apple", brand: null, product_line: null, flavor: null, formulation: null, format: "fresh",
          category: "fruit", produce_variety: "Honeycrisp", known_size_variants: [], image_page_url: null, image_url: null,
          evidence_ids: [purchaseId], created_at: "2026-07-15T12:00:00.000Z", updated_at: "2026-07-15T12:00:00.000Z", schema_version: 1, body_markdown: "Crisp and sweet.",
        },
        {
          id: recipeId, kind: "recipe", title: "Tomato soup", canonical_url: "https://example.test/soup", audited_page_url: "https://example.test/soup",
          author_or_publisher: "Test Kitchen", saved: "yes", cooked: "yes", liked: "yes", last_cooked: "2026-07-15", date_precision: "day", image_url: null, image_page_url: null,
          evidence_ids: [discoveryId, cookingId, confirmationId], created_at: "2026-07-15T12:00:00.000Z", updated_at: "2026-07-15T12:00:00.000Z", schema_version: 1, body_markdown: "Serve warm.",
        },
      ],
      reports: [{
        report_type: "recurring_snacks", markdown: "# Recurring snacks", schema_version: 1,
        assertions: [{ row_id: "apple", item_ids: [snackId], evidence_ids: [purchaseId], distinct_order_count: 1, last_date: "2026-07-15" }],
      }],
      expected_item_revisions: {},
    });
    head = changeSet.head;
    expect((await call("hfj_search_items", { household_id: householdId, query: "apple", kind: "snack", limit: 10 })).data.items).toHaveLength(1);
    expect((await call("hfj_search_items", { household_id: householdId, query: "example.test", kind: "recipe", limit: 10 })).data.items).toHaveLength(1);
    expect((await call("hfj_get_item", { household_id: householdId, item_id: recipeId })).data.revision).toBe(changeSet.head);

    const collection = await call("hfj_create_collection", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "collection-create-0201",
      title: "Weeknight picks",
      items: [
        collectionItem("collection-item-0201", snackId, "snack", "Honeycrisp apple", changeSet.head),
        collectionItem("collection-item-0202", recipeId, "recipe", "Tomato soup", changeSet.head),
        collectionItem("collection-item-0203", snackId, "snack", "Honeycrisp apple", changeSet.head),
      ],
    });
    head = collection.head;
    const collectionId = z.string().parse(collection.data.collection_id);
    const shared = await call("hfj_create_collection_share", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "share-create-0201",
      collection_id: collectionId,
      expires_in_days: 30,
    });
    head = shared.head;
    const shareUrl = z.url().parse(shared.data.url);
    const shareToken = z.string().min(43).parse(new URL(shareUrl).pathname.split("/").at(-1));
    expect((await service.preview(shareToken)).ok).toBe(true);
    const directPreview = await service.call("hfj_preview_shared_collection", { token: shareToken }, owner);
    expect(directPreview.ok).toBe(true);
    if (directPreview.ok) expect(objectDataSchema.parse(directPreview.data).snapshot).toBeDefined();
    const plan = await call("hfj_plan_collection_import", {
      token: shareToken,
      destination_household_id: householdId,
      selected_collection_item_ids: ["collection-item-0201", "collection-item-0202"],
    });
    expect(plan.data.items).toHaveLength(2);

    const imported = await call("hfj_import_collection_items", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "import-0201",
      token: shareToken,
      selections: [
        { collection_item_id: "collection-item-0201", resolution: { action: "create_separate" } },
        { collection_item_id: "collection-item-0202", resolution: { action: "merge", destination_item_id: recipeId } },
        { collection_item_id: "collection-item-0203", resolution: { action: "skip" } },
      ],
    });
    head = imported.head;
    expect(imported.data.skipped_count).toBe(1);

    const bundle = await call("hfj_export_household", { household_id: householdId, format: "git_bundle", idempotency_key: "export-0201" });
    expect(z.url().parse(bundle.data.download_url)).toContain("/exports/");
    expect(z.string().regex(/^[0-9a-f]{64}$/).parse(bundle.data.content_hash)).toBeTruthy();
    expect(bundle.data.source_head).toBe(head);
    expect(await call("hfj_export_household", { household_id: householdId, format: "git_bundle", idempotency_key: "export-0201" })).toEqual(bundle);
    const changedExport = await service.call("hfj_export_household", { household_id: householdId, format: "readable_zip", idempotency_key: "export-0201" }, owner);
    expect(changedExport.ok).toBe(false);
    if (!changedExport.ok) expect(changedExport.error.code).toBe("REVISION_CONFLICT");

    const revoked = await call("hfj_revoke_collection_share", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "share-revoke-0201",
      collection_id: collectionId,
      confirm: true,
    });
    head = revoked.head;
    const revokedPreview = await service.preview(shareToken);
    expect(revokedPreview.ok).toBe(false);
    if (!revokedPreview.ok) expect(revokedPreview.error.code).toBe("SHARE_REVOKED");

    const removed = await call("hfj_remove_member", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "member-remove-0201",
      member_actor_id: member.actorId,
      confirm: true,
    });
    expect(removed.data.actor_id).toBe(member.actorId);
  });

  it("maps validation, authorization, conflict, and internal failures to stable envelopes", async () => {
    const invalid = await service.call("hfj_create_household", { name: "" }, owner);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toMatchObject({ code: "VALIDATION_FAILED", retryable: false });

    const readOnly: Principal = { ...owner, scopes: new Set(["journal:read"]) };
    const forbidden = await service.call("hfj_create_household", { name: "Nope", idempotency_key: "forbidden-create-0201" }, readOnly);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe("FORBIDDEN");

    const created = await call("hfj_create_household", { name: "Errors", idempotency_key: "errors-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const missing = await service.call("hfj_get_item", { household_id: householdId, item_id: "itm_0000000000000999" }, owner);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");

    const finalOwner = await service.call("hfj_remove_member", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "owner-remove-0201",
      member_actor_id: owner.actorId,
      confirm: true,
    }, owner);
    expect(finalOwner.ok).toBe(false);
    if (!finalOwner.ok) expect(finalOwner.error.code).toBe("VALIDATION_FAILED");

    const stale = await service.call("hfj_update_profile", {
      household_id: householdId,
      expected_head: "f".repeat(40),
      idempotency_key: "stale-profile-0201",
      profile: "household",
      markdown: "# Stale",
    }, owner);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("REVISION_CONFLICT");

    const failingService = new HouseholdFoodJournalService(
      store,
      new FailingProvisionRepository(),
      new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      new DeterministicRandomSource(),
      new HmacTokenHasher("journal-service-test-pepper"),
      new NoopTelemetry(),
      new URL("https://journal.example.test"),
    );
    const internal = await failingService.call("hfj_create_household", { name: "Failure", idempotency_key: "internal-create-0201" }, owner);
    expect(internal.ok).toBe(false);
    if (!internal.ok) expect(internal.error.code).toBe("INTERNAL_ERROR");
  });

  it("persists per-user onboarding while deriving household completion from reports", async () => {
    const created = await call("hfj_create_household", { name: "Onboarding", idempotency_key: "onboarding-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const initial = OnboardingStatusSchema.parse((await call("hfj_get_context", { household_id: householdId })).data.onboarding);
    expect(initial).toMatchObject({
      household_id: householdId,
      snacks: { status: "not_started", revision: 0 },
      recipes: { status: "not_started", revision: 0 },
    });

    const startInput = {
      household_id: householdId,
      section: "snacks" as const,
      transition: { action: "start" as const },
      expected_revision: 0,
      idempotency_key: "onboarding-start-0201",
    };
    const started = await call("hfj_update_onboarding", startInput);
    expect(started.data.section_state).toEqual({ status: "in_progress", revision: 1 });
    expect(await call("hfj_update_onboarding", startInput)).toEqual(started);

    const changedReplay = await service.call("hfj_update_onboarding", {
      ...startInput,
      section: "recipes",
    }, owner);
    expect(changedReplay).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });

    const stale = await service.call("hfj_update_onboarding", {
      household_id: householdId,
      section: "snacks",
      transition: { action: "skip", reason: "not_now" },
      expected_revision: 0,
      idempotency_key: "onboarding-stale-0201",
    }, owner);
    expect(stale).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });

    await call("hfj_update_onboarding", {
      household_id: householdId,
      section: "snacks",
      transition: { action: "skip", reason: "no_sources" },
      expected_revision: 1,
      idempotency_key: "onboarding-skip-0201",
    });
    expect(OnboardingStatusSchema.parse((await call("hfj_get_context", { household_id: householdId })).data.onboarding).snacks)
      .toEqual({ status: "skipped", revision: 2, reason: "no_sources" });

    const resumed = await call("hfj_update_onboarding", {
      household_id: householdId,
      section: "snacks",
      transition: { action: "resume" },
      expected_revision: 2,
      idempotency_key: "onboarding-resume-0201",
    });
    expect(resumed.data.section_state).toEqual({ status: "in_progress", revision: 3 });
    await call("hfj_update_onboarding", {
      household_id: householdId,
      section: "snacks",
      transition: { action: "skip", reason: "no_sources" },
      expected_revision: 3,
      idempotency_key: "onboarding-reskip-0201",
    });

    await store.upsertMembership({
      householdId,
      userId: member.userId,
      actorId: member.actorId,
      role: "editor",
      projectionHead: GitObjectIdSchema.parse(created.head),
      removedAt: null,
    });
    const memberBeforeReport = OnboardingStatusSchema.parse((await call("hfj_get_context", { household_id: householdId }, member)).data.onboarding);
    expect(memberBeforeReport.snacks).toEqual({ status: "not_started", revision: 0 });

    const report = await call("hfj_commit_change_set", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-report-0201",
      items: [],
      reports: [{ report_type: "recurring_snacks", markdown: "# No recurring snacks", assertions: [], schema_version: 1 }],
      expected_item_revisions: {},
    });
    for (const principal of [owner, member]) {
      const status = OnboardingStatusSchema.parse((await call("hfj_get_context", { household_id: householdId }, principal)).data.onboarding);
      expect(status.snacks.status).toBe("complete");
    }

    const completedMutation = await service.call("hfj_update_onboarding", {
      household_id: householdId,
      section: "snacks",
      transition: { action: "resume" },
      expected_revision: 4,
      idempotency_key: "onboarding-complete-0201",
    }, owner);
    expect(completedMutation).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });

    await store.upsertMembership({
      householdId,
      userId: member.userId,
      actorId: member.actorId,
      role: "viewer",
      projectionHead: GitObjectIdSchema.parse(report.head),
      removedAt: null,
    });
    const viewerMutation = await service.call("hfj_update_onboarding", {
      household_id: householdId,
      section: "recipes",
      transition: { action: "start" },
      expected_revision: 0,
      idempotency_key: "onboarding-viewer-0201",
    }, member);
    expect(viewerMutation).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    const other = await call("hfj_create_household", { name: "Other", idempotency_key: "onboarding-create-0202" });
    const substituted = await service.call("hfj_get_context", { household_id: other.data.household_id }, member);
    expect(substituted).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("replays a committed request after projection failure without a second Git commit", async () => {
    const created = await call("hfj_create_household", { name: "Recovery", idempotency_key: "recovery-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const loadProjection = store.projection.bind(store);
    let failProjection = true;
    store.projection = async (id) => {
      if (failProjection) {
        failProjection = false;
        throw new Error("simulated projection outage");
      }
      return await loadProjection(id);
    };
    const input = {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "recovery-profile-0201",
      profile: "household",
      markdown: "# Recovered",
    };

    const failed = await service.call("hfj_update_profile", input, owner);
    expect(failed).toMatchObject({ ok: false, error: { code: "RECONCILIATION_REQUIRED" } });
    const durable = await store.getMutation(owner.userId, "hfj_update_profile", input.idempotency_key);
    expect(durable).toMatchObject({ state: "reconciliation_required" });
    expect(durable?.commitId).not.toBeNull();
    expect(repository.commitCount(householdId)).toBe(1);

    const changedRetry = await service.call("hfj_update_profile", { ...input, markdown: "# Different" }, owner);
    expect(changedRetry).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });

    const recovered = await call("hfj_update_profile", input);
    expect(recovered.data).toMatchObject({ status: "completed", profile: "household" });
    expect(recovered.head).toBe(durable?.commitId);
    expect(repository.commitCount(householdId)).toBe(1);
  });

  it("reuses the provisioned repository when database creation initially fails", async () => {
    const createHousehold = store.createHousehold.bind(store);
    let failCreation = true;
    store.createHousehold = async (record, membership) => {
      if (failCreation) {
        failCreation = false;
        throw new Error("simulated database outage");
      }
      await createHousehold(record, membership);
    };
    const input = { name: "Provision retry", idempotency_key: "provision-retry-0201" };

    const failed = await service.call("hfj_create_household", input, owner);
    expect(failed).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    const durable = await store.getMutation(owner.userId, "hfj_create_household", input.idempotency_key);
    expect(durable).toMatchObject({ state: "reconciliation_required" });
    expect(durable?.commitId).not.toBeNull();

    const recovered = await call("hfj_create_household", input);
    expect(recovered.data).toMatchObject({ status: "completed", onboarding_state: "ready" });
    expect(recovered.head).toBe(durable?.commitId);
    expect(await store.listHouseholds()).toHaveLength(1);
  });
});

class FailingProvisionRepository extends MemoryHouseholdRepository {
  override async provision(_householdId: HouseholdId, _name: string, _actorId: string, _occurredAt: string): Promise<GitObjectId> {
    throw new Error("repository failure");
  }
}

function collectionItem(collectionItemId: string, sourceItemId: string, kind: "recipe" | "snack", title: string, revision: string): Record<string, JsonValue> {
  return {
    collection_item_id: collectionItemId,
    source_item_id: sourceItemId,
    kind,
    title,
    public_description: null,
    brand: kind === "snack" ? null : null,
    flavor: null,
    formulation: null,
    format: kind === "snack" ? "fresh" : null,
    author_or_publisher: kind === "recipe" ? "Test Kitchen" : null,
    canonical_recipe_url: kind === "recipe" ? "https://example.test/soup" : null,
    image_url: null,
    image_page_url: kind === "recipe" ? "https://example.test/soup" : null,
    preparation_notes: null,
    source_display_attribution: "Kitchen Owner",
    source_item_revision: revision,
  };
}
