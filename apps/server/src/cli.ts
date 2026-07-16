import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { HouseholdIdSchema } from "@hfj/contracts";
import { HmacTokenHasher, SystemClock } from "./adapters/providers.js";
import { parseConfig } from "./config.js";
import { GitHouseholdRepository } from "./git/git-repository.js";
import { NeonOperationalStore } from "./persistence/neon-operational-store.js";
import { NeonConnection } from "./persistence/neon.js";
import { ReconciliationWorker } from "./workers/reconciliation-worker.js";
import { FileExportArtifactStore } from "./exports/artifact-store.js";
import { ExportCleanupWorker } from "./exports/cleanup-worker.js";
import { ServiceObservability } from "./telemetry/observability.js";
import { BackupCryptography } from "./backup/backup-cryptography.js";
import { BackupService } from "./backup/backup-service.js";
import { GitBundleRestoreVerifier } from "./backup/git-bundle-restore-verifier.js";
import { S3CompatibleBackupProvider } from "./backup/s3-compatible-backup.js";

const command = process.argv[2] ?? "all";
if (!["all", "health", "backup", "restore-drill"].includes(command)) throw new Error(`Unknown maintenance command: ${command}`);
const config = parseConfig(process.env);
const database = config.DATABASE_URL === undefined || config.DATABASE_DIRECT_URL === undefined ? null : new NeonConnection(config.DATABASE_URL, config.DATABASE_DIRECT_URL);
const repository = new GitHouseholdRepository({
  repositoryRoot: config.HOUSEHOLD_REPOSITORY_ROOT,
  worktreeRoot: config.HOUSEHOLD_WORKTREE_ROOT,
  ...(config.GIT_SIGNING_KEY === undefined ? {} : { signingKey: config.GIT_SIGNING_KEY }),
  ...(config.GIT_ALLOWED_SIGNERS_FILE === undefined ? {} : { allowedSignersFile: config.GIT_ALLOWED_SIGNERS_FILE }),
  requireSigning: config.NODE_ENV === "production",
});
const telemetry = new ServiceObservability({ runtimeMetrics: false });

try {
  const databaseHealth = database === null ? { ready: config.NODE_ENV !== "production", detail: "not configured" } : await database.health();
  if (!databaseHealth.ready) throw new Error(`Neon health check failed: ${databaseHealth.detail}`);
  const operationalStore = database === null ? null : new NeonOperationalStore(database, new HmacTokenHasher(config.TOKEN_PEPPER ?? "local-development-pepper-change-me-000000"));
  const reconciliation = command === "all" && operationalStore !== null
    ? await new ReconciliationWorker(
      operationalStore,
      repository,
      telemetry,
    ).run()
    : { checked: 0, rebuilt: 0, quarantined: 0 };
  const exportCleanup = command === "all" && operationalStore !== null
    ? await new ExportCleanupWorker(operationalStore, new FileExportArtifactStore(config.EXPORT_ROOT), new SystemClock(), telemetry).run()
    : { checked: 0, removed: 0, failed: 0 };
  const backup = operationalStore === null ? null : createBackupService(config, repository, operationalStore, telemetry);
  const backupResult = (command === "all" || command === "backup") && backup !== null
    ? await backup.run()
    : { checked: 0, completed: 0, skipped: 0, failed: 0 };
  const restoreDue = command === "all" && backupResult.failed === 0 && operationalStore !== null && await restoreDrillDue(operationalStore);
  const restoreDrill = (command === "restore-drill" || restoreDue) && backup !== null && operationalStore !== null
    ? await backup.restoreDrill(await selectRestoreHousehold(operationalStore, process.argv[3]))
    : null;
  const repositories = command === "health" ? [] : await verifyRepositories(repository, config.HOUSEHOLD_REPOSITORY_ROOT);
  const invalid = repositories.filter((entry) => !entry.valid);
  process.stdout.write(`${JSON.stringify({ ok: invalid.length === 0 && reconciliation.quarantined === 0 && exportCleanup.failed === 0 && backupResult.failed === 0, database: databaseHealth, reconciliation, export_cleanup: exportCleanup, backup: backupResult, restore_drill: restoreDrill, repositories })}\n`);
  if (invalid.length > 0 || reconciliation.quarantined > 0 || exportCleanup.failed > 0 || backupResult.failed > 0) process.exitCode = 1;
} finally {
  if (database !== null) await database.close();
}

function createBackupService(
  applicationConfig: typeof config,
  householdRepository: GitHouseholdRepository,
  operationalStore: NeonOperationalStore,
  serviceTelemetry: ServiceObservability,
): BackupService | null {
  const {
    OBJECT_STORAGE_ENDPOINT: endpoint,
    OBJECT_STORAGE_REGION: region,
    OBJECT_STORAGE_BUCKET: bucket,
    OBJECT_STORAGE_ACCESS_KEY_ID: accessKeyId,
    OBJECT_STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
    BACKUP_ENCRYPTION_KEY: encryptionKey,
    BACKUP_MANIFEST_PRIVATE_KEY: privateKey,
    BACKUP_MANIFEST_PUBLIC_KEY: publicKey,
    BACKUP_KEY_ID: keyId,
    GIT_ALLOWED_SIGNERS_FILE: allowedSignersFile,
  } = applicationConfig;
  if (endpoint === undefined || region === undefined || bucket === undefined || accessKeyId === undefined || secretAccessKey === undefined
    || encryptionKey === undefined || privateKey === undefined || publicKey === undefined || keyId === undefined || allowedSignersFile === undefined) return null;
  const cryptography = new BackupCryptography(encryptionKey, privateKey, publicKey, keyId);
  const provider = new S3CompatibleBackupProvider({
    endpoint: new URL(endpoint), region, bucket, accessKeyId, secretAccessKey, prefix: applicationConfig.OBJECT_STORAGE_PREFIX,
  }, cryptography, new SystemClock());
  return new BackupService(
    householdRepository, provider, operationalStore, cryptography,
    new GitBundleRestoreVerifier({ requireSignatures: true, allowedSignersFile }),
    new SystemClock(), serviceTelemetry, applicationConfig.BACKUP_RETENTION_DAYS,
  );
}

async function selectRestoreHousehold(store: NeonOperationalStore, requested: string | undefined) {
  if (requested !== undefined) return HouseholdIdSchema.parse(requested);
  const households = await store.listHouseholds();
  if (households.length === 0) throw new Error("No household is available for a restore drill");
  return households[new Date().getUTCMonth() % households.length]!.id;
}

async function restoreDrillDue(store: NeonOperationalStore): Promise<boolean> {
  const health = await store.operatorHealth();
  return health.householdCount > 0 && (health.lastRestoreDrillAt === null || Date.now() - Date.parse(health.lastRestoreDrillAt) >= 30 * 24 * 60 * 60 * 1_000);
}

async function verifyRepositories(repository: GitHouseholdRepository, repositoryRoot: string) {
  const entries = await readdir(resolve(repositoryRoot), { withFileTypes: true }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  return await Promise.all(entries.filter((entry) => entry.isDirectory() && /^hsh_[0-9a-z]{16,64}\.git$/.test(entry.name)).map(async (entry) => {
    const householdId = HouseholdIdSchema.parse(entry.name.slice(0, -4));
    return { household_id: householdId, ...await repository.verify(householdId) };
  }));
}
