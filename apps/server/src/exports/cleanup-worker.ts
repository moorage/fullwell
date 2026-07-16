import type { Clock, ExportArtifactPort, OperationalStorePort, TelemetryPort } from "../core/ports.js";

export interface ExportCleanupResult {
  readonly checked: number;
  readonly removed: number;
  readonly failed: number;
}

export class ExportCleanupWorker {
  constructor(
    private readonly store: OperationalStorePort,
    private readonly artifacts: ExportArtifactPort,
    private readonly clock: Clock,
    private readonly telemetry: TelemetryPort,
  ) {}

  async run(): Promise<ExportCleanupResult> {
    const records = await this.store.listReclaimableExportDownloads(this.clock.now().toISOString());
    let removed = 0;
    let failed = 0;
    for (const record of records) {
      try {
        await this.artifacts.remove(record.objectPath);
        await this.store.deleteExportDownload(record.id);
        removed += 1;
      } catch (error) {
        failed += 1;
        this.telemetry.error("export_cleanup_failed", error instanceof Error ? error : new Error("Export cleanup failed"), { export_id: record.id });
      }
    }
    return { checked: records.length, removed, failed };
  }
}
