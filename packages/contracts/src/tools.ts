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
  CollectionItemSchema,
  CloudMealSourceSchema,
  ConfirmedMealPlanningConstraintsSchema,
  EvidenceSchema,
  JournalItemSchema,
  JournalItemKindSchema,
  MealCompatibilitySchema,
  MealSlotSchema,
  MondayDateSchema,
  mealDateFallsWithinWeek,
  ReportSchema,
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
    profile: z.enum(["household", "snacks", "recipes"]),
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
    evidence: z.array(EvidenceSchema).min(1).max(100),
  }).strict(),
  hfj_commit_change_set: RevisionedHouseholdMutationSchema.extend({
    items: z.array(JournalItemSchema).max(100).default([]),
    reports: z.array(ReportSchema).max(20).default([]),
    expected_item_revisions: z.record(ItemIdSchema, GitObjectIdSchema).default({}),
  }).strict().refine((value) => value.items.length + value.reports.length > 0, {
    message: "At least one item or report is required",
  }),
  hfj_commit_onboarding: RevisionedHouseholdMutationSchema.extend({
    sections: z.array(OnboardingCommitOutcomeSchema).max(2).default([]),
    profiles: z.array(z.object({
      profile: z.enum(["snacks", "recipes"]),
      markdown: z.string().max(100_000),
    }).strict()).max(2).default([]),
    evidence: z.array(EvidenceSchema).max(ONBOARDING_COMMIT_MAX_EVIDENCE).default([]),
    items: z.array(JournalItemSchema).max(ONBOARDING_COMMIT_MAX_ITEMS).default([]),
    reports: z.array(ReportSchema).max(2).default([]),
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
    items: z.array(CollectionItemSchema).min(1).max(200),
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
