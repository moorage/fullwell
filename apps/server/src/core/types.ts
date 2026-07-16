import type {
  ActorId,
  CollectionId,
  CollectionSnapshot,
  ContractError,
  Evidence,
  GitObjectId,
  HouseholdId,
  InvitationId,
  JournalItem,
  MutationState,
  OAuthScope,
  RequestId,
  Role,
  ShareId,
  ToolName,
  UserId,
} from "@hfj/contracts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type ErrorCode = ContractError["code"];

export interface Principal {
  readonly userId: UserId;
  readonly actorId: ActorId;
  readonly displayName: string;
  readonly scopes: ReadonlySet<OAuthScope>;
  readonly client: "web" | "codex" | "claude" | "test";
}

export interface HouseholdRecord {
  readonly id: HouseholdId;
  name: string;
  repositoryHead: GitObjectId;
  provisioningState: "ready" | "failed" | "quarantined";
  readonly createdAt: string;
}

export interface MembershipRecord {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly actorId: ActorId;
  role: Role;
  projectionHead: GitObjectId;
  removedAt: string | null;
}

export interface InvitationRecord {
  readonly id: InvitationId;
  readonly householdId: HouseholdId;
  readonly tokenHash: string;
  readonly role: Exclude<Role, "owner">;
  readonly expiresAt: string;
  readonly intendedEmailHint: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface ShareRecord {
  readonly id: ShareId;
  readonly collectionId: CollectionId;
  readonly householdId: HouseholdId;
  readonly tokenHash: string;
  readonly snapshot: CollectionSnapshot;
  readonly expiresAt: string;
  revokedAt: string | null;
}

export interface MutationRecord {
  readonly requestId: RequestId;
  readonly userId: UserId;
  readonly tool: ToolName;
  readonly idempotencyKey: string;
  readonly householdId: HouseholdId | null;
  state: MutationState;
  commitId: GitObjectId | null;
  response: Record<string, JsonValue> | null;
  failure: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface HouseholdProjection {
  readonly evidence: Map<string, Evidence>;
  readonly items: Map<string, { item: JournalItem; revision: GitObjectId }>;
  readonly profiles: Map<string, { markdown: string; revision: GitObjectId }>;
  readonly collections: Map<string, { snapshot: CollectionSnapshot; revision: GitObjectId }>;
}

export interface RepositoryMembershipState {
  readonly actorId: ActorId;
  readonly role: Role | null;
  readonly removedAt: string | null;
  readonly userId: UserId | null;
}

export interface ExportDownloadRecord {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly requestedBy: UserId;
  readonly format: "readable_zip" | "git_bundle";
  readonly tokenHash: string;
  readonly objectPath: string;
  readonly contentHash: string;
  readonly repositoryHead: GitObjectId;
  readonly expiresAt: string;
  downloadedAt: string | null;
  readonly createdAt: string;
}
