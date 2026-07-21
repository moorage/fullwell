import { z } from "zod";
import { DateTimeSchema } from "./common.js";
import { HouseholdIdSchema, UserIdSchema } from "./ids.js";

export const OnboardingSectionSchema = z.enum(["snacks", "recipes"]);
export const OnboardingSkipReasonSchema = z.enum(["not_now", "no_sources", "user_declined"]);

export const OnboardingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("skip"), reason: OnboardingSkipReasonSchema }).strict(),
  z.object({ action: z.literal("resume") }).strict(),
]);

const OnboardingRecordBaseSchema = z.object({
  user_id: UserIdSchema,
  household_id: HouseholdIdSchema,
  section: OnboardingSectionSchema,
  revision: z.number().int().positive(),
  updated_at: DateTimeSchema,
});

export const OnboardingRecordSchema = z.discriminatedUnion("status", [
  OnboardingRecordBaseSchema.extend({
    status: z.literal("in_progress"),
    skip_reason: z.null(),
  }).strict(),
  OnboardingRecordBaseSchema.extend({
    status: z.literal("skipped"),
    skip_reason: OnboardingSkipReasonSchema,
  }).strict(),
]);

export const OnboardingSectionStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_started"), revision: z.literal(0) }).strict(),
  z.object({ status: z.literal("in_progress"), revision: z.number().int().positive() }).strict(),
  z.object({
    status: z.literal("skipped"),
    revision: z.number().int().positive(),
    reason: OnboardingSkipReasonSchema,
  }).strict(),
  z.object({ status: z.literal("complete"), revision: z.number().int().nonnegative() }).strict(),
]);

export const OnboardingStatusSchema = z.object({
  household_id: HouseholdIdSchema,
  snacks: OnboardingSectionStateSchema,
  recipes: OnboardingSectionStateSchema,
}).strict();

export type OnboardingAction = z.infer<typeof OnboardingActionSchema>;
export type OnboardingRecord = z.infer<typeof OnboardingRecordSchema>;
export type OnboardingSection = z.infer<typeof OnboardingSectionSchema>;
export type OnboardingSectionState = z.infer<typeof OnboardingSectionStateSchema>;
export type OnboardingSkipReason = z.infer<typeof OnboardingSkipReasonSchema>;
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
