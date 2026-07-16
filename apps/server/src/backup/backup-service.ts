import { createHash } from "node:crypto";
import type { HouseholdId } from "@hfj/contracts";
import type { BackupPort, Clock, HouseholdRepositoryPort } from "../core/ports.js";
import { stableJson } from "../adapters/memory.js";

export class BackupService {
  constructor(private readonly repository: HouseholdRepositoryPort, private readonly backup: BackupPort, private readonly clock: Clock) {}
  async backupHousehold(householdId: HouseholdId): Promise<{ head: string; sha256: string }> {
    const verification = await this.repository.verify(householdId);
    if (!verification.valid) throw new Error("Repository verification failed before backup");
    const bundle = await this.repository.bundle(householdId);
    const sha256 = createHash("sha256").update(bundle).digest("hex");
    const manifest = stableJson({ household_id: householdId, repository_head: verification.detail, sha256, created_at: this.clock.now().toISOString(), schema_version: 1 });
    await this.backup.uploadBundle(householdId, bundle, manifest);
    return { head: verification.detail, sha256 };
  }
}
