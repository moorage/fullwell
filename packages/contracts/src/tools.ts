import { z } from "zod";
import {
  CollectionIdSchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
  ItemIdSchema,
} from "./ids.js";
import {
  DateTimeSchema,
  IdempotencyKeySchema,
  RoleSchema,
} from "./common.js";
import {
  CollectionItemSchema,
  EvidenceSchema,
  JournalItemSchema,
  ReportSchema,
} from "./domain.js";
import { OnboardingActionSchema, OnboardingSectionSchema } from "./onboarding.js";

const HouseholdMutationSchema = z.object({
  household_id: HouseholdIdSchema,
  idempotency_key: IdempotencyKeySchema,
});
const RevisionedHouseholdMutationSchema = HouseholdMutationSchema.extend({
  expected_head: GitObjectIdSchema,
});

export const ToolInputSchemas = {
  hfj_get_context: z.object({ household_id: HouseholdIdSchema.optional() }).strict(),
  hfj_create_household: z.object({
    name: z.string().trim().min(1).max(120),
    idempotency_key: IdempotencyKeySchema,
  }).strict(),
  hfj_select_household: z.object({ household_id: HouseholdIdSchema }).strict(),
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
    kind: z.enum(["recipe", "snack"]).optional(),
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
} as const;

export type ToolName = keyof typeof ToolInputSchemas;
export const ToolNameSchema = z.enum(Object.keys(ToolInputSchemas) as [ToolName, ...ToolName[]]);
export const MutatingToolNames = new Set<ToolName>([
  "hfj_create_household", "hfj_create_family_invite", "hfj_accept_family_invite",
  "hfj_update_onboarding",
  "hfj_revoke_family_invite", "hfj_update_member", "hfj_remove_member",
  "hfj_update_profile", "hfj_append_evidence", "hfj_commit_change_set",
  "hfj_create_collection", "hfj_create_collection_share", "hfj_revoke_collection_share",
  "hfj_import_collection_items", "hfj_export_household",
]);

export function parseToolInput(name: ToolName, input: unknown): unknown {
  return ToolInputSchemas[name].parse(input);
}

export const ToolResultDataSchema = z.object({
  status: z.enum(["completed", "partially_completed", "blocked", "cancelled"]),
  result: z.record(z.string(), z.json()),
  occurred_at: DateTimeSchema,
  evidence_ids: z.array(EvidenceIdSchema).optional(),
}).strict();
