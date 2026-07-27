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
  recordLocalDeliveryPromotion,
  recordLocalMealPlanEvent,
  repairLocalHouseholdCompatibility,
  renameLocalHousehold,
  releaseLocalLock,
  reviewLocalMealConstraints,
  saveLocalHousehold,
  saveLocalMealPlanningProfile,
  stageLocalDeliveryPromotion,
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

    const legacyDocument = JSON.parse(await readFile(filePath, "utf8"));
    delete legacyDocument.delivery_promotions;
    await writeFile(filePath, `${JSON.stringify(legacyDocument, null, 2)}\n`);
    assert.deepEqual((await loadLocalHousehold(root)).delivery_promotions, []);
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

test("delivery reports require complete dish, evidence, and location coverage", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const first = deliveryJournalFixture({
      seed: "0191",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const second = deliveryJournalFixture({
      seed: "0192",
      providerOrigin: "https://other-delivery.example/",
      providerLabel: "Uber Eats",
      locationLabel: "Cupertino",
    });

    const orphanEvidence = structuredClone(first);
    orphanEvidence.evidence.push(second.evidence[0]);
    orphanEvidence.delivery_profile.profile.providers.push(second.delivery_profile.profile.providers[0]);
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: orphanEvidence,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const orphanReportRow = combineDeliveryJournals(first, second);
    orphanReportRow.delivery_report.assertions = [orphanReportRow.delivery_report.assertions[0]];
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: orphanReportRow,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const emptyReport = structuredClone(first);
    emptyReport.delivery_report.assertions = [];
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: emptyReport,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const mixedLocationRow = combineDeliveryJournals(first, second);
    mixedLocationRow.delivery_report.assertions = [{
      row_id: "mixed-provider-location",
      item_ids: mixedLocationRow.items.map(({ id }) => id),
      evidence_ids: mixedLocationRow.evidence.map(({ id }) => id),
      distinct_order_count: 2,
      last_date: "2026-07-20",
    }];
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: mixedLocationRow,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const valid = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: combineDeliveryJournals(first, second),
    }, now);
    assert.equal(valid.journal.delivery_report.assertions.length, 2);
  });
});

test("general saves preserve delivery history and complete refreshes enrich dishes without mutating evidence", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const first = deliveryJournalFixture({
      seed: "0193",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const second = deliveryJournalFixture({
      seed: "0194",
      providerOrigin: "https://other-delivery.example/",
      providerLabel: "Uber Eats",
      locationLabel: "Cupertino",
    });
    const initial = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: combineDeliveryJournals(first, second),
    }, now);
    const deliveryBytes = JSON.stringify({
      evidence: initial.journal.evidence,
      items: initial.journal.items,
      delivery_profile: initial.journal.delivery_profile,
      delivery_report: initial.journal.delivery_report,
    });

    const unrelated = await saveLocalHousehold(root, {
      expected_revision: initial.revision,
      journal: {
        stage: "recipes",
        evidence: [{ id: "recipe-evidence-1", kind: "user_confirmation" }],
        items: [{ id: "recipe-item-1", kind: "recipe", title: "Tomato tart" }],
      },
    }, now);
    assert.equal(JSON.stringify({
      evidence: unrelated.journal.evidence.filter(({ kind }) => kind === "delivery_order_line"),
      items: unrelated.journal.items.filter(({ kind }) => kind === "delivery_dish"),
      delivery_profile: unrelated.journal.delivery_profile,
      delivery_report: unrelated.journal.delivery_report,
    }), deliveryBytes);

    const deleted = structuredClone(unrelated.journal);
    deleted.evidence = deleted.evidence.filter(({ id }) => id !== first.evidence[0].id);
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: deleted,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const mutated = structuredClone(unrelated.journal);
    mutated.evidence.find(({ id }) => id === first.evidence[0].id).summary = "Changed old evidence";
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: mutated,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const refreshOccurrence = deliveryJournalFixture({
      seed: "0195",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    refreshOccurrence.evidence[0].delivery_order_line.restaurant = structuredClone(
      first.evidence[0].delivery_order_line.restaurant,
    );
    const refreshed = structuredClone(unrelated.journal);
    refreshed.evidence.push(refreshOccurrence.evidence[0]);
    const refreshedDish = refreshed.items.find(({ id }) => id === first.items[0].id);
    refreshedDish.evidence_ids.push(refreshOccurrence.evidence[0].id);
    refreshedDish.updated_at = "2026-07-23T00:00:00.000Z";
    refreshedDish.image_url = "https://images.example.test/wintermelon.jpg";
    refreshedDish.image_page_url = "https://delivery.example.test/menu/wintermelon";
    refreshedDish.known_menu_item_locators.push(
      refreshOccurrence.evidence[0].delivery_order_line.historical_menu_item_locator,
    );
    refreshedDish.known_modifier_occurrences.push(
      refreshOccurrence.items[0].known_modifier_occurrences[0],
    );
    const refreshedProvider = refreshed.delivery_profile.profile.providers.find(
      ({ provider_origin }) => provider_origin === "https://delivery.example/",
    );
    refreshedProvider.completed_history_cursor = {
      completed_order_date: "2026-07-20",
      provider_order_locator: "order-0195",
    };
    const refreshedRow = refreshed.delivery_report.assertions.find(
      ({ row_id }) => row_id === "row-0193",
    );
    refreshedRow.evidence_ids.push(refreshOccurrence.evidence[0].id);
    refreshedRow.distinct_order_count = 2;

    const rewritesOtherProvider = structuredClone(refreshed);
    rewritesOtherProvider.delivery_profile.profile.providers[1].provider_label = "Changed Uber Eats";
    rewritesOtherProvider.delivery_report.assertions[1].row_id = "rewritten-other-provider";
    rewritesOtherProvider.items.find(
      ({ provider_origin }) => provider_origin === "https://other-delivery.example/",
    ).body_markdown = "Changed with another provider's refresh";
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: rewritesOtherProvider,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const otherProviderBefore = JSON.stringify({
      profile: unrelated.journal.delivery_profile.profile.providers[1],
      report: unrelated.journal.delivery_report.assertions[1],
      evidence: second.evidence,
      items: second.items,
    });
    const unsafeImage = structuredClone(refreshed);
    unsafeImage.items.find(({ id }) => id === first.items[0].id).image_url =
      "http://images.example.test/wintermelon.jpg";
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: unsafeImage,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    const missingImagePage = structuredClone(refreshed);
    missingImagePage.items.find(({ id }) => id === first.items[0].id).image_page_url = null;
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: missingImagePage,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    const updated = await saveLocalHousehold(root, {
      expected_revision: unrelated.revision,
      journal: refreshed,
    }, now);
    assert.deepEqual(
      updated.journal.items.find(({ id }) => id === first.items[0].id).evidence_ids,
      [first.evidence[0].id, refreshOccurrence.evidence[0].id],
    );
    assert.equal(
      updated.journal.items.find(({ id }) => id === first.items[0].id).image_url,
      "https://images.example.test/wintermelon.jpg",
    );
    assert.equal(JSON.stringify({
      profile: updated.journal.delivery_profile.profile.providers[1],
      report: updated.journal.delivery_report.assertions[1],
      evidence: updated.journal.evidence.filter(({ delivery_order_line }) =>
        delivery_order_line?.provider_origin === "https://other-delivery.example/"),
      items: updated.journal.items.filter(({ provider_origin }) =>
        provider_origin === "https://other-delivery.example/"),
    }), otherProviderBefore);
  });
});

test("legacy local delivery dishes normalize absent image provenance to null", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const delivery = deliveryJournalFixture({
      seed: "0209",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: delivery,
    }, now);
    const filePath = localHouseholdPath(root);
    const legacy = JSON.parse(await readFile(filePath, "utf8"));
    delete legacy.journal.items[0].image_url;
    delete legacy.journal.items[0].image_page_url;
    await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}\n`);

    const loaded = await loadLocalHousehold(root);
    assert.equal(loaded.revision, saved.revision);
    assert.equal(loaded.journal.items[0].image_url, null);
    assert.equal(loaded.journal.items[0].image_page_url, null);
  });
});

test("delivery audits save complete canonical orders and retain provider-scoped promotion authority", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const firstOrder = deliveryJournalFixture({
      seed: "0201",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Stanford Shopping Center, Palo Alto",
    });
    const incomplete = structuredClone(firstOrder);
    incomplete.evidence[0].delivery_order_line.declared_line_count = 2;
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: incomplete,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    const malformedReport = structuredClone(firstOrder);
    malformedReport.delivery_report.assertions[0].evidence_ids = ["evd_0000000000000999"];
    await assert.rejects(saveLocalHousehold(root, {
      expected_revision: 1,
      journal: malformedReport,
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const firstSaved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: firstOrder,
    }, now);
    const firstOrderBytes = JSON.stringify({
      evidence: firstSaved.journal.evidence,
      items: firstSaved.journal.items,
      delivery_profile: firstSaved.journal.delivery_profile,
      delivery_report: firstSaved.journal.delivery_report,
    });
    const secondOrder = deliveryJournalFixture({
      seed: "0202",
      providerOrigin: "https://other-delivery.example/",
      providerLabel: "Uber Eats",
      locationLabel: "Cupertino",
    });
    const combined = combineDeliveryJournals(firstOrder, secondOrder);
    const secondSaved = await saveLocalHousehold(root, {
      expected_revision: firstSaved.revision,
      journal: combined,
    }, now);
    assert.equal(secondSaved.journal.evidence.length, 2);
    assert.equal(secondSaved.journal.delivery_profile.profile.providers.length, 2);
    assert.equal(JSON.stringify({
      evidence: secondSaved.journal.evidence.slice(0, 1),
      items: secondSaved.journal.items.slice(0, 1),
      delivery_profile: {
        ...secondSaved.journal.delivery_profile,
        profile: {
          ...secondSaved.journal.delivery_profile.profile,
          providers: secondSaved.journal.delivery_profile.profile.providers.slice(0, 1),
        },
      },
      delivery_report: {
        ...secondSaved.journal.delivery_report,
        assertions: secondSaved.journal.delivery_report.assertions.slice(0, 1),
      },
    }), firstOrderBytes);

    const renamed = await renameLocalHousehold(root, {
      expected_revision: secondSaved.revision,
      household_name: "Delivery Table",
    }, now);
    assert.deepEqual(renamed.journal.evidence, secondSaved.journal.evidence);
    assert.deepEqual(renamed.journal.items, secondSaved.journal.items);
    assert.deepEqual(renamed.journal.delivery_profile, secondSaved.journal.delivery_profile);
    assert.deepEqual(renamed.journal.delivery_report, secondSaved.journal.delivery_report);

    const mealProfiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: renamed.revision,
      idempotency_key: "delivery-preserve-meal-profile",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    assert.deepEqual(mealProfiled.journal.evidence, secondSaved.journal.evidence);
    assert.deepEqual(mealProfiled.journal.items, secondSaved.journal.items);
    assert.deepEqual(mealProfiled.journal.delivery_profile, secondSaved.journal.delivery_profile);
    assert.deepEqual(mealProfiled.journal.delivery_report, secondSaved.journal.delivery_report);

    const firstStage = await stageLocalDeliveryPromotion(root, {
      expected_revision: mealProfiled.revision,
      provider_origin: "https://delivery.example/",
      payload_fingerprint: `sha256:${"1".repeat(64)}`,
      cloud_user_id: userId,
      cloud_household_id: householdId,
      expected_repository_head: repositoryHead,
    }, now);
    assert.equal(firstStage.status, "delivery_promotion_staged");
    assert.match(firstStage.promotion.idempotency_key, /^delivery-promotion-[0-9a-f]{32}$/);
    assert.match(firstStage.promotion.cloud_target_fingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.equal(firstStage.promotion.cloud_user_id, null);
    assert.equal(firstStage.promotion.cloud_household_id, null);
    const pendingFileText = await readFile(localHouseholdPath(root), "utf8");
    assert.ok(!pendingFileText.includes(userId));
    assert.ok(!pendingFileText.includes(householdId));
    const pendingDocument = JSON.parse(pendingFileText);
    assert.equal(pendingDocument.delivery_promotions[0].cloud_user_id, null);
    assert.equal(pendingDocument.delivery_promotions[0].cloud_household_id, null);

    const invalidPendingDocument = structuredClone(pendingDocument);
    invalidPendingDocument.delivery_promotions[0].cloud_user_id = userId;
    await writeFile(localHouseholdPath(root), `${JSON.stringify(invalidPendingDocument, null, 2)}\n`);
    await assert.rejects(loadLocalHousehold(root), (error) =>
      error instanceof LocalHouseholdError && error.code === "CORRUPT_LOCAL_HOUSEHOLD");
    await writeFile(localHouseholdPath(root), `${JSON.stringify(pendingDocument, null, 2)}\n`);

    const replayedStage = await stageLocalDeliveryPromotion(root, {
      expected_revision: mealProfiled.revision,
      provider_origin: "https://delivery.example/",
      payload_fingerprint: `sha256:${"1".repeat(64)}`,
      cloud_user_id: userId,
      cloud_household_id: householdId,
      expected_repository_head: repositoryHead,
    }, now);
    assert.equal(replayedStage.status, "delivery_promotion_replayed");
    assert.equal(replayedStage.promotion.idempotency_key, firstStage.promotion.idempotency_key);
    assert.equal(replayedStage.revision, firstStage.revision);
    await assert.rejects(stageLocalDeliveryPromotion(root, {
      expected_revision: mealProfiled.revision,
      provider_origin: "https://delivery.example/",
      payload_fingerprint: `sha256:${"1".repeat(64)}`,
      cloud_user_id: userId,
      cloud_household_id: householdId,
      expected_repository_head: "d".repeat(40),
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_HOUSEHOLD_CONFLICT");

    const secondStage = await stageLocalDeliveryPromotion(root, {
      expected_revision: replayedStage.revision,
      provider_origin: "https://other-delivery.example/",
      payload_fingerprint: `sha256:${"2".repeat(64)}`,
      cloud_user_id: userId,
      cloud_household_id: householdId,
      expected_repository_head: repositoryHead,
    }, now);
    await assert.rejects(recordLocalDeliveryPromotion(root, {
      expected_revision: secondStage.revision,
      provider_origin: "https://delivery.example/",
      promotion_idempotency_key: firstStage.promotion.idempotency_key,
      user_id: "usr_0000000000000999",
      household_id: householdId,
      repository_head: "b".repeat(40),
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    const recorded = await recordLocalDeliveryPromotion(root, {
      expected_revision: secondStage.revision,
      provider_origin: "https://delivery.example/",
      promotion_idempotency_key: firstStage.promotion.idempotency_key,
      user_id: userId,
      household_id: householdId,
      repository_head: "b".repeat(40),
    }, now);
    assert.equal(recorded.promotion.status, "committed");
    assert.equal(recorded.promotion.cloud_user_id, userId);
    assert.equal(recorded.promotion.cloud_household_id, householdId);
    const pendingOtherProvider = recorded.delivery_promotions.find(({ provider_origin }) =>
      provider_origin === "https://other-delivery.example/");
    assert.equal(pendingOtherProvider.status, "pending");
    assert.equal(pendingOtherProvider.idempotency_key, secondStage.promotion.idempotency_key);
    assert.equal(pendingOtherProvider.cloud_user_id, null);
    assert.equal(pendingOtherProvider.cloud_household_id, null);

    const recordedDocument = JSON.parse(await readFile(localHouseholdPath(root), "utf8"));
    const firstCommitted = recordedDocument.delivery_promotions.find(({ status }) => status === "committed");
    const stillPending = recordedDocument.delivery_promotions.find(({ status }) => status === "pending");
    assert.equal(firstCommitted.cloud_user_id, userId);
    assert.equal(firstCommitted.cloud_household_id, householdId);
    assert.equal(stillPending.cloud_user_id, null);
    assert.equal(stillPending.cloud_household_id, null);
    assert.deepEqual((await loadLocalHousehold(root)).delivery_promotions, recorded.delivery_promotions);

    const laterRevision = await renameLocalHousehold(root, {
      expected_revision: recorded.revision,
      household_name: "Delivery Replay Household",
    }, now);
    const replayedRecord = await recordLocalDeliveryPromotion(root, {
      expected_revision: secondStage.revision,
      provider_origin: "https://delivery.example/",
      promotion_idempotency_key: firstStage.promotion.idempotency_key,
      user_id: userId,
      household_id: householdId,
      repository_head: "b".repeat(40),
    }, now);
    assert.equal(replayedRecord.status, "delivery_promotion_replayed");
    assert.equal(replayedRecord.revision, laterRevision.revision);
    await assert.rejects(recordLocalDeliveryPromotion(root, {
      expected_revision: secondStage.revision,
      provider_origin: "https://delivery.example/",
      promotion_idempotency_key: firstStage.promotion.idempotency_key,
      user_id: userId,
      household_id: householdId,
      repository_head: "e".repeat(40),
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "IDEMPOTENCY_CONFLICT");
    await assert.rejects(recordLocalDeliveryPromotion(root, {
      expected_revision: secondStage.revision,
      provider_origin: "https://delivery.example/",
      promotion_idempotency_key: "delivery-promotion-00000000000000000000000000000000",
      user_id: userId,
      household_id: householdId,
      repository_head: "b".repeat(40),
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");

    const secondRecorded = await recordLocalDeliveryPromotion(root, {
      expected_revision: replayedRecord.revision,
      provider_origin: "https://other-delivery.example/",
      promotion_idempotency_key: secondStage.promotion.idempotency_key,
      user_id: userId,
      household_id: householdId,
      repository_head: "c".repeat(40),
    }, now);
    assert.equal(secondRecorded.delivery_promotions.filter(({ status }) => status === "committed").length, 2);

    const fullyCommittedDocument = JSON.parse(await readFile(localHouseholdPath(root), "utf8"));
    fullyCommittedDocument.delivery_promotions[0].cloud_target_fingerprint = `sha256:${"f".repeat(64)}`;
    await writeFile(localHouseholdPath(root), `${JSON.stringify(fullyCommittedDocument, null, 2)}\n`);
    await assert.rejects(loadLocalHousehold(root), (error) =>
      error instanceof LocalHouseholdError && error.code === "CORRUPT_LOCAL_HOUSEHOLD");
  });
});

test("local meal proposals bind current delivery evidence and become stale after the dish changes", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const delivery = deliveryJournalFixture({
      seed: "41",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: delivery,
    }, now);
    const deliveryRevision = saved.delivery_content_revisions[0];
    assert.equal(deliveryRevision.familiarity, "ordered_before");
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: saved.revision,
      idempotency_key: "delivery-meal-profile-0001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "delivery-meal-review-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const input = {
      expected_revision: reviewed.revision,
      idempotency_key: "delivery-meal-source-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: {
        kind: "journal_delivery_dish",
        item_id: deliveryRevision.item_id,
        item_revision: deliveryRevision.item_revision,
        evidence_ids: deliveryRevision.evidence_ids,
      },
      servings: 2,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not known.",
    };
    await assert.rejects(appendLocalMealProposal(root, {
      ...input,
      idempotency_key: "delivery-meal-unsafe-0001",
      compatibility: "appears_compatible",
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED");
    const proposed = await appendLocalMealProposal(root, input, now);
    assert.equal(proposed.proposal.source.kind, "journal_delivery_dish");
    assert.equal(proposed.meal_proposal_statuses[0].effective_compatibility, "incomplete_evidence");

    const journalWithoutPlanning = Object.fromEntries(
      Object.entries(proposed.journal).filter(([key]) => key !== "meal_planning"),
    );
    const changed = await saveLocalHousehold(root, {
      expected_revision: proposed.revision,
      journal: {
        ...journalWithoutPlanning,
        items: delivery.items.map((item) => ({ ...item, body_markdown: "Serve cold." })),
      },
    }, now);
    assert.equal(changed.meal_proposal_statuses[0].effective_compatibility, "needs_recheck");
  });
});

test("recognized legacy delivery IDs repair atomically and preserve exact meal-proposal replay", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const delivery = deliveryJournalFixture({
      seed: "0451",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: delivery,
    }, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: saved.revision,
      idempotency_key: "legacy-delivery-profile-0001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "legacy-delivery-review-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const deliveryRevision = reviewed.delivery_content_revisions[0];
    const proposalInput = {
      expected_revision: reviewed.revision,
      idempotency_key: "legacy-delivery-proposal-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: {
        kind: "journal_delivery_dish",
        item_id: deliveryRevision.item_id,
        item_revision: deliveryRevision.item_revision,
        evidence_ids: deliveryRevision.evidence_ids,
      },
      servings: 2,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not known.",
    };
    const proposed = await appendLocalMealProposal(root, proposalInput, now);
    const filePath = localHouseholdPath(root);
    const legacyId = "itm_dd206fries";
    const legacyDocument = JSON.parse(await readFile(filePath, "utf8"));
    legacyDocument.journal.items = legacyDocument.journal.items.map((item) =>
      item.id === deliveryRevision.item_id ? { ...item, id: legacyId } : item);
    legacyDocument.journal.delivery_report.assertions =
      legacyDocument.journal.delivery_report.assertions.map((assertion) => ({
        ...assertion,
        item_ids: assertion.item_ids.map((id) => id === deliveryRevision.item_id ? legacyId : id),
      }));
    legacyDocument.journal.meal_planning.proposals =
      legacyDocument.journal.meal_planning.proposals.map((proposal) => ({
        ...proposal,
        source: proposal.source.kind === "journal_delivery_dish"
          ? { ...proposal.source, item_id: legacyId }
          : proposal.source,
      }));
    await writeFile(filePath, `${JSON.stringify(legacyDocument, null, 2)}\n`);

    await assert.rejects(
      loadLocalHousehold(root),
      (error) =>
        error instanceof LocalHouseholdError
        && error.code === "LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED",
    );
    const repaired = await repairLocalHouseholdCompatibility(
      root,
      new Date("2026-07-22T23:01:00.000Z"),
    );
    assert.equal(repaired.status, "repaired");
    assert.equal(repaired.repaired_delivery_dish_count, 1);
    assert.equal(repaired.split_delivery_dish_count, 0);
    assert.equal(repaired.repaired_delivery_report_count, 0);
    assert.equal(repaired.repaired_delivery_report_row_count, 0);
    assert.equal(repaired.removed_legacy_browser_label_count, 0);
    assert.equal(repaired.revision, proposed.revision + 1);
    assert.equal(repaired.journal.items.length, proposed.journal.items.length);
    assert.equal(repaired.journal.evidence.length, proposed.journal.evidence.length);
    const repairedRevision = repaired.delivery_content_revisions[0];
    assert.match(repairedRevision.item_id, /^itm_[0-9a-z]{16,64}$/);
    assert.notEqual(repairedRevision.item_id, legacyId);
    assert.ok(repaired.journal.delivery_report.assertions.some(({ item_ids: itemIds }) =>
      itemIds.includes(repairedRevision.item_id)));
    assert.ok(repaired.journal.delivery_report.assertions.every(({ item_ids: itemIds }) =>
      !itemIds.includes(legacyId)));
    assert.equal(
      repaired.journal.meal_planning.proposals[0].source.item_id,
      repairedRevision.item_id,
    );
    assert.equal(
      repaired.journal.meal_planning.proposals[0].source.item_revision,
      repairedRevision.item_revision,
    );

    const replayed = await appendLocalMealProposal(root, {
      ...proposalInput,
      expected_revision: repaired.revision,
      source: {
        ...proposalInput.source,
        item_id: repairedRevision.item_id,
        item_revision: repairedRevision.item_revision,
      },
    }, new Date("2026-07-22T23:02:00.000Z"));
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.revision, repaired.revision);

    const repeated = await repairLocalHouseholdCompatibility(
      root,
      new Date("2026-07-22T23:03:00.000Z"),
    );
    assert.equal(repeated.status, "already_compatible");
    assert.equal(repeated.repaired_delivery_dish_count, 0);
    assert.equal(repeated.split_delivery_dish_count, 0);
    assert.equal(repeated.repaired_delivery_report_count, 0);
    assert.equal(repeated.repaired_delivery_report_row_count, 0);
    assert.equal(repeated.removed_legacy_browser_label_count, 0);
    assert.equal(repeated.revision, repaired.revision);
  });
});

test("compatibility repair splits evidence-backed restaurant names and removes obsolete browser labels", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const delivery = deliveryJournalFixture({
      seed: "0453",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: delivery,
    }, now);
    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: saved.revision,
      idempotency_key: "split-delivery-profile-0001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "split-delivery-review-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const originalRevision = reviewed.delivery_content_revisions[0];
    const proposalInput = {
      expected_revision: reviewed.revision,
      idempotency_key: "split-delivery-proposal-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: {
        kind: "journal_delivery_dish",
        item_id: originalRevision.item_id,
        item_revision: originalRevision.item_revision,
        evidence_ids: originalRevision.evidence_ids,
      },
      servings: 2,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not known.",
    };
    const proposed = await appendLocalMealProposal(root, proposalInput, now);
    const filePath = localHouseholdPath(root);
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const item = document.journal.items[0];
    const firstEvidence = document.journal.evidence[0];
    const secondEvidence = structuredClone(firstEvidence);
    secondEvidence.id = "evd_0000000000000454";
    secondEvidence.evidence_date = "2026-07-21";
    secondEvidence.stable_locator = "order-0454/line-1";
    secondEvidence.delivery_order_line.provider_order_locator = "order-0454";
    secondEvidence.delivery_order_line.order_group_locator = "order-0454-delivery";
    secondEvidence.delivery_order_line.order_date = "2026-07-21";
    secondEvidence.delivery_order_line.line_key = "line-0454";
    secondEvidence.delivery_order_line.restaurant.restaurant_name = "Wanpo Express";
    secondEvidence.delivery_order_line.historical_menu_item_locator = "menu-0454";
    document.journal.evidence.push(secondEvidence);
    item.evidence_ids.push(secondEvidence.id);
    item.known_menu_item_locators.push("menu-0454");
    item.known_modifier_occurrences.push({
      ...structuredClone(item.known_modifier_occurrences[0]),
      evidence_id: secondEvidence.id,
    });
    const legacyId = "itm_wanpo";
    item.id = legacyId;
    document.journal.delivery_report.report_type = "delivery_history";
    document.journal.delivery_report.assertions[0] = {
      ...document.journal.delivery_report.assertions[0],
      item_ids: [legacyId],
      evidence_ids: [firstEvidence.id, secondEvidence.id],
      distinct_order_count: 99,
      last_date: "2026-07-20",
    };
    document.journal.meal_planning.proposals[0].source.item_id = legacyId;
    document.journal.profiles = {
      snacks: { authorized_browser: "Chrome", retained_setting: true },
      recipes: { authorized_browser: "Chrome", retained_setting: true },
    };
    await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`);

    await assert.rejects(
      loadLocalHousehold(root),
      (error) =>
        error instanceof LocalHouseholdError
        && error.code === "LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED",
    );
    const repaired = await repairLocalHouseholdCompatibility(
      root,
      new Date("2026-07-22T23:01:00.000Z"),
    );
    assert.equal(repaired.status, "repaired");
    assert.equal(repaired.repaired_delivery_dish_count, 1);
    assert.equal(repaired.split_delivery_dish_count, 1);
    assert.equal(repaired.repaired_delivery_report_count, 1);
    assert.equal(repaired.removed_legacy_browser_label_count, 2);
    assert.equal(repaired.revision, proposed.revision + 1);
    assert.equal(repaired.journal.evidence.length, 2);
    assert.equal(repaired.journal.items.length, 2);
    assert.equal(repaired.journal.delivery_report.report_type, "delivery_index");
    assert.equal(repaired.journal.delivery_report.assertions.length, 2);
    assert.deepEqual(
      repaired.journal.delivery_report.assertions
        .map(({ distinct_order_count: orderCount }) => orderCount)
        .sort(),
      [1, 1],
    );
    assert.deepEqual(
      repaired.journal.delivery_report.assertions
        .map(({ last_date: lastDate }) => lastDate)
        .sort(),
      ["2026-07-20", "2026-07-21"],
    );
    assert.equal(Object.hasOwn(repaired.journal.profiles.snacks, "authorized_browser"), false);
    assert.equal(Object.hasOwn(repaired.journal.profiles.recipes, "authorized_browser"), false);
    assert.equal(repaired.journal.profiles.snacks.retained_setting, true);
    assert.equal(repaired.journal.profiles.recipes.retained_setting, true);
    const primaryItem = repaired.journal.items.find(
      ({ restaurant_name: restaurantName }) => restaurantName === "Wanpo Tea",
    );
    assert.deepEqual(
      repaired.journal.meal_planning.proposals[0].source,
      {
        ...proposalInput.source,
        item_id: primaryItem.id,
        item_revision: repaired.delivery_content_revisions.find(
          ({ item_id: itemId }) => itemId === primaryItem.id,
        ).item_revision,
      },
    );
    const replayed = await appendLocalMealProposal(root, {
      ...proposalInput,
      expected_revision: repaired.revision,
      source: repaired.journal.meal_planning.proposals[0].source,
    }, new Date("2026-07-22T23:02:00.000Z"));
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.revision, repaired.revision);
  });
});

test("compatibility repair leaves unknown local corruption untouched", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const delivery = deliveryJournalFixture({
      seed: "0452",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    await saveLocalHousehold(root, { expected_revision: 1, journal: delivery }, now);
    const filePath = localHouseholdPath(root);
    const document = JSON.parse(await readFile(filePath, "utf8"));
    const originalId = document.journal.items[0].id;
    document.journal.items[0].id = "itm_UNSUPPORTED";
    document.journal.delivery_report.assertions[0].item_ids =
      document.journal.delivery_report.assertions[0].item_ids.map((id) =>
        id === originalId ? "itm_UNSUPPORTED" : id);
    const incompatibleText = `${JSON.stringify(document, null, 2)}\n`;
    await writeFile(filePath, incompatibleText);

    await assert.rejects(
      loadLocalHousehold(root),
      (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
    );
    await assert.rejects(
      repairLocalHouseholdCompatibility(root, new Date("2026-07-22T23:01:00.000Z")),
      (error) =>
        error instanceof LocalHouseholdError
        && error.code === "LOCAL_HOUSEHOLD_COMPATIBILITY_BLOCKED",
    );
    assert.equal(await readFile(filePath, "utf8"), incompatibleText);
  });
});

test("public-import delivery dishes support exact local proposal replay, withdrawal, and rechecks", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const imported = importedDeliveryJournalFixture({ seed: "42", locationLabel: "Cupertino" });
    const saved = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: imported,
    }, now);
    const loaded = await loadLocalHousehold(root);
    const deliveryRevision = loaded.delivery_content_revisions[0];
    assert.equal(deliveryRevision.familiarity, "shared_dish");
    assert.deepEqual(deliveryRevision.evidence_ids, [imported.evidence[0].id]);
    assert.equal(loaded.journal.delivery_profile, undefined);
    assert.equal(loaded.journal.delivery_report, undefined);
    const preserved = await saveLocalHousehold(root, {
      expected_revision: saved.revision,
      journal: { custom_extension: { retained: true } },
    }, now);
    assert.deepEqual(preserved.journal.evidence, imported.evidence);
    assert.deepEqual(preserved.journal.items, imported.items);
    assert.deepEqual(preserved.journal.items[0].import_provenance, imported.items[0].import_provenance);
    assert.equal(Object.hasOwn(preserved.journal, "delivery_profile"), false);
    assert.equal(Object.hasOwn(preserved.journal, "delivery_report"), false);
    const persisted = JSON.parse(await readFile(localHouseholdPath(root), "utf8"));
    assert.equal(Object.hasOwn(persisted.journal, "delivery_profile"), false);
    assert.equal(Object.hasOwn(persisted.journal, "delivery_report"), false);

    const profiled = await saveLocalMealPlanningProfile(root, {
      expected_revision: preserved.revision,
      idempotency_key: "imported-delivery-profile-0001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: now.toISOString(),
      },
    }, now);
    const reviewed = await reviewLocalMealConstraints(root, {
      expected_revision: profiled.revision,
      idempotency_key: "imported-delivery-review-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }, now);
    const input = {
      expected_revision: reviewed.revision,
      idempotency_key: "imported-delivery-proposal-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: {
        kind: "journal_delivery_dish",
        item_id: deliveryRevision.item_id,
        item_revision: deliveryRevision.item_revision,
        evidence_ids: deliveryRevision.evidence_ids,
      },
      servings: 2,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not known.",
    };
    await assert.rejects(appendLocalMealProposal(root, {
      ...input,
      idempotency_key: "imported-delivery-stale-0001",
      source: { ...input.source, item_revision: `sha256:${"0".repeat(64)}` },
    }, now), (error) => error instanceof LocalHouseholdError && error.code === "LOCAL_RECIPE_REVISION_CONFLICT");
    const proposed = await appendLocalMealProposal(root, input, now);
    const replayed = await appendLocalMealProposal(root, input, new Date("2026-07-23T00:00:00.000Z"));
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.proposal.id, proposed.proposal.id);
    assert.equal(replayed.revision, proposed.revision);

    const changedConstraints = await saveLocalMealPlanningProfile(root, {
      expected_revision: proposed.revision,
      idempotency_key: "imported-delivery-profile-0002",
      actor_label: "Maya",
      constraints: {
        status: "recorded",
        time_zone: "America/Los_Angeles",
        allergy_labels: ["Peanut"],
        sensitivity_labels: [],
        reviewed_at: now.toISOString(),
      },
    }, now);
    assert.equal(changedConstraints.meal_proposal_statuses[0].effective_compatibility, "needs_recheck");
    const reviewedAgain = await reviewLocalMealConstraints(root, {
      expected_revision: changedConstraints.revision,
      idempotency_key: "imported-delivery-review-0002",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 2,
    }, now);
    const secondProposal = await appendLocalMealProposal(root, {
      ...input,
      expected_revision: reviewedAgain.revision,
      idempotency_key: "imported-delivery-proposal-0002",
      constraint_revision: 2,
      constraint_review_event_id: reviewedAgain.event.id,
    }, now);
    assert.equal(secondProposal.meal_proposal_statuses.at(-1).effective_compatibility, "incomplete_evidence");
    const withdrawn = await recordLocalMealPlanEvent(root, {
      expected_revision: secondProposal.revision,
      idempotency_key: "imported-delivery-withdraw-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      event: {
        kind: "proposal_withdrawn",
        proposal_id: secondProposal.proposal.id,
        reason: "Changed plans",
      },
    }, now);
    assert.equal(withdrawn.meal_proposal_statuses.at(-1).active, false);

    const journalWithoutPlanning = Object.fromEntries(
      Object.entries(withdrawn.journal).filter(([key]) => key !== "meal_planning"),
    );
    const changedItem = await saveLocalHousehold(root, {
      expected_revision: withdrawn.revision,
      journal: {
        ...journalWithoutPlanning,
        items: imported.items.map((item) => ({ ...item, body_markdown: "Serve cold." })),
      },
    }, now);
    assert.notEqual(changedItem.delivery_content_revisions[0].item_revision, deliveryRevision.item_revision);
    assert.equal(changedItem.meal_proposal_statuses.at(-1).effective_compatibility, "needs_recheck");
  });
});

test("public-import delivery dishes reject private, malformed, and mixed authority data", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const imported = importedDeliveryJournalFixture({ seed: "43", locationLabel: "Stanford" });
    const privateField = structuredClone(imported);
    privateField.items[0].provider_label = "DoorDash";
    const duplicateCitation = structuredClone(imported);
    duplicateCitation.items[0].evidence_ids.push(duplicateCitation.items[0].evidence_ids[0]);
    const duplicateEvidence = structuredClone(imported);
    duplicateEvidence.evidence.push(structuredClone(duplicateEvidence.evidence[0]));
    const mismatchedProvenance = structuredClone(imported);
    mismatchedProvenance.evidence[0].stable_locator = "snp_0000000000000999/collection-item-0043";
    const historyEvidence = deliveryJournalFixture({
      seed: "44",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const mixedAuthority = {
      ...imported,
      evidence: historyEvidence.evidence,
      items: [
        ...historyEvidence.items,
        {
          ...imported.items[0],
          evidence_ids: [historyEvidence.evidence[0].id],
        },
      ],
      delivery_profile: historyEvidence.delivery_profile,
      delivery_report: historyEvidence.delivery_report,
    };
    const privateHistoryDocuments = {
      ...imported,
      delivery_profile: historyEvidence.delivery_profile,
      delivery_report: {
        ...historyEvidence.delivery_report,
        assertions: [{
          ...historyEvidence.delivery_report.assertions[0],
          item_ids: [imported.items[0].id],
          evidence_ids: [imported.evidence[0].id],
        }],
      },
    };
    for (const journal of [
      privateField,
      duplicateCitation,
      duplicateEvidence,
      mismatchedProvenance,
      mixedAuthority,
      privateHistoryDocuments,
    ]) {
      await assert.rejects(
        saveLocalHousehold(root, { expected_revision: 1, journal }, now),
        (error) => error instanceof LocalHouseholdError && error.code === "VALIDATION_FAILED",
      );
    }
    assert.equal((await loadLocalHousehold(root)).revision, 1);
    const savedMixedJournal = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: {
        stage: "delivery",
        evidence: [...historyEvidence.evidence, ...imported.evidence],
        items: [...historyEvidence.items, ...imported.items],
        delivery_profile: historyEvidence.delivery_profile,
        delivery_report: historyEvidence.delivery_report,
      },
    }, now);
    assert.deepEqual(
      savedMixedJournal.delivery_content_revisions.map(({ familiarity }) => familiarity).sort(),
      ["ordered_before", "shared_dish"],
    );
  });
});

test("guest storage rejects browser and authentication material", async () => {
  await withLocalRoot(async (root) => {
    await initializeLocalHousehold(root, now);
    const forbiddenKeys = [
      "browser_state",
      "access_token",
      "accessToken",
      "token",
      "raw_pages",
      "deliveryAddress",
      "addressLines",
      "nested.addressLines",
      "public_merchant_address",
      "DELIVERY_DESTINATION",
      "deliveryDropoffAddress",
      "deliveryInstructionsText",
      "deliveryAddressesBackup",
      "deliveryLocationsBackup",
      "deliveryDropOffsBackup",
      "PaymentStatus",
      "payment_details",
      "paymentMethod",
      "paymentCardLastFour",
      "payment_method_display_name",
      "paymentsStatus",
      "cardsLastFour",
      "billingPostalCode",
      "deliveryDestinationPostalCode",
      "delivery_dropoff_instructions_text",
      "providerAccountIdentifier",
      "providerAccountEmail",
      "providerAccountsEmail",
      "providersAccountsEmail",
      "provider_customer_external_identifier",
      "providerCustomersExternalId",
      "providerUserEmail",
      "providerUsersEmail",
      "PROVIDER_USER_ID",
      "accountId",
      "tokensCache",
      "credentialsBackup",
      "sessionsCache",
      "cookiesBackup",
      "screenshotsArchive",
      "authorizationsBackup",
      "passwordsHash",
      "secretsCache",
      "sourceBrowserSessionState",
      "oauthAccessTokenExpiresAt",
      "providerRawPageResponseBody",
      "rawPagesBackup",
      "credentialsbackup",
      "raw_pagebody",
      "rawpagebody",
      "one_time_codebackup",
      "onetimecodebackup",
      "provider_accountemail",
      "provideraccountemail",
      "provider_userid",
      "provideruserid",
      "providerUserID",
      "delivery_destinationpostalcode",
      "deliverydestinationpostalcode",
      "paymentsstatus",
      "cardslastfour",
      "provider_accountsemail",
      "provider_usersemail",
      "tokenscache",
      "delivery_addressesbackup",
      "receiptScreenshotPath",
      "storedCredentialHint",
      "oneTimeCodeBackup",
      "oneTimeCodesBackup",
      "Provider.Accounts-Email",
      "delivery.instructions/text",
      "PAYMENTS.STATUS",
      "rawpagepayload",
      "rawPagePayload",
      "raw_page_payload",
      "onetimecodeissued",
      "oneTimeCodeIssued",
      "one_time_code_issued",
      "provideraccountnumber",
      "providerAccountNumber",
      "provider_account_number",
      "provideruserhandle",
      "providerUserHandle",
      "provider_user_handle",
      "deliverydestinationunit",
      "deliveryDestinationUnit",
      "delivery_destination_unit",
      "paymentprocessor",
      "paymentProcessor",
      "payment_processor",
      "tokenenvelope",
      "tokenEnvelope",
      "token_envelope",
      "cookiejar",
      "cookieJar",
      "cookie_jar",
      "cloud_user_id",
      "cloudUserId",
      "clouduserid",
      "cloud_user_identifier",
      "cloudUserIdentifier",
      "clouduseridentifier",
      "cloud_household_id",
      "cloudHouseholdId",
      "cloudhouseholdid",
      "cloud_household_identifier",
      "cloudHouseholdIdentifier",
      "cloudhouseholdidentifier",
      "accountingtoken",
      "accountingToken",
      "accounting_token",
      "cardinalitypassword",
      "cardinalityPassword",
      "cardinality_password",
      "browserifycookie",
      "browserifyCookie",
      "browserify_cookie",
      "sessionalsecret",
      "sessionalSecret",
      "sessional_secret",
      "passwordlesstoken",
      "passwordlessToken",
      "passwordless_token",
      "secretariatauthorization",
      "secretariatAuthorization",
      "secretariat_authorization",
      "tokenizecredential",
      "tokenizeCredential",
      "tokenize_credential",
      "tokenizedcredential",
      "tokenizedCredential",
      "tokenized_credential",
      "cardinalprovideraccount",
      "cardinalProviderAccount",
      "cardinal_provider_account",
      "recipetoken",
      "recipeToken",
      "recipe_token",
      "historysession",
      "historySession",
      "history_session",
      "memberaddress",
      "memberAddress",
      "member_address",
      "providerrawpagepayload",
      "providerRawPagePayload",
      "provider_raw_page_payload",
      "deliveryclouduserid",
      "deliveryCloudUserId",
      "delivery_cloud_user_id",
      "credit_dis_card_number",
      "creditDisCardNumber",
      "browser_ify_state",
      "browserIfyState",
      "member_account_ing_id",
      "memberAccountIngId",
      "delivery_address_able_line",
      "deliveryAddressAbleLine",
      "creditcard",
      "creditCard",
      "credit_card",
      "giftcard",
      "giftCard",
      "gift_card",
      "paymentcard",
      "paymentCard",
      "payment_card",
      "access_to_ken",
      "accessToKen",
      "accesstoken",
      "pass_word",
      "passWord",
      "password",
      "member_ac_count_id",
      "memberAcCountId",
      "memberaccountid",
      "shipping_ad_dress",
      "shippingAdDress",
      "shippingaddress",
      "author_ization_code",
      "authorIzationCode",
      "authorizationcode",
      "screen_shot_path",
      "screenShotPath",
      "screenshotpath",
      "se_cret_value",
      "seCretValue",
      "secretvalue",
      "ac_accounting_count",
      "acAccountingCount",
      "acaccountingcount",
      "pass_passwordless_word",
      "passPasswordlessWord",
      "passpasswordlessword",
      "tok_tokenize_en",
      "tokTokenizeEn",
      "toktokenizeen",
      "ad_addressable_dress",
      "adAddressableDress",
      "adaddressabledress",
      "pａssword",
      "tоken",
      "ｐａｓｓｗｏｒｄ",
      "ｔｏｋｅｎ",
      "𝚙𝚊𝚜𝚜𝚠𝚘𝚛𝚍",
      "𝕥𝕠𝕜𝕖𝕟",
      "café_notes",
      "recіpeNote",
    ];
    for (const key of forbiddenKeys) {
      for (const journal of [
        { [key]: "private" },
        { nested: { deeper: { [key]: "private" } } },
      ]) {
        await assert.rejects(
          saveLocalHousehold(root, { expected_revision: 1, journal }, now),
          (error) => error instanceof LocalHouseholdError && error.code === "PROHIBITED_LOCAL_DATA",
          key,
        );
      }
    }
    assert.equal((await loadLocalHousehold(root)).revision, 1);
    const benignKeys = [
      "cardinality",
      "accounting",
      "tokenize",
      "browserify",
      "sessional",
      "passwordless",
      "secretariat",
      "cardinalId",
      "accountingCode",
      "tokenizedValue",
      "cardamom",
      "cardamomSpice",
      "cardboard",
      "accountability",
      "accountabilityScore",
      "addressable",
      "accountingcardinality",
      "accountingCardinality",
      "accounting_cardinality",
      "cardamomaccountability",
      "cardamomAccountability",
      "cardamom_accountability",
      "browserifysessional",
      "browserifySessional",
      "browserify_sessional",
      "passwordlesssecretariat",
      "passwordlessSecretariat",
      "passwordless_secretariat",
      "tokenizetokenized",
      "tokenizeTokenized",
      "tokenize_tokenized",
      "cardboardcardamom",
      "cardboardCardamom",
      "cardboard_cardamom",
      "provideraccounting",
      "providerAccounting",
      "provider_accounting",
      "deliveryaddressable",
      "deliveryAddressable",
      "delivery_addressable",
      "discard",
      "discarded",
      "discardStatus",
      "discard_status",
      "discardedItems",
      "discarded_items",
      "postcard",
      "scorecard",
      "recipe_card",
      "recipeCard",
      "recipecard",
      "menu_card",
      "menuCard",
      "menucard",
    ];
    const benignJournal = Object.fromEntries(benignKeys.map((key) => [key, "not sensitive"]));
    const collisionSafe = await saveLocalHousehold(root, {
      expected_revision: 1,
      journal: {
        ...benignJournal,
        custom: benignJournal,
        unicode_values: {
          food_name: "麻婆豆腐",
          notes: "Crème brûlée — 家族のお気に入り",
        },
        "ｒｅｃｉｐｅ＿ｃａｒｄ": "compatibility-normalized safe key",
      },
    }, now);
    assert.equal(collisionSafe.revision, 2);
    assert.deepEqual(collisionSafe.journal.unicode_values, {
      food_name: "麻婆豆腐",
      notes: "Crème brûlée — 家族のお気に入り",
    });
    assert.equal(collisionSafe.journal["ｒｅｃｉｐｅ＿ｃａｒｄ"], "compatibility-normalized safe key");
    const safe = await saveLocalHousehold(root, {
      expected_revision: collisionSafe.revision,
      journal: {
        source: {
          provider_origin: "https://delivery.example/",
          provider_label: "DoorDash",
          merchant_locator: "merchant-0201",
          provider_order_locator: "order-0201",
        },
      },
    }, now);
    assert.equal(safe.revision, 3);
    const canonicalJournal = deliveryJournalFixture({
      seed: "0299",
      providerOrigin: "https://delivery.example/",
      providerLabel: "DoorDash",
      locationLabel: "Palo Alto",
    });
    const publicAddress = {
      address_lines: ["123 Main Street"],
      locality: "Palo Alto",
      region: "CA",
      postal_code: "94301",
      country: "United States",
    };
    canonicalJournal.evidence[0].delivery_order_line.restaurant.public_merchant_address = publicAddress;
    canonicalJournal.items[0].public_merchant_address = structuredClone(publicAddress);
    const canonical = await saveLocalHousehold(root, {
      expected_revision: safe.revision,
      journal: canonicalJournal,
    }, now);
    const line = canonical.journal.evidence[0].delivery_order_line;
    assert.equal(line.provider_origin, "https://delivery.example/");
    assert.equal(line.provider_order_locator, "order-0299");
    assert.equal(line.order_group_locator, "order-0299-delivery");
    assert.equal(line.historical_menu_item_locator, "menu-0299");
    assert.equal(line.restaurant.merchant_locator, "merchant-0299");
    assert.deepEqual(line.restaurant.public_merchant_address.address_lines, ["123 Main Street"]);
    assert.equal(line.restaurant.public_merchant_address.locality, "Palo Alto");
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

function deliveryJournalFixture({ seed, providerOrigin, providerLabel, locationLabel }) {
  const evidenceId = `evd_${seed.padStart(16, "0")}`;
  const itemId = `itm_${seed.padStart(16, "0")}`;
  const orderDate = "2026-07-20";
  const restaurant = {
    restaurant_name: "Wanpo Tea",
    public_location_label: locationLabel,
    public_merchant_address: {
      locality: locationLabel,
      region: "CA",
      country: "United States",
    },
    merchant_locator: `merchant-${seed}`,
  };
  const modifiers = [{ group_name: "Sweetness", option_name: "50%" }];
  const evidence = {
    id: evidenceId,
    kind: "delivery_order_line",
    observed_at: now.toISOString(),
    evidence_date: orderDate,
    date_precision: "day",
    source_type: "delivery_provider",
    source_label: providerLabel,
    stable_locator: `order-${seed}/line-1`,
    summary: "Wintermelon boba",
    actor_id: "act_0000000000000201",
    limitations: [],
    schema_version: 1,
    delivery_order_line: {
      provider_label: providerLabel,
      provider_origin: providerOrigin,
      provider_order_locator: `order-${seed}`,
      order_group_locator: `order-${seed}-delivery`,
      order_date: orderDate,
      completion_status: "completed",
      fulfillment_mode: "delivery",
      group_complete: true,
      declared_line_count: 1,
      line_key: `line-${seed}`,
      restaurant,
      dish_name: "Wintermelon Boba",
      quantity: 1,
      modifiers_complete: true,
      modifiers,
      historical_menu_item_locator: `menu-${seed}`,
      classification: { kind: "food", authored_by: "agent" },
    },
  };
  const item = {
    id: itemId,
    kind: "delivery_dish",
    evidence_ids: [evidenceId],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    schema_version: 1,
    body_markdown: "",
    dish_name: "Wintermelon Boba",
    provider_label: providerLabel,
    provider_origin: providerOrigin,
    restaurant_name: restaurant.restaurant_name,
    public_location_label: restaurant.public_location_label,
    public_merchant_address: restaurant.public_merchant_address,
    merchant_locator: restaurant.merchant_locator,
    known_menu_item_locators: [`menu-${seed}`],
    known_modifier_occurrences: [{
      evidence_id: evidenceId,
      modifiers_complete: true,
      modifiers,
    }],
    classification: { kind: "food", authored_by: "agent" },
  };
  return {
    stage: "delivery",
    evidence: [evidence],
    items: [item],
    delivery_profile: {
      profile: {
        providers: [{
          provider_label: providerLabel,
          provider_origin: providerOrigin,
          history_start: "2025-07-20",
          history_end: orderDate,
          completed_history_cursor: {
            completed_order_date: orderDate,
            provider_order_locator: `order-${seed}`,
          },
        }],
        interpretation_preferences: [],
        schema_version: 1,
      },
      markdown: "",
    },
    delivery_report: {
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: [{
        row_id: `row-${seed}`,
        item_ids: [itemId],
        evidence_ids: [evidenceId],
        distinct_order_count: 1,
        last_date: orderDate,
      }],
      schema_version: 1,
    },
  };
}

function importedDeliveryJournalFixture({ seed, locationLabel }) {
  const paddedSeed = seed.padStart(16, "0");
  const evidenceId = `evd_${paddedSeed}`;
  const itemId = `itm_${paddedSeed}`;
  const snapshotId = `snp_${paddedSeed}`;
  const collectionItemId = `collection-item-${seed.padStart(4, "0")}`;
  const importedAt = now.toISOString();
  return {
    stage: "delivery",
    evidence: [{
      id: evidenceId,
      kind: "import",
      observed_at: importedAt,
      evidence_date: "2026-07-20",
      date_precision: "day",
      source_type: "shared_collection",
      source_label: "Shared collection",
      stable_locator: `${snapshotId}/${collectionItemId}`,
      summary: "Imported Wintermelon boba",
      actor_id: "act_0000000000000201",
      limitations: ["No prior-order or reorder authority"],
      schema_version: 1,
    }],
    items: [{
      id: itemId,
      kind: "delivery_dish",
      delivery_authority: "public_import",
      evidence_ids: [evidenceId],
      created_at: importedAt,
      updated_at: importedAt,
      schema_version: 1,
      body_markdown: "",
      dish_name: "Wintermelon Boba",
      restaurant_name: "Wanpo Tea",
      public_location_label: locationLabel,
      public_merchant_address: { locality: locationLabel, region: "CA" },
      image_url: null,
      image_page_url: null,
      source_display_attribution: "Shared collection",
      classification: { kind: "food", authored_by: "agent" },
      import_provenance: {
        source_collection_id: `col_${paddedSeed}`,
        source_snapshot_id: snapshotId,
        source_collection_item_id: collectionItemId,
        published_revision: "a".repeat(40),
        source_display_attribution: "Shared collection",
        imported_at: importedAt,
      },
    }],
  };
}

function combineDeliveryJournals(...journals) {
  return {
    stage: "delivery",
    evidence: journals.flatMap(({ evidence }) => evidence),
    items: journals.flatMap(({ items }) => items),
    delivery_profile: {
      profile: {
        providers: journals.flatMap(({ delivery_profile }) => delivery_profile.profile.providers),
        interpretation_preferences: [],
        schema_version: 1,
      },
      markdown: "",
    },
    delivery_report: {
      report_type: "delivery_index",
      markdown: "# Delivery",
      assertions: journals.flatMap(({ delivery_report }) => delivery_report.assertions),
      schema_version: 1,
    },
  };
}
