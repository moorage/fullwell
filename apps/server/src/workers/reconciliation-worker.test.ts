import { describe, expect, it, vi } from "vitest";
import { MemoryOperationalStore } from "../adapters/memory.js";
import type { TelemetryPort } from "../core/ports.js";
import { ReconciliationWorker } from "./reconciliation-worker.js";

describe("ReconciliationWorker", () => {
  it("emits a blocked event only when the operational store is unhealthy", async () => {
    const event = vi.fn<TelemetryPort["event"]>();
    const telemetry: TelemetryPort = { event, error: vi.fn<TelemetryPort["error"]>() };
    await new ReconciliationWorker(new MemoryOperationalStore(), telemetry).checkHealth();
    expect(event).not.toHaveBeenCalled();

    const store = new MemoryOperationalStore();
    store.health = async () => ({ ready: false, detail: "database unavailable" });
    await new ReconciliationWorker(store, telemetry).checkHealth();
    expect(event).toHaveBeenCalledWith("reconciliation.blocked", { reason: "database unavailable" });
  });
});
