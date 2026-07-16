import { resolve } from "node:path";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { z } from "zod";
import {
  CollectionSnapshotSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  InvitationIdSchema,
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

  beforeEach(async () => {
    store = new MemoryOperationalStore();
    hasher = new HmacTokenHasher("web-view-model-test-pepper");
    const authentication = new DeterministicTestAuthenticator();
    principal = await authentication.authenticate("Bearer test-owner-token");
    const service = new HouseholdFoodJournalService(
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
      publicOrigin: new URL("https://journal.example.test"),
      installMetadataPath: resolve(import.meta.dirname, "../../../../packages/agent-client/install-metadata.json"),
      resolvePrincipal: async (request) => request.headers.authorization === undefined ? null : principal,
      verifyCsrf: async (_request, submittedToken) => {
        if (submittedToken !== "c".repeat(32)) throw new Error("invalid CSRF fixture");
      },
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
      households: z.array(z.object({ name: z.string(), members: z.number(), recipes: z.number(), snacks: z.number() }).passthrough()),
      members: z.array(z.object({ name: z.string(), isCurrentUser: z.boolean().optional() }).passthrough()),
      collections: z.array(z.object({ status: z.string() }).passthrough()),
      publicCollection: z.object({ token: z.string(), title: z.string(), sharedBy: z.string(), items: z.array(z.object({ source: z.string(), note: z.string().optional(), imageAlt: z.string().optional() }).passthrough()) }).passthrough(),
      invite: z.object({ state: z.string() }).passthrough(),
      collectionState: z.string(),
      security: z.object({ csrfToken: z.string() }).passthrough(),
      install: z.object({ hosts: z.object({ codex: z.object({ label: z.string() }).passthrough() }).passthrough() }).passthrough(),
    }).passthrough().parse(responseBody);
  }

  it("builds anonymous, authenticated household, and collection contexts", async () => {
    const anonymous = await context("/install");
    expect(anonymous.viewer.displayName).toBe("");
    expect(anonymous.households).toEqual([]);
    expect(anonymous.security.csrfToken).toHaveLength(32);
    expect(anonymous.install.hosts.codex.label).toBe("Codex");

    const authenticated = await context(`/households/${householdId}/members`, true, "c".repeat(32));
    expect(authenticated.viewer.displayName).toBe("Test Owner");
    expect(authenticated.households[0]).toMatchObject({ name: "View Model Kitchen", members: 1, recipes: 0, snacks: 0 });
    expect(authenticated.members[0]).toMatchObject({ name: "Test Owner", isCurrentUser: true });
    expect(authenticated.security.csrfToken).toBe("c".repeat(32));

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
});

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
