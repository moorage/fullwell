import { OnboardingSkipOutcomeSchema, type HouseholdId, type RequestId, type UserId } from "@hfj/contracts";
import { z } from "zod";
import type { HouseholdRepositoryPort, OperationalStorePort, TelemetryPort } from "../core/ports.js";
import type { MutationRecord } from "../core/types.js";
import { rebuildRepositoryState } from "../domain/repository-projection.js";
import { nextOnboardingSkip } from "../domain/onboarding.js";

const RecoveredSkipsSchema = z.array(OnboardingSkipOutcomeSchema).max(2);

export interface ReconciliationResult {
  readonly checked: number;
  readonly rebuilt: number;
  readonly quarantined: number;
}

/** Rebuilds disposable household state from Git while holding the household writer lock. */
export class ReconciliationWorker {
  constructor(
    private readonly store: OperationalStorePort,
    private readonly repository: HouseholdRepositoryPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async checkHealth(): Promise<void> {
    const health = await this.store.health();
    if (!health.ready) this.telemetry.event("reconciliation.blocked", { reason: health.detail });
  }

  async run(): Promise<ReconciliationResult> {
    const health = await this.store.health();
    if (!health.ready) {
      this.telemetry.event("reconciliation.blocked", { reason: health.detail });
      return { checked: 0, rebuilt: 0, quarantined: 0 };
    }
    let rebuilt = 0;
    let quarantined = 0;
    const households = await this.store.listHouseholds();
    for (const household of households) {
      const result = await this.reconcile(household.id);
      if (result === "rebuilt") rebuilt += 1;
      if (result === "quarantined") quarantined += 1;
    }
    return { checked: households.length, rebuilt, quarantined };
  }

  private async reconcile(householdId: HouseholdId): Promise<"unchanged" | "rebuilt" | "quarantined"> {
    const outcome = await this.store.withHouseholdLock(householdId, async () => {
      const mutations = await this.store.listMutationsForReconciliation(householdId);
      try {
        const verification = await this.repository.verify(householdId);
        if (!verification.valid) throw new Error("Repository verification failed");
        const snapshot = await this.repository.snapshot(householdId);
        const commits = new Map<RequestId, Awaited<ReturnType<HouseholdRepositoryPort["findCommitByRequestId"]>>>();
        for (const mutation of mutations) commits.set(mutation.requestId, await this.repository.findCommitByRequestId(householdId, mutation.requestId));
        const missingCommittedMutation = mutations.find((mutation) =>
          ["git_committed", "reconciliation_required"].includes(mutation.state) && commits.get(mutation.requestId) === null,
        );
        if (missingCommittedMutation !== undefined) throw new Error("Recorded mutation commit is absent from Git main");
        const mutationUsers = new Map<RequestId, UserId>(mutations.map((mutation) => [mutation.requestId, mutation.userId]));
        const rebuilt = rebuildRepositoryState(snapshot, mutationUsers);
        const actorIds = new Set(rebuilt.memberships.map((membership) => membership.actorId));
        const activeMemberships = await this.store.listHouseholdMemberships(householdId);
        if (activeMemberships.some((membership) => !actorIds.has(membership.actorId))) throw new Error("Active database membership is absent from Git");
        const activeByActor = new Map(activeMemberships.map((membership) => [membership.actorId, membership]));
        if (rebuilt.memberships.some((membership) => membership.role !== null && membership.userId === null && !activeByActor.has(membership.actorId))) {
          throw new Error("Git membership has no recoverable private identity mapping");
        }
        const household = await this.store.getHousehold(householdId);
        const currentProjection = await this.store.projection(householdId);
        const needsRebuild = household?.repositoryHead !== snapshot.head
          || activeMemberships.some((membership) => membership.projectionHead !== snapshot.head)
          || rebuilt.memberships.some((membership) => membership.role !== null && activeByActor.get(membership.actorId)?.role !== membership.role)
          || !projectionsEqual(currentProjection, rebuilt.projection)
          || [...commits.values()].some((commit) => commit !== null);
        for (const mutation of mutations) {
          if (commits.get(mutation.requestId) === null) await this.store.transitionMutation(mutation.requestId, "failed_before_commit", { failure: "AbandonedBeforeCommit" });
        }
        if (!needsRebuild) return { status: "unchanged" as const };
        await this.store.replaceHouseholdProjection(householdId, snapshot.head, rebuilt.projection, rebuilt.memberships);
        for (const mutation of mutations) {
          const commitId = commits.get(mutation.requestId);
          if (commitId !== null && commitId !== undefined) {
            await this.applyRecoveredOnboardingSkips(mutation, householdId);
            await this.store.transitionMutation(mutation.requestId, "git_committed", { commitId });
            await this.store.transitionMutation(mutation.requestId, "projections_applied", { commitId });
          }
        }
        return { status: "rebuilt" as const };
      } catch (error) {
        await this.store.quarantineHousehold(householdId);
        for (const mutation of mutations) await this.store.transitionMutation(mutation.requestId, "quarantined", { failure: errorName(error) });
        return { status: "quarantined" as const, error: toError(error) };
      }
    });
    if (outcome.status === "rebuilt") this.telemetry.event("reconciliation.completed", { household_id: householdId });
    if (outcome.status === "quarantined") this.telemetry.error("reconciliation.quarantined", outcome.error, { household_id: householdId });
    return outcome.status;
  }

  private async applyRecoveredOnboardingSkips(mutation: MutationRecord, householdId: HouseholdId): Promise<void> {
    if (mutation.tool !== "hfj_commit_onboarding") return;
    const parsed = RecoveredSkipsSchema.safeParse(mutation.response?._onboarding_skips ?? []);
    if (!parsed.success) throw new Error("Onboarding recovery metadata is invalid");
    const records = new Map((await this.store.listOnboardingRecords(mutation.userId, householdId)).map((record) => [record.section, record]));
    for (const skip of parsed.data) {
      const next = nextOnboardingSkip(records.get(skip.section), {
        userId: mutation.userId,
        householdId,
        skip,
        occurredAt: mutation.createdAt,
      });
      if (next === null) continue;
      if (!await this.store.compareAndSetOnboarding(next, skip.expected_revision)) throw new Error("Onboarding recovery revision conflict");
      records.set(skip.section, next);
    }
  }
}

function toError(error: unknown): Error { return error instanceof Error ? error : new Error("Non-error reconciliation failure"); }
function errorName(error: unknown): string { return error instanceof Error ? error.name : "NonErrorFailure"; }

function projectionsEqual(left: Awaited<ReturnType<OperationalStorePort["projection"]>>, right: Awaited<ReturnType<OperationalStorePort["projection"]>>): boolean {
  return mapsEqual(left.evidence, right.evidence)
    && mapsEqual(left.items, right.items)
    && mapsEqual(left.profiles, right.profiles)
    && mapsEqual(left.collections, right.collections);
}

function mapsEqual(left: ReadonlyMap<string, object>, right: ReadonlyMap<string, object>): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) if (JSON.stringify(value) !== JSON.stringify(right.get(key))) return false;
  return true;
}
