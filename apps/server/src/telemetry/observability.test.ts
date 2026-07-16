import { describe, expect, it, vi } from "vitest";
import { ServiceObservability } from "./observability.js";

describe("ServiceObservability", () => {
  it("emits bounded metrics and redacted structured logs", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const telemetry = new ServiceObservability({ runtimeMetrics: false, stdout: (line) => stdout.push(line), stderr: (line) => stderr.push(line) });

    telemetry.event("mutation.completed", {
      request_id: "req_0000000000000001",
      household_id: "hh_0000000000000001",
      tool: "hfj_update_profile",
      email: "private@example.test",
      reason: "private authored text",
    });
    telemetry.error("mutation.failed", new Error("private failure detail"), { error_code: "PROJECTION_DRIFT", source_url: "https://private.example" });
    telemetry.observeHttp({ method: "post", route: "/mcp", statusCode: 200, durationSeconds: 0.125 });
    telemetry.observeHttp({ method: "GET", route: "/c/private?token=secret", statusCode: 404, durationSeconds: -1 });
    telemetry.rateLimited("/auth/magic-link");
    telemetry.observeOperatorHealth({
      incompleteMutations: 2, quarantinedHouseholds: 1, householdsWithoutBackup: 3,
      oldestIncompleteAgeSeconds: 90, oldestBackupAgeSeconds: null, volumeUsedPercent: 42.5,
    });

    const logs = [...stdout, ...stderr].join("");
    expect(logs).toContain('"request_id":"req_0000000000000001"');
    expect(logs).toContain('"reason":"redacted"');
    expect(logs).not.toContain("private@example.test");
    expect(logs).not.toContain("private failure detail");
    expect(logs).not.toContain("private.example");
    expect(logs).not.toContain("hh_0000000000000001");

    const metrics = await telemetry.metrics();
    expect(telemetry.metricsContentType).toContain("openmetrics-text");
    expect(metrics).toContain('hfj_http_requests_total{method="POST",route="/mcp",status_code="200"} 1');
    expect(metrics).toContain('hfj_http_requests_total{method="GET",route="unmatched",status_code="404"} 1');
    expect(metrics).toContain('hfj_rate_limited_total{route="/auth/magic-link"} 1');
    expect(metrics).toContain("hfj_reconciliation_incomplete_mutations 2");
    expect(metrics).toContain("hfj_repository_volume_used_percent 42.5");
    expect(metrics).not.toContain("private");
  });

  it("normalizes untrusted event categories and uses process streams by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const telemetry = new ServiceObservability({ runtimeMetrics: false });
    const error = new Error("not logged");
    error.name = "Unsafe Error Name";
    telemetry.event("unsafe event name", { retryable: true });
    telemetry.error("unsafe error event", error, { count: 1 });
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"event":"invalid"'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('"error":"invalid"'));
  });
});
