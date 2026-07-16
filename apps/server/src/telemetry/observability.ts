import { createHash } from "node:crypto";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { TelemetryPort } from "../core/ports.js";

const SAFE_ATTRIBUTE_KEYS = new Set([
  "auth_category", "code", "count", "duration_ms", "error_code", "method", "outcome",
  "reason", "request_id", "retryable", "route", "status_code", "tool",
]);
const PSEUDONYMOUS_ID_KEYS = new Set(["export_id", "household_id"]);
const SAFE_VALUE = /^[a-zA-Z0-9_.:/-]{1,128}$/;

export interface HttpObservation {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationSeconds: number;
}

export interface ObservabilityPort extends TelemetryPort {
  observeHttp(input: HttpObservation): void;
  observeOperatorHealth(input: OperatorMetricSnapshot): void;
  rateLimited(route: string): void;
  metrics(): Promise<string>;
  readonly metricsContentType: string;
}

export interface OperatorMetricSnapshot {
  readonly incompleteMutations: number;
  readonly quarantinedHouseholds: number;
  readonly householdsWithoutBackup: number;
  readonly oldestIncompleteAgeSeconds: number | null;
  readonly oldestBackupAgeSeconds: number | null;
  readonly volumeUsedPercent: number;
}

export interface ObservabilityOptions {
  readonly runtimeMetrics?: boolean;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
}

export class ServiceObservability implements ObservabilityPort {
  private readonly registry = new Registry<typeof Registry.OPENMETRICS_CONTENT_TYPE>();
  private readonly events: Counter<"event">;
  private readonly errors: Counter<"event" | "error">;
  private readonly httpRequests: Counter<"method" | "route" | "status_code">;
  private readonly httpDuration: Histogram<"method" | "route">;
  private readonly rateLimitEvents: Counter<"route">;
  private readonly incompleteMutations: Gauge;
  private readonly quarantinedHouseholds: Gauge;
  private readonly householdsWithoutBackup: Gauge;
  private readonly oldestIncompleteAge: Gauge;
  private readonly oldestBackupAge: Gauge;
  private readonly volumeUsedPercent: Gauge;
  private readonly stdout: (line: string) => void;
  private readonly stderr: (line: string) => void;

  constructor(options: ObservabilityOptions = {}) {
    this.stdout = options.stdout ?? ((line) => process.stdout.write(line));
    this.stderr = options.stderr ?? ((line) => process.stderr.write(line));
    this.registry.setContentType(Registry.OPENMETRICS_CONTENT_TYPE);
    if (options.runtimeMetrics !== false) collectDefaultMetrics({ prefix: "hfj_runtime_", register: this.registry });
    this.events = new Counter({ name: "hfj_events_total", help: "Bounded application events", labelNames: ["event"], registers: [this.registry] });
    this.errors = new Counter({ name: "hfj_errors_total", help: "Bounded application errors", labelNames: ["event", "error"], registers: [this.registry] });
    this.httpRequests = new Counter({ name: "hfj_http_requests_total", help: "HTTP requests", labelNames: ["method", "route", "status_code"], registers: [this.registry] });
    this.httpDuration = new Histogram({
      name: "hfj_http_request_duration_seconds", help: "HTTP request latency", labelNames: ["method", "route"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], registers: [this.registry],
    });
    this.rateLimitEvents = new Counter({ name: "hfj_rate_limited_total", help: "Rejected requests", labelNames: ["route"], registers: [this.registry] });
    this.incompleteMutations = new Gauge({ name: "hfj_reconciliation_incomplete_mutations", help: "Incomplete mutations", registers: [this.registry] });
    this.quarantinedHouseholds = new Gauge({ name: "hfj_quarantined_households", help: "Quarantined household repositories", registers: [this.registry] });
    this.householdsWithoutBackup = new Gauge({ name: "hfj_households_without_backup", help: "Households without a backup checkpoint", registers: [this.registry] });
    this.oldestIncompleteAge = new Gauge({ name: "hfj_oldest_incomplete_mutation_age_seconds", help: "Age of the oldest incomplete mutation", registers: [this.registry] });
    this.oldestBackupAge = new Gauge({ name: "hfj_oldest_backup_age_seconds", help: "Age of the oldest household backup checkpoint", registers: [this.registry] });
    this.volumeUsedPercent = new Gauge({ name: "hfj_repository_volume_used_percent", help: "Repository volume used percent", registers: [this.registry] });
  }

  event(name: string, attributes: Readonly<Record<string, string | number | boolean>> = {}): void {
    const event = safeCategory(name);
    this.events.inc({ event });
    this.stdout(`${JSON.stringify({ level: "info", event, ...safeAttributes(attributes) })}\n`);
  }

  error(name: string, error: Error, attributes: Readonly<Record<string, string | number | boolean>> = {}): void {
    const event = safeCategory(name);
    const errorName = safeCategory(error.name);
    this.errors.inc({ event, error: errorName });
    this.stderr(`${JSON.stringify({ level: "error", event, error: errorName, ...safeAttributes(attributes) })}\n`);
  }

  observeHttp(input: HttpObservation): void {
    const method = safeCategory(input.method.toUpperCase());
    const route = safeRoute(input.route);
    const statusCode = String(input.statusCode);
    this.httpRequests.inc({ method, route, status_code: statusCode });
    this.httpDuration.observe({ method, route }, Math.max(0, input.durationSeconds));
  }

  rateLimited(route: string): void { this.rateLimitEvents.inc({ route: safeRoute(route) }); }
  observeOperatorHealth(input: OperatorMetricSnapshot): void {
    this.incompleteMutations.set(input.incompleteMutations);
    this.quarantinedHouseholds.set(input.quarantinedHouseholds);
    this.householdsWithoutBackup.set(input.householdsWithoutBackup);
    this.oldestIncompleteAge.set(input.oldestIncompleteAgeSeconds ?? 0);
    this.oldestBackupAge.set(input.oldestBackupAgeSeconds ?? 0);
    this.volumeUsedPercent.set(input.volumeUsedPercent);
  }
  metrics(): Promise<string> { return this.registry.metrics(); }
  get metricsContentType(): string { return this.registry.contentType; }
}

function safeAttributes(attributes: Readonly<Record<string, string | number | boolean>>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (PSEUDONYMOUS_ID_KEYS.has(key)) {
      output[key] = createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
    } else if (SAFE_ATTRIBUTE_KEYS.has(key)) {
      output[key] = typeof value === "string" && !SAFE_VALUE.test(value) ? "redacted" : value;
    }
  }
  return output;
}

function safeCategory(value: string): string { return SAFE_VALUE.test(value) ? value : "invalid"; }
function safeRoute(value: string): string { return value.startsWith("/") && SAFE_VALUE.test(value) ? value : "unmatched"; }
