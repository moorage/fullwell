import type {
  GitObjectId,
  HouseholdId,
  MutationState,
  OAuthScope,
  RequestId,
  ToolName,
  UserId,
} from "@hfj/contracts";
import type {
  HouseholdProjection,
  HouseholdRecord,
  ExportDownloadRecord,
  InvitationRecord,
  JsonValue,
  MembershipRecord,
  MutationRecord,
  Principal,
  RepositoryMembershipState,
  ShareRecord,
} from "./types.js";

export interface Clock {
  now(): Date;
}

export interface RandomSource {
  opaqueId(prefix: string): string;
  token(bytes: number): string;
}

export interface TokenHasher {
  hash(token: string): string;
  matches(token: string, digest: string): boolean;
}

export interface AuthenticationPort {
  authenticate(authorization: string | undefined): Promise<Principal>;
}

export interface MailPort {
  sendMagicLink(recipient: string, url: URL): Promise<void>;
  sendInvitation(recipient: string, url: URL): Promise<void>;
}

export interface IdentityProviderPort {
  exchangeAppleCode(code: string, redirectUri: string, nonce: string): Promise<{ subject: string; email: string | null; name: string | null }>;
}

export interface TelemetryPort {
  event(name: string, attributes: Readonly<Record<string, string | number | boolean>>): void;
  error(name: string, error: Error, attributes: Readonly<Record<string, string | number | boolean>>): void;
}

export interface BackupPort {
  uploadBundle(householdId: HouseholdId, bundle: Uint8Array, manifest: string): Promise<void>;
}

export interface ExportArtifactPort {
  write(id: string, content: Uint8Array): Promise<string>;
  read(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
}

export interface RepositoryChange {
  readonly path: string;
  readonly content: string;
  readonly appendOnly: boolean;
}

export interface CommitMetadata {
  readonly requestId: RequestId;
  readonly householdId: HouseholdId;
  readonly actorId: string;
  readonly tool: ToolName;
  readonly client: Principal["client"];
  readonly summary: string;
  readonly occurredAt: string;
}


export interface RepositorySnapshot {
  readonly head: GitObjectId;
  readonly files: ReadonlyArray<{ readonly path: string; readonly content: string; readonly revision: GitObjectId }>;
}

export interface HouseholdRepositoryPort {
  provision(householdId: HouseholdId, name: string, actorId: string, occurredAt: string): Promise<GitObjectId>;
  head(householdId: HouseholdId): Promise<GitObjectId>;
  findCommitByRequestId(householdId: HouseholdId, requestId: RequestId): Promise<GitObjectId | null>;
  snapshot(householdId: HouseholdId): Promise<RepositorySnapshot>;
  commit(householdId: HouseholdId, expectedHead: GitObjectId, changes: ReadonlyArray<RepositoryChange>, metadata: CommitMetadata): Promise<GitObjectId>;
  read(householdId: HouseholdId, path: string): Promise<string | null>;
  bundle(householdId: HouseholdId): Promise<Uint8Array>;
  readableArchive(householdId: HouseholdId): Promise<Uint8Array>;
  verify(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }>;
}

export interface OperationalStorePort {
  createHousehold(record: HouseholdRecord, owner: MembershipRecord): Promise<void>;
  updateHouseholdHead(householdId: HouseholdId, head: GitObjectId): Promise<void>;
  getHousehold(householdId: HouseholdId): Promise<HouseholdRecord | null>;
  listHouseholds(): Promise<ReadonlyArray<HouseholdRecord>>;
  listMemberships(userId: UserId): Promise<ReadonlyArray<{ household: HouseholdRecord; membership: MembershipRecord }>>;
  getMembership(householdId: HouseholdId, userId: UserId): Promise<MembershipRecord | null>;
  listHouseholdMemberships(householdId: HouseholdId): Promise<ReadonlyArray<MembershipRecord>>;
  upsertMembership(membership: MembershipRecord): Promise<void>;
  leaveMembership(userId: UserId, householdId: HouseholdId, removedAt: string): Promise<"left" | "not_found" | "sole_owner">;
  setDefaultHousehold(userId: UserId, householdId: HouseholdId): Promise<void>;
  getDefaultHousehold(userId: UserId): Promise<HouseholdId | null>;
  saveInvitation(invitation: InvitationRecord): Promise<void>;
  getInvitation(id: string): Promise<InvitationRecord | null>;
  findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null>;
  saveShare(share: ShareRecord): Promise<void>;
  getShareByTokenHash(tokenHash: string): Promise<ShareRecord | null>;
  getShareByCollection(householdId: HouseholdId, collectionId: string): Promise<ShareRecord | null>;
  getMutation(userId: UserId, tool: ToolName, idempotencyKey: string): Promise<MutationRecord | null>;
  saveMutation(record: MutationRecord): Promise<void>;
  transitionMutation(requestId: RequestId, state: MutationState, update?: { commitId?: GitObjectId; response?: Record<string, JsonValue>; failure?: string }): Promise<void>;
  listMutationsForReconciliation(householdId: HouseholdId): Promise<ReadonlyArray<MutationRecord>>;
  replaceHouseholdProjection(householdId: HouseholdId, head: GitObjectId, projection: HouseholdProjection, memberships: ReadonlyArray<RepositoryMembershipState>): Promise<void>;
  quarantineHousehold(householdId: HouseholdId): Promise<void>;
  saveExportDownload(record: ExportDownloadRecord): Promise<void>;
  getActiveExportDownload(tokenHash: string, userId: UserId, now: string): Promise<ExportDownloadRecord | null>;
  claimExportDownload(tokenHash: string, userId: UserId, downloadedAt: string): Promise<ExportDownloadRecord | null>;
  listReclaimableExportDownloads(now: string): Promise<ReadonlyArray<ExportDownloadRecord>>;
  deleteExportDownload(id: string): Promise<void>;
  withHouseholdLock<T>(householdId: HouseholdId, operation: () => Promise<T>): Promise<T>;
  projection(householdId: HouseholdId): Promise<HouseholdProjection>;
  health(): Promise<{ ready: boolean; detail: string }>;
}

export interface SessionRecord {
  readonly userId: UserId;
  readonly actorId: string;
  readonly displayName: string;
  readonly scopes: ReadonlySet<OAuthScope>;
  readonly client: Principal["client"];
}

export interface SessionStorePort {
  getByToken(token: string): Promise<SessionRecord | null>;
  revokeUser(userId: UserId): Promise<void>;
}
