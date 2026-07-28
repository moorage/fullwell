import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDatabaseUrl, buildPostgresRunArgs, hasVolume, localPostgres, parseJsonArray, parsePostgresCredentials, validateBuildContainerVersion, validateManagedContainer } from "./apple-container.mjs";

const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");
assert.ok(
  dockerfile.indexOf("RUN npm run build --workspace @hfj/contracts") < dockerfile.indexOf("RUN npm run build\n"),
  "The production image must build contracts before dependent workspaces.",
);

assert.deepEqual(parseJsonArray('[{"name":"volume"}]', "test source"), [{ name: "volume" }]);
assert.throws(() => parseJsonArray("not-json", "test source"), /valid JSON/);
assert.throws(() => parseJsonArray("{}", "test source"), /array of objects/);
assert.throws(() => parseJsonArray("[null]", "test source"), /array of objects/);

assert.deepEqual(
  parsePostgresCredentials("POSTGRES_USER=hfj\nPOSTGRES_PASSWORD=secret\nPOSTGRES_DB=hfj_test\n"),
  { user: "hfj", password: "secret", database: "hfj_test" },
);
assert.throws(() => parsePostgresCredentials("POSTGRES_USER=hfj\nPOSTGRES_USER=other\n"), /repeats POSTGRES_USER/);
assert.throws(() => parsePostgresCredentials("POSTGRES_USER\n"), /malformed/);
assert.throws(() => parsePostgresCredentials("POSTGRES_USER=hfj\n"), /missing POSTGRES_PASSWORD/);

const databaseUrl = new URL(buildDatabaseUrl({ user: "local-user", password: "local-password", database: "local-database" }));
assert.equal(databaseUrl.username, "local-user");
assert.equal(databaseUrl.password, "local-password");
assert.equal(databaseUrl.hostname, "127.0.0.1");
assert.equal(databaseUrl.port, "55432");
assert.equal(databaseUrl.pathname, "/local-database");

assert.equal(validateBuildContainerVersion("container CLI version 0.12.0 (build: release)"), "0.12.0");
assert.equal(validateBuildContainerVersion("container CLI version 1.1.0 (build: release)"), "1.1.0");
assert.throws(() => validateBuildContainerVersion("container CLI version 0.11.0 (build: release)"), /upgrade to 0.12.0/);
assert.throws(() => validateBuildContainerVersion("unexpected output"), /determine/);

assert.deepEqual(buildPostgresRunArgs(), [
  "run", "--detach", "--name", "hfj-postgres",
  "--label", "com.fullwell.hfj.role=local-postgres",
  "--publish", "127.0.0.1:55432:5432",
  "--env-file", localPostgres.envFile,
  "--env", "PGDATA=/var/lib/postgresql/data/pgdata",
  "--volume", "hfj-postgres-data:/var/lib/postgresql/data",
  "--memory", "1G", "--cpus", "2",
  "docker.io/library/postgres:17-alpine",
]);

const managed = {
  status: "stopped",
  configuration: {
    id: "hfj-postgres",
    labels: { "com.fullwell.hfj.role": "local-postgres" },
    publishedPorts: [{ hostAddress: "127.0.0.1", hostPort: 55_432, containerPort: 5_432 }],
  },
};
assert.equal(validateManagedContainer(managed), "stopped");
assert.equal(validateManagedContainer({ ...managed, status: "running" }), "running");
assert.equal(validateManagedContainer({ ...managed, status: { state: "stopped", networks: [] } }), "stopped");
assert.throws(() => validateManagedContainer({ ...managed, configuration: { ...managed.configuration, labels: {} } }), /not managed/);
assert.throws(() => validateManagedContainer({ ...managed, configuration: { ...managed.configuration, publishedPorts: [] } }), /only on/);
assert.throws(() => validateManagedContainer({ ...managed, status: "paused" }), /unsupported status/);
assert.throws(() => validateManagedContainer({ status: "running", configuration: null }), /unreadable/);

assert.equal(hasVolume([{ name: "hfj-postgres-data" }], "hfj-postgres-data"), true);
assert.equal(hasVolume([{ id: "hfj-postgres-data", configuration: { name: "hfj-postgres-data" } }], "hfj-postgres-data"), true);
assert.equal(hasVolume([{ configuration: { name: "other" } }], "hfj-postgres-data"), false);

console.log("Apple Container harness tests passed.");
