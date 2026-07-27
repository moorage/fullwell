import { z } from "zod";
import { DateTimeSchema, SafeHttpUrlSchema } from "./common.js";
import {
  GitObjectIdSchema,
  HouseholdIdSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
} from "./ids.js";
import {
  ONBOARDING_COMMIT_MAX_EVIDENCE,
  ONBOARDING_COMMIT_MAX_ITEMS,
} from "./tools.js";

export const MessagingProviderSchema = z.literal("whatsapp_cloud");
export const MessageEnvelopeStateSchema = z.enum([
  "received",
  "queued",
  "leased",
  "awaiting_user",
  "response_ready",
  "response_sent",
  "completed",
  "expired",
  "failed",
]);
export const HostWorkflowStateSchema = z.enum([
  "resolving",
  "needs_input",
  "ready_to_act",
  "acting",
  "action_uncertain",
  "completed",
  "blocked",
  "cancelled",
]);

const UserFacingTextSchema = z.string().trim().min(1).max(480);
export const InboundRestockingTextSchema = z.string().trim().min(1).max(1_024);

export const RunnerTerminalStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed"), message: UserFacingTextSchema }).strict(),
  z.object({ kind: z.literal("needs_input"), message: UserFacingTextSchema }).strict(),
  z.object({ kind: z.literal("blocked"), message: UserFacingTextSchema }).strict(),
  z.object({ kind: z.literal("cancelled"), message: UserFacingTextSchema }).strict(),
]);

export const RunnerDeviceRegistrationSchema = z.object({
  household_id: HouseholdIdSchema,
  name: z.string().trim().min(1).max(80),
}).strict();

export const RunnerDeviceRegistrationResultSchema = z.object({
  device_id: RunnerDeviceIdSchema,
  created_at: DateTimeSchema,
}).strict();

export const WhatsAppLinkRequestSchema = z.object({
  household_id: HouseholdIdSchema,
  device_id: RunnerDeviceIdSchema,
}).strict();

export const WhatsAppLinkResultSchema = z.object({
  expires_at: DateTimeSchema,
  contact_url: SafeHttpUrlSchema,
}).strict();

export const RunnerClaimRequestSchema = z.object({
  device_id: RunnerDeviceIdSchema,
  wait_seconds: z.number().int().min(0).max(25).default(20),
}).strict();

const ClaimedEnvelopeSchema = z.object({
  envelope_id: MessageEnvelopeIdSchema,
  request_id: RequestIdSchema,
  lease_id: MessageLeaseIdSchema,
  lease_expires_at: DateTimeSchema,
  household_id: HouseholdIdSchema,
  text: InboundRestockingTextSchema,
  received_at: DateTimeSchema,
  service_window_expires_at: DateTimeSchema,
  resume_session_id: z.string().min(1).max(256).nullable(),
}).strict();

export const RunnerClaimResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("empty") }).strict(),
  z.object({ kind: z.literal("work"), envelope: ClaimedEnvelopeSchema }).strict(),
]);

export const RunnerHeartbeatSchema = z.object({
  device_id: RunnerDeviceIdSchema,
  lease_id: MessageLeaseIdSchema,
}).strict();

export const RunnerCompletionSchema = z.object({
  device_id: RunnerDeviceIdSchema,
  lease_id: MessageLeaseIdSchema,
  terminal: RunnerTerminalStateSchema,
  host_session_id: z.string().min(1).max(256).nullable(),
}).strict();

export const RESTOCKING_SNAPSHOT_MAX_FILES =
  ONBOARDING_COMMIT_MAX_EVIDENCE + ONBOARDING_COMMIT_MAX_ITEMS + 3;
export const RESTOCKING_SNAPSHOT_MAX_FILE_BYTES = 1_048_576;
export const RESTOCKING_SNAPSHOT_MAX_TOTAL_BYTES = 5 * 1_048_576;

export const HouseholdSnapshotFileSchema = z.object({
  path: z.string().min(1).max(240),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().min(0).max(RESTOCKING_SNAPSHOT_MAX_FILE_BYTES),
  mode: z.literal(0o600),
}).strict();

export const HouseholdSnapshotManifestSchema = z.object({
  household_id: HouseholdIdSchema,
  head: GitObjectIdSchema,
  content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: DateTimeSchema,
  files: z.array(HouseholdSnapshotFileSchema).max(RESTOCKING_SNAPSHOT_MAX_FILES),
}).strict();

export const HouseholdSnapshotResponseSchema = z.object({
  manifest: HouseholdSnapshotManifestSchema,
  archive_base64: z.string().max(8_000_000),
}).strict();

export const RunnerActionAuthorizationRequestSchema = z.object({
  device_id: RunnerDeviceIdSchema,
  expected_head: GitObjectIdSchema,
}).strict();

export const RunnerActionAuthorizationResultSchema = z.object({
  authorized: z.literal(true),
  head: GitObjectIdSchema,
  authorized_at: DateTimeSchema,
}).strict();

export const CartAuthorizationModeSchema = z.enum(["automatic_under_maximum", "user_confirmed"]);

export const HostReadyToActSchema = z.object({
  kind: z.literal("ready_to_act"),
  selected_item_reference: z.string().min(1).max(256),
  retailer_origin: SafeHttpUrlSchema.refine((value) => new URL(value).pathname === "/", "Retailer origins cannot include a path"),
  retailer_locator: z.string().min(1).max(512),
  baseline_quantity: z.number().int().min(0).max(999),
  target_quantity: z.number().int().min(1).max(999),
  currency: z.string().regex(/^[A-Z]{3}$/),
  incremental_amount_minor: z.number().int().min(0).max(100_000_000),
  automatic_add_maximum_minor: z.number().int().min(0).max(1_000_000),
  authorization_mode: CartAuthorizationModeSchema,
  host_session_id: z.string().min(1).max(256).nullable(),
}).strict().superRefine((value, context) => {
  if (value.target_quantity <= value.baseline_quantity) {
    context.addIssue({ code: "custom", path: ["target_quantity"], message: "Target quantity must exceed the baseline" });
  }
  if (value.authorization_mode === "automatic_under_maximum" && value.currency !== "USD") {
    context.addIssue({ code: "custom", path: ["currency"], message: "Automatic cart additions require USD pricing" });
  }
  if (value.authorization_mode === "automatic_under_maximum" && value.incremental_amount_minor >= value.automatic_add_maximum_minor) {
    context.addIssue({ code: "custom", path: ["incremental_amount_minor"], message: "Automatic cart additions must remain strictly below the maximum" });
  }
});

const HostActionReceiptBaseSchema = z.object({
  request_id: RequestIdSchema,
  envelope_id: MessageEnvelopeIdSchema,
  selected_item_reference: z.string().min(1).max(256),
  retailer_origin: SafeHttpUrlSchema.refine((value) => new URL(value).pathname === "/", "Retailer origins cannot include a path"),
  retailer_locator: z.string().min(1).max(512),
  baseline_quantity: z.number().int().min(0).max(999),
  target_quantity: z.number().int().min(1).max(999),
  host_session_id: z.string().min(1).max(256).nullable(),
  state: HostWorkflowStateSchema,
  updated_at: DateTimeSchema,
});

export const LegacyHostActionReceiptSchema = HostActionReceiptBaseSchema.strict().superRefine((value, context) => {
  if (value.target_quantity <= value.baseline_quantity) {
    context.addIssue({ code: "custom", path: ["target_quantity"], message: "Target quantity must exceed the baseline" });
  }
});

export const PricedHostActionReceiptSchema = HostActionReceiptBaseSchema.extend({
  schema_version: z.literal(2),
  currency: z.string().regex(/^[A-Z]{3}$/),
  incremental_amount_minor: z.number().int().min(0).max(100_000_000),
  automatic_add_maximum_minor: z.number().int().min(0).max(1_000_000),
  authorization_mode: CartAuthorizationModeSchema,
  terminal_message: z.string().trim().min(1).max(480).nullable(),
}).strict().superRefine((value, context) => {
  if (value.target_quantity <= value.baseline_quantity) {
    context.addIssue({ code: "custom", path: ["target_quantity"], message: "Target quantity must exceed the baseline" });
  }
  if (value.authorization_mode === "automatic_under_maximum" && value.currency !== "USD") {
    context.addIssue({ code: "custom", path: ["currency"], message: "Automatic cart additions require USD pricing" });
  }
  if (value.authorization_mode === "automatic_under_maximum" && value.incremental_amount_minor >= value.automatic_add_maximum_minor) {
    context.addIssue({ code: "custom", path: ["incremental_amount_minor"], message: "Automatic cart additions must remain strictly below the maximum" });
  }
  const terminal = value.state === "completed" || value.state === "needs_input" || value.state === "blocked" || value.state === "cancelled";
  if (terminal !== (value.terminal_message !== null)) {
    context.addIssue({ code: "custom", path: ["terminal_message"], message: "Terminal receipt states require exactly one terminal message" });
  }
});

export const HostActionReceiptSchema = z.union([
  PricedHostActionReceiptSchema,
  LegacyHostActionReceiptSchema,
]);

export type MessagingProvider = z.infer<typeof MessagingProviderSchema>;
export type MessageEnvelopeState = z.infer<typeof MessageEnvelopeStateSchema>;
export type HostWorkflowState = z.infer<typeof HostWorkflowStateSchema>;
export type CartAuthorizationMode = z.infer<typeof CartAuthorizationModeSchema>;
export type RunnerTerminalState = z.infer<typeof RunnerTerminalStateSchema>;
export type RunnerClaimRequest = z.infer<typeof RunnerClaimRequestSchema>;
export type RunnerClaimResponse = z.infer<typeof RunnerClaimResponseSchema>;
export type RunnerCompletion = z.infer<typeof RunnerCompletionSchema>;
export type HouseholdSnapshotManifest = z.infer<typeof HouseholdSnapshotManifestSchema>;
export type HouseholdSnapshotResponse = z.infer<typeof HouseholdSnapshotResponseSchema>;
export type RunnerActionAuthorizationRequest = z.infer<typeof RunnerActionAuthorizationRequestSchema>;
export type HostReadyToAct = z.infer<typeof HostReadyToActSchema>;
export type HostActionReceipt = z.infer<typeof HostActionReceiptSchema>;
export type PricedHostActionReceipt = z.infer<typeof PricedHostActionReceiptSchema>;
