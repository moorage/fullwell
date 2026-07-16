import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ActorIdSchema, HouseholdIdSchema } from "@hfj/contracts";
import { MemoryHouseholdRepository, MemoryOperationalStore } from "../adapters/memory.js";
import { FixedClock } from "../adapters/providers.js";
import type { BackupPort, TelemetryPort } from "../core/ports.js";
import { BackupCryptography } from "./backup-cryptography.js";
import { BackupManifestSchema, BackupService, type BackupRestoreVerifier } from "./backup-service.js";

class MemoryBackup implements BackupPort {
  input: Parameters<BackupPort["upload"]>[0] | null = null;
  async upload(input: Parameters<BackupPort["upload"]>[0]) {
    this.input = input;
    return { objectKey: "backups/household.bundle.jwe", manifestObjectKey: "backups/household.manifest.jwe", verifiedAt: input.completedAt };
  }
  async download() {
    if (this.input === null) throw new Error("Backup was not uploaded");
    return { bundle: this.input.bundle, signedManifest: this.input.signedManifest };
  }
}

const telemetryEvent = vi.fn<TelemetryPort["event"]>();
const telemetryError = vi.fn<TelemetryPort["error"]>();
const telemetry: TelemetryPort = { event: telemetryEvent, error: telemetryError };

describe("BackupService", () => {
  it("verifies, signs, uploads, and checkpoints an immutable repository bundle", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000401");
    const repository = new MemoryHouseholdRepository();
    const head = await repository.provision(householdId, "Kitchen", ActorIdSchema.parse("act_0000000000000401"), "2026-07-15T12:00:00.000Z");
    const store = new MemoryOperationalStore();
    const backup = new MemoryBackup();
    const cryptography = testCryptography();
    const verifyRestore = vi.fn<BackupRestoreVerifier["verify"]>();
    const restoreVerifier: BackupRestoreVerifier = { verify: verifyRestore };
    const service = new BackupService(repository, backup, store, cryptography, restoreVerifier, new FixedClock(new Date("2026-07-15T13:00:00.000Z")), telemetry, 35);

    const result = await service.backupHousehold(householdId);

    expect(result).toMatchObject({ repositoryHead: head, bundleHash: expect.stringMatching(/^[a-f0-9]{64}$/), retainedUntil: "2026-08-19T13:00:00.000Z" });
    expect(await store.getBackupCheckpoint(householdId)).toEqual(result);
    const manifest = BackupManifestSchema.parse(JSON.parse(await cryptography.verifyManifest(backup.input?.signedManifest ?? "")));
    expect(manifest).toMatchObject({ household_id: householdId, repository_head: head, object_count: 3 });

    await expect(service.restoreDrill(householdId)).resolves.toMatchObject({ householdId, repositoryHead: head });
    expect(verifyRestore).toHaveBeenCalledOnce();
    await expect(store.operatorHealth()).resolves.toMatchObject({ householdsWithoutBackup: 0, lastRestoreDrillSucceeded: true });
  });

  it("persists failed verification and does not upload an invalid repository", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000402");
    const repository = new MemoryHouseholdRepository();
    await repository.provision(householdId, "Kitchen", ActorIdSchema.parse("act_0000000000000402"), "2026-07-15T12:00:00.000Z");
    vi.spyOn(repository, "verify").mockResolvedValue({ valid: false, detail: "failed" });
    const backup = new MemoryBackup();
    const service = new BackupService(repository, backup, new MemoryOperationalStore(), testCryptography(), { verify: vi.fn() }, new FixedClock(new Date("2026-07-15T13:00:00.000Z")), telemetry, 35);

    await expect(service.backupHousehold(householdId)).rejects.toThrow("Repository verification failed before backup");
    expect(backup.input).toBeNull();
  });

  it("records a failed restore drill when stored content is altered", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000403");
    const repository = new MemoryHouseholdRepository();
    await repository.provision(householdId, "Kitchen", ActorIdSchema.parse("act_0000000000000403"), "2026-07-15T12:00:00.000Z");
    const store = new MemoryOperationalStore();
    const backup = new MemoryBackup();
    const service = new BackupService(repository, backup, store, testCryptography(), { verify: vi.fn() }, new FixedClock(new Date("2026-07-15T13:00:00.000Z")), telemetry, 35);
    await service.backupHousehold(householdId);
    if (backup.input === null) throw new Error("Expected backup input");
    backup.input = { ...backup.input, bundle: Buffer.from("altered") };

    await expect(service.restoreDrill(householdId)).rejects.toThrow(/hash/);
    await expect(store.operatorHealth()).resolves.toMatchObject({ lastRestoreDrillSucceeded: false });
  });

  it("backs up stale households, skips fresh unchanged heads, and reports failures", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000404");
    const repository = new MemoryHouseholdRepository();
    const head = await repository.provision(householdId, "Kitchen", ActorIdSchema.parse("act_0000000000000404"), "2026-07-15T12:00:00.000Z");
    const store = new MemoryOperationalStore();
    vi.spyOn(store, "listHouseholds").mockResolvedValue([{ id: householdId, name: "Kitchen", repositoryHead: head, provisioningState: "ready", createdAt: "2026-07-15T12:00:00.000Z" }]);
    const clock = new FixedClock(new Date("2026-07-15T13:00:00.000Z"));
    const service = new BackupService(repository, new MemoryBackup(), store, testCryptography(), { verify: vi.fn() }, clock, telemetry, 35);

    await expect(service.run()).resolves.toEqual({ checked: 1, completed: 1, skipped: 0, failed: 0 });
    await expect(service.run()).resolves.toEqual({ checked: 1, completed: 0, skipped: 1, failed: 0 });
    clock.advance(24 * 60 * 60 * 1_000);
    vi.spyOn(repository, "verifySignatures").mockResolvedValue({ valid: false, detail: "failed" });
    await expect(service.run()).resolves.toEqual({ checked: 1, completed: 0, skipped: 0, failed: 1 });
    vi.spyOn(repository, "head").mockRejectedValue("non-error provider failure");
    await expect(service.run()).resolves.toEqual({ checked: 1, completed: 0, skipped: 0, failed: 1 });
    expect(telemetryError).toHaveBeenCalled();
  });

  it("requires a durable checkpoint before starting a restore drill", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000405");
    const service = new BackupService(new MemoryHouseholdRepository(), new MemoryBackup(), new MemoryOperationalStore(), testCryptography(), { verify: vi.fn() }, new FixedClock(new Date()), telemetry, 35);
    await expect(service.restoreDrill(householdId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

function testCryptography(): BackupCryptography {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return new BackupCryptography(
    Buffer.alloc(32, 7).toString("base64url"),
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey.export({ type: "spki", format: "pem" }).toString(),
    "backup-test-key",
  );
}
