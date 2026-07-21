import {
  HouseholdIdSchema,
  OnboardingRecordSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { transitionOnboarding } from "./onboarding.js";

const userId = UserIdSchema.parse("usr_0000000000000701");
const householdId = HouseholdIdSchema.parse("hsh_0000000000000701");
const occurredAt = "2026-07-21T20:00:00.000Z";

describe("onboarding transitions", () => {
  it("starts or skips a new section and increments its revision", () => {
    expect(transitionOnboarding(undefined, {
      userId, householdId, section: "snacks", transition: { action: "start" }, expectedRevision: 0, occurredAt,
    })).toMatchObject({ status: "in_progress", revision: 1, skip_reason: null });
    expect(transitionOnboarding(undefined, {
      userId, householdId, section: "recipes", transition: { action: "skip", reason: "no_sources" }, expectedRevision: 0, occurredAt,
    })).toMatchObject({ status: "skipped", revision: 1, skip_reason: "no_sources" });
  });

  it("resumes only skipped sections and rejects stale revisions", () => {
    const skipped = OnboardingRecordSchema.parse({
      user_id: userId, household_id: householdId, section: "recipes", status: "skipped",
      skip_reason: "not_now", revision: 2, updated_at: occurredAt,
    });
    expect(transitionOnboarding(skipped, {
      userId, householdId, section: "recipes", transition: { action: "resume" }, expectedRevision: 2, occurredAt,
    })).toMatchObject({ status: "in_progress", revision: 3, skip_reason: null });
    expect(() => transitionOnboarding(skipped, {
      userId, householdId, section: "recipes", transition: { action: "resume" }, expectedRevision: 1, occurredAt,
    })).toThrow("Onboarding changed in another session");
    expect(() => transitionOnboarding(undefined, {
      userId, householdId, section: "recipes", transition: { action: "resume" }, expectedRevision: 0, occurredAt,
    })).toThrow("not available");
    expect(() => transitionOnboarding(skipped, {
      userId, householdId, section: "recipes", transition: { action: "start" }, expectedRevision: 2, occurredAt,
    })).toThrow("not available");
    expect(() => transitionOnboarding(skipped, {
      userId, householdId, section: "recipes", transition: { action: "skip", reason: "user_declined" }, expectedRevision: 2, occurredAt,
    })).toThrow("not available");
  });
});
