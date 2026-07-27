import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  HouseholdIdSchema,
  HostActionReceiptSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
  type RunnerClaimResponse,
} from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { parseRunnerConfig } from "./config.js";
import type { GatewayPort } from "./gateway-client.js";
import { GatewayRequestError } from "./gateway-client.js";
import type { AgentHostPort } from "./host/types.js";
import { LocalRunner } from "./runner.js";
import { SnapshotCache } from "./snapshot-cache.js";
import { snapshotResponse } from "./testing/snapshot.fixture.js";
import { ActionReceiptStore } from "./state/action-receipts.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000801");
const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000801");
const envelopeId = MessageEnvelopeIdSchema.parse("msg_0000000000000801");
const requestId = RequestIdSchema.parse("req_0000000000000801");
const leaseId = MessageLeaseIdSchema.parse("lse_0000000000000801");
const completedMessage = "I added 1 bag of salted cashews for $12.99. (P.S. You can change your automatic cart-add maximum by saying, \"Set my cart maximum to $75.\")";
const work: RunnerClaimResponse = {
  kind: "work",
  envelope: {
    envelope_id: envelopeId,
    request_id: requestId,
    lease_id: leaseId,
    lease_expires_at: "2026-07-20T16:02:00.000Z",
    household_id: householdId,
    text: "We're out of cashews, get more",
    received_at: "2026-07-20T16:00:00.000Z",
    service_window_expires_at: "2026-07-21T16:00:00.000Z",
    resume_session_id: null,
  },
};

function runnerConfig(root: string) {
  return parseRunnerConfig({
    public_origin: "https://fullwell.example.test",
    household_id: householdId,
    device_id: deviceId,
    host: "codex",
    host_executable: "/usr/local/bin/codex",
    host_project_directory: "/tmp/fullwell-isolated-project-env",
    retailer_origin: "https://retailer.example.test/",
    application_root: root,
    poll_wait_seconds: 0,
    heartbeat_seconds: 10,
  });
}

function gateway(claims: RunnerClaimResponse[]) {
  const completed: Parameters<GatewayPort["complete"]>[] = [];
  const claim = vi.fn<GatewayPort["claim"]>(async () => claims.shift() ?? { kind: "empty" });
  const authorizeAction = vi.fn<GatewayPort["authorizeAction"]>(async () => undefined);
  const value: GatewayPort = {
    claim,
    heartbeat: vi.fn<GatewayPort["heartbeat"]>(async () => undefined),
    complete: vi.fn<GatewayPort["complete"]>(async (envelopeIdValue, deviceIdValue, leaseIdValue, terminal) => {
      completed.push([envelopeIdValue, deviceIdValue, leaseIdValue, terminal]);
    }),
    snapshot: vi.fn<GatewayPort["snapshot"]>(async () => snapshotResponse()),
    authorizeAction,
  };
  return { value, completed, claim, authorizeAction };
}

describe("LocalRunner", () => {
  it("does not invoke a host for an empty queue", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-empty-"));
    try {
      const gatewayValue = gateway([{ kind: "empty" }]);
      const resolve = vi.fn<AgentHostPort["resolve"]>();
      const host: AgentHostPort = { resolve, act: vi.fn() };
      const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), new ActionReceiptStore(join(root, "receipts")), host);
      await expect(runner.drainOnce(new AbortController().signal, true)).resolves.toBe("empty");
      expect(gatewayValue.claim).toHaveBeenCalledWith(deviceId, 0, true);
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves, reauthorizes, changes one target, records, and completes", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-complete-"));
    try {
      const gatewayValue = gateway([work]);
      const resolve = vi.fn<AgentHostPort["resolve"]>(async () => ({
        kind: "ready_to_act",
        selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/",
        retailer_locator: "/products/cashews",
        baseline_quantity: 1,
        target_quantity: 2,
        currency: "USD",
        incremental_amount_minor: 1_299,
        automatic_add_maximum_minor: 5_000,
        authorization_mode: "automatic_under_maximum",
        host_session_id: "host-session",
      }));
      const act = vi.fn<AgentHostPort["act"]>(async () => ({ kind: "completed", message: completedMessage, host_session_id: "host-session" }));
      const host: AgentHostPort = { resolve, act };
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), receipts, host, () => new Date("2026-07-20T16:01:00.000Z"));
      await expect(runner.drainOnce()).resolves.toBe("completed");
      expect(gatewayValue.authorizeAction).toHaveBeenCalledWith(householdId, deviceId, "a".repeat(40));
      expect(gatewayValue.completed[0]?.[3]).toMatchObject({ kind: "completed" });
      expect(await receipts.read(requestId)).toMatchObject({ state: "completed", terminal_message: completedMessage });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recovers an uncertain action by re-inspecting instead of resolving or adding blindly", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-recover-"));
    try {
      const gatewayValue = gateway([work, work]);
      const act = vi.fn<AgentHostPort["act"]>()
        .mockRejectedValueOnce(new Error("browser disconnected"))
        .mockResolvedValueOnce({ kind: "completed", message: completedMessage, host_session_id: "host-session" });
      const resolve = vi.fn<AgentHostPort["resolve"]>(async () => ({
        kind: "ready_to_act",
        selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/",
        retailer_locator: "/products/cashews",
        baseline_quantity: 0,
        target_quantity: 1,
        currency: "USD",
        incremental_amount_minor: 1_299,
        automatic_add_maximum_minor: 5_000,
        authorization_mode: "automatic_under_maximum",
        host_session_id: "host-session",
      }));
      const host: AgentHostPort = { resolve, act };
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), receipts, host);
      await expect(runner.drainOnce()).rejects.toThrow(/browser disconnected/);
      expect((await receipts.read(requestId))?.state).toBe("action_uncertain");
      await expect(runner.drainOnce()).resolves.toBe("completed");
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(act).toHaveBeenCalledTimes(2);
      expect(gatewayValue.authorizeAction).toHaveBeenCalledTimes(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("discards a stale resolution and resolves again after a HEAD conflict", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-stale-head-"));
    try {
      const gatewayValue = gateway([work, work]);
      gatewayValue.authorizeAction
        .mockRejectedValueOnce(new GatewayRequestError(409, "REVISION_CONFLICT"))
        .mockResolvedValueOnce(undefined);
      const resolve = vi.fn<AgentHostPort["resolve"]>(async () => ({
        kind: "ready_to_act", selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/", retailer_locator: "/products/cashews",
        baseline_quantity: 0, target_quantity: 1, currency: "USD",
        incremental_amount_minor: 1_299, automatic_add_maximum_minor: 5_000,
        authorization_mode: "automatic_under_maximum", host_session_id: "host-session",
      }));
      const act = vi.fn<AgentHostPort["act"]>(async () => ({ kind: "completed", message: completedMessage, host_session_id: "host-session" }));
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), receipts, { resolve, act });
      await expect(runner.drainOnce()).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
      expect(await receipts.read(requestId)).toBeNull();
      await expect(runner.drainOnce()).resolves.toBe("completed");
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(act).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("replays terminal receipts without resolving or mutating the cart", async () => {
    for (const state of ["completed", "blocked", "cancelled"] as const) {
      const root = await mkdtemp(join(tmpdir(), `fullwell-runner-terminal-${state}-`));
      try {
        const gatewayValue = gateway([work]);
        const receipts = new ActionReceiptStore(join(root, "receipts"));
        await receipts.write(HostActionReceiptSchema.parse({
          request_id: requestId,
          envelope_id: envelopeId,
          selected_item_reference: "snacks/items/cashews.md",
          retailer_origin: "https://retailer.example.test/",
          retailer_locator: "/products/cashews",
          baseline_quantity: 0,
          target_quantity: 1,
          host_session_id: "host-session",
          state,
          updated_at: "2026-07-20T16:01:00.000Z",
        }));
        const resolve = vi.fn<AgentHostPort["resolve"]>();
        const act = vi.fn<AgentHostPort["act"]>();
        const host: AgentHostPort = { resolve, act };
        const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), receipts, host);
        await expect(runner.drainOnce()).resolves.toBe(state);
        expect(resolve).not.toHaveBeenCalled();
        expect(act).not.toHaveBeenCalled();
        expect(gatewayValue.completed[0]?.[3]).toMatchObject({ kind: state });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("replays the exact priced completion and reminder without another cart action", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-priced-terminal-"));
    try {
      const gatewayValue = gateway([work]);
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      await receipts.write(HostActionReceiptSchema.parse({
        schema_version: 2,
        request_id: requestId,
        envelope_id: envelopeId,
        selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/",
        retailer_locator: "/products/cashews",
        baseline_quantity: 0,
        target_quantity: 1,
        currency: "USD",
        incremental_amount_minor: 1_299,
        automatic_add_maximum_minor: 5_000,
        authorization_mode: "automatic_under_maximum",
        host_session_id: "host-session",
        state: "completed",
        terminal_message: completedMessage,
        updated_at: "2026-07-20T16:01:00.000Z",
      }));
      const resolve = vi.fn<AgentHostPort["resolve"]>();
      const act = vi.fn<AgentHostPort["act"]>();
      const runner = new LocalRunner(
        runnerConfig(root),
        gatewayValue.value,
        new SnapshotCache(root),
        receipts,
        { resolve, act },
      );
      await expect(runner.drainOnce()).resolves.toBe("completed");
      expect(resolve).not.toHaveBeenCalled();
      expect(act).not.toHaveBeenCalled();
      expect(gatewayValue.completed[0]?.[3]).toEqual({
        kind: "completed",
        message: completedMessage,
        host_session_id: "host-session",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("blocks an unfinished legacy receipt without resolving or mutating the cart", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-legacy-receipt-"));
    try {
      const gatewayValue = gateway([work]);
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      await receipts.write(HostActionReceiptSchema.parse({
        request_id: requestId,
        envelope_id: envelopeId,
        selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/",
        retailer_locator: "/products/cashews",
        baseline_quantity: 0,
        target_quantity: 1,
        host_session_id: "host-session",
        state: "action_uncertain",
        updated_at: "2026-07-20T16:01:00.000Z",
      }));
      const resolve = vi.fn<AgentHostPort["resolve"]>();
      const act = vi.fn<AgentHostPort["act"]>();
      const runner = new LocalRunner(
        runnerConfig(root),
        gatewayValue.value,
        new SnapshotCache(root),
        receipts,
        { resolve, act },
      );
      await expect(runner.drainOnce()).resolves.toBe("blocked");
      expect(resolve).not.toHaveBeenCalled();
      expect(act).not.toHaveBeenCalled();
      expect(gatewayValue.completed[0]?.[3]).toMatchObject({ kind: "blocked", message: expect.stringContaining("price authorization") });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves again for a non-action receipt and returns bounded user input", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-needs-input-"));
    try {
      const gatewayValue = gateway([work]);
      const receipts = new ActionReceiptStore(join(root, "receipts"));
      await receipts.write(HostActionReceiptSchema.parse({
        request_id: requestId,
        envelope_id: envelopeId,
        selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/",
        retailer_locator: "/products/cashews",
        baseline_quantity: 0,
        target_quantity: 1,
        host_session_id: "host-session",
        state: "needs_input",
        updated_at: "2026-07-20T16:01:00.000Z",
      }));
      const host: AgentHostPort = {
        resolve: vi.fn<AgentHostPort["resolve"]>(async () => ({ kind: "needs_input", message: "Salted or unsalted?", host_session_id: "host-session" })),
        act: vi.fn(),
      };
      const runner = new LocalRunner(runnerConfig(root), gatewayValue.value, new SnapshotCache(root), receipts, host);
      await expect(runner.drainOnce()).resolves.toBe("needs_input");
      expect(gatewayValue.completed[0]?.[3]).toMatchObject({ kind: "needs_input" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects not-modified without a snapshot and cross-origin host resolutions", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-runner-invalid-resolution-"));
    try {
      const noSnapshotGateway = gateway([work]);
      noSnapshotGateway.value.snapshot = vi.fn(async () => null);
      const host: AgentHostPort = { resolve: vi.fn(), act: vi.fn() };
      const noSnapshotRunner = new LocalRunner(
        runnerConfig(root), noSnapshotGateway.value, new SnapshotCache(root), new ActionReceiptStore(join(root, "receipts-one")), host,
      );
      await expect(noSnapshotRunner.drainOnce()).rejects.toThrow(/not-modified/);

      const wrongOriginGateway = gateway([work]);
      const act = vi.fn<AgentHostPort["act"]>();
      const wrongOriginHost: AgentHostPort = {
        resolve: vi.fn<AgentHostPort["resolve"]>(async () => ({
          kind: "ready_to_act", selected_item_reference: "snacks/items/cashews.md",
          retailer_origin: "https://attacker.example.test/", retailer_locator: "/cashews",
          baseline_quantity: 0, target_quantity: 1, currency: "USD",
          incremental_amount_minor: 1_299, automatic_add_maximum_minor: 5_000,
          authorization_mode: "automatic_under_maximum", host_session_id: null,
        })),
        act,
      };
      const wrongOriginRunner = new LocalRunner(
        runnerConfig(root), wrongOriginGateway.value, new SnapshotCache(root), new ActionReceiptStore(join(root, "receipts-two")), wrongOriginHost,
      );
      await expect(wrongOriginRunner.drainOnce()).rejects.toThrow(/unapproved retailer origin/);
      expect(act).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
