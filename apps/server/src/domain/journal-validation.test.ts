import { describe, expect, it } from "vitest";
import { EvidenceIdSchema, EvidenceSchema, ItemIdSchema, JournalItemSchema, ReportSchema } from "@hfj/contracts";
import { journalEvidencePath, journalItemArea, journalItemPath, markdownDocument, validateItemEvidence, validateReport } from "./journal-validation.js";

const actorId = "act_0000000000000301";
const baseEvidence = {
  observed_at: "2026-07-15T12:00:00.000Z",
  evidence_date: "2026-07-15",
  date_precision: "day",
  source_type: "test",
  source_label: "Test evidence",
  stable_locator: "test-0301",
  summary: "Test observation",
  actor_id: actorId,
  limitations: [],
  schema_version: 1,
} as const;

const discovery = EvidenceSchema.parse({
  ...baseEvidence,
  id: "evd_0000000000000301",
  kind: "recipe_discovery",
  recipe_discovery: { audited_page_url: "https://example.test/recipe", source_scope: "saved" },
});
const cooking = EvidenceSchema.parse({
  ...baseEvidence,
  id: "evd_0000000000000302",
  kind: "cooking",
  cooking: { recipe_candidate: "Soup", cooked_on: "2026-07-15", result: "Good", changes: [] },
});
const confirmation = EvidenceSchema.parse({ ...baseEvidence, id: "evd_0000000000000303", kind: "user_confirmation" });
const purchase = EvidenceSchema.parse({
  ...baseEvidence,
  id: "evd_0000000000000304",
  kind: "purchase",
  purchase: { store: "Market", order_reference: "order-1", line_item_title: "Apple", order_date: "2026-07-15" },
});

function recipe(evidenceIds: string[], statuses = { saved: "yes", cooked: "yes", liked: "yes" }) {
  return JournalItemSchema.parse({
    id: "itm_0000000000000301",
    kind: "recipe",
    title: "Soup",
    canonical_url: null,
    audited_page_url: null,
    author_or_publisher: null,
    ...statuses,
    last_cooked: null,
    date_precision: "unknown",
    image_url: null,
    image_page_url: null,
    evidence_ids: evidenceIds,
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  });
}

describe("journal validation", () => {
  it("accepts evidence-backed recipe statuses and normalizes markdown", () => {
    const evidence = new Map([discovery, cooking, confirmation].map((entry) => [entry.id, entry]));
    expect(() => validateItemEvidence(recipe([...evidence.keys()]), evidence)).not.toThrow();
    expect(markdownDocument({ schema_version: 1, title: "Soup" }, "one\r\ntwo")).toBe("---\nschema_version: 1\ntitle: \"Soup\"\n---\none\ntwo\n");
  });

  it.each([
    [["evd_0000000000000399"], "An item cites evidence that does not exist"],
    [[cooking.id], "Saved status requires"],
    [[discovery.id, confirmation.id], "Cooked status requires"],
    [[discovery.id, cooking.id], "Liked status requires"],
  ])("rejects unsupported recipe status evidence", (ids, message) => {
    const evidence = new Map([discovery, cooking, confirmation].map((entry) => [entry.id, entry]));
    expect(() => validateItemEvidence(recipe(ids), evidence)).toThrow(message);
  });

  it("does not require affirmative evidence for unknown statuses or snack status fields", () => {
    expect(() => validateItemEvidence(recipe([discovery.id], { saved: "unknown", cooked: "unknown", liked: "unknown" }), new Map([[discovery.id, discovery]]))).not.toThrow();
    const snack = JournalItemSchema.parse({
      id: "itm_0000000000000302", kind: "snack", display_name: "Apple", brand: null, product_line: null, flavor: null,
      formulation: null, format: null, category: "fruit", produce_variety: null, known_size_variants: [], image_page_url: null, image_url: null,
      evidence_ids: [purchase.id], created_at: baseEvidence.observed_at, updated_at: baseEvidence.observed_at, schema_version: 1, body_markdown: "",
    });
    expect(() => validateItemEvidence(snack, new Map([[purchase.id, purchase]]))).not.toThrow();
  });

  it("maps grocery kinds and new purchase evidence to canonical areas", () => {
    const groceryBase = {
      id: "itm_0000000000000305",
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
      created_at: baseEvidence.observed_at,
      updated_at: baseEvidence.observed_at,
      schema_version: 1,
      body_markdown: "Usually bought at Market.",
    };
    const areas = [
      ["snack", "snacks"],
      ["ingredient", "ingredients"],
      ["condiment", "condiments"],
      ["other_grocery", "groceries"],
      ["recipe", "recipes"],
    ] as const;
    for (const [kind, area] of areas) expect(journalItemArea(kind)).toBe(area);
    for (const [kind, area] of areas.slice(0, 4)) {
      const item = JournalItemSchema.parse({ ...groceryBase, kind });
      expect(journalItemPath(item)).toBe(`${area}/items/${item.id}.md`);
    }
    expect(journalEvidencePath(purchase)).toBe(`groceries/evidence/2026/${purchase.id}.json`);
    expect(journalEvidencePath(discovery)).toBe(`recipes/evidence/2026/${discovery.id}.json`);
  });

  it("validates report item, evidence, distinct-order, and date assertions", () => {
    const valid = ReportSchema.parse({
      report_type: "recurring_snacks",
      markdown: "# Snacks",
      schema_version: 1,
      assertions: [{ row_id: "apple", item_ids: ["itm_0000000000000302"], evidence_ids: [purchase.id], distinct_order_count: 1, last_date: "2026-07-15" }],
    });
    const evidence = new Map([[purchase.id, purchase]]);
    const items = new Set(["itm_0000000000000302"]);
    expect(() => validateReport(valid, evidence, items)).not.toThrow();

    const withoutAggregates = ReportSchema.parse({
      ...valid,
      assertions: [{ row_id: "apple-basic", item_ids: ["itm_0000000000000302"], evidence_ids: [purchase.id] }],
    });
    expect(() => validateReport(withoutAggregates, evidence, items)).not.toThrow();

    const assertion = valid.assertions[0];
    expect(assertion).toBeDefined();
    if (assertion === undefined) throw new Error("missing report assertion fixture");
    const withAssertion = (changes: Partial<typeof assertion>) => ({ ...valid, assertions: [{ ...assertion, ...changes }] });
    expect(() => validateReport(withAssertion({ item_ids: [ItemIdSchema.parse("itm_0000000000000399")] }), evidence, items)).toThrow("cites a missing item");
    expect(() => validateReport(withAssertion({ evidence_ids: [EvidenceIdSchema.parse("evd_0000000000000399")] }), evidence, items)).toThrow("cites missing evidence");
    expect(() => validateReport(withAssertion({ distinct_order_count: 2 }), evidence, items)).toThrow("incorrect distinct-order count");
    expect(() => validateReport(withAssertion({ last_date: "2026-07-14" }), evidence, items)).toThrow("incorrect last date");
  });
});
