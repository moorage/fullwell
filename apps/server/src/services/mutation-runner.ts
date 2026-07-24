import type { GitObjectId, HouseholdId, RequestId, Role, ToolName } from "@hfj/contracts";
import { RequestIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { Clock, HouseholdRepositoryPort, OperationalStorePort, RandomSource, RepositoryChange, TelemetryPort } from "../core/ports.js";
import type { JsonValue, MutationRecord, Principal } from "../core/types.js";
import { requireMembership, requireScope } from "../domain/authorization.js";

interface MutationOptionsBase {
  readonly principal: Principal;
  readonly tool: ToolName;
  readonly householdId: HouseholdId;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly minimumRole: Role | null;
  readonly requiredScope: "journal:write" | "household:manage" | "collection:share" | "journal:export";
  readonly summary: string;
  readonly recoveryData?: Record<string, JsonValue>;
  readonly enforceFingerprintOnReplay?: boolean;
  buildChanges(requestId: RequestId, occurredAt: string): Promise<ReadonlyArray<RepositoryChange>>;
  applyProjection(commitId: GitObjectId, requestId: RequestId, occurredAt: string): Promise<Record<string, JsonValue>>;
}

type MutationOptions = MutationOptionsBase & (
  | {
      readonly conflictPolicy?: "strict_expected_head";
      readonly expectedHead: GitObjectId | null;
    }
  | {
      readonly conflictPolicy: "append_to_current_head";
      readonly expectedHead?: never;
    }
);

type MutationOutcome =
  | { readonly status: "completed"; readonly data: Record<string, JsonValue>; readonly head: GitObjectId; readonly requestId: RequestId }
  | { readonly status: "failed"; readonly error: unknown };

export class MutationRunner {
  constructor(
    private readonly store: OperationalStorePort,
    private readonly repository: HouseholdRepositoryPort,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly telemetry: TelemetryPort,
  ) {}

  async run(options: MutationOptions): Promise<{ data: Record<string, JsonValue>; head: GitObjectId; requestId: RequestId }> {
    const startedAt = performance.now();
    requireScope(options.principal, options.requiredScope);
    const existing = await this.store.getMutation(options.principal.userId, options.tool, options.idempotencyKey);
    const replay = this.replay(options, existing);
    if (replay !== null) return replay;
    const now = existing?.createdAt ?? this.clock.now().toISOString();
    const requestId = existing?.requestId ?? RequestIdSchema.parse(this.random.opaqueId("req"));
    if (existing === null) {
      const record: MutationRecord = {
        requestId,
        userId: options.principal.userId,
        tool: options.tool,
        idempotencyKey: options.idempotencyKey,
        householdId: options.householdId,
        state: "received",
        commitId: null,
        response: { _request_fingerprint: options.requestFingerprint, ...options.recoveryData },
        failure: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveMutation(record);
    }
    const lockStartedAt = performance.now();
    const outcome = await this.store.withHouseholdLock(options.householdId, async (): Promise<MutationOutcome> => {
      const lockedExisting = await this.store.getMutation(options.principal.userId, options.tool, options.idempotencyKey);
      if (lockedExisting === null) throw new AppError("INTERNAL_ERROR", "Mutation record was not found after receipt");
      const lockedReplay = this.replay(options, lockedExisting);
      if (lockedReplay !== null) return { status: "completed", ...lockedReplay };
      const lockedRequestId = lockedExisting.requestId;
      const lockedNow = lockedExisting.createdAt;
      this.telemetry.event("mutation.lock_acquired", { tool: options.tool, request_id: lockedRequestId, duration_ms: Math.round(performance.now() - lockStartedAt) });
      await this.store.transitionMutation(lockedRequestId, "locked");
      let commitId = lockedExisting.commitId ?? await this.repository.findCommitByRequestId(options.householdId, lockedRequestId);
      try {
        if (commitId === null) {
          const currentHead = await this.repository.head(options.householdId);
          if (options.conflictPolicy !== "append_to_current_head"
            && options.expectedHead !== null
            && currentHead !== options.expectedHead) {
            throw new AppError("REVISION_CONFLICT", "The household changed while this request was being prepared");
          }
          if (options.minimumRole !== null) {
            const membership = await requireMembership(this.store, options.principal, options.householdId, options.minimumRole);
            if (membership.projectionHead !== currentHead) throw new AppError("PROJECTION_DRIFT", "Membership projection does not match Git", true);
          }
          const changes = await options.buildChanges(lockedRequestId, lockedNow);
          if (options.conflictPolicy === "append_to_current_head"
            && (changes.length !== 1 || changes[0]?.appendOnly !== true)) {
            throw new AppError("INTERNAL_ERROR", "Current-head appends require exactly one append-only repository change");
          }
          commitId = await this.repository.commit(options.householdId, currentHead, changes, {
            requestId: lockedRequestId,
            householdId: options.householdId,
            actorId: options.principal.actorId,
            tool: options.tool,
            client: options.principal.client,
            summary: options.summary,
            occurredAt: lockedNow,
          });
        }
        await this.store.transitionMutation(lockedRequestId, "git_committed", { commitId });
        try {
          const response = await options.applyProjection(commitId, lockedRequestId, lockedNow);
          const storedResponse = this.enforcesFingerprint(options)
            ? { ...response, _request_fingerprint: options.requestFingerprint }
            : response;
          await this.store.updateHouseholdHead(options.householdId, commitId);
          for (const member of await this.store.listHouseholdMemberships(options.householdId)) {
            member.projectionHead = commitId;
            await this.store.upsertMembership(member);
          }
          await this.store.transitionMutation(lockedRequestId, "projections_applied", { response: storedResponse });
          await this.store.transitionMutation(lockedRequestId, "completed", { response: storedResponse });
          this.telemetry.event("mutation.completed", { tool: options.tool, request_id: lockedRequestId, duration_ms: Math.round(performance.now() - startedAt) });
          return { status: "completed", data: response, head: commitId, requestId: lockedRequestId };
        } catch (error) {
          await this.store.transitionMutation(lockedRequestId, "reconciliation_required", { failure: errorName(error) });
          return { status: "failed", error: new AppError("RECONCILIATION_REQUIRED", "The Git commit succeeded but projections require reconciliation", true) };
        }
      } catch (error) {
        if (commitId === null) {
          await this.store.transitionMutation(lockedRequestId, "failed_before_commit", { failure: errorName(error) });
          return { status: "failed", error };
        }
        await this.store.transitionMutation(lockedRequestId, "reconciliation_required", { commitId, failure: errorName(error) });
        return { status: "failed", error: new AppError("RECONCILIATION_REQUIRED", "The Git commit succeeded but projections require reconciliation", true) };
      }
    });
    if (outcome.status === "failed") {
      const error = outcome.error instanceof Error ? outcome.error : new Error("Mutation failed");
      this.telemetry.error("mutation.failed", error, { tool: options.tool, request_id: requestId, duration_ms: Math.round(performance.now() - startedAt), error_code: errorName(outcome.error) });
      throw outcome.error;
    }
    return { data: outcome.data, head: outcome.head, requestId: outcome.requestId };
  }

  private replay(
    options: MutationOptions,
    existing: MutationRecord | null,
  ): { data: Record<string, JsonValue>; head: GitObjectId; requestId: RequestId } | null {
    const fingerprint = existing?.response?._request_fingerprint;
    if (existing !== null && typeof fingerprint === "string" && fingerprint !== options.requestFingerprint
      && (this.enforcesFingerprint(options) || existing.state !== "completed")) {
      this.telemetry.event("mutation.conflict", { tool: options.tool, request_id: existing.requestId, error_code: "REVISION_CONFLICT" });
      throw new AppError("REVISION_CONFLICT", "The idempotency key was already used for a different request");
    }
    if (existing?.state === "completed" && existing.response !== null && existing.commitId !== null) {
      this.telemetry.event("mutation.replayed", { tool: options.tool, request_id: existing.requestId });
      const data = { ...existing.response };
      if (this.enforcesFingerprint(options)) delete data._request_fingerprint;
      return { data, head: existing.commitId, requestId: existing.requestId };
    }
    if (existing?.state === "quarantined") {
      throw new AppError("RECONCILIATION_REQUIRED", "This request is quarantined for operator review", false);
    }
    return null;
  }

  private enforcesFingerprint(options: MutationOptions): boolean {
    return options.enforceFingerprintOnReplay === true || options.conflictPolicy === "append_to_current_head";
  }
}

function errorName(error: unknown): string { return error instanceof Error ? error.name : "NonErrorFailure"; }
