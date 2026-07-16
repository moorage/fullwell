import { constants } from "node:fs";
import { access, statfs } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "../core/errors.js";
import type { Clock, HouseholdRepositoryPort, OperationalStorePort, TokenHasher } from "../core/ports.js";

export interface ReadinessReport {
  readonly ready: boolean;
  readonly checks: {
    readonly operational_store: { ready: boolean; detail: string };
    readonly git: { ready: boolean; detail: string };
    readonly volume?: { ready: boolean; detail: string };
    readonly signing?: { ready: boolean; detail: string };
    readonly schema?: { ready: boolean; detail: string };
    readonly worker_leadership?: { ready: boolean; detail: string };
  };
}

export interface OperatorHealthOptions {
  readonly clock: Clock;
  readonly expectedSchemaVersion: string;
  readonly repositoryRoot: string;
  readonly signingConfigured: boolean;
}

export interface OperatorHealthReport {
  readonly status: "healthy" | "degraded";
  readonly checked_at: string;
  readonly readiness: ReadinessReport;
  readonly schema: { readonly version: string };
  readonly reconciliation: {
    readonly healthy: boolean;
    readonly incomplete_mutations: number;
    readonly reconciliation_required: number;
    readonly oldest_incomplete_age_seconds: number | null;
    readonly quarantined_households: number;
  };
  readonly backup: {
    readonly healthy: boolean;
    readonly households_without_backup: number;
    readonly oldest_backup_age_seconds: number | null;
    readonly last_restore_drill_at: string | null;
    readonly restore_drill_healthy: boolean;
  };
  readonly repository: {
    readonly healthy: boolean;
    readonly signing_configured: boolean;
    readonly last_fsck_at: string | null;
    readonly fsck_failures: number;
    readonly last_signature_check_at: string | null;
    readonly signature_failures: number;
  };
  readonly volume: { readonly writable: boolean; readonly identityMarkerPresent: boolean; readonly capacityBytes: number; readonly availableBytes: number; readonly usedPercent: number };
}

export class HealthService {
  constructor(
    private readonly store: OperationalStorePort,
    private readonly repository: HouseholdRepositoryPort,
    private readonly operatorOptions?: OperatorHealthOptions,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const operational = await this.store.health();
    const git = await gitAvailable();
    if (this.operatorOptions === undefined) return { ready: operational.ready && git.ready, checks: { operational_store: operational, git } };
    const [volume, state] = await Promise.all([volumeHealth(this.operatorOptions.repositoryRoot), this.store.operatorHealth()]);
    return detailedReadiness(operational, git, volume, state.schemaVersion, this.operatorOptions);
  }

  async operatorHealth(): Promise<OperatorHealthReport> {
    if (this.operatorOptions === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Operator health is not configured");
    const [operationalStore, git, operational, volume] = await Promise.all([
      this.store.health(), gitAvailable(), this.store.operatorHealth(), volumeHealth(this.operatorOptions.repositoryRoot),
    ]);
    const readiness = detailedReadiness(operationalStore, git, volume, operational.schemaVersion, this.operatorOptions);
    const now = this.operatorOptions.clock.now().getTime();
    const oldestIncompleteAgeSeconds = ageSeconds(now, operational.oldestIncompleteMutationAt);
    const oldestBackupAgeSeconds = ageSeconds(now, operational.oldestBackupAt);
    const restoreDrillAgeSeconds = ageSeconds(now, operational.lastRestoreDrillAt);
    const reconciliationHealthy = operational.quarantinedHouseholdCount === 0 && (oldestIncompleteAgeSeconds ?? 0) < 5 * 60;
    const backupHealthy = operational.householdsWithoutBackup === 0 && (oldestBackupAgeSeconds ?? 0) < 25 * 60 * 60;
    const restoreDrillHealthy = operational.householdCount === 0 || (operational.lastRestoreDrillSucceeded === true && (restoreDrillAgeSeconds ?? Number.POSITIVE_INFINITY) < 32 * 24 * 60 * 60);
    const repositoryHealthy = operational.householdCount === 0 || (operational.fsckFailureCount === 0 && operational.signatureFailureCount === 0 && operational.lastFsckAt !== null && operational.lastSignatureCheckAt !== null);
    const healthy = ![readiness.ready, reconciliationHealthy, backupHealthy, restoreDrillHealthy, repositoryHealthy, volume.writable, volume.identityMarkerPresent, this.operatorOptions.signingConfigured].includes(false);
    return {
      status: healthy ? "healthy" : "degraded",
      checked_at: this.operatorOptions.clock.now().toISOString(),
      readiness,
      schema: { version: operational.schemaVersion },
      reconciliation: {
        healthy: reconciliationHealthy,
        incomplete_mutations: operational.incompleteMutationCount,
        reconciliation_required: operational.reconciliationRequiredCount,
        oldest_incomplete_age_seconds: oldestIncompleteAgeSeconds,
        quarantined_households: operational.quarantinedHouseholdCount,
      },
      backup: {
        healthy: backupHealthy,
        households_without_backup: operational.householdsWithoutBackup,
        oldest_backup_age_seconds: oldestBackupAgeSeconds,
        last_restore_drill_at: operational.lastRestoreDrillAt,
        restore_drill_healthy: restoreDrillHealthy,
      },
      repository: {
        healthy: repositoryHealthy,
        signing_configured: this.operatorOptions.signingConfigured,
        last_fsck_at: operational.lastFsckAt,
        fsck_failures: operational.fsckFailureCount,
        last_signature_check_at: operational.lastSignatureCheckAt,
        signature_failures: operational.signatureFailureCount,
      },
      volume,
    };
  }
}

function detailedReadiness(
  operational: { ready: boolean; detail: string },
  git: { ready: boolean; detail: string },
  volume: Awaited<ReturnType<typeof volumeHealth>>,
  schemaVersion: string,
  options: OperatorHealthOptions,
): ReadinessReport {
  const volumeReady = volume.writable && volume.identityMarkerPresent;
  const schemaReady = schemaVersion === options.expectedSchemaVersion;
  return {
    ready: ![operational.ready, git.ready, volumeReady, options.signingConfigured, schemaReady].includes(false),
    checks: {
      operational_store: operational,
      git,
      volume: { ready: volumeReady, detail: !volume.identityMarkerPresent ? "identity_marker_missing" : volume.writable ? "ready" : "not_writable" },
      signing: { ready: options.signingConfigured, detail: options.signingConfigured ? "configured" : "not_configured" },
      schema: { ready: schemaReady, detail: schemaVersion },
      worker_leadership: { ready: true, detail: "single_writer" },
    },
  };
}

export function createOperatorAuthenticator(token: string, hasher: TokenHasher): (authorization: string | undefined) => void {
  const digest = hasher.hash(token);
  return (authorization) => {
    if (authorization === undefined || !authorization.startsWith("Bearer ") || !hasher.matches(authorization.slice(7), digest)) {
      throw new AppError("AUTH_REQUIRED", "Operator authentication is required");
    }
  };
}

async function gitAvailable(): Promise<{ ready: boolean; detail: string }> {
  const { spawn } = await import("node:child_process");
  return await new Promise((resolve) => {
    const child = spawn("git", ["--version"], { shell: false, stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => resolve({ ready: false, detail: "unavailable" }));
    child.on("close", (code) => resolve(code === 0 ? { ready: true, detail: Buffer.concat(chunks).toString("utf8").trim() } : { ready: false, detail: "failed" }));
  });
}

async function volumeHealth(root: string): Promise<{ writable: boolean; identityMarkerPresent: boolean; capacityBytes: number; availableBytes: number; usedPercent: number }> {
  const [filesystem, writable, identityMarkerPresent] = await Promise.all([
    statfs(root),
    access(root, constants.W_OK).then(() => true, () => false),
    access(join(root, ".hfj-volume-id"), constants.R_OK).then(() => true, () => false),
  ]);
  const capacityBytes = filesystem.blocks * filesystem.bsize;
  const availableBytes = filesystem.bavail * filesystem.bsize;
  const usedPercent = capacityBytes === 0 ? 100 : Math.round((1 - availableBytes / capacityBytes) * 10_000) / 100;
  return { writable, identityMarkerPresent, capacityBytes, availableBytes, usedPercent };
}

function ageSeconds(now: number, timestamp: string | null): number | null {
  return timestamp === null ? null : Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1_000));
}
