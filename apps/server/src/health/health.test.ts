import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { FixedClock, HmacTokenHasher } from "../adapters/providers.js";
import { createOperatorAuthenticator, HealthService } from "./health.js";

class DegradedOperationalStore extends MemoryOperationalStore {
  override async operatorHealth() {
    return {
      incompleteMutationCount: 2,
      reconciliationRequiredCount: 1,
      oldestIncompleteMutationAt: "2026-07-15T11:50:00.000Z",
      quarantinedHouseholdCount: 1,
      householdCount: 2,
      householdsWithoutBackup: 1,
      oldestBackupAt: "2026-07-14T10:00:00.000Z",
      schemaVersion: "old",
    };
  }
}

describe("HealthService", () => {
  it("reports bounded operator state and authenticates a dedicated credential", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-health-"));
    try {
      await writeFile(join(root, ".hfj-volume-id"), "volume-test\n");
      const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
      const service = new HealthService(new MemoryOperationalStore(), new MemoryHouseholdRepository(), { clock, expectedSchemaVersion: "memory", repositoryRoot: root, signingConfigured: true });
      await expect(service.readiness()).resolves.toMatchObject({ ready: true });
      await expect(service.operatorHealth()).resolves.toMatchObject({
        status: "healthy",
        checked_at: "2026-07-15T12:00:00.000Z",
        reconciliation: { incomplete_mutations: 0, quarantined_households: 0 },
        backup: { households_without_backup: 0 },
        volume: { writable: true, identityMarkerPresent: true },
      });

      const authenticate = createOperatorAuthenticator("operator-token-that-is-long-enough-0001", new HmacTokenHasher("operator-test-pepper-that-is-long-enough"));
      expect(() => authenticate("Bearer operator-token-that-is-long-enough-0001")).not.toThrow();
      expect(() => authenticate("Bearer wrong-token")).toThrow(/Operator authentication/);
      expect(() => authenticate("Basic wrong-token")).toThrow(/Operator authentication/);
      expect(() => authenticate(undefined)).toThrow(/Operator authentication/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails readiness closed and reports stale operational state without private data", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-health-degraded-"));
    try {
      const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
      const service = new HealthService(new DegradedOperationalStore(), new MemoryHouseholdRepository(), {
        clock, expectedSchemaVersion: "0004", repositoryRoot: root, signingConfigured: false,
      });
      await expect(service.readiness()).resolves.toMatchObject({
        ready: false,
        checks: {
          volume: { ready: false, detail: "identity_marker_missing" },
          signing: { ready: false, detail: "not_configured" },
          schema: { ready: false, detail: "old" },
        },
      });
      await expect(service.operatorHealth()).resolves.toMatchObject({
        status: "degraded",
        reconciliation: { healthy: false, oldest_incomplete_age_seconds: 600, quarantined_households: 1 },
        backup: { healthy: false, households_without_backup: 1, oldest_backup_age_seconds: 93_600 },
        volume: { identityMarkerPresent: false },
      });
      const basic = new HealthService(new MemoryOperationalStore(), new MemoryHouseholdRepository());
      await expect(basic.readiness()).resolves.toMatchObject({ ready: true });
      await expect(basic.operatorHealth()).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
