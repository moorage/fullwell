import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LocalHouseholdError,
  deleteCollectingLocalHousehold,
  finalizeLocalHousehold,
  initializeLocalHousehold,
  loadLocalHousehold,
  localHouseholdPath,
  recordCloudBackup,
  saveLocalHousehold,
} from "../../runtime/local-household.mjs";

const now = new Date("2026-07-22T23:00:00.000Z");
const userId = "usr_0000000000000201";
const householdId = "hsh_0000000000000201";
const repositoryHead = "a".repeat(40);
const runtimePath = fileURLToPath(new URL("../../runtime/local-household.mjs", import.meta.url));

async function withLocalRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-local-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("a guest household initializes privately and resumes without Fullwell identity", async () => {
  await withLocalRoot(async (root) => {
    const initialized = await initializeLocalHousehold(root, now);
    assert.equal(initialized.status, "initialized");
    assert.match(initialized.local_household_id, /^lcl_[0-9a-f]{32}$/);
    assert.match(initialized.promotion_idempotency_key, /^local-backup-[0-9a-f]{32}$/);
    assert.equal(initialized.revision, 1);
    assert.equal(initialized.state, "collecting");
    assert.equal(initialized.cloud_backup, null);

    const filePath = localHouseholdPath(root);
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    for (const directory of [path.join(root, "fullwell"), path.join(root, "fullwell", "local")]) {
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
    }
    assert.equal((await initializeLocalHousehold(root, now)).status, "existing");
    assert.deepEqual(await loadLocalHousehold(root), { ...initialized, status: "found" });
  });
});

test("guest progress is revision-checked, finalizable, and usable without cloud backup", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: {
        stage: "recipes",
        items: [{ kind: "ingredient", title: "Flat-leaf parsley", stores: ["Example Grocery"] }],
      },
    }, now);
    assert.equal(saved.revision, 2);
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: { stage: "snacks" },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_CONFLICT");

    const ready = await finalizeLocalHousehold(root, { expected_revision: 2 }, now);
    assert.equal(ready.state, "ready");
    assert.equal(ready.revision, 3);
    assert.equal(ready.cloud_backup_current, false);
    assert.deepEqual((await finalizeLocalHousehold(root, { expected_revision: 3 }, now)).journal, saved.journal);
    await assert.rejects(deleteCollectingLocalHousehold(root, { expected_revision: 3 }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_READY");
  });
});

test("cloud linkage is recorded only for ready data and becomes stale after a local change", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    await assert.rejects(recordCloudBackup(root, {
      expected_revision: 1,
      user_id: userId,
      household_id: householdId,
      repository_head: repositoryHead,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_NOT_READY");
    assert.equal((await loadLocalHousehold(root)).cloud_backup, null);

    await finalizeLocalHousehold(root, { expected_revision: 1 }, now);
    const backedUp = await recordCloudBackup(root, {
      expected_revision: 2,
      user_id: userId,
      household_id: householdId,
      repository_head: repositoryHead,
    }, now);
    assert.equal(backedUp.revision, 3);
    assert.equal(backedUp.cloud_backup.local_revision, 3);
    assert.equal(backedUp.cloud_backup_current, true);

    const changed = await saveLocalHousehold(root, {
      expected_revision: 3,
      journal: { stage: "ready", items: [{ kind: "condiment", title: "Mayonnaise" }] },
    }, now);
    assert.equal(changed.cloud_backup_current, false);
    assert.equal(changed.cloud_backup.local_revision, 3);
  });
});

test("guest storage rejects browser and authentication material", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    for (const journal of [
      { browser_state: { cookies: [] } },
      { source: { access_token: "secret" } },
      { source: { accessToken: "secret" } },
      { source: { token: "secret" } },
      { audit: { raw_pages: ["html"] } },
    ]) {
      await assert.rejects(saveLocalHousehold(root, { expected_revision: 1, journal }, now),
        (error) => error instanceof LocalHouseholdError && error.code === "PROHIBITED_LOCAL_DATA");
    }
    assert.equal((await loadLocalHousehold(root)).revision, 1);
  });
});

test("guest storage enforces the onboarding item and evidence bounds", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const atLimit = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: { items: Array.from({ length: 10_000 }, (_, index) => ({ id: `item-${index}` })), evidence: [] },
    }, now);
    assert.equal(atLimit.revision, 2);
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 2,
      journal: { items: [], evidence: Array.from({ length: 10_001 }, (_, index) => ({ id: `evidence-${index}` })) },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_TOO_LARGE");
  });
});

test("cancelling deletes only an unfinalized guest household at the exact revision", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    await assert.rejects(deleteCollectingLocalHousehold(root, { expected_revision: 2 }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_CONFLICT");
    assert.deepEqual(await deleteCollectingLocalHousehold(root, { expected_revision: 1 }, now), { status: "deleted" });
    assert.deepEqual(await loadLocalHousehold(root), { status: "missing" });
  });
});

test("the bundled local-household command accepts one JSON request on standard input", async () => {
  await withLocalRoot(async (root) => {
    const execute = (request) => spawnSync(process.execPath, [runtimePath], {
      encoding: "utf8",
      env: { ...process.env, CODEX_HOME: root },
      input: JSON.stringify(request),
    });
    const initialized = execute({ operation: "initialize" });
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    assert.equal(JSON.parse(initialized.stdout).status, "initialized");
    const loaded = execute({ operation: "load" });
    assert.equal(loaded.status, 0, loaded.stderr || loaded.stdout);
    assert.equal(JSON.parse(loaded.stdout).status, "found");
    assert.equal(JSON.parse(await readFile(localHouseholdPath(root), "utf8")).schema_version, 1);
  });
});
