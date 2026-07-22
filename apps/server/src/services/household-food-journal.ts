import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import type {
  GitObjectId,
  HouseholdId,
  RequestId,
  ToolEnvelope,
  ToolName,
  UserId,
} from "@hfj/contracts";
import {
  CollectionIdSchema,
  CollectionSnapshotSchema,
  EvidenceIdSchema,
  HouseholdIdSchema,
  ImportIdSchema,
  InvitationIdSchema,
  ItemIdSchema,
  OnboardingStatusSchema,
  RequestIdSchema,
  ShareIdSchema,
  SnapshotIdSchema,
  ToolInputSchemas,
  type OnboardingRecord,
  type OnboardingCommitOutcome,
  type OnboardingSkipOutcome,
  type OnboardingSection,
  type OnboardingSectionState,
  type OnboardingStatus,
} from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { Clock, ExportArtifactPort, HouseholdRepositoryPort, OperationalStorePort, RandomSource, RepositoryChange, TelemetryPort, TokenHasher } from "../core/ports.js";
import type { JsonValue, MembershipRecord, MutationRecord, Principal } from "../core/types.js";
import { requireMembership, requireScope } from "../domain/authorization.js";
import { journalEvidencePath, journalItemPath, markdownDocument, validateItemEvidence, validateReport } from "../domain/journal-validation.js";
import { nextOnboardingSkip, transitionOnboarding } from "../domain/onboarding.js";
import { stableJson } from "../adapters/memory.js";
import { MutationRunner } from "./mutation-runner.js";
import { MemoryExportArtifactStore } from "../exports/artifact-store.js";

type ServiceEnvelope = ToolEnvelope<JsonValue>;

export class HouseholdFoodJournalService {
  private readonly mutations: MutationRunner;
  constructor(
    private readonly store: OperationalStorePort,
    private readonly repository: HouseholdRepositoryPort,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly hasher: TokenHasher,
    private readonly telemetry: TelemetryPort,
    private readonly publicOrigin: URL,
    private readonly exportArtifacts: ExportArtifactPort = new MemoryExportArtifactStore(),
  ) {
    this.mutations = new MutationRunner(store, repository, clock, random, telemetry);
  }

  async call(name: ToolName, input: unknown, principal: Principal): Promise<ServiceEnvelope> {
    try {
      switch (name) {
        case "hfj_get_context": return this.read(await this.getContext(input, principal));
        case "hfj_create_household": return this.write(await this.createHousehold(input, principal));
        case "hfj_select_household": return this.read(await this.selectHousehold(input, principal));
        case "hfj_update_onboarding": return this.write(await this.updateOnboarding(input, principal));
        case "hfj_commit_onboarding": return this.write(await this.commitOnboarding(input, principal));
        case "hfj_create_family_invite": return this.write(await this.createInvite(input, principal));
        case "hfj_accept_family_invite": return this.write(await this.acceptInvite(input, principal));
        case "hfj_revoke_family_invite": return this.write(await this.revokeInvite(input, principal));
        case "hfj_list_members": return this.read(await this.listMembers(input, principal));
        case "hfj_update_member": return this.write(await this.updateMember(input, principal));
        case "hfj_remove_member": return this.write(await this.removeMember(input, principal));
        case "hfj_get_profile": return this.read(await this.getProfile(input, principal));
        case "hfj_update_profile": return this.write(await this.updateProfile(input, principal));
        case "hfj_search_items": return this.read(await this.searchItems(input, principal));
        case "hfj_get_item": return this.read(await this.getItem(input, principal));
        case "hfj_append_evidence": return this.write(await this.appendEvidence(input, principal));
        case "hfj_commit_change_set": return this.write(await this.commitChangeSet(input, principal));
        case "hfj_create_collection": return this.write(await this.createCollection(input, principal));
        case "hfj_create_collection_share": return this.write(await this.createShare(input, principal));
        case "hfj_revoke_collection_share": return this.write(await this.revokeShare(input, principal));
        case "hfj_preview_shared_collection": return this.read(await this.previewSharedCollection(input));
        case "hfj_plan_collection_import": return this.read(await this.planImport(input, principal));
        case "hfj_import_collection_items": return this.write(await this.importItems(input, principal));
        case "hfj_export_household": return this.write(await this.exportHousehold(input, principal));
      }
    } catch (error) {
      return this.error(error);
    }
  }

  async preview(token: string): Promise<ServiceEnvelope> {
    try { return this.read(await this.previewSharedCollection({ token })); } catch (error) { return this.error(error); }
  }

  private async getContext(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_get_context.parse(input);
    requireScope(principal, "journal:read");
    const memberships = await this.store.listMemberships(principal.userId);
    const selected = parsed.household_id ?? await this.store.getDefaultHousehold(principal.userId);
    const selectedMembership = selected === null ? undefined : memberships.find(({ household }) => household.id === selected);
    if (selected !== null && selectedMembership === undefined) throw new AppError("FORBIDDEN", "You do not have access to that household");
    const snapshot = selected === null ? null : await this.store.withHouseholdLock(selected, async () => {
      const membership = await requireMembership(this.store, principal, selected, "viewer");
      const household = await this.requiredHousehold(selected);
      const head = await this.repository.head(selected);
      if (household.repositoryHead !== head || membership.projectionHead !== head) {
        throw new AppError("PROJECTION_DRIFT", "The household snapshot does not match Git", true);
      }
      const projection = await this.store.projection(selected);
      const items = [...projection.items.values()]
        .sort((left, right) => left.item.id.localeCompare(right.item.id))
        .map(({ item, revision }) => itemSummary(item, revision));
      const itemLimit = 200;
      return {
        head,
        onboarding: await this.onboardingStatus(principal.userId, selected),
        profiles: {
          snacks: profileSnapshot(projection.profiles.get("snacks")),
          recipes: profileSnapshot(projection.profiles.get("recipes")),
        },
        items: items.slice(0, itemLimit),
        items_truncated: items.length > itemLimit,
      };
    });
    return {
      data: {
        user: { id: principal.userId, display_name: principal.displayName },
        households: memberships.map(({ household, membership }) => ({ id: household.id, name: household.name, role: membership.role, repository_head: household.repositoryHead })),
        default_household_id: selected,
        pending_intent: null,
        granted_scopes: [...principal.scopes].sort(),
        onboarding: snapshot === null ? null : jsonRoundTrip(snapshot.onboarding),
        onboarding_snapshot: snapshot === null ? null : jsonRoundTrip({
          profiles: snapshot.profiles,
          items: snapshot.items,
          items_truncated: snapshot.items_truncated,
        }),
      },
      head: snapshot?.head ?? selectedMembership?.household.repositoryHead ?? null,
    };
  }

  private async createHousehold(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_create_household.parse(input);
    requireScope(principal, "household:manage");
    const existing = await this.store.getMutation(principal.userId, "hfj_create_household", parsed.idempotency_key);
    if (existing?.state === "completed" && existing.response !== null && existing.commitId !== null) return { data: existing.response, head: existing.commitId, requestId: existing.requestId };
    if (existing?.state === "quarantined") throw new AppError("RECONCILIATION_REQUIRED", "Household provisioning is quarantined for operator review");
    const requestId = existing?.requestId ?? this.requestId();
    const occurredAt = existing?.createdAt ?? this.now();
    const householdName = typeof existing?.response?.provisioning_name === "string" ? existing.response.provisioning_name : parsed.name;
    const householdId = HouseholdIdSchema.parse(this.mutationId("hsh", requestId, "household"));
    if (existing === null) {
      const record = this.mutationRecord(requestId, principal, "hfj_create_household", parsed.idempotency_key, null, occurredAt);
      record.response = { provisioning_name: householdName };
      await this.store.saveMutation(record);
    }
    const outcome = await this.store.withHouseholdLock(householdId, async () => {
      let head: GitObjectId | null = existing?.commitId ?? null;
      try {
        head ??= await this.repository.provision(householdId, householdName, principal.actorId, occurredAt);
        await this.store.transitionMutation(requestId, "git_committed", { commitId: head });
        if (await this.store.getHousehold(householdId) === null) {
          const owner: MembershipRecord = { householdId, userId: principal.userId, actorId: principal.actorId, role: "owner", projectionHead: head, removedAt: null };
          await this.store.createHousehold({ id: householdId, name: householdName, repositoryHead: head, provisioningState: "ready", createdAt: occurredAt }, owner);
        }
        await this.store.setDefaultHousehold(principal.userId, householdId);
        const data = { status: "completed", household_id: householdId, role: "owner", onboarding_state: "ready" } satisfies Record<string, JsonValue>;
        await this.store.transitionMutation(requestId, "completed", { commitId: head, response: data });
        return { status: "completed" as const, data, head };
      } catch (error) {
        await this.store.transitionMutation(requestId, head === null ? "failed_before_commit" : "reconciliation_required", { ...(head === null ? {} : { commitId: head }), failure: errorName(error) });
        return { status: "failed" as const, error };
      }
    });
    if (outcome.status === "failed") throw outcome.error;
    return { data: outcome.data, head: outcome.head, requestId };
  }

  private async selectHousehold(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_select_household.parse(input);
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    await this.store.setDefaultHousehold(principal.userId, parsed.household_id);
    const household = await this.requiredHousehold(parsed.household_id);
    return { data: { status: "completed", household_id: parsed.household_id }, head: household.repositoryHead };
  }

  private async updateOnboarding(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_update_onboarding.parse(input);
    requireScope(principal, "journal:write");
    await requireMembership(this.store, principal, parsed.household_id, "editor");
    const requestFingerprint = this.mutationFingerprint("hfj_update_onboarding", parsed);
    const existing = await this.store.getMutation(principal.userId, "hfj_update_onboarding", parsed.idempotency_key);
    const replay = this.mutationReplay(existing, requestFingerprint);
    if (replay !== null) return replay;

    const requestId = existing?.requestId ?? this.requestId();
    const occurredAt = existing?.createdAt ?? this.now();
    if (existing === null) {
      const record = this.mutationRecord(requestId, principal, "hfj_update_onboarding", parsed.idempotency_key, parsed.household_id, occurredAt);
      record.response = { _request_fingerprint: requestFingerprint };
      await this.store.saveMutation(record);
    }

    const outcome = await this.store.withHouseholdLock(parsed.household_id, async (): Promise<OperationalMutationOutcome> => {
      const currentMutation = await this.store.getMutation(principal.userId, "hfj_update_onboarding", parsed.idempotency_key);
      const lockedReplay = this.mutationReplay(currentMutation, requestFingerprint);
      if (lockedReplay !== null) return { status: "completed", result: lockedReplay };
      if (currentMutation === null) throw new AppError("INTERNAL_ERROR", "Onboarding mutation record was not found");
      await this.store.transitionMutation(currentMutation.requestId, "locked");

      let prepared: { readonly next: OnboardingRecord; readonly head: GitObjectId };
      try {
        const membership = await requireMembership(this.store, principal, parsed.household_id, "editor");
        const head = await this.repository.head(parsed.household_id);
        if (membership.projectionHead !== head) throw new AppError("PROJECTION_DRIFT", "Membership projection does not match Git", true);
        if (await this.reportExists(parsed.household_id, parsed.section)) {
          throw new AppError("VALIDATION_FAILED", "That onboarding section is already complete");
        }
        const records = await this.store.listOnboardingRecords(principal.userId, parsed.household_id);
        const current = records.find((record) => record.section === parsed.section);
        prepared = {
          head,
          next: transitionOnboarding(current, {
            userId: principal.userId,
            householdId: parsed.household_id,
            section: parsed.section,
            transition: parsed.transition,
            expectedRevision: parsed.expected_revision,
            occurredAt,
          }),
        };
      } catch (error) {
        await this.store.transitionMutation(currentMutation.requestId, "failed_before_commit", { failure: errorName(error) });
        return { status: "failed", error };
      }

      if (!await this.store.compareAndSetOnboarding(prepared.next, parsed.expected_revision)) {
        const error = new AppError("REVISION_CONFLICT", "Onboarding changed in another session");
        await this.store.transitionMutation(currentMutation.requestId, "failed_before_commit", { failure: errorName(error) });
        return { status: "failed", error };
      }
      const data = {
        status: "completed",
        household_id: parsed.household_id,
        section: parsed.section,
        section_state: jsonRoundTrip(this.stateFromRecord(prepared.next)),
      } satisfies Record<string, JsonValue>;
      await this.store.transitionMutation(currentMutation.requestId, "completed", {
        commitId: prepared.head,
        response: { ...data, _request_fingerprint: requestFingerprint },
      });
      return { status: "completed", result: { data, head: prepared.head, requestId: currentMutation.requestId } };
    });
    if (outcome.status === "failed") {
      const error = outcome.error instanceof Error ? outcome.error : new Error("Onboarding mutation failed");
      this.telemetry.error("mutation.failed", error, { tool: "hfj_update_onboarding", request_id: requestId, error_code: errorName(outcome.error) });
      throw outcome.error;
    }
    this.telemetry.event("mutation.completed", { tool: "hfj_update_onboarding", request_id: outcome.result.requestId });
    return outcome.result;
  }

  private async commitOnboarding(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_commit_onboarding.parse(input);
    const hasCanonicalChanges = parsed.profiles.length + parsed.evidence.length + parsed.items.length + parsed.reports.length > 0;
    if (!hasCanonicalChanges) return await this.commitOnboardingSkips(parsed, principal);

    const skips = parsed.sections.filter((section) => section.outcome === "skip");
    let projection = await this.store.projection(parsed.household_id);
    return await this.mutations.run({
      principal,
      tool: "hfj_commit_onboarding",
      householdId: parsed.household_id,
      idempotencyKey: parsed.idempotency_key,
      requestFingerprint: this.mutationFingerprint("hfj_commit_onboarding", parsed),
      expectedHead: parsed.expected_head,
      minimumRole: "editor",
      requiredScope: "journal:write",
      summary: "onboarding: commit confirmed journal setup",
      recoveryData: { _onboarding_skips: jsonRoundTrip(skips) },
      enforceFingerprintOnReplay: true,
      buildChanges: async () => {
        if ((await this.requiredHousehold(parsed.household_id)).repositoryHead !== parsed.expected_head) {
          throw new AppError("PROJECTION_DRIFT", "The household projection does not match the onboarding snapshot", true);
        }
        projection = await this.store.projection(parsed.household_id);
        const prospectiveEvidence = new Map(projection.evidence);
        for (const evidence of parsed.evidence) {
          if (prospectiveEvidence.has(evidence.id)) throw new AppError("REVISION_CONFLICT", `Evidence already exists: ${evidence.id}`);
          if (evidence.supersedes_evidence_id !== undefined && !prospectiveEvidence.has(evidence.supersedes_evidence_id)) {
            throw new AppError("VALIDATION_FAILED", "Correction evidence must reference an existing event");
          }
          prospectiveEvidence.set(evidence.id, evidence);
        }
        for (const item of parsed.items) {
          validateItemEvidence(item, prospectiveEvidence);
          const current = projection.items.get(item.id);
          const expected = parsed.expected_item_revisions[item.id];
          if (current !== undefined && expected !== current.revision) throw new AppError("REVISION_CONFLICT", `Item changed: ${item.id}`);
          if (current === undefined && expected !== undefined) throw new AppError("REVISION_CONFLICT", `New item has an unexpected revision: ${item.id}`);
        }
        const itemIds = new Set([...projection.items.keys(), ...parsed.items.map((item) => item.id)]);
        for (const report of parsed.reports) validateReport(report, prospectiveEvidence, itemIds);
        await this.validateOnboardingOutcomes(parsed.household_id, parsed.sections, parsed.reports.map(({ report_type }) => report_type));
        return [
          ...parsed.evidence.map(evidenceChange),
          ...parsed.profiles.map(({ profile, markdown }) => profileChange(profile, markdown)),
          ...parsed.items.map(itemChange),
          ...parsed.reports.map(reportChange),
        ];
      },
      applyProjection: async (head, _requestId, occurredAt) => {
        for (const evidence of parsed.evidence) projection.evidence.set(evidence.id, evidence);
        for (const { profile, markdown } of parsed.profiles) projection.profiles.set(profile, { markdown, revision: head });
        for (const item of parsed.items) projection.items.set(item.id, { item, revision: head });
        await this.applyOnboardingSkips(principal.userId, parsed.household_id, skips, occurredAt);
        const onboarding = await this.onboardingStatus(principal.userId, parsed.household_id);
        return {
          status: "completed",
          item_ids: parsed.items.map(({ id }) => id),
          evidence_ids: parsed.evidence.map(({ id }) => id),
          report_count: parsed.reports.length,
          profiles: parsed.profiles.map(({ profile }) => profile),
          onboarding: jsonRoundTrip(onboarding),
        };
      },
    });
  }

  private async commitOnboardingSkips(
    parsed: ReturnType<typeof ToolInputSchemas.hfj_commit_onboarding.parse>,
    principal: Principal,
  ): Promise<WriteResult> {
    const skips = parsed.sections.filter((section) => section.outcome === "skip");
    if (skips.length === 0) throw new AppError("VALIDATION_FAILED", "The confirmed onboarding draft has no changes");
    requireScope(principal, "journal:write");
    await requireMembership(this.store, principal, parsed.household_id, "editor");
    const requestFingerprint = this.mutationFingerprint("hfj_commit_onboarding", parsed);
    const existing = await this.store.getMutation(principal.userId, "hfj_commit_onboarding", parsed.idempotency_key);
    const replay = this.mutationReplay(existing, requestFingerprint);
    if (replay !== null) return replay;
    const requestId = existing?.requestId ?? this.requestId();
    const occurredAt = existing?.createdAt ?? this.now();
    if (existing === null) {
      const record = this.mutationRecord(requestId, principal, "hfj_commit_onboarding", parsed.idempotency_key, parsed.household_id, occurredAt);
      record.response = { _request_fingerprint: requestFingerprint, _onboarding_skips: jsonRoundTrip(skips) };
      await this.store.saveMutation(record);
    }
    const outcome = await this.store.withHouseholdLock(parsed.household_id, async (): Promise<OperationalMutationOutcome> => {
      const currentMutation = await this.store.getMutation(principal.userId, "hfj_commit_onboarding", parsed.idempotency_key);
      const lockedReplay = this.mutationReplay(currentMutation, requestFingerprint);
      if (lockedReplay !== null) return { status: "completed", result: lockedReplay };
      if (currentMutation === null) throw new AppError("INTERNAL_ERROR", "Onboarding mutation record was not found");
      await this.store.transitionMutation(requestId, "locked");
      try {
        const membership = await requireMembership(this.store, principal, parsed.household_id, "editor");
        const household = await this.requiredHousehold(parsed.household_id);
        const head = await this.repository.head(parsed.household_id);
        if (head !== parsed.expected_head) throw new AppError("REVISION_CONFLICT", "The household changed since onboarding began");
        if (household.repositoryHead !== head || membership.projectionHead !== head) throw new AppError("PROJECTION_DRIFT", "The household snapshot does not match Git", true);
        await this.validateOnboardingOutcomes(parsed.household_id, parsed.sections, []);
        await this.applyOnboardingSkips(principal.userId, parsed.household_id, skips, occurredAt);
        const data = {
          status: "completed",
          household_id: parsed.household_id,
          item_ids: [],
          evidence_ids: [],
          report_count: 0,
          profiles: [],
          onboarding: jsonRoundTrip(await this.onboardingStatus(principal.userId, parsed.household_id)),
        } satisfies Record<string, JsonValue>;
        await this.store.transitionMutation(requestId, "completed", { commitId: head, response: { ...data, _request_fingerprint: requestFingerprint } });
        return { status: "completed", result: { data, head, requestId } };
      } catch (error) {
        await this.store.transitionMutation(requestId, "failed_before_commit", { failure: errorName(error) });
        return { status: "failed", error };
      }
    });
    if (outcome.status === "failed") throw outcome.error;
    return outcome.result;
  }

  private async validateOnboardingOutcomes(
    householdId: HouseholdId,
    sections: ReadonlyArray<OnboardingCommitOutcome>,
    reports: ReadonlyArray<"recurring_snacks" | "recipe_index">,
  ): Promise<void> {
    for (const section of sections) {
      const hasReport = reports.includes(section.section === "snacks" ? "recurring_snacks" : "recipe_index")
        || await this.reportExists(householdId, section.section);
      if (section.outcome === "complete" && !hasReport) throw new AppError("VALIDATION_FAILED", "A completed onboarding section requires its canonical report");
      if (section.outcome === "skip" && hasReport) throw new AppError("VALIDATION_FAILED", "A completed onboarding section cannot be skipped");
    }
  }

  private async applyOnboardingSkips(
    userId: UserId,
    householdId: HouseholdId,
    skips: ReadonlyArray<OnboardingSkipOutcome>,
    occurredAt: string,
  ): Promise<void> {
    const records = new Map((await this.store.listOnboardingRecords(userId, householdId)).map((record) => [record.section, record]));
    for (const skip of skips) {
      const current = records.get(skip.section);
      const next = nextOnboardingSkip(current, {
        userId,
        householdId,
        skip,
        occurredAt,
      });
      if (next === null) continue;
      if (!await this.store.compareAndSetOnboarding(next, skip.expected_revision)) {
        throw new AppError("REVISION_CONFLICT", "Onboarding changed in another session");
      }
      records.set(skip.section, next);
    }
  }

  private async createInvite(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_create_family_invite.parse(input);
    const invitation = (requestId: RequestId, occurredAt: string) => {
      const token = this.mutationToken(requestId, "invitation");
      return {
        token,
        id: InvitationIdSchema.parse(this.mutationId("inv", requestId, "invitation")),
        expiresAt: new Date(Date.parse(occurredAt) + parsed.expires_in_days * 86_400_000).toISOString(),
      };
    };
    return await this.mutations.run({
      principal, tool: "hfj_create_family_invite", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_create_family_invite", parsed),
      expectedHead: parsed.expected_head, minimumRole: "owner", requiredScope: "household:manage", summary: "members: create family invitation",
      buildChanges: async (requestId, occurredAt) => {
        const planned = invitation(requestId, occurredAt);
        return [{ path: `members/invitations/${planned.id}.md`, content: markdownDocument({ id: planned.id, role: parsed.role, expires_at: planned.expiresAt, status: "pending", schema_version: 1 }, ""), appendOnly: false }];
      },
      applyProjection: async (_head, requestId, occurredAt) => {
        const planned = invitation(requestId, occurredAt);
        await this.store.saveInvitation({ id: planned.id, householdId: parsed.household_id, tokenHash: this.hasher.hash(planned.token), role: parsed.role, expiresAt: planned.expiresAt, intendedEmailHint: parsed.intended_email_hint ?? null, acceptedAt: null, revokedAt: null });
        return { status: "completed", invitation_id: planned.id, role: parsed.role, expires_at: planned.expiresAt, url: new URL(`/invite/family/${planned.token}`, this.publicOrigin).toString() };
      },
    });
  }

  private async acceptInvite(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_accept_family_invite.parse(input);
    const invitation = await this.store.findInvitationByTokenHash(this.hasher.hash(parsed.token));
    if (invitation === null) throw new AppError("NOT_FOUND", "Family invitation was not found");
    if (invitation.revokedAt !== null) throw new AppError("INVITE_REVOKED", "Family invitation was revoked");
    const existing = await this.store.getMutation(principal.userId, "hfj_accept_family_invite", parsed.idempotency_key);
    if (existing === null && (invitation.acceptedAt !== null || Date.parse(invitation.expiresAt) <= this.clock.now().getTime())) {
      throw new AppError("INVITE_EXPIRED", "Family invitation has expired or was already used");
    }
    return await this.mutations.run({
      principal, tool: "hfj_accept_family_invite", householdId: invitation.householdId, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_accept_family_invite", parsed),
      expectedHead: null, minimumRole: null, requiredScope: "household:manage", summary: "members: accept family invitation",
      buildChanges: async () => [{ path: `members/${principal.actorId}.md`, content: markdownDocument({ actor_id: principal.actorId, role: invitation.role, schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (head, _requestId, occurredAt) => {
        invitation.acceptedAt = occurredAt;
        await this.store.saveInvitation(invitation);
        await this.store.upsertMembership({ householdId: invitation.householdId, userId: principal.userId, actorId: principal.actorId, role: invitation.role, projectionHead: head, removedAt: null });
        return { status: "completed", household_id: invitation.householdId, role: invitation.role };
      },
    });
  }

  private async revokeInvite(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_revoke_family_invite.parse(input);
    const invitation = await this.store.getInvitation(parsed.invitation_id);
    if (invitation === null || invitation.householdId !== parsed.household_id) throw new AppError("NOT_FOUND", "Family invitation was not found");
    return await this.mutations.run({
      principal, tool: "hfj_revoke_family_invite", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_revoke_family_invite", parsed),
      expectedHead: parsed.expected_head, minimumRole: "owner", requiredScope: "household:manage", summary: "members: revoke family invitation",
      buildChanges: async () => [{ path: `members/invitations/${invitation.id}.md`, content: markdownDocument({ id: invitation.id, role: invitation.role, expires_at: invitation.expiresAt, status: "revoked", schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (_head, _requestId, occurredAt) => { invitation.revokedAt = occurredAt; await this.store.saveInvitation(invitation); return { status: "completed", invitation_id: invitation.id, revoked_at: occurredAt }; },
    });
  }

  private async listMembers(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_list_members.parse(input);
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    const household = await this.requiredHousehold(parsed.household_id);
    const members = await this.store.listHouseholdMemberships(parsed.household_id);
    return { data: { members: members.map((member) => ({ actor_id: member.actorId, role: member.role })) }, head: household.repositoryHead };
  }

  private async updateMember(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_update_member.parse(input);
    const member = (await this.store.listHouseholdMemberships(parsed.household_id)).find((candidate) => candidate.actorId === parsed.member_actor_id);
    if (member === undefined) throw new AppError("NOT_FOUND", "Household member was not found");
    await this.assertFinalOwner(parsed.household_id, member, parsed.role === "owner");
    return await this.mutations.run({
      principal, tool: "hfj_update_member", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_update_member", parsed),
      expectedHead: parsed.expected_head, minimumRole: "owner", requiredScope: "household:manage", summary: "members: update household role",
      buildChanges: async () => [{ path: `members/${member.actorId}.md`, content: markdownDocument({ actor_id: member.actorId, role: parsed.role, schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (head) => { member.role = parsed.role; member.projectionHead = head; await this.store.upsertMembership(member); return { status: "completed", actor_id: member.actorId, role: member.role }; },
    });
  }

  private async removeMember(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_remove_member.parse(input);
    const member = (await this.store.listHouseholdMemberships(parsed.household_id)).find((candidate) => candidate.actorId === parsed.member_actor_id);
    if (member === undefined) throw new AppError("NOT_FOUND", "Household member was not found");
    await this.assertFinalOwner(parsed.household_id, member, false);
    return await this.mutations.run({
      principal, tool: "hfj_remove_member", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_remove_member", parsed),
      expectedHead: parsed.expected_head, minimumRole: "owner", requiredScope: "household:manage", summary: "members: remove household member",
      buildChanges: async (_requestId, occurredAt) => [{ path: `members/${member.actorId}.md`, content: markdownDocument({ actor_id: member.actorId, former_member: true, removed_at: occurredAt, schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (_head, _requestId, occurredAt) => { member.removedAt = occurredAt; await this.store.upsertMembership(member); return { status: "completed", actor_id: member.actorId, removed_at: occurredAt }; },
    });
  }

  private async getProfile(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_get_profile.parse(input);
    requireScope(principal, "journal:read");
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    const household = await this.requiredHousehold(parsed.household_id);
    const profile = (await this.store.projection(parsed.household_id)).profiles.get(parsed.profile);
    return { data: { profile: parsed.profile, markdown: profile?.markdown ?? "", revision: profile?.revision ?? null }, head: household.repositoryHead };
  }

  private async updateProfile(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_update_profile.parse(input);
    return await this.mutations.run({
      principal, tool: "hfj_update_profile", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_update_profile", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "journal:write", summary: `profiles: update ${parsed.profile}`,
      buildChanges: async () => [{ path: `profiles/${parsed.profile}.md`, content: parsed.markdown.endsWith("\n") ? parsed.markdown : `${parsed.markdown}\n`, appendOnly: false }],
      applyProjection: async (head) => { (await this.store.projection(parsed.household_id)).profiles.set(parsed.profile, { markdown: parsed.markdown, revision: head }); return { status: "completed", profile: parsed.profile, revision: head }; },
    });
  }

  private async searchItems(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_search_items.parse(input);
    requireScope(principal, "journal:read");
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    const household = await this.requiredHousehold(parsed.household_id);
    const query = parsed.query.trim().toLocaleLowerCase("en-US");
    const entries = [...(await this.store.projection(parsed.household_id)).items.values()].filter(({ item }) => {
      if (parsed.kind !== undefined && item.kind !== parsed.kind) return false;
      const fields = item.kind === "recipe" ? [item.title, item.author_or_publisher, item.canonical_url] : [item.display_name, item.brand, item.product_line, item.flavor, item.formulation, item.format];
      return fields.some((field) => field?.toLocaleLowerCase("en-US").includes(query));
    }).slice(0, parsed.limit).map(({ item, revision }) => ({
      id: item.id, kind: item.kind, title: item.kind === "recipe" ? item.title : item.display_name, revision,
      distinguishing_fields: item.kind === "recipe" ? { canonical_url: item.canonical_url, author_or_publisher: item.author_or_publisher } : { brand: item.brand, flavor: item.flavor, formulation: item.formulation, format: item.format },
    }));
    return { data: { items: entries, next_cursor: null }, head: household.repositoryHead };
  }

  private async getItem(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_get_item.parse(input);
    requireScope(principal, "journal:read");
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    const household = await this.requiredHousehold(parsed.household_id);
    const entry = (await this.store.projection(parsed.household_id)).items.get(parsed.item_id);
    if (entry === undefined) throw new AppError("NOT_FOUND", "Journal item was not found");
    return { data: { item: jsonRoundTrip(entry.item), revision: entry.revision }, head: household.repositoryHead };
  }

  private async appendEvidence(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_append_evidence.parse(input);
    const projection = await this.store.projection(parsed.household_id);
    for (const evidence of parsed.evidence) {
      if (projection.evidence.has(evidence.id)) throw new AppError("REVISION_CONFLICT", `Evidence already exists: ${evidence.id}`);
      if (evidence.supersedes_evidence_id !== undefined && !projection.evidence.has(evidence.supersedes_evidence_id)) throw new AppError("VALIDATION_FAILED", "Correction evidence must reference an existing event");
    }
    const changes: RepositoryChange[] = parsed.evidence.map((evidence) => ({
      path: journalEvidencePath(evidence),
      content: stableJson(evidence), appendOnly: true,
    }));
    return await this.mutations.run({
      principal, tool: "hfj_append_evidence", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_append_evidence", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "journal:write", summary: "evidence: append journal observations",
      buildChanges: async () => changes,
      applyProjection: async () => { for (const evidence of parsed.evidence) projection.evidence.set(evidence.id, evidence); return { status: "completed", evidence_ids: parsed.evidence.map((entry) => entry.id), count: parsed.evidence.length }; },
    });
  }

  private async commitChangeSet(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_commit_change_set.parse(input);
    const projection = await this.store.projection(parsed.household_id);
    for (const item of parsed.items) {
      validateItemEvidence(item, projection.evidence);
      const current = projection.items.get(item.id);
      const expected = parsed.expected_item_revisions[item.id];
      if (current !== undefined && expected !== current.revision) throw new AppError("REVISION_CONFLICT", `Item changed: ${item.id}`);
      if (current === undefined && expected !== undefined) throw new AppError("REVISION_CONFLICT", `New item has an unexpected revision: ${item.id}`);
    }
    const ids = new Set([...projection.items.keys(), ...parsed.items.map((item) => item.id)]);
    for (const report of parsed.reports) validateReport(report, projection.evidence, ids);
    const changes: RepositoryChange[] = [
      ...parsed.items.map((item) => ({ path: journalItemPath(item), content: markdownDocument(itemFrontmatter(item), item.body_markdown), appendOnly: false })),
      ...parsed.reports.map((report) => ({ path: report.report_type === "recurring_snacks" ? "snacks/reports/recurring-snacks.md" : "recipes/reports/recipe-index.md", content: report.markdown.endsWith("\n") ? report.markdown : `${report.markdown}\n`, appendOnly: false })),
    ];
    return await this.mutations.run({
      principal, tool: "hfj_commit_change_set", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_commit_change_set", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "journal:write", summary: "journal: commit agent-authored change set",
      buildChanges: async () => changes,
      applyProjection: async (head) => { for (const item of parsed.items) projection.items.set(item.id, { item, revision: head }); return { status: "completed", item_ids: parsed.items.map((item) => item.id), report_count: parsed.reports.length }; },
    });
  }

  private async createCollection(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_create_collection.parse(input);
    const projection = await this.store.projection(parsed.household_id);
    for (const candidate of parsed.items) {
      const source = projection.items.get(candidate.source_item_id);
      if (source === undefined || source.revision !== candidate.source_item_revision) throw new AppError("REVISION_CONFLICT", `Collection source changed: ${candidate.source_item_id}`);
    }
    const collection = (requestId: RequestId, occurredAt: string) => {
      const collectionId = CollectionIdSchema.parse(this.mutationId("col", requestId, "collection"));
      const snapshotId = SnapshotIdSchema.parse(this.mutationId("snp", requestId, "snapshot"));
      const snapshot = CollectionSnapshotSchema.parse({ id: snapshotId, collection_id: collectionId, title: parsed.title, sharer_display_name: principal.displayName, items: parsed.items, created_at: occurredAt, schema_version: 1 });
      return { collectionId, snapshotId, snapshot };
    };
    return await this.mutations.run({
      principal, tool: "hfj_create_collection", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_create_collection", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "collection:share", summary: "collections: create private collection",
      buildChanges: async (requestId, occurredAt) => {
        const planned = collection(requestId, occurredAt);
        return [
          { path: `collections/${planned.collectionId}/collection.md`, content: markdownDocument({ id: planned.collectionId, title: parsed.title, current_snapshot_id: planned.snapshotId, schema_version: 1 }, ""), appendOnly: false },
          { path: `collections/${planned.collectionId}/snapshots/${planned.snapshotId}.json`, content: stableJson(planned.snapshot), appendOnly: true },
        ];
      },
      applyProjection: async (head, requestId, occurredAt) => { const planned = collection(requestId, occurredAt); projection.collections.set(planned.collectionId, { snapshot: planned.snapshot, revision: head }); return { status: "completed", collection_id: planned.collectionId, snapshot_id: planned.snapshotId }; },
    });
  }

  private async createShare(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_create_collection_share.parse(input);
    const collection = (await this.store.projection(parsed.household_id)).collections.get(parsed.collection_id);
    if (collection === undefined) throw new AppError("NOT_FOUND", "Collection was not found");
    const share = (requestId: RequestId, occurredAt: string) => ({
      token: this.mutationToken(requestId, "collection-share"),
      id: ShareIdSchema.parse(this.mutationId("shr", requestId, "collection-share")),
      expiresAt: new Date(Date.parse(occurredAt) + parsed.expires_in_days * 86_400_000).toISOString(),
    });
    return await this.mutations.run({
      principal, tool: "hfj_create_collection_share", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_create_collection_share", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "collection:share", summary: "collections: publish immutable snapshot",
      buildChanges: async (_requestId, occurredAt) => [{ path: `collections/${parsed.collection_id}/collection.md`, content: markdownDocument({ id: parsed.collection_id, title: collection.snapshot.title, current_snapshot_id: collection.snapshot.id, share_status: "active", shared_at: occurredAt, schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (_head, requestId, occurredAt) => { const planned = share(requestId, occurredAt); await this.store.saveShare({ id: planned.id, collectionId: parsed.collection_id, householdId: parsed.household_id, tokenHash: this.hasher.hash(planned.token), snapshot: collection.snapshot, expiresAt: planned.expiresAt, revokedAt: null }); return { status: "completed", collection_id: parsed.collection_id, share_id: planned.id, expires_at: planned.expiresAt, url: new URL(`/c/${planned.token}`, this.publicOrigin).toString() }; },
    });
  }

  private async revokeShare(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_revoke_collection_share.parse(input);
    const share = await this.store.getShareByCollection(parsed.household_id, parsed.collection_id);
    if (share === null) throw new AppError("NOT_FOUND", "Collection share was not found");
    return await this.mutations.run({
      principal, tool: "hfj_revoke_collection_share", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_revoke_collection_share", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "collection:share", summary: "collections: revoke public share",
      buildChanges: async (_requestId, occurredAt) => [{ path: `collections/${parsed.collection_id}/collection.md`, content: markdownDocument({ id: parsed.collection_id, title: share.snapshot.title, current_snapshot_id: share.snapshot.id, share_status: "revoked", revoked_at: occurredAt, schema_version: 1 }, ""), appendOnly: false }],
      applyProjection: async (_head, _requestId, occurredAt) => { share.revokedAt = occurredAt; await this.store.saveShare(share); return { status: "completed", collection_id: parsed.collection_id, revoked_at: occurredAt }; },
    });
  }

  private async previewSharedCollection(input: unknown): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_preview_shared_collection.parse(input);
    const share = await this.store.getShareByTokenHash(this.hasher.hash(parsed.token));
    if (share === null) throw new AppError("NOT_FOUND", "Collection was not found");
    if (share.revokedAt !== null) throw new AppError("SHARE_REVOKED", "The owner has stopped sharing this collection");
    if (Date.parse(share.expiresAt) <= this.clock.now().getTime()) throw new AppError("SHARE_EXPIRED", "This collection link has expired");
    return { data: { snapshot: jsonRoundTrip(share.snapshot), expires_at: share.expiresAt }, head: null };
  }

  private async planImport(input: unknown, principal: Principal): Promise<ReadResult> {
    const parsed = ToolInputSchemas.hfj_plan_collection_import.parse(input);
    requireScope(principal, "journal:write");
    await requireMembership(this.store, principal, parsed.destination_household_id, "editor");
    const share = await this.activeShare(parsed.token);
    const selected = share.snapshot.items.filter((item) => parsed.selected_collection_item_ids.includes(item.collection_item_id));
    if (selected.length !== new Set(parsed.selected_collection_item_ids).size) throw new AppError("VALIDATION_FAILED", "One or more selected collection items do not exist");
    const destination = [...(await this.store.projection(parsed.destination_household_id)).items.values()];
    const plans = selected.map((item) => {
      const exact = destination.filter(({ item: candidate }) => exactDuplicate(item, candidate)).map(({ item: candidate }) => candidate.id);
      const possible = exact.length > 0 ? [] : destination.filter(({ item: candidate }) => candidate.kind === item.kind && itemTitle(candidate).toLocaleLowerCase("en-US") === item.title.toLocaleLowerCase("en-US")).map(({ item: candidate }) => candidate.id);
      return { collection_item_id: item.collection_item_id, exact_duplicates: exact, possible_duplicates: possible, requires_resolution: possible.length > 0 };
    });
    return { data: { status: "completed", items: plans }, head: (await this.requiredHousehold(parsed.destination_household_id)).repositoryHead };
  }

  private async importItems(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_import_collection_items.parse(input);
    const share = await this.activeShare(parsed.token);
    const byId = new Map(share.snapshot.items.map((item) => [item.collection_item_id, item]));
    const projection = await this.store.projection(parsed.household_id);
    const plan = (requestId: RequestId, importedAt: string) => {
      const importId = ImportIdSchema.parse(this.mutationId("imp", requestId, "import"));
      const newItems: Array<{ item: import("@hfj/contracts").JournalItem; evidence: import("@hfj/contracts").Evidence }> = [];
      const mergedItems: Array<{ item: import("@hfj/contracts").JournalItem; evidence: import("@hfj/contracts").Evidence }> = [];
      parsed.selections.forEach((selection, index) => {
        const source = byId.get(selection.collection_item_id);
        if (source === undefined) throw new AppError("VALIDATION_FAILED", `Collection item does not exist: ${selection.collection_item_id}`);
        if (selection.resolution.action === "skip") return;
        const evidenceId = EvidenceIdSchema.parse(this.mutationId("evd", requestId, `evidence-${index}`));
        const evidence = importEvidence(evidenceId, source, share.snapshot.id, principal.actorId, importedAt);
        if (selection.resolution.action === "merge") {
          const destination = projection.items.get(selection.resolution.destination_item_id);
          if (destination === undefined) throw new AppError("VALIDATION_FAILED", "Merge destination does not exist");
          const evidenceIds = destination.item.evidence_ids.includes(evidenceId) ? destination.item.evidence_ids : [...destination.item.evidence_ids, evidenceId];
          mergedItems.push({ item: { ...destination.item, evidence_ids: evidenceIds, updated_at: importedAt }, evidence });
          return;
        }
        const itemId = ItemIdSchema.parse(this.mutationId("itm", requestId, `item-${index}`));
        const base = { id: itemId, evidence_ids: [evidenceId], created_at: importedAt, updated_at: importedAt, schema_version: 1 as const, body_markdown: source.public_description ?? "" };
        const item = source.kind === "recipe" ? {
          ...base, kind: "recipe" as const, title: source.title, canonical_url: source.canonical_recipe_url, audited_page_url: source.image_page_url,
          author_or_publisher: source.author_or_publisher, saved: "yes" as const, cooked: "unknown" as const, liked: "unknown" as const,
          last_cooked: null, date_precision: "unknown" as const, image_url: source.image_url, image_page_url: source.image_page_url,
        } : {
          ...base, kind: "snack" as const, display_name: source.title, brand: source.brand, product_line: null, flavor: source.flavor,
          formulation: source.formulation, format: source.format, category: "imported", produce_variety: null, known_size_variants: [], image_page_url: source.image_page_url, image_url: source.image_url,
        };
        newItems.push({ item, evidence });
      });
      const changes: RepositoryChange[] = [...newItems, ...mergedItems].flatMap(({ item, evidence }) => [
        { path: `${item.kind === "recipe" ? "recipes" : "snacks"}/evidence/${importedAt.slice(0, 4)}/${evidence.id}.json`, content: stableJson(evidence), appendOnly: true },
        { path: journalItemPath(item), content: markdownDocument(itemFrontmatter(item), item.body_markdown), appendOnly: false },
      ]);
      changes.push({ path: `imports/${importedAt.slice(0, 4)}/${importId}.json`, content: stableJson({ import_id: importId, source_collection_id: share.snapshot.collection_id, source_snapshot_id: share.snapshot.id, imported_at: importedAt, selections: parsed.selections, schema_version: 1 }), appendOnly: true });
      return { importId, newItems, mergedItems, changes };
    };
    return await this.mutations.run({
      principal, tool: "hfj_import_collection_items", householdId: parsed.household_id, idempotencyKey: parsed.idempotency_key, requestFingerprint: this.mutationFingerprint("hfj_import_collection_items", parsed),
      expectedHead: parsed.expected_head, minimumRole: "editor", requiredScope: "journal:write", summary: "imports: import selected collection items",
      buildChanges: async (requestId, occurredAt) => plan(requestId, occurredAt).changes,
      applyProjection: async (head, requestId, occurredAt) => {
        const planned = plan(requestId, occurredAt);
        for (const entry of [...planned.newItems, ...planned.mergedItems]) {
          projection.evidence.set(entry.evidence.id, entry.evidence);
          projection.items.set(entry.item.id, { item: entry.item, revision: head });
        }
        return {
          status: "completed",
          import_id: planned.importId,
          imported_item_ids: planned.newItems.map((entry) => entry.item.id),
          merged_item_ids: planned.mergedItems.map((entry) => entry.item.id),
          skipped_count: parsed.selections.filter(({ resolution }) => resolution.action === "skip").length,
        };
      },
    });
  }

  private async exportHousehold(input: unknown, principal: Principal): Promise<WriteResult> {
    const parsed = ToolInputSchemas.hfj_export_household.parse(input);
    requireScope(principal, "journal:export");
    await requireMembership(this.store, principal, parsed.household_id, "viewer");
    const requestFingerprint = this.mutationFingerprint("hfj_export_household", parsed);
    const existing = await this.store.getMutation(principal.userId, "hfj_export_household", parsed.idempotency_key);
    const replay = this.mutationReplay(existing, requestFingerprint);
    if (replay !== null) return replay;
    const prepared = await this.store.withHouseholdLock(parsed.household_id, async () => {
      const lockedExisting = await this.store.getMutation(principal.userId, "hfj_export_household", parsed.idempotency_key);
      const lockedReplay = this.mutationReplay(lockedExisting, requestFingerprint);
      if (lockedReplay !== null) return { status: "replayed" as const, result: lockedReplay };
      const requestId = lockedExisting?.requestId ?? this.requestId();
      const now = lockedExisting?.createdAt ?? this.now();
      if (lockedExisting === null) {
        await this.store.saveMutation({
          ...this.mutationRecord(requestId, principal, "hfj_export_household", parsed.idempotency_key, parsed.household_id, now),
          response: { _request_fingerprint: requestFingerprint },
        });
      }
      return { status: "pending" as const, requestId, now };
    });
    if (prepared.status === "replayed") return prepared.result;
    const failedRequestId = prepared.requestId;
    let artifactPath: string | null = null;
    try {
      return await this.store.withHouseholdLock(parsed.household_id, async () => {
        const lockedExisting = await this.store.getMutation(principal.userId, "hfj_export_household", parsed.idempotency_key);
        const lockedReplay = this.mutationReplay(lockedExisting, requestFingerprint);
        if (lockedReplay !== null) return lockedReplay;
        const { requestId, now } = prepared;
        await this.store.transitionMutation(requestId, "locked");
        await requireMembership(this.store, principal, parsed.household_id, "viewer");
        const head = await this.repository.head(parsed.household_id);
        const content = parsed.format === "readable_zip"
          ? await this.repository.readableArchive(parsed.household_id)
          : await this.repository.bundle(parsed.household_id);
        const exportId = `exp_${requestId.slice(4)}`;
        const token = this.mutationToken(requestId, "export-download");
        artifactPath = `${exportId}.bin`;
        await this.exportArtifacts.remove(artifactPath);
        const objectPath = await this.exportArtifacts.write(exportId, content);
        const expiresAt = new Date(this.clock.now().getTime() + 15 * 60_000).toISOString();
        const contentHash = createHash("sha256").update(content).digest("hex");
        const data = {
          status: "completed", format: parsed.format,
          download_url: new URL(`/exports/${token}`, this.publicOrigin).toString(),
          content_hash: contentHash, source_head: head, expires_at: expiresAt,
        } satisfies Record<string, JsonValue>;
        await this.store.saveExportDownload({
          id: exportId, householdId: parsed.household_id, requestedBy: principal.userId, format: parsed.format,
          tokenHash: this.hasher.hash(token), objectPath, contentHash, repositoryHead: head,
          expiresAt, downloadedAt: null, createdAt: now,
        });
        await this.store.transitionMutation(requestId, "completed", { commitId: head, response: { ...data, _request_fingerprint: requestFingerprint } });
        return { data, head, requestId };
      });
    } catch (error) {
      if (artifactPath !== null) await this.exportArtifacts.remove(artifactPath);
      await this.store.transitionMutation(failedRequestId, "failed_before_commit", { failure: errorName(error) });
      throw error;
    }
  }

  private mutationReplay(existing: MutationRecord | null, requestFingerprint: string): WriteResult | null {
    if (typeof existing?.response?._request_fingerprint === "string" && existing.response._request_fingerprint !== requestFingerprint) {
      throw new AppError("REVISION_CONFLICT", "The idempotency key was already used for a different request");
    }
    if (existing?.state !== "completed" || existing.response === null || existing.commitId === null) return null;
    const data = { ...existing.response };
    delete data._request_fingerprint;
    return { data, head: existing.commitId, requestId: existing.requestId };
  }

  private async onboardingStatus(userId: UserId, householdId: HouseholdId): Promise<OnboardingStatus> {
    const records = await this.store.listOnboardingRecords(userId, householdId);
    const bySection = new Map(records.map((record) => [record.section, record]));
    const [snacksComplete, recipesComplete] = await Promise.all([
      this.reportExists(householdId, "snacks"),
      this.reportExists(householdId, "recipes"),
    ]);
    return OnboardingStatusSchema.parse({
      household_id: householdId,
      snacks: this.onboardingSectionState(bySection.get("snacks"), snacksComplete),
      recipes: this.onboardingSectionState(bySection.get("recipes"), recipesComplete),
    });
  }

  private onboardingSectionState(record: OnboardingRecord | undefined, complete: boolean): OnboardingSectionState {
    if (complete) return { status: "complete", revision: record?.revision ?? 0 };
    return record === undefined ? { status: "not_started", revision: 0 } : this.stateFromRecord(record);
  }

  private stateFromRecord(record: OnboardingRecord): OnboardingSectionState {
    return record.status === "skipped"
      ? { status: "skipped", revision: record.revision, reason: record.skip_reason }
      : { status: "in_progress", revision: record.revision };
  }

  private async reportExists(householdId: HouseholdId, section: OnboardingSection): Promise<boolean> {
    const path = section === "snacks" ? "snacks/reports/recurring-snacks.md" : "recipes/reports/recipe-index.md";
    return await this.repository.read(householdId, path) !== null;
  }

  private async activeShare(token: string) {
    const share = await this.store.getShareByTokenHash(this.hasher.hash(token));
    if (share === null) throw new AppError("NOT_FOUND", "Collection was not found");
    if (share.revokedAt !== null) throw new AppError("SHARE_REVOKED", "The owner has stopped sharing this collection");
    if (Date.parse(share.expiresAt) <= this.clock.now().getTime()) throw new AppError("SHARE_EXPIRED", "This collection link has expired");
    return share;
  }

  private async assertFinalOwner(householdId: HouseholdId, member: MembershipRecord, remainsOwner: boolean): Promise<void> {
    if (member.role !== "owner" || remainsOwner) return;
    const owners = (await this.store.listHouseholdMemberships(householdId)).filter((candidate) => candidate.role === "owner");
    if (owners.length <= 1) throw new AppError("VALIDATION_FAILED", "A household must retain at least one owner");
  }

  private async updateAllHeads(householdId: HouseholdId, head: GitObjectId): Promise<void> {
    await this.store.updateHouseholdHead(householdId, head);
    for (const membership of await this.store.listHouseholdMemberships(householdId)) { membership.projectionHead = head; await this.store.upsertMembership(membership); }
  }

  private async requiredHousehold(householdId: HouseholdId) {
    const household = await this.store.getHousehold(householdId);
    if (household === null) throw new AppError("NOT_FOUND", "Household was not found");
    return household;
  }

  private async replay(principal: Principal, tool: ToolName, key: string): Promise<WriteResult | null> {
    const record = await this.store.getMutation(principal.userId, tool, key);
    return record?.state === "completed" && record.response !== null && record.commitId !== null ? { data: record.response, head: record.commitId, requestId: record.requestId } : null;
  }

  private mutationRecord(requestId: RequestId, principal: Principal, tool: ToolName, key: string, householdId: HouseholdId | null, now: string): MutationRecord {
    return { requestId, userId: principal.userId, tool, idempotencyKey: key, householdId, state: "received", commitId: null, response: null, failure: null, createdAt: now, updatedAt: now };
  }

  private write(result: WriteResult): ServiceEnvelope { return { ok: true, data: result.data, request_id: result.requestId, repository_head: result.head }; }
  private read(result: ReadResult): ServiceEnvelope { return { ok: true, data: result.data, request_id: this.requestId(), repository_head: result.head }; }
  private error(error: unknown): ServiceEnvelope {
    const requestId = this.requestId();
    if (error instanceof ZodError) return { ok: false, error: { code: "VALIDATION_FAILED", message: "Request validation failed", field_errors: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })), retryable: false, retry_after_seconds: null }, request_id: requestId };
    if (error instanceof AppError) return { ok: false, error: { code: error.code, message: error.message, field_errors: [...error.fieldErrors], retryable: error.retryable, retry_after_seconds: error.retryAfterSeconds }, request_id: requestId };
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "The request could not be completed", field_errors: [], retryable: false, retry_after_seconds: null }, request_id: requestId };
  }
  private requestId(): RequestId { return RequestIdSchema.parse(this.random.opaqueId("req")); }
  private now(): string { return this.clock.now().toISOString(); }
  private mutationId(prefix: string, requestId: RequestId, discriminator: string): string { return `${prefix}_${this.hasher.hash(`${requestId}:${discriminator}`).slice(0, 32)}`; }
  private mutationToken(requestId: RequestId, discriminator: string): string { return Buffer.from(this.hasher.hash(`${requestId}:${discriminator}`), "hex").toString("base64url"); }
  private mutationFingerprint(tool: ToolName, input: object): string { return this.hasher.hash(stableJson({ tool, input })); }
}

interface ReadResult { readonly data: JsonValue; readonly head: GitObjectId | null }
interface WriteResult { readonly data: Record<string, JsonValue>; readonly head: GitObjectId; readonly requestId: RequestId }
type OperationalMutationOutcome =
  | { readonly status: "completed"; readonly result: WriteResult }
  | { readonly status: "failed"; readonly error: unknown };

function itemFrontmatter(item: import("@hfj/contracts").JournalItem): object {
  const { body_markdown: _body, ...frontmatter } = item;
  void _body;
  return frontmatter;
}

function itemTitle(item: import("@hfj/contracts").JournalItem): string { return item.kind === "recipe" ? item.title : item.display_name; }
function itemSummary(item: import("@hfj/contracts").JournalItem, revision: GitObjectId): Record<string, JsonValue> {
  return {
    id: item.id,
    kind: item.kind,
    title: itemTitle(item),
    revision,
    distinguishing_fields: item.kind === "recipe"
      ? { canonical_url: item.canonical_url, author_or_publisher: item.author_or_publisher }
      : { brand: item.brand, flavor: item.flavor, formulation: item.formulation, format: item.format },
  };
}
function profileSnapshot(profile: { readonly markdown: string; readonly revision: GitObjectId } | undefined): Record<string, JsonValue> {
  return { markdown: profile?.markdown ?? "", revision: profile?.revision ?? null };
}
function evidenceChange(evidence: import("@hfj/contracts").Evidence): RepositoryChange {
  return {
    path: journalEvidencePath(evidence),
    content: stableJson(evidence),
    appendOnly: true,
  };
}
function profileChange(profile: "snacks" | "recipes", markdown: string): RepositoryChange {
  return { path: `profiles/${profile}.md`, content: markdown.endsWith("\n") ? markdown : `${markdown}\n`, appendOnly: false };
}
function itemChange(item: import("@hfj/contracts").JournalItem): RepositoryChange {
  return {
    path: journalItemPath(item),
    content: markdownDocument(itemFrontmatter(item), item.body_markdown),
    appendOnly: false,
  };
}
function reportChange(report: import("@hfj/contracts").Report): RepositoryChange {
  return {
    path: report.report_type === "recurring_snacks" ? "snacks/reports/recurring-snacks.md" : "recipes/reports/recipe-index.md",
    content: report.markdown.endsWith("\n") ? report.markdown : `${report.markdown}\n`,
    appendOnly: false,
  };
}
function exactDuplicate(source: import("@hfj/contracts").CollectionItem, item: import("@hfj/contracts").JournalItem): boolean {
  if (source.kind === "recipe") return item.kind === "recipe" && source.canonical_recipe_url !== null && item.canonical_url === source.canonical_recipe_url;
  if (item.kind !== "snack") return false;
  return source.title === item.display_name && source.brand === item.brand && source.flavor === item.flavor && source.formulation === item.formulation && source.format === item.format;
}
function importEvidence(
  id: import("@hfj/contracts").Evidence["id"],
  source: import("@hfj/contracts").CollectionItem,
  snapshotId: string,
  actorId: Principal["actorId"],
  importedAt: string,
): import("@hfj/contracts").Evidence {
  return {
    id,
    kind: "import",
    observed_at: importedAt,
    evidence_date: importedAt.slice(0, 10),
    date_precision: "day",
    source_type: "shared_collection",
    source_label: source.source_display_attribution ?? "Shared collection",
    stable_locator: `${snapshotId}/${source.collection_item_id}`,
    summary: `Imported ${source.title}`,
    actor_id: actorId,
    limitations: ["Import does not establish purchase, cooked, or liked status"],
    schema_version: 1,
  };
}
function jsonRoundTrip(value: object): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }
function errorName(error: unknown): string { return error instanceof Error ? error.name : "NonErrorFailure"; }
