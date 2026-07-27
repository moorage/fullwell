import { resolve } from "node:path";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { z } from "zod";
import {
  CollectionSnapshotSchema,
  DeliveryOrderLineEvidenceSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
  JournalItemSchema,
  MealProposalSchema,
  ShareIdSchema,
  type HouseholdId,
} from "@hfj/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { DeterministicRandomSource, DeterministicTestAuthenticator, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import { WebViewModelService } from "./web-view-model.js";

describe("WebViewModelService", () => {
  let store: MemoryOperationalStore;
  let hasher: HmacTokenHasher;
  let principal: Principal;
  let householdId: HouseholdId;
  let viewModels: WebViewModelService;
  let service: HouseholdFoodJournalService;

  beforeEach(async () => {
    store = new MemoryOperationalStore();
    hasher = new HmacTokenHasher("web-view-model-test-pepper");
    const authentication = new DeterministicTestAuthenticator();
    principal = await authentication.authenticate("Bearer test-owner-token");
    service = new HouseholdFoodJournalService(
      store,
      new MemoryHouseholdRepository(),
      new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      new DeterministicRandomSource(),
      hasher,
      new NoopTelemetry(),
      new URL("https://journal.example.test"),
    );
    const created = await service.call("hfj_create_household", { name: "View Model Kitchen", idempotency_key: "view-model-household-0701" }, principal);
    if (!created.ok) throw new Error(created.error.message);
    householdId = z.object({ household_id: HouseholdIdSchema }).parse(created.data).household_id;
    const household = await store.getHousehold(householdId);
    if (household === null) throw new Error("household fixture missing");
    const snapshot = collectionSnapshot(household.repositoryHead);
    const projection = await store.projection(householdId);
    projection.collections.set(snapshot.collection_id, { snapshot, revision: household.repositoryHead });
    const privateSnapshot = CollectionSnapshotSchema.parse({ ...snapshot, id: "snp_0000000000000702", collection_id: "col_0000000000000702", title: "Private picks" });
    const expiredSnapshot = CollectionSnapshotSchema.parse({ ...snapshot, id: "snp_0000000000000703", collection_id: "col_0000000000000703", title: "Old picks" });
    projection.collections.set(privateSnapshot.collection_id, { snapshot: privateSnapshot, revision: household.repositoryHead });
    projection.collections.set(expiredSnapshot.collection_id, { snapshot: expiredSnapshot, revision: household.repositoryHead });
    await store.saveShare({
      id: ShareIdSchema.parse("shr_0000000000000701"), collectionId: snapshot.collection_id, householdId,
      tokenHash: hasher.hash("p".repeat(43)), snapshot, expiresAt: "2026-08-15T12:00:00.000Z", revokedAt: null,
    });
    await store.saveShare({
      id: ShareIdSchema.parse("shr_0000000000000703"), collectionId: expiredSnapshot.collection_id, householdId,
      tokenHash: hasher.hash("x".repeat(43)), snapshot: expiredSnapshot, expiresAt: "2020-01-01T00:00:00.000Z", revokedAt: null,
    });
    await saveInvitations(store, hasher, householdId);
    viewModels = await WebViewModelService.create({
      service,
      store,
      authentication,
      hasher,
      random: new DeterministicRandomSource(),
      clock: new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      publicOrigin: new URL("https://journal.example.test"),
      installMetadataPath: resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json"),
      resolvePrincipal: async (request) => request.headers.authorization === undefined ? null : principal,
      verifyCsrf: async (_request, submittedToken) => {
        if (submittedToken !== "c".repeat(32)) throw new Error("invalid CSRF fixture");
      },
      listPasskeys: async (userId) => [{
        credentialId: "credential_51",
        userId,
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
        deviceType: "multiDevice",
        backedUp: true,
        name: "Passkey",
        createdAt: "2026-07-15T12:00:00.000Z",
        lastUsedAt: "2026-07-16T12:00:00.000Z",
      }],
      messagingStatus: async (_principal, setup) => setup.deviceId === undefined || setup.householdId === undefined
        ? { kind: "not_configured", availableThrough: "2026-10-01T07:00:00.000Z" }
        : { kind: "setup", availableThrough: "2026-10-01T07:00:00.000Z", deviceId: setup.deviceId, householdId: setup.householdId, deviceName: "Kitchen Mac" },
    });
  });

  async function context(
    path: string,
    authenticated = false,
    csrfCookie?: string,
    model: WebViewModelService = viewModels,
  ) {
    const app = Fastify();
    await app.register(cookie);
    app.get("/*", async (request) => model.contextFor(request));
    const response = await app.inject({
      method: "GET",
      url: path,
      headers: {
        ...(authenticated ? { authorization: "Bearer test-owner-token" } : {}),
        ...(csrfCookie === undefined ? {} : { cookie: `hfj_csrf=${csrfCookie}` }),
      },
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    const responseBody: unknown = response.json();
    return z.object({
      viewer: z.object({ displayName: z.string() }),
      households: z.array(z.object({ name: z.string(), repositoryHead: GitObjectIdSchema, members: z.number(), recipes: z.number(), groceries: z.number() }).passthrough()),
      members: z.array(z.object({ name: z.string(), isCurrentUser: z.boolean().optional() }).passthrough()),
      collections: z.array(z.object({ status: z.string() }).passthrough()),
      publicCollection: z.object({ token: z.string(), title: z.string(), sharedBy: z.string(), items: z.array(z.object({ source: z.string(), note: z.string().optional(), imageAlt: z.string().optional() }).passthrough()) }).passthrough(),
      invite: z.object({ state: z.string() }).passthrough(),
      collectionState: z.string(),
      security: z.object({ csrfToken: z.string() }).passthrough(),
      install: z.object({ hosts: z.object({
        codex: z.object({
          label: z.string(), setupPrompt: z.string(), setupHref: z.string().nullable(),
        }).passthrough(),
        claude: z.object({ command: z.string() }).passthrough(),
      }).passthrough() }).passthrough(),
      auth: z.object({
        passkeysEnabled: z.boolean(),
        passkeys: z.array(z.object({ id: z.string(), createdLabel: z.string(), lastUsedLabel: z.string().nullable() }).passthrough()),
        methods: z.array(z.object({ provider: z.string(), label: z.string() })),
        grants: z.array(z.object({ id: z.string(), clientName: z.string(), scopes: z.array(z.string()) })),
      }),
      messaging: z.object({ kind: z.string(), availableThroughLabel: z.string() }).passthrough(),
      mealPlan: z.object({
        householdId: z.string(),
        weekStart: z.string(),
        constraintState: z.string(),
        constraintRevision: z.string().nullable(),
        constraintReviewEventId: z.string().nullable(),
        proposalCount: z.number(),
        days: z.array(z.object({
          date: z.string(),
          slots: z.array(z.object({
            id: z.string(),
            key: z.string(),
            proposals: z.array(z.object({
              id: z.string(),
              title: z.string(),
              needsRecheck: z.boolean(),
              canWithdraw: z.boolean(),
            }).passthrough()),
          }).passthrough()),
        }).passthrough()),
      }).passthrough().nullable(),
      visualJournal: z.object({
        householdId: z.string(),
        section: z.enum(["recipes", "groceries", "takeout"]),
        snapshotRevision: GitObjectIdSchema,
        total: z.number(),
        items: z.array(z.object({ id: z.string(), kind: z.enum(["recipe", "grocery", "takeout"]), title: z.string() }).passthrough()),
        nextCursor: z.string().nullable(),
      }).nullable(),
    }).passthrough().parse(responseBody);
  }

  it("builds anonymous, authenticated household, and collection contexts", async () => {
    const anonymous = await context("/install");
    expect(anonymous.viewer.displayName).toBe("");
    expect(anonymous.households).toEqual([]);
    expect(anonymous.security.csrfToken).toHaveLength(32);
    expect(anonymous.install.hosts.codex.label).toBe("ChatGPT");
    expect(anonymous.install.hosts.codex).toMatchObject({
      setupPrompt: "@Fullwell hi",
      setupHref: "codex://new?prompt=%5B%40Fullwell%5D(plugin%3A%2F%2Ffullwell%40fullwell)%20hi",
    });
    expect(anonymous.install.hosts.claude).toMatchObject({
      command: expect.stringContaining("claude plugin install fullwell@fullwell"),
      setupPrompt: "Hi Fullwell.",
      setupHref: null,
    });

    const authenticated = await context(`/households/${householdId}/members`, true, "c".repeat(32));
    expect(authenticated.viewer.displayName).toBe("Test Owner");
    expect(authenticated.households[0]).toMatchObject({ name: "View Model Kitchen", repositoryHead: expect.any(String), members: 1, recipes: 0, groceries: 0 });
    expect(authenticated.members[0]).toMatchObject({ name: "Test Owner", isCurrentUser: true });
    expect(authenticated.security.csrfToken).toBe("c".repeat(32));

    const account = await context("/account", true);
    expect(account.auth).toMatchObject({
      passkeysEnabled: true,
      passkeys: [{ id: "credential_51", createdLabel: "Jul 15, 2026", lastUsedLabel: "Jul 16, 2026" }],
    });
    expect(account.messaging).toMatchObject({ kind: "not_configured", availableThroughLabel: "Sep 30, 2026" });
    const setup = await context(`/account?runner_device=dev_0000000000000001&household_id=${householdId}`, true);
    expect(setup.messaging).toMatchObject({ kind: "setup", deviceName: "Kitchen Mac" });

    const collections = await context(`/households/${householdId}/collections`, true);
    expect(collections.collections.map((entry: { status: string }) => entry.status).sort()).toEqual(["expired", "private", "published"]);

    const ready = await context(`/c/${"p".repeat(43)}`);
    expect(ready.collectionState).toBe("ready");
    expect(ready.publicCollection).toMatchObject({ title: "Public picks", sharedBy: "Kitchen Owner" });
    expect(ready.publicCollection.items[0]).toMatchObject({ source: "Market", note: "Crisp fruit", imageAlt: "Apple" });
    expect(ready.publicCollection.items[1]).toMatchObject({
      kind: "delivery_dish",
      title: "Canned citrus spritz",
      restaurantName: "Corner Table",
      locationLabel: "University Avenue",
      locationAddress: "Palo Alto, CA, United States",
      classification: "alcohol",
    });
    expect(JSON.stringify(ready.publicCollection)).not.toMatch(/provider|locator|order|modifier|actor/i);

    const unavailable = await context(`/c/${"m".repeat(43)}`);
    expect(unavailable.collectionState).toBe("unavailable");
    expect(unavailable.publicCollection.token).toBe("m".repeat(43));
  });

  it("projects account methods, grants, passkey activity, and messaging lifecycle variants", async () => {
    const installMetadataPath = resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json");
    const accountModel = await WebViewModelService.create({
      service,
      store,
      authentication: new DeterministicTestAuthenticator(),
      hasher,
      random: new DeterministicRandomSource(),
      clock: new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      publicOrigin: new URL("https://journal.example.test"),
      installMetadataPath,
      resolvePrincipal: async () => principal,
      listPasskeys: async (userId) => [{
        credentialId: "credential_never_used",
        userId,
        publicKey: new Uint8Array([4, 5, 6]),
        counter: 0,
        transports: ["usb"],
        deviceType: "singleDevice",
        backedUp: false,
        name: "Security key",
        createdAt: "2026-07-14T12:00:00.000Z",
        lastUsedAt: null,
      }],
      accountSummary: async () => ({
        methods: ["apple", "magic_link"],
        grants: [{
          id: "grant_0701",
          clientId: "client_0701",
          clientName: "Kitchen helper",
          scopes: ["journal:read", "journal:write"],
        }],
      }),
      messagingStatus: async () => ({
        kind: "linked",
        availableThrough: "2026-10-01T07:00:00.000Z",
        deviceId: "dev_0000000000000701",
        householdId,
        deviceName: "Kitchen Mac",
        lastSeenAt: null,
      }),
    });

    const account = await context("/account", true, undefined, accountModel);
    expect(account.auth).toMatchObject({
      passkeys: [{ id: "credential_never_used", lastUsedLabel: null }],
      methods: [
        { provider: "apple", label: "Apple" },
        { provider: "magic_link", label: "Email magic link" },
      ],
      grants: [{ id: "grant_0701", clientName: "Kitchen helper", scopes: ["journal:read", "journal:write"] }],
    });
    expect(account.messaging).toMatchObject({ kind: "linked", lastSeenLabel: null });

    const pendingModel = await WebViewModelService.create({
      service,
      store,
      authentication: new DeterministicTestAuthenticator(),
      hasher,
      random: new DeterministicRandomSource(),
      clock: new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      publicOrigin: new URL("https://journal.example.test"),
      installMetadataPath,
      resolvePrincipal: async () => principal,
      messagingStatus: async () => ({
        kind: "pending_confirmation",
        availableThrough: "2026-10-01T07:00:00.000Z",
        linkId: "lnk_0000000000000701",
        deviceId: "dev_0000000000000701",
        householdId,
        deviceName: "Kitchen Mac",
        confirmationExpiresAt: "2026-07-15T12:10:00.000Z",
      }),
    });
    const pending = await context("/account", true, undefined, pendingModel);
    expect(pending.messaging).toMatchObject({
      kind: "pending_confirmation",
      confirmationExpiresLabel: "Jul 15, 2026",
    });
  });

  it.each([
    ["l", false, "preview"],
    ["l", true, "authenticated"],
    ["r", false, "revoked"],
    ["j", false, "joined"],
    ["e", false, "expired"],
    ["m", false, "revoked"],
  ])("maps invitation token %s to %s state", async (tokenCharacter, authenticated, expectedState) => {
    const result = await context(`/invite/family/${tokenCharacter.repeat(43)}`, authenticated);
    expect(result.invite.state).toBe(expectedState);
  });

  it("maps inactive and minimally attributed collection shares without inventing details", async () => {
    expect((await context(`/c/${"x".repeat(43)}`)).collectionState).toBe("expired");

    const household = await store.getHousehold(householdId);
    if (household === null) throw new Error("household fixture missing");
    const revokedSnapshot = CollectionSnapshotSchema.parse({
      ...collectionSnapshot(household.repositoryHead),
      id: "snp_0000000000000704",
      collection_id: "col_0000000000000704",
      title: "Revoked picks",
    });
    await store.saveShare({
      id: ShareIdSchema.parse("shr_0000000000000704"),
      collectionId: revokedSnapshot.collection_id,
      householdId,
      tokenHash: hasher.hash("q".repeat(43)),
      snapshot: revokedSnapshot,
      expiresAt: "2026-08-15T12:00:00.000Z",
      revokedAt: "2026-07-15T12:00:00.000Z",
    });
    expect((await context(`/c/${"q".repeat(43)}`)).collectionState).toBe("revoked");

    const minimalSnapshot = CollectionSnapshotSchema.parse({
      ...collectionSnapshot(household.repositoryHead),
      id: "snp_0000000000000705",
      collection_id: "col_0000000000000705",
      title: "Unattributed picks",
      sharer_display_name: null,
      items: [{
        collection_item_id: "collection-item-0705",
        source_item_id: "itm_0000000000000705",
        kind: "snack",
        title: "House crackers",
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
        source_item_revision: household.repositoryHead,
      }],
    });
    await store.saveShare({
      id: ShareIdSchema.parse("shr_0000000000000705"),
      collectionId: minimalSnapshot.collection_id,
      householdId,
      tokenHash: hasher.hash("u".repeat(43)),
      snapshot: minimalSnapshot,
      expiresAt: "2026-08-15T12:00:00.000Z",
      revokedAt: null,
    });
    const minimal = await context(`/c/${"u".repeat(43)}`);
    expect(minimal.publicCollection).toMatchObject({
      sharedBy: "A Fullwell household",
      items: [{ source: "Shared collection" }],
    });
    expect(minimal.publicCollection.items[0]).not.toHaveProperty("imageUrl");
    expect(minimal.publicCollection.items[0]).not.toHaveProperty("note");
  });

  it("fails closed when browser mutations and journal browsing are not configured", async () => {
    const unconfigured = await WebViewModelService.create({
      service,
      store,
      authentication: new DeterministicTestAuthenticator(),
      hasher,
      random: new DeterministicRandomSource(),
      clock: new FixedClock(new Date("2026-07-15T12:00:00.000Z")),
      publicOrigin: new URL("https://journal.example.test"),
      installMetadataPath: resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json"),
    });
    const authenticated = await context("/households", true, undefined, unconfigured);
    expect(authenticated.viewer.displayName).toBe("Test Owner");
    expect((await context("/households", false, undefined, unconfigured)).viewer.displayName).toBe("");

    const app = Fastify();
    app.post("/household", async (request) => await unconfigured.createHousehold(request, {
      name: "Unavailable Kitchen",
      csrf: "c".repeat(32),
      idempotencyKey: "unconfigured-household-0701",
    }));
    app.get("/journal", async (request) => await unconfigured.journalItems(request, {
      householdId,
      section: "recipes",
    }));
    app.post("/meal-review", async (request) => await unconfigured.reviewMealConstraints(request, {
      householdId,
      week: "2026-07-13",
      constraintRevision: "a".repeat(40),
      csrf: "c".repeat(32),
      idempotencyKey: "unconfigured-review-0701",
    }));
    const responses = await Promise.all([
      app.inject({ method: "POST", url: "/household" }),
      app.inject({ method: "GET", url: "/journal" }),
      app.inject({ method: "POST", url: "/meal-review" }),
    ]);
    await app.close();
    expect(responses.map(({ statusCode }) => statusCode)).toEqual([500, 500, 500]);
    expect(responses.map(({ body }) => body).join(" ")).toContain("not configured");
  });

  it("builds an authorized seven-day week without collapsing same-slot proposals", async () => {
    const household = await store.getHousehold(householdId);
    if (household === null) throw new Error("household fixture missing");
    const constraints = await service.call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: household.repositoryHead,
      idempotency_key: "web-meal-constraints-0701",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-15T12:00:00.000Z",
      },
    }, principal);
    if (!constraints.ok) throw new Error(constraints.error.message);
    const constraintRevision = GitObjectIdSchema.parse(
      z.object({ constraint_revision: z.string() }).parse(constraints.data).constraint_revision,
    );
    const reviewed = await service.call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-13",
      constraint_revision: constraintRevision,
      idempotency_key: "web-meal-review-0701",
    }, principal);
    if (!reviewed.ok) throw new Error(reviewed.error.message);
    const reviewEventId = z.object({ event_id: z.string() }).parse(reviewed.data).event_id;
    const sharedInput = {
      household_id: householdId,
      week_start: "2026-07-13",
      meal_date: "2026-07-13",
      slot: { kind: "lunch" as const },
      servings: null,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence" as const,
      compatibility_caveat: "Confirm ingredients before serving.",
    };
    for (const [title, idempotencyKey] of [["Egg salad sandwich", "web-meal-egg-0701"], ["Pizza", "web-meal-pizza-0701"]] as const) {
      const result = await service.call("hfj_add_meal_proposal", {
        ...sharedInput,
        source: { kind: "freeform", title },
        idempotency_key: idempotencyKey,
      }, principal);
      if (!result.ok) throw new Error(result.error.message);
    }

    const result = await context(`/households/${householdId}/meal-plan?week=2026-07-13`, true);
    expect(result.mealPlan).toMatchObject({
      householdId,
      weekStart: "2026-07-13",
      constraintState: "reviewed",
      proposalCount: 2,
    });
    expect(result.mealPlan?.days).toHaveLength(7);
    const lunch = result.mealPlan?.days[0]?.slots.find(({ key }) => key === "lunch");
    expect(lunch?.proposals.map(({ title }) => title).sort()).toEqual(["Egg salad sandwich", "Pizza"]);
    expect(lunch?.proposals.every(({ canWithdraw }) => canWithdraw)).toBe(true);

    const anonymous = await context(`/households/${householdId}/meal-plan?week=2026-07-13`);
    expect(anonymous.mealPlan).toBeNull();
    const publicCollectionContext = await context(`/c/${"p".repeat(43)}`);
    expect(publicCollectionContext.mealPlan).toBeNull();
    expect(JSON.stringify(publicCollectionContext)).not.toContain("Confirm ingredients before serving.");
  });

  it("projects every meal source, custom slot, compatibility, attribution, and status variant", async () => {
    await addVisualJournalItems(store, householdId, 1);
    const household = await store.getHousehold(householdId);
    if (household === null) throw new Error("household fixture missing");
    const constraints = await service.call("hfj_update_meal_planning_constraints", {
      household_id: householdId,
      expected_head: household.repositoryHead,
      idempotency_key: "web-meal-variant-constraints-0701",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-15T12:00:00.000Z",
      },
    }, principal);
    if (!constraints.ok) throw new Error(constraints.error.message);
    const constraintRevision = GitObjectIdSchema.parse(
      z.object({ constraint_revision: z.string() }).parse(constraints.data).constraint_revision,
    );
    const reviewed = await service.call("hfj_review_meal_constraints", {
      household_id: householdId,
      week_start: "2026-07-13",
      constraint_revision: constraintRevision,
      idempotency_key: "web-meal-variant-review-0701",
    }, principal);
    if (!reviewed.ok) throw new Error(reviewed.error.message);
    const reviewEventId = z.object({ event_id: z.string() }).parse(reviewed.data).event_id;
    const projection = await store.projection(householdId);
    const recipeEntry = [...projection.items.values()].find(({ item }) => item.kind === "recipe");
    if (recipeEntry === undefined || recipeEntry.item.kind !== "recipe") throw new Error("recipe fixture missing");
    projection.items.set(recipeEntry.item.id, { item: recipeEntry.item, revision: constraintRevision });

    const shared = {
      household_id: householdId,
      week_start: "2026-07-13",
      meal_date: "2026-07-13",
      servings: 4,
      notes: "Serve promptly",
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility_caveat: "Verify the current recipe and package labels before serving.",
    };
    const sourceInputs = [
      {
        ...shared,
        slot: { kind: "custom" as const, label: "!!!" },
        source: { kind: "freeform" as const, title: "Late supper" },
        compatibility: "appears_compatible" as const,
        idempotency_key: "web-meal-variant-custom-0701",
      },
      {
        ...shared,
        slot: { kind: "dinner" as const },
        source: {
          kind: "external_recipe" as const,
          title: "Summer soup",
          canonical_url: "https://recipes.example.test/summer-soup",
          site_name: "Recipes Example",
          discovered_at: "2026-07-15T12:00:00.000Z",
        },
        compatibility: "appears_compatible" as const,
        idempotency_key: "web-meal-variant-external-0701",
      },
    ];
    for (const input of sourceInputs) {
      const result = await service.call("hfj_add_meal_proposal", input, principal);
      if (!result.ok) throw new Error(result.error.message);
    }

    const journalProposal = MealProposalSchema.parse({
      id: "mlp_0000000000000797",
      week_start: "2026-07-13",
      meal_date: "2026-07-13",
      slot: { kind: "lunch" },
      proposed_by: principal.actorId,
      source: {
        kind: "journal_recipe",
        item_id: recipeEntry.item.id,
        item_revision: constraintRevision,
        liked_evidence_ids: ["evd_0000000000000701"],
      },
      servings: 4,
      notes: "Serve promptly",
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Verify the current recipe and package labels before serving.",
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    });
    const fallbackJournal = MealProposalSchema.parse({
      id: "mlp_0000000000000798",
      week_start: "2026-07-13",
      meal_date: "2026-07-13",
      slot: { kind: "snack" },
      proposed_by: "act_0000000000000798",
      source: {
        kind: "journal_recipe",
        item_id: "itm_0000000000000798",
        item_revision: constraintRevision,
        liked_evidence_ids: ["evd_0000000000000798"],
      },
      servings: null,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "appears_compatible",
      compatibility_caveat: "The source recipe is no longer projected.",
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    });
    const localProposal = MealProposalSchema.parse({
      id: "mlp_0000000000000799",
      week_start: "2026-07-13",
      meal_date: "2026-07-13",
      slot: { kind: "breakfast" },
      proposed_by: { kind: "local", label: "Guest cook" },
      source: { kind: "freeform", title: "Local oatmeal" },
      servings: null,
      notes: null,
      constraint_revision: 0,
      constraint_review_event_id: reviewEventId,
      compatibility: "appears_compatible",
      compatibility_caveat: "Confirm this locally proposed meal.",
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    });
    const historyDelivery = JournalItemSchema.parse({
      id: "itm_0000000000000795",
      kind: "delivery_dish",
      dish_name: "Wintermelon boba",
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example.test",
      restaurant_name: "Wanpo",
      public_location_label: "Palo Alto",
      public_merchant_address: { locality: "Palo Alto", region: "CA" },
      merchant_locator: "private-merchant-0795",
      known_menu_item_locators: ["private-menu-0795"],
      known_modifier_occurrences: [{
        evidence_id: "evd_0000000000000795",
        modifiers_complete: true,
        modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
      }],
      classification: { kind: "food", authored_by: "agent" },
      evidence_ids: ["evd_0000000000000795"],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      body_markdown: "",
    });
    const importedDelivery = JournalItemSchema.parse({
      id: "itm_0000000000000796",
      kind: "delivery_dish",
      delivery_authority: "public_import",
      dish_name: "Wintermelon boba",
      restaurant_name: "Wanpo",
      public_location_label: "Cupertino",
      public_merchant_address: { locality: "Cupertino", region: "CA" },
      image_url: null,
      image_page_url: null,
      source_display_attribution: "Kitchen Friend",
      classification: { kind: "food", authored_by: "agent" },
      import_provenance: {
        source_collection_id: "col_0000000000000796",
        source_snapshot_id: "snp_0000000000000796",
        source_collection_item_id: "collection-item-0796",
        published_revision: constraintRevision,
        source_display_attribution: "Kitchen Friend",
        imported_at: "2026-07-15T12:00:00.000Z",
      },
      evidence_ids: ["evd_0000000000000796"],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      body_markdown: "",
    });
    projection.items.set(historyDelivery.id, { item: historyDelivery, revision: constraintRevision });
    projection.items.set(importedDelivery.id, { item: importedDelivery, revision: constraintRevision });
    const deliveryProposals = [historyDelivery, importedDelivery].map((item, index) => MealProposalSchema.parse({
      id: `mlp_000000000000079${index + 5}`,
      week_start: "2026-07-13",
      meal_date: "2026-07-14",
      slot: { kind: "dinner" },
      proposed_by: principal.actorId,
      source: {
        kind: "journal_delivery_dish",
        item_id: item.id,
        item_revision: constraintRevision,
        evidence_ids: item.evidence_ids,
      },
      servings: 2,
      notes: null,
      constraint_revision: constraintRevision,
      constraint_review_event_id: reviewEventId,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients and cross-contact details are not known.",
      created_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
    }));
    projection.mealProposals.set(journalProposal.id, { proposal: journalProposal, revision: constraintRevision });
    projection.mealProposals.set(fallbackJournal.id, { proposal: fallbackJournal, revision: constraintRevision });
    projection.mealProposals.set(localProposal.id, { proposal: localProposal, revision: constraintRevision });
    for (const proposal of deliveryProposals) {
      projection.mealProposals.set(proposal.id, { proposal, revision: constraintRevision });
    }

    const result = await context(`/households/${householdId}/meal-plan`, true);
    expect(result.mealPlan).toMatchObject({
      weekStart: "2026-07-13",
      constraintState: "reviewed",
      proposalCount: 7,
    });
    const proposals = result.mealPlan?.days.flatMap(({ slots }) => slots.flatMap(({ proposals: slotProposals }) => slotProposals)) ?? [];
    expect(proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Late supper", compatibilityLabel: "Appears compatible" }),
      expect.objectContaining({ title: "Summer soup", sourceDetail: "Recipes Example", sourceHref: "https://recipes.example.test/summer-soup" }),
      expect.objectContaining({ title: "Recipe 01", sourceDetail: "Liked recipe from your journal", compatibilityLabel: "Compatibility evidence is incomplete" }),
      expect.objectContaining({ title: "Journal recipe", proposedBy: "Household member" }),
      expect.objectContaining({ title: "Local oatmeal", proposedBy: "Guest cook", needsRecheck: true }),
      expect.objectContaining({
        title: "Wintermelon boba",
        sourceDetail: "Ordered before",
        deliveryContext: {
          authority: "history",
          providerLabel: "DoorDash",
          restaurantName: "Wanpo",
          locationLabel: "Palo Alto",
          familiarityBasis: "Ordered before",
        },
      }),
      expect.objectContaining({
        title: "Wintermelon boba",
        sourceDetail: "Shared dish",
        deliveryContext: {
          authority: "public_import",
          providerLabel: null,
          restaurantName: "Wanpo",
          locationLabel: "Cupertino",
          familiarityBasis: "Shared dish",
        },
      }),
    ]));
    expect(JSON.stringify(result.mealPlan)).not.toMatch(/private-merchant|private-menu|Half sweet/);
    expect(result.mealPlan?.days[0]?.slots.some(({ id, key }) => key === "custom:!!!" && id.endsWith("-custom-4"))).toBe(true);

    for (const [changed, message] of [
      ["proposal-added", "Meal idea added to the selected date and slot."],
      ["proposal-withdrawn", "Meal idea withdrawn; its slot is updated."],
      ["constraints-reviewed", "Household constraints reviewed for this week."],
    ] as const) {
      const changedContext = await context(`/households/${householdId}/meal-plan?week=2026-07-13&changed=${changed}`, true);
      expect(changedContext.mealPlan?.statusMessage).toBe(message);
    }
    const crossMonth = await context(`/households/${householdId}/meal-plan?week=2026-07-27`, true);
    expect(crossMonth.mealPlan?.weekLabel).toBe("July 27–August 2");

    const membership = (await store.listMemberships(principal.userId))[0]?.membership;
    if (membership === undefined) throw new Error("owner membership missing");
    await store.upsertMembership({ ...membership, role: "editor" });
    const editor = await context(`/households/${householdId}/meal-plan?week=2026-07-13`, true);
    const editorProposals = editor.mealPlan?.days.flatMap(({ slots }) => slots.flatMap(({ proposals: slotProposals }) => slotProposals)) ?? [];
    expect(editorProposals.find(({ id }) => id === fallbackJournal.id)?.canWithdraw).toBe(false);
    expect(editorProposals.some(({ canWithdraw }) => canWithdraw)).toBe(true);
  });

  it("projects deterministic bounded recipe and grocery pages without leaking them publicly", async () => {
    await addVisualJournalItems(store, householdId, 14);
    await addDeliveryVisualExclusionFixture(store, householdId);
    const recipes = await context(`/households/${householdId}/recipes`, true);
    expect(recipes.visualJournal).toMatchObject({
      householdId,
      section: "recipes",
      total: 14,
      nextCursor: "v1_12",
    });
    expect(recipes.visualJournal?.items).toHaveLength(12);
    expect(recipes.visualJournal?.items[0]).toMatchObject({ kind: "recipe", title: "Recipe 01" });

    const recipesWithoutJavaScript = await context(`/households/${householdId}/recipes?page=2`, true);
    expect(recipesWithoutJavaScript.visualJournal?.items).toHaveLength(14);
    expect(recipesWithoutJavaScript.visualJournal?.nextCursor).toBeNull();

    const groceries = await context(`/households/${householdId}/groceries`, true);
    expect(groceries.visualJournal).toMatchObject({
      householdId,
      section: "groceries",
      total: 14,
      nextCursor: "v1_12",
    });
    expect(groceries.visualJournal?.items[0]).toMatchObject({ kind: "grocery", title: "Grocery 01" });
    const takeout = await context(`/households/${householdId}/takeout`, true);
    expect(takeout.visualJournal).toMatchObject({
      householdId,
      section: "takeout",
      total: 2,
      items: [
        {
          kind: "takeout",
          title: "Coconut boba",
          restaurantName: "Wanpo",
          locationLabel: "Cupertino",
          provenance: "shared_dish",
        },
        {
          kind: "takeout",
          title: "Wintermelon boba",
          restaurantName: "Wanpo",
          locationLabel: "Palo Alto",
          providerLabel: "DoorDash",
          provenance: "ordered_before",
          occurrenceCount: 1,
          modifierSummary: "Sweetness: Half sweet",
          imageUrl: "https://images.example.test/wintermelon.jpg",
          imagePageUrl: "https://delivery.example.test/menu/wintermelon",
        },
      ],
    });
    expect(JSON.stringify(recipes.visualJournal)).not.toContain("private-delivery");
    expect(JSON.stringify(groceries.visualJournal)).not.toContain("private-delivery");
    expect(JSON.stringify(takeout.visualJournal)).not.toContain("private-delivery");

    const app = Fastify();
    app.get("/batch", async (request) => await viewModels.journalItems(request, {
      householdId,
      section: "recipes",
      cursor: "v1_12",
    }));
    const batch = await app.inject({ method: "GET", url: "/batch", headers: { authorization: "Bearer test-owner-token" } });
    await app.close();
    expect(batch.statusCode).toBe(200);
    expect(batch.json()).toMatchObject({
      householdId,
      section: "recipes",
      total: 14,
      nextCursor: null,
      items: [{ title: "Recipe 13" }, { title: "Recipe 14" }],
    });

    const anonymous = await context(`/households/${householdId}/recipes`);
    expect(anonymous.visualJournal).toBeNull();
    expect(JSON.stringify(anonymous)).not.toContain("Recipe 01");
    const publicCollectionContext = await context(`/c/${"p".repeat(43)}`);
    expect(publicCollectionContext.visualJournal).toBeNull();
    expect(JSON.stringify(publicCollectionContext)).not.toContain("Grocery 01");
  });

  it("excludes delivery dishes from legacy household grocery totals", async () => {
    await addVisualJournalItems(store, householdId, 1);
    await addDeliveryVisualExclusionFixture(store, householdId);

    const result = await context(`/households/${householdId}/groceries`, true);

    expect(result.households[0]).toMatchObject({ recipes: 1, groceries: 1, takeout: 2 });
  });
});

async function addVisualJournalItems(store: MemoryOperationalStore, householdId: HouseholdId, count: number): Promise<void> {
  const household = await store.getHousehold(householdId);
  if (household === null) throw new Error("household fixture missing");
  const projection = await store.projection(householdId);
  for (let index = 1; index <= count; index += 1) {
    const suffix = index.toString().padStart(16, "0");
    const shared = {
      id: `itm_${suffix}`,
      evidence_ids: [`evd_${suffix}`],
      created_at: "2026-07-15T12:00:00.000Z",
      updated_at: "2026-07-15T12:00:00.000Z",
      schema_version: 1,
      body_markdown: "",
    };
    const recipe = JournalItemSchema.parse({
      ...shared,
      kind: "recipe",
      title: `Recipe ${index.toString().padStart(2, "0")}`,
      canonical_url: `https://recipes.example.test/${index}`,
      audited_page_url: `https://recipes.example.test/${index}`,
      author_or_publisher: index % 2 === 0 ? "Recipe Publisher" : null,
      saved: index % 2 === 0 ? "yes" : "unknown",
      cooked: index % 3 === 0 ? "yes" : "no",
      liked: index % 4 === 0 ? "yes" : "unknown",
      last_cooked: index % 3 === 0 ? "2026-07-01" : null,
      date_precision: index % 3 === 0 ? "day" : "unknown",
      image_url: index % 5 === 0 ? null : `https://images.example.test/recipe-${index}.jpg`,
      image_page_url: index % 5 === 0 ? null : `https://recipes.example.test/${index}`,
    });
    projection.items.set(recipe.id, { item: recipe, revision: household.repositoryHead });

    const grocerySuffix = (index + 100).toString().padStart(16, "0");
    const grocery = JournalItemSchema.parse({
      ...shared,
      id: `itm_${grocerySuffix}`,
      evidence_ids: [`evd_${grocerySuffix}`],
      kind: index % 2 === 0 ? "ingredient" : "snack",
      display_name: `Grocery ${index.toString().padStart(2, "0")}`,
      brand: index % 2 === 0 ? "Market" : null,
      product_line: null,
      flavor: index % 2 === 0 ? "Fresh" : null,
      formulation: null,
      format: null,
      category: index % 2 === 0 ? "produce" : "snack",
      produce_variety: null,
      known_size_variants: index % 2 === 0 ? ["1 lb"] : [],
      image_url: index % 4 === 0 ? null : `https://images.example.test/grocery-${index}.jpg`,
      image_page_url: index % 4 === 0 ? null : `https://groceries.example.test/${index}`,
    });
    projection.items.set(grocery.id, { item: grocery, revision: household.repositoryHead });
  }
}

async function addDeliveryVisualExclusionFixture(
  store: MemoryOperationalStore,
  householdId: HouseholdId,
): Promise<void> {
  const household = await store.getHousehold(householdId);
  if (household === null) throw new Error("household fixture missing");
  const item = JournalItemSchema.parse({
    id: "itm_0000000000000799",
    kind: "delivery_dish",
    dish_name: "Wintermelon boba",
    provider_label: "DoorDash",
    provider_origin: "https://delivery.example.test",
    restaurant_name: "Wanpo",
    public_location_label: "Palo Alto",
    public_merchant_address: { locality: "Palo Alto", region: "CA" },
    image_url: "https://images.example.test/wintermelon.jpg",
    image_page_url: "https://delivery.example.test/menu/wintermelon",
    merchant_locator: "private-delivery-merchant",
    known_menu_item_locators: ["private-delivery-menu"],
    known_modifier_occurrences: [{
      evidence_id: "evd_0000000000000799",
      modifiers_complete: true,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
    }],
    classification: { kind: "food", authored_by: "agent" },
    evidence_ids: ["evd_0000000000000799"],
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  });
  const evidence = DeliveryOrderLineEvidenceSchema.parse({
    id: "evd_0000000000000799",
    kind: "delivery_order_line",
    observed_at: "2026-07-15T12:00:00.000Z",
    evidence_date: "2026-07-14",
    date_precision: "day",
    source_type: "delivery_provider",
    source_label: "DoorDash",
    stable_locator: "delivery/private-delivery-order",
    summary: "Wintermelon boba",
    actor_id: "act_0000000000000799",
    limitations: [],
    schema_version: 1,
    delivery_order_line: {
      provider_label: "DoorDash",
      provider_origin: "https://delivery.example.test",
      provider_order_locator: "private-delivery-order",
      order_group_locator: "private-delivery-group",
      order_date: "2026-07-14",
      completion_status: "completed",
      fulfillment_mode: "delivery",
      group_complete: true,
      declared_line_count: 1,
      line_key: "wintermelon-boba",
      restaurant: {
        restaurant_name: "Wanpo",
        public_location_label: "Palo Alto",
        public_merchant_address: { locality: "Palo Alto", region: "CA" },
        merchant_locator: "private-delivery-merchant",
      },
      dish_name: "Wintermelon boba",
      quantity: 1,
      modifiers_complete: true,
      modifiers: [{ group_name: "Sweetness", option_name: "Half sweet" }],
      historical_menu_item_locator: "private-delivery-menu",
      classification: { kind: "food", authored_by: "agent" },
    },
  });
  const imported = JournalItemSchema.parse({
    id: "itm_0000000000000800",
    kind: "delivery_dish",
    delivery_authority: "public_import",
    dish_name: "Coconut boba",
    restaurant_name: "Wanpo",
    public_location_label: "Cupertino",
    public_merchant_address: { locality: "Cupertino", region: "CA" },
    image_url: null,
    image_page_url: null,
    source_display_attribution: "Family favorites",
    classification: { kind: "food", authored_by: "agent" },
    import_provenance: {
      source_collection_id: "col_0000000000000800",
      source_snapshot_id: "snp_0000000000000800",
      source_collection_item_id: "collection-item-0800",
      published_revision: household.repositoryHead,
      source_display_attribution: "Family favorites",
      imported_at: "2026-07-15T12:00:00.000Z",
    },
    evidence_ids: ["evd_0000000000000800"],
    created_at: "2026-07-15T12:00:00.000Z",
    updated_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    body_markdown: "",
  });
  const projection = await store.projection(householdId);
  projection.evidence.set(evidence.id, evidence);
  projection.items.set(item.id, {
    item,
    revision: household.repositoryHead,
  });
  projection.items.set(imported.id, {
    item: imported,
    revision: household.repositoryHead,
  });
}

function collectionSnapshot(head: string) {
  return CollectionSnapshotSchema.parse({
    id: "snp_0000000000000701",
    collection_id: "col_0000000000000701",
    title: "Public picks",
    sharer_display_name: "Kitchen Owner",
    created_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    items: [
      {
        collection_item_id: "collection-item-0701", source_item_id: "itm_0000000000000701", kind: "snack", title: "Apple",
        public_description: "Crisp fruit", brand: "Market", flavor: null, formulation: null, format: "fresh", author_or_publisher: null,
        canonical_recipe_url: null, image_url: "https://example.test/apple.jpg", image_page_url: null, preparation_notes: null,
        source_display_attribution: null, source_item_revision: GitObjectIdSchema.parse(head),
      },
      {
        collection_item_id: "collection-item-delivery-0701",
        kind: "delivery_dish",
        title: "Canned citrus spritz",
        restaurant_name: "Corner Table",
        public_location_label: "University Avenue",
        public_merchant_address: {
          locality: "Palo Alto",
          region: "CA",
          country: "United States",
        },
        public_description: "A bright canned spritz.",
        public_note: null,
        image_url: null,
        image_page_url: "https://example.test/spritz",
        source_display_attribution: "Shared collection",
        source_item_revision: GitObjectIdSchema.parse(head),
        classification: "alcohol",
      },
    ],
  });
}

async function saveInvitations(store: MemoryOperationalStore, hasher: HmacTokenHasher, householdId: HouseholdId): Promise<void> {
  const fixtures = [
    { character: "l", id: "inv_0000000000000701", role: "editor" as const, expiresAt: "2026-08-15T12:00:00.000Z", revokedAt: null, acceptedAt: null },
    { character: "r", id: "inv_0000000000000702", role: "viewer" as const, expiresAt: "2026-08-15T12:00:00.000Z", revokedAt: "2026-07-15T12:00:00.000Z", acceptedAt: null },
    { character: "j", id: "inv_0000000000000703", role: "editor" as const, expiresAt: "2026-08-15T12:00:00.000Z", revokedAt: null, acceptedAt: "2026-07-15T12:00:00.000Z" },
    { character: "e", id: "inv_0000000000000704", role: "viewer" as const, expiresAt: "2020-01-01T00:00:00.000Z", revokedAt: null, acceptedAt: null },
  ];
  for (const fixture of fixtures) {
    await store.saveInvitation({
      id: InvitationIdSchema.parse(fixture.id), householdId, tokenHash: hasher.hash(fixture.character.repeat(43)), role: fixture.role,
      expiresAt: fixture.expiresAt, intendedEmailHint: null, acceptedAt: fixture.acceptedAt, revokedAt: fixture.revokedAt,
    });
  }
}
