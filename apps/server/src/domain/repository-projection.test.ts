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
