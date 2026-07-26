import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("Set TEST_DATABASE_URL to an isolated local PostgreSQL database.");
}

const databaseUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname)) {
  throw new Error("Migration verification refuses non-local databases. Use an isolated local PostgreSQL instance.");
}

const entries = await readdir(new URL("../../migrations/", import.meta.url));
const upFiles = entries.filter((entry) => /^\d+.*\.sql$/.test(entry) && !entry.endsWith(".down.sql")).sort();
if (upFiles.length === 0) {
  throw new Error("No up migrations exist.");
}

const runSql = (sql, label) => {
  const result = spawnSync("psql", [
    connectionString,
    "--set",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
  ], {
    encoding: "utf8",
    input: sql,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr}`);
  }
  return result.stdout.trim();
};

const runFile = async (file) => {
  const sql = await readFile(new URL(`../../migrations/${file}`, import.meta.url), "utf8");
  runSql(sql, file);
};

const reset = spawnSync("psql", [connectionString, "--set", "ON_ERROR_STOP=1", "--no-psqlrc", "--command", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"], {
  encoding: "utf8",
});
if (reset.status !== 0) throw new Error(`Unable to reset isolated migration database:\n${reset.stderr}`);

for (const file of upFiles) await runFile(file);
if (upFiles.includes("0008_delivery_search_projection.sql")) {
  runSql(`
    INSERT INTO households (
      id, display_name, repository_path, repository_head, provisioning_state
    ) VALUES (
      'hsh_0000000000008001', 'Migration fixture', 'migration-fixture',
      '${"a".repeat(40)}', 'ready'
    );
    INSERT INTO search_items (
      household_id, item_id, kind, repository_revision,
      distinguishing_fields, search_document
    ) VALUES
      ('hsh_0000000000008001', 'itm_0000000000008001', 'snack', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'snack')),
      ('hsh_0000000000008001', 'itm_0000000000008002', 'ingredient', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'ingredient')),
      ('hsh_0000000000008001', 'itm_0000000000008003', 'condiment', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'condiment')),
      ('hsh_0000000000008001', 'itm_0000000000008004', 'other_grocery', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'other grocery')),
      ('hsh_0000000000008001', 'itm_0000000000008005', 'recipe', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'recipe')),
      ('hsh_0000000000008001', 'itm_0000000000008006', 'delivery_dish', '${"a".repeat(40)}', '{}', to_tsvector('simple', 'delivery dish'));
  `, "delivery migration rollback fixture");
}
for (const file of [...upFiles].reverse()) {
  const downFile = file.replace(/\.sql$/, ".down.sql");
  if (!entries.includes(downFile)) throw new Error(`Missing rollback migration ${downFile}.`);
  await runFile(downFile);
  if (file === "0008_delivery_search_projection.sql") {
    const kinds = runSql(
      "SELECT string_agg(kind, ',' ORDER BY kind) FROM search_items;",
      "delivery migration rollback assertion",
    );
    if (kinds !== "condiment,ingredient,other_grocery,recipe,snack") {
      throw new Error(`Delivery rollback changed non-delivery search rows: ${kinds}`);
    }
  }
}
for (const file of upFiles) await runFile(file);

console.log(`Migration up/down/up passed for ${upFiles.length} migration(s).`);
