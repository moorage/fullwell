import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { assertExportSize } from "../exports/policy.js";
import type {
  GitObjectId,
  HouseholdId,
  MutationState,
  OnboardingRecord,
  OnboardingSection,
  RequestId,
  ToolName,
  UserId,
} from "@hfj/contracts";
import { GitObjectIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type {
  CommitMetadata,
  HouseholdRepositoryPort,
  OperationalStorePort,
  RepositoryChange,
  RepositorySnapshot,
  SessionRecord,
  SessionStorePort,
} from "../core/ports.js";
import { isRestockingSnapshotPath } from "../core/restocking-snapshot.js";
import type {
  BackupCheckpointRecord,
  HouseholdProjection,
  ExportDownloadRecord,
  HouseholdRecord,
  InvitationRecord,
  JsonValue,
  MembershipRecord,
  MutationRecord,
  OperationalHealthSnapshot,
  RepositoryMembershipState,
  RepositoryVerificationRecord,
  RestoreDrillRecord,
  ShareRecord,
} from "../core/types.js";

interface MemoryRepository {
  head: GitObjectId;
  readonly files: Map<string, string>;
  readonly revisions: Map<string, GitObjectId>;
  readonly commits: Array<{ head: GitObjectId; metadata: CommitMetadata; paths: string[] }>;
}

function digest(parts: ReadonlyArray<string>): GitObjectId {
  return GitObjectIdSchema.parse(createHash("sha256").update(parts.join("\0")).digest("hex"));
}

export class MemoryHouseholdRepository implements HouseholdRepositoryPort {
  private readonly repositories = new Map<HouseholdId, MemoryRepository>();

  async provision(householdId: HouseholdId, name: string, actorId: string, _occurredAt: string): Promise<GitObjectId> {
    if (this.repositories.has(householdId)) return this.head(householdId);
    const files = new Map<string, string>([
      ["FORMAT_VERSION", "1\n"],
      ["household.md", `---\nname: ${JSON.stringify(name)}\nschema_version: 1\n---\n`],
      [`members/${actorId}.md`, "---\nrole: owner\nschema_version: 1\n---\n"],
    ]);
    const head = digest([...files.entries()].flat());
    this.repositories.set(householdId, { head, files, revisions: new Map([...files.keys()].map((path) => [path, head])), commits: [] });
    return head;
  }

  async head(householdId: HouseholdId): Promise<GitObjectId> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return repository.head;
  }

  async findCommitByRequestId(householdId: HouseholdId, requestId: RequestId): Promise<GitObjectId | null> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return repository.commits.find((commit) => commit.metadata.requestId === requestId)?.head ?? null;
  }

  async snapshot(householdId: HouseholdId): Promise<RepositorySnapshot> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return {
      head: repository.head,
      files: [...repository.files].map(([path, content]) => ({ path, content, revision: repository.revisions.get(path) ?? repository.head })),
    };
  }

  async restockingSnapshot(householdId: HouseholdId) {
    const snapshot = await this.snapshot(householdId);
    return {
      head: snapshot.head,
      files: snapshot.files.filter((file) => isRestockingSnapshotPath(file.path)).map(({ path, content }) => ({ path, content })),
    };
  }

  async commit(householdId: HouseholdId, expectedHead: GitObjectId, changes: ReadonlyArray<RepositoryChange>, metadata: CommitMetadata): Promise<GitObjectId> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    if (repository.head !== expectedHead) throw new AppError("REVISION_CONFLICT", "The household changed while this request was being prepared");
    for (const change of changes) {
      validateRepositoryPath(change.path);
      if (change.appendOnly && repository.files.has(change.path)) {
        throw new AppError("REVISION_CONFLICT", `Append-only document already exists: ${change.path}`);
      }
    }
    const auditPath = `audit/${metadata.occurredAt.slice(0, 4)}/${metadata.requestId}.json`;
    if (repository.files.has(auditPath)) throw new AppError("REVISION_CONFLICT", "The request already has an audit event");
    for (const change of changes) repository.files.set(change.path, change.content);
    repository.files.set(auditPath, stableJson({
      actor_id: metadata.actorId,
      affected_paths: changes.map((change) => change.path),
      occurred_at: metadata.occurredAt,
      operation: metadata.tool,
      parent_head: expectedHead,
      request_id: metadata.requestId,
      schema_version: 1,
    }));
    const head = digest([expectedHead, metadata.requestId, ...changes.flatMap((change) => [change.path, change.content])]);
    for (const change of changes) repository.revisions.set(change.path, head);
    repository.revisions.set(auditPath, head);
    repository.head = head;
    repository.commits.push({ head, metadata, paths: [...changes.map((change) => change.path), auditPath] });
    return head;
  }

  async read(householdId: HouseholdId, path: string): Promise<string | null> {
    validateRepositoryPath(path);
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return repository.files.get(path) ?? null;
  }

  async bundle(householdId: HouseholdId): Promise<Uint8Array> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    const content = Buffer.from(stableJson({ head: repository.head, files: Object.fromEntries(repository.files) }));
    assertExportSize(content.byteLength);
    return content;
  }
  async readableArchive(householdId: HouseholdId): Promise<Uint8Array> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    const content = zipSync(Object.fromEntries([...repository.files].map(([path, content]) => [path, strToU8(content)])), { level: 6 });
    assertExportSize(content.byteLength);
    return content;
  }

  async verify(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }> {
    const repository = this.repositories.get(householdId);
    return repository === undefined ? { valid: false, detail: "missing" } : { valid: true, detail: repository.head };
  }
  async verifySignatures(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }> {
    const repository = this.repositories.get(householdId);
    return repository === undefined ? { valid: false, detail: "missing" } : { valid: true, detail: repository.head };
  }
  async objectCount(householdId: HouseholdId): Promise<number> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return repository.files.size + repository.commits.length;
  }

  commitCount(householdId: HouseholdId): number { return this.repositories.get(householdId)?.commits.length ?? 0; }
}

export class MemoryOperationalStore implements OperationalStorePort, SessionStorePort {
  private readonly households = new Map<HouseholdId, HouseholdRecord>();
  private readonly memberships = new Map<string, MembershipRecord>();
  private readonly defaultHouseholds = new Map<UserId, HouseholdId>();
  private readonly onboarding = new Map<string, OnboardingRecord>();
  private readonly invitations = new Map<string, InvitationRecord>();
  private readonly shares = new Map<string, ShareRecord>();
  private readonly mutations = new Map<string, MutationRecord>();
  private readonly projections = new Map<HouseholdId, HouseholdProjection>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly exportDownloads = new Map<string, ExportDownloadRecord>();
  private readonly backupCheckpoints = new Map<HouseholdId, BackupCheckpointRecord>();
  private readonly repositoryVerifications = new Map<HouseholdId, RepositoryVerificationRecord>();
  private restoreDrill: RestoreDrillRecord | null = null;
  private readonly lockTails = new Map<HouseholdId, Promise<void>>();

  async createHousehold(record: HouseholdRecord, owner: MembershipRecord): Promise<void> {
    if (this.households.has(record.id)) throw new AppError("VALIDATION_FAILED", "Household already exists");
    this.households.set(record.id, record);
    this.memberships.set(this.membershipKey(record.id, owner.userId), owner);
    this.projections.set(record.id, {
      evidence: new Map(),
      items: new Map(),
      profiles: new Map(),
      collections: new Map(),
      mealPlanningProfile: null,
      mealProposals: new Map(),
      mealPlanEvents: new Map(),
    });
  }
  async updateHouseholdName(householdId: HouseholdId, name: string): Promise<void> {
    const household = await this.getHousehold(householdId);
    if (household === null) throw new AppError("NOT_FOUND", "Household was not found");
    household.name = name;
  }
  async updateHouseholdHead(householdId: HouseholdId, head: GitObjectId): Promise<void> {
    const household = await this.getHousehold(householdId);
    if (household === null) throw new AppError("NOT_FOUND", "Household was not found");
    household.repositoryHead = head;
  }
  async getHousehold(householdId: HouseholdId): Promise<HouseholdRecord | null> { return this.households.get(householdId) ?? null; }
  async listHouseholds(): Promise<ReadonlyArray<HouseholdRecord>> { return [...this.households.values()]; }
  async listMemberships(userId: UserId): Promise<ReadonlyArray<{ household: HouseholdRecord; membership: MembershipRecord }>> {
    return [...this.memberships.values()].filter((membership) => membership.userId === userId && membership.removedAt === null).flatMap((membership) => {
      const household = this.households.get(membership.householdId);
      return household === undefined ? [] : [{ household, membership }];
    });
  }
  async getMembership(householdId: HouseholdId, userId: UserId): Promise<MembershipRecord | null> {
    const membership = this.memberships.get(this.membershipKey(householdId, userId));
    return membership?.removedAt === null ? membership : null;
  }
  async listHouseholdMemberships(householdId: HouseholdId): Promise<ReadonlyArray<MembershipRecord>> {
    return [...this.memberships.values()].filter((membership) => membership.householdId === householdId && membership.removedAt === null);
  }
  async upsertMembership(membership: MembershipRecord): Promise<void> { this.memberships.set(this.membershipKey(membership.householdId, membership.userId), membership); }
  async leaveMembership(userId: UserId, householdId: HouseholdId, removedAt: string): Promise<"left" | "not_found" | "sole_owner"> {
    const membership = this.memberships.get(this.membershipKey(householdId, userId));
    if (membership === undefined || membership.removedAt !== null) return "not_found";
    if (membership.role === "owner" && this.activeOwnerCount(householdId) <= 1) return "sole_owner";
    this.memberships.set(this.membershipKey(householdId, userId), { ...membership, removedAt });
    if (this.defaultHouseholds.get(userId) === householdId) this.defaultHouseholds.delete(userId);
    return "left";
  }
  async setDefaultHousehold(userId: UserId, householdId: HouseholdId): Promise<void> { this.defaultHouseholds.set(userId, householdId); }
  async getDefaultHousehold(userId: UserId): Promise<HouseholdId | null> { return this.defaultHouseholds.get(userId) ?? null; }
  async listOnboardingRecords(userId: UserId, householdId: HouseholdId): Promise<ReadonlyArray<OnboardingRecord>> {
    return [...this.onboarding.values()].filter((record) => record.user_id === userId && record.household_id === householdId);
  }
  async compareAndSetOnboarding(record: OnboardingRecord, expectedRevision: number): Promise<boolean> {
    const key = this.onboardingKey(record.user_id, record.household_id, record.section);
    const current = this.onboarding.get(key);
    if ((current?.revision ?? 0) !== expectedRevision || record.revision !== expectedRevision + 1) return false;
    this.onboarding.set(key, record);
    return true;
  }
  async saveInvitation(invitation: InvitationRecord): Promise<void> { this.invitations.set(invitation.id, invitation); }
  async getInvitation(id: string): Promise<InvitationRecord | null> { return this.invitations.get(id) ?? null; }
  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    return [...this.invitations.values()].find((invitation) => invitation.tokenHash === tokenHash) ?? null;
  }
  async saveShare(share: ShareRecord): Promise<void> { this.shares.set(share.tokenHash, share); }
  async getShareByTokenHash(tokenHash: string): Promise<ShareRecord | null> { return this.shares.get(tokenHash) ?? null; }
  async getShareByCollection(householdId: HouseholdId, collectionId: string): Promise<ShareRecord | null> {
    return [...this.shares.values()].find((share) => share.householdId === householdId && share.collectionId === collectionId) ?? null;
  }
  async getMutation(userId: UserId, tool: ToolName, idempotencyKey: string): Promise<MutationRecord | null> {
    return this.mutations.get(`${userId}\0${tool}\0${idempotencyKey}`) ?? null;
  }
  async saveMutation(record: MutationRecord): Promise<void> {
    const key = `${record.userId}\0${record.tool}\0${record.idempotencyKey}`;
    if (!this.mutations.has(key)) this.mutations.set(key, record);
  }
  async transitionMutation(requestId: RequestId, state: MutationState, update: { commitId?: GitObjectId; response?: Record<string, JsonValue>; failure?: string } = {}): Promise<void> {
    const record = [...this.mutations.values()].find((candidate) => candidate.requestId === requestId);
    if (record === undefined) throw new AppError("INTERNAL_ERROR", "Mutation record was not found");
    record.state = state;
    if (update.commitId !== undefined) record.commitId = update.commitId;
    if (update.response !== undefined) record.response = update.response;
    if (update.failure !== undefined) record.failure = update.failure;
    record.updatedAt = new Date().toISOString();
  }
  async listMutationsForReconciliation(householdId: HouseholdId): Promise<ReadonlyArray<MutationRecord>> {
    return [...this.mutations.values()].filter((record) => record.householdId === householdId && ["received", "locked", "git_committed", "reconciliation_required"].includes(record.state));
  }
  async replaceHouseholdProjection(householdId: HouseholdId, name: string, head: GitObjectId, projection: HouseholdProjection, memberships: ReadonlyArray<RepositoryMembershipState>): Promise<void> {
    const household = this.households.get(householdId);
    if (household === undefined) throw new AppError("NOT_FOUND", "Household was not found");
    household.name = name;
    household.repositoryHead = head;
    household.provisioningState = "ready";
    this.projections.set(householdId, projection);
    for (const state of memberships) {
      const existing = [...this.memberships.values()].find((membership) => membership.householdId === householdId && membership.actorId === state.actorId);
      const userId = existing?.userId ?? state.userId;
      if (userId === null) continue;
      this.memberships.set(this.membershipKey(householdId, userId), {
        householdId, userId, actorId: state.actorId, role: state.role ?? existing?.role ?? "viewer", projectionHead: head, removedAt: state.removedAt,
      });
    }
  }
  async quarantineHousehold(householdId: HouseholdId): Promise<void> {
    const household = this.households.get(householdId);
    if (household === undefined) throw new AppError("NOT_FOUND", "Household was not found");
    household.provisioningState = "quarantined";
  }
  async saveExportDownload(record: ExportDownloadRecord): Promise<void> { this.exportDownloads.set(record.tokenHash, record); }
  async getActiveExportDownload(tokenHash: string, userId: UserId, now: string): Promise<ExportDownloadRecord | null> {
    const record = this.exportDownloads.get(tokenHash);
    return record === undefined || record.requestedBy !== userId || record.downloadedAt !== null || Date.parse(record.expiresAt) <= Date.parse(now) ? null : record;
  }
  async claimExportDownload(tokenHash: string, userId: UserId, downloadedAt: string): Promise<ExportDownloadRecord | null> {
    const record = this.exportDownloads.get(tokenHash);
    if (record === undefined || record.requestedBy !== userId || record.downloadedAt !== null || Date.parse(record.expiresAt) <= Date.parse(downloadedAt)) return null;
    record.downloadedAt = downloadedAt;
    return record;
  }
  async listReclaimableExportDownloads(now: string): Promise<ReadonlyArray<ExportDownloadRecord>> {
    return [...this.exportDownloads.values()].filter((record) => record.downloadedAt !== null || Date.parse(record.expiresAt) <= Date.parse(now));
  }
  async deleteExportDownload(id: string): Promise<void> {
    for (const [tokenHash, record] of this.exportDownloads) if (record.id === id) this.exportDownloads.delete(tokenHash);
  }
  async saveBackupCheckpoint(record: BackupCheckpointRecord): Promise<void> { this.backupCheckpoints.set(record.householdId, record); }
  async getBackupCheckpoint(householdId: HouseholdId): Promise<BackupCheckpointRecord | null> { return this.backupCheckpoints.get(householdId) ?? null; }
  async saveRepositoryVerification(record: RepositoryVerificationRecord): Promise<void> { this.repositoryVerifications.set(record.householdId, record); }
  async saveRestoreDrill(record: RestoreDrillRecord): Promise<void> { this.restoreDrill = record; }
  async operatorHealth(): Promise<OperationalHealthSnapshot> {
    const incomplete = [...this.mutations.values()].filter((record) => ["received", "locked", "git_committed", "projections_applied", "reconciliation_required"].includes(record.state));
    const oldestIncomplete = incomplete.map((record) => record.updatedAt).sort()[0] ?? null;
    const households = [...this.households.values()];
    const verifications = [...this.repositoryVerifications.values()];
    return {
      incompleteMutationCount: incomplete.length,
      reconciliationRequiredCount: incomplete.filter((record) => record.state === "reconciliation_required").length,
      oldestIncompleteMutationAt: oldestIncomplete,
      quarantinedHouseholdCount: households.filter((record) => record.provisioningState === "quarantined").length,
      householdCount: households.length,
      householdsWithoutBackup: households.filter((record) => !this.backupCheckpoints.has(record.id)).length,
      oldestBackupAt: [...this.backupCheckpoints.values()].map((record) => record.completedAt).sort()[0] ?? null,
      lastFsckAt: verifications.map((record) => record.checkedAt).sort().at(-1) ?? null,
      fsckFailureCount: verifications.filter((record) => !record.fsckValid).length,
      lastSignatureCheckAt: verifications.map((record) => record.checkedAt).sort().at(-1) ?? null,
      signatureFailureCount: verifications.filter((record) => !record.signaturesValid).length,
      lastRestoreDrillAt: this.restoreDrill?.completedAt ?? null,
      lastRestoreDrillSucceeded: this.restoreDrill?.succeeded ?? null,
      schemaVersion: "memory",
    };
  }
  async withHouseholdLock<T>(householdId: HouseholdId, operation: () => Promise<T>): Promise<T> {
    const previous = this.lockTails.get(householdId) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    this.lockTails.set(householdId, tail);
    await previous;
    try { return await operation(); } finally {
      release();
      if (this.lockTails.get(householdId) === tail) this.lockTails.delete(householdId);
    }
  }
  async projection(householdId: HouseholdId): Promise<HouseholdProjection> {
    const projection = this.projections.get(householdId);
    if (projection === undefined) throw new AppError("NOT_FOUND", "Household projection was not found");
    return projection;
  }
  async health(): Promise<{ ready: boolean; detail: string }> { return { ready: true, detail: "memory" }; }
  async getByToken(token: string): Promise<SessionRecord | null> { return this.sessions.get(token) ?? null; }
  async revokeUser(userId: UserId): Promise<void> {
    for (const [token, session] of this.sessions) if (session.userId === userId) this.sessions.delete(token);
  }
  addSession(token: string, session: SessionRecord): void { this.sessions.set(token, session); }

  private membershipKey(householdId: HouseholdId, userId: UserId): string { return `${householdId}\0${userId}`; }
  private onboardingKey(userId: UserId, householdId: HouseholdId, section: OnboardingSection): string { return `${userId}\0${householdId}\0${section}`; }
  private activeOwnerCount(householdId: HouseholdId): number {
    return [...this.memberships.values()].filter((membership) => membership.householdId === householdId && membership.removedAt === null && membership.role === "owner").length;
  }
}

export function stableJson(value: object): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sort(child)]));
    }
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function validateRepositoryPath(path: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,499}$/.test(path) || path.includes("..") || path.includes("//") || path.startsWith("/") || path.endsWith("/")) {
    throw new AppError("VALIDATION_FAILED", "Repository path is invalid");
  }
}
