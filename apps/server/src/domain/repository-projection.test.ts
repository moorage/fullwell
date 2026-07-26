import {
  ActorIdSchema,
  GitObjectIdSchema,
  RequestIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { stableJson } from "../adapters/memory.js";
import type { RepositorySnapshot } from "../core/ports.js";
import { markdownDocument } from "./journal-validation.js";
import { rebuildRepositoryState } from "./repository-projection.js";

const head = GitObjectIdSchema.parse("a".repeat(40));
const earlier = GitObjectIdSchema.parse("b".repeat(40));
const actorId = ActorIdSchema.parse("act_0000000000000901");
const formerActorId = ActorIdSchema.parse("act_0000000000000902");
const requestId = RequestIdSchema.parse("req_0000000000000901");
const userId = UserIdSchema.parse("usr_0000000000000901");

describe("rebuildRepositoryState", () => {
  it("rebuilds journal and membership projections with per-file revisions", () => {
    const evidence = {
      id: "evd_0000000000000901",
      kind: "user_confirmation",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-15",
      date_precision: "day",
      source_type: "conversation",
      source_label: "Owner",
      stable_locator: "confirmation-0901",
      summary: "Keep apples",
      actor_id: actorId,
      limitations: [],
      schema_version: 1,
    };
    const item = {
      id: "itm_0000000000000901",
      kind: "snack",
      display_name: "Apple",
      brand: null,
      product_line: null,
      flavor: null,
      formulation: null,
      format: "fresh",
      category: "fruit",
      produce_variety: null,
      known_size_variants: [],
      image_page_url: null,
      image_url: null,
      evidence_ids: [evidence.id],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    };
    const collectionItem = {
      collection_item_id: "collection-item-0901",
      source_item_id: item.id,
      kind: "snack",
      title: "Apple",
      public_description: null,
      brand: null,
      flavor: null,
      formulation: null,
      format: "fresh",
      author_or_publisher: null,
      canonical_recipe_url: null,
      image_url: null,
      image_page_url: null,
      preparation_notes: null,
      source_display_attribution: "Owner",
      source_item_revision: earlier,
    };
    const files: RepositorySnapshot["files"] = [
      file("household.md", markdownDocument({ name: "Garden Table", schema_version: 1 }, ""), head),
      file(`audit/2026/${requestId}.json`, stableJson({ actor_id: actorId, request_id: requestId }), head),
      file("audit/2026/req_0000000000000909.json", stableJson({ actor_id: formerActorId, request_id: "req_0000000000000909" }), head),
      file(`members/${actorId}.md`, "---\nrole: owner\nschema_version: 1\n---\n", earlier),
      file(`members/${formerActorId}.md`, markdownDocument({ actor_id: formerActorId, former_member: true, removed_at: "2026-07-15T13:00:00.000Z", schema_version: 1 }, ""), head),
      file(`snacks/evidence/2026/${evidence.id}.json`, stableJson(evidence), earlier),
      file(`snacks/items/${item.id}.md`, markdownDocument(item, "Crisp"), earlier),
      file("profiles/household.md", "# Household\n", earlier),
      file("profiles/recipes.md", "# Recipes", head),
      file("collections/col_0000000000000901/snapshots/snp_0000000000000901.json", stableJson({ id: "snp_0000000000000901", collection_id: "col_0000000000000901", title: "Current", sharer_display_name: "Owner", items: [collectionItem], created_at: "2026-07-15T12:00:00.000Z", schema_version: 1 }), earlier),
      file("collections/col_0000000000000901/collection.md", markdownDocument({ id: "col_0000000000000901", current_snapshot_id: "snp_0000000000000901", schema_version: 1 }, ""), head),
      file("collections/col_0000000000000902/snapshots/snp_0000000000000902.json", stableJson({ id: "snp_0000000000000902", collection_id: "col_0000000000000902", title: "Legacy", sharer_display_name: null, items: [collectionItem], created_at: "2026-07-14T12:00:00.000Z", schema_version: 1 }), earlier),
      file("collections/col_0000000000000902/collection.md", markdownDocument({ id: "col_0000000000000902", schema_version: 1 }, ""), head),
      file("FORMAT_VERSION", "1\n", earlier),
    ];

    const rebuilt = rebuildRepositoryState({ head, files }, new Map([[requestId, userId]]));

    expect(rebuilt.householdName).toBe("Garden Table");
    expect(rebuilt.projection.evidence.get(evidence.id)).toMatchObject({ summary: "Keep apples" });
    expect(rebuilt.projection.items.get(item.id)).toMatchObject({ item: { body_markdown: "Crisp" }, revision: earlier });
    expect(rebuilt.projection.profiles.get("household")).toEqual({ markdown: "# Household", revision: earlier });
    expect(rebuilt.projection.profiles.get("recipes")).toEqual({ markdown: "# Recipes", revision: head });
    expect(rebuilt.projection.collections.get("col_0000000000000901")?.snapshot.title).toBe("Current");
    expect(rebuilt.projection.collections.get("col_0000000000000902")?.snapshot.title).toBe("Legacy");
    expect(rebuilt.memberships).toEqual([
      { actorId, role: "owner", removedAt: null, userId },
      { actorId: formerActorId, role: null, removedAt: "2026-07-15T13:00:00.000Z", userId: null },
    ]);
  });

  it("rebuilds new grocery areas while retaining legacy snack evidence", () => {
    const purchase = {
      id: "evd_0000000000000910",
      kind: "purchase",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-15",
      date_precision: "day",
      source_type: "store",
      source_label: "Market",
      stable_locator: "orders/0910/items/parsley",
      summary: "Flat-leaf parsley",
      actor_id: actorId,
      limitations: [],
      schema_version: 1,
      purchase: { store: "Market", order_reference: "0910", line_item_title: "Flat-leaf parsley", order_date: "2026-07-15" },
    };
    const ingredient = {
      id: "itm_0000000000000910",
      kind: "ingredient",
      display_name: "Flat-leaf parsley",
      brand: null,
      product_line: null,
      flavor: null,
      formulation: null,
      format: "fresh",
      category: "herb",
      produce_variety: "flat-leaf",
      known_size_variants: [],
      image_page_url: null,
      image_url: null,
      evidence_ids: [purchase.id],
      created_at: purchase.observed_at,
      updated_at: purchase.observed_at,
      schema_version: 1,
    };
    const files = [
      file(`groceries/evidence/2026/${purchase.id}.json`, stableJson(purchase), earlier),
      file(`ingredients/items/${ingredient.id}.md`, markdownDocument(ingredient, "Usually bought at Market."), earlier),
    ];
    const rebuilt = rebuildRepositoryState({ head, files }, new Map());
    expect(rebuilt.projection.evidence.get(purchase.id)).toMatchObject({ kind: "purchase" });
    expect(rebuilt.projection.items.get(ingredient.id)).toMatchObject({ item: { kind: "ingredient", display_name: "Flat-leaf parsley" } });

    const legacy = rebuildRepositoryState({ head, files: [file(`snacks/evidence/2026/${purchase.id}.json`, stableJson(purchase), earlier)] }, new Map());
    expect(legacy.projection.evidence.get(purchase.id)).toMatchObject({ kind: "purchase" });
  });

  it("rebuilds validated delivery evidence, items, profile, and report from canonical Git paths", () => {
    const delivery = deliveryDocuments();
    const rebuilt = rebuildRepositoryState({
      head,
      files: [
        file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
        file(`delivery/items/${delivery.item.id}.md`, markdownDocument(delivery.item, "A familiar order."), earlier),
        file("profiles/delivery.md", markdownDocument(delivery.profile, "Private provider setup."), earlier),
        file("delivery/reports/delivery-index.md", markdownDocument({
          report_type: delivery.report.report_type,
          assertions: delivery.report.assertions,
          schema_version: delivery.report.schema_version,
        }, delivery.report.markdown), earlier),
      ],
    }, new Map());

    expect(rebuilt.projection.evidence.get(delivery.evidence.id)).toMatchObject({
      kind: "delivery_order_line",
      delivery_order_line: { restaurant: { public_location_label: "Palo Alto" } },
    });
    expect(rebuilt.projection.items.get(delivery.item.id)).toMatchObject({
      item: { kind: "delivery_dish", dish_name: "Wintermelon boba" },
      revision: earlier,
    });
    expect(rebuilt.projection.profiles.get("delivery")?.markdown).toContain("provider_origin");
  });

  it("rebuilds a public-import delivery dish from its committed canonical tree", () => {
    const imported = importedDeliveryDocuments();
    const review = {
      id: "mle_0000000000000911",
      kind: "constraints_reviewed",
      week_start: "2026-07-20",
      constraint_revision: earlier,
      actor: actorId,
      occurred_at: "2026-07-20T16:00:00.000Z",
      schema_version: 1,
    };
    const proposal = {
      id: "mlp_0000000000000911",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      proposed_by: actorId,
      source: {
        kind: "journal_delivery_dish",
        item_id: imported.item.id,
        item_revision: earlier,
        evidence_ids: [imported.evidence.id],
      },
      servings: 2,
      notes: null,
      constraint_revision: earlier,
      constraint_review_event_id: review.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients and cross-contact details are not known.",
      created_at: "2026-07-20T16:01:00.000Z",
      schema_version: 1,
    };
    const rebuilt = rebuildRepositoryState({
      head,
      files: [
        file(`delivery/evidence/2026/${imported.evidence.id}.json`, stableJson(imported.evidence), earlier),
        file(`delivery/items/${imported.item.id}.md`, markdownDocument(imported.item, "Shared without private order authority."), earlier),
        file("profiles/meal-planning.md", markdownDocument({
          constraints: {
            status: "confirmed_none",
            time_zone: "America/Los_Angeles",
            reviewed_at: "2026-07-20T15:59:00.000Z",
          },
          updated_at: "2026-07-20T15:59:00.000Z",
          schema_version: 1,
        }, ""), earlier),
        file(`meal-plans/weeks/2026-07-20/events/${review.id}.json`, stableJson(review), head),
        file(`meal-plans/weeks/2026-07-20/proposals/${proposal.id}.json`, stableJson(proposal), head),
      ],
    }, new Map());

    expect(rebuilt.projection.evidence.get(imported.evidence.id)).toMatchObject({
      kind: "import",
      source_type: "shared_collection",
    });
    expect(rebuilt.projection.items.get(imported.item.id)).toMatchObject({
      item: {
        kind: "delivery_dish",
        delivery_authority: "public_import",
        restaurant_name: "Wanpo",
        public_location_label: "Stanford",
      },
      revision: earlier,
    });
    expect(rebuilt.projection.mealProposals.get(proposal.id)).toMatchObject({
      proposal: {
        source: {
          kind: "journal_delivery_dish",
          item_revision: earlier,
          evidence_ids: [imported.evidence.id],
        },
        compatibility: "incomplete_evidence",
      },
    });
  });

  it.each([
    ["import evidence outside the canonical delivery area", (imported: ReturnType<typeof importedDeliveryDocuments>) => [
      file(`recipes/evidence/2026/${imported.evidence.id}.json`, stableJson(imported.evidence), earlier),
      file(`delivery/items/${imported.item.id}.md`, markdownDocument(imported.item, ""), earlier),
    ]],
    ["orphan delivery import evidence", (imported: ReturnType<typeof importedDeliveryDocuments>) => [
      file(`delivery/evidence/2026/${imported.evidence.id}.json`, stableJson(imported.evidence), earlier),
    ]],
    ["history evidence cited by a public-import dish", (imported: ReturnType<typeof importedDeliveryDocuments>) => {
      const history = deliveryDocuments().evidence;
      return [
        file(`delivery/evidence/2026/${history.id}.json`, stableJson(history), earlier),
        file(`delivery/items/${imported.item.id}.md`, markdownDocument({
          ...imported.item,
          evidence_ids: [history.id],
        }, ""), earlier),
      ];
    }],
    ["import evidence cited by a history-backed dish", (imported: ReturnType<typeof importedDeliveryDocuments>) => {
      const history = deliveryDocuments().item;
      return [
        file(`delivery/evidence/2026/${imported.evidence.id}.json`, stableJson(imported.evidence), earlier),
        file(`delivery/items/${history.id}.md`, markdownDocument({
          ...history,
          evidence_ids: [imported.evidence.id],
        }, ""), earlier),
      ];
    }],
  ])("fails closed for %s", (_case, filesFor) => {
    const imported = importedDeliveryDocuments();
    expect(() => rebuildRepositoryState({
      head,
      files: filesFor(imported),
    }, new Map())).toThrowError();
  });

  it.each([
    ["mismatched delivery evidence path", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file("delivery/evidence/2026/evd_0000000000000999.json", stableJson(delivery.evidence), earlier),
    ]],
    ["non-delivery evidence in the delivery evidence area", () => {
      const evidence = confirmationEvidence();
      return [file(`delivery/evidence/2026/${evidence.id}.json`, stableJson(evidence), earlier)];
    }],
    ["delivery evidence outside the delivery evidence area", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`groceries/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
    ]],
    ["incomplete delivery group", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson({
        ...delivery.evidence,
        delivery_order_line: { ...delivery.evidence.delivery_order_line, declared_line_count: 2 },
      }), earlier),
    ]],
    ["dish and evidence conflict", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
      file(`delivery/items/${delivery.item.id}.md`, markdownDocument({
        ...delivery.item,
        restaurant_name: "Different restaurant",
      }, ""), earlier),
    ]],
    ["report omits exact item evidence", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
      file(`delivery/items/${delivery.item.id}.md`, markdownDocument(delivery.item, ""), earlier),
      file("delivery/reports/delivery-index.md", markdownDocument({
        report_type: "delivery_index",
        assertions: [{
          row_id: "wrong",
          item_ids: [delivery.item.id],
          evidence_ids: ["evd_0000000000000999"],
        }],
        schema_version: 1,
      }, "# Delivery"), earlier),
    ]],
    ["malformed delivery profile", () => [
      file("profiles/delivery.md", markdownDocument({
        providers: [{ provider_label: "DoorDash", provider_origin: "http://delivery.example.test" }],
        schema_version: 1,
      }, ""), earlier),
    ]],
    ["duplicate delivery evidence ID", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
    ]],
    ["duplicate delivery item ID", (delivery: ReturnType<typeof deliveryDocuments>) => [
      file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
      file(`delivery/items/${delivery.item.id}.md`, markdownDocument(delivery.item, ""), earlier),
      file(`delivery/items/${delivery.item.id}.md`, markdownDocument(delivery.item, ""), earlier),
    ]],
    ["duplicate delivery report", (delivery: ReturnType<typeof deliveryDocuments>) => {
      const report = file("delivery/reports/delivery-index.md", markdownDocument({
        report_type: delivery.report.report_type,
        assertions: delivery.report.assertions,
        schema_version: delivery.report.schema_version,
      }, delivery.report.markdown), earlier);
      return [
        file(`delivery/evidence/2026/${delivery.evidence.id}.json`, stableJson(delivery.evidence), earlier),
        file(`delivery/items/${delivery.item.id}.md`, markdownDocument(delivery.item, ""), earlier),
        report,
        report,
      ];
    }],
    ["unsupported delivery document", () => [
      file("delivery/private-provider-dump.json", "{}", earlier),
    ]],
  ])("fails closed for %s", (_case, filesFor) => {
    const delivery = deliveryDocuments();
    expect(() => rebuildRepositoryState({
      head,
      files: filesFor(delivery),
    }, new Map())).toThrowError();
  });

  it("rebuilds meal-planning profile, proposals, and append-only events", () => {
    const review = {
      id: "mle_0000000000000901",
      kind: "constraints_reviewed",
      week_start: "2026-07-20",
      constraint_revision: earlier,
      actor: actorId,
      occurred_at: "2026-07-20T16:00:00.000Z",
      schema_version: 1,
    };
    const proposal = {
      id: "mlp_0000000000000901",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      proposed_by: actorId,
      source: { kind: "freeform", title: "Pizza" },
      servings: 4,
      notes: null,
      constraint_revision: earlier,
      constraint_review_event_id: review.id,
      compatibility: "appears_compatible",
      compatibility_caveat: "Verify ingredients before serving.",
      created_at: "2026-07-20T16:01:00.000Z",
      schema_version: 1,
    };
    const withdrawal = {
      id: "mle_0000000000000902",
      kind: "proposal_withdrawn",
      week_start: "2026-07-20",
      proposal_id: proposal.id,
      reason: "Changed plans",
      actor: actorId,
      occurred_at: "2026-07-20T16:02:00.000Z",
      schema_version: 1,
    };
    const files = [
      file("profiles/meal-planning.md", markdownDocument({
        constraints: {
          status: "confirmed_none",
          time_zone: "America/Los_Angeles",
          reviewed_at: "2026-07-20T15:59:00.000Z",
        },
        updated_at: "2026-07-20T15:59:00.000Z",
        schema_version: 1,
      }, ""), earlier),
      file(`meal-plans/weeks/2026-07-20/events/${review.id}.json`, stableJson(review), head),
      file(`meal-plans/weeks/2026-07-20/proposals/${proposal.id}.json`, stableJson(proposal), head),
      file(`meal-plans/weeks/2026-07-20/events/${withdrawal.id}.json`, stableJson(withdrawal), head),
    ];

    const rebuilt = rebuildRepositoryState({ head, files }, new Map());

    expect(rebuilt.projection.mealPlanningProfile).toMatchObject({
      constraints: { status: "confirmed_none", time_zone: "America/Los_Angeles" },
      revision: earlier,
    });
    expect(rebuilt.projection.mealProposals.get(proposal.id)).toMatchObject({
      proposal: { source: { title: "Pizza" } },
      revision: head,
    });
    expect(rebuilt.projection.mealPlanEvents.size).toBe(2);
  });

  it("rejects a meal-plan event that cites a missing proposal", () => {
    const withdrawal = {
      id: "mle_0000000000000903",
      kind: "proposal_withdrawn",
      week_start: "2026-07-20",
      proposal_id: "mlp_0000000000000999",
      reason: null,
      actor: actorId,
      occurred_at: "2026-07-20T16:02:00.000Z",
      schema_version: 1,
    };
    expect(() => rebuildRepositoryState({
      head,
      files: [file(`meal-plans/weeks/2026-07-20/events/${withdrawal.id}.json`, stableJson(withdrawal), head)],
    }, new Map())).toThrowError(/cannot be projected/);
  });

  it("rejects a grocery item stored in the wrong canonical area", () => {
    const ingredient = {
      id: "itm_0000000000000911", kind: "ingredient", display_name: "Parsley", brand: null, product_line: null, flavor: null,
      formulation: null, format: "fresh", category: "herb", produce_variety: null, known_size_variants: [], image_page_url: null,
      image_url: null, evidence_ids: ["evd_0000000000000911"], created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z", schema_version: 1,
    };
    expect(() => rebuildRepositoryState({
      head,
      files: [file(`snacks/items/${ingredient.id}.md`, markdownDocument(ingredient, ""), earlier)],
    }, new Map())).toThrowError(/cannot be projected/);
  });

  it.each([
    ["invalid JSON", file("snacks/evidence/2026/evd_0000000000000901.json", "{", head)],
    ["invalid JSON schema", file("snacks/evidence/2026/evd_0000000000000901.json", "{}", head)],
    ["invalid frontmatter", file(`members/${actorId}.md`, "role: owner\n", head)],
    ["frontmatter without a separator", file(`members/${actorId}.md`, "---\nrole\n---\n", head)],
    ["invalid bare frontmatter", file(`members/${actorId}.md`, "---\nrole: owner name\n---\n", head)],
    ["mismatched actor", file(`members/${actorId}.md`, markdownDocument({ actor_id: formerActorId, role: "owner" }, ""), head)],
    ["incomplete former member", file(`members/${actorId}.md`, markdownDocument({ former_member: true }, ""), head)],
    ["invalid household name", file("household.md", markdownDocument({ name: "", schema_version: 1 }, ""), head)],
    ["missing collection snapshot", file("collections/col_0000000000000901/collection.md", markdownDocument({ id: "col_0000000000000901", current_snapshot_id: "snp_0000000000000901" }, ""), head)],
  ])("fails closed for %s", (_case, invalidFile) => {
    expect(() => rebuildRepositoryState({ head, files: [invalidFile] }, new Map())).toThrowError(/cannot be projected/);
  });
});

function file(path: string, content: string, revision: typeof head): RepositorySnapshot["files"][number] {
  return { path, content, revision };
}

function confirmationEvidence() {
  return {
    id: "evd_0000000000000921",
    kind: "user_confirmation" as const,
    observed_at: "2026-07-15T12:00:00.000Z",
    evidence_date: "2026-07-15",
    date_precision: "day" as const,
    source_type: "conversation" as const,
    source_label: "Owner",
    stable_locator: "confirmation-0921",
    summary: "Keep the familiar order",
    actor_id: actorId,
    limitations: [],
    schema_version: 1 as const,
  };
}

function importedDeliveryDocuments() {
  const importedAt = "2026-07-15T12:00:00.000Z";
  const evidence = {
    id: "evd_0000000000000930",
    kind: "import" as const,
    observed_at: importedAt,
    evidence_date: "2026-07-15",
    date_precision: "day" as const,
    source_type: "shared_collection" as const,
    source_label: "Shared collection",
    stable_locator: "snp_0000000000000930/collection-item-0930",
    summary: "Imported Wintermelon boba",
    actor_id: actorId,
    limitations: ["No prior-order or reorder authority"],
    schema_version: 1 as const,
  };
  const item = {
    id: "itm_0000000000000930",
    kind: "delivery_dish" as const,
    delivery_authority: "public_import" as const,
    dish_name: "Wintermelon boba",
    restaurant_name: "Wanpo",
    public_location_label: "Stanford",
    public_merchant_address: null,
    image_url: null,
    image_page_url: null,
    source_display_attribution: "Shared collection",
    classification: { kind: "food" as const, authored_by: "agent" as const },
    import_provenance: {
      source_collection_id: "col_0000000000000930",
      source_snapshot_id: "snp_0000000000000930",
      source_collection_item_id: "collection-item-0930",
      published_revision: earlier,
      source_display_attribution: "Shared collection",
      imported_at: importedAt,
    },
    evidence_ids: [evidence.id],
    created_at: importedAt,
    updated_at: importedAt,
    schema_version: 1 as const,
  };
  return { evidence, item };
}

function deliveryDocuments() {
  const evidence = {
    id: "evd_0000000000000920",
    kind: "delivery_order_line" as const,
    observed_at: "2026-07-15T12:00:00.000Z",
    evidence_date: "2026-07-14",
    date_precision: "day" as const,
    source_type: "delivery_provider" as const,
    source_label: "DoorDash",
    stable_locator: "delivery/line-0920",
    summary: "Wintermelon boba",
    actor_id: actorId,
    limitations: [],
    schema_version: 1 as const,
    delivery_order_line: {
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example.test",
      provider_order_locator: "private-order-0920",
      order_group_locator: "private-group-0920",
      order_date: "2026-07-14",
      completion_status: "completed" as const,
      fulfillment_mode: "delivery" as const,
      group_complete: true as const,
      declared_line_count: 1,
      line_key: "line-1",
      restaurant: {
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
        public_merchant_address: { locality: "Palo Alto", region: "CA" },
        merchant_locator: "private-merchant-0920",
      },
      dish_name: "Wintermelon boba",
      quantity: 1,
      modifiers_complete: true as const,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
      historical_menu_item_locator: "private-menu-0920",
      classification: { kind: "food" as const, authored_by: "agent" as const },
    },
  };
  const item = {
    id: "itm_0000000000000920",
    kind: "delivery_dish" as const,
    dish_name: "Wintermelon boba",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example.test",
    restaurant_name: "Wanpo",
    public_location_label: "Palo Alto",
    public_merchant_address: { locality: "Palo Alto", region: "CA" },
    merchant_locator: "private-merchant-0920",
    known_menu_item_locators: ["private-menu-0920"],
    known_modifier_occurrences: [{
      evidence_id: evidence.id,
      modifiers_complete: true as const,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
    }],
    classification: { kind: "food" as const, authored_by: "agent" as const },
    evidence_ids: [evidence.id],
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1 as const,
  };
  return {
    evidence,
    item,
    profile: {
      providers: [{
        provider_label: "DoorDash",
        provider_origin: "https://delivery.example.test",
        history_start: "2026-01-01",
        history_end: "2026-07-15",
        completed_history_cursor: {
          completed_order_date: "2026-07-14",
          provider_order_locator: "private-order-0920",
        },
      }],
      interpretation_preferences: [],
      schema_version: 1,
    },
    report: {
      report_type: "delivery_index" as const,
      markdown: "# Delivery",
      assertions: [{
        row_id: "wanpo-wintermelon",
        item_ids: [item.id],
        evidence_ids: [evidence.id],
        distinct_order_count: 1,
        last_date: "2026-07-14",
      }],
      schema_version: 1,
    },
  };
}
