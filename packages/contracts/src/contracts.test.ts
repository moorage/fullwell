import { describe, expect, it } from "vitest";
import {
  CollectionSnapshotSchema,
  EvidenceSchema,
  ToolInputSchemas,
  parseToolInput,
} from "./index.js";

describe("contract boundaries", () => {
  it("rejects private fields from a public collection snapshot", () => {
    const result = CollectionSnapshotSchema.safeParse({
      id: "snp_0123456789abcdef",
      collection_id: "col_0123456789abcdef",
      title: "Favorites",
      sharer_display_name: null,
      items: [],
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      household_id: "hsh_0123456789abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("requires purchase-private fields at ingestion", () => {
    const result = EvidenceSchema.safeParse({
      id: "evd_0123456789abcdef",
      kind: "purchase",
      observed_at: "2026-07-15T12:00:00.000Z",
      evidence_date: "2026-07-15",
      date_precision: "day",
      source_type: "store",
      source_label: "Market",
      stable_locator: "order/1/item/2",
      summary: "Cookies",
      actor_id: "act_0123456789abcdef",
      limitations: [],
      schema_version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("requires explicit duplicate resolution for imports", () => {
    expect(() => parseToolInput("hfj_import_collection_items", {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "import-key-1",
      token: "x".repeat(43),
      selections: [{ collection_item_id: "collection-item-1" }],
    })).toThrow();
  });

  it("publishes the complete stable tool catalog", () => {
    expect(Object.keys(ToolInputSchemas)).toHaveLength(22);
    expect(ToolInputSchemas.hfj_get_context).toBeDefined();
    expect(ToolInputSchemas.hfj_export_household).toBeDefined();
  });
});
