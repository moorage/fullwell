import { z } from "zod";
import { GitObjectIdSchema, RequestIdSchema } from "./ids.js";

export const RoleSchema = z.enum(["owner", "editor", "viewer"]);
export const OAuthScopeSchema = z.enum([
  "journal:read",
  "journal:write",
  "household:manage",
  "collection:share",
  "journal:export",
  "runner:messages",
]);
export const DateTimeSchema = z.iso.datetime({ offset: true });
export const DateSchema = z.iso.date();
export const DatePrecisionSchema = z.enum(["day", "month", "year", "unknown"]);
export const IdempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9._~-]+$/);
export const SafeHttpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only http and https URLs are accepted");
export const SchemaVersionSchema = z.literal(1);

export const ErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "HOUSEHOLD_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "REVISION_CONFLICT",
  "INVITE_EXPIRED",
  "INVITE_REVOKED",
  "SHARE_EXPIRED",
  "SHARE_REVOKED",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "PROJECTION_DRIFT",
  "RECONCILIATION_REQUIRED",
  "PROVIDER_UNAVAILABLE",
  "CHANNEL_DISABLED",
  "LEASE_CONFLICT",
  "MESSAGE_EXPIRED",
  "INTERNAL_ERROR",
]);

export const FieldErrorSchema = z.object({ field: z.string(), message: z.string() }).strict();
export const ContractErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1).max(500),
  field_errors: z.array(FieldErrorSchema).max(50).default([]),
  retryable: z.boolean(),
  retry_after_seconds: z.number().int().positive().nullable(),
}).strict();

export const SuccessEnvelopeSchema = <T extends z.ZodType>(data: T) => z.object({
  ok: z.literal(true),
  data,
  request_id: RequestIdSchema,
  repository_head: GitObjectIdSchema.nullable(),
}).strict();

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ContractErrorSchema,
  request_id: RequestIdSchema,
}).strict();

export type Role = z.infer<typeof RoleSchema>;
export type OAuthScope = z.infer<typeof OAuthScopeSchema>;
export type ContractError = z.infer<typeof ContractErrorSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
export type SuccessEnvelope<T> = {
  ok: true;
  data: T;
  request_id: z.infer<typeof RequestIdSchema>;
  repository_head: z.infer<typeof GitObjectIdSchema> | null;
};
export type ToolEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
