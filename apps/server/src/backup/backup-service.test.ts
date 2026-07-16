import { describe, expect, it, vi } from "vitest";
import { ActorIdSchema, HouseholdIdSchema } from "@hfj/contracts";
import { MemoryHouseholdRepository } from "../adapters/memory.js";
import { FixedClock } from "../adapters/providers.js";
import type { BackupPort } from "../core/ports.js";
import { BackupService } from "./backup-service.js";

describe("BackupService", () => {
  it("verifies, hashes, and uploads a repository bundle with its manifest", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000401");
    const repository = new MemoryHouseholdRepository();
    const head = await repository.provision(householdId, "Kitchen", ActorIdSchema.parse("act_0000000000000401"), "2026-07-15T12:00:00.000Z");
    const uploadBundle = vi.fn<BackupPort["uploadBundle"]>();
    const service = new BackupService(repository, { uploadBundle }, new FixedClock(new Date("2026-07-15T13:00:00.000Z")));

    const result = await service.backupHousehold(householdId);

    expect(result).toMatchObject({ head, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(uploadBundle).toHaveBeenCalledOnce();
    expect(uploadBundle.mock.calls[0]?.[2]).toContain(`"repository_head": "${head}"`);
  });

  it("does not upload a repository that fails verification", async () => {
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000402");
    const repository = new MemoryHouseholdRepository();
    const uploadBundle = vi.fn<BackupPort["uploadBundle"]>();
    const service = new BackupService(repository, { uploadBundle }, new FixedClock(new Date("2026-07-15T13:00:00.000Z")));
    await expect(service.backupHousehold(householdId)).rejects.toThrow("Repository verification failed before backup");
    expect(uploadBundle).not.toHaveBeenCalled();
  });
});
