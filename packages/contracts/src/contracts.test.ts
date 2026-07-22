import { describe, expect, it } from "vitest";
import {
  CollectionSnapshotSchema,
  EvidenceSchema,
  HostActionReceiptSchema,
  HouseholdSnapshotManifestSchema,
  OnboardingRecordSchema,
  OnboardingSectionStateSchema,
  ONBOARDING_COMMIT_MAX_EVIDENCE,
  ONBOARDING_COMMIT_MAX_ITEMS,
  RunnerClaimRequestSchema,
  RunnerCompletionSchema,
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
    expect(Object.keys(ToolInputSchemas)).toHaveLength(24);
    expect(ToolInputSchemas.hfj_get_context).toBeDefined();
    expect(ToolInputSchemas.hfj_update_onboarding).toBeDefined();
    expect(ToolInputSchemas.hfj_commit_onboarding).toBeDefined();
    expect(ToolInputSchemas.hfj_export_household).toBeDefined();
  });

  it("keeps onboarding transitions typed and completion server-derived", () => {
    expect(parseToolInput("hfj_update_onboarding", {
      household_id: "hsh_0123456789abcdef",
      section: "snacks",
      transition: { action: "skip", reason: "no_sources" },
      expected_revision: 0,
      idempotency_key: "onboarding-1",
    })).toMatchObject({ transition: { action: "skip", reason: "no_sources" } });
    expect(() => parseToolInput("hfj_update_onboarding", {
      household_id: "hsh_0123456789abcdef",
      section: "recipes",
      transition: { action: "complete" },
      expected_revision: 0,
      idempotency_key: "onboarding-2",
    })).toThrow();
    expect(OnboardingSectionStateSchema.safeParse({ status: "complete", revision: 0 }).success).toBe(true);
    expect(OnboardingRecordSchema.safeParse({
      user_id: "usr_0123456789abcdef",
      household_id: "hsh_0123456789abcdef",
      section: "recipes",
      status: "in_progress",
      skip_reason: "not_now",
      revision: 1,
      updated_at: "2026-07-21T20:00:00.000Z",
    }).success).toBe(false);
  });

  it("requires unique, explicit outcomes in the final onboarding commit", () => {
    const base = {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "onboarding-final-1",
    };
    expect(parseToolInput("hfj_commit_onboarding", {
      ...base,
      sections: [
        { section: "snacks", outcome: "skip", reason: "no_sources", expected_revision: 0 },
        { section: "recipes", outcome: "skip", reason: "not_now", expected_revision: 0 },
      ],
    })).toMatchObject({ sections: [{ section: "snacks" }, { section: "recipes" }] });
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      sections: [
        { section: "snacks", outcome: "skip", reason: "no_sources", expected_revision: 0 },
        { section: "snacks", outcome: "complete", expected_revision: 0 },
      ],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", base)).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      profiles: [
        { profile: "snacks", markdown: "first" },
        { profile: "snacks", markdown: "second" },
      ],
    })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", {
      ...base,
      items: [onboardingItem(0), onboardingItem(0)],
    })).toThrow();
  });

  it("accepts 10,000 onboarding evidence and items but rejects 10,001", () => {
    const evidence = Array.from({ length: ONBOARDING_COMMIT_MAX_EVIDENCE }, (_, index) => onboardingEvidence(index));
    const items = Array.from({ length: ONBOARDING_COMMIT_MAX_ITEMS }, (_, index) => onboardingItem(index));
    const base = {
      household_id: "hsh_0123456789abcdef",
      expected_head: "a".repeat(40),
      idempotency_key: "onboarding-large-final-1",
    };
    const parsed = parseToolInput("hfj_commit_onboarding", { ...base, evidence, items });
    expect(parsed).toMatchObject({ evidence: { length: ONBOARDING_COMMIT_MAX_EVIDENCE }, items: { length: ONBOARDING_COMMIT_MAX_ITEMS } });
    expect(() => parseToolInput("hfj_commit_onboarding", { ...base, evidence: [...evidence, onboardingEvidence(ONBOARDING_COMMIT_MAX_EVIDENCE)] })).toThrow();
    expect(() => parseToolInput("hfj_commit_onboarding", { ...base, items: [...items, onboardingItem(ONBOARDING_COMMIT_MAX_ITEMS)] })).toThrow();
  });

  it("rejects invalid runner leases and implicit terminal success", () => {
    expect(RunnerClaimRequestSchema.safeParse({
      device_id: "dev_0123456789abcdef",
      wait_seconds: 26,
    }).success).toBe(false);
    expect(RunnerCompletionSchema.safeParse({
      device_id: "dev_0123456789abcdef",
      lease_id: "lse_0123456789abcdef",
      terminal: { kind: "completed" },
      host_session_id: null,
    }).success).toBe(false);
  });

  it("keeps local cart receipts explicit and monotonic", () => {
    const receipt = {
      request_id: "req_0123456789abcdef",
      envelope_id: "msg_0123456789abcdef",
      selected_item_reference: "snacks/items/cashews.md",
      retailer_origin: "https://grocer.example/",
      retailer_locator: "products/cashews",
      baseline_quantity: 2,
      target_quantity: 2,
      host_session_id: null,
      state: "ready_to_act",
      updated_at: "2026-07-20T12:00:00.000Z",
    };
    expect(HostActionReceiptSchema.safeParse(receipt).success).toBe(false);
    expect(HostActionReceiptSchema.safeParse({ ...receipt, target_quantity: 3 }).success).toBe(true);
  });

  it("requires hashed, user-only snapshot manifests", () => {
    expect(HouseholdSnapshotManifestSchema.safeParse({
      household_id: "hsh_0123456789abcdef",
      head: "a".repeat(40),
      content_sha256: "b".repeat(64),
      created_at: "2026-07-20T12:00:00.000Z",
      files: [{ path: "profiles/snacks.md", sha256: "c".repeat(64), bytes: 42, mode: 0o644 }],
    }).success).toBe(false);
  });
});

function onboardingEvidence(index: number) {
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
    actor_id: "act_0123456789abcdef",
    limitations: [],
    schema_version: 1,
  };
}

function onboardingItem(index: number) {
  return {
    id: `itm_${index.toString(16).padStart(16, "0")}`,
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
    evidence_ids: [`evd_${index.toString(16).padStart(16, "0")}`],
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  };
}
