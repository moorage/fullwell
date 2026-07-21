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
  observeMessagingHealth(input: MessagingMetricSnapshot): void;
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
  readonly fsckFailures: number;
  readonly signatureFailures: number;
  readonly restoreDrillHealthy: boolean;
  readonly volumeUsedPercent: number;
}

export interface MessagingMetricSnapshot {
  readonly openMessages: number;
  readonly queuedMessages: number;
  readonly leasedMessages: number;
  readonly awaitingUserMessages: number;
  readonly responseReadyMessages: number;
  readonly oldestOpenAgeSeconds: number | null;
  readonly activeRunnerDevices: number;
  readonly onlineRunnerDevices: number;
  readonly channelAvailable: boolean;
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
  private readonly fsckFailures: Gauge;
  private readonly signatureFailures: Gauge;
  private readonly restoreDrillHealthy: Gauge;
  private readonly volumeUsedPercent: Gauge;
  private readonly messagingOpenMessages: Gauge;
  private readonly messagingQueuedMessages: Gauge;
  private readonly messagingLeasedMessages: Gauge;
  private readonly messagingAwaitingUserMessages: Gauge;
  private readonly messagingResponseReadyMessages: Gauge;
  private readonly messagingOldestOpenAge: Gauge;
  private readonly messagingActiveRunnerDevices: Gauge;
  private readonly messagingOnlineRunnerDevices: Gauge;
  private readonly messagingChannelAvailable: Gauge;
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
    this.fsckFailures = new Gauge({ name: "hfj_repository_fsck_failures", help: "Repositories failing the latest fsck", registers: [this.registry] });
    this.signatureFailures = new Gauge({ name: "hfj_repository_signature_failures", help: "Repositories failing the latest signature check", registers: [this.registry] });
    this.restoreDrillHealthy = new Gauge({ name: "hfj_restore_drill_healthy", help: "Whether restore-drill evidence is current and successful", registers: [this.registry] });
    this.volumeUsedPercent = new Gauge({ name: "hfj_repository_volume_used_percent", help: "Repository volume used percent", registers: [this.registry] });
    this.messagingOpenMessages = new Gauge({ name: "hfj_messaging_open_messages", help: "Open messaging envelopes", registers: [this.registry] });
    this.messagingQueuedMessages = new Gauge({ name: "hfj_messaging_queued_messages", help: "Queued messaging envelopes", registers: [this.registry] });
    this.messagingLeasedMessages = new Gauge({ name: "hfj_messaging_leased_messages", help: "Leased messaging envelopes", registers: [this.registry] });
    this.messagingAwaitingUserMessages = new Gauge({ name: "hfj_messaging_awaiting_user_messages", help: "Messaging envelopes awaiting a user follow-up", registers: [this.registry] });
    this.messagingResponseReadyMessages = new Gauge({ name: "hfj_messaging_response_ready_messages", help: "Messaging envelopes with an unsent response", registers: [this.registry] });
    this.messagingOldestOpenAge = new Gauge({ name: "hfj_messaging_oldest_open_age_seconds", help: "Age of the oldest open messaging envelope", registers: [this.registry] });
    this.messagingActiveRunnerDevices = new Gauge({ name: "hfj_messaging_active_runner_devices", help: "Active local runner devices", registers: [this.registry] });
    this.messagingOnlineRunnerDevices = new Gauge({ name: "hfj_messaging_online_runner_devices", help: "Runner devices seen within five minutes", registers: [this.registry] });
    this.messagingChannelAvailable = new Gauge({ name: "hfj_messaging_channel_available", help: "Whether free WhatsApp intake is available", registers: [this.registry] });
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
    this.fsckFailures.set(input.fsckFailures);
    this.signatureFailures.set(input.signatureFailures);
    this.restoreDrillHealthy.set(input.restoreDrillHealthy ? 1 : 0);
    this.volumeUsedPercent.set(input.volumeUsedPercent);
  }
  observeMessagingHealth(input: MessagingMetricSnapshot): void {
    this.messagingOpenMessages.set(input.openMessages);
    this.messagingQueuedMessages.set(input.queuedMessages);
    this.messagingLeasedMessages.set(input.leasedMessages);
    this.messagingAwaitingUserMessages.set(input.awaitingUserMessages);
    this.messagingResponseReadyMessages.set(input.responseReadyMessages);
    this.messagingOldestOpenAge.set(input.oldestOpenAgeSeconds ?? 0);
    this.messagingActiveRunnerDevices.set(input.activeRunnerDevices);
    this.messagingOnlineRunnerDevices.set(input.onlineRunnerDevices);
    this.messagingChannelAvailable.set(input.channelAvailable ? 1 : 0);
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
