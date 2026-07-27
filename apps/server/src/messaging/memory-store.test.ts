import {
  HouseholdIdSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  ProviderLinkIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { MemoryMessageEnvelopeStore } from "./memory-store.js";
import type { MessageEnvelopeRecord, ProviderIdentityLinkRecord, RunnerDeviceRecord } from "./ports.js";

const userId = UserIdSchema.parse("usr_0000000000000901");
const otherUserId = UserIdSchema.parse("usr_0000000000000902");
const householdId = HouseholdIdSchema.parse("hsh_0000000000000901");
const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000901");
const otherDeviceId = RunnerDeviceIdSchema.parse("dev_0000000000000902");
const linkId = ProviderLinkIdSchema.parse("lnk_0000000000000901");
const otherLinkId = ProviderLinkIdSchema.parse("lnk_0000000000000902");
const envelopeId = MessageEnvelopeIdSchema.parse("msg_0000000000000901");
const leaseId = MessageLeaseIdSchema.parse("lse_0000000000000901");
const now = "2026-07-20T16:00:00.000Z";

function device(overrides: Partial<RunnerDeviceRecord> = {}): RunnerDeviceRecord {
  return {
    id: deviceId,
    userId,
    householdId,
    name: "Kitchen Mac",
    lastSeenAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function link(overrides: Partial<ProviderIdentityLinkRecord> = {}): ProviderIdentityLinkRecord {
  return {
    id: linkId,
    userId,
    householdId,
    runnerDeviceId: deviceId,
    providerIdentityHash: "identity-one",
    destinationCiphertext: "destination",
    browserBindingHash: null,
    confirmationExpiresAt: "2026-07-20T16:10:00.000Z",
    confirmedAt: now,
    linkedAt: now,
    revokedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function envelope(overrides: Partial<MessageEnvelopeRecord> = {}): MessageEnvelopeRecord {
  return {
    id: envelopeId,
    requestId: RequestIdSchema.parse("req_0000000000000901"),
    providerLinkId: linkId,
    providerMessageHash: "provider-one",
    state: "queued",
    inboundCiphertext: "inbound",
    responseCiphertext: null,
    hostSessionCiphertext: null,
    terminalKind: null,
    receivedAt: now,
    serviceWindowExpiresAt: "2026-07-21T16:00:00.000Z",
    leaseId: null,
    leaseDeviceId: null,
    leaseExpiresAt: null,
    attemptCount: 0,
    failureCode: null,
    responseSentAt: null,
    expiresAt: "2026-07-27T16:00:00.000Z",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("MemoryMessageEnvelopeStore", () => {
  it("enforces device, challenge, and two-sided provider-link state", async () => {
    const store = new MemoryMessageEnvelopeStore();
    await expect(store.getDevice(deviceId)).resolves.toBeNull();
    await store.saveDevice(device());
    await expect(store.saveDevice(device({ id: otherDeviceId }))).rejects.toThrow(/active runner/);
    await expect(store.revokeDevice(otherUserId, deviceId, now)).resolves.toBe(false);
    await expect(store.revokeDevice(userId, deviceId, now)).resolves.toBe(true);
    await expect(store.revokeDevice(userId, deviceId, now)).resolves.toBe(false);

    await store.saveLinkChallenge({
      id: "challenge-one", userId, householdId, runnerDeviceId: deviceId,
      tokenHash: "token-one", browserBindingHash: "browser-one",
      expiresAt: "2026-07-20T16:01:00.000Z", consumedAt: null, createdAt: now,
    });
    await expect(store.consumeLinkChallenge("missing", now)).resolves.toBeNull();
    await expect(store.consumeLinkChallenge("token-one", now)).resolves.toMatchObject({ consumedAt: now });
    await expect(store.consumeLinkChallenge("token-one", now)).resolves.toBeNull();
    await store.saveLinkChallenge({
      id: "challenge-two", userId, householdId, runnerDeviceId: deviceId,
      tokenHash: "token-two", browserBindingHash: "browser-two",
      expiresAt: now, consumedAt: null, createdAt: now,
    });
    await expect(store.consumeLinkChallenge("token-two", now)).resolves.toBeNull();

    await store.createProviderLink(link({ confirmedAt: null, browserBindingHash: "browser-one" }));
    await expect(store.findActiveLinkByIdentityHash("identity-one")).resolves.toBeNull();
    await expect(store.findActiveLinkForUser(userId)).resolves.toBeNull();
    await expect(store.getProviderLink(otherLinkId)).resolves.toBeNull();
    await expect(store.confirmProviderLink(otherUserId, linkId, "browser-one", now)).resolves.toBeNull();
    await expect(store.confirmProviderLink(userId, linkId, "wrong-browser", now)).resolves.toBeNull();
    await expect(store.confirmProviderLink(userId, linkId, "browser-one", now)).resolves.toMatchObject({ confirmedAt: now, browserBindingHash: null });
    await expect(store.confirmProviderLink(userId, linkId, "browser-one", now)).resolves.toBeNull();
    await expect(store.createProviderLink(link({ id: otherLinkId, providerIdentityHash: "identity-two" }))).rejects.toThrow(/active provider link/);
    await expect(store.revokeProviderLink(otherUserId, now)).resolves.toBe(false);
    await expect(store.revokeProviderLink(userId, now)).resolves.toBe(true);
    await expect(store.findCurrentLinkForUser(userId)).resolves.toBeNull();
  });

  it("handles queue capacity, leases, delivery ordering, and retention", async () => {
    const store = new MemoryMessageEnvelopeStore();
    await store.saveDevice(device());
    await store.createProviderLink(link());
    const capacity = { perLink: 1, global: 1 };
    await expect(store.enqueueOrResume(envelope(), now, capacity)).resolves.toMatchObject({ kind: "created" });
    await expect(store.enqueueOrResume(envelope(), now, capacity)).resolves.toMatchObject({ kind: "duplicate" });
    await expect(store.enqueueOrResume(envelope({
      id: MessageEnvelopeIdSchema.parse("msg_0000000000000902"),
      requestId: RequestIdSchema.parse("req_0000000000000902"),
      providerMessageHash: "provider-two",
    }), now, capacity)).resolves.toEqual({ kind: "overloaded" });
    await expect(store.claim(otherDeviceId, leaseId, now, "2026-07-20T16:01:00.000Z")).resolves.toBeNull();
    const claimed = await store.claim(deviceId, leaseId, now, "2026-07-20T16:01:00.000Z");
    expect(claimed).toMatchObject({ state: "leased", attemptCount: 1 });
    await expect(store.heartbeat(envelopeId, deviceId, MessageLeaseIdSchema.parse("lse_0000000000000902"), now, now)).resolves.toBeNull();
    await expect(store.heartbeat(envelopeId, deviceId, leaseId, now, "2026-07-20T16:02:00.000Z")).resolves.toMatchObject({ leaseExpiresAt: "2026-07-20T16:02:00.000Z" });
    await expect(store.completeLease({
      envelopeId, deviceId, leaseId, now, terminalKind: "needs_input",
      responseCiphertext: "response", hostSessionCiphertext: "session",
    })).resolves.toMatchObject({ state: "response_ready" });
    await expect(store.getResponseReadyForLink(otherLinkId)).resolves.toBeNull();
    await expect(store.markResponseSent(envelopeId, now)).resolves.toMatchObject({ state: "awaiting_user" });
    await expect(store.markResponseSent(envelopeId, now)).resolves.toBeNull();

    const resumedInput = envelope({
      id: MessageEnvelopeIdSchema.parse("msg_0000000000000903"),
      requestId: RequestIdSchema.parse("req_0000000000000903"),
      providerMessageHash: "provider-three",
      inboundCiphertext: "follow-up",
    });
    await expect(store.enqueueOrResume(resumedInput, "2026-07-20T16:03:00.000Z", capacity)).resolves.toMatchObject({
      kind: "resumed", envelope: { id: envelopeId, inboundCiphertext: "follow-up", state: "queued" },
    });
    const expiredLease = await store.claim(deviceId, MessageLeaseIdSchema.parse("lse_0000000000000903"), "2026-07-20T16:03:00.000Z", "2026-07-20T16:03:01.000Z");
    expect(expiredLease).not.toBeNull();
    await expect(store.claim(deviceId, MessageLeaseIdSchema.parse("lse_0000000000000904"), "2026-07-20T16:03:02.000Z", "2026-07-20T16:04:00.000Z"))
      .resolves.toMatchObject({ leaseId: "lse_0000000000000904", attemptCount: 3 });

    await store.saveDeliveryReceipt({
      id: "receipt-one", envelopeId, providerDeliveryHash: "delivery-one", status: "accepted",
      occurredAt: "2026-07-20T16:04:00.000Z", failureCode: null, createdAt: now,
    });
    await store.saveDeliveryReceipt({
      id: "receipt-duplicate", envelopeId, providerDeliveryHash: "delivery-one", status: "failed",
      occurredAt: "2026-07-20T16:04:01.000Z", failureCode: "ignored", createdAt: now,
    });
    await expect(store.updateDeliveryStatus("missing", "read", now, null)).resolves.toBe(false);
    await expect(store.updateDeliveryStatus("delivery-one", "read", now, null)).resolves.toBe(false);
    await expect(store.updateDeliveryStatus("delivery-one", "delivered", "2026-07-20T16:05:00.000Z", null)).resolves.toBe(true);
    await expect(store.operatorSnapshot("2026-07-20T16:02:00.000Z")).resolves.toMatchObject({ openMessages: 1, leasedMessages: 1, onlineRunnerDevices: 1 });
    await expect(store.deleteExpired("2026-07-28T00:00:00.000Z")).resolves.toBe(1);
    await expect(store.operatorSnapshot(now)).resolves.toMatchObject({ openMessages: 0, oldestOpenReceivedAt: null });
  });

  it("recovers a saturated queued request only when a fresh runner asks", async () => {
    const store = new MemoryMessageEnvelopeStore();
    await store.saveDevice(device());
    await store.createProviderLink(link());
    await store.enqueueOrResume(envelope({ attemptCount: 20 }), now, { perLink: 1, global: 1 });
    await expect(store.claim(deviceId, leaseId, now, "2026-07-20T16:01:00.000Z")).resolves.toBeNull();
    await expect(store.claim(deviceId, leaseId, now, "2026-07-20T16:01:00.000Z", true))
      .resolves.toMatchObject({ state: "leased", attemptCount: 1 });
  });
});
