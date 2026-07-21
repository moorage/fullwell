import { describe, expect, it, vi } from "vitest";
import { FixedClock } from "../adapters/providers.js";
import type { TelemetryPort } from "../core/ports.js";
import { MessagingCleanupWorker } from "./cleanup-worker.js";

describe("MessagingCleanupWorker", () => {
  it("removes expired encrypted envelopes at the maintenance clock", async () => {
    const deleteExpired = vi.fn(async () => 3);
    const events: string[] = [];
    const telemetry: TelemetryPort = { event(name) { events.push(name); }, error() {} };
    await expect(new MessagingCleanupWorker(
      { deleteExpired }, new FixedClock(new Date("2026-07-20T16:00:00.000Z")), telemetry,
    ).run()).resolves.toEqual({ removed: 3, failed: 0 });
    expect(deleteExpired).toHaveBeenCalledWith("2026-07-20T16:00:00.000Z");
    expect(events).toEqual(["messaging.cleanup"]);
  });

  it("surfaces cleanup failure for maintenance retry", async () => {
    const errors: string[] = [];
    const telemetry: TelemetryPort = { event() {}, error(name) { errors.push(name); } };
    await expect(new MessagingCleanupWorker(
      { deleteExpired: async () => { throw new Error("database unavailable"); } },
      new FixedClock(new Date("2026-07-20T16:00:00.000Z")), telemetry,
    ).run()).resolves.toEqual({ removed: 0, failed: 1 });
    expect(errors).toEqual(["messaging_cleanup_failed"]);
  });
});
