import { GitObjectIdSchema, HouseholdIdSchema, UserIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { MemoryOperationalStore } from "../adapters/memory.js";
import { FixedClock, NoopTelemetry } from "../adapters/providers.js";
import type { ExportArtifactPort, TelemetryPort } from "../core/ports.js";
import { MemoryExportArtifactStore } from "./artifact-store.js";
import { ExportCleanupWorker } from "./cleanup-worker.js";

describe("ExportCleanupWorker", () => {
  it("removes expired and used artifacts while retaining active downloads", async () => {
    const store = new MemoryOperationalStore();
    const artifacts = new MemoryExportArtifactStore();
    const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000001");
    const userId = UserIdSchema.parse("usr_0000000000000001");
    const repositoryHead = GitObjectIdSchema.parse("1".repeat(40));
    for (const [id, state] of [["exp_0000000000000001", "expired"], ["exp_0000000000000002", "used"], ["exp_0000000000000003", "active"]] as const) {
      const objectPath = await artifacts.write(id, new Uint8Array([1]));
      await store.saveExportDownload({
        id, householdId, requestedBy: userId, format: "readable_zip", tokenHash: `hash-${id}`,
        objectPath, contentHash: "a".repeat(64), repositoryHead,
        expiresAt: state === "expired" ? "2026-07-15T11:59:00.000Z" : "2026-07-15T12:15:00.000Z",
        downloadedAt: state === "used" ? "2026-07-15T11:58:00.000Z" : null,
        createdAt: "2026-07-15T11:45:00.000Z",
      });
    }

    await expect(new ExportCleanupWorker(store, artifacts, clock, new NoopTelemetry()).run()).resolves.toEqual({ checked: 2, removed: 2, failed: 0 });
    expect(await store.listReclaimableExportDownloads(clock.now().toISOString())).toEqual([]);
    await expect(artifacts.read("exp_0000000000000001.bin")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(artifacts.read("exp_0000000000000002.bin")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(artifacts.read("exp_0000000000000003.bin")).resolves.toEqual(new Uint8Array([1]));
  });

  it("reports removal failures and retains their rows for retry", async () => {
    const store = new MemoryOperationalStore();
    const clock = new FixedClock(new Date("2026-07-15T12:00:00.000Z"));
    await store.saveExportDownload({
      id: "exp_0000000000000004",
      householdId: HouseholdIdSchema.parse("hsh_0000000000000001"),
      requestedBy: UserIdSchema.parse("usr_0000000000000001"),
      format: "readable_zip", tokenHash: "hash-failed", objectPath: "exp_0000000000000004.bin",
      contentHash: "a".repeat(64), repositoryHead: GitObjectIdSchema.parse("1".repeat(40)),
      expiresAt: "2026-07-15T11:59:00.000Z", downloadedAt: null, createdAt: "2026-07-15T11:45:00.000Z",
    });
    const artifacts: ExportArtifactPort = {
      async write() { throw new Error("not used"); },
      async read() { throw new Error("not used"); },
      async remove() { throw new Error("disk unavailable"); },
    };
    const errors: string[] = [];
    const telemetry: TelemetryPort = {
      event() {},
      error(name) { errors.push(name); },
    };

    await expect(new ExportCleanupWorker(store, artifacts, clock, telemetry).run()).resolves.toEqual({ checked: 1, removed: 0, failed: 1 });
    expect(errors).toEqual(["export_cleanup_failed"]);
    expect(await store.listReclaimableExportDownloads(clock.now().toISOString())).toHaveLength(1);
  });
});
