import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultHouseholdName,
  loadLocalProfile,
  localProfilePath,
  updateLocalProfile,
} from "../../runtime/local-profile.mjs";
import { LocalHouseholdError } from "../../runtime/local-household.mjs";

const now = new Date("2026-07-24T01:00:00.000Z");

async function withLocalRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-local-profile-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("a local profile remembers the member name privately and derives the first household name", async () => {
  await withLocalRoot(async (root) => {
    assert.deepEqual(await loadLocalProfile(root), { status: "missing" });
    const created = await updateLocalProfile(root, { expected_revision: 0, display_name: "Taylor" }, now);
    assert.deepEqual(created, {
      status: "created",
      revision: 1,
      display_name: "Taylor",
      default_household_name: "Taylor's Household",
    });
    assert.deepEqual(await loadLocalProfile(root), { ...created, status: "found" });
    assert.equal((await stat(localProfilePath(root))).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(localProfilePath(root), "utf8")).display_name, "Taylor");
  });
});

test("a local profile handles possessive names and revision-checked renames", async () => {
  await withLocalRoot(async (root) => {
    assert.equal(defaultHouseholdName("Chris"), "Chris' Household");
    await updateLocalProfile(root, { expected_revision: 0, display_name: "Taylor" }, now);
    const renamed = await updateLocalProfile(root, { expected_revision: 1, display_name: "  Chris  " }, now);
    assert.equal(renamed.revision, 2);
    assert.equal(renamed.display_name, "Chris");
    assert.equal(renamed.default_household_name, "Chris' Household");
    await assert.rejects(
      updateLocalProfile(root, { expected_revision: 1, display_name: "Morgan" }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_PROFILE_CONFLICT",
    );
    await assert.rejects(
      updateLocalProfile(root, { expected_revision: 2, display_name: "Chris\nTaylor" }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );
  });
});

test("a malformed local profile fails closed", async () => {
  await withLocalRoot(async (root) => {
    await updateLocalProfile(root, { expected_revision: 0, display_name: "Taylor" }, now);
    await writeFile(localProfilePath(root), "{\"schema_version\":1,\"revision\":0}\n", { mode: 0o600 });
    await assert.rejects(
      loadLocalProfile(root),
      (error) => error instanceof LocalHouseholdError && error.code === "CORRUPT_LOCAL_PROFILE",
    );
  });
});
