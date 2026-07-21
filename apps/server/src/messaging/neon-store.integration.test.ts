import {
  ActorIdSchema,
  HouseholdIdSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  ProviderLinkIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NeonConnection } from "../persistence/neon.js";
import { NeonMessageEnvelopeStore } from "./neon-store.js";
import type { MessageEnvelopeRecord, ProviderIdentityLinkRecord, RunnerDeviceRecord } from "./ports.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const testDatabaseUrl = databaseUrl ?? "postgresql://invalid.local/disabled-test";

describeDatabase("NeonMessageEnvelopeStore", () => {
  const userId = UserIdSchema.parse("usr_0000000000000601");
  const actorId = ActorIdSchema.parse("act_0000000000000601");
  const householdId = HouseholdIdSchema.parse("hsh_0000000000000601");
  const deviceId = RunnerDeviceIdSchema.parse("dev_0000000000000601");
  const linkId = ProviderLinkIdSchema.parse("lnk_0000000000000601");
  const envelopeId = MessageEnvelopeIdSchema.parse("msg_0000000000000601");
  let connection: NeonConnection;
  let store: NeonMessageEnvelopeStore;

  beforeAll(async () => {
    connection = new NeonConnection(testDatabaseUrl, testDatabaseUrl);
    store = new NeonMessageEnvelopeStore(connection);
    await connection.direct`DELETE FROM users WHERE id = ${userId}`;
    await connection.direct`DELETE FROM households WHERE id = ${householdId}`;
    await connection.direct`
      INSERT INTO users (id, actor_id, display_name)
      VALUES (${userId}, ${actorId}, 'Messaging Owner')
    `;
    await connection.direct`
      INSERT INTO households (id, display_name, repository_path, repository_head, provisioning_state)
      VALUES (${householdId}, 'Messaging Household', 'integration/messaging-0601.git', ${"6".repeat(40)}, 'ready')
    `;
  });

  afterAll(async () => {
    await connection.direct`DELETE FROM users WHERE id = ${userId}`;
    await connection.direct`DELETE FROM households WHERE id = ${householdId}`;
    await connection.close();
  });

  it("persists linking, deduplication, leases, follow-ups, delivery, and retention", async () => {
    const createdAt = "2026-07-20T16:00:00.000Z";
    const device: RunnerDeviceRecord = {
      id: deviceId,
      userId,
      householdId,
      name: "Kitchen Mac",
      lastSeenAt: null,
      revokedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    await store.saveDevice(device);
    await expect(store.getDevice(deviceId)).resolves.toEqual(device);

    const challenge = {
      id: "challenge-messaging-0601",
      userId,
      householdId,
      runnerDeviceId: deviceId,
      tokenHash: "a".repeat(64),
      browserBindingHash: "b".repeat(64),
      expiresAt: "2026-07-20T16:10:00.000Z",
      consumedAt: null,
      createdAt,
    };
    await store.saveLinkChallenge(challenge);
    await expect(store.consumeLinkChallenge(challenge.tokenHash, "2026-07-20T16:01:00.000Z"))
      .resolves.toEqual({ ...challenge, consumedAt: "2026-07-20T16:01:00.000Z" });

    const pendingLink: ProviderIdentityLinkRecord = {
      id: linkId,
      userId,
      householdId,
      runnerDeviceId: deviceId,
      providerIdentityHash: "c".repeat(64),
      destinationCiphertext: "d".repeat(32),
      browserBindingHash: challenge.browserBindingHash,
      confirmationExpiresAt: challenge.expiresAt,
      confirmedAt: null,
      linkedAt: "2026-07-20T16:01:00.000Z",
      revokedAt: null,
      updatedAt: "2026-07-20T16:01:00.000Z",
    };
    await store.createProviderLink(pendingLink);
    await expect(store.findActiveLinkForUser(userId)).resolves.toBeNull();
    const confirmed = await store.confirmProviderLink(userId, linkId, challenge.browserBindingHash, "2026-07-20T16:02:00.000Z");
    expect(confirmed).toMatchObject({ confirmedAt: "2026-07-20T16:02:00.000Z", browserBindingHash: null });
    await expect(store.findActiveLinkByIdentityHash(pendingLink.providerIdentityHash)).resolves.toMatchObject({ id: linkId });

    const envelope = messageEnvelope(createdAt);
    await expect(store.enqueueOrResume(envelope, createdAt, { perLink: 1, global: 10 })).resolves.toMatchObject({ kind: "created" });
    await expect(store.operatorSnapshot("2026-07-20T15:55:00.000Z")).resolves.toMatchObject({
      openMessages: 1, queuedMessages: 1, activeRunnerDevices: 1, onlineRunnerDevices: 0,
    });
    await expect(store.enqueueOrResume(envelope, createdAt, { perLink: 1, global: 10 })).resolves.toMatchObject({ kind: "duplicate" });
    await expect(store.enqueueOrResume({
      ...envelope,
      id: MessageEnvelopeIdSchema.parse("msg_0000000000000602"),
      requestId: RequestIdSchema.parse("req_0000000000000602"),
      providerMessageHash: "e".repeat(64),
    }, createdAt, { perLink: 1, global: 10 })).resolves.toEqual({ kind: "overloaded" });

    const leaseId = MessageLeaseIdSchema.parse("lse_0000000000000601");
    const claimed = await store.claim(deviceId, leaseId, "2026-07-20T16:03:00.000Z", "2026-07-20T16:08:00.000Z");
    expect(claimed).toMatchObject({ state: "leased", leaseId, attemptCount: 1 });
    await expect(store.operatorSnapshot("2026-07-20T15:55:00.000Z")).resolves.toMatchObject({
      openMessages: 1, leasedMessages: 1, onlineRunnerDevices: 1,
    });
    await expect(store.heartbeat(envelopeId, deviceId, leaseId, "2026-07-20T16:04:00.000Z", "2026-07-20T16:09:00.000Z"))
      .resolves.toMatchObject({ leaseExpiresAt: "2026-07-20T16:09:00.000Z" });
    await expect(store.completeLease({
      envelopeId,
      deviceId,
      leaseId,
      now: "2026-07-20T16:05:00.000Z",
      terminalKind: "needs_input",
      responseCiphertext: "f".repeat(32),
      hostSessionCiphertext: "g".repeat(32),
    })).resolves.toMatchObject({ state: "response_ready", terminalKind: "needs_input" });
    await expect(store.getResponseReadyForLink(linkId)).resolves.toMatchObject({ id: envelopeId });
    await expect(store.getResponseReadyForDevice(deviceId)).resolves.toMatchObject({ id: envelopeId });

    await store.saveDeliveryReceipt({
      id: "delivery-messaging-0601",
      envelopeId,
      providerDeliveryHash: "1".repeat(64),
      status: "accepted",
      occurredAt: "2026-07-20T16:05:00.000Z",
      failureCode: null,
      createdAt: "2026-07-20T16:05:00.000Z",
    });
    await expect(store.updateDeliveryStatus("1".repeat(64), "delivered", "2026-07-20T16:06:00.000Z", null)).resolves.toBe(true);
    await expect(store.markResponseSent(envelopeId, "2026-07-20T16:06:00.000Z")).resolves.toMatchObject({ state: "awaiting_user" });

    const followUp = {
      ...messageEnvelope("2026-07-20T16:07:00.000Z"),
      id: MessageEnvelopeIdSchema.parse("msg_0000000000000603"),
      requestId: RequestIdSchema.parse("req_0000000000000603"),
      providerMessageHash: "2".repeat(64),
    };
    await expect(store.enqueueOrResume(followUp, "2026-07-20T16:07:00.000Z", { perLink: 1, global: 10 }))
      .resolves.toMatchObject({ kind: "resumed", envelope: { id: envelopeId, state: "queued" } });
    await expect(store.enqueueOrResume(followUp, "2026-07-20T16:07:00.000Z", { perLink: 1, global: 10 }))
      .resolves.toMatchObject({ kind: "duplicate", envelope: { id: envelopeId } });

    expect(await store.deleteExpired("2026-07-27T16:08:00.000Z")).toBe(2);
    await expect(store.getResponseReadyForLink(linkId)).resolves.toBeNull();
    await expect(store.revokeProviderLink(userId, "2026-07-27T16:09:00.000Z")).resolves.toBe(true);
    await expect(store.revokeDevice(userId, deviceId, "2026-07-27T16:09:00.000Z")).resolves.toBe(true);
  });

  function messageEnvelope(createdAt: string): MessageEnvelopeRecord {
    return {
      id: envelopeId,
      requestId: RequestIdSchema.parse("req_0000000000000601"),
      providerLinkId: linkId,
      providerMessageHash: "0".repeat(64),
      state: "queued",
      inboundCiphertext: "i".repeat(32),
      responseCiphertext: null,
      hostSessionCiphertext: null,
      terminalKind: null,
      receivedAt: createdAt,
      serviceWindowExpiresAt: "2026-07-21T16:00:00.000Z",
      leaseId: null,
      leaseDeviceId: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      failureCode: null,
      responseSentAt: null,
      expiresAt: "2026-07-27T16:00:00.000Z",
      createdAt,
      updatedAt: createdAt,
    };
  }
});
