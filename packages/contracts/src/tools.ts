import { z } from "zod";
import {
  CollectionIdSchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
  ItemIdSchema,
  MealPlanEventIdSchema,
  MealProposalIdSchema,
} from "./ids.js";
import {
  DateSchema,
  DateTimeSchema,
  IdempotencyKeySchema,
  RoleSchema,
} from "./common.js";
import {
  CollectionSelectionItemSchema,
  CloudMealSourceSchema,
  ConfirmedMealPlanningConstraintsSchema,
  HistoryBackedDeliveryDishItemSchema,
  DeliveryIndexReportSchema,
  DeliveryOrderGroupSchema,
  DeliveryOrderLineEvidenceSchema,
  DeliveryProfileSchema,
  JournalItemKindSchema,
  MealCompatibilitySchema,
  MealSlotSchema,
  MondayDateSchema,
  mealDateFallsWithinWeek,
  NonDeliveryEvidenceSchema,
  NonDeliveryJournalItemSchema,
  NonDeliveryReportSchema,
  ProviderOriginSchema,
  RestaurantPublicAddressSchema,
} from "./domain.js";
import {
  OnboardingActionSchema,
  OnboardingCommitOutcomeSchema,
  OnboardingSectionSchema,
} from "./onboarding.js";

const HouseholdMutationSchema = z.object({
  household_id: HouseholdIdSchema,
  idempotency_key: IdempotencyKeySchema,
});
const RevisionedHouseholdMutationSchema = HouseholdMutationSchema.extend({
  expected_head: GitObjectIdSchema,
});
const hasControlCharacter = (value: string) => [...value].some((character) => {
  const code = character.codePointAt(0);
  return code !== undefined && (code <= 31 || code === 127);
});
const BoundedNameSchema = z.string()
  .refine((value) => !hasControlCharacter(value), "Name cannot contain control characters")
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

export const ONBOARDING_COMMIT_MAX_EVIDENCE = 10_000;
export const ONBOARDING_COMMIT_MAX_ITEMS = 10_000;
export const DELIVERY_HISTORY_MAX_RESULTS = 50;
export const DELIVERY_COMMIT_MAX_EVIDENCE = 10_000;
export const DELIVERY_COMMIT_MAX_ITEMS = 10_000;

export const DeliveryOrderGroupHandleSchema = z.string()
  .regex(/^dgrp_[0-9a-f]{48}$/)
  .brand<"DeliveryOrderGroupHandle">();
export const DeliveryHistoryCursorSchema = z.string().regex(/^v1_[0-9]{1,6}$/);
export const DeliveryProfileDocumentSchema = z.object({
  profile: DeliveryProfileSchema,
  markdown: z.string().max(100_000),
}).strict().readonly();

const DeliveryCommitFieldsSchema = RevisionedHouseholdMutationSchema.omit({
  idempotency_key: true,
}).extend({
  provider_idempotency_key: IdempotencyKeySchema,
  household_visibility_confirmed: z.literal(true),
  provider_origin: ProviderOriginSchema,
  expected_delivery_profile_revision: GitObjectIdSchema.nullable(),
  expected_delivery_report_revision: GitObjectIdSchema.nullable(),
  expected_profile: DeliveryProfileDocumentSchema.nullable(),
  next_profile: DeliveryProfileDocumentSchema,
  expected_report: DeliveryIndexReportSchema.nullable(),
  next_report: DeliveryIndexReportSchema,
  evidence: z.array(DeliveryOrderLineEvidenceSchema).max(DELIVERY_COMMIT_MAX_EVIDENCE).default([]),
  items: z.array(HistoryBackedDeliveryDishItemSchema).max(DELIVERY_COMMIT_MAX_ITEMS).default([]),
  expected_item_revisions: z.record(ItemIdSchema, GitObjectIdSchema)
    .refine((revisions) => Object.keys(revisions).length <= DELIVERY_COMMIT_MAX_ITEMS, {
      message: `Expected item revisions cannot exceed ${DELIVERY_COMMIT_MAX_ITEMS}`,
    })
    .default({}),
});

const DeliveryCommitSchema = (mode: "connected_audit_checkpoint" | "local_promotion") =>
  DeliveryCommitFieldsSchema.extend({ mode: z.literal(mode) }).strict();

export const DeliveryToolInputSchemas = {
  hfj_search_delivery_history: z.object({
    household_id: HouseholdIdSchema,
    query: z.string().trim().max(300).default(""),
    provider_origin: ProviderOriginSchema.optional(),
    cursor: DeliveryHistoryCursorSchema.optional(),
    limit: z.number().int().min(1).max(DELIVERY_HISTORY_MAX_RESULTS).default(25),
  }).strict(),
  hfj_get_delivery_order: z.object({
    household_id: HouseholdIdSchema,
    group_handle: DeliveryOrderGroupHandleSchema,
  }).strict(),
  hfj_get_delivery_index: z.object({
    household_id: HouseholdIdSchema,
  }).strict(),
  hfj_commit_delivery_index: z.discriminatedUnion("mode", [
    DeliveryCommitSchema("connected_audit_checkpoint"),
    DeliveryCommitSchema("local_promotion"),
  ]).superRefine((value, context) => {
    if (new Set(value.evidence.map(({ id }) => id)).size !== value.evidence.length) {
      context.addIssue({ code: "custom", path: ["evidence"], message: "Delivery evidence IDs must be unique" });
    }
    if (new Set(value.items.map(({ id }) => id)).size !== value.items.length) {
      context.addIssue({ code: "custom", path: ["items"], message: "Delivery item IDs must be unique" });
    }
    if (value.evidence.some(({ delivery_order_line }) =>
      delivery_order_line.provider_origin !== value.provider_origin)) {
      context.addIssue({ code: "custom", path: ["evidence"], message: "Delivery evidence must use the authorized provider origin" });
    }
    if (value.items.some(({ provider_origin }) => provider_origin !== value.provider_origin)) {
      context.addIssue({ code: "custom", path: ["items"], message: "Delivery items must use the authorized provider origin" });
    }
    if (!value.next_profile.profile.providers.some(({ provider_origin }) =>
      provider_origin === value.provider_origin)) {
      context.addIssue({ code: "custom", path: ["next_profile"], message: "The next profile must retain the authorized provider origin" });
    }
  }),
} as const;

export const DeliveryToolOutputSchemas = {
  hfj_search_delivery_history: z.object({
    candidates: z.array(z.object({
      group_handle: DeliveryOrderGroupHandleSchema,
      dish_name: z.string().trim().min(1).max(500),
      provider_label: z.string().trim().min(1).max(120),
      restaurant_name: z.string().trim().min(1).max(300),
      public_location_label: z.string().trim().min(1).max(500),
      public_merchant_address: RestaurantPublicAddressSchema.nullable(),
      revision: GitObjectIdSchema,
    }).strict()).max(DELIVERY_HISTORY_MAX_RESULTS),
    next_cursor: DeliveryHistoryCursorSchema.nullable(),
  }).strict(),
  hfj_get_delivery_order: z.object({
    group: DeliveryOrderGroupSchema,
    revision: GitObjectIdSchema,
  }).strict(),
  hfj_get_delivery_index: z.object({
    report: DeliveryIndexReportSchema,
    revision: GitObjectIdSchema,
  }).strict(),
  hfj_commit_delivery_index: z.object({
    status: z.literal("completed"),
    mode: z.enum(["connected_audit_checkpoint", "local_promotion"]),
    provider_origin: ProviderOriginSchema,
    evidence_ids: z.array(EvidenceIdSchema).max(DELIVERY_COMMIT_MAX_EVIDENCE),
    item_ids: z.array(ItemIdSchema).max(DELIVERY_COMMIT_MAX_ITEMS),
    profile_revision: GitObjectIdSchema,
    report_revision: GitObjectIdSchema,
  }).strict(),
} as const;

export const MealPlanningToolInputSchemas = {
  hfj_get_meal_plan: z.object({
    household_id: HouseholdIdSchema,
    week_start: MondayDateSchema,
    cursor: z.string().max(300).optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }).strict(),
  hfj_update_meal_planning_constraints: RevisionedHouseholdMutationSchema.extend({
    constraints: ConfirmedMealPlanningConstraintsSchema,
  }).strict(),
  hfj_review_meal_constraints: HouseholdMutationSchema.extend({
    week_start: MondayDateSchema,
    constraint_revision: GitObjectIdSchema,
  }).strict(),
  hfj_add_meal_proposal: HouseholdMutationSchema.extend({
    week_start: MondayDateSchema,
    meal_date: DateSchema,
    slot: MealSlotSchema,
    source: CloudMealSourceSchema,
    servings: z.number().int().min(1).max(100).nullable().default(null),
    notes: z.string().trim().min(1).max(1000).nullable().default(null),
    constraint_revision: GitObjectIdSchema,
    constraint_review_event_id: MealPlanEventIdSchema,
    compatibility: MealCompatibilitySchema,
    compatibility_caveat: z.string().trim().min(1).max(1000),
  }).strict().superRefine((value, context) => {
    if (!mealDateFallsWithinWeek(value.week_start, value.meal_date)) {
      context.addIssue({ code: "custom", path: ["meal_date"], message: "The meal date must fall within the proposal week" });
    }
    if (value.source.kind === "journal_delivery_dish" && value.compatibility !== "incomplete_evidence") {
      context.addIssue({ code: "custom", path: ["compatibility"], message: "Delivery dishes require incomplete ingredient evidence" });
    }
  }),
  hfj_withdraw_meal_proposal: HouseholdMutationSchema.extend({
    week_start: MondayDateSchema,
    proposal_id: MealProposalIdSchema,
    reason: z.string().trim().min(1).max(500).nullable().default(null),
  }).strict(),
} as const;

export const ToolInputSchemas = {
  hfj_get_context: z.object({ household_id: HouseholdIdSchema.optional() }).strict(),
  hfj_update_user_display_name: z.object({
    display_name: BoundedNameSchema,
    idempotency_key: IdempotencyKeySchema,
  }).strict(),
  hfj_create_household: z.object({
    name: BoundedNameSchema,
    idempotency_key: IdempotencyKeySchema,
  }).strict(),
  hfj_select_household: z.object({ household_id: HouseholdIdSchema }).strict(),
  hfj_update_household_name: RevisionedHouseholdMutationSchema.extend({
    name: BoundedNameSchema,
  }).strict(),
  hfj_update_onboarding: HouseholdMutationSchema.extend({
    section: OnboardingSectionSchema,
    transition: OnboardingActionSchema,
    expected_revision: z.number().int().nonnegative(),
  }).strict(),
  hfj_create_family_invite: RevisionedHouseholdMutationSchema.extend({
    role: z.enum(["editor", "viewer"]),
    intended_email_hint: z.email().optional(),
    expires_in_days: z.number().int().min(1).max(30).default(7),
  }).strict(),
  hfj_accept_family_invite: z.object({
    token: z.string().min(43).max(256),
    accept: z.literal(true),
    idempotency_key: IdempotencyKeySchema,
  }).strict(),
  hfj_revoke_family_invite: RevisionedHouseholdMutationSchema.extend({
    invitation_id: InvitationIdSchema,
    confirm: z.literal(true),
  }).strict(),
  hfj_list_members: z.object({ household_id: HouseholdIdSchema }).strict(),
  hfj_update_member: RevisionedHouseholdMutationSchema.extend({
    member_actor_id: z.string().min(8).max(128),
    role: RoleSchema,
  }).strict(),
  hfj_remove_member: RevisionedHouseholdMutationSchema.extend({
    member_actor_id: z.string().min(8).max(128),
    confirm: z.literal(true),
  }).strict(),
  hfj_get_profile: z.object({
    household_id: HouseholdIdSchema,
    profile: z.enum(["household", "snacks", "recipes", "delivery"]),
  }).strict(),
  hfj_update_profile: RevisionedHouseholdMutationSchema.extend({
    profile: z.enum(["household", "snacks", "recipes"]),
    markdown: z.string().max(100_000),
  }).strict(),
  hfj_search_items: z.object({
    household_id: HouseholdIdSchema,
    query: z.string().trim().min(1).max(300),
    kind: JournalItemKindSchema.optional(),
    cursor: z.string().max(300).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }).strict(),
  hfj_get_item: z.object({ household_id: HouseholdIdSchema, item_id: ItemIdSchema }).strict(),
  hfj_append_evidence: RevisionedHouseholdMutationSchema.extend({
    evidence: z.array(NonDeliveryEvidenceSchema).min(1).max(100),
  }).strict(),
  hfj_commit_change_set: RevisionedHouseholdMutationSchema.extend({
    evidence: z.array(NonDeliveryEvidenceSchema).max(100).default([]),
    items: z.array(NonDeliveryJournalItemSchema).max(100).default([]),
    reports: z.array(NonDeliveryReportSchema).max(20).default([]),
    expected_item_revisions: z.record(ItemIdSchema, GitObjectIdSchema).default({}),
  }).strict().superRefine((value, context) => {
    if (value.items.length + value.reports.length === 0) {
      context.addIssue({ code: "custom", message: "At least one item or report is required" });
    }
    if (new Set(value.evidence.map(({ id }) => id)).size !== value.evidence.length) {
      context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence IDs must be unique" });
    }
    if (new Set(value.items.map(({ id }) => id)).size !== value.items.length) {
      context.addIssue({ code: "custom", path: ["items"], message: "Item IDs must be unique" });
    }
  }),
  hfj_commit_onboarding: RevisionedHouseholdMutationSchema.extend({
    sections: z.array(OnboardingCommitOutcomeSchema).max(2).default([]),
    profiles: z.array(z.object({
      profile: z.enum(["snacks", "recipes"]),
      markdown: z.string().max(100_000),
    }).strict()).max(2).default([]),
    evidence: z.array(NonDeliveryEvidenceSchema).max(ONBOARDING_COMMIT_MAX_EVIDENCE).default([]),
    items: z.array(NonDeliveryJournalItemSchema).max(ONBOARDING_COMMIT_MAX_ITEMS).default([]),
    reports: z.array(NonDeliveryReportSchema).max(2).default([]),
    expected_item_revisions: z.record(ItemIdSchema, GitObjectIdSchema).default({}),
  }).strict().superRefine((value, context) => {
    if (value.sections.length + value.profiles.length + value.evidence.length + value.items.length + value.reports.length === 0) {
      context.addIssue({ code: "custom", message: "At least one onboarding outcome or journal change is required" });
    }
    if (new Set(value.sections.map(({ section }) => section)).size !== value.sections.length) {
      context.addIssue({ code: "custom", path: ["sections"], message: "Each onboarding section may appear once" });
    }
    if (new Set(value.profiles.map(({ profile }) => profile)).size !== value.profiles.length) {
      context.addIssue({ code: "custom", path: ["profiles"], message: "Each onboarding profile may appear once" });
    }
    if (new Set(value.items.map(({ id }) => id)).size !== value.items.length) {
      context.addIssue({ code: "custom", path: ["items"], message: "Each onboarding item may appear once" });
    }
  }),
  hfj_create_collection: RevisionedHouseholdMutationSchema.extend({
    title: z.string().trim().min(1).max(300),
    items: z.array(CollectionSelectionItemSchema).min(1).max(200),
  }).strict(),
  hfj_create_collection_share: RevisionedHouseholdMutationSchema.extend({
    collection_id: CollectionIdSchema,
    expires_in_days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(30),
  }).strict(),
  hfj_revoke_collection_share: RevisionedHouseholdMutationSchema.extend({
    collection_id: CollectionIdSchema,
    confirm: z.literal(true),
  }).strict(),
  hfj_preview_shared_collection: z.object({ token: z.string().min(43).max(256) }).strict(),
  hfj_plan_collection_import: z.object({
    token: z.string().min(43).max(256),
    destination_household_id: HouseholdIdSchema,
    selected_collection_item_ids: z.array(z.string().min(8).max(128)).min(1).max(200),
  }).strict(),
  hfj_import_collection_items: RevisionedHouseholdMutationSchema.extend({
    token: z.string().min(43).max(256),
    selections: z.array(z.object({
      collection_item_id: z.string().min(8).max(128),
      resolution: z.discriminatedUnion("action", [
        z.object({ action: z.literal("skip") }).strict(),
        z.object({ action: z.literal("create_separate") }).strict(),
        z.object({ action: z.literal("merge"), destination_item_id: ItemIdSchema }).strict(),
      ]),
    }).strict()).min(1).max(200),
  }).strict(),
  hfj_export_household: z.object({
    household_id: HouseholdIdSchema,
    format: z.enum(["readable_zip", "git_bundle"]),
    idempotency_key: IdempotencyKeySchema,
  }).strict(),
  ...DeliveryToolInputSchemas,
  ...MealPlanningToolInputSchemas,
} as const;

export type ToolName = keyof typeof ToolInputSchemas;
export const ToolNameSchema = z.enum(Object.keys(ToolInputSchemas) as [ToolName, ...ToolName[]]);
export const MutatingToolNames = new Set<ToolName>([
  "hfj_update_user_display_name", "hfj_create_household", "hfj_update_household_name",
  "hfj_create_family_invite", "hfj_accept_family_invite",
  "hfj_update_onboarding",
  "hfj_revoke_family_invite", "hfj_update_member", "hfj_remove_member",
  "hfj_update_profile", "hfj_append_evidence", "hfj_commit_change_set",
  "hfj_commit_onboarding",
  "hfj_create_collection", "hfj_create_collection_share", "hfj_revoke_collection_share",
  "hfj_import_collection_items", "hfj_export_household",
  "hfj_commit_delivery_index",
  "hfj_update_meal_planning_constraints", "hfj_review_meal_constraints",
  "hfj_add_meal_proposal", "hfj_withdraw_meal_proposal",
]);

export function parseToolInput(name: ToolName, input: unknown): unknown {
  return ToolInputSchemas[name].parse(input);
}

export type MealPlanningToolName = keyof typeof MealPlanningToolInputSchemas;

export function parseMealPlanningToolInput(name: MealPlanningToolName, input: unknown): unknown {
  return MealPlanningToolInputSchemas[name].parse(input);
}

export const ToolResultDataSchema = z.object({
  status: z.enum(["completed", "partially_completed", "blocked", "cancelled"]),
  result: z.record(z.string(), z.json()),
  occurred_at: DateTimeSchema,
  evidence_ids: z.array(EvidenceIdSchema).optional(),
}).strict();
