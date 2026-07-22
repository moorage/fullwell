import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DraftError,
  deleteOnboardingDraft,
  loadOnboardingDraft,
  onboardingDraftPath,
  saveOnboardingDraft,
} from "../../runtime/onboarding-draft.mjs";

const userId = "usr_0000000000000201";
const otherUserId = "usr_0000000000000202";
const householdId = "hsh_0000000000000201";
const head = "a".repeat(40);
const revisions = { snacks: 0, recipes: 2 };
const now = new Date("2026-07-22T12:00:00.000Z");
const runtimePath = fileURLToPath(new URL("../../runtime/onboarding-draft.mjs", import.meta.url));

async function withDraftRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-draft-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("local onboarding drafts are private, resumable, and isolated by Fullwell identity", async () => {
  await withDraftRoot(async (root) => {
    const saved = await saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { stage: "snacks", completed_order_ids: ["order-1"] },
    }, now);
    assert.equal(saved.draft_revision, 1);

    const filePath = onboardingDraftPath(root, userId, householdId);
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    for (const directory of [
      path.join(root, "fullwell"),
      path.join(root, "fullwell", "drafts"),
      path.join(root, "fullwell", "drafts", userId),
      path.dirname(filePath),
    ]) {
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
    }

    assert.deepEqual(await loadOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
    }, now), {
      status: "found",
      draft_revision: 1,
      draft: { stage: "snacks", completed_order_ids: ["order-1"] },
    });
    assert.deepEqual(await loadOnboardingDraft(root, {
      user_id: otherUserId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
    }, now), { status: "missing" });
  });
});

test("snapshot and local revision mismatches fail closed", async () => {
  await withDraftRoot(async (root) => {
    await saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { stage: "recipes" },
    }, now);
    assert.deepEqual(await loadOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: "b".repeat(40),
      onboarding_revisions: revisions,
    }, now), { status: "unusable", reason: "repository_changed", draft_revision: 1 });
    assert.deepEqual(await loadOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: { snacks: 1, recipes: 2 },
    }, now), { status: "unusable", reason: "onboarding_changed", draft_revision: 1 });

    await saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 1,
      draft: { stage: "review" },
    }, now);
    await assert.rejects(saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 1,
      draft: { stage: "snacks" },
    }, now), (error) => error instanceof DraftError && error.code === "DRAFT_CONFLICT");
  });
});

test("expired, malformed, and prohibited drafts cannot resume", async () => {
  await withDraftRoot(async (root) => {
    await saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { stage: "snacks" },
    }, now);
    const expiredAt = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    assert.deepEqual(await loadOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
    }, expiredAt), { status: "unusable", reason: "expired", draft_revision: 1 });
    assert.deepEqual(await deleteOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_draft_revision: 1,
    }, expiredAt), { status: "deleted" });

    const filePath = onboardingDraftPath(root, userId, householdId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "not json", { mode: 0o600 });
    await assert.rejects(loadOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
    }, now), (error) => error instanceof DraftError && error.code === "CORRUPT_DRAFT");
    assert.deepEqual(await deleteOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_draft_revision: null,
    }, now), { status: "deleted_invalid" });

    await assert.rejects(saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { browser_state: { cookies: [] } },
    }, now), (error) => error instanceof DraftError && error.code === "PROHIBITED_DRAFT_DATA");
  });
});

test("successful cleanup deletes only the exact current shard revision", async () => {
  await withDraftRoot(async (root) => {
    await saveOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { stage: "review" },
    }, now);
    await assert.rejects(deleteOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_draft_revision: 0,
    }, now), (error) => error instanceof DraftError && error.code === "DRAFT_CONFLICT");
    assert.deepEqual(await deleteOnboardingDraft(root, {
      user_id: userId,
      household_id: householdId,
      expected_draft_revision: 1,
    }, now), { status: "deleted" });
    await assert.rejects(readFile(onboardingDraftPath(root, userId, householdId), "utf8"), { code: "ENOENT" });
  });
});

test("the bundled command accepts one JSON request on standard input", async () => {
  await withDraftRoot(async (root) => {
    const execute = (request) => spawnSync(process.execPath, [runtimePath], {
      encoding: "utf8",
      env: { ...process.env, CODEX_HOME: root },
      input: JSON.stringify(request),
    });
    const saved = execute({
      operation: "save",
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
      expected_draft_revision: 0,
      draft: { stage: "snacks", source: "example grocery" },
    });
    assert.equal(saved.status, 0, saved.stderr || saved.stdout);
    assert.deepEqual(JSON.parse(saved.stdout), {
      ok: true,
      status: "saved",
      draft_revision: 1,
      expires_at: JSON.parse(await readFile(onboardingDraftPath(root, userId, householdId), "utf8")).expires_at,
    });
    const loaded = execute({
      operation: "load",
      user_id: userId,
      household_id: householdId,
      expected_head: head,
      onboarding_revisions: revisions,
    });
    assert.equal(loaded.status, 0, loaded.stderr || loaded.stdout);
    assert.deepEqual(JSON.parse(loaded.stdout), {
      ok: true,
      status: "found",
      draft_revision: 1,
      draft: { stage: "snacks", source: "example grocery" },
    });
  });
});
