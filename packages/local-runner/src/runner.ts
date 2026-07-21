import {
  HostActionReceiptSchema,
  type GitObjectId,
  type HostActionReceipt,
  type HostWorkflowState,
} from "@hfj/contracts";
import type { RunnerConfig } from "./config.js";
import { GatewayRequestError, type GatewayPort } from "./gateway-client.js";
import { HostReadyToActSchema, type AgentHostPort, type HostReadyToAct, type HostTerminal } from "./host/types.js";
import { SnapshotCache } from "./snapshot-cache.js";
import { ActionReceiptStore } from "./state/action-receipts.js";

export type DrainResult = "empty" | "completed" | "needs_input" | "blocked" | "cancelled";

export class LocalRunner {
  constructor(
    private readonly config: RunnerConfig,
    private readonly gateway: GatewayPort,
    private readonly snapshots: SnapshotCache,
    private readonly receipts: ActionReceiptStore,
    private readonly host: AgentHostPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(signal: AbortSignal): Promise<void> {
    let retryMilliseconds = 1_000;
    while (!signal.aborted) {
      try {
        await this.drainOnce(signal);
        retryMilliseconds = 1_000;
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof GatewayRequestError && (error.code === "FORBIDDEN" || error.code === "AUTH_REQUIRED" || error.code === "CHANNEL_DISABLED")) {
          await Promise.all([this.snapshots.purge(this.config.household_id), this.receipts.purge()]);
        }
        process.stderr.write(`${JSON.stringify({ level: "error", event: "runner.iteration_failed", error: error instanceof Error ? error.name : "NonErrorFailure" })}\n`);
        await wait(retryMilliseconds, signal);
        retryMilliseconds = Math.min(30_000, retryMilliseconds * 2);
      }
    }
  }

  async drainOnce(parentSignal: AbortSignal = new AbortController().signal): Promise<DrainResult> {
    const claim = await this.gateway.claim(this.config.device_id, this.config.poll_wait_seconds);
    if (claim.kind === "empty") return "empty";
    return await this.withHeartbeat(claim.envelope.envelope_id, claim.envelope.lease_id, parentSignal, async (signal) => {
      const existing = await this.receipts.read(claim.envelope.request_id);
      if (existing !== null && existing.envelope_id === claim.envelope.envelope_id) {
        const recovered = await this.recover(existing, claim.envelope, signal);
        if (recovered !== null) return recovered;
      }
      const current = await this.snapshots.current(claim.envelope.household_id);
      const downloaded = await this.gateway.snapshot(claim.envelope.household_id, this.config.device_id, current?.head ?? null);
      const snapshot = downloaded === null ? current : await this.snapshots.install(claim.envelope.household_id, downloaded);
      if (snapshot === null) throw new Error("The gateway returned not-modified without a valid local snapshot");
      const resolution = await this.host.resolve({
        snapshotDirectory: snapshot.directory,
        message: claim.envelope.text,
        retailerOrigin: this.config.retailer_origin,
        resumeSessionId: claim.envelope.resume_session_id,
        signal,
      });
      if (resolution.kind !== "ready_to_act") {
        await this.gateway.complete(claim.envelope.envelope_id, this.config.device_id, claim.envelope.lease_id, resolution);
        return resolution.kind;
      }
      requireApprovedOrigin(resolution.retailer_origin, this.config.retailer_origin);
      const receipt = HostActionReceiptSchema.parse({
        request_id: claim.envelope.request_id,
        envelope_id: claim.envelope.envelope_id,
        selected_item_reference: resolution.selected_item_reference,
        retailer_origin: resolution.retailer_origin,
        retailer_locator: resolution.retailer_locator,
        baseline_quantity: resolution.baseline_quantity,
        target_quantity: resolution.target_quantity,
        host_session_id: resolution.host_session_id,
        state: "ready_to_act",
        updated_at: this.now().toISOString(),
      });
      await this.receipts.write(receipt);
      return await this.performAction(receipt, resolution, claim.envelope, snapshot.head, snapshot.directory, signal);
    });
  }

  private async recover(
    receipt: HostActionReceipt,
    envelope: Extract<Awaited<ReturnType<GatewayPort["claim"]>>, { kind: "work" }>["envelope"],
    signal: AbortSignal,
  ): Promise<DrainResult | null> {
    if (receipt.state === "completed" || receipt.state === "blocked" || receipt.state === "cancelled") {
      const terminal = terminalFromReceipt(receipt);
      await this.gateway.complete(envelope.envelope_id, this.config.device_id, envelope.lease_id, terminal);
      return terminal.kind;
    }
    if (receipt.state !== "ready_to_act" && receipt.state !== "acting" && receipt.state !== "action_uncertain") return null;
    const current = await this.snapshots.current(envelope.household_id);
    if (current === null) throw new Error("An uncertain cart action has no retained snapshot for recovery");
    const ready = readyFromReceipt(receipt);
    return await this.performAction(receipt, ready, envelope, current.head, current.directory, signal);
  }

  private async performAction(
    receipt: HostActionReceipt,
    ready: HostReadyToAct,
    envelope: Extract<Awaited<ReturnType<GatewayPort["claim"]>>, { kind: "work" }>["envelope"],
    snapshotHead: GitObjectId,
    snapshotDirectory: string,
    signal: AbortSignal,
  ): Promise<DrainResult> {
    try {
      await this.gateway.authorizeAction(envelope.household_id, this.config.device_id, snapshotHead);
    } catch (error) {
      if (error instanceof GatewayRequestError && error.code === "REVISION_CONFLICT") await this.receipts.remove(receipt.request_id);
      throw error;
    }
    await this.receipts.write({ ...receipt, state: "acting", updated_at: this.now().toISOString() });
    let terminal: HostTerminal;
    try {
      terminal = await this.host.act({
        snapshotDirectory,
        message: envelope.text,
        retailerOrigin: this.config.retailer_origin,
        resumeSessionId: ready.host_session_id,
        ready,
        signal,
      });
    } catch (error) {
      await this.receipts.write({ ...receipt, state: "action_uncertain", updated_at: this.now().toISOString() });
      throw error;
    }
    const state = workflowState(terminal.kind);
    await this.receipts.write({ ...receipt, host_session_id: terminal.host_session_id, state, updated_at: this.now().toISOString() });
    await this.gateway.complete(envelope.envelope_id, this.config.device_id, envelope.lease_id, terminal);
    return terminal.kind;
  }

  private async withHeartbeat<T>(
    envelopeId: Parameters<GatewayPort["heartbeat"]>[0],
    leaseId: Parameters<GatewayPort["heartbeat"]>[2],
    parentSignal: AbortSignal,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    parentSignal.addEventListener("abort", cancel, { once: true });
    const heartbeatState: { failure: Error | null } = { failure: null };
    const heartbeat = (async () => {
      while (await wait(this.config.heartbeat_seconds * 1_000, controller.signal)) {
        try {
          await this.gateway.heartbeat(envelopeId, this.config.device_id, leaseId);
        } catch (error) {
          heartbeatState.failure = error instanceof Error ? error : new Error("Message lease heartbeat failed");
          controller.abort();
          return;
        }
      }
    })();
    try {
      const result = await operation(controller.signal);
      if (heartbeatState.failure !== null) throw heartbeatState.failure;
      return result;
    } finally {
      controller.abort();
      parentSignal.removeEventListener("abort", cancel);
      await heartbeat;
    }
  }
}

function readyFromReceipt(receipt: HostActionReceipt): HostReadyToAct {
  return HostReadyToActSchema.parse({
    kind: "ready_to_act",
    selected_item_reference: receipt.selected_item_reference,
    retailer_origin: receipt.retailer_origin,
    retailer_locator: receipt.retailer_locator,
    baseline_quantity: receipt.baseline_quantity,
    target_quantity: receipt.target_quantity,
    host_session_id: receipt.host_session_id,
  });
}

function terminalFromReceipt(receipt: HostActionReceipt): HostTerminal {
  if (receipt.state === "completed") return { kind: "completed", message: "The requested cart quantity is verified.", host_session_id: receipt.host_session_id };
  if (receipt.state === "cancelled") return { kind: "cancelled", message: "The restocking request was cancelled.", host_session_id: receipt.host_session_id };
  return { kind: "blocked", message: "The cart change could not be completed safely.", host_session_id: receipt.host_session_id };
}

function workflowState(kind: HostTerminal["kind"]): HostWorkflowState {
  return kind;
}

function requireApprovedOrigin(actual: string, configured: string): void {
  if (new URL(actual).origin !== new URL(configured).origin) throw new Error("Agent selected an unapproved retailer origin");
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  return await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve(true);
    }, milliseconds);
    const cancel = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
}
