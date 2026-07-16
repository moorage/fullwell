import type { GitObjectId, HouseholdId, RequestId, Role, ToolName } from "@hfj/contracts";
import { RequestIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { Clock, HouseholdRepositoryPort, OperationalStorePort, RandomSource, RepositoryChange, TelemetryPort } from "../core/ports.js";
import type { JsonValue, MutationRecord, Principal } from "../core/types.js";
import { requireMembership, requireScope } from "../domain/authorization.js";

interface MutationOptions {
  readonly principal: Principal;
  readonly tool: ToolName;
  readonly householdId: HouseholdId;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly expectedHead: GitObjectId | null;
  readonly minimumRole: Role | null;
  readonly requiredScope: "journal:write" | "household:manage" | "collection:share" | "journal:export";
  readonly summary: string;
  buildChanges(requestId: RequestId, occurredAt: string): Promise<ReadonlyArray<RepositoryChange>>;
  applyProjection(commitId: GitObjectId, requestId: RequestId, occurredAt: string): Promise<Record<string, JsonValue>>;
}

type MutationOutcome =
  | { readonly status: "completed"; readonly data: Record<string, JsonValue>; readonly head: GitObjectId }
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
    requireScope(options.principal, options.requiredScope);
    const existing = await this.store.getMutation(options.principal.userId, options.tool, options.idempotencyKey);
    if (existing?.state === "completed" && existing.response !== null && existing.commitId !== null) {
      return { data: existing.response, head: existing.commitId, requestId: existing.requestId };
    }
    if (typeof existing?.response?._request_fingerprint === "string" && existing.response._request_fingerprint !== options.requestFingerprint) {
      throw new AppError("REVISION_CONFLICT", "The idempotency key was already used for a different request");
    }
    if (existing?.state === "quarantined") {
      throw new AppError("RECONCILIATION_REQUIRED", "This request is quarantined for operator review", false);
    }
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
        response: { _request_fingerprint: options.requestFingerprint },
        failure: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveMutation(record);
    }
    const outcome = await this.store.withHouseholdLock(options.householdId, async (): Promise<MutationOutcome> => {
      await this.store.transitionMutation(requestId, "locked");
      let commitId = existing?.commitId ?? await this.repository.findCommitByRequestId(options.householdId, requestId);
      try {
        if (commitId === null) {
          const currentHead = await this.repository.head(options.householdId);
          if (options.expectedHead !== null && currentHead !== options.expectedHead) throw new AppError("REVISION_CONFLICT", "The household changed while this request was being prepared");
          if (options.minimumRole !== null) {
            const membership = await requireMembership(this.store, options.principal, options.householdId, options.minimumRole);
            if (membership.projectionHead !== currentHead) throw new AppError("PROJECTION_DRIFT", "Membership projection does not match Git", true);
          }
          const changes = await options.buildChanges(requestId, now);
          commitId = await this.repository.commit(options.householdId, currentHead, changes, {
            requestId,
            householdId: options.householdId,
            actorId: options.principal.actorId,
            tool: options.tool,
            client: options.principal.client,
            summary: options.summary,
            occurredAt: now,
          });
        }
        await this.store.transitionMutation(requestId, "git_committed", { commitId });
        try {
          const response = await options.applyProjection(commitId, requestId, now);
          await this.store.updateHouseholdHead(options.householdId, commitId);
          for (const member of await this.store.listHouseholdMemberships(options.householdId)) {
            member.projectionHead = commitId;
            await this.store.upsertMembership(member);
          }
          await this.store.transitionMutation(requestId, "projections_applied", { response });
          await this.store.transitionMutation(requestId, "completed", { response });
          this.telemetry.event("mutation.completed", { tool: options.tool, request_id: requestId });
          return { status: "completed", data: response, head: commitId };
        } catch (error) {
          await this.store.transitionMutation(requestId, "reconciliation_required", { failure: errorName(error) });
          return { status: "failed", error: new AppError("RECONCILIATION_REQUIRED", "The Git commit succeeded but projections require reconciliation", true) };
        }
      } catch (error) {
        if (commitId === null) {
          await this.store.transitionMutation(requestId, "failed_before_commit", { failure: errorName(error) });
          return { status: "failed", error };
        }
        await this.store.transitionMutation(requestId, "reconciliation_required", { commitId, failure: errorName(error) });
        return { status: "failed", error: new AppError("RECONCILIATION_REQUIRED", "The Git commit succeeded but projections require reconciliation", true) };
      }
    });
    if (outcome.status === "failed") throw outcome.error;
    return { data: outcome.data, head: outcome.head, requestId };
  }
}

function errorName(error: unknown): string { return error instanceof Error ? error.name : "NonErrorFailure"; }
