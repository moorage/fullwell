import { createHash } from "node:crypto";
import { z } from "zod";
import { GitObjectIdSchema, HouseholdIdSchema, type HouseholdId } from "@hfj/contracts";
import { stableJson } from "../adapters/memory.js";
import { AppError } from "../core/errors.js";
import type { BackupPort, Clock, HouseholdRepositoryPort, OperationalStorePort, TelemetryPort } from "../core/ports.js";
import type { BackupCheckpointRecord } from "../core/types.js";
import type { BackupCryptography } from "./backup-cryptography.js";

export const BackupManifestSchema = z.object({
  schema_version: z.literal(1),
  household_id: HouseholdIdSchema,
  repository_head: GitObjectIdSchema,
  object_count: z.number().int().positive(),
  bundle_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: z.iso.datetime(),
  retained_until: z.iso.datetime(),
}).strict();

export type BackupManifest = Readonly<z.infer<typeof BackupManifestSchema>>;

export interface BackupRestoreVerifier {
  verify(bundle: Uint8Array, manifest: BackupManifest): Promise<void>;
}

export class BackupService {
  constructor(
    private readonly repository: HouseholdRepositoryPort,
    private readonly backup: BackupPort,
    private readonly store: OperationalStorePort,
    private readonly cryptography: BackupCryptography,
    private readonly restoreVerifier: BackupRestoreVerifier,
    private readonly clock: Clock,
    private readonly telemetry: TelemetryPort,
    private readonly retentionDays: number,
  ) {}

  async run(): Promise<{ checked: number; completed: number; skipped: number; failed: number }> {
    const households = await this.store.listHouseholds();
    let completed = 0;
    let skipped = 0;
    let failed = 0;
    for (const household of households) {
      try {
        const checkpoint = await this.store.getBackupCheckpoint(household.id);
        if (checkpoint !== null && checkpoint.repositoryHead === await this.repository.head(household.id)
          && this.clock.now().getTime() - Date.parse(checkpoint.completedAt) < 23 * 60 * 60 * 1_000) {
          skipped += 1;
          continue;
        }
        await this.backupHousehold(household.id);
        completed += 1;
      } catch (error) {
        failed += 1;
        this.telemetry.error("backup.household_failed", asError(error), { household_id: household.id });
      }
    }
    return { checked: households.length, completed, skipped, failed };
  }

  async backupHousehold(householdId: HouseholdId): Promise<BackupCheckpointRecord> {
    const startedAt = performance.now();
    const repositoryHead = await this.repository.head(householdId);
    const [fsck, signatures, objectCount] = await Promise.all([
      this.repository.verify(householdId),
      this.repository.verifySignatures(householdId),
      this.repository.objectCount(householdId),
    ]);
    const checkedAt = this.clock.now().toISOString();
    await this.store.saveRepositoryVerification({
      householdId,
      repositoryHead,
      fsckValid: fsck.valid,
      signaturesValid: signatures.valid,
      checkedAt,
      detailCode: !fsck.valid ? "fsck_failed" : signatures.valid ? "verified" : "signature_failed",
    });
    if (!fsck.valid || !signatures.valid) throw new AppError("PROJECTION_DRIFT", "Repository verification failed before backup");

    const bundle = await this.repository.bundle(householdId);
    const bundleHash = sha256(bundle);
    const retainedUntil = new Date(this.clock.now().getTime() + this.retentionDays * 86_400_000).toISOString();
    const manifest = stableJson(BackupManifestSchema.parse({
      schema_version: 1,
      household_id: householdId,
      repository_head: repositoryHead,
      object_count: objectCount,
      bundle_sha256: bundleHash,
      created_at: checkedAt,
      retained_until: retainedUntil,
    }));
    const signedManifest = await this.cryptography.signManifest(manifest);
    const receipt = await this.backup.upload({ householdId, repositoryHead, bundle, signedManifest, completedAt: checkedAt, retainedUntil });
    const checkpoint: BackupCheckpointRecord = {
      householdId,
      repositoryHead,
      manifestHash: sha256(Buffer.from(signedManifest)),
      bundleHash,
      objectKey: receipt.objectKey,
      manifestObjectKey: receipt.manifestObjectKey,
      completedAt: checkedAt,
      verifiedAt: receipt.verifiedAt,
      retainedUntil,
    };
    await this.store.saveBackupCheckpoint(checkpoint);
    this.telemetry.event("backup.household_completed", {
      household_id: householdId,
      outcome: "success",
      duration_ms: Math.round(performance.now() - startedAt),
    });
    return checkpoint;
  }

  async restoreDrill(householdId: HouseholdId): Promise<{ householdId: HouseholdId; repositoryHead: string; completedAt: string }> {
    const checkpoint = await this.store.getBackupCheckpoint(householdId);
    if (checkpoint === null) throw new AppError("NOT_FOUND", "No backup checkpoint exists for the household");
    const completedAt = this.clock.now().toISOString();
    try {
      const restored = await this.backup.download(checkpoint.objectKey, checkpoint.manifestObjectKey);
      if (sha256(Buffer.from(restored.signedManifest)) !== checkpoint.manifestHash) throw new AppError("PROJECTION_DRIFT", "Backup manifest hash does not match its checkpoint");
      const manifest = BackupManifestSchema.parse(JSON.parse(await this.cryptography.verifyManifest(restored.signedManifest)));
      if (manifest.household_id !== householdId || manifest.repository_head !== checkpoint.repositoryHead) throw new AppError("PROJECTION_DRIFT", "Backup manifest identity does not match its checkpoint");
      if (sha256(restored.bundle) !== manifest.bundle_sha256 || manifest.bundle_sha256 !== checkpoint.bundleHash) throw new AppError("PROJECTION_DRIFT", "Backup bundle hash does not match its manifest");
      await this.restoreVerifier.verify(restored.bundle, manifest);
      await this.store.saveRestoreDrill({ householdId, repositoryHead: checkpoint.repositoryHead, succeeded: true, completedAt, detailCode: "verified" });
      this.telemetry.event("backup.restore_drill_completed", { household_id: householdId, outcome: "success" });
      return { householdId, repositoryHead: checkpoint.repositoryHead, completedAt };
    } catch (error) {
      await this.store.saveRestoreDrill({ householdId, repositoryHead: checkpoint.repositoryHead, succeeded: false, completedAt, detailCode: "verification_failed" });
      this.telemetry.error("backup.restore_drill_failed", asError(error), { household_id: householdId });
      throw error;
    }
  }
}

function sha256(input: Uint8Array): string { return createHash("sha256").update(input).digest("hex"); }
function asError(error: unknown): Error { return error instanceof Error ? error : new Error("Unknown backup failure"); }
