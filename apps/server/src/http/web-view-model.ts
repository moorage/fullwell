import { readFile } from "node:fs/promises";
import type { FastifyRequest } from "fastify";
import { CollectionSnapshotSchema, HouseholdIdSchema } from "@hfj/contracts";
import type { WebRenderContext } from "@hfj/web/types";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { AuthenticationPort, OperationalStorePort, RandomSource, TokenHasher } from "../core/ports.js";
import type { HouseholdRecord, MembershipRecord, Principal } from "../core/types.js";
import type { PasskeyCredential } from "../auth/types.js";
import type { IdentityMethodProvider } from "../auth/types.js";
import type { OAuthGrantSummary } from "../oauth/types.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import type { WebCreateHouseholdInput, WebImportInput } from "./web.js";

const InstallMetadataSchema = z.object({
  release: z.string().min(1),
  platforms: z.object({
    codex: z.object({ label: z.string(), primary_action: z.string(), fallback_commands: z.array(z.string()).min(1) }),
    claude: z.object({ label: z.string(), primary_action: z.string(), fallback_commands: z.array(z.string()).min(1) }),
  }),
});

const PreviewDataSchema = z.object({ snapshot: CollectionSnapshotSchema, expires_at: z.iso.datetime({ offset: true }) });
const ImportPlanDataSchema = z.object({ items: z.array(z.object({
  collection_item_id: z.string(), exact_duplicates: z.array(z.string()), possible_duplicates: z.array(z.string()), requires_resolution: z.boolean(),
})) });

export class WebViewModelService {
  private constructor(
    private readonly service: HouseholdFoodJournalService,
    private readonly store: OperationalStorePort,
    private readonly authentication: AuthenticationPort,
    private readonly hasher: TokenHasher,
    private readonly random: RandomSource,
    private readonly publicOrigin: URL,
    private readonly install: z.infer<typeof InstallMetadataSchema>,
    private readonly resolvePrincipal: ((request: FastifyRequest) => Promise<Principal | null>) | undefined,
    private readonly verifyCsrf: ((request: FastifyRequest, submittedToken: string) => Promise<void>) | undefined,
    private readonly listPasskeys: ((userId: Principal["userId"]) => Promise<readonly PasskeyCredential[]>) | undefined,
    private readonly accountSummary: ((userId: Principal["userId"]) => Promise<{ readonly methods: readonly IdentityMethodProvider[]; readonly grants: readonly OAuthGrantSummary[] }>) | undefined,
  ) {}

  static async create(options: {
    service: HouseholdFoodJournalService;
    store: OperationalStorePort;
    authentication: AuthenticationPort;
    hasher: TokenHasher;
    random: RandomSource;
    publicOrigin: URL;
    installMetadataPath: string;
    resolvePrincipal?: (request: FastifyRequest) => Promise<Principal | null>;
    verifyCsrf?: (request: FastifyRequest, submittedToken: string) => Promise<void>;
    listPasskeys?: (userId: Principal["userId"]) => Promise<readonly PasskeyCredential[]>;
    accountSummary?: (userId: Principal["userId"]) => Promise<{ readonly methods: readonly IdentityMethodProvider[]; readonly grants: readonly OAuthGrantSummary[] }>;
  }): Promise<WebViewModelService> {
    const metadata = InstallMetadataSchema.parse(JSON.parse(await readFile(options.installMetadataPath, "utf8")));
    return new WebViewModelService(
      options.service,
      options.store,
      options.authentication,
      options.hasher,
      options.random,
      options.publicOrigin,
      metadata,
      options.resolvePrincipal,
      options.verifyCsrf,
      options.listPasskeys,
      options.accountSummary,
    );
  }

  async createHousehold(request: FastifyRequest, input: WebCreateHouseholdInput): Promise<{ householdId: string }> {
    if (this.resolvePrincipal === undefined || this.verifyCsrf === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Browser household creation is not configured");
    const principal = await this.resolvePrincipal(request);
    if (principal === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    await this.verifyCsrf(request, input.csrf);
    const created = await this.service.call("hfj_create_household", {
      name: input.name,
      idempotency_key: input.idempotencyKey,
    }, principal);
    if (!created.ok) throw new AppError(created.error.code, created.error.message);
    return { householdId: z.object({ household_id: HouseholdIdSchema }).parse(created.data).household_id };
  }

  async importCollection(request: FastifyRequest, input: WebImportInput): Promise<{ householdId: string }> {
    if (this.resolvePrincipal === undefined || this.verifyCsrf === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Browser import is not configured");
    const principal = await this.resolvePrincipal(request);
    if (principal === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    await this.verifyCsrf(request, input.csrf);
    const householdId = HouseholdIdSchema.parse(input.householdId);
    const household = await this.store.getHousehold(householdId);
    if (household === null) throw new AppError("NOT_FOUND", "Destination household was not found");
    const planned = await this.service.call("hfj_plan_collection_import", {
      token: input.token,
      destination_household_id: householdId,
      selected_collection_item_ids: input.itemIds,
    }, principal);
    if (!planned.ok) throw new AppError(planned.error.code, planned.error.message);
    const plan = ImportPlanDataSchema.parse(planned.data);
    if (plan.items.some(({ requires_resolution }) => requires_resolution)) {
      throw new AppError("REVISION_CONFLICT", "A possible duplicate needs review in your agent before import");
    }
    const selections = plan.items.map((item) => ({
      collection_item_id: item.collection_item_id,
      resolution: item.exact_duplicates.length > 0 ? { action: "skip" as const } : { action: "create_separate" as const },
    }));
    const imported = await this.service.call("hfj_import_collection_items", {
      token: input.token,
      household_id: householdId,
      expected_head: household.repositoryHead,
      idempotency_key: input.idempotencyKey,
      selections,
    }, principal);
    if (!imported.ok) throw new AppError(imported.error.code, imported.error.message);
    return { householdId };
  }

  async contextFor(request: FastifyRequest): Promise<WebRenderContext> {
    const requestUrl = new URL(request.url, this.publicOrigin);
    const pathname = requestUrl.pathname;
    const principal = this.resolvePrincipal === undefined
      ? await this.optionalPrincipal(request.headers.authorization)
      : await this.resolvePrincipal(request);
    const memberships = principal === null ? [] : await this.store.listMemberships(principal.userId);
    const households = await this.householdsFor(memberships);
    const householdPathId = /^\/households\/([^/]+)/.exec(pathname)?.[1];
    const selectedMembership = householdPathId === undefined ? undefined : memberships.find(({ household }) => household.id === householdPathId);
    const collectionToken = /^\/c\/([^/]+)/.exec(pathname)?.[1];
    const invitationToken = /^\/invite\/family\/([^/]+)$/.exec(pathname)?.[1];
    const collection = collectionToken === undefined
      ? { state: "unavailable" as const, model: emptyCollection("") }
      : await this.collectionFor(collectionToken);
    const invite = invitationToken === undefined ? defaultInvite() : await this.inviteFor(invitationToken, principal !== null);
    const csrfToken = request.cookies.hfj_csrf === undefined ? this.random.token(24) : z.string().min(16).max(512).parse(request.cookies.hfj_csrf);
    const passkeys = principal === null || pathname !== "/account" || this.listPasskeys === undefined
      ? []
      : await this.listPasskeys(principal.userId);
    const account = principal === null || pathname !== "/account" || this.accountSummary === undefined
      ? { methods: [], grants: [] }
      : await this.accountSummary(principal.userId);

    return {
      security: { csrfToken, idempotencyPrefix: this.random.opaqueId("web") },
      canonicalUrl: this.publicOrigin.toString(),
      install: { hosts: {
        codex: { label: hostName(this.install.platforms.codex.label), command: this.install.platforms.codex.fallback_commands.join(" && "), next: this.install.platforms.codex.primary_action },
        claude: { label: hostName(this.install.platforms.claude.label), command: this.install.platforms.claude.fallback_commands.join(" && "), next: this.install.platforms.claude.primary_action },
      } },
      auth: {
        passkeysEnabled: this.listPasskeys !== undefined,
        passkeys: passkeys.map((credential) => ({
          id: credential.credentialId,
          name: credential.name,
          createdLabel: formatDate(credential.createdAt),
          lastUsedLabel: credential.lastUsedAt === null ? null : formatDate(credential.lastUsedAt),
        })),
        methods: account.methods.map((provider) => ({ provider, label: provider === "apple" ? "Apple" : "Email magic link" })),
        grants: account.grants.map((grant) => ({ id: grant.id, clientName: grant.clientName, scopes: [...grant.scopes] })),
      },
      viewer: { displayName: principal?.displayName ?? "", email: "" },
      households,
      members: selectedMembership === undefined || principal === null ? [] : await this.membersFor(selectedMembership.household, principal),
      collections: selectedMembership === undefined ? [] : await this.collectionsFor(selectedMembership.household),
      publicCollection: collection.model,
      invite,
      collectionState: collection.state,
      emailSent: requestUrl.searchParams.get("emailSent") === "1",
    };
  }

  private async optionalPrincipal(authorization: string | undefined): Promise<Principal | null> {
    if (authorization === undefined) return null;
    return await this.authentication.authenticate(authorization);
  }

  private async householdsFor(memberships: ReadonlyArray<{ household: HouseholdRecord; membership: MembershipRecord }>): Promise<WebRenderContext["households"]> {
    return await Promise.all(memberships.map(async ({ household, membership }) => {
      const projection = await this.store.projection(household.id);
      const values = [...projection.items.values()];
      return {
        id: household.id,
        name: household.name,
        role: membership.role,
        members: (await this.store.listHouseholdMemberships(household.id)).length,
        recipes: values.filter(({ item }) => item.kind === "recipe").length,
        snacks: values.filter(({ item }) => item.kind === "snack").length,
        updatedLabel: "Repository synchronized",
      };
    }));
  }

  private async membersFor(household: HouseholdRecord, principal: Principal): Promise<WebRenderContext["members"]> {
    const memberships = await this.store.listHouseholdMemberships(household.id);
    return memberships.map((membership, index) => ({
      id: membership.actorId,
      name: membership.userId === principal.userId ? principal.displayName : `Household member ${index + 1}`,
      detail: membership.role,
      role: membership.role,
      isCurrentUser: membership.userId === principal.userId,
    }));
  }

  private async collectionsFor(household: HouseholdRecord): Promise<WebRenderContext["collections"]> {
    const projection = await this.store.projection(household.id);
    return await Promise.all([...projection.collections.values()].map(async ({ snapshot }) => {
      const share = await this.store.getShareByCollection(household.id, snapshot.collection_id);
      const expired = share !== null && (share.revokedAt !== null || Date.parse(share.expiresAt) <= Date.now());
      return {
        id: snapshot.collection_id,
        title: snapshot.title,
        itemCount: snapshot.items.length,
        status: share === null ? "private" as const : expired ? "expired" as const : "published" as const,
        detail: share === null ? "Private snapshot" : expired ? "Link inactive" : `Link available through ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(share.expiresAt))}`,
      };
    }));
  }

  private async collectionFor(token: string): Promise<{ state: WebRenderContext["collectionState"]; model: WebRenderContext["publicCollection"] }> {
    const envelope = await this.service.preview(token);
    if (!envelope.ok) {
      const state = envelope.error.code === "SHARE_EXPIRED" ? "expired" : envelope.error.code === "SHARE_REVOKED" ? "revoked" : "unavailable";
      return { state, model: emptyCollection(token) };
    }
    const { snapshot, expires_at: expiresAt } = PreviewDataSchema.parse(envelope.data);
    return {
      state: "ready",
      model: {
        token,
        title: snapshot.title,
        sharedBy: snapshot.sharer_display_name ?? "A Fullwell household",
        expiresLabel: `Available through ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(expiresAt))}`,
        description: "A private household published this collection snapshot for you.",
        items: snapshot.items.map((item) => ({
          id: item.collection_item_id,
          kind: item.kind,
          title: item.title,
          source: item.source_display_attribution ?? item.author_or_publisher ?? item.brand ?? "Shared collection",
          ...(item.image_url === null ? {} : { imageUrl: item.image_url, imageAlt: item.title }),
          ...(item.public_description === null ? {} : { note: item.public_description }),
          selected: false,
        })),
      },
    };
  }

  private async inviteFor(token: string, authenticated: boolean): Promise<WebRenderContext["invite"]> {
    const invitation = await this.store.findInvitationByTokenHash(this.hasher.hash(token));
    if (invitation === null) return { ...defaultInvite(), state: "revoked" };
    const household = await this.store.getHousehold(invitation.householdId);
    const state = invitation.revokedAt !== null ? "revoked" : invitation.acceptedAt !== null ? "joined" : Date.parse(invitation.expiresAt) <= Date.now() ? "expired" : authenticated ? "authenticated" : "preview";
    return {
      state,
      householdName: household?.name ?? "Household",
      inviterName: "A household owner",
      roleLabel: invitation.role === "editor" ? "Editor" : "Viewer",
      expiresLabel: new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(invitation.expiresAt)),
    };
  }
}

function emptyCollection(token: string): WebRenderContext["publicCollection"] {
  return { token: token || "unavailable", title: "Collection unavailable", sharedBy: "Fullwell", expiresLabel: "", description: "", items: [] };
}

function defaultInvite(): WebRenderContext["invite"] {
  return { state: "preview", householdName: "Household", inviterName: "A household owner", roleLabel: "Viewer", expiresLabel: "" };
}

function hostName(label: string): string {
  return label.startsWith("Use with ") ? label.slice("Use with ".length) : label;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
