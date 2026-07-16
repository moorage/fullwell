import { z } from "zod";
import { HouseholdIdSchema } from "./ids.js";
import { IdempotencyKeySchema } from "./common.js";

export const MagicLinkRequestSchema = z.object({ email: z.email(), pending_intent: z.string().max(2048).optional() }).strict();
export const MagicLinkCompleteSchema = z.object({ token: z.string().min(32).max(512), transaction: z.string().min(16).max(256) }).strict();
export const SessionSelectHouseholdSchema = z.object({ household_id: HouseholdIdSchema }).strict();
export const AccountDeleteSchema = z.object({ confirm: z.literal("DELETE MY ACCOUNT"), reauthentication_token: z.string().min(16) }).strict();
export const PublicImportFormSchema = z.object({
  selected: z.array(z.string().min(8).max(128)).min(1).max(200),
  destination_household_id: HouseholdIdSchema.optional(),
  idempotency_key: IdempotencyKeySchema,
}).strict();
