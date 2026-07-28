import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ActorIdSchema,
  CollectionIdSchema,
  CollectionSnapshotSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ImportedDeliveryDishItemSchema,
  InvitationIdSchema,
  JournalItemSchema,
  MealPlanEventSchema,
  MealPlanningProfileSchema,
  MealProposalSchema,
  OnboardingRecordSchema,
  RequestIdSchema,
  ShareIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountService } from "../account/service.js";
import { MemoryHouseholdRepository } from "../adapters/memory.js";
import { DeterministicRandomSource, FixedClock, NoopTelemetry } from "../adapters/providers.js";
import type { TokenHasher } from "../core/ports.js";
import type { HouseholdProjection, MembershipRecord, MutationRecord, Principal } from "../core/types.js";
import { NeonAuthStore } from "../auth/neon-store.js";
import { NeonOAuthStore } from "../oauth/neon-store.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { NeonConnection } from "./neon.js";
import { NeonOperationalStore } from "./neon-operational-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const testDatabaseUrl = databaseUrl ?? "postgresql://invalid.local/disabled-test";

describeDatabase("NeonOperationalStore", () => {
  const householdId = HouseholdIdSchema.parse("hsh_0000000000000101");
  const ownerId = UserIdSchema.parse("usr_0000000000000101");
  const ownerActorId = ActorIdSchema.parse("act_0000000000000101");
  const head = GitObjectIdSchema.parse("1".repeat(40));
  const nextHead = GitObjectIdSchema.parse("2".repeat(40));
  const tokenHasher: TokenHasher = {
    hash: (token) => createHash("sha256").update(token).digest("hex"),
    matches: (token, digest) => createHash("sha256").update(token).digest("hex") === digest,
  };
  let connection: NeonConnection;
  let store: NeonOperationalStore;
  let authStore: NeonAuthStore;
  let oauthStore: NeonOAuthStore;

  beforeAll(async () => {
    connection = new NeonConnection(testDatabaseUrl, testDatabaseUrl);
    store = new NeonOperationalStore(connection, tokenHasher);
    authStore = new NeonAuthStore(connection);
    oauthStore = new NeonOAuthStore(connection);
    await connection.direct`TRUNCATE oauth_clients, households, users CASCADE`;
    await connection.direct`
      INSERT INTO users (id, actor_id, display_name)
      VALUES (${ownerId}, ${ownerActorId}, 'Kitchen Owner')
    `;
    await connection.direct`
      INSERT INTO external_identities (provider, provider_subject_hash, user_id)
      VALUES ('magic_link', 'owner-subject', ${ownerId})
    `;
  });

  afterAll(async () => {
    await connection.direct`TRUNCATE oauth_clients, households, users CASCADE`;
    await connection.close();
  });

  it("persists households, memberships, preferences, invitations, and shares", async () => {
    const owner: MembershipRecord = {
      householdId,
      userId: ownerId,
      actorId: ownerActorId,
      role: "owner",
      projectionHead: head,
      removedAt: null,
    };
    await store.createHousehold({
      id: householdId,
      name: "Test Kitchen",
      repositoryHead: head,
      provisioningState: "ready",
      createdAt: "2026-07-15T12:00:00.000Z",
    }, owner);

    expect(await store.getHousehold(householdId)).toMatchObject({ name: "Test Kitchen", repositoryHead: head });
    expect(await store.listHouseholds()).toContainEqual(expect.objectContaining({ id: householdId, repositoryHead: head }));
    expect(await store.getMembership(householdId, ownerId)).toEqual(owner);
    expect(await store.listMemberships(ownerId)).toHaveLength(1);
    expect(await store.listHouseholdMemberships(householdId)).toEqual([owner]);
    await store.setDefaultHousehold(ownerId, householdId);
    expect(await store.getDefaultHousehold(ownerId)).toBe(householdId);

    const invitation = {
      id: InvitationIdSchema.parse("inv_0000000000000101"),
      householdId,
      tokenHash: tokenHasher.hash("invitation-token"),
      role: "editor" as const,
      expiresAt: "2026-08-01T12:00:00.000Z",
      intendedEmailHint: "person@example.test",
      acceptedAt: null,
      revokedAt: null,
    };
    await store.saveInvitation(invitation);
    expect(await store.getInvitation(invitation.id)).toEqual(invitation);
    expect(await store.findInvitationByTokenHash(invitation.tokenHash)).toEqual(invitation);

    const collectionId = CollectionIdSchema.parse("col_0000000000000101");
    const snapshot = CollectionSnapshotSchema.parse({
      id: "snp_0000000000000101",
      collection_id: collectionId,
      title: "Favorites",
      sharer_display_name: "Kitchen Owner",
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      items: [{
        collection_item_id: "collection-item-0101",
        source_item_id: "itm_0000000000000101",
        kind: "snack",
        title: "Apple",
        public_description: null,
        brand: null,
        flavor: null,
        formulation: null,
        format: null,
        author_or_publisher: null,
        canonical_recipe_url: null,
        image_url: null,
        image_page_url: null,
        preparation_notes: null,
        source_display_attribution: null,
        source_item_revision: head,
      }],
    });
    const share = {
      id: ShareIdSchema.parse("shr_0000000000000101"),
      collectionId,
      householdId,
      tokenHash: tokenHasher.hash("share-token"),
      snapshot,
      expiresAt: "2026-08-01T12:00:00.000Z",
      revokedAt: null,
    };
    await store.saveShare(share);
    expect(await store.getShareByTokenHash(share.tokenHash)).toEqual(share);
    expect(await store.getShareByCollection(householdId, collectionId)).toEqual(share);
  });

  it("keeps idempotent mutations and projection changes durable under the household lock", async () => {
    const mutation: MutationRecord = {
      requestId: RequestIdSchema.parse("req_0000000000000101"),
      userId: ownerId,
      tool: "hfj_update_profile",
      idempotencyKey: "profile-0101",
      householdId,
      state: "received",
      commitId: null,
      response: null,
      failure: null,
      createdAt: "2026-07-15T12:00:00.000Z",
      updatedAt: "2026-07-15T12:00:00.000Z",
    };
    await store.saveMutation(mutation);
    await store.saveMutation({ ...mutation, requestId: RequestIdSchema.parse("req_0000000000000102") });
    expect(await store.listMutationsForReconciliation(householdId)).toEqual([mutation]);

    await store.withHouseholdLock(householdId, async () => {
      await store.transitionMutation(mutation.requestId, "locked");
      const projection = await store.projection(householdId);
      projection.profiles.set("snacks", { markdown: "# Snacks\n", revision: nextHead });
      await store.transitionMutation(mutation.requestId, "git_committed", { commitId: nextHead });
      await store.transitionMutation(mutation.requestId, "projections_applied", { response: { status: "completed" } });
      await store.updateHouseholdHead(householdId, nextHead);
      await store.transitionMutation(mutation.requestId, "completed", { response: { status: "completed" } });
    });

    const replay = await store.getMutation(ownerId, mutation.tool, mutation.idempotencyKey);
    expect(replay).toMatchObject({ requestId: mutation.requestId, state: "completed", commitId: nextHead });
    expect((await store.projection(householdId)).profiles.get("snacks")).toEqual({ markdown: "# Snacks\n", revision: nextHead });
    expect(await store.listMutationsForReconciliation(householdId)).toEqual([]);

    const rebuiltHead = GitObjectIdSchema.parse("3".repeat(40));
    const mealPlanningProfile = MealPlanningProfileSchema.parse({
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-20T16:00:00.000Z",
      },
      revision: rebuiltHead,
      updated_at: "2026-07-20T16:00:00.000Z",
      schema_version: 1,
    });
    const reviewEvent = MealPlanEventSchema.parse({
      id: "mle_0000000000000101",
      kind: "constraints_reviewed",
      week_start: "2026-07-20",
      constraint_revision: rebuiltHead,
      actor: ownerActorId,
      occurred_at: "2026-07-20T16:01:00.000Z",
      schema_version: 1,
    });
    const mealProposal = MealProposalSchema.parse({
      id: "mlp_0000000000000101",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      proposed_by: ownerActorId,
      source: { kind: "freeform", title: "Soup" },
      servings: 4,
      notes: null,
      constraint_revision: rebuiltHead,
      constraint_review_event_id: reviewEvent.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients need review.",
      created_at: "2026-07-20T16:02:00.000Z",
      schema_version: 1,
    });
    const deliveryDish = JournalItemSchema.parse({
      id: "itm_0000000000000109",
      kind: "delivery_dish",
      dish_name: "Wintermelon boba",
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example.test",
      restaurant_name: "Wanpo",
      public_location_label: "Palo Alto",
      public_merchant_address: { locality: "Palo Alto", region: "CA" },
      merchant_locator: "private-delivery-merchant",
      known_menu_item_locators: ["private-delivery-menu"],
      known_modifier_occurrences: [{
        evidence_id: "evd_0000000000000109",
        modifiers_complete: true,
        modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
      }],
      classification: { kind: "food", authored_by: "agent" },
      evidence_ids: ["evd_0000000000000109"],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      body_markdown: "",
    });
    const importedDeliveryDish = ImportedDeliveryDishItemSchema.parse({
      id: "itm_0000000000000110",
      kind: "delivery_dish",
      delivery_authority: "public_import",
      dish_name: "Citrus spritz",
      restaurant_name: "Corner Table",
      public_location_label: "University Avenue",
      public_merchant_address: { locality: "Palo Alto", region: "CA" },
      image_url: null,
      image_page_url: null,
      source_display_attribution: "Shared collection",
      classification: { kind: "alcohol", authored_by: "agent" },
      import_provenance: {
        source_collection_id: "col_0000000000000110",
        source_snapshot_id: "snp_0000000000000110",
        source_collection_item_id: "collection-item-0110",
        published_revision: rebuiltHead,
        source_display_attribution: "Shared collection",
        imported_at: "2026-07-15T12:00:00.000Z",
      },
      evidence_ids: ["evd_0000000000000110"],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      body_markdown: "",
    });
    const rebuilt: HouseholdProjection = {
      evidence: new Map(),
      items: new Map([
        [deliveryDish.id, { item: deliveryDish, revision: rebuiltHead }],
        [importedDeliveryDish.id, { item: importedDeliveryDish, revision: rebuiltHead }],
      ]),
      profiles: new Map([["household", { markdown: "# Rebuilt", revision: rebuiltHead }]]),
      collections: new Map(),
      mealPlanningProfile,
      mealProposals: new Map([[mealProposal.id, { proposal: mealProposal, revision: rebuiltHead }]]),
      mealPlanEvents: new Map([[reviewEvent.id, { event: reviewEvent, revision: rebuiltHead }]]),
    };
    await store.withHouseholdLock(householdId, async () => {
      await store.replaceHouseholdProjection(householdId, "Rebuilt Household", rebuiltHead, rebuilt, [{ actorId: ownerActorId, role: "owner", removedAt: null, userId: ownerId }]);
    });
    expect((await store.projection(householdId)).profiles.get("household")).toEqual({ markdown: "# Rebuilt", revision: rebuiltHead });
    expect((await store.projection(householdId)).mealProposals.get(mealProposal.id)?.proposal.source).toEqual({ kind: "freeform", title: "Soup" });
    const searchRows = await connection.direct<Record<string, unknown>[]>`
      SELECT kind, distinguishing_fields, search_document::text AS search_document
      FROM search_items
      WHERE household_id = ${householdId} AND item_id = ${deliveryDish.id}
    `;
    expect(searchRows).toEqual([expect.objectContaining({
      kind: "delivery_dish",
      distinguishing_fields: expect.objectContaining({
        provider_label: "DoorDash",
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
      }),
    })]);
    expect(JSON.stringify(searchRows)).not.toContain("private-delivery");
    const importedSearchRows = await connection.direct<Record<string, unknown>[]>`
      SELECT kind, distinguishing_fields, search_document::text AS search_document
      FROM search_items
      WHERE household_id = ${householdId} AND item_id = ${importedDeliveryDish.id}
    `;
    expect(importedSearchRows).toEqual([expect.objectContaining({
      kind: "delivery_dish",
      distinguishing_fields: expect.objectContaining({
        restaurant_name: "Corner Table",
        public_location_label: "University Avenue",
      }),
    })]);
    expect(JSON.stringify(importedSearchRows)).not.toContain("provider_label");
    expect((await store.getHousehold(householdId))?.name).toBe("Rebuilt Household");
    expect(await store.getMembership(householdId, ownerId)).toMatchObject({ role: "owner", projectionHead: rebuiltHead });
  });

  it("persists an atomic evidence-backed recipe before returning success", async () => {
    const repository = new MemoryHouseholdRepository();
    const principal: Principal = {
      userId: ownerId,
      actorId: ownerActorId,
      displayName: "Kitchen Owner",
      scopes: new Set(["journal:read", "journal:write", "household:manage"]),
      client: "test",
    };
    const service = new HouseholdFoodJournalService(
      store,
      repository,
      new FixedClock(new Date("2026-07-28T12:00:00.000Z")),
      new DeterministicRandomSource(),
      tokenHasher,
      new NoopTelemetry(),
      new URL("https://journal.example.test"),
    );
    const created = await service.call("hfj_create_household", {
      name: "Recovered Cloud Kitchen",
      idempotency_key: "atomic-recipe-create-0101",
    }, principal);
    if (!created.ok) throw new Error(created.error.code);
    const createdData = z.object({ household_id: HouseholdIdSchema }).parse(created.data);
    const createdHead = GitObjectIdSchema.parse(created.repository_head);
    const evidenceId = "evd_0000000000000191";
    const checkpointEvidenceId = "evd_0000000000000192";
    const itemId = "itm_0000000000000191";

    const committed = await service.call("hfj_commit_change_set", {
      household_id: createdData.household_id,
      expected_head: createdHead,
      idempotency_key: "atomic-recipe-save-0101",
      evidence: [{
        id: evidenceId,
        kind: "recipe_discovery",
        observed_at: "2026-07-28T12:00:00.000Z",
        evidence_date: "2026-07-28",
        date_precision: "day",
        source_type: "recipe_website",
        source_label: "FutureDish",
        stable_locator: "https://example.test/fishcake-hotpot",
        summary: "Saved fishcake hotpot",
        actor_id: ownerActorId,
        limitations: ["Saved only"],
        schema_version: 1,
        recipe_discovery: {
          canonical_recipe_url: "https://example.test/fishcake-hotpot",
          audited_page_url: "https://example.test/fishcake-hotpot",
          author_or_publisher: "FutureDish",
          source_scope: "saved",
        },
      }],
      items: [{
        id: itemId,
        kind: "recipe",
        title: "Fishcake hotpot",
        canonical_url: "https://example.test/fishcake-hotpot",
        audited_page_url: "https://example.test/fishcake-hotpot",
        author_or_publisher: "FutureDish",
        saved: "yes",
        cooked: "no",
        liked: "no",
        last_cooked: null,
        date_precision: "unknown",
        image_url: null,
        image_page_url: null,
        evidence_ids: [evidenceId],
        created_at: "2026-07-28T12:00:00.000Z",
        updated_at: "2026-07-28T12:00:00.000Z",
        schema_version: 1,
        body_markdown: "Saved from the recipe page.",
      }],
      expected_item_revisions: {},
    }, principal);
    expect(committed).toMatchObject({
      ok: true,
      data: { evidence_ids: [evidenceId], item_ids: [itemId] },
    });
    if (!committed.ok) throw new Error(committed.error.code);

    const persisted = await store.projection(createdData.household_id);
    expect(persisted.evidence.has(evidenceId)).toBe(true);
    const persistedItem = persisted.items.get(itemId)?.item;
    expect(persistedItem?.kind).toBe("recipe");
    if (persistedItem?.kind !== "recipe") throw new Error("Recipe projection was not persisted");
    expect(persistedItem.title).toBe("Fishcake hotpot");
    expect(await service.call("hfj_search_items", {
      household_id: createdData.household_id,
      query: "fishcake",
      kind: "recipe",
      limit: 10,
    }, principal)).toMatchObject({
      ok: true,
      data: { items: [expect.objectContaining({ id: itemId, title: "Fishcake hotpot" })] },
    });
    const checkpoint = await service.call("hfj_append_evidence", {
      household_id: createdData.household_id,
      expected_head: GitObjectIdSchema.parse(committed.repository_head),
      idempotency_key: "recipe-evidence-checkpoint-0101",
      evidence: [{
        id: checkpointEvidenceId,
        kind: "recipe_discovery",
        observed_at: "2026-07-28T12:01:00.000Z",
        evidence_date: "2026-07-28",
        date_precision: "day",
        source_type: "recipe_website",
        source_label: "FutureDish",
        stable_locator: "https://example.test/noodle-soup",
        summary: "Checkpointed noodle soup discovery",
        actor_id: ownerActorId,
        limitations: ["No item authored yet"],
        schema_version: 1,
        recipe_discovery: {
          canonical_recipe_url: "https://example.test/noodle-soup",
          audited_page_url: "https://example.test/noodle-soup",
          author_or_publisher: "FutureDish",
          source_scope: "discoverable",
        },
      }],
    }, principal);
    expect(checkpoint).toMatchObject({
      ok: true,
      data: { evidence_ids: [checkpointEvidenceId] },
    });
    expect((await store.projection(createdData.household_id)).evidence.has(checkpointEvidenceId)).toBe(true);
    await connection.direct.begin(async (sql) => {
      await sql`DELETE FROM mutation_requests WHERE household_id = ${createdData.household_id}`;
      await sql`DELETE FROM households WHERE id = ${createdData.household_id}`;
    });
  });

  it("persists onboarding progress with optimistic revisions", async () => {
    const started = OnboardingRecordSchema.parse({
      user_id: ownerId,
      household_id: householdId,
      section: "snacks",
      status: "in_progress",
      skip_reason: null,
      revision: 1,
      updated_at: "2026-07-21T20:00:00.000Z",
    });
    expect(await store.compareAndSetOnboarding({ ...started, revision: 3 }, 0)).toBe(false);
    expect(await store.compareAndSetOnboarding(started, 0)).toBe(true);
    expect(await store.compareAndSetOnboarding({ ...started, revision: 2 }, 0)).toBe(false);

    const skipped = OnboardingRecordSchema.parse({
      ...started,
      status: "skipped",
      skip_reason: "not_now",
      revision: 2,
      updated_at: "2026-07-21T20:01:00.000Z",
    });
    expect(await store.compareAndSetOnboarding(skipped, 1)).toBe(true);
    expect(await store.listOnboardingRecords(ownerId, householdId)).toEqual([skipped]);
  });

  it("claims export downloads once for their requester and reclaims terminal rows", async () => {
    const active = {
      id: "exp_0000000000000101",
      householdId,
      requestedBy: ownerId,
      format: "readable_zip" as const,
      tokenHash: tokenHasher.hash("export-token"),
      objectPath: "exp_0000000000000101.bin",
      contentHash: "a".repeat(64),
      repositoryHead: head,
      expiresAt: "2026-07-15T12:15:00.000Z",
      downloadedAt: null,
      createdAt: "2026-07-15T12:00:00.000Z",
    };
    await store.saveExportDownload(active);
    expect(await store.getActiveExportDownload(active.tokenHash, UserIdSchema.parse("usr_0000000000000199"), "2026-07-15T12:01:00.000Z")).toBeNull();
    expect(await store.getActiveExportDownload(active.tokenHash, ownerId, "2026-07-15T12:01:00.000Z")).toEqual(active);
    expect(await store.claimExportDownload(active.tokenHash, ownerId, "2026-07-15T12:01:00.000Z")).toEqual({ ...active, downloadedAt: "2026-07-15T12:01:00.000Z" });
    expect(await store.claimExportDownload(active.tokenHash, ownerId, "2026-07-15T12:02:00.000Z")).toBeNull();
    expect(await store.listReclaimableExportDownloads("2026-07-15T12:02:00.000Z")).toEqual([{ ...active, downloadedAt: "2026-07-15T12:01:00.000Z" }]);
    await store.deleteExportDownload(active.id);
    expect(await store.listReclaimableExportDownloads("2026-07-15T12:02:00.000Z")).toEqual([]);
  });

  it("reports bounded operator health from durable state", async () => {
    const pending: MutationRecord = {
      requestId: RequestIdSchema.parse("req_0000000000000199"), userId: ownerId, tool: "hfj_export_household",
      idempotencyKey: "operator-health-0199", householdId, state: "received", commitId: null,
      response: null, failure: null, createdAt: "2026-07-15T12:00:00.000Z", updatedAt: "2026-07-15T12:00:00.000Z",
    };
    await store.saveMutation(pending);
    const backup = {
      householdId, repositoryHead: head,
      manifestHash: "a".repeat(64), bundleHash: "b".repeat(64),
      objectKey: "backups/household.bundle.jwe", manifestObjectKey: "backups/household.manifest.jwe",
      completedAt: "2026-07-15T12:05:00.000Z", verifiedAt: "2026-07-15T12:06:00.000Z", retainedUntil: "2026-08-19T12:05:00.000Z",
    };
    await store.saveBackupCheckpoint(backup);
    await expect(store.getBackupCheckpoint(householdId)).resolves.toEqual(backup);
    await store.saveRepositoryVerification({ householdId, repositoryHead: head, fsckValid: true, signaturesValid: true, checkedAt: "2026-07-15T12:04:00.000Z", detailCode: "verified" });
    await store.saveRestoreDrill({ householdId, repositoryHead: head, succeeded: true, completedAt: "2026-07-15T12:07:00.000Z", detailCode: "verified" });
    await expect(store.operatorHealth()).resolves.toMatchObject({
      incompleteMutationCount: 1,
      reconciliationRequiredCount: 0,
      oldestIncompleteMutationAt: "2026-07-15T12:00:00.000Z",
      quarantinedHouseholdCount: 0,
      householdCount: 1,
      householdsWithoutBackup: 0,
      oldestBackupAt: "2026-07-15T12:05:00.000Z",
      lastFsckAt: "2026-07-15T12:04:00.000Z",
      fsckFailureCount: 0,
      lastSignatureCheckAt: "2026-07-15T12:04:00.000Z",
      signatureFailureCount: 0,
      lastRestoreDrillAt: "2026-07-15T12:07:00.000Z",
      lastRestoreDrillSucceeded: true,
      schemaVersion: "0008",
    });
    await store.transitionMutation(pending.requestId, "failed_before_commit", { failure: "test_cleanup" });
    expect((await store.operatorHealth()).incompleteMutationCount).toBe(0);
  });

  it("serializes concurrent transactions for the same household", async () => {
    const order: string[] = [];
    let releaseFirst = (): void => { throw new Error("First lock gate was not initialized"); };
    let markEntered = (): void => { throw new Error("Entry gate was not initialized"); };
    const entered = new Promise<void>((resolve) => { markEntered = resolve; });
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = store.withHouseholdLock(householdId, async () => {
      order.push("first-enter");
      markEntered();
      await gate;
      order.push("first-exit");
    });
    await entered;
    const second = store.withHouseholdLock(householdId, async () => {
      await Promise.resolve();
      order.push("second-enter");
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(order).toEqual(["first-enter"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-enter", "first-exit", "second-enter"]);
  });

  it("hashes session tokens and revokes all active user sessions", async () => {
    const token = "raw-session-token";
    await connection.direct`
      INSERT INTO web_sessions (id, user_id, token_hash, csrf_hash, scopes, client, expires_at)
      VALUES (
        'ses_0000000000000101', ${ownerId}, ${tokenHasher.hash(token)}, 'csrf-hash',
        ARRAY['journal:read', 'journal:write'], 'web', now() + interval '1 hour'
      )
    `;
    const session = await store.getByToken(token);
    expect(session).toMatchObject({ userId: ownerId, actorId: ownerActorId, displayName: "Kitchen Owner", client: "web" });
    expect(session?.scopes).toEqual(new Set(["journal:read", "journal:write"]));
    expect(await store.getByToken("wrong-token")).toBeNull();
    await store.revokeUser(ownerId);
    expect(await store.getByToken(token)).toBeNull();
  });

  it("persists active passkey public credentials and compare-and-set counters", async () => {
    expect(await authStore.getUserById(ownerId)).toMatchObject({ id: ownerId, displayName: "Kitchen Owner" });
    expect(await authStore.getUserById(UserIdSchema.parse("usr_0000000000000199"))).toBeNull();
    const credential = {
      credentialId: "credential_0000000000000101",
      userId: ownerId,
      publicKey: new Uint8Array(16).fill(1),
      counter: 1,
      transports: ["internal" as const, "hybrid" as const],
      deviceType: "multiDevice" as const,
      backedUp: true,
      name: "Passkey",
      createdAt: "2026-07-15T12:00:00.000Z",
      lastUsedAt: null,
    };
    await expect(authStore.savePasskeyCredential(credential)).resolves.toBe(true);
    await expect(authStore.savePasskeyCredential(credential)).resolves.toBe(false);
    expect(await authStore.getPasskeyCredential(credential.credentialId)).toEqual(credential);
    expect(await authStore.listPasskeyCredentials(ownerId)).toEqual([credential]);
    await expect(authStore.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 0, newCounter: 2, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(false);
    await expect(authStore.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 1, newCounter: 0, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(false);
    await expect(authStore.updatePasskeyCounter({ credentialId: credential.credentialId, expectedCounter: 1, newCounter: 2, usedAt: "2026-07-15T12:01:00.000Z" })).resolves.toBe(true);
    expect(await authStore.getPasskeyCredential(credential.credentialId)).toMatchObject({ counter: 2, lastUsedAt: "2026-07-15T12:01:00.000Z" });
    await expect(authStore.revokePasskeyCredential({ credentialId: credential.credentialId, userId: UserIdSchema.parse("usr_0000000000000199"), revokedAt: "2026-07-15T12:02:00.000Z" })).resolves.toBe("not_found");
    await expect(authStore.revokePasskeyCredential({ credentialId: credential.credentialId, userId: ownerId, revokedAt: "2026-07-15T12:02:00.000Z" })).resolves.toBe("removed");
    expect(await authStore.getPasskeyCredential(credential.credentialId)).toBeNull();
  });

  it("links and removes external identities without orphaning the account", async () => {
    await expect(authStore.linkIdentityMethod(ownerId, "apple", "owner-apple")).resolves.toBe("linked");
    await expect(authStore.linkIdentityMethod(ownerId, "apple", "owner-apple")).resolves.toBe("already_linked");
    expect(await authStore.listIdentityMethods(ownerId)).toEqual(["apple", "magic_link"]);
    await expect(authStore.removeIdentityMethod(ownerId, "magic_link")).resolves.toBe("removed");
    await expect(authStore.removeIdentityMethod(ownerId, "apple")).resolves.toBe("last_method");
  });

  it("enforces final-owner membership safety and revokes connected agent tokens", async () => {
    const lifecycleHouseholdId = HouseholdIdSchema.parse("hsh_0000000000000102");
    const lifecycleUserId = UserIdSchema.parse("usr_0000000000000102");
    const lifecycleActorId = ActorIdSchema.parse("act_0000000000000102");
    const coOwnerId = UserIdSchema.parse("usr_0000000000000103");
    const coOwnerActorId = ActorIdSchema.parse("act_0000000000000103");
    await connection.direct`
      INSERT INTO users (id, actor_id, display_name) VALUES
      (${lifecycleUserId}, ${lifecycleActorId}, 'Lifecycle Owner'),
      (${coOwnerId}, ${coOwnerActorId}, 'Co-owner')
    `;
    const lifecycleRepository = new MemoryHouseholdRepository();
    const lifecycleHead = await lifecycleRepository.provision(
      lifecycleHouseholdId, "Lifecycle Kitchen", lifecycleActorId, "2026-07-15T12:00:00.000Z",
    );
    await store.createHousehold(
      { id: lifecycleHouseholdId, name: "Lifecycle Kitchen", repositoryHead: lifecycleHead, provisioningState: "ready", createdAt: "2026-07-15T12:00:00.000Z" },
      { householdId: lifecycleHouseholdId, userId: lifecycleUserId, actorId: lifecycleActorId, role: "owner", projectionHead: lifecycleHead, removedAt: null },
    );
    await expect(store.leaveMembership(lifecycleUserId, lifecycleHouseholdId, "2026-07-15T12:10:00.000Z")).resolves.toBe("sole_owner");
    await store.upsertMembership({ householdId: lifecycleHouseholdId, userId: coOwnerId, actorId: coOwnerActorId, role: "owner", projectionHead: lifecycleHead, removedAt: null });
    const accounts = new AccountService(
      authStore, store, oauthStore, new FixedClock(new Date("2026-07-15T12:12:00.000Z")),
      lifecycleRepository, new DeterministicRandomSource(),
    );
    await accounts.leaveHousehold(lifecycleUserId, lifecycleHouseholdId);
    expect(await lifecycleRepository.read(lifecycleHouseholdId, `members/${lifecycleActorId}.md`)).toContain("former_member: true");
    await expect(store.leaveMembership(lifecycleUserId, lifecycleHouseholdId, "2026-07-15T12:13:00.000Z")).resolves.toBe("not_found");

    await oauthStore.registerClient({ clientId: "lifecycle-client", name: "Lifecycle Agent", redirectUris: ["https://example.test/callback"], tokenEndpointAuthMethod: "none" });
    await oauthStore.saveGrant({ id: "lifecycle-grant", userId: lifecycleUserId, clientId: "lifecycle-client", scopes: ["journal:read"], resource: "https://journal.example.test/mcp", revokedAt: null });
    await oauthStore.saveToken({
      id: "lifecycle-token", grantId: "lifecycle-grant", kind: "access", tokenHash: "lifecycle-token-hash",
      familyId: null, parentId: null, pkceChallenge: null, redirectUri: null, audience: "https://journal.example.test/mcp",
      expiresAt: "2026-07-16T12:00:00.000Z", usedAt: null, revokedAt: null,
    });
    expect(await oauthStore.listActiveGrants(lifecycleUserId)).toEqual([{ id: "lifecycle-grant", clientId: "lifecycle-client", clientName: "Lifecycle Agent", scopes: ["journal:read"] }]);
    await expect(oauthStore.revokeGrantForUser(lifecycleUserId, "lifecycle-grant", "2026-07-15T12:14:00.000Z")).resolves.toBe(true);
    expect((await oauthStore.getToken("lifecycle-token-hash"))?.revokedAt).toBe("2026-07-15T12:14:00.000Z");
    expect(await oauthStore.listActiveGrants(lifecycleUserId)).toEqual([]);
  });
});
