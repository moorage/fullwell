import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LocalHouseholdError,
  acquireLocalLock,
  appendLocalMealProposal,
  deleteCollectingLocalHousehold,
  finalizeLocalHousehold,
  initializeLocalHousehold,
  loadLocalHousehold,
  localHouseholdPath,
  recordCloudBackup,
  recordLocalMealPlanEvent,
  renameLocalHousehold,
  releaseLocalLock,
  reviewLocalMealConstraints,
  saveLocalHousehold,
  saveLocalMealPlanningProfile,
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

test("a guest household remembers its default name and uses the purpose-specific rename boundary", async () => {
  await withLocalRoot(async (root) => {
    const initialized = await initializeLocalHousehold(root, now, "Taylor's Household");
    assert.equal(initialized.journal.household.display_name, "Taylor's Household");
    const renamed = await renameLocalHousehold(root, {
      expected_revision: 1,
      household_name: "  Sunday Supper Club  ",
    }, now);
    assert.equal(renamed.revision, 2);
    assert.equal(renamed.journal.household.display_name, "Sunday Supper Club");
    await assert.rejects(
      saveLocalHousehold(root, {
        expected_revision: 2,
        journal: { household: { display_name: "Bypassed Name" } },
      }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );
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

test("meal-planning profile writes preserve unrelated journal state and distinguish explicit none", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: {
        stage: "ready",
        items: [{ id: "itm_0000000000000201", kind: "recipe", title: "Tomato tart" }],
        custom_extension: { retained: true },
      },
    }, now);
    const profileInput = {
      expected_revision: saved.revision,
      idempotency_key: "meal-profile-save-000001",
      actor_label: "Kitchen planner",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    };
    const profiled = await saveLocalMealPlanningProfile(root, profileInput, now);

    assert.equal(profiled.revision, 3);
    assert.deepEqual(profiled.journal.custom_extension, { retained: true });
    assert.equal(profiled.journal.items[0].title, "Tomato tart");
    assert.deepEqual(profiled.journal.meal_planning.profile, {
      schema_version: 1,
      revision: 1,
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
      updated_at: now.toISOString(),
      updated_by: { kind: "local", label: "Kitchen planner" },
    });

    const replayed = await saveLocalMealPlanningProfile(
      root,
      profileInput,
      new Date("2026-07-23T23:00:00.000Z"),
    );
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.revision, profiled.revision);
    await assert.rejects(saveLocalMealPlanningProfile(root, {
      ...profileInput,
      constraints: {
        status: "confirmed_none",
        time_zone: "UTC",
        reviewed_at: now.toISOString(),
      },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "IDEMPOTENCY_CONFLICT");

    const legacySaved = await saveLocalHousehold(root, {
      expected_revision: profiled.revision,
      journal: {
        stage: "complete",
        items: profiled.journal.items,
        custom_extension: { retained: true },
      },
    }, now);
    assert.deepEqual(legacySaved.journal.meal_planning, profiled.journal.meal_planning);
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: legacySaved.revision,
      journal: {
        ...legacySaved.journal,
        meal_planning: {
          ...legacySaved.journal.meal_planning,
          profile: {
            ...legacySaved.journal.meal_planning.profile,
            revision: 2,
          },
        },
      },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
  });
});

test("meal-planning profiles require canonical IANA time zones", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    for (const [index, timeZone] of ["+01:00", "US/Pacific"].entries()) {
      await assert.rejects(saveLocalMealPlanningProfile(root, {
        expected_revision: 1,
        idempotency_key: `meal-profile-timezone-${index + 1}`,
        actor_label: "Kitchen planner",
        constraints: {
          status: "confirmed_none",
          time_zone: timeZone,
          reviewed_at: now.toISOString(),
        },
      }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    }
  });
});

test("local meal planning bounds the number of distinct weeks", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: 1,
      idempotency_key: "meal-profile-week-bound-01",
      actor_label: "Kitchen planner",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const firstMonday = Date.parse("2026-07-20T00:00:00.000Z");
    const events = Array.from({ length: 521 }, (_, index) => ({
      id: `mle_${String(index).padStart(16, "0")}`,
      kind: "constraints_reviewed",
      week_start: new Date(firstMonday + index * 7 * 86_400_000).toISOString().slice(0, 10),
      actor: { kind: "local", label: "Kitchen planner" },
      constraint_revision: 1,
      occurred_at: now.toISOString(),
      schema_version: 1,
    }));
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: profiled.revision,
      journal: {
        ...profiled.journal,
        meal_planning: { ...profiled.journal.meal_planning, events },
      },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_TOO_LARGE");
  });
});

test("local meal capacity reserves one withdrawal for every accepted weekly proposal", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: 1,
      idempotency_key: "meal-capacity-profile-01",
      actor_label: "Kitchen planner",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "meal-capacity-review-01",
      actor_label: "Kitchen planner",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const proposalFor = (index, slot) => ({
      id: `mlp_${String(index).padStart(16, "0")}`,
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot,
      proposed_by: { kind: "local", label: "Kitchen planner" },
      source: { kind: "freeform", title: `Meal ${index}` },
      servings: null,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients still need review.",
      created_at: now.toISOString(),
      schema_version: 1,
    });
    const slotProposals = Array.from({ length: 48 }, (_, index) => proposalFor(index, { kind: "lunch" }));
    const filePath = localHouseholdPath(root);
    const slotFixture = JSON.parse(await readFile(filePath, "utf8"));
    slotFixture.revision += 1;
    slotFixture.updated_at = now.toISOString();
    slotFixture.journal.meal_planning.proposals = slotProposals;
    await writeFile(filePath, `${JSON.stringify(slotFixture, null, 2)}\n`);
    const slotBounded = await loadLocalHousehold(root);
    await assert.rejects(appendLocalMealProposal(root, {
      expected_revision: slotBounded.revision,
      idempotency_key: "meal-capacity-slot-overflow-01",
      actor_label: "Kitchen planner",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      source: { kind: "freeform", title: "One more lunch" },
      servings: null,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients still need review.",
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_TOO_LARGE");

    const proposals = Array.from({ length: 500 }, (_, index) => proposalFor(index, { kind: "custom", label: `Slot ${index}` }));
    const reviewEvents = [
      reviewed.event,
      ...Array.from({ length: 499 }, (_, offset) => ({
        id: `mle_r${String(offset + 1).padStart(16, "0")}`,
        kind: "constraints_reviewed",
        week_start: "2026-07-20",
        actor: { kind: "local", label: "Kitchen planner" },
        constraint_revision: 1,
        occurred_at: now.toISOString(),
        schema_version: 1,
      })),
    ];
    const withdrawalEvents = Array.from({ length: 497 }, (_, offset) => {
      const proposal = proposals[offset + 3];
      if (proposal === undefined) throw new Error("capacity fixture is incomplete");
      return {
        id: `mle_w${String(offset + 3).padStart(16, "0")}`,
        kind: "proposal_withdrawn",
        week_start: "2026-07-20",
        actor: { kind: "local", label: "Kitchen planner" },
        proposal_id: proposal.id,
        reason: null,
        occurred_at: now.toISOString(),
        schema_version: 1,
      };
    });
    const capacityFixture = JSON.parse(await readFile(filePath, "utf8"));
    capacityFixture.revision += 1;
    capacityFixture.updated_at = now.toISOString();
    capacityFixture.journal.meal_planning.proposals = proposals;
    capacityFixture.journal.meal_planning.events = [...reviewEvents, ...withdrawalEvents];
    await writeFile(filePath, `${JSON.stringify(capacityFixture, null, 2)}\n`);
    const capacity = await loadLocalHousehold(root);
    const inputs = proposals.slice(0, 3).map((proposal, index) => ({
      expected_revision: capacity.revision,
      idempotency_key: `meal-capacity-withdraw-${index}`,
      actor_label: "Kitchen planner",
      week_start: "2026-07-20",
      event: { kind: "proposal_withdrawn", proposal_id: proposal.id, reason: null },
    }));
    const withdrawals = await Promise.all(inputs.map(async (input) => await recordLocalMealPlanEvent(root, input, now)));
    assert.equal(withdrawals.every(({ status }) => status === "meal_plan_event_recorded"), true);
    assert.equal((await recordLocalMealPlanEvent(root, inputs[0], now)).status, "replayed");
    const completed = await loadLocalHousehold(root);
    assert.equal(completed.journal.meal_planning.events.length, 1_000);
    assert.equal(completed.meal_proposal_statuses.every(({ active }) => !active), true);
  });
});

test("legacy local mutations keep the immediate busy result", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const directory = path.dirname(localHouseholdPath(root));
    const lock = await acquireLocalLock(directory, now);
    try {
      await assert.rejects(saveLocalHousehold(root, {
        expected_revision: 1,
        journal: { stage: "ready" },
      }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_BUSY");
    } finally {
      await releaseLocalLock(lock);
    }
  });
});

test("two stale-lock recoveries serialize without overlapping owners", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const directory = path.dirname(localHouseholdPath(root));
    await writeFile(path.join(directory, ".household.lock"), JSON.stringify({
      token: "stale-owner",
      created_at: "2026-07-22T22:00:00.000Z",
    }));
    let activeOwners = 0;
    let maximumOwners = 0;
    const contend = async () => {
      const lock = await acquireLocalLock(directory, now, { waitForLiveWriter: true });
      activeOwners += 1;
      maximumOwners = Math.max(maximumOwners, activeOwners);
      await new Promise((resolve) => setTimeout(resolve, 40));
      activeOwners -= 1;
      await releaseLocalLock(lock);
    };
    await Promise.all([contend(), contend()]);
    assert.equal(maximumOwners, 1);
  });
});

test("an abandoned lock guard is retired without deleting a replacement guard", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const directory = path.dirname(localHouseholdPath(root));
    const guardPath = path.join(directory, ".household.lock.guard");
    const staleToken = "00000000-0000-4000-8000-000000000001";
    await mkdir(guardPath, { mode: 0o700 });
    await writeFile(path.join(guardPath, "owner.json"), JSON.stringify({
      token: staleToken,
      pid: 2_147_483_647,
      created_at: "2026-07-22T22:00:00.000Z",
    }));
    const lock = await acquireLocalLock(directory, now, { waitForLiveWriter: true });
    await releaseLocalLock(lock);
    assert.equal((await stat(`${guardPath}.retired-${staleToken}`)).isDirectory(), true);
  });
});

test("an abandoned empty main lock is recoverable after its stale interval", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const directory = path.dirname(localHouseholdPath(root));
    const lockPath = path.join(directory, ".household.lock");
    await writeFile(lockPath, "");
    const staleTime = new Date("2026-07-22T22:00:00.000Z");
    await utimes(lockPath, staleTime, staleTime);
    const lock = await acquireLocalLock(directory, now, { waitForLiveWriter: true });
    await releaseLocalLock(lock);
    await assert.rejects(stat(lockPath), (error) => error?.code === "ENOENT");
  });
});

test("local meal proposals require the current profile review and preserve concurrent same-slot appends", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: 1,
      idempotency_key: "meal-profile-recorded-01",
      actor_label: "Maya",
      constraints: {
        status: "recorded",
        time_zone: "America/Los_Angeles",
        allergy_labels: ["Peanut"],
        sensitivity_labels: [],
        reviewed_at: now.toISOString(),
      },
    }, now);

    await assert.rejects(appendLocalMealProposal(root, {
      expected_revision: profiled.revision,
      idempotency_key: "proposal-before-review-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      source: { kind: "freeform", title: "Pizza" },
      servings: null,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: "mle_0000000000000001",
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not yet known.",
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "MEAL_CONSTRAINT_REVIEW_REQUIRED");

    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "review-week-2026-07-20",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const common = {
      expected_revision: reviewed.revision,
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "lunch" },
      servings: null,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not yet known.",
    };
    const [eggSalad, pizza] = await Promise.all([
      appendLocalMealProposal(root, {
        ...common,
        idempotency_key: "proposal-egg-salad-0001",
        actor_label: "Maya",
        source: { kind: "freeform", title: "Egg salad sandwich" },
      }, now),
      appendLocalMealProposal(root, {
        ...common,
        idempotency_key: "proposal-pizza-0000001",
        actor_label: "Jules",
        source: { kind: "freeform", title: "Pizza" },
      }, now),
    ]);

    assert.notEqual(eggSalad.proposal.id, pizza.proposal.id);
    const loaded = await loadLocalHousehold(root);
    assert.equal(loaded.revision, reviewed.revision + 2);
    assert.deepEqual(
      loaded.journal.meal_planning.proposals.map(({ source }) => source.title).sort(),
      ["Egg salad sandwich", "Pizza"],
    );
    assert.deepEqual(
      loaded.journal.meal_planning.proposals.map(({ proposed_by }) => proposed_by.label).sort(),
      ["Jules", "Maya"],
    );
  });
});

test("local meal-planning idempotency replays exact input, rejects changed reuse, and attributes withdrawal", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: 1,
      idempotency_key: "meal-profile-none-000001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "review-week-2026-07-20",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const input = {
      expected_revision: reviewed.revision,
      idempotency_key: "proposal-pizza-replay-01",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-21",
      slot: { kind: "dinner" },
      source: { kind: "freeform", title: "Pizza" },
      servings: 4,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Toppings are not yet known.",
    };
    const created = await appendLocalMealProposal(root, input, now);
    const replayed = await appendLocalMealProposal(root, input, new Date("2026-07-23T00:00:00.000Z"));
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.proposal.id, created.proposal.id);
    assert.equal(replayed.revision, created.revision);

    await assert.rejects(
      appendLocalMealProposal(root, { ...input, source: { kind: "freeform", title: "Tacos" } }, now),
      (error) => error instanceof LocalHouseholdError && error.code === "IDEMPOTENCY_CONFLICT",
    );

    const withdrawn = await recordLocalMealPlanEvent(root, {
      expected_revision: created.revision,
      idempotency_key: "withdraw-pizza-00000001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      event: {
        kind: "proposal_withdrawn",
        proposal_id: created.proposal.id,
        reason: "Changed plans",
      },
    }, now);
    assert.deepEqual(withdrawn.event.actor, { kind: "local", label: "Maya" });
    assert.equal(withdrawn.event.proposal_id, created.proposal.id);
    assert.equal((await loadLocalHousehold(root)).journal.meal_planning.events.length, 2);
  });
});

test("local journal recipes require current Liked evidence and become stale after recipe changes", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const itemId = "itm_0000000000000301";
    const likedEvidenceId = "evd_0000000000000301";
    const recipe = {
      id: itemId,
      kind: "recipe",
      title: "Tomato tart",
      liked: "yes",
      evidence_ids: [likedEvidenceId],
    };
    const evidence = [{
      id: likedEvidenceId,
      kind: "user_confirmation",
      confirmation: {
        subject: "recipe_preference",
        recipe_item_id: itemId,
        preference: "liked",
      },
    }];
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: { items: [recipe], evidence },
    }, now);
    const itemRevision = saved.recipe_content_revisions[0].item_revision;
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: saved.revision,
      idempotency_key: "meal-profile-recipe-0001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "meal-review-recipe-00001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const proposalInput = {
      expected_revision: reviewed.revision,
      idempotency_key: "meal-proposal-recipe-001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-21",
      slot: { kind: "dinner" },
      source: {
        kind: "journal_recipe",
        item_id: itemId,
        item_revision: itemRevision,
        liked_evidence_ids: [likedEvidenceId],
      },
      servings: 4,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "appears_compatible",
      compatibility_caveat: "Appears compatible based on the listed ingredients.",
    };
    await assert.rejects(appendLocalMealProposal(root, {
      ...proposalInput,
      idempotency_key: "meal-proposal-bad-like-1",
      source: {
        ...proposalInput.source,
        liked_evidence_ids: ["evd_0000000000000399"],
      },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const proposed = await appendLocalMealProposal(root, proposalInput, now);
    const journalWithoutPlanning = Object.fromEntries(
      Object.entries(proposed.journal).filter(([key]) => key !== "meal_planning"),
    );
    const changed = await saveLocalHousehold(root, {
      expected_revision: proposed.revision,
      journal: {
        ...journalWithoutPlanning,
        items: [{ ...recipe, title: "Tomato and thyme tart" }],
      },
    }, now);
    assert.notEqual(changed.recipe_content_revisions[0].item_revision, itemRevision);
    assert.deepEqual(changed.meal_proposal_statuses, [{
      proposal_id: proposed.proposal.id,
      active: true,
      effective_compatibility: "needs_recheck",
    }]);
  });
});
