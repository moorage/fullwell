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

const command = process.argv[2] ?? "all";
if (command !== "all" && command !== "health") throw new Error(`Unknown maintenance command: ${command}`);
const config = parseConfig(process.env);
const database = config.DATABASE_URL === undefined || config.DATABASE_DIRECT_URL === undefined ? null : new NeonConnection(config.DATABASE_URL, config.DATABASE_DIRECT_URL);
const repository = new GitHouseholdRepository({
  repositoryRoot: config.HOUSEHOLD_REPOSITORY_ROOT,
  worktreeRoot: config.HOUSEHOLD_WORKTREE_ROOT,
  ...(config.GIT_SIGNING_KEY === undefined ? {} : { signingKey: config.GIT_SIGNING_KEY }),
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
  const repositories = command === "health" ? [] : await verifyRepositories(repository, config.HOUSEHOLD_REPOSITORY_ROOT);
  const invalid = repositories.filter((entry) => !entry.valid);
  process.stdout.write(`${JSON.stringify({ ok: invalid.length === 0 && reconciliation.quarantined === 0 && exportCleanup.failed === 0, database: databaseHealth, reconciliation, export_cleanup: exportCleanup, repositories })}\n`);
  if (invalid.length > 0 || reconciliation.quarantined > 0 || exportCleanup.failed > 0) process.exitCode = 1;
} finally {
  if (database !== null) await database.close();
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
