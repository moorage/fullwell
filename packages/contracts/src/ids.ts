import { z } from "zod";

const opaqueId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[0-9a-z]{16,64}$`));

export const UserIdSchema = opaqueId("usr").brand<"UserId">();
export const HouseholdIdSchema = opaqueId("hsh").brand<"HouseholdId">();
export const ActorIdSchema = opaqueId("act").brand<"ActorId">();
export const ItemIdSchema = opaqueId("itm").brand<"ItemId">();
export const EvidenceIdSchema = opaqueId("evd").brand<"EvidenceId">();
export const CollectionIdSchema = opaqueId("col").brand<"CollectionId">();
export const SnapshotIdSchema = opaqueId("snp").brand<"SnapshotId">();
export const InvitationIdSchema = opaqueId("inv").brand<"InvitationId">();
export const ImportIdSchema = opaqueId("imp").brand<"ImportId">();
export const RequestIdSchema = opaqueId("req").brand<"RequestId">();
export const ShareIdSchema = opaqueId("shr").brand<"ShareId">();
export const SessionIdSchema = opaqueId("ses").brand<"SessionId">();
export const MutationIdSchema = opaqueId("mut").brand<"MutationId">();
export const GitObjectIdSchema = z.string().regex(/^[0-9a-f]{40,64}$/).brand<"GitObjectId">();

export type UserId = z.infer<typeof UserIdSchema>;
export type HouseholdId = z.infer<typeof HouseholdIdSchema>;
export type ActorId = z.infer<typeof ActorIdSchema>;
export type ItemId = z.infer<typeof ItemIdSchema>;
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;
export type CollectionId = z.infer<typeof CollectionIdSchema>;
export type SnapshotId = z.infer<typeof SnapshotIdSchema>;
export type InvitationId = z.infer<typeof InvitationIdSchema>;
export type ImportId = z.infer<typeof ImportIdSchema>;
export type RequestId = z.infer<typeof RequestIdSchema>;
export type ShareId = z.infer<typeof ShareIdSchema>;
export type SessionId = z.infer<typeof SessionIdSchema>;
export type MutationId = z.infer<typeof MutationIdSchema>;
export type GitObjectId = z.infer<typeof GitObjectIdSchema>;
