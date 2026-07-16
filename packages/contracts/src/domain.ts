import { z } from "zod";
import {
  ActorIdSchema,
  CollectionIdSchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ImportIdSchema,
  ItemIdSchema,
  SnapshotIdSchema,
} from "./ids.js";
import {
  DatePrecisionSchema,
  DateSchema,
  DateTimeSchema,
  SafeHttpUrlSchema,
  SchemaVersionSchema,
} from "./common.js";

export const TriStateSchema = z.enum(["yes", "no", "unknown"]);
export const EvidenceKindSchema = z.enum([
  "purchase",
  "recipe_discovery",
  "cooking",
  "user_confirmation",
  "import",
  "correction",
]);

const EvidenceCommonSchema = z.object({
  id: EvidenceIdSchema,
  observed_at: DateTimeSchema,
  evidence_date: DateSchema.nullable(),
  date_precision: DatePrecisionSchema,
  source_type: z.string().min(1).max(80),
  source_label: z.string().min(1).max(200),
  stable_locator: z.string().min(1).max(1000),
  summary: z.string().min(1).max(2000),
  actor_id: ActorIdSchema,
  limitations: z.array(z.string().min(1).max(500)).max(30),
  supersedes_evidence_id: EvidenceIdSchema.optional(),
  schema_version: SchemaVersionSchema,
});

export const PurchaseEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("purchase"),
  purchase: z.object({
    store: z.string().min(1).max(200),
    order_reference: z.string().min(1).max(300),
    line_item_title: z.string().min(1).max(500),
    order_date: DateSchema,
  }).strict(),
}).strict();

export const RecipeDiscoveryEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("recipe_discovery"),
  recipe_discovery: z.object({
    canonical_recipe_url: SafeHttpUrlSchema.optional(),
    audited_page_url: SafeHttpUrlSchema,
    displayed_image_url: SafeHttpUrlSchema.optional(),
    author_or_publisher: z.string().max(300).optional(),
    source_scope: z.enum(["discoverable", "saved", "cooked", "liked", "custom"]),
  }).strict(),
}).strict();

export const CookingEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("cooking"),
  cooking: z.object({
    recipe_item_id: ItemIdSchema.optional(),
    recipe_candidate: z.string().min(1).max(500).optional(),
    cooked_on: DateSchema,
    result: z.string().min(1).max(1000),
    changes: z.array(z.object({
      description: z.string().min(1).max(500),
      typical: z.boolean(),
    }).strict()).max(50),
  }).strict().refine((value) => value.recipe_item_id !== undefined || value.recipe_candidate !== undefined, {
    message: "A recipe item or candidate is required",
  }),
}).strict();

export const GenericEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.enum(["user_confirmation", "import", "correction"]),
}).strict();

export const EvidenceSchema = z.discriminatedUnion("kind", [
  PurchaseEvidenceSchema,
  RecipeDiscoveryEvidenceSchema,
  CookingEvidenceSchema,
  GenericEvidenceSchema,
]);

const ItemBaseSchema = z.object({
  id: ItemIdSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(1000),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
  body_markdown: z.string().max(100_000),
});

export const SnackItemSchema = ItemBaseSchema.extend({
  kind: z.literal("snack"),
  display_name: z.string().min(1).max(300),
  brand: z.string().max(200).nullable(),
  product_line: z.string().max(200).nullable(),
  flavor: z.string().max(200).nullable(),
  formulation: z.string().max(200).nullable(),
  format: z.string().max(200).nullable(),
  category: z.string().min(1).max(200),
  produce_variety: z.string().max(200).nullable(),
  known_size_variants: z.array(z.string().min(1).max(100)).max(50),
  image_page_url: SafeHttpUrlSchema.nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
}).strict();

export const RecipeItemSchema = ItemBaseSchema.extend({
  kind: z.literal("recipe"),
  title: z.string().min(1).max(300),
  canonical_url: SafeHttpUrlSchema.nullable(),
  audited_page_url: SafeHttpUrlSchema.nullable(),
  author_or_publisher: z.string().max(300).nullable(),
  saved: TriStateSchema,
  cooked: TriStateSchema,
  liked: TriStateSchema,
  last_cooked: DateSchema.nullable(),
  date_precision: DatePrecisionSchema,
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
}).strict();

export const JournalItemSchema = z.discriminatedUnion("kind", [SnackItemSchema, RecipeItemSchema]);

export const ReportAssertionSchema = z.object({
  row_id: z.string().min(1).max(200),
  item_ids: z.array(ItemIdSchema).min(1).max(1000),
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(5000),
  distinct_order_count: z.number().int().nonnegative().optional(),
  last_date: DateSchema.optional(),
}).strict();

export const ReportSchema = z.object({
  report_type: z.enum(["recurring_snacks", "recipe_index"]),
  markdown: z.string().max(200_000),
  assertions: z.array(ReportAssertionSchema).max(5000),
  schema_version: SchemaVersionSchema,
}).strict();

export const CollectionItemSchema = z.object({
  collection_item_id: z.string().min(8).max(128),
  source_item_id: ItemIdSchema,
  kind: z.enum(["recipe", "snack"]),
  title: z.string().min(1).max(300),
  public_description: z.string().max(2000).nullable(),
  brand: z.string().max(200).nullable(),
  flavor: z.string().max(200).nullable(),
  formulation: z.string().max(200).nullable(),
  format: z.string().max(200).nullable(),
  author_or_publisher: z.string().max(300).nullable(),
  canonical_recipe_url: SafeHttpUrlSchema.nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
  preparation_notes: z.string().max(3000).nullable(),
  source_display_attribution: z.string().max(300).nullable(),
  source_item_revision: GitObjectIdSchema,
}).strict();

export const CollectionSnapshotSchema = z.object({
  id: SnapshotIdSchema,
  collection_id: CollectionIdSchema,
  title: z.string().min(1).max(300),
  sharer_display_name: z.string().max(200).nullable(),
  items: z.array(CollectionItemSchema).min(1).max(200),
  created_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict();

export const ImportProvenanceSchema = z.object({
  import_id: ImportIdSchema,
  source_collection_id: CollectionIdSchema,
  source_snapshot_id: SnapshotIdSchema,
  source_item_id: ItemIdSchema,
  published_revision: GitObjectIdSchema,
  source_display_attribution: z.string().max(300).nullable(),
  imported_at: DateTimeSchema,
  destination_household_id: HouseholdIdSchema,
}).strict();

export const MutationStateSchema = z.enum([
  "received",
  "locked",
  "git_committed",
  "projections_applied",
  "completed",
  "failed_before_commit",
  "reconciliation_required",
  "quarantined",
]);

export type Evidence = z.infer<typeof EvidenceSchema>;
export type JournalItem = z.infer<typeof JournalItemSchema>;
export type SnackItem = z.infer<typeof SnackItemSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CollectionSnapshot = z.infer<typeof CollectionSnapshotSchema>;
export type CollectionItem = z.infer<typeof CollectionItemSchema>;
export type MutationState = z.infer<typeof MutationStateSchema>;
