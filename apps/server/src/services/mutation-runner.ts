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
  readonly expectedHead: GitObjectId;
  readonly minimumRole: Role;
  readonly requiredScope: "journal:write" | "household:manage" | "collection:share" | "journal:export";
  readonly summary: string;
  buildChanges(): Promise<ReadonlyArray<RepositoryChange>>;
  applyProjection(commitId: GitObjectId): Promise<Record<string, JsonValue>>;
}

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
    if (existing !== null && ["git_committed", "reconciliation_required", "quarantined"].includes(existing.state)) {
      throw new AppError("RECONCILIATION_REQUIRED", "This request committed but requires reconciliation before it can be returned", true);
    }
    const now = this.clock.now().toISOString();
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
        response: null,
        failure: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveMutation(record);
    }
    return await this.store.withHouseholdLock(options.householdId, async () => {
      await this.store.transitionMutation(requestId, "locked");
      try {
        const membership = await requireMembership(this.store, options.principal, options.householdId, options.minimumRole);
        const currentHead = await this.repository.head(options.householdId);
        if (currentHead !== options.expectedHead) throw new AppError("REVISION_CONFLICT", "The household changed while this request was being prepared");
        if (membership.projectionHead !== currentHead) throw new AppError("PROJECTION_DRIFT", "Membership projection does not match Git", true);
        const changes = await options.buildChanges();
        const commitId = await this.repository.commit(options.householdId, currentHead, changes, {
          requestId,
          householdId: options.householdId,
          actorId: options.principal.actorId,
          tool: options.tool,
          client: options.principal.client,
          summary: options.summary,
          occurredAt: now,
        });
        await this.store.transitionMutation(requestId, "git_committed", { commitId });
        try {
          const response = await options.applyProjection(commitId);
          await this.store.updateHouseholdHead(options.householdId, commitId);
          for (const member of await this.store.listHouseholdMemberships(options.householdId)) {
            member.projectionHead = commitId;
            await this.store.upsertMembership(member);
          }
          await this.store.transitionMutation(requestId, "projections_applied", { response });
          await this.store.transitionMutation(requestId, "completed", { response });
          this.telemetry.event("mutation.completed", { tool: options.tool, request_id: requestId });
          return { data: response, head: commitId, requestId };
        } catch (error) {
          await this.store.transitionMutation(requestId, "reconciliation_required", { failure: errorName(error) });
          throw new AppError("RECONCILIATION_REQUIRED", "The Git commit succeeded but projections require reconciliation", true);
        }
      } catch (error) {
        const current = await this.store.getMutation(options.principal.userId, options.tool, options.idempotencyKey);
        if (current !== null && current.commitId === null) await this.store.transitionMutation(requestId, "failed_before_commit", { failure: errorName(error) });
        throw error;
      }
    });
  }
}

function errorName(error: unknown): string { return error instanceof Error ? error.name : "NonErrorFailure"; }
