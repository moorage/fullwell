import { z } from "zod";
import {
  ActorIdSchema,
  CollectionSnapshotSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ItemIdSchema,
  JournalItemSchema,
  MEAL_PLAN_MAX_EVENTS_PER_WEEK,
  MEAL_PLAN_MAX_PROPOSALS_PER_SLOT,
  MEAL_PLAN_MAX_PROPOSALS_PER_WEEK,
  MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK,
  MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK,
  MealPlanEventSchema,
  MealProposalSchema,
  ONBOARDING_COMMIT_MAX_EVIDENCE,
  ONBOARDING_COMMIT_MAX_ITEMS,
  OnboardingStatusSchema,
  ShareIdSchema,
  UserIdSchema,
  type GitObjectId,
  type HouseholdId,
  type ToolName,
} from "@hfj/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { JsonValue, Principal } from "../core/types.js";
import { rebuildRepositoryState } from "../domain/repository-projection.js";
import { ReconciliationWorker } from "../workers/reconciliation-worker.js";
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
const outsider: Principal = {
  userId: UserIdSchema.parse("usr_0000000000000203"),
  actorId: ActorIdSchema.parse("act_0000000000000203"),
  displayName: "Other Household",
  scopes: owner.scopes,
  client: "test",
};
const objectDataSchema = z.record(z.string(), z.json());

describe("HouseholdFoodJournalService", () => {
  let store: MemoryOperationalStore;
  let repository: MemoryHouseholdRepository;
  let service: HouseholdFoodJournalService;
  let cloudDisplayName: string;

  beforeEach(() => {
    store = new MemoryOperationalStore();
    repository = new MemoryHouseholdRepository();
    cloudDisplayName = owner.displayName;
    service = new HouseholdFoodJournalService(
      store,
      repository,
      new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      new DeterministicRandomSource(),
      new HmacTokenHasher("journal-service-test-pepper"),
      new NoopTelemetry(),
      new URL("https://journal.example.test"),
      undefined,
      {
        updateUserDisplayName: async (userId, displayName) => {
          if (userId !== owner.userId) return null;
          cloudDisplayName = displayName;
          return { displayName };
        },
      },
    );
  });

  it("returns an empty onboarding context before a household exists", async () => {
    expect(await service.call("hfj_get_context", {}, owner)).toMatchObject({
      ok: true,
      data: {
        user: { id: owner.userId, actor_id: owner.actorId, display_name: owner.displayName },
        households: [],
        default_household_id: null,
        onboarding: null,
        onboarding_snapshot: null,
      },
      repository_head: null,
    });
  });

  it("updates the cloud member display name idempotently without requiring a household", async () => {
    const input = { display_name: "Taylor", idempotency_key: "member-name-update-0201" };
    const renamed = await service.call("hfj_update_user_display_name", input, owner);
    expect(renamed).toMatchObject({
      ok: true,
      data: { status: "completed", display_name: "Taylor" },
      repository_head: null,
    });
    expect(cloudDisplayName).toBe("Taylor");
    expect(await service.call("hfj_update_user_display_name", input, owner)).toEqual(renamed);
    expect(await service.call("hfj_update_user_display_name", {
      display_name: "Morgan",
      idempotency_key: input.idempotency_key,
    }, owner)).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT" },
    });
  });

  it("renames a household through Git and restricts the change to owners", async () => {
    const created = await call("hfj_create_household", {
      name: "Taylor's Household",
      idempotency_key: "household-create-name-0201",
    });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const renamed = await call("hfj_update_household_name", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "household-name-update-0201",
      name: "Garden Table",
    });
    expect(renamed.data).toMatchObject({ status: "completed", name: "Garden Table" });
    expect((await call("hfj_get_context", { household_id: householdId })).data.households).toEqual([
      expect.objectContaining({ id: householdId, name: "Garden Table" }),
    ]);
    expect(await repository.read(householdId, "household.md")).toContain('name: "Garden Table"');

    await store.upsertMembership({
      householdId,
      userId: member.userId,
      actorId: member.actorId,
      role: "editor",
      projectionHead: GitObjectIdSchema.parse(renamed.head),
      removedAt: null,
    });
    expect(await service.call("hfj_update_household_name", {
      household_id: householdId,
      expected_head: renamed.head,
      idempotency_key: "household-name-update-0202",
      name: "Bypassed Name",
    }, member)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
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
    expect((await call("hfj_get_context", { household_id: householdId }, member)).data.user).toEqual({
      id: member.userId,
      actor_id: member.actorId,
      display_name: member.displayName,
    });

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
    const snackId = ItemIdSchema.parse("itm_0000000000000201");
    const recipeId = ItemIdSchema.parse("itm_0000000000000202");
    const journalEvidence = [
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
        confirmation: { subject: "recipe_preference", recipe_item_id: recipeId, preference: "liked" },
      },
    ];

    const changeSetInput = {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "change-set-0201",
      evidence: journalEvidence,
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
    };
    const commitsBeforeJournalChange = repository.commitCount(householdId);
    expect(await service.call("hfj_commit_change_set", {
      ...changeSetInput,
      idempotency_key: "change-set-wrong-actor-0201",
      evidence: journalEvidence.map((evidence, index) => index === 0
        ? { ...evidence, actor_id: member.actorId }
        : evidence),
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(repository.commitCount(householdId)).toBe(commitsBeforeJournalChange);
    const changeSet = await call("hfj_commit_change_set", changeSetInput);
    head = changeSet.head;
    expect(changeSet.data.evidence_ids).toEqual([purchaseId, discoveryId, cookingId, confirmationId]);
    expect(repository.commitCount(householdId)).toBe(commitsBeforeJournalChange + 1);
    expect(await call("hfj_commit_change_set", changeSetInput)).toEqual(changeSet);
    expect(await service.call("hfj_commit_change_set", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "change-set-0201",
      items: [{
        id: recipeId, kind: "recipe", title: "Changed replay", canonical_url: "https://example.test/changed", audited_page_url: "https://example.test/changed",
        author_or_publisher: "Test Kitchen", saved: "unknown", cooked: "unknown", liked: "unknown", last_cooked: null, date_precision: "unknown", image_url: null, image_page_url: null,
        evidence_ids: [discoveryId], created_at: "2026-07-15T12:00:00.000Z", updated_at: "2026-07-15T12:00:00.000Z", schema_version: 1, body_markdown: "Changed.",
      }],
      expected_item_revisions: { [recipeId]: changeSet.head },
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect((await call("hfj_search_items", { household_id: householdId, query: "apple", kind: "snack", limit: 10 })).data.items).toHaveLength(1);
    expect((await call("hfj_search_items", { household_id: householdId, query: "example.test", kind: "recipe", limit: 10 })).data.items).toHaveLength(1);
    expect((await call("hfj_get_item", { household_id: householdId, item_id: recipeId })).data.revision).toBe(changeSet.head);
    const deliveryDish = deliveryDishFixture();
    const alcoholDish = JournalItemSchema.parse({
      ...deliveryDish,
      id: "itm_0000000000000298",
      dish_name: "Canned citrus spritz",
      restaurant_name: "Corner Table",
      public_location_label: "University Avenue",
      public_merchant_address: { locality: "Palo Alto", region: "CA" },
      classification: { kind: "alcohol", authored_by: "agent" },
      evidence_ids: ["evd_0000000000000298"],
      known_modifier_occurrences: [{
        evidence_id: "evd_0000000000000298",
        modifiers_complete: true,
        modifiers: [],
      }],
    });
    const deliveryProjection = await store.projection(householdId);
    deliveryProjection.items.set(deliveryDish.id, {
      item: deliveryDish,
      revision: GitObjectIdSchema.parse(changeSet.head),
    });
    deliveryProjection.items.set(alcoholDish.id, {
      item: alcoholDish,
      revision: GitObjectIdSchema.parse(changeSet.head),
    });
    const deliverySearch = await call("hfj_search_items", {
      household_id: householdId,
      query: "Wintermelon",
      kind: "delivery_dish",
      limit: 10,
    });
    expect(deliverySearch.data.items).toEqual([expect.objectContaining({
      kind: "delivery_dish",
      title: "Wintermelon boba",
      distinguishing_fields: expect.objectContaining({
        provider_label: "DoorDash",
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
      }),
    })]);
    expect(JSON.stringify(deliverySearch.data)).not.toContain("private-delivery");

    const commitsBeforePrivateCollection = repository.commitCount(householdId);
    expect(await service.call("hfj_create_collection", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "collection-private-delivery-rejected-0201",
      title: "Unsafe delivery fields",
      items: [{
        ...deliveryCollectionItem(
          "collection-item-delivery-private-0201",
          deliveryDish.id,
          changeSet.head,
          deliveryDish,
        ),
        provider_origin: "https://delivery.example.test/",
      }],
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(repository.commitCount(householdId)).toBe(commitsBeforePrivateCollection);

    const collection = await call("hfj_create_collection", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "collection-create-0201",
      title: "Weeknight picks",
      items: [
        collectionItem("collection-item-0201", snackId, "snack", "Honeycrisp apple", changeSet.head),
        collectionItem("collection-item-0202", recipeId, "recipe", "Tomato soup", changeSet.head),
        collectionItem("collection-item-0203", snackId, "snack", "Honeycrisp apple", changeSet.head),
        deliveryCollectionItem(
          "collection-item-delivery-0201",
          deliveryDish.id,
          changeSet.head,
          deliveryDish,
        ),
        deliveryCollectionItem(
          "collection-item-delivery-alcohol-0201",
          alcoholDish.id,
          changeSet.head,
          alcoholDish,
        ),
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
    if (directPreview.ok) {
      const publicSnapshot = JSON.stringify(objectDataSchema.parse(directPreview.data).snapshot);
      expect(publicSnapshot).toContain("Wintermelon boba");
      expect(publicSnapshot).toContain("https://images.example.test/wintermelon.jpg");
      expect(publicSnapshot).toContain("https://menu.example.test/wintermelon");
      expect(publicSnapshot).toContain("\"classification\":\"alcohol\"");
      expect(publicSnapshot).not.toMatch(/age.eligib|safe to drink|healthy|checkout/i);
      for (const privateValue of [
        "private-delivery-merchant",
        "private-delivery-menu",
        "https://delivery.example.test/",
        "Half sweet",
        "evd_0000000000000299",
      ]) {
        expect(publicSnapshot).not.toContain(privateValue);
      }
    }
    const plan = await call("hfj_plan_collection_import", {
      token: shareToken,
      destination_household_id: householdId,
      selected_collection_item_ids: [
        "collection-item-0201",
        "collection-item-0202",
        "collection-item-delivery-0201",
        "collection-item-delivery-alcohol-0201",
      ],
    });
    expect(plan.data.items).toHaveLength(4);
    const commitsBeforeRejectedMerge = repository.commitCount(householdId);
    expect(await service.call("hfj_import_collection_items", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "import-delivery-merge-rejected-0201",
      token: shareToken,
      selections: [{
        collection_item_id: "collection-item-0201",
        resolution: { action: "merge", destination_item_id: deliveryDish.id },
      }],
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(repository.commitCount(householdId)).toBe(commitsBeforeRejectedMerge);

    const imported = await call("hfj_import_collection_items", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "import-0201",
      token: shareToken,
      selections: [
        { collection_item_id: "collection-item-0201", resolution: { action: "create_separate" } },
        { collection_item_id: "collection-item-0202", resolution: { action: "merge", destination_item_id: recipeId } },
        { collection_item_id: "collection-item-0203", resolution: { action: "skip" } },
        { collection_item_id: "collection-item-delivery-0201", resolution: { action: "create_separate" } },
        { collection_item_id: "collection-item-delivery-alcohol-0201", resolution: { action: "create_separate" } },
      ],
    });
    head = imported.head;
    expect(imported.data.skipped_count).toBe(1);
    const importedItemIds = z.array(ItemIdSchema).parse(imported.data.imported_item_ids);
    expect(importedItemIds).toHaveLength(3);
    const projectedItems = await store.projection(householdId);
    const copiedDelivery = importedItemIds
      .map((itemId) => projectedItems.items.get(itemId)?.item)
      .find((item) => item?.kind === "delivery_dish");
    expect(copiedDelivery).toMatchObject({
      kind: "delivery_dish",
      delivery_authority: "public_import",
      dish_name: "Wintermelon boba",
      restaurant_name: "Wanpo",
      public_location_label: "Palo Alto",
      image_url: "https://images.example.test/wintermelon.jpg",
      image_page_url: "https://menu.example.test/wintermelon",
      classification: { kind: "food", authored_by: "agent" },
    });
    const copiedDeliveryJson = JSON.stringify(copiedDelivery);
    expect(copiedDeliveryJson).not.toMatch(/provider|merchant_locator|menu_item|modifier|reorder/i);
    const copiedAlcohol = importedItemIds
      .map((itemId) => projectedItems.items.get(itemId)?.item)
      .find((item) => item?.kind === "delivery_dish"
        && item.classification.kind === "alcohol");
    expect(copiedAlcohol).toMatchObject({
      delivery_authority: "public_import",
      dish_name: "Canned citrus spritz",
      classification: { kind: "alcohol", authored_by: "agent" },
    });
    if (copiedDelivery?.kind !== "delivery_dish" || !("delivery_authority" in copiedDelivery)
      || copiedAlcohol?.kind !== "delivery_dish" || !("delivery_authority" in copiedAlcohol)) {
      throw new Error("Expected imported delivery dishes");
    }
    const deliveryConstraints = await call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: head,
      idempotency_key: "delivery-meal-constraints-0201",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    });
    const deliveryConstraintRevision = GitObjectIdSchema.parse(deliveryConstraints.data.constraint_revision);
    const deliveryReview = await call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: deliveryConstraintRevision,
      idempotency_key: "delivery-meal-review-0201",
    });
    const deliveryReviewEventId = z.string().parse(deliveryReview.data.event_id);
    const deliveryProposalInput = {
      household_id: householdId,
      week_start: "2026-07-20",
      meal_date: "2026-07-21",
      slot: { kind: "dinner" as const },
      source: {
        kind: "journal_delivery_dish" as const,
        item_id: copiedDelivery.id,
        item_revision: imported.head,
        evidence_ids: copiedDelivery.evidence_ids,
      },
      servings: 2,
      notes: "Shared dish",
      constraint_revision: deliveryConstraintRevision,
      constraint_review_event_id: deliveryReviewEventId,
      compatibility: "incomplete_evidence" as const,
      compatibility_caveat: "Ingredients and cross-contact details are not known.",
      idempotency_key: "delivery-meal-proposal-0201",
    };
    const alcoholProposalInput = {
      ...deliveryProposalInput,
      source: {
        kind: "journal_delivery_dish" as const,
        item_id: copiedAlcohol.id,
        item_revision: imported.head,
        evidence_ids: copiedAlcohol.evidence_ids,
      },
      notes: "Explicitly selected alcohol item",
      compatibility_caveat: "No ingredient, age-eligibility, health, or safety claim is available.",
      idempotency_key: "delivery-meal-alcohol-0201",
    };
    const [deliveryProposal, alcoholProposal] = await Promise.all([
      call("hfj_add_meal_proposal", deliveryProposalInput),
      call("hfj_add_meal_proposal", alcoholProposalInput),
    ]);
    expect(await call("hfj_add_meal_proposal", deliveryProposalInput)).toEqual(deliveryProposal);
    const deliveryWeek = z.object({
      proposals: z.array(z.object({
        proposal: MealProposalSchema,
        active: z.boolean(),
        effective_compatibility: z.string(),
      })),
    }).passthrough().parse((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data);
    expect(deliveryWeek.proposals).toHaveLength(2);
    expect(deliveryWeek.proposals.every(({ proposal }) =>
      proposal.source.kind === "journal_delivery_dish"
      && proposal.compatibility === "incomplete_evidence")).toBe(true);
    const alcoholProposalId = z.string().parse(alcoholProposal.data.proposal_id);
    const deliveryWithdrawal = await call("hfj_withdraw_meal_proposal", {
      household_id: householdId,
      week_start: "2026-07-20",
      proposal_id: alcoholProposalId,
      reason: "Changed plans",
      idempotency_key: "delivery-meal-withdraw-0201",
    });
    head = deliveryWithdrawal.head;
    expect((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data).toMatchObject({
      proposals: expect.arrayContaining([
        expect.objectContaining({
          proposal: expect.objectContaining({ id: alcoholProposalId }),
          active: false,
        }),
      ]),
    });

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

  it("cumulatively merges multiple collection selections into one public-import delivery dish", async () => {
    const created = await call("hfj_create_household", {
      name: "Shared delivery picks",
      idempotency_key: "delivery-merge-create-0201",
    });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const token = "v".repeat(43);
    const snapshot = CollectionSnapshotSchema.parse({
      id: "snp_0000000000000210",
      collection_id: "col_0000000000000210",
      title: "Wanpo favorites",
      sharer_display_name: "Kitchen Friend",
      items: [
        sharedDeliveryDish("collection-item-delivery-0210", created.head),
        sharedDeliveryDish("collection-item-delivery-0211", created.head),
      ],
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    });
    await store.saveShare({
      id: ShareIdSchema.parse("shr_0000000000000210"),
      collectionId: snapshot.collection_id,
      householdId,
      tokenHash: new HmacTokenHasher("journal-service-test-pepper").hash(token),
      snapshot,
      expiresAt: "2026-08-15T12:00:00.000Z",
      revokedAt: null,
    });

    const createdImport = await call("hfj_import_collection_items", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "delivery-merge-seed-0201",
      token,
      selections: [{
        collection_item_id: "collection-item-delivery-0210",
        resolution: { action: "create_separate" },
      }],
    });
    const destinationItemId = ItemIdSchema.parse(
      z.array(ItemIdSchema).length(1).parse(createdImport.data.imported_item_ids)[0],
    );
    const beforeMerge = (await store.projection(householdId)).items.get(destinationItemId)?.item;
    if (beforeMerge?.kind !== "delivery_dish" || !("delivery_authority" in beforeMerge)) {
      throw new Error("Expected a public-import delivery destination");
    }

    const mergeInput = {
      household_id: householdId,
      expected_head: createdImport.head,
      idempotency_key: "delivery-merge-two-selections-0201",
      token,
      selections: [
        {
          collection_item_id: "collection-item-delivery-0210",
          resolution: { action: "merge" as const, destination_item_id: destinationItemId },
        },
        {
          collection_item_id: "collection-item-delivery-0211",
          resolution: { action: "merge" as const, destination_item_id: destinationItemId },
        },
      ],
    };
    const merged = await call("hfj_import_collection_items", mergeInput);
    expect(merged.data.merged_item_ids).toEqual([destinationItemId]);
    const afterMerge = (await store.projection(householdId)).items.get(destinationItemId)?.item;
    if (afterMerge?.kind !== "delivery_dish" || !("delivery_authority" in afterMerge)) {
      throw new Error("Expected the merged public-import delivery destination");
    }
    const originalEvidenceIds = new Set(beforeMerge.evidence_ids);
    const addedEvidenceIds = afterMerge.evidence_ids.filter((id) => !originalEvidenceIds.has(id));
    expect(addedEvidenceIds).toHaveLength(2);
    expect(new Set(afterMerge.evidence_ids).size).toBe(afterMerge.evidence_ids.length);
    const projection = await store.projection(householdId);
    expect(addedEvidenceIds.map((id) => projection.evidence.get(id)?.kind)).toEqual(["import", "import"]);

    const repositorySnapshot = await repository.snapshot(householdId);
    const destinationPath = `delivery/items/${destinationItemId}.md`;
    const mergeAudit = repositorySnapshot.files
      .filter(({ path }) => /^audit\/\d{4}\/req_[0-9a-z]{16,64}\.json$/.test(path))
      .map(({ content }) => z.object({
        operation: z.string(),
        affected_paths: z.array(z.string()),
      }).passthrough().parse(JSON.parse(content) as unknown))
      .find(({ operation, affected_paths: affectedPaths }) =>
        operation === "hfj_import_collection_items"
        && affectedPaths.filter((path) => path.startsWith("delivery/evidence/")).length === 2);
    expect(mergeAudit?.affected_paths.filter((path) => path === destinationPath)).toEqual([destinationPath]);

    const rebuilt = rebuildRepositoryState(repositorySnapshot, new Map());
    expect(rebuilt.projection.items.get(destinationItemId)?.item).toEqual(afterMerge);
    expect(addedEvidenceIds.map((id) => rebuilt.projection.evidence.get(id)?.kind)).toEqual(["import", "import"]);

    projection.items.set(destinationItemId, {
      item: beforeMerge,
      revision: GitObjectIdSchema.parse(merged.head),
    });
    expect(await new ReconciliationWorker(store, repository, new NoopTelemetry()).run()).toEqual({
      checked: 1,
      rebuilt: 1,
      quarantined: 0,
    });
    expect((await store.projection(householdId)).items.get(destinationItemId)?.item).toEqual(afterMerge);

    const commitsBeforeReplay = repository.commitCount(householdId);
    expect(await call("hfj_import_collection_items", mergeInput)).toEqual(merged);
    expect(repository.commitCount(householdId)).toBe(commitsBeforeReplay);
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

  it("reads one onboarding snapshot and atomically commits the confirmed draft", async () => {
    const created = await call("hfj_create_household", { name: "One approval", idempotency_key: "onboarding-batch-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const initialContext = await call("hfj_get_context", { household_id: householdId });
    expect(initialContext.data.onboarding_snapshot).toEqual({
      profiles: {
        snacks: { markdown: "", revision: null },
        recipes: { markdown: "", revision: null },
      },
      items: [],
      items_truncated: false,
    });

    const input = {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-batch-commit-0201",
      sections: [
        { section: "snacks" as const, outcome: "complete" as const, expected_revision: 0 },
        { section: "recipes" as const, outcome: "skip" as const, reason: "not_now" as const, expected_revision: 0 },
      ],
      profiles: [{ profile: "snacks" as const, markdown: "# Snack sources" }],
      evidence: [],
      items: [],
      reports: [{ report_type: "recurring_snacks" as const, markdown: "# No recurring snacks", assertions: [], schema_version: 1 }],
      expected_item_revisions: {},
    };
    const committed = await call("hfj_commit_onboarding", input);
    expect(committed.data.onboarding).toMatchObject({
      snacks: { status: "complete" },
      recipes: { status: "skipped", revision: 1, reason: "not_now" },
    });
    expect(repository.commitCount(householdId)).toBe(1);
    expect(await call("hfj_commit_onboarding", input)).toEqual(committed);
    expect(repository.commitCount(householdId)).toBe(1);
    expect(await service.call("hfj_commit_onboarding", {
      ...input,
      profiles: [{ profile: "snacks", markdown: "# Changed replay" }],
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(await service.call("hfj_commit_onboarding", {
      household_id: householdId,
      expected_head: committed.head,
      idempotency_key: "onboarding-invalid-complete-0201",
      sections: [{ section: "recipes", outcome: "complete", expected_revision: 1 }],
      profiles: [{ profile: "recipes", markdown: "# Recipe sources" }],
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await service.call("hfj_commit_onboarding", {
      household_id: householdId,
      expected_head: committed.head,
      idempotency_key: "onboarding-invalid-skip-0201",
      sections: [{ section: "snacks", outcome: "skip", reason: "not_now", expected_revision: 0 }],
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });

    const refreshed = await call("hfj_get_context", { household_id: householdId });
    expect(refreshed.data.onboarding_snapshot).toMatchObject({
      profiles: { snacks: { markdown: "# Snack sources", revision: committed.head } },
      items_truncated: false,
    });
  });

  it("commits and searches every grocery area in one onboarding mutation", async () => {
    const created = await call("hfj_create_household", { name: "Whole grocery audit", idempotency_key: "grocery-kinds-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const evidence = [
      groceryPurchaseEvidence(21, "Cashews", "Market", "order-21"),
      groceryPurchaseEvidence(22, "Flat-leaf parsley", "Produce Shop", "order-22"),
      groceryPurchaseEvidence(23, "Classic mayonnaise", "Market", "order-23"),
      groceryPurchaseEvidence(24, "Japanese mayonnaise", "Asian Market", "order-24"),
      groceryPurchaseEvidence(25, "Dish soap", "Market", "order-25"),
    ];
    const items = [
      groceryItem(21, "snack", "Cashews", evidence[0]?.id ?? "", { category: "nuts" }),
      groceryItem(22, "ingredient", "Flat-leaf parsley", evidence[1]?.id ?? "", { category: "herb", format: "fresh", produce_variety: "flat-leaf" }),
      groceryItem(23, "condiment", "Classic mayonnaise", evidence[2]?.id ?? "", { category: "mayonnaise", formulation: "standard" }),
      groceryItem(24, "condiment", "Japanese mayonnaise", evidence[3]?.id ?? "", { category: "mayonnaise", formulation: "Japanese-style" }),
      groceryItem(25, "other_grocery", "Dish soap", evidence[4]?.id ?? "", { category: "household supply" }),
    ];
    const committed = await call("hfj_commit_onboarding", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "grocery-kinds-commit-0201",
      sections: [{ section: "snacks", outcome: "complete", expected_revision: 0 }],
      evidence,
      items,
      reports: [{
        report_type: "recurring_snacks",
        markdown: "# Grocery history\n\nSnacks, ingredients, condiments, and other groceries.",
        assertions: [],
        schema_version: 1,
      }],
      expected_item_revisions: {},
    });
    expect(committed.data.item_ids).toHaveLength(5);
    expect((await call("hfj_search_items", { household_id: householdId, query: "parsley", kind: "ingredient" })).data.items)
      .toEqual([expect.objectContaining({ kind: "ingredient", title: "Flat-leaf parsley" })]);
    expect((await call("hfj_search_items", { household_id: householdId, query: "mayonnaise", kind: "condiment" })).data.items)
      .toEqual([
        expect.objectContaining({ distinguishing_fields: expect.objectContaining({ formulation: "standard" }) }),
        expect.objectContaining({ distinguishing_fields: expect.objectContaining({ formulation: "Japanese-style" }) }),
      ]);
    const paths = (await repository.snapshot(householdId)).files.map(({ path }) => path);
    expect(paths).toEqual(expect.arrayContaining([
      `snacks/items/${items[0]?.id}.md`,
      `ingredients/items/${items[1]?.id}.md`,
      `condiments/items/${items[2]?.id}.md`,
      `condiments/items/${items[3]?.id}.md`,
      `groceries/items/${items[4]?.id}.md`,
      `groceries/evidence/2026/${evidence[0]?.id}.json`,
    ]));
  });

  it("atomically commits and replays 10,000 onboarding evidence records and items", async () => {
    const created = await call("hfj_create_household", { name: "Large onboarding", idempotency_key: "onboarding-large-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const evidence = Array.from({ length: ONBOARDING_COMMIT_MAX_EVIDENCE }, (_, index) => largeOnboardingEvidence(index));
    const items = Array.from({ length: ONBOARDING_COMMIT_MAX_ITEMS }, (_, index) => largeOnboardingItem(index));
    const input = {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-large-commit-0201",
      evidence,
      items,
    };
    const requestBytes = Buffer.byteLength(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "hfj_commit_onboarding", arguments: input },
    }));
    expect(requestBytes).toBeLessThanOrEqual(16 * 1_048_576);

    const startedAt = performance.now();
    const committed = await call("hfj_commit_onboarding", input);
    expect(performance.now() - startedAt).toBeLessThan(20_000);
    expect(committed.data.evidence_ids).toHaveLength(ONBOARDING_COMMIT_MAX_EVIDENCE);
    expect(committed.data.item_ids).toHaveLength(ONBOARDING_COMMIT_MAX_ITEMS);
    expect(Buffer.byteLength(JSON.stringify(committed.data))).toBeLessThan(1_500_000);
    expect(repository.commitCount(householdId)).toBe(1);
    expect((await store.projection(householdId)).evidence.size).toBe(ONBOARDING_COMMIT_MAX_EVIDENCE);
    expect((await store.projection(householdId)).items.size).toBe(ONBOARDING_COMMIT_MAX_ITEMS);

    expect(await call("hfj_commit_onboarding", input)).toEqual(committed);
    expect(repository.commitCount(householdId)).toBe(1);
  }, 60_000);

  it("commits skip-only onboarding without creating an empty Git commit", async () => {
    const created = await call("hfj_create_household", { name: "Skip setup", idempotency_key: "onboarding-skip-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    expect(await service.call("hfj_commit_onboarding", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-no-change-0201",
      sections: [{ section: "snacks", outcome: "complete", expected_revision: 0 }],
    }, owner)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    const input = {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-skip-final-0201",
      sections: [
        { section: "snacks" as const, outcome: "skip" as const, reason: "no_sources" as const, expected_revision: 0 },
        { section: "recipes" as const, outcome: "skip" as const, reason: "user_declined" as const, expected_revision: 0 },
      ],
    };
    const committed = await call("hfj_commit_onboarding", input);
    expect(committed.head).toBe(created.head);
    expect(repository.commitCount(householdId)).toBe(0);
    expect(committed.data.onboarding).toMatchObject({
      snacks: { status: "skipped", revision: 1, reason: "no_sources" },
      recipes: { status: "skipped", revision: 1, reason: "user_declined" },
    });
    expect(await call("hfj_commit_onboarding", input)).toEqual(committed);
    expect(repository.commitCount(householdId)).toBe(0);
    expect(await service.call("hfj_commit_onboarding", {
      ...input,
      sections: [{ section: "snacks", outcome: "skip", reason: "not_now", expected_revision: 0 }],
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    expect(await service.call("hfj_commit_onboarding", {
      ...input,
      idempotency_key: "onboarding-skip-stale-0201",
      expected_head: "f".repeat(40),
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });

    const unchangedSkip = await call("hfj_commit_onboarding", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "onboarding-skip-unchanged-0201",
      sections: [{ section: "snacks", outcome: "skip", reason: "no_sources", expected_revision: 1 }],
    });
    expect(unchangedSkip.data.onboarding).toMatchObject({ snacks: { status: "skipped", revision: 1 } });
    expect(repository.commitCount(householdId)).toBe(0);
  });

  it("bounds the onboarding item index and rejects a mixed-head snapshot", async () => {
    const created = await call("hfj_create_household", { name: "Bounded snapshot", idempotency_key: "onboarding-snapshot-create-0201" });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const projection = await store.projection(householdId);
    for (let index = 0; index < 201; index += 1) {
      const id = ItemIdSchema.parse(`itm_${index.toString().padStart(16, "0")}`);
      projection.items.set(id, {
        revision: GitObjectIdSchema.parse(created.head),
        item: JournalItemSchema.parse({
          id,
          kind: "snack",
          display_name: `Snack ${index}`,
          brand: null,
          product_line: null,
          flavor: null,
          formulation: null,
          format: null,
          category: "snack",
          produce_variety: null,
          known_size_variants: [],
          image_page_url: null,
          image_url: null,
          evidence_ids: ["evd_0000000000000999"],
          created_at: "2026-07-15T12:00:00.000Z",
          updated_at: "2026-07-15T12:00:00.000Z",
          schema_version: 1,
          body_markdown: "",
        }),
      });
    }
    const context = await call("hfj_get_context", { household_id: householdId });
    const snapshot = z.object({ items: z.array(z.json()), items_truncated: z.boolean() }).passthrough().parse(context.data.onboarding_snapshot);
    expect(snapshot.items).toHaveLength(200);
    expect(snapshot.items_truncated).toBe(true);

    const membership = await store.getMembership(householdId, owner.userId);
    if (membership === null) throw new Error("missing owner membership");
    membership.projectionHead = GitObjectIdSchema.parse("f".repeat(40));
    await store.upsertMembership(membership);
    expect(await service.call("hfj_get_context", { household_id: householdId }, owner)).toMatchObject({
      ok: false,
      error: { code: "PROJECTION_DRIFT" },
    });
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

  it("preserves concurrent same-slot meal proposals and enforces withdrawal ownership", async () => {
    const created = await call("hfj_create_household", {
      name: "Planning Kitchen",
      idempotency_key: "meal-household-0201",
    });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const invitation = await call("hfj_create_family_invite", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "meal-invite-0201",
      role: "editor",
      intended_email_hint: "planner@example.test",
      expires_in_days: 7,
    });
    const invitationToken = new URL(z.string().parse(invitation.data.url)).pathname.split("/").at(-1);
    if (invitationToken === undefined) throw new Error("Invitation token missing");
    const accepted = await call("hfj_accept_family_invite", {
      token: invitationToken,
      accept: true,
      idempotency_key: "meal-accept-0201",
    }, member);
    const constraints = await call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: accepted.head,
      idempotency_key: "meal-constraints-0201",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    });
    const constraintRevision = GitObjectIdSchema.parse(constraints.data.constraint_revision);
    expect(await service.call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: accepted.head,
      idempotency_key: "meal-constraints-0201",
      constraints: {
        status: "recorded",
        time_zone: "America/Los_Angeles",
        allergy_labels: ["peanut"],
        sensitivity_labels: [],
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });
    const reviewed = await call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: constraintRevision,
      idempotency_key: "meal-review-0201",
    });
    const reviewEventId = z.string().parse(reviewed.data.event_id);
    const ownerInput = {
      household_id: householdId,
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" as const },
      source: { kind: "freeform" as const, title: "Egg salad sandwich" },
      servings: 2,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "appears_compatible" as const,
      compatibility_caveat: "No household constraints are currently recorded; verify ingredients before serving.",
      idempotency_key: "meal-proposal-owner-0201",
    };
    const memberInput = {
      ...ownerInput,
      source: { kind: "freeform" as const, title: "Pizza" },
      idempotency_key: "meal-proposal-member-0201",
    };

    const [ownerProposal, memberProposal] = await Promise.all([
      call("hfj_add_meal_proposal", ownerInput),
      call("hfj_add_meal_proposal", memberInput, member),
    ]);
    const ownerProposalId = z.string().parse(ownerProposal.data.proposal_id);
    const memberProposalId = z.string().parse(memberProposal.data.proposal_id);
    const weekSchema = z.object({
      proposals: z.array(z.object({
        proposal: z.object({ id: z.string(), source: z.object({ title: z.string() }).passthrough() }).passthrough(),
        active: z.boolean(),
        effective_compatibility: z.string(),
      })),
    }).passthrough();
    const week = weekSchema.parse((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data);
    expect(week.proposals.map(({ proposal }) => proposal.source.title).sort()).toEqual(["Egg salad sandwich", "Pizza"]);
    expect(repository.commitCount(householdId)).toBe(6);

    expect(await call("hfj_add_meal_proposal", ownerInput)).toEqual(ownerProposal);
    expect(repository.commitCount(householdId)).toBe(6);
    expect(await service.call("hfj_add_meal_proposal", {
      ...ownerInput,
      source: { kind: "freeform", title: "Changed retry" },
    }, owner)).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT" } });

    expect(await service.call("hfj_withdraw_meal_proposal", {
      household_id: householdId,
      week_start: "2026-07-20",
      proposal_id: ownerProposalId,
      reason: null,
      idempotency_key: "meal-withdraw-member-0201",
    }, member)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const withdrawal = await call("hfj_withdraw_meal_proposal", {
      household_id: householdId,
      week_start: "2026-07-20",
      proposal_id: memberProposalId,
      reason: "Choosing the other lunch",
      idempotency_key: "meal-withdraw-owner-0201",
    });
    const afterWithdrawal = weekSchema.parse((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data);
    expect(afterWithdrawal.proposals.find(({ proposal }) => proposal.id === memberProposalId)?.active).toBe(false);
    expect(afterWithdrawal.proposals.find(({ proposal }) => proposal.id === ownerProposalId)?.active).toBe(true);

    await call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: withdrawal.head,
      idempotency_key: "meal-constraints-0202",
      constraints: {
        status: "recorded",
        time_zone: "America/Los_Angeles",
        allergy_labels: ["peanut"],
        sensitivity_labels: [],
        reviewed_at: "2026-07-20T17:00:00.000Z",
      },
    });
    const afterConstraintChange = weekSchema.parse((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data);
    expect(afterConstraintChange.proposals.every(({ effective_compatibility }) => effective_compatibility === "needs_recheck")).toBe(true);

    expect(await service.call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    }, outsider)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("bounds cloud meal proposals by slot and week and bounds weekly events", async () => {
    const created = await call("hfj_create_household", {
      name: "Bounded Planning",
      idempotency_key: "bounded-meal-household-0201",
    });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const constraints = await call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "bounded-meal-constraints-0201",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    });
    const constraintRevision = GitObjectIdSchema.parse(constraints.data.constraint_revision);
    const review = await call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: constraintRevision,
      idempotency_key: "bounded-meal-review-0201",
    });
    const reviewEventId = z.string().parse(review.data.event_id);
    const projection = await store.projection(householdId);
    const proposalFor = (index: number, slot: { readonly kind: "lunch" } | { readonly kind: "custom"; readonly label: string }) =>
      MealProposalSchema.parse({
        id: `mlp_${index.toString(36).padStart(16, "0")}`,
        week_start: "2026-07-20",
        meal_date: "2026-07-20",
        slot,
        proposed_by: owner.actorId,
        source: { kind: "freeform", title: `Meal ${index}` },
        servings: null,
        notes: null,
        constraint_revision: constraintRevision,
        constraint_review_event_id: reviewEventId,
        compatibility: "incomplete_evidence",
        compatibility_caveat: "Ingredients still need review.",
        created_at: "2026-07-20T16:00:00.000Z",
        schema_version: 1,
      });
    const addInput = {
      household_id: householdId,
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" as const },
      source: { kind: "freeform" as const, title: "One more meal" },
      servings: null,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence" as const,
      compatibility_caveat: "Ingredients still need review.",
      idempotency_key: "bounded-meal-slot-overflow-0201",
    };

    for (let index = 0; index < MEAL_PLAN_MAX_PROPOSALS_PER_SLOT; index += 1) {
      const proposal = proposalFor(index, { kind: "lunch" });
      projection.mealProposals.set(proposal.id, { proposal, revision: constraintRevision });
    }
    expect(await service.call("hfj_add_meal_proposal", addInput, owner)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "This meal slot has reached its proposal limit" },
    });

    projection.mealProposals.clear();
    for (let index = 0; index < MEAL_PLAN_MAX_PROPOSALS_PER_WEEK; index += 1) {
      const proposal = proposalFor(index, { kind: "custom", label: `Slot ${index}` });
      projection.mealProposals.set(proposal.id, { proposal, revision: constraintRevision });
    }
    expect(await service.call("hfj_add_meal_proposal", {
      ...addInput,
      idempotency_key: "bounded-meal-week-overflow-0201",
    }, owner)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "This week has reached its meal-proposal limit" },
    });

    const extraProposal = proposalFor(MEAL_PLAN_MAX_PROPOSALS_PER_WEEK, { kind: "custom", label: "Overflow" });
    projection.mealProposals.set(extraProposal.id, { proposal: extraProposal, revision: constraintRevision });
    expect(await service.call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
      limit: 500,
    }, owner)).toMatchObject({ ok: false, error: { code: "PROJECTION_DRIFT" } });
    projection.mealProposals.delete(extraProposal.id);

    for (let index = 1; index < MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK; index += 1) {
      const event = MealPlanEventSchema.parse({
        id: `mle_${index.toString(36).padStart(16, "0")}`,
        kind: "constraints_reviewed",
        week_start: "2026-07-20",
        constraint_revision: constraintRevision,
        actor: owner.actorId,
        occurred_at: "2026-07-20T16:00:00.000Z",
        schema_version: 1,
      });
      projection.mealPlanEvents.set(event.id, { event, revision: constraintRevision });
    }
    expect(await service.call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: constraintRevision,
      idempotency_key: "bounded-meal-event-overflow-0201",
    }, owner)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "This week has reached its constraint-review limit" },
    });

    for (let index = 3; index < MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK; index += 1) {
      const proposal = proposalFor(index, { kind: "custom", label: `Slot ${index}` });
      const event = MealPlanEventSchema.parse({
        id: `mle_w${index.toString(36).padStart(16, "0")}`,
        kind: "proposal_withdrawn",
        week_start: "2026-07-20",
        proposal_id: proposal.id,
        reason: null,
        actor: owner.actorId,
        occurred_at: "2026-07-20T16:00:00.000Z",
        schema_version: 1,
      });
      projection.mealPlanEvents.set(event.id, { event, revision: constraintRevision });
    }
    const withdrawalInputs = [0, 1, 2].map((index) => ({
      household_id: householdId,
      week_start: "2026-07-20",
      proposal_id: proposalFor(index, { kind: "custom", label: `Slot ${index}` }).id,
      reason: null,
      idempotency_key: `bounded-meal-withdraw-${index.toString().padStart(4, "0")}`,
    }));
    const withdrawals = await Promise.all(withdrawalInputs.map(async (input) =>
      await service.call("hfj_withdraw_meal_proposal", input, owner)));
    expect(withdrawals.every(({ ok }) => ok)).toBe(true);
    expect(await service.call("hfj_withdraw_meal_proposal", withdrawalInputs[0], owner)).toEqual(withdrawals[0]);

    const completeWeek = await service.call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    }, owner);
    expect(completeWeek).toMatchObject({
      ok: true,
      data: {
        events_truncated: false,
        events: expect.arrayContaining([
          expect.objectContaining({ id: reviewEventId, kind: "constraints_reviewed" }),
          expect.objectContaining({ proposal_id: withdrawalInputs[0]?.proposal_id, kind: "proposal_withdrawn" }),
        ]),
      },
    });
    if (!completeWeek.ok) throw new Error("The bounded meal week should be readable");
    expect(z.object({ events: z.array(MealPlanEventSchema) }).parse(completeWeek.data).events).toHaveLength(MEAL_PLAN_MAX_EVENTS_PER_WEEK);
  });

  it("reconstructs a committed meal proposal after projection failure without duplicating Git", async () => {
    const created = await call("hfj_create_household", {
      name: "Recovery Planning",
      idempotency_key: "meal-recovery-household-0201",
    });
    const householdId = HouseholdIdSchema.parse(created.data.household_id);
    const constraints = await call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: created.head,
      idempotency_key: "meal-recovery-constraints-0201",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
    });
    const constraintRevision = GitObjectIdSchema.parse(constraints.data.constraint_revision);
    const review = await call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-20",
      constraint_revision: constraintRevision,
      idempotency_key: "meal-recovery-review-0201",
    });
    const input = {
      household_id: householdId,
      week_start: "2026-07-20",
      meal_date: "2026-07-21",
      slot: { kind: "dinner" as const },
      source: { kind: "freeform" as const, title: "Tacos" },
      servings: 3,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: z.string().parse(review.data.event_id),
      compatibility: "incomplete_evidence" as const,
      compatibility_caveat: "Ingredients still need review.",
      idempotency_key: "meal-recovery-proposal-0201",
    };
    const loadProjection = store.projection.bind(store);
    let projectionCalls = 0;
    store.projection = async (id) => {
      projectionCalls += 1;
      if (projectionCalls === 2) throw new Error("simulated meal projection outage");
      return await loadProjection(id);
    };

    expect(await service.call("hfj_add_meal_proposal", input, owner)).toMatchObject({
      ok: false,
      error: { code: "RECONCILIATION_REQUIRED" },
    });
    const commitsAfterFailure = repository.commitCount(householdId);
    const recovered = await call("hfj_add_meal_proposal", input);

    expect(recovered.data).toMatchObject({ status: "completed" });
    expect(repository.commitCount(householdId)).toBe(commitsAfterFailure);
    expect((await call("hfj_get_meal_plan", {
      household_id: householdId,
      week_start: "2026-07-20",
    })).data).toMatchObject({ proposals: [expect.objectContaining({ active: true })] });
  });
});

function largeOnboardingEvidence(index: number) {
  return {
    id: `evd_${index.toString(16).padStart(16, "0")}`,
    kind: "user_confirmation",
    observed_at: "2026-07-22T12:00:00.000Z",
    evidence_date: null,
    date_precision: "unknown",
    source_type: "conversation",
    source_label: "Owner",
    stable_locator: `confirmation-${index}`,
    summary: "Confirmed",
    actor_id: owner.actorId,
    limitations: [],
    schema_version: 1,
  };
}

function largeOnboardingItem(index: number) {
  const suffix = index.toString(16).padStart(16, "0");
  return {
    id: `itm_${suffix}`,
    kind: "snack",
    display_name: `Snack ${index}`,
    brand: null,
    product_line: null,
    flavor: null,
    formulation: null,
    format: null,
    category: "snack",
    produce_variety: null,
    known_size_variants: [],
    image_page_url: null,
    image_url: null,
    evidence_ids: [`evd_${suffix}`],
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  };
}

function groceryPurchaseEvidence(index: number, title: string, store: string, orderReference: string) {
  const suffix = index.toString(16).padStart(16, "0");
  return {
    id: `evd_${suffix}`,
    kind: "purchase",
    observed_at: "2026-07-22T12:00:00.000Z",
    evidence_date: "2026-07-22",
    date_precision: "day",
    source_type: "grocery_order",
    source_label: store,
    stable_locator: `${orderReference}/${suffix}`,
    summary: title,
    actor_id: owner.actorId,
    limitations: [],
    schema_version: 1,
    purchase: { store, order_reference: orderReference, line_item_title: title, order_date: "2026-07-22" },
  } as const;
}

function groceryItem(
  index: number,
  kind: "snack" | "ingredient" | "condiment" | "other_grocery",
  displayName: string,
  evidenceId: string,
  fields: Partial<{ category: string; formulation: string; format: string; produce_variety: string }>,
) {
  const suffix = index.toString(16).padStart(16, "0");
  return {
    id: `itm_${suffix}`,
    kind,
    display_name: displayName,
    brand: null,
    product_line: null,
    flavor: null,
    formulation: fields.formulation ?? null,
    format: fields.format ?? null,
    category: fields.category ?? "grocery",
    produce_variety: fields.produce_variety ?? null,
    known_size_variants: [],
    image_page_url: null,
    image_url: null,
    evidence_ids: [evidenceId],
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "Observed source is recorded in the cited purchase evidence.",
  } as const;
}

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

function deliveryCollectionItem(
  collectionItemId: string,
  sourceItemId: string,
  revision: string,
  source: ReturnType<typeof deliveryDishFixture>,
): Record<string, JsonValue> {
  if (source.kind !== "delivery_dish" || "delivery_authority" in source) {
    throw new Error("Delivery collection fixture requires history-backed source");
  }
  return {
    collection_item_id: collectionItemId,
    source_item_id: sourceItemId,
    kind: "delivery_dish",
    title: source.dish_name,
    restaurant_name: source.restaurant_name,
    public_location_label: source.public_location_label,
    public_merchant_address: source.public_merchant_address === null ? null : {
      ...(source.public_merchant_address.address_lines === undefined
        ? {}
        : { address_lines: [...source.public_merchant_address.address_lines] }),
      ...(source.public_merchant_address.locality === undefined
        ? {}
        : { locality: source.public_merchant_address.locality }),
      ...(source.public_merchant_address.region === undefined
        ? {}
        : { region: source.public_merchant_address.region }),
      ...(source.public_merchant_address.postal_code === undefined
        ? {}
        : { postal_code: source.public_merchant_address.postal_code }),
      ...(source.public_merchant_address.country === undefined
        ? {}
        : { country: source.public_merchant_address.country }),
    },
    public_description: null,
    public_note: null,
    image_url: source.image_url,
    image_page_url: source.image_page_url,
    source_display_attribution: null,
    source_item_revision: revision,
    ...(source.classification.kind === "alcohol" ? { classification: "alcohol" } : {}),
  };
}

function sharedDeliveryDish(collectionItemId: string, revision: string) {
  return {
    collection_item_id: collectionItemId,
    kind: "delivery_dish" as const,
    title: "Wintermelon boba",
    restaurant_name: "Wanpo",
    public_location_label: "Palo Alto",
    public_merchant_address: { locality: "Palo Alto", region: "CA" },
    public_description: "A familiar tea order.",
    public_note: null,
    image_url: null,
    image_page_url: null,
    source_display_attribution: "Kitchen Friend",
    source_item_revision: revision,
  };
}

function deliveryDishFixture() {
  return JournalItemSchema.parse({
    id: "itm_0000000000000299",
    kind: "delivery_dish",
    dish_name: "Wintermelon boba",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example.test",
    restaurant_name: "Wanpo",
    public_location_label: "Palo Alto",
    public_merchant_address: {
      address_lines: ["123 University Ave"],
      locality: "Palo Alto",
      region: "CA",
    },
    image_url: "https://images.example.test/wintermelon.jpg",
    image_page_url: "https://menu.example.test/wintermelon",
    merchant_locator: "private-delivery-merchant",
    known_menu_item_locators: ["private-delivery-menu"],
    known_modifier_occurrences: [{
      evidence_id: "evd_0000000000000299",
      modifiers_complete: true,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
    }],
    classification: { kind: "food", authored_by: "agent" },
    evidence_ids: ["evd_0000000000000299"],
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  });
}
