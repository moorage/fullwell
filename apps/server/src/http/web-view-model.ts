import { readFile } from "node:fs/promises";
import type { FastifyRequest } from "fastify";
import {
  CollectionSnapshotSchema,
  DateSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  MealCompatibilitySchema,
  MealPlanEventIdSchema,
  MealPlanEventSchema,
  MealPlanningProfileSchema,
  MealProposalIdSchema,
  MealProposalSchema,
  MondayDateSchema,
} from "@hfj/contracts";
import type { VisualJournalPage, WebRenderContext } from "@hfj/web/types";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { AuthenticationPort, Clock, OperationalStorePort, RandomSource, TokenHasher } from "../core/ports.js";
import type { HouseholdRecord, MembershipRecord, Principal } from "../core/types.js";
import type { PasskeyCredential } from "../auth/types.js";
import type { IdentityMethodProvider } from "../auth/types.js";
import type { OAuthGrantSummary } from "../oauth/types.js";
import type { MessagingAccountStatus } from "../messaging/service.js";
import { HouseholdFoodJournalService } from "../services/household-food-journal.js";
import type {
  WebAddMealProposalInput,
  WebCreateHouseholdInput,
  WebImportInput,
  WebJournalItemsInput,
  WebReviewMealConstraintsInput,
  WebWithdrawMealProposalInput,
} from "./web.js";

const InstallMetadataSchema = z.object({
  release: z.string().min(1),
  platforms: z.object({
    codex: z.object({
      label: z.string(), primary_action: z.string(), setup_prompt: z.string().min(1),
      setup_href: z.url().refine((value) => new URL(value).protocol === "codex:").nullable(),
      fallback_commands: z.array(z.string()).min(1),
    }),
    claude: z.object({
      label: z.string(), primary_action: z.string(), setup_prompt: z.string().min(1),
      setup_href: z.null(), fallback_commands: z.array(z.string()).min(1),
    }),
  }),
});

const PreviewDataSchema = z.object({ snapshot: CollectionSnapshotSchema, expires_at: z.iso.datetime({ offset: true }) });
const ImportPlanDataSchema = z.object({ items: z.array(z.object({
  collection_item_id: z.string(), exact_duplicates: z.array(z.string()), possible_duplicates: z.array(z.string()), requires_resolution: z.boolean(),
})) });
const MealPlanDataSchema = z.object({
  week_start: MondayDateSchema,
  constraint_profile: MealPlanningProfileSchema.nullable(),
  proposals: z.array(z.object({
    proposal: MealProposalSchema,
    active: z.boolean(),
    effective_compatibility: MealCompatibilitySchema,
  })),
  events: z.array(MealPlanEventSchema),
  events_truncated: z.boolean(),
  next_cursor: MealProposalIdSchema.nullable(),
});
const VisualJournalInputSchema = z.object({
  householdId: HouseholdIdSchema,
  section: z.enum(["recipes", "groceries"]),
  cursor: z.string().max(16).regex(/^v1_\d+$/).optional(),
}).strict();
const VisualJournalPageNumberSchema = z.coerce.number().int().min(1).max(17);
const VISUAL_JOURNAL_BATCH_SIZE = 12;
const VISUAL_JOURNAL_MAX_PREFIX = 200;

export class WebViewModelService {
  private constructor(
    private readonly service: HouseholdFoodJournalService,
    private readonly store: OperationalStorePort,
    private readonly authentication: AuthenticationPort,
    private readonly hasher: TokenHasher,
    private readonly random: RandomSource,
    private readonly clock: Clock,
    private readonly publicOrigin: URL,
    private readonly install: z.infer<typeof InstallMetadataSchema>,
    private readonly resolvePrincipal: ((request: FastifyRequest) => Promise<Principal | null>) | undefined,
    private readonly verifyCsrf: ((request: FastifyRequest, submittedToken: string) => Promise<void>) | undefined,
    private readonly listPasskeys: ((userId: Principal["userId"]) => Promise<readonly PasskeyCredential[]>) | undefined,
    private readonly accountSummary: ((userId: Principal["userId"]) => Promise<{ readonly methods: readonly IdentityMethodProvider[]; readonly grants: readonly OAuthGrantSummary[] }>) | undefined,
    private readonly messagingStatus: ((principal: Principal, setup: { readonly deviceId?: string; readonly householdId?: string }) => Promise<MessagingAccountStatus>) | undefined,
  ) {}

  static async create(options: {
    service: HouseholdFoodJournalService;
    store: OperationalStorePort;
    authentication: AuthenticationPort;
    hasher: TokenHasher;
    random: RandomSource;
    clock: Clock;
    publicOrigin: URL;
    installMetadataPath: string;
    resolvePrincipal?: (request: FastifyRequest) => Promise<Principal | null>;
    verifyCsrf?: (request: FastifyRequest, submittedToken: string) => Promise<void>;
    listPasskeys?: (userId: Principal["userId"]) => Promise<readonly PasskeyCredential[]>;
    accountSummary?: (userId: Principal["userId"]) => Promise<{ readonly methods: readonly IdentityMethodProvider[]; readonly grants: readonly OAuthGrantSummary[] }>;
    messagingStatus?: (principal: Principal, setup: { readonly deviceId?: string; readonly householdId?: string }) => Promise<MessagingAccountStatus>;
  }): Promise<WebViewModelService> {
    const metadata = InstallMetadataSchema.parse(JSON.parse(await readFile(options.installMetadataPath, "utf8")));
    return new WebViewModelService(
      options.service,
      options.store,
      options.authentication,
      options.hasher,
      options.random,
      options.clock,
      options.publicOrigin,
      metadata,
      options.resolvePrincipal,
      options.verifyCsrf,
      options.listPasskeys,
      options.accountSummary,
      options.messagingStatus,
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

  async journalItems(request: FastifyRequest, input: WebJournalItemsInput): Promise<VisualJournalPage> {
    if (this.resolvePrincipal === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "Visual journal browsing is not configured");
    const parsed = VisualJournalInputSchema.parse(input);
    const principal = await this.resolvePrincipal(request);
    if (principal === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    const selected = (await this.store.listMemberships(principal.userId))
      .find(({ household }) => household.id === parsed.householdId);
    if (selected === undefined) throw new AppError("NOT_FOUND", "Household was not found");
    return await this.visualJournalFor(selected, parsed.section, cursorOffset(parsed.cursor), VISUAL_JOURNAL_BATCH_SIZE);
  }

  async reviewMealConstraints(request: FastifyRequest, input: WebReviewMealConstraintsInput): Promise<void> {
    const principal = await this.mutablePrincipal(request, input.csrf);
    const result = await this.service.call("hfj_review_meal_constraints", {
      household_id: HouseholdIdSchema.parse(input.householdId),
      week_start: MondayDateSchema.parse(input.week),
      constraint_revision: GitObjectIdSchema.parse(input.constraintRevision),
      idempotency_key: input.idempotencyKey,
    }, principal);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
  }

  async addMealProposal(request: FastifyRequest, input: WebAddMealProposalInput): Promise<void> {
    const principal = await this.mutablePrincipal(request, input.csrf);
    const result = await this.service.call("hfj_add_meal_proposal", {
      household_id: HouseholdIdSchema.parse(input.householdId),
      week_start: MondayDateSchema.parse(input.week),
      meal_date: DateSchema.parse(input.mealDate),
      slot: { kind: input.slotKind },
      source: { kind: "freeform", title: input.title },
      servings: input.servings,
      notes: input.notes,
      constraint_revision: GitObjectIdSchema.parse(input.constraintRevision),
      constraint_review_event_id: MealPlanEventIdSchema.parse(input.constraintReviewEventId),
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Confirm ingredients, package labels, and cross-contact risks before serving.",
      idempotency_key: input.idempotencyKey,
    }, principal);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
  }

  async withdrawMealProposal(request: FastifyRequest, input: WebWithdrawMealProposalInput): Promise<void> {
    const principal = await this.mutablePrincipal(request, input.csrf);
    const result = await this.service.call("hfj_withdraw_meal_proposal", {
      household_id: HouseholdIdSchema.parse(input.householdId),
      week_start: MondayDateSchema.parse(input.week),
      proposal_id: MealProposalIdSchema.parse(input.proposalId),
      reason: input.reason,
      idempotency_key: input.idempotencyKey,
    }, principal);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
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
    const setupDeviceId = requestUrl.searchParams.get("runner_device");
    const setupHouseholdId = requestUrl.searchParams.get("household_id");
    const messaging = principal === null || pathname !== "/account" || this.messagingStatus === undefined
      ? { kind: "disabled" as const, availableThrough: "2026-10-01T07:00:00.000Z" }
      : await this.messagingStatus(principal, {
        ...(setupDeviceId === null ? {} : { deviceId: setupDeviceId }),
        ...(setupHouseholdId === null ? {} : { householdId: setupHouseholdId }),
      });
    const mealPlan = principal === null || selectedMembership === undefined || !pathname.endsWith("/meal-plan")
      ? null
      : await this.mealPlanFor(
        selectedMembership,
        principal,
        requestUrl.searchParams.get("week") !== null
          ? MondayDateSchema.parse(requestUrl.searchParams.get("week"))
          : currentMonday(this.clock.now(), await this.mealPlanningTimeZone(selectedMembership.household)),
        requestUrl.searchParams.get("changed"),
      );
    const visualSection = pathname.endsWith("/recipes")
      ? "recipes" as const
      : pathname.endsWith("/groceries") ? "groceries" as const : null;
    const visualPageNumber = visualSection === null
      ? 1
      : VisualJournalPageNumberSchema.parse(requestUrl.searchParams.get("page") ?? "1");
    const visualJournal = principal === null || selectedMembership === undefined || visualSection === null
      ? null
      : await this.visualJournalFor(
        selectedMembership,
        visualSection,
        0,
        Math.min(visualPageNumber * VISUAL_JOURNAL_BATCH_SIZE, VISUAL_JOURNAL_MAX_PREFIX),
      );

    return {
      security: { csrfToken, idempotencyPrefix: this.random.opaqueId("web") },
      capabilities: { mealPlanning: true },
      canonicalUrl: this.publicOrigin.toString(),
      install: { hosts: {
        codex: {
          label: "ChatGPT",
          command: this.install.platforms.codex.fallback_commands.join(" && "),
          next: this.install.platforms.codex.primary_action,
          setupPrompt: this.install.platforms.codex.setup_prompt,
          setupHref: this.install.platforms.codex.setup_href,
        },
        claude: {
          label: hostName(this.install.platforms.claude.label),
          command: this.install.platforms.claude.fallback_commands.join(" && "),
          next: this.install.platforms.claude.primary_action,
          setupPrompt: this.install.platforms.claude.setup_prompt,
          setupHref: this.install.platforms.claude.setup_href,
        },
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
      messaging: messagingView(messaging),
      viewer: { displayName: principal?.displayName ?? "", email: "" },
      households,
      members: selectedMembership === undefined || principal === null ? [] : await this.membersFor(selectedMembership.household, principal),
      collections: selectedMembership === undefined ? [] : await this.collectionsFor(selectedMembership.household),
      mealPlan,
      visualJournal,
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

  private async visualJournalFor(
    selected: { household: HouseholdRecord; membership: MembershipRecord },
    section: VisualJournalPage["section"],
    offset: number,
    limit: number,
  ): Promise<VisualJournalPage> {
    if (selected.household.provisioningState !== "ready" || selected.membership.projectionHead !== selected.household.repositoryHead) {
      throw new AppError("PROJECTION_DRIFT", "The household snapshot does not match Git", true);
    }
    const projection = await this.store.projection(selected.household.id);
    const entries = [...projection.items.values()]
      .filter(({ item }) => section === "recipes" ? item.kind === "recipe" : item.kind !== "recipe")
      .sort((left, right) => {
        const leftTitle = left.item.kind === "recipe" ? left.item.title : left.item.display_name;
        const rightTitle = right.item.kind === "recipe" ? right.item.title : right.item.display_name;
        return leftTitle.localeCompare(rightTitle, "en-US") || left.item.id.localeCompare(right.item.id);
      });
    const items = entries.slice(offset, offset + limit).map(({ item }) => {
      if (item.kind === "recipe") {
        return {
          kind: "recipe" as const,
          id: item.id,
          title: item.title,
          source: item.author_or_publisher,
          imageUrl: item.image_url,
          imagePageUrl: item.image_page_url,
          canonicalUrl: item.canonical_url,
          saved: item.saved,
          cooked: item.cooked,
          liked: item.liked,
          lastCookedLabel: item.last_cooked === null ? null : formatDate(item.last_cooked),
        };
      }
      return {
        kind: "grocery" as const,
        journalKind: item.kind,
        id: item.id,
        title: item.display_name,
        brand: item.brand,
        detail: [item.product_line, item.flavor, item.formulation, item.format, item.category, item.produce_variety, ...item.known_size_variants.slice(0, 1)]
          .filter((value): value is string => value !== null)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(" · "),
        imageUrl: item.image_url,
        imagePageUrl: item.image_page_url,
      };
    });
    const nextOffset = offset + items.length;
    return {
      householdId: selected.household.id,
      section,
      total: entries.length,
      items,
      nextCursor: nextOffset < entries.length ? `v1_${nextOffset}` : null,
    };
  }

  private async mutablePrincipal(request: FastifyRequest, csrf: string): Promise<Principal> {
    if (this.resolvePrincipal === undefined || this.verifyCsrf === undefined) {
      throw new AppError("PROVIDER_UNAVAILABLE", "Browser meal planning is not configured");
    }
    const principal = await this.resolvePrincipal(request);
    if (principal === null) throw new AppError("AUTH_REQUIRED", "Sign in is required");
    await this.verifyCsrf(request, csrf);
    return principal;
  }

  private async mealPlanningTimeZone(household: HouseholdRecord): Promise<string> {
    const constraints = (await this.store.projection(household.id)).mealPlanningProfile?.constraints;
    return constraints === undefined || constraints.status === "unresolved" ? "UTC" : constraints.time_zone;
  }

  private async mealPlanFor(
    selected: { household: HouseholdRecord; membership: MembershipRecord },
    principal: Principal,
    weekStart: z.infer<typeof MondayDateSchema>,
    changed: string | null,
  ): Promise<NonNullable<WebRenderContext["mealPlan"]>> {
    const pages: Array<z.infer<typeof MealPlanDataSchema>> = [];
    let cursor: z.infer<typeof MealProposalIdSchema> | undefined;
    const seenCursors = new Set<string>();
    do {
      const result = await this.service.call("hfj_get_meal_plan", {
        household_id: selected.household.id,
        week_start: weekStart,
        limit: 500,
        ...(cursor === undefined ? {} : { cursor }),
      }, principal);
      if (!result.ok) throw new AppError(result.error.code, result.error.message);
      const page = MealPlanDataSchema.parse(result.data);
      pages.push(page);
      cursor = page.next_cursor ?? undefined;
      if (cursor !== undefined && seenCursors.has(cursor)) throw new AppError("PROJECTION_DRIFT", "Meal-plan pagination did not advance");
      if (cursor !== undefined) seenCursors.add(cursor);
    } while (cursor !== undefined);

    const firstPage = pages[0];
    if (firstPage === undefined) throw new AppError("PROJECTION_DRIFT", "Meal-plan data was unavailable");
    const events = pages.flatMap(({ events }) => events);
    const reviewEvent = firstPage.constraint_profile === null
      ? undefined
      : events.find((event) =>
        event.kind === "constraints_reviewed"
        && event.constraint_revision === firstPage.constraint_profile?.revision);
    const editableRole = selected.membership.role === "owner" || selected.membership.role === "editor";
    const actorNames = new Map((await this.store.listHouseholdMemberships(selected.household.id)).map((membership, index) => [
      membership.actorId,
      membership.userId === principal.userId ? principal.displayName : `Household member ${index + 1}`,
    ]));
    const journalItems = (await this.store.projection(selected.household.id)).items;
    const active = pages.flatMap(({ proposals }) => proposals).filter(({ active: isActive }) => isActive);
    const proposalsBySlot = new Map<string, typeof active>();
    for (const entry of active) {
      const key = `${entry.proposal.meal_date}:${mealSlotKey(entry.proposal.slot)}`;
      proposalsBySlot.set(key, [...(proposalsBySlot.get(key) ?? []), entry]);
    }
    const customSlots = [...new Set(active.flatMap(({ proposal }) => proposal.slot.kind === "custom" ? [proposal.slot.label] : []))]
      .sort((left, right) => left.localeCompare(right));
    const slots = [
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "dinner", label: "Dinner" },
      { key: "snack", label: "Snack" },
      ...customSlots.map((label) => ({ key: `custom:${label}`, label })),
    ];
    const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset)).map((date) => ({
      date,
      label: formatDay(date),
      shortLabel: formatShortDay(date),
      slots: slots.map((slot, index) => ({
        id: `slot-${date}-${safeFragment(slot.key)}${slot.key.startsWith("custom:") ? `-${index}` : ""}`,
        key: slot.key,
        label: slot.label,
        proposals: (proposalsBySlot.get(`${date}:${slot.key}`) ?? []).map(({ proposal, effective_compatibility: compatibility }) => ({
          id: proposal.id,
          title: (() => {
            if (proposal.source.kind !== "journal_recipe") return proposal.source.title;
            const item = journalItems.get(proposal.source.item_id)?.item;
            return item?.kind === "recipe" ? item.title : "Journal recipe";
          })(),
          sourceKind: proposal.source.kind,
          sourceDetail: proposal.source.kind === "external_recipe"
            ? proposal.source.site_name
            : proposal.source.kind === "journal_recipe" ? "Liked recipe from your journal" : "Household idea",
          ...(proposal.source.kind === "external_recipe" ? { sourceHref: proposal.source.canonical_url } : {}),
          proposedBy: typeof proposal.proposed_by === "string"
            ? actorNames.get(proposal.proposed_by) ?? "Household member"
            : proposal.proposed_by.label,
          servings: proposal.servings,
          notes: proposal.notes,
          compatibilityLabel: compatibilityLabel(compatibility),
          compatibilityCaveat: proposal.compatibility_caveat,
          needsRecheck: compatibility === "needs_recheck",
          canWithdraw: editableRole && (selected.membership.role === "owner" || proposal.proposed_by === principal.actorId),
        })),
      })),
    }));
    const constraints = firstPage.constraint_profile?.constraints;
    const constraintState = constraints === undefined || constraints.status === "unresolved"
      ? "missing" as const
      : reviewEvent === undefined ? "needs_review" as const : "reviewed" as const;
    const confirmedTimeZone = constraints === undefined || constraints.status === "unresolved" ? "UTC" : constraints.time_zone;
    return {
      householdId: selected.household.id,
      weekStart,
      weekLabel: formatWeek(weekStart),
      previousWeek: addDays(weekStart, -7),
      nextWeek: addDays(weekStart, 7),
      timeZoneLabel: formatTimeZone(confirmedTimeZone, this.clock.now()),
      role: selected.membership.role,
      canEdit: editableRole && constraintState === "reviewed",
      canReview: editableRole && constraintState === "needs_review",
      constraintState,
      constraintRevision: firstPage.constraint_profile === null ? null : String(firstPage.constraint_profile.revision),
      constraintReviewEventId: reviewEvent?.id ?? null,
      proposalCount: active.length,
      statusMessage: changedStatus(changed),
      days,
    };
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
        groceries: values.filter(({ item }) => item.kind !== "recipe").length,
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

function messagingView(status: MessagingAccountStatus): WebRenderContext["messaging"] {
  const availableThroughLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" })
    .format(new Date(Date.parse(status.availableThrough) - 1));
  if (status.kind === "disabled" || status.kind === "not_configured") return { kind: status.kind, availableThroughLabel };
  if (status.kind === "setup") return { ...status, availableThroughLabel };
  if (status.kind === "linked") {
    return { ...status, availableThroughLabel, lastSeenLabel: status.lastSeenAt === null ? null : formatDate(status.lastSeenAt) };
  }
  return { ...status, availableThroughLabel, confirmationExpiresLabel: formatDate(status.confirmationExpiresAt) };
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

function cursorOffset(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  return z.coerce.number().int().min(0).max(10_000_000).parse(cursor.slice("v1_".length));
}

function currentMonday(now: Date, timeZone: string): z.infer<typeof MondayDateSchema> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) throw new AppError("PROJECTION_DRIFT", "Meal-planning time zone could not be resolved");
    return value;
  };
  const localDate = `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
  const weekday = new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
  return MondayDateSchema.parse(addDays(localDate, -(weekday === 0 ? 6 : weekday - 1)));
}

function addDays(date: string, offset: number): z.infer<typeof DateSchema> {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return DateSchema.parse(value.toISOString().slice(0, 10));
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatShortDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatWeek(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(startDate);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(endDate);
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  return startMonth === endMonth ? `${startMonth} ${startDay}–${endDay}` : `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

function formatTimeZone(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
    .formatToParts(now)
    .find(({ type }) => type === "timeZoneName")?.value ?? timeZone;
}

function mealSlotKey(slot: z.infer<typeof MealProposalSchema>["slot"]): string {
  return slot.kind === "custom" ? `custom:${slot.label}` : slot.kind;
}

function safeFragment(value: string): string {
  return value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "custom";
}

function compatibilityLabel(value: z.infer<typeof MealCompatibilitySchema>): string {
  if (value === "appears_compatible") return "Appears compatible";
  if (value === "incomplete_evidence") return "Compatibility evidence is incomplete";
  return "Compatibility needs review";
}

function changedStatus(value: string | null): string | null {
  if (value === "proposal-added") return "Meal idea added to the selected date and slot.";
  if (value === "proposal-withdrawn") return "Meal idea withdrawn; its slot is updated.";
  if (value === "constraints-reviewed") return "Household constraints reviewed for this week.";
  return null;
}
