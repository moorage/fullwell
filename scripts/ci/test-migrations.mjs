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

const runFile = async (file) => {
  const sql = await readFile(new URL(`../../migrations/${file}`, import.meta.url), "utf8");
  const result = spawnSync("psql", [connectionString, "--set", "ON_ERROR_STOP=1", "--no-psqlrc"], {
    encoding: "utf8",
    input: sql,
  });
  if (result.status !== 0) {
    throw new Error(`${file} failed:\n${result.stderr}`);
  }
};

const reset = spawnSync("psql", [connectionString, "--set", "ON_ERROR_STOP=1", "--no-psqlrc", "--command", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"], {
  encoding: "utf8",
});
if (reset.status !== 0) throw new Error(`Unable to reset isolated migration database:\n${reset.stderr}`);

for (const file of upFiles) await runFile(file);
for (const file of [...upFiles].reverse()) {
  const downFile = file.replace(/\.sql$/, ".down.sql");
  if (!entries.includes(downFile)) throw new Error(`Missing rollback migration ${downFile}.`);
  await runFile(downFile);
}
for (const file of upFiles) await runFile(file);

console.log(`Migration up/down/up passed for ${upFiles.length} migration(s).`);
