import {
  GitObjectIdSchema,
  HouseholdIdSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  RunnerDeviceIdSchema,
} from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import type { AccessTokenPort } from "./auth/token-manager.js";
import { FullwellGatewayClient, GatewayRequestError } from "./gateway-client.js";
import { snapshotResponse } from "./testing/snapshot.fixture.js";

const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000801");
const householdId = HouseholdIdSchema.parse("hsh_0000000000000801");
const envelopeId = MessageEnvelopeIdSchema.parse("msg_0000000000000801");
const leaseId = MessageLeaseIdSchema.parse("lse_0000000000000801");
const head = GitObjectIdSchema.parse("a".repeat(40));

describe("FullwellGatewayClient", () => {
  it("retries one unauthorized request with a refreshed token and parses contracts", async () => {
    let token = "old";
    const invalidate = vi.fn(() => { token = "new"; });
    const tokens: AccessTokenPort = {
      accessToken: vi.fn(async () => token),
      invalidate,
    };
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const authorization = new Headers(init?.headers).get("authorization");
      if (authorization === "Bearer old") return new Response(null, { status: 401 });
      return new Response(JSON.stringify({ kind: "empty" }), { status: 200 });
    });
    const client = new FullwellGatewayClient(new URL("https://fullwell.example.test"), tokens, fetcher);
    await expect(client.claim(deviceId, 0, true)).resolves.toEqual({ kind: "empty" });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const retryBody = fetcher.mock.calls[1]?.[1]?.body;
    expect(typeof retryBody).toBe("string");
    if (typeof retryBody !== "string") throw new Error("Expected a serialized claim request");
    expect(JSON.parse(retryBody)).toMatchObject({ recover_saturated: true });
  });

  it("handles heartbeat, completion, snapshot caching, action authorization, and errors", async () => {
    const responses = [
      new Response(JSON.stringify({ lease_expires_at: "2026-07-20T16:02:00.000Z" }), { status: 200 }),
      new Response(JSON.stringify({ state: "completed" }), { status: 200 }),
      new Response(null, { status: 304 }),
      new Response(JSON.stringify(snapshotResponse()), { status: 200 }),
      new Response(JSON.stringify({ authorized: true, head, authorized_at: "2026-07-20T16:00:00.000Z" }), { status: 200 }),
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "revoked" } }), { status: 403 }),
    ];
    const client = new FullwellGatewayClient(
      new URL("https://fullwell.example.test"),
      { accessToken: async () => "token", invalidate: () => undefined },
      async () => responses.shift() ?? new Response(null, { status: 500 }),
    );
    await expect(client.heartbeat(envelopeId, deviceId, leaseId)).resolves.toBeUndefined();
    await expect(client.complete(envelopeId, deviceId, leaseId, { kind: "completed", message: "Done", host_session_id: null })).resolves.toBeUndefined();
    await expect(client.snapshot(householdId, deviceId, head)).resolves.toBeNull();
    await expect(client.snapshot(householdId, deviceId, null)).resolves.toMatchObject({ manifest: { head } });
    await expect(client.authorizeAction(householdId, deviceId, head)).resolves.toBeUndefined();
    await expect(client.claim(deviceId, 0)).rejects.toEqual(expect.objectContaining<Partial<GatewayRequestError>>({ status: 403, code: "FORBIDDEN" }));
  });

  it("registers and revokes devices and preserves unstructured gateway failures", async () => {
    const responses = [
      new Response(JSON.stringify({ device_id: deviceId, created_at: "2026-07-20T16:00:00.000Z" }), { status: 201 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 503 }),
      new Response("not-json", { status: 502 }),
      new Response(JSON.stringify({ error: { code: "not-a-code", message: "bad" } }), { status: 500 }),
    ];
    const client = new FullwellGatewayClient(
      new URL("https://fullwell.example.test"),
      { accessToken: async () => "token", invalidate: () => undefined },
      async () => responses.shift() ?? new Response(null, { status: 500 }),
    );
    await expect(client.registerDevice(householdId, "Kitchen Mac")).resolves.toMatchObject({ device_id: deviceId });
    await expect(client.revokeDevice(deviceId)).resolves.toBeUndefined();
    await expect(client.revokeDevice(deviceId)).rejects.toMatchObject({ status: 503, code: null });
    await expect(client.revokeDevice(deviceId)).rejects.toMatchObject({ status: 502, code: null });
    await expect(client.revokeDevice(deviceId)).rejects.toMatchObject({ status: 500, code: null });
  });
});
