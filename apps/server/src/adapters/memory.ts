import { createHash } from "node:crypto";
import type {
  GitObjectId,
  HouseholdId,
  MutationState,
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
  SessionRecord,
  SessionStorePort,
} from "../core/ports.js";
import type {
  HouseholdProjection,
  HouseholdRecord,
  InvitationRecord,
  JsonValue,
  MembershipRecord,
  MutationRecord,
  ShareRecord,
} from "../core/types.js";

interface MemoryRepository {
  head: GitObjectId;
  readonly files: Map<string, string>;
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
    this.repositories.set(householdId, { head, files, commits: [] });
    return head;
  }

  async head(householdId: HouseholdId): Promise<GitObjectId> {
    const repository = this.repositories.get(householdId);
    if (repository === undefined) throw new AppError("NOT_FOUND", "Household repository was not found");
    return repository.head;
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
    return Buffer.from(stableJson({ head: repository.head, files: Object.fromEntries(repository.files) }));
  }

  async verify(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }> {
    const repository = this.repositories.get(householdId);
    return repository === undefined ? { valid: false, detail: "missing" } : { valid: true, detail: repository.head };
  }

  commitCount(householdId: HouseholdId): number { return this.repositories.get(householdId)?.commits.length ?? 0; }
}

export class MemoryOperationalStore implements OperationalStorePort, SessionStorePort {
  private readonly households = new Map<HouseholdId, HouseholdRecord>();
  private readonly memberships = new Map<string, MembershipRecord>();
  private readonly defaultHouseholds = new Map<UserId, HouseholdId>();
  private readonly invitations = new Map<string, InvitationRecord>();
  private readonly shares = new Map<string, ShareRecord>();
  private readonly mutations = new Map<string, MutationRecord>();
  private readonly projections = new Map<HouseholdId, HouseholdProjection>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly lockTails = new Map<HouseholdId, Promise<void>>();

  async createHousehold(record: HouseholdRecord, owner: MembershipRecord): Promise<void> {
    if (this.households.has(record.id)) throw new AppError("VALIDATION_FAILED", "Household already exists");
    this.households.set(record.id, record);
    this.memberships.set(this.membershipKey(record.id, owner.userId), owner);
    this.projections.set(record.id, { evidence: new Map(), items: new Map(), profiles: new Map(), collections: new Map() });
  }
  async updateHouseholdHead(householdId: HouseholdId, head: GitObjectId): Promise<void> {
    const household = await this.getHousehold(householdId);
    if (household === null) throw new AppError("NOT_FOUND", "Household was not found");
    household.repositoryHead = head;
  }
  async getHousehold(householdId: HouseholdId): Promise<HouseholdRecord | null> { return this.households.get(householdId) ?? null; }
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
  async setDefaultHousehold(userId: UserId, householdId: HouseholdId): Promise<void> { this.defaultHouseholds.set(userId, householdId); }
  async getDefaultHousehold(userId: UserId): Promise<HouseholdId | null> { return this.defaultHouseholds.get(userId) ?? null; }
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
    this.mutations.set(`${record.userId}\0${record.tool}\0${record.idempotencyKey}`, record);
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
  async withHouseholdLock<T>(householdId: HouseholdId, operation: () => Promise<T>): Promise<T> {
    const previous = this.lockTails.get(householdId) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.lockTails.set(householdId, previous.then(() => current));
    await previous;
    try { return await operation(); } finally {
      release();
      if (this.lockTails.get(householdId) === current) this.lockTails.delete(householdId);
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
