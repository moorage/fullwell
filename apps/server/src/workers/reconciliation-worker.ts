import type { OperationalStorePort, TelemetryPort } from "../core/ports.js";

export class ReconciliationWorker {
  constructor(private readonly store: OperationalStorePort, private readonly telemetry: TelemetryPort) {}
  async checkHealth(): Promise<void> {
    const health = await this.store.health();
    if (!health.ready) this.telemetry.event("reconciliation.blocked", { reason: health.detail });
  }
}
