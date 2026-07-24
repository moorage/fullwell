import { z } from "zod";
import {
  ActorIdSchema,
  CollectionIdSchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ImportIdSchema,
  ItemIdSchema,
  LocalRecipeContentDigestSchema,
  MealPlanEventIdSchema,
  MealProposalIdSchema,
  SnapshotIdSchema,
} from "./ids.js";
import {
  DatePrecisionSchema,
  DateSchema,
  DateTimeSchema,
  IanaTimeZoneSchema,
  SafeHttpUrlSchema,
  SafeHttpsUrlSchema,
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

export const UserConfirmationEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("user_confirmation"),
  confirmation: z.object({
    subject: z.literal("recipe_preference"),
    recipe_item_id: ItemIdSchema,
    preference: z.literal("liked"),
  }).strict().optional(),
}).strict();

export const GenericEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.enum(["import", "correction"]),
}).strict();

export const EvidenceSchema = z.discriminatedUnion("kind", [
  PurchaseEvidenceSchema,
  RecipeDiscoveryEvidenceSchema,
  CookingEvidenceSchema,
  UserConfirmationEvidenceSchema,
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

const GroceryItemFieldsSchema = ItemBaseSchema.extend({
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
});

export const GroceryItemKindSchema = z.enum(["snack", "ingredient", "condiment", "other_grocery"]);
export const JournalItemKindSchema = z.enum(["snack", "ingredient", "condiment", "other_grocery", "recipe"]);
export const SnackItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("snack") }).strict();
export const IngredientItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("ingredient") }).strict();
export const CondimentItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("condiment") }).strict();
export const OtherGroceryItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("other_grocery") }).strict();

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

export const JournalItemSchema = z.discriminatedUnion("kind", [
  SnackItemSchema,
  IngredientItemSchema,
  CondimentItemSchema,
  OtherGroceryItemSchema,
  RecipeItemSchema,
]);

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

export const MondayDateSchema = DateSchema.refine((value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1, {
  message: "The week start must be a Monday",
}).brand<"MondayDate">();

export const MealSlotSchema = z.union([
  z.object({ kind: z.enum(["breakfast", "lunch", "dinner", "snack"]) }).strict(),
  z.object({ kind: z.literal("custom"), label: z.string().trim().min(1).max(80) }).strict(),
]).readonly();

export const MEAL_PLAN_MAX_PROPOSALS_PER_SLOT = 48;
export const MEAL_PLAN_MAX_PROPOSALS_PER_WEEK = 500;
export const MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK = 500;
export const MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK = MEAL_PLAN_MAX_PROPOSALS_PER_WEEK;
export const MEAL_PLAN_MAX_EVENTS_PER_WEEK =
  MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK + MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK;

const ConfirmedNoneConstraintsSchema = z.object({
  status: z.literal("confirmed_none"),
  time_zone: IanaTimeZoneSchema,
  reviewed_at: DateTimeSchema,
}).strict();

const RecordedConstraintsSchema = z.object({
  status: z.literal("recorded"),
  time_zone: IanaTimeZoneSchema,
  allergy_labels: z.array(z.string().trim().min(1).max(120)).max(30),
  sensitivity_labels: z.array(z.string().trim().min(1).max(120)).max(30),
  reviewed_at: DateTimeSchema,
}).strict();

function requireRecordedConstraint(value: { allergy_labels: string[]; sensitivity_labels: string[] }, context: z.RefinementCtx): void {
  if (value.allergy_labels.length + value.sensitivity_labels.length === 0) {
    context.addIssue({ code: "custom", message: "Recorded constraints require at least one allergy or sensitivity label" });
  }
  const labels = [...value.allergy_labels, ...value.sensitivity_labels].map((label) => label.toLocaleLowerCase());
  if (new Set(labels).size !== labels.length) {
    context.addIssue({ code: "custom", message: "Constraint labels must be unique" });
  }
}

export const MealPlanningConstraintsSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unresolved") }).strict(),
  ConfirmedNoneConstraintsSchema,
  RecordedConstraintsSchema,
]).superRefine((value, context) => {
  if (value.status === "recorded") requireRecordedConstraint(value, context);
});

export const ConfirmedMealPlanningConstraintsSchema = z.discriminatedUnion("status", [
  ConfirmedNoneConstraintsSchema,
  RecordedConstraintsSchema,
]).superRefine((value, context) => {
  if (value.status === "recorded") requireRecordedConstraint(value, context);
});

export const LocalActorSchema = z.object({
  kind: z.literal("local"),
  label: z.string().trim().min(1).max(80),
}).strict().readonly();

export const MealPlanActorSchema = z.union([ActorIdSchema, LocalActorSchema]);

const FreeformMealSourceSchema = z.object({
  kind: z.literal("freeform"),
  title: z.string().trim().min(1).max(300),
}).strict();
const ExternalMealSourceSchema = z.object({
  kind: z.literal("external_recipe"),
  title: z.string().trim().min(1).max(300),
  canonical_url: SafeHttpsUrlSchema,
  site_name: z.string().trim().min(1).max(200),
  discovered_at: DateTimeSchema,
}).strict();
const JournalMealSourceCommon = {
  kind: z.literal("journal_recipe"),
  item_id: ItemIdSchema,
  liked_evidence_ids: z.array(EvidenceIdSchema).min(1).max(100).readonly(),
};
const CloudJournalMealSourceSchema = z.object({
  ...JournalMealSourceCommon,
  item_revision: GitObjectIdSchema,
}).strict();
const LocalJournalMealSourceSchema = z.object({
  ...JournalMealSourceCommon,
  item_revision: LocalRecipeContentDigestSchema,
}).strict();

export const CloudMealSourceSchema = z.discriminatedUnion("kind", [
  FreeformMealSourceSchema,
  CloudJournalMealSourceSchema,
  ExternalMealSourceSchema,
]).readonly();

export const LocalMealSourceSchema = z.discriminatedUnion("kind", [
  FreeformMealSourceSchema,
  LocalJournalMealSourceSchema,
  ExternalMealSourceSchema,
]).readonly();

export const MealSourceSchema = z.union([CloudMealSourceSchema, LocalMealSourceSchema]);

export const MealCompatibilitySchema = z.enum(["appears_compatible", "incomplete_evidence", "needs_recheck"]);
export const MealConstraintRevisionSchema = z.union([GitObjectIdSchema, z.number().int().nonnegative()]);

export function mealDateFallsWithinWeek(weekStart: string, mealDate: string): boolean {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`);
  const meal = Date.parse(`${mealDate}T00:00:00.000Z`);
  const offsetDays = (meal - start) / 86_400_000;
  return Number.isInteger(offsetDays) && offsetDays >= 0 && offsetDays <= 6;
}

export const MealProposalSchema = z.object({
  id: MealProposalIdSchema,
  week_start: MondayDateSchema,
  meal_date: DateSchema,
  slot: MealSlotSchema,
  proposed_by: MealPlanActorSchema,
  source: MealSourceSchema,
  servings: z.number().int().min(1).max(100).nullable(),
  notes: z.string().trim().min(1).max(1000).nullable(),
  constraint_revision: MealConstraintRevisionSchema,
  constraint_review_event_id: MealPlanEventIdSchema,
  compatibility: MealCompatibilitySchema,
  compatibility_caveat: z.string().trim().min(1).max(1000),
  created_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict().superRefine((value, context) => {
  if (!mealDateFallsWithinWeek(value.week_start, value.meal_date)) {
    context.addIssue({ code: "custom", path: ["meal_date"], message: "The meal date must fall within the proposal week" });
  }
  const local = typeof value.proposed_by !== "string";
  if (local !== (typeof value.constraint_revision === "number")) {
    context.addIssue({ code: "custom", path: ["constraint_revision"], message: "The constraint revision must match the proposal authority" });
  }
  if (value.source.kind === "journal_recipe") {
    const localRevision = LocalRecipeContentDigestSchema.safeParse(value.source.item_revision).success;
    if (local !== localRevision) {
      context.addIssue({ code: "custom", path: ["source", "item_revision"], message: "The recipe revision must match the proposal authority" });
    }
  }
}).readonly();

const MealPlanEventCommonSchema = z.object({
  id: MealPlanEventIdSchema,
  week_start: MondayDateSchema,
  actor: MealPlanActorSchema,
  occurred_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
});

export const ConstraintsReviewedEventSchema = MealPlanEventCommonSchema.extend({
  kind: z.literal("constraints_reviewed"),
  constraint_revision: MealConstraintRevisionSchema,
}).strict();

export const MealProposalWithdrawnEventSchema = MealPlanEventCommonSchema.extend({
  kind: z.literal("proposal_withdrawn"),
  proposal_id: MealProposalIdSchema,
  reason: z.string().trim().min(1).max(500).nullable(),
}).strict();

export const MealPlanEventSchema = z.discriminatedUnion("kind", [
  ConstraintsReviewedEventSchema,
  MealProposalWithdrawnEventSchema,
]).superRefine((value, context) => {
  if (value.kind === "constraints_reviewed") {
    const local = typeof value.actor !== "string";
    if (local !== (typeof value.constraint_revision === "number")) {
      context.addIssue({ code: "custom", path: ["constraint_revision"], message: "The constraint revision must match the event authority" });
    }
  }
}).readonly();

export const MealPlanningProfileSchema = z.object({
  constraints: MealPlanningConstraintsSchema,
  revision: MealConstraintRevisionSchema,
  updated_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type JournalItem = z.infer<typeof JournalItemSchema>;
export type GroceryItemKind = z.infer<typeof GroceryItemKindSchema>;
export type SnackItem = z.infer<typeof SnackItemSchema>;
export type IngredientItem = z.infer<typeof IngredientItemSchema>;
export type CondimentItem = z.infer<typeof CondimentItemSchema>;
export type OtherGroceryItem = z.infer<typeof OtherGroceryItemSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CollectionSnapshot = z.infer<typeof CollectionSnapshotSchema>;
export type CollectionItem = z.infer<typeof CollectionItemSchema>;
export type MutationState = z.infer<typeof MutationStateSchema>;
export type MondayDate = z.infer<typeof MondayDateSchema>;
export type MealSlot = z.infer<typeof MealSlotSchema>;
export type MealPlanningConstraints = z.infer<typeof MealPlanningConstraintsSchema>;
export type ConfirmedMealPlanningConstraints = z.infer<typeof ConfirmedMealPlanningConstraintsSchema>;
export type LocalActor = z.infer<typeof LocalActorSchema>;
export type MealSource = z.infer<typeof MealSourceSchema>;
export type CloudMealSource = z.infer<typeof CloudMealSourceSchema>;
export type LocalMealSource = z.infer<typeof LocalMealSourceSchema>;
export type MealCompatibility = z.infer<typeof MealCompatibilitySchema>;
export type MealConstraintRevision = z.infer<typeof MealConstraintRevisionSchema>;
export type MealProposal = z.infer<typeof MealProposalSchema>;
export type MealPlanEvent = z.infer<typeof MealPlanEventSchema>;
export type MealPlanningProfile = z.infer<typeof MealPlanningProfileSchema>;
