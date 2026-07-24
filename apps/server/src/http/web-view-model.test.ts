import { resolve } from "node:path";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { z } from "zod";
import {
  CollectionSnapshotSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
  JournalItemSchema,
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

  async function context(path: string, authenticated = false, csrfCookie?: string) {
    const app = Fastify();
    await app.register(cookie);
    app.get("/*", async (request) => viewModels.contextFor(request));
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
      households: z.array(z.object({ name: z.string(), members: z.number(), recipes: z.number(), groceries: z.number() }).passthrough()),
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
        section: z.enum(["recipes", "groceries"]),
        total: z.number(),
        items: z.array(z.object({ id: z.string(), kind: z.enum(["recipe", "grocery"]), title: z.string() }).passthrough()),
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
    expect(anonymous.install.hosts.claude.command).toContain("claude plugin install fullwell@fullwell");

    const authenticated = await context(`/households/${householdId}/members`, true, "c".repeat(32));
    expect(authenticated.viewer.displayName).toBe("Test Owner");
    expect(authenticated.households[0]).toMatchObject({ name: "View Model Kitchen", members: 1, recipes: 0, groceries: 0 });
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

    const unavailable = await context(`/c/${"m".repeat(43)}`);
    expect(unavailable.collectionState).toBe("unavailable");
    expect(unavailable.publicCollection.token).toBe("m".repeat(43));
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

  it("projects deterministic bounded recipe and grocery pages without leaking them publicly", async () => {
    await addVisualJournalItems(store, householdId, 14);
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

function collectionSnapshot(head: string) {
  return CollectionSnapshotSchema.parse({
    id: "snp_0000000000000701",
    collection_id: "col_0000000000000701",
    title: "Public picks",
    sharer_display_name: "Kitchen Owner",
    created_at: "2026-07-15T12:00:00.000Z",
    schema_version: 1,
    items: [{
      collection_item_id: "collection-item-0701", source_item_id: "itm_0000000000000701", kind: "snack", title: "Apple",
      public_description: "Crisp fruit", brand: "Market", flavor: null, formulation: null, format: "fresh", author_or_publisher: null,
      canonical_recipe_url: null, image_url: "https://example.test/apple.jpg", image_page_url: null, preparation_notes: null,
      source_display_attribution: null, source_item_revision: GitObjectIdSchema.parse(head),
    }],
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
