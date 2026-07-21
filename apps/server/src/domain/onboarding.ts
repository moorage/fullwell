import {
  OnboardingRecordSchema,
  type HouseholdId,
  type OnboardingAction,
  type OnboardingRecord,
  type OnboardingSection,
  type UserId,
} from "@hfj/contracts";
import { AppError } from "../core/errors.js";

export function transitionOnboarding(
  current: OnboardingRecord | undefined,
  input: {
    readonly userId: UserId;
    readonly householdId: HouseholdId;
    readonly section: OnboardingSection;
    readonly transition: OnboardingAction;
    readonly expectedRevision: number;
    readonly occurredAt: string;
  },
): OnboardingRecord {
  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== input.expectedRevision) {
    throw new AppError("REVISION_CONFLICT", "Onboarding changed in another session");
  }

  if (input.transition.action === "start") {
    if (current !== undefined) throw invalidTransition();
    return record(input, "in_progress", null);
  }
  if (input.transition.action === "resume") {
    if (current?.status !== "skipped") throw invalidTransition();
    return record(input, "in_progress", null);
  }
  if (current?.status === "skipped") throw invalidTransition();
  return record(input, "skipped", input.transition.reason);
}

function record(
  input: {
    readonly userId: UserId;
    readonly householdId: HouseholdId;
    readonly section: OnboardingSection;
    readonly expectedRevision: number;
    readonly occurredAt: string;
  },
  status: "in_progress" | "skipped",
  skipReason: "not_now" | "no_sources" | "user_declined" | null,
): OnboardingRecord {
  return OnboardingRecordSchema.parse({
    user_id: input.userId,
    household_id: input.householdId,
    section: input.section,
    status,
    skip_reason: skipReason,
    revision: input.expectedRevision + 1,
    updated_at: input.occurredAt,
  });
}

function invalidTransition(): AppError {
  return new AppError("VALIDATION_FAILED", "That onboarding transition is not available from the current state");
}
