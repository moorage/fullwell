import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsRoot = new URL("../../migrations/", import.meta.url);
const migrationPattern = /^\d{4}_[a-z0-9_]+\.sql$/;
const advisoryLockId = "310720260716";

export function validateMigrationEnvironment(env) {
  const connectionString = env.DATABASE_DIRECT_URL;
  if (!connectionString) throw new Error("Set DATABASE_DIRECT_URL to the intended direct Neon endpoint.");
  const target = env.MIGRATION_TARGET;
  if (target !== "staging" && target !== "production") throw new Error("MIGRATION_TARGET must be staging or production.");
  const databaseUrl = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error("DATABASE_DIRECT_URL must use PostgreSQL.");
  if (databaseUrl.hostname.includes("-pooler.")) throw new Error("Migrations require a direct Neon endpoint, not a pooled endpoint.");
  if (env.MIGRATION_EXPECTED_HOST !== databaseUrl.hostname) throw new Error("MIGRATION_EXPECTED_HOST does not match DATABASE_DIRECT_URL.");
  if (!new Set(["require", "verify-ca", "verify-full"]).has(databaseUrl.searchParams.get("sslmode"))) {
    throw new Error("Remote migrations require TLS verification or sslmode=require.");
  }
  if (target === "production" && env.CONFIRM_PRODUCTION_MIGRATION !== "APPLY_PRODUCTION_MIGRATIONS") {
    throw new Error("Production migrations require CONFIRM_PRODUCTION_MIGRATION=APPLY_PRODUCTION_MIGRATIONS.");
  }
  return connectionString;
}

export function unwrapMigration(file, content) {
  const normalized = content.replaceAll("\r\n", "\n").trim();
  const match = /^BEGIN;\n([\s\S]*)\nCOMMIT;$/.exec(normalized);
  if (match === null) throw new Error(`${file} must have one outer BEGIN/COMMIT transaction.`);
  return match[1];
}

export function buildMigrationBatch(migrations, applied) {
  const pending = [];
  for (const migration of migrations) {
    if (!migrationPattern.test(migration.file) || migration.file.endsWith(".down.sql")) throw new Error(`Invalid up migration ${migration.file}.`);
    const hash = createHash("sha256").update(migration.content).digest("hex");
    const appliedHash = applied.get(migration.file);
    if (appliedHash !== undefined) {
      if (appliedHash !== hash) throw new Error(`Applied migration content changed: ${migration.file}.`);
      continue;
    }
    pending.push({ ...migration, hash, body: unwrapMigration(migration.file, migration.content) });
  }
  if (pending.length === 0) return { count: 0, sql: "" };
  const statements = [
    "BEGIN;",
    "SET LOCAL search_path = public;",
    `SELECT pg_advisory_xact_lock(${advisoryLockId});`,
  ];
  for (const migration of pending) {
    statements.push(migration.body);
    statements.push(`INSERT INTO public.hfj_schema_migrations (version, content_sha256) VALUES ('${migration.file}', '${migration.hash}');`);
  }
  statements.push("COMMIT;");
  return { count: pending.length, sql: `${statements.join("\n\n")}\n` };
}

export function buildPsqlInvocation(connectionString, capture = false) {
  return {
    args: ["--set", "ON_ERROR_STOP=1", "--no-psqlrc", ...(capture ? ["--tuples-only", "--no-align"] : [])],
    env: { PGDATABASE: connectionString },
  };
}

function runPsql(connectionString, input, capture = false) {
  const invocation = buildPsqlInvocation(connectionString, capture);
  const result = spawnSync("psql", invocation.args, {
    encoding: "utf8",
    env: { ...process.env, ...invocation.env },
    input,
  });
  if (result.status !== 0) throw new Error(`Migration database command failed:\n${result.stderr}`);
  return result.stdout;
}

async function applyMigrations(env) {
  const connectionString = validateMigrationEnvironment(env);
  runPsql(connectionString, `
CREATE TABLE IF NOT EXISTS public.hfj_schema_migrations (
  version text PRIMARY KEY,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);
`);
  const appliedOutput = runPsql(connectionString, "SELECT version || E'\\t' || content_sha256 FROM public.hfj_schema_migrations ORDER BY version;\n", true);
  const applied = new Map(appliedOutput.trim() === "" ? [] : appliedOutput.trim().split("\n").map((line) => line.split("\t")));
  const entries = (await readdir(migrationsRoot)).filter((entry) => migrationPattern.test(entry) && !entry.endsWith(".down.sql")).sort();
  const migrations = await Promise.all(entries.map(async (file) => ({ file, content: await readFile(new URL(file, migrationsRoot), "utf8") })));
  const batch = buildMigrationBatch(migrations, applied);
  if (batch.count > 0) runPsql(connectionString, batch.sql);
  process.stdout.write(`Applied ${batch.count} migration(s); schema is ${entries.at(-1)?.replace(/_.*/, "") ?? "empty"}.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await applyMigrations(process.env);
}
