import { AsyncLocalStorage } from "node:async_hooks";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import {
  ActorIdSchema,
  CollectionIdSchema,
  CollectionSnapshotSchema,
  EvidenceSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
  JournalItemSchema,
  MutationStateSchema,
  OAuthScopeSchema,
  RequestIdSchema,
  RoleSchema,
  ShareIdSchema,
  ToolNameSchema,
  UserIdSchema,
  type GitObjectId,
  type HouseholdId,
  type MutationState,
  type RequestId,
  type ToolName,
  type UserId,
} from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { OperationalStorePort, SessionRecord, SessionStorePort, TokenHasher } from "../core/ports.js";
import type {
  BackupCheckpointRecord,
  HouseholdProjection,
  HouseholdRecord,
  ExportDownloadRecord,
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
import { NeonConnection } from "./neon.js";

type Queryable = Sql | TransactionSql;

type TransactionContext = {
  readonly householdId: HouseholdId;
  readonly sql: TransactionSql;
  readonly projections: Map<HouseholdId, HouseholdProjection>;
};

const TimestampSchema = z.union([z.date(), z.string().min(1)]).transform((value) => new Date(value).toISOString());
const NullableTimestampSchema = z.union([z.date(), z.string().min(1)]).nullable().transform((value) => value === null ? null : new Date(value).toISOString());

const HouseholdRowSchema = z.object({
  id: HouseholdIdSchema,
  display_name: z.string(),
  repository_head: GitObjectIdSchema,
  provisioning_state: z.enum(["ready", "failed", "quarantined"]),
  created_at: TimestampSchema,
});

const MembershipRowSchema = z.object({
  household_id: HouseholdIdSchema,
  user_id: UserIdSchema,
  actor_id: ActorIdSchema,
  role: RoleSchema,
  projection_head: GitObjectIdSchema,
  removed_at: NullableTimestampSchema,
});

const InvitationRowSchema = z.object({
  id: InvitationIdSchema,
  household_id: HouseholdIdSchema,
  token_hash: z.string().min(1),
  role: z.enum(["editor", "viewer"]),
  expires_at: TimestampSchema,
  intended_email_hint: z.string().nullable(),
  accepted_at: NullableTimestampSchema,
  revoked_at: NullableTimestampSchema,
});

const ShareRowSchema = z.object({
  id: ShareIdSchema,
  collection_id: CollectionIdSchema,
  household_id: HouseholdIdSchema,
  token_hash: z.string().min(1),
  snapshot: CollectionSnapshotSchema,
  expires_at: TimestampSchema,
  revoked_at: NullableTimestampSchema,
});

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(JsonValueSchema),
  z.record(z.string(), JsonValueSchema),
]));

const MutationRowSchema = z.object({
  request_id: RequestIdSchema,
  user_id: UserIdSchema,
  tool_name: ToolNameSchema,
  idempotency_key: z.string(),
  household_id: HouseholdIdSchema.nullable(),
  state: MutationStateSchema,
  commit_id: GitObjectIdSchema.nullable(),
  response: z.record(z.string(), JsonValueSchema).nullable(),
  failure_code: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

const ProjectionDocumentSchema = z.object({
  evidence: z.record(z.string(), EvidenceSchema),
  items: z.record(z.string(), z.object({ item: JournalItemSchema, revision: GitObjectIdSchema })),
  profiles: z.record(z.string(), z.object({ markdown: z.string(), revision: GitObjectIdSchema })),
  collections: z.record(z.string(), z.object({ snapshot: CollectionSnapshotSchema, revision: GitObjectIdSchema })),
}).strict();

const SessionRowSchema = z.object({
  user_id: UserIdSchema,
  actor_id: ActorIdSchema,
  display_name: z.string().min(1),
  scopes: z.array(OAuthScopeSchema).min(1),
  client: z.enum(["web", "codex", "claude", "test"]),
});

export class NeonOperationalStore implements OperationalStorePort, SessionStorePort {
  private readonly transaction = new AsyncLocalStorage<TransactionContext>();

  constructor(
    private readonly connection: NeonConnection,
    private readonly tokenHasher: TokenHasher,
  ) {}

  async createHousehold(record: HouseholdRecord, owner: MembershipRecord): Promise<void> {
    await this.inTransaction(async (sql) => {
      await sql`
        INSERT INTO households (id, display_name, repository_path, repository_head, provisioning_state, created_at, updated_at)
        VALUES (${record.id}, ${record.name}, ${record.id}, ${record.repositoryHead}, ${record.provisioningState}, ${record.createdAt}, ${record.createdAt})
      `;
      await this.upsertMembershipWith(sql, owner);
      await sql`
        INSERT INTO journal_projections (household_id, repository_head, projection)
        VALUES (${record.id}, ${record.repositoryHead}, ${sql.json(this.projectionDocument(emptyProjection()))})
      `;
    });
  }

  async updateHouseholdHead(householdId: HouseholdId, head: GitObjectId): Promise<void> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      UPDATE households SET repository_head = ${head}, updated_at = now()
      WHERE id = ${householdId}
      RETURNING id
    `;
    if (rows.length !== 1) throw new AppError("NOT_FOUND", "Household was not found");
  }

  async getHousehold(householdId: HouseholdId): Promise<HouseholdRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, display_name, repository_head, provisioning_state, created_at
      FROM households WHERE id = ${householdId}
    `;
    return rows[0] === undefined ? null : householdFromRow(rows[0]);
  }

  async listHouseholds(): Promise<ReadonlyArray<HouseholdRecord>> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, display_name, repository_head, provisioning_state, created_at
      FROM households ORDER BY created_at, id
    `;
    return rows.map(householdFromRow);
  }

  async listMemberships(userId: UserId): Promise<readonly { household: HouseholdRecord; membership: MembershipRecord }[]> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT
        h.id, h.display_name, h.repository_head, h.provisioning_state, h.created_at,
        m.household_id, m.user_id, m.actor_id, m.role, m.projection_head, m.removed_at
      FROM memberships m
      JOIN households h ON h.id = m.household_id
      WHERE m.user_id = ${userId} AND m.removed_at IS NULL
      ORDER BY h.created_at, h.id
    `;
    return rows.map((row) => ({ household: householdFromRow(row), membership: membershipFromRow(row) }));
  }

  async getMembership(householdId: HouseholdId, userId: UserId): Promise<MembershipRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT household_id, user_id, actor_id, role, projection_head, removed_at
      FROM memberships
      WHERE household_id = ${householdId} AND user_id = ${userId} AND removed_at IS NULL
    `;
    return rows[0] === undefined ? null : membershipFromRow(rows[0]);
  }

  async listHouseholdMemberships(householdId: HouseholdId): Promise<readonly MembershipRecord[]> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT household_id, user_id, actor_id, role, projection_head, removed_at
      FROM memberships
      WHERE household_id = ${householdId} AND removed_at IS NULL
      ORDER BY created_at, user_id
    `;
    return rows.map(membershipFromRow);
  }

  async upsertMembership(membership: MembershipRecord): Promise<void> {
    await this.upsertMembershipWith(this.sql(), membership);
  }

  async leaveMembership(userId: UserId, householdId: HouseholdId, removedAt: string): Promise<"left" | "not_found" | "sole_owner"> {
    const active = this.transaction.getStore();
    if (active !== undefined) return await this.leaveMembershipWith(active.sql, userId, householdId, removedAt);
    return await this.connection.pooled.begin(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${householdId}, 0))`;
      return await this.leaveMembershipWith(sql, userId, householdId, removedAt);
    }) as "left" | "not_found" | "sole_owner";
  }

  async setDefaultHousehold(userId: UserId, householdId: HouseholdId): Promise<void> {
    await this.sql()`
      INSERT INTO user_preferences (user_id, default_household_id, updated_at)
      VALUES (${userId}, ${householdId}, now())
      ON CONFLICT (user_id) DO UPDATE
      SET default_household_id = EXCLUDED.default_household_id, updated_at = now()
    `;
  }

  async getDefaultHousehold(userId: UserId): Promise<HouseholdId | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT default_household_id FROM user_preferences WHERE user_id = ${userId}
    `;
    if (rows[0] === undefined) return null;
    return HouseholdIdSchema.nullable().parse(rows[0].default_household_id);
  }

  async saveInvitation(invitation: InvitationRecord): Promise<void> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      INSERT INTO family_invitations (
        id, household_id, token_hash, role, intended_email_hint, expires_at,
        accepted_at, revoked_at, created_by
      )
      SELECT
        ${invitation.id}, ${invitation.householdId}, ${invitation.tokenHash}, ${invitation.role},
        ${invitation.intendedEmailHint}, ${invitation.expiresAt}, ${invitation.acceptedAt},
        ${invitation.revokedAt}, user_id
      FROM memberships
      WHERE household_id = ${invitation.householdId} AND role = 'owner' AND removed_at IS NULL
      ORDER BY created_at LIMIT 1
      ON CONFLICT (id) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        role = EXCLUDED.role,
        intended_email_hint = EXCLUDED.intended_email_hint,
        expires_at = EXCLUDED.expires_at,
        accepted_at = EXCLUDED.accepted_at,
        revoked_at = EXCLUDED.revoked_at
      RETURNING id
    `;
    if (rows.length !== 1) throw new AppError("INTERNAL_ERROR", "Invitation owner was not found");
  }

  async getInvitation(id: string): Promise<InvitationRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, household_id, token_hash, role, expires_at, intended_email_hint, accepted_at, revoked_at
      FROM family_invitations WHERE id = ${id}
    `;
    return rows[0] === undefined ? null : invitationFromRow(rows[0]);
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, household_id, token_hash, role, expires_at, intended_email_hint, accepted_at, revoked_at
      FROM family_invitations WHERE token_hash = ${tokenHash}
    `;
    return rows[0] === undefined ? null : invitationFromRow(rows[0]);
  }

  async saveShare(share: ShareRecord): Promise<void> {
    const sql = this.sql();
    const rows = await sql<Record<string, unknown>[]>`
      INSERT INTO collection_shares (
        id, household_id, collection_id, token_hash, snapshot, expires_at, revoked_at, created_by
      )
      SELECT
        ${share.id}, ${share.householdId}, ${share.collectionId}, ${share.tokenHash},
        ${sql.json(share.snapshot)}, ${share.expiresAt}, ${share.revokedAt}, user_id
      FROM memberships
      WHERE household_id = ${share.householdId} AND role = 'owner' AND removed_at IS NULL
      ORDER BY created_at LIMIT 1
      ON CONFLICT (id) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        snapshot = EXCLUDED.snapshot,
        expires_at = EXCLUDED.expires_at,
        revoked_at = EXCLUDED.revoked_at
      RETURNING id
    `;
    if (rows.length !== 1) throw new AppError("INTERNAL_ERROR", "Collection share owner was not found");
  }

  async getShareByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, collection_id, household_id, token_hash, snapshot, expires_at, revoked_at
      FROM collection_shares WHERE token_hash = ${tokenHash}
    `;
    return rows[0] === undefined ? null : shareFromRow(rows[0]);
  }

  async getShareByCollection(householdId: HouseholdId, collectionId: string): Promise<ShareRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, collection_id, household_id, token_hash, snapshot, expires_at, revoked_at
      FROM collection_shares
      WHERE household_id = ${householdId} AND collection_id = ${collectionId}
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] === undefined ? null : shareFromRow(rows[0]);
  }

  async getMutation(userId: UserId, tool: ToolName, idempotencyKey: string): Promise<MutationRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT request_id, user_id, tool_name, idempotency_key, household_id, state,
             commit_id, response, failure_code, created_at, updated_at
      FROM mutation_requests
      WHERE user_id = ${userId} AND tool_name = ${tool} AND idempotency_key = ${idempotencyKey}
    `;
    return rows[0] === undefined ? null : mutationFromRow(rows[0]);
  }

  async saveMutation(record: MutationRecord): Promise<void> {
    const sql = this.sql();
    await sql`
      INSERT INTO mutation_requests (
        request_id, user_id, household_id, tool_name, idempotency_key, state,
        commit_id, response, failure_code, created_at, updated_at
      ) VALUES (
        ${record.requestId}, ${record.userId}, ${record.householdId}, ${record.tool},
        ${record.idempotencyKey}, ${record.state}, ${record.commitId},
        ${record.response === null ? null : sql.json(record.response)}::jsonb,
        ${record.failure}, ${record.createdAt}, ${record.updatedAt}
      )
      ON CONFLICT (user_id, tool_name, idempotency_key) DO NOTHING
    `;
  }

  async transitionMutation(
    requestId: RequestId,
    state: MutationState,
    update: { commitId?: GitObjectId; response?: Record<string, JsonValue>; failure?: string } = {},
  ): Promise<void> {
    if (state === "projections_applied") await this.flushTransactionProjections(requestId);
    const sql = this.sql();
    const rows = await sql<Record<string, unknown>[]>`
      UPDATE mutation_requests SET
        state = ${state},
        commit_id = COALESCE(${update.commitId ?? null}, commit_id),
        response = COALESCE(${update.response === undefined ? null : sql.json(update.response)}::jsonb, response),
        failure_code = COALESCE(${update.failure ?? null}, failure_code),
        updated_at = now()
      WHERE request_id = ${requestId}
      RETURNING request_id
    `;
    if (rows.length !== 1) throw new AppError("INTERNAL_ERROR", "Mutation record was not found");
  }

  async listMutationsForReconciliation(householdId: HouseholdId): Promise<ReadonlyArray<MutationRecord>> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT request_id, user_id, tool_name, idempotency_key, household_id, state,
             commit_id, response, failure_code, created_at, updated_at
      FROM mutation_requests
      WHERE household_id = ${householdId}
        AND state IN ('received', 'locked', 'git_committed', 'reconciliation_required')
      ORDER BY created_at, request_id
    `;
    return rows.map(mutationFromRow);
  }

  async replaceHouseholdProjection(
    householdId: HouseholdId,
    head: GitObjectId,
    projection: HouseholdProjection,
    memberships: ReadonlyArray<RepositoryMembershipState>,
  ): Promise<void> {
    const sql = this.sql();
    const projectionRows = await sql<Record<string, unknown>[]>`
      UPDATE journal_projections
      SET repository_head = ${head}, projection = ${sql.json(this.projectionDocument(projection))}, rebuilt_at = now()
      WHERE household_id = ${householdId}
      RETURNING household_id
    `;
    if (projectionRows.length !== 1) throw new AppError("NOT_FOUND", "Household projection was not found");
    await sql`UPDATE households SET repository_head = ${head}, provisioning_state = 'ready', updated_at = now() WHERE id = ${householdId}`;
    for (const membership of memberships) {
      const existing = await sql<{ user_id: string; role: string }[]>`
        SELECT user_id, role FROM memberships WHERE household_id = ${householdId} AND actor_id = ${membership.actorId}
      `;
      const userId = existing[0]?.user_id ?? membership.userId;
      if (userId === null) continue;
      const role = membership.role ?? existing[0]?.role ?? "viewer";
      await sql`
        INSERT INTO memberships (household_id, user_id, actor_id, role, projection_head, removed_at, updated_at)
        VALUES (${householdId}, ${userId}, ${membership.actorId}, ${role}, ${head}, ${membership.removedAt}, now())
        ON CONFLICT (household_id, user_id) DO UPDATE SET
          actor_id = EXCLUDED.actor_id,
          role = EXCLUDED.role,
          projection_head = EXCLUDED.projection_head,
          removed_at = EXCLUDED.removed_at,
          updated_at = now()
      `;
    }
  }

  async quarantineHousehold(householdId: HouseholdId): Promise<void> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      UPDATE households SET provisioning_state = 'quarantined', updated_at = now()
      WHERE id = ${householdId}
      RETURNING id
    `;
    if (rows.length !== 1) throw new AppError("NOT_FOUND", "Household was not found");
  }

  async saveExportDownload(record: ExportDownloadRecord): Promise<void> {
    await this.sql()`
      INSERT INTO export_downloads (
        id, household_id, requested_by, format, token_hash, object_path,
        content_hash, repository_head, expires_at, downloaded_at, created_at
      ) VALUES (
        ${record.id}, ${record.householdId}, ${record.requestedBy}, ${record.format}, ${record.tokenHash}, ${record.objectPath},
        ${record.contentHash}, ${record.repositoryHead}, ${record.expiresAt}, ${record.downloadedAt}, ${record.createdAt}
      )
    `;
  }

  async getActiveExportDownload(tokenHash: string, userId: UserId, now: string): Promise<ExportDownloadRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, household_id, requested_by, format, token_hash, object_path,
             content_hash, repository_head, expires_at, downloaded_at, created_at
      FROM export_downloads
      WHERE token_hash = ${tokenHash} AND requested_by = ${userId}
        AND downloaded_at IS NULL AND expires_at > ${now}
    `;
    return rows[0] === undefined ? null : exportDownloadFromRow(rows[0]);
  }

  async claimExportDownload(tokenHash: string, userId: UserId, downloadedAt: string): Promise<ExportDownloadRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      UPDATE export_downloads SET downloaded_at = ${downloadedAt}
      WHERE token_hash = ${tokenHash} AND requested_by = ${userId}
        AND downloaded_at IS NULL AND expires_at > ${downloadedAt}
      RETURNING id, household_id, requested_by, format, token_hash, object_path,
                content_hash, repository_head, expires_at, downloaded_at, created_at
    `;
    return rows[0] === undefined ? null : exportDownloadFromRow(rows[0]);
  }

  async listReclaimableExportDownloads(now: string): Promise<ReadonlyArray<ExportDownloadRecord>> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT id, household_id, requested_by, format, token_hash, object_path,
             content_hash, repository_head, expires_at, downloaded_at, created_at
      FROM export_downloads
      WHERE downloaded_at IS NOT NULL OR expires_at <= ${now}
      ORDER BY created_at, id
    `;
    return rows.map(exportDownloadFromRow);
  }

  async deleteExportDownload(id: string): Promise<void> {
    await this.sql()`DELETE FROM export_downloads WHERE id = ${id}`;
  }

  async saveBackupCheckpoint(record: BackupCheckpointRecord): Promise<void> {
    await this.sql()`
      INSERT INTO backup_checkpoints (
        household_id, repository_head, manifest_hash, bundle_hash, object_key,
        manifest_object_key, completed_at, verified_at, retained_until
      ) VALUES (
        ${record.householdId}, ${record.repositoryHead}, ${record.manifestHash}, ${record.bundleHash}, ${record.objectKey},
        ${record.manifestObjectKey}, ${record.completedAt}, ${record.verifiedAt}, ${record.retainedUntil}
      )
      ON CONFLICT (household_id) DO UPDATE SET
        repository_head = EXCLUDED.repository_head,
        manifest_hash = EXCLUDED.manifest_hash,
        bundle_hash = EXCLUDED.bundle_hash,
        object_key = EXCLUDED.object_key,
        manifest_object_key = EXCLUDED.manifest_object_key,
        completed_at = EXCLUDED.completed_at,
        verified_at = EXCLUDED.verified_at,
        retained_until = EXCLUDED.retained_until
    `;
  }

  async getBackupCheckpoint(householdId: HouseholdId): Promise<BackupCheckpointRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT household_id, repository_head, manifest_hash, bundle_hash, object_key,
             manifest_object_key, completed_at, verified_at, retained_until
      FROM backup_checkpoints
      WHERE household_id = ${householdId}
        AND bundle_hash IS NOT NULL AND manifest_object_key IS NOT NULL AND verified_at IS NOT NULL AND retained_until IS NOT NULL
    `;
    return rows[0] === undefined ? null : backupCheckpointFromRow(rows[0]);
  }

  async saveRepositoryVerification(record: RepositoryVerificationRecord): Promise<void> {
    await this.sql()`
      INSERT INTO repository_verification_checkpoints (
        household_id, repository_head, fsck_valid, signatures_valid, checked_at, detail_code
      ) VALUES (
        ${record.householdId}, ${record.repositoryHead}, ${record.fsckValid}, ${record.signaturesValid}, ${record.checkedAt}, ${record.detailCode}
      )
      ON CONFLICT (household_id) DO UPDATE SET
        repository_head = EXCLUDED.repository_head,
        fsck_valid = EXCLUDED.fsck_valid,
        signatures_valid = EXCLUDED.signatures_valid,
        checked_at = EXCLUDED.checked_at,
        detail_code = EXCLUDED.detail_code
    `;
  }

  async saveRestoreDrill(record: RestoreDrillRecord): Promise<void> {
    await this.sql()`
      INSERT INTO restore_drill_checkpoints (
        singleton, household_id, repository_head, succeeded, completed_at, detail_code
      ) VALUES (true, ${record.householdId}, ${record.repositoryHead}, ${record.succeeded}, ${record.completedAt}, ${record.detailCode})
      ON CONFLICT (singleton) DO UPDATE SET
        household_id = EXCLUDED.household_id,
        repository_head = EXCLUDED.repository_head,
        succeeded = EXCLUDED.succeeded,
        completed_at = EXCLUDED.completed_at,
        detail_code = EXCLUDED.detail_code
    `;
  }

  async operatorHealth(): Promise<OperationalHealthSnapshot> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT
        count(*) FILTER (WHERE state IN ('received', 'locked', 'git_committed', 'projections_applied', 'reconciliation_required'))::integer AS incomplete_mutation_count,
        count(*) FILTER (WHERE state = 'reconciliation_required')::integer AS reconciliation_required_count,
        min(updated_at) FILTER (WHERE state IN ('received', 'locked', 'git_committed', 'projections_applied', 'reconciliation_required')) AS oldest_incomplete_mutation_at,
        (SELECT count(*)::integer FROM households WHERE provisioning_state = 'quarantined') AS quarantined_household_count,
        (SELECT count(*)::integer FROM households) AS household_count,
        (SELECT count(*)::integer FROM households h LEFT JOIN backup_checkpoints b ON b.household_id = h.id AND b.bundle_hash IS NOT NULL AND b.manifest_object_key IS NOT NULL AND b.verified_at IS NOT NULL AND b.retained_until IS NOT NULL WHERE b.household_id IS NULL) AS households_without_backup,
        (SELECT min(completed_at) FROM backup_checkpoints WHERE bundle_hash IS NOT NULL AND manifest_object_key IS NOT NULL AND verified_at IS NOT NULL AND retained_until IS NOT NULL) AS oldest_backup_at,
        (SELECT max(checked_at) FROM repository_verification_checkpoints) AS last_fsck_at,
        (SELECT count(*)::integer FROM repository_verification_checkpoints WHERE NOT fsck_valid) AS fsck_failure_count,
        (SELECT max(checked_at) FROM repository_verification_checkpoints) AS last_signature_check_at,
        (SELECT count(*)::integer FROM repository_verification_checkpoints WHERE NOT signatures_valid) AS signature_failure_count,
        (SELECT completed_at FROM restore_drill_checkpoints WHERE singleton) AS last_restore_drill_at,
        (SELECT succeeded FROM restore_drill_checkpoints WHERE singleton) AS last_restore_drill_succeeded,
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'repository_verification_checkpoints'
        ) THEN '0005' ELSE 'unknown' END AS schema_version
      FROM mutation_requests
    `;
    return operationalHealthFromRow(rows[0]);
  }

  async withHouseholdLock<T>(householdId: HouseholdId, operation: () => Promise<T>): Promise<T> {
    const active = this.transaction.getStore();
    if (active !== undefined) {
      if (active.householdId !== householdId) throw new AppError("INTERNAL_ERROR", "Nested household transactions are not supported");
      return await operation();
    }
    return await this.connection.withHouseholdTransaction(householdId, async (sql) => {
      return await this.transaction.run({ householdId, sql, projections: new Map() }, operation);
    });
  }

  async projection(householdId: HouseholdId): Promise<HouseholdProjection> {
    const active = this.transaction.getStore();
    const cached = active?.projections.get(householdId);
    if (cached !== undefined) return cached;
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT projection FROM journal_projections WHERE household_id = ${householdId}
    `;
    if (rows[0] === undefined) throw new AppError("NOT_FOUND", "Household projection was not found");
    const projection = projectionFromDocument(rows[0].projection);
    active?.projections.set(householdId, projection);
    return projection;
  }

  async health(): Promise<{ ready: boolean; detail: string }> {
    return await this.connection.health();
  }

  async getByToken(token: string): Promise<SessionRecord | null> {
    const rows = await this.sql()<Record<string, unknown>[]>`
      SELECT u.id AS user_id, u.actor_id, u.display_name, s.scopes, s.client
      FROM web_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${this.tokenHasher.hash(token)}
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.deleted_at IS NULL
    `;
    if (rows[0] === undefined) return null;
    const row = SessionRowSchema.parse(rows[0]);
    return { userId: row.user_id, actorId: row.actor_id, displayName: row.display_name, scopes: new Set(row.scopes), client: row.client };
  }

  async revokeUser(userId: UserId): Promise<void> {
    await this.sql()`UPDATE web_sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
  }

  private sql(): Queryable {
    return this.transaction.getStore()?.sql ?? this.connection.pooled;
  }

  private async inTransaction<T>(operation: (sql: TransactionSql) => Promise<T>): Promise<T> {
    const active = this.transaction.getStore();
    if (active !== undefined) return await operation(active.sql);
    return await this.connection.pooled.begin(operation) as T;
  }

  private async upsertMembershipWith(sql: Queryable, membership: MembershipRecord): Promise<void> {
    await sql`
      INSERT INTO memberships (household_id, user_id, actor_id, role, projection_head, removed_at, updated_at)
      VALUES (${membership.householdId}, ${membership.userId}, ${membership.actorId}, ${membership.role}, ${membership.projectionHead}, ${membership.removedAt}, now())
      ON CONFLICT (household_id, user_id) DO UPDATE SET
        actor_id = EXCLUDED.actor_id,
        role = EXCLUDED.role,
        projection_head = EXCLUDED.projection_head,
        removed_at = EXCLUDED.removed_at,
        updated_at = now()
    `;
  }

  private async leaveMembershipWith(sql: Queryable, userId: UserId, householdId: HouseholdId, removedAt: string): Promise<"left" | "not_found" | "sole_owner"> {
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM memberships
      WHERE household_id = ${householdId} AND user_id = ${userId} AND removed_at IS NULL
      FOR UPDATE
    `;
    const role = rows[0]?.role;
    if (role === undefined) return "not_found";
    if (role === "owner") {
      const owners = await sql<{ count: number | string }[]>`
        SELECT count(*) AS count FROM memberships
        WHERE household_id = ${householdId} AND role = 'owner' AND removed_at IS NULL
      `;
      if (z.coerce.number().parse(owners[0]?.count) <= 1) return "sole_owner";
    }
    await sql`UPDATE memberships SET removed_at = ${removedAt}, updated_at = ${removedAt} WHERE household_id = ${householdId} AND user_id = ${userId}`;
    await sql`UPDATE user_preferences SET default_household_id = NULL, updated_at = ${removedAt} WHERE user_id = ${userId} AND default_household_id = ${householdId}`;
    return "left";
  }

  private async flushTransactionProjections(requestId: RequestId): Promise<void> {
    const active = this.transaction.getStore();
    if (active === undefined) throw new AppError("INTERNAL_ERROR", "Projection transitions require a household transaction");
    const mutationRows = await active.sql<Record<string, unknown>[]>`
      SELECT commit_id FROM mutation_requests WHERE request_id = ${requestId}
    `;
    const commitId = GitObjectIdSchema.parse(mutationRows[0]?.commit_id);
    for (const [householdId, projection] of active.projections) {
      await active.sql`
        UPDATE journal_projections
        SET repository_head = ${commitId}, projection = ${active.sql.json(this.projectionDocument(projection))}, rebuilt_at = now()
        WHERE household_id = ${householdId}
      `;
    }
  }

  private projectionDocument(projection: HouseholdProjection): JsonValue {
    return toJsonValue({
      evidence: Object.fromEntries(projection.evidence),
      items: Object.fromEntries(projection.items),
      profiles: Object.fromEntries(projection.profiles),
      collections: Object.fromEntries(projection.collections),
    });
  }
}

function householdFromRow(input: unknown): HouseholdRecord {
  const row = HouseholdRowSchema.parse(input);
  return { id: row.id, name: row.display_name, repositoryHead: row.repository_head, provisioningState: row.provisioning_state, createdAt: row.created_at };
}

function membershipFromRow(input: unknown): MembershipRecord {
  const row = MembershipRowSchema.parse(input);
  return { householdId: row.household_id, userId: row.user_id, actorId: row.actor_id, role: row.role, projectionHead: row.projection_head, removedAt: row.removed_at };
}

function invitationFromRow(input: unknown): InvitationRecord {
  const row = InvitationRowSchema.parse(input);
  return { id: row.id, householdId: row.household_id, tokenHash: row.token_hash, role: row.role, expiresAt: row.expires_at, intendedEmailHint: row.intended_email_hint, acceptedAt: row.accepted_at, revokedAt: row.revoked_at };
}

function shareFromRow(input: unknown): ShareRecord {
  const row = ShareRowSchema.parse(input);
  return { id: row.id, collectionId: row.collection_id, householdId: row.household_id, tokenHash: row.token_hash, snapshot: row.snapshot, expiresAt: row.expires_at, revokedAt: row.revoked_at };
}

function mutationFromRow(input: unknown): MutationRecord {
  const row = MutationRowSchema.parse(input);
  return { requestId: row.request_id, userId: row.user_id, tool: row.tool_name, idempotencyKey: row.idempotency_key, householdId: row.household_id, state: row.state, commitId: row.commit_id, response: row.response, failure: row.failure_code, createdAt: row.created_at, updatedAt: row.updated_at };
}

function exportDownloadFromRow(input: unknown): ExportDownloadRecord {
  const row = z.object({
    id: z.string(), household_id: HouseholdIdSchema, requested_by: UserIdSchema,
    format: z.enum(["readable_zip", "git_bundle"]), token_hash: z.string(), object_path: z.string(),
    content_hash: z.string().regex(/^[0-9a-f]{64}$/), repository_head: GitObjectIdSchema,
    expires_at: TimestampSchema, downloaded_at: NullableTimestampSchema, created_at: TimestampSchema,
  }).parse(input);
  return { id: row.id, householdId: row.household_id, requestedBy: row.requested_by, format: row.format, tokenHash: row.token_hash, objectPath: row.object_path, contentHash: row.content_hash, repositoryHead: row.repository_head, expiresAt: row.expires_at, downloadedAt: row.downloaded_at, createdAt: row.created_at };
}

function backupCheckpointFromRow(input: unknown): BackupCheckpointRecord {
  const row = z.object({
    household_id: HouseholdIdSchema, repository_head: GitObjectIdSchema,
    manifest_hash: z.string().regex(/^[0-9a-f]{64}$/), bundle_hash: z.string().regex(/^[0-9a-f]{64}$/),
    object_key: z.string().min(1), manifest_object_key: z.string().min(1),
    completed_at: TimestampSchema, verified_at: TimestampSchema, retained_until: TimestampSchema,
  }).parse(input);
  return {
    householdId: row.household_id, repositoryHead: row.repository_head,
    manifestHash: row.manifest_hash, bundleHash: row.bundle_hash,
    objectKey: row.object_key, manifestObjectKey: row.manifest_object_key,
    completedAt: row.completed_at, verifiedAt: row.verified_at, retainedUntil: row.retained_until,
  };
}

function operationalHealthFromRow(input: unknown): OperationalHealthSnapshot {
  const row = z.object({
    incomplete_mutation_count: z.number().int().nonnegative(), reconciliation_required_count: z.number().int().nonnegative(),
    oldest_incomplete_mutation_at: NullableTimestampSchema, quarantined_household_count: z.number().int().nonnegative(),
    household_count: z.number().int().nonnegative(), households_without_backup: z.number().int().nonnegative(),
    oldest_backup_at: NullableTimestampSchema,
    last_fsck_at: NullableTimestampSchema, fsck_failure_count: z.number().int().nonnegative(),
    last_signature_check_at: NullableTimestampSchema, signature_failure_count: z.number().int().nonnegative(),
    last_restore_drill_at: NullableTimestampSchema, last_restore_drill_succeeded: z.boolean().nullable(),
    schema_version: z.string().min(1),
  }).parse(input);
  return {
    incompleteMutationCount: row.incomplete_mutation_count, reconciliationRequiredCount: row.reconciliation_required_count,
    oldestIncompleteMutationAt: row.oldest_incomplete_mutation_at, quarantinedHouseholdCount: row.quarantined_household_count,
    householdCount: row.household_count, householdsWithoutBackup: row.households_without_backup,
    oldestBackupAt: row.oldest_backup_at,
    lastFsckAt: row.last_fsck_at, fsckFailureCount: row.fsck_failure_count,
    lastSignatureCheckAt: row.last_signature_check_at, signatureFailureCount: row.signature_failure_count,
    lastRestoreDrillAt: row.last_restore_drill_at, lastRestoreDrillSucceeded: row.last_restore_drill_succeeded,
    schemaVersion: row.schema_version,
  };
}

function projectionFromDocument(input: unknown): HouseholdProjection {
  const document = ProjectionDocumentSchema.parse(input);
  return {
    evidence: new Map(Object.entries(document.evidence)),
    items: new Map(Object.entries(document.items)),
    profiles: new Map(Object.entries(document.profiles)),
    collections: new Map(Object.entries(document.collections)),
  };
}

function emptyProjection(): HouseholdProjection {
  return { evidence: new Map(), items: new Map(), profiles: new Map(), collections: new Map() };
}

function toJsonValue(input: unknown): JsonValue {
  if (input === null || typeof input === "string" || typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input.map(toJsonValue);
  if (typeof input === "object") {
    const output: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) output[key] = toJsonValue(value);
    }
    return output;
  }
  throw new AppError("INTERNAL_ERROR", "Projection contains a non-JSON value");
}
