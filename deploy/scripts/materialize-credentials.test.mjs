import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const credentials = [
  "database-url",
  "database-direct-url",
  "token-pepper",
  "session-secret",
  "operator-token",
  "apple-private-key",
  "mail-provider-api-key",
  "git-signing-key",
  "git-allowed-signers",
  "object-storage-access-key-id",
  "object-storage-secret-access-key",
  "backup-encryption-key",
  "backup-manifest-private-key",
  "backup-manifest-public-key",
];
const script = fileURLToPath(new URL("./materialize-credentials.sh", import.meta.url));
const deployRoot = fileURLToPath(new URL("../", import.meta.url));

test("materializes every systemd credential for the unprivileged container runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "hfj-credentials-"));
  const source = join(root, "source");
  const target = join(root, "target");
  await Promise.all([mkdir(source), mkdir(target)]);
  await Promise.all(credentials.map((name) => writeFile(join(source, name), `secret:${name}\n`, { mode: 0o400 })));

  const result = runScript(source, target);

  assert.equal(result.status, 0, result.stderr);
  for (const name of credentials) {
    assert.equal(await readFile(join(target, name), "utf8"), `secret:${name}\n`);
    const metadata = await stat(join(target, name));
    assert.equal(metadata.mode & 0o777, 0o440);
    assert.equal(metadata.uid, process.getuid());
    assert.equal(metadata.gid, process.getgid());
  }
});

test("fails before deployment when a required credential is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "hfj-credentials-missing-"));
  const source = join(root, "source");
  const target = join(root, "target");
  await Promise.all([mkdir(source), mkdir(target)]);

  const result = runScript(source, target);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing systemd credential: database-url/);
});

test("systemd keeps runtime credentials available and recreates containers when they rotate", async () => {
  const [compose, dockerfile, service, maintenance] = await Promise.all([
    readFile(join(deployRoot, "compose.yaml"), "utf8"),
    readFile(join(deployRoot, "../Dockerfile"), "utf8"),
    readFile(join(deployRoot, "systemd/household-food-journal.service"), "utf8"),
    readFile(join(deployRoot, "systemd/household-food-journal-maintenance.service"), "utf8"),
  ]);

  assert.match(compose, /DEPLOY_CREDENTIALS_DIRECTORY/);
  assert.doesNotMatch(compose, /^\s*init:\s*true\s*$/m);
  assert.match(dockerfile, /ENTRYPOINT \["\/sbin\/tini", "--"\]/);
  assert.match(service, /RuntimeDirectory=household-food-journal\/credentials/);
  assert.match(service, /ExecStartPre=.*materialize-credentials\.sh/);
  assert.match(service, /ExecStart=.*--force-recreate.*--wait/);
  assert.doesNotMatch(service, /ExecReload=/);
  assert.match(maintenance, /DEPLOY_CREDENTIALS_DIRECTORY=\/run\/household-food-journal\/credentials/);
  assert.doesNotMatch(maintenance, /LoadCredentialEncrypted=/);
});

function runScript(source, target) {
  return spawnSync("sh", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      CREDENTIALS_DIRECTORY: source,
      DEPLOY_CREDENTIALS_DIRECTORY: target,
      HFJ_RUNTIME_CREDENTIAL_UID: String(process.getuid()),
      HFJ_RUNTIME_CREDENTIAL_GID: String(process.getgid()),
    },
  });
}
