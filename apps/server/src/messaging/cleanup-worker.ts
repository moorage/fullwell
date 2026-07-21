import type { Clock, TelemetryPort } from "../core/ports.js";
import type { MessageEnvelopeStorePort } from "./ports.js";

export interface MessagingCleanupResult {
  readonly removed: number;
  readonly failed: number;
}

export class MessagingCleanupWorker {
  constructor(
    private readonly store: Pick<MessageEnvelopeStorePort, "deleteExpired">,
    private readonly clock: Clock,
    private readonly telemetry: TelemetryPort,
  ) {}

  async run(): Promise<MessagingCleanupResult> {
    try {
      const removed = await this.store.deleteExpired(this.clock.now().toISOString());
      this.telemetry.event("messaging.cleanup", { removed });
      return { removed, failed: 0 };
    } catch (error) {
      this.telemetry.error("messaging_cleanup_failed", error instanceof Error ? error : new Error("Messaging cleanup failed"), {});
      return { removed: 0, failed: 1 };
    }
  }
}
