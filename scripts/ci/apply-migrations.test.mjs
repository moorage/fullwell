import assert from "node:assert/strict";
import { buildMigrationBatch, buildPsqlInvocation, unwrapMigration, validateMigrationEnvironment } from "./apply-migrations.mjs";

const directHost = "ep-validation.us-east-1.aws.neon.tech";
const migrationPassword = "encoded/password";
const directUrl = new URL(`postgresql://${directHost}/migration-db?sslmode=require&channel_binding=require`);
directUrl.username = "migration-user";
directUrl.password = migrationPassword;
const stagingEnvironment = {
  DATABASE_DIRECT_URL: directUrl.toString(),
  MIGRATION_TARGET: "staging",
  MIGRATION_EXPECTED_HOST: directHost,
};

assert.equal(validateMigrationEnvironment(stagingEnvironment), stagingEnvironment.DATABASE_DIRECT_URL);
assert.throws(() => validateMigrationEnvironment({ ...stagingEnvironment, MIGRATION_EXPECTED_HOST: "ep-other.us-east-1.aws.neon.tech" }), /does not match/);
assert.throws(() => validateMigrationEnvironment({ ...stagingEnvironment, DATABASE_DIRECT_URL: stagingEnvironment.DATABASE_DIRECT_URL.replace("ep-validation.", "ep-validation-pooler.") }), /direct Neon endpoint/);
assert.throws(() => validateMigrationEnvironment({ ...stagingEnvironment, DATABASE_DIRECT_URL: stagingEnvironment.DATABASE_DIRECT_URL.replace("sslmode=require", "sslmode=disable") }), /require TLS/);
assert.throws(() => validateMigrationEnvironment({ ...stagingEnvironment, MIGRATION_TARGET: "production" }), /CONFIRM_PRODUCTION_MIGRATION/);
assert.equal(validateMigrationEnvironment({ ...stagingEnvironment, MIGRATION_TARGET: "production", CONFIRM_PRODUCTION_MIGRATION: "APPLY_PRODUCTION_MIGRATIONS" }), stagingEnvironment.DATABASE_DIRECT_URL);

const invocation = buildPsqlInvocation(stagingEnvironment.DATABASE_DIRECT_URL, true);
assert(!invocation.args.includes(stagingEnvironment.DATABASE_DIRECT_URL));
assert.equal(invocation.env.PGHOST, directHost);
assert.equal(invocation.env.PGPORT, "5432");
assert.equal(invocation.env.PGUSER, "migration-user");
assert.equal(invocation.env.PGPASSWORD, migrationPassword);
assert.equal(invocation.env.PGDATABASE, "migration-db");
assert.equal(invocation.env.PGSSLMODE, "require");
assert.equal(invocation.env.PGCHANNELBINDING, "require");
assert.deepEqual(invocation.args.slice(-2), ["--tuples-only", "--no-align"]);

const first = { file: "0001_first.sql", content: "BEGIN;\nCREATE TABLE first_table (id text PRIMARY KEY);\nCOMMIT;\n" };
const second = { file: "0002_second.sql", content: "BEGIN;\nALTER TABLE first_table ADD COLUMN label text;\nCOMMIT;\n" };
const initialBatch = buildMigrationBatch([first, second], new Map());
assert.equal(initialBatch.count, 2);
assert(initialBatch.sql.indexOf("CREATE TABLE first_table") < initialBatch.sql.indexOf("ALTER TABLE first_table"));
assert.match(initialBatch.sql, /pg_advisory_xact_lock/);
assert.match(initialBatch.sql, /SET LOCAL search_path = public/);
assert.equal((initialBatch.sql.match(/INSERT INTO public\.hfj_schema_migrations/g) ?? []).length, 2);

const firstHash = /'0001_first\.sql', '([0-9a-f]{64})'/.exec(initialBatch.sql)?.[1];
assert(firstHash);
const pendingBatch = buildMigrationBatch([first, second], new Map([[first.file, firstHash]]));
assert.equal(pendingBatch.count, 1);
assert(!pendingBatch.sql.includes("CREATE TABLE first_table"));
assert.match(pendingBatch.sql, /ALTER TABLE first_table/);
assert.throws(() => buildMigrationBatch([{ ...first, content: `${first.content}\n` }, second], new Map([[first.file, firstHash]])), /content changed/);
assert.throws(() => unwrapMigration("broken.sql", "CREATE TABLE broken (id text);"), /outer BEGIN\/COMMIT/);
assert.throws(
  () => buildMigrationBatch([{ ...first, file: "0003_bad-name.sql" }], new Map()),
  /Invalid up migration/,
);

console.log("remote migration runner tests passed.");
