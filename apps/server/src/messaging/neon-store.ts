import { z } from "zod";
import type { Sql, TransactionSql } from "postgres";
import {
  DateTimeSchema,
  HouseholdIdSchema,
  MessageEnvelopeIdSchema,
  MessageEnvelopeStateSchema,
  MessageLeaseIdSchema,
  ProviderLinkIdSchema,
  RequestIdSchema,
  RunnerDeviceIdSchema,
  UserIdSchema,
} from "@hfj/contracts";
import type { NeonConnection } from "../persistence/neon.js";
import type {
  EnqueueResult,
  MessageEnvelopeRecord,
  MessageEnvelopeStorePort,
  MessageQueueCapacity,
  MessageDeliveryReceiptRecord,
  MessageDeliveryStatus,
  MessagingOperationalSnapshot,
  ProviderIdentityLinkRecord,
  ProviderLinkChallengeRecord,
  RunnerDeviceRecord,
} from "./ports.js";

type Queryable = Sql | TransactionSql;

const DatabaseTimestampSchema = z.union([z.date(), DateTimeSchema]).transform((value) => new Date(value).toISOString());
const DeviceRowSchema = z.object({
  id: RunnerDeviceIdSchema,
  user_id: UserIdSchema,
  household_id: HouseholdIdSchema,
  display_name: z.string(),
  last_seen_at: DatabaseTimestampSchema.nullable(),
  revoked_at: DatabaseTimestampSchema.nullable(),
  created_at: DatabaseTimestampSchema,
  updated_at: DatabaseTimestampSchema,
});
const ChallengeRowSchema = z.object({
  id: z.string(),
  user_id: UserIdSchema,
  household_id: HouseholdIdSchema,
  runner_device_id: RunnerDeviceIdSchema,
  token_hash: z.string(),
  browser_binding_hash: z.string(),
  expires_at: DatabaseTimestampSchema,
  consumed_at: DatabaseTimestampSchema.nullable(),
  created_at: DatabaseTimestampSchema,
});
const LinkRowSchema = z.object({
  id: ProviderLinkIdSchema,
  user_id: UserIdSchema,
  household_id: HouseholdIdSchema,
  runner_device_id: RunnerDeviceIdSchema,
  provider_identity_hash: z.string(),
  destination_ciphertext: z.string(),
  browser_binding_hash: z.string().nullable(),
  confirmation_expires_at: DatabaseTimestampSchema,
  confirmed_at: DatabaseTimestampSchema.nullable(),
  linked_at: DatabaseTimestampSchema,
  revoked_at: DatabaseTimestampSchema.nullable(),
  updated_at: DatabaseTimestampSchema,
});
const EnvelopeRowSchema = z.object({
  id: MessageEnvelopeIdSchema,
  request_id: RequestIdSchema,
  provider_link_id: ProviderLinkIdSchema,
  provider_message_hash: z.string(),
  state: MessageEnvelopeStateSchema,
  inbound_ciphertext: z.string(),
  response_ciphertext: z.string().nullable(),
  host_session_ciphertext: z.string().nullable(),
  terminal_kind: z.enum(["completed", "needs_input", "blocked", "cancelled"]).nullable(),
  received_at: DatabaseTimestampSchema,
  service_window_expires_at: DatabaseTimestampSchema,
  lease_id: MessageLeaseIdSchema.nullable(),
  lease_device_id: RunnerDeviceIdSchema.nullable(),
  lease_expires_at: DatabaseTimestampSchema.nullable(),
  attempt_count: z.number().int(),
  failure_code: z.string().nullable(),
  response_sent_at: DatabaseTimestampSchema.nullable(),
  expires_at: DatabaseTimestampSchema,
  created_at: DatabaseTimestampSchema,
  updated_at: DatabaseTimestampSchema,
});

export class NeonMessageEnvelopeStore implements MessageEnvelopeStorePort {
  constructor(private readonly connection: NeonConnection) {}

  async saveDevice(device: RunnerDeviceRecord): Promise<void> {
    await this.connection.pooled`
      INSERT INTO runner_devices (id, user_id, household_id, display_name, last_seen_at, revoked_at, created_at, updated_at)
      VALUES (${device.id}, ${device.userId}, ${device.householdId}, ${device.name}, ${device.lastSeenAt}, ${device.revokedAt}, ${device.createdAt}, ${device.updatedAt})
    `;
  }

  async getDevice(deviceId: RunnerDeviceRecord["id"]): Promise<RunnerDeviceRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, household_id, display_name, last_seen_at, revoked_at, created_at, updated_at
      FROM runner_devices WHERE id = ${deviceId}
    `;
    return rows[0] === undefined ? null : deviceFromRow(rows[0]);
  }

  async revokeDevice(userId: RunnerDeviceRecord["userId"], deviceId: RunnerDeviceRecord["id"], revokedAt: string): Promise<boolean> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE runner_devices SET revoked_at = ${revokedAt}, updated_at = ${revokedAt}
      WHERE id = ${deviceId} AND user_id = ${userId} AND revoked_at IS NULL RETURNING id
    `;
    return rows.length === 1;
  }

  async saveLinkChallenge(challenge: ProviderLinkChallengeRecord): Promise<void> {
    await this.connection.pooled`
      INSERT INTO provider_link_challenges (
        id, provider, user_id, household_id, runner_device_id, token_hash,
        browser_binding_hash, expires_at, consumed_at, created_at
      ) VALUES (
        ${challenge.id}, 'whatsapp_cloud', ${challenge.userId}, ${challenge.householdId}, ${challenge.runnerDeviceId},
        ${challenge.tokenHash}, ${challenge.browserBindingHash}, ${challenge.expiresAt}, ${challenge.consumedAt}, ${challenge.createdAt}
      )
    `;
  }

  async consumeLinkChallenge(tokenHash: string, consumedAt: string): Promise<ProviderLinkChallengeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE provider_link_challenges SET consumed_at = ${consumedAt}
      WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > ${consumedAt}
      RETURNING id, user_id, household_id, runner_device_id, token_hash, browser_binding_hash, expires_at, consumed_at, created_at
    `;
    return rows[0] === undefined ? null : challengeFromRow(rows[0]);
  }

  async createProviderLink(link: ProviderIdentityLinkRecord): Promise<void> {
    await this.connection.pooled`
      INSERT INTO provider_identity_links (
        id, provider, user_id, household_id, runner_device_id, provider_identity_hash,
        destination_ciphertext, browser_binding_hash, confirmation_expires_at, confirmed_at,
        linked_at, revoked_at, updated_at
      ) VALUES (
        ${link.id}, 'whatsapp_cloud', ${link.userId}, ${link.householdId}, ${link.runnerDeviceId},
        ${link.providerIdentityHash}, ${link.destinationCiphertext}, ${link.browserBindingHash}, ${link.confirmationExpiresAt},
        ${link.confirmedAt}, ${link.linkedAt}, ${link.revokedAt}, ${link.updatedAt}
      )
    `;
  }

  async findActiveLinkByIdentityHash(providerIdentityHash: string): Promise<ProviderIdentityLinkRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, household_id, runner_device_id, provider_identity_hash, destination_ciphertext,
             browser_binding_hash, confirmation_expires_at, confirmed_at, linked_at, revoked_at, updated_at
      FROM provider_identity_links
      WHERE provider = 'whatsapp_cloud' AND provider_identity_hash = ${providerIdentityHash}
        AND confirmed_at IS NOT NULL AND revoked_at IS NULL
    `;
    return rows[0] === undefined ? null : linkFromRow(rows[0]);
  }

  async findActiveLinkForUser(userId: ProviderIdentityLinkRecord["userId"]): Promise<ProviderIdentityLinkRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, household_id, runner_device_id, provider_identity_hash, destination_ciphertext,
             browser_binding_hash, confirmation_expires_at, confirmed_at, linked_at, revoked_at, updated_at
      FROM provider_identity_links
      WHERE provider = 'whatsapp_cloud' AND user_id = ${userId} AND confirmed_at IS NOT NULL AND revoked_at IS NULL
    `;
    return rows[0] === undefined ? null : linkFromRow(rows[0]);
  }

  async findCurrentLinkForUser(userId: ProviderIdentityLinkRecord["userId"]): Promise<ProviderIdentityLinkRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, household_id, runner_device_id, provider_identity_hash, destination_ciphertext,
             browser_binding_hash, confirmation_expires_at, confirmed_at, linked_at, revoked_at, updated_at
      FROM provider_identity_links
      WHERE provider = 'whatsapp_cloud' AND user_id = ${userId} AND revoked_at IS NULL
    `;
    return rows[0] === undefined ? null : linkFromRow(rows[0]);
  }

  async getProviderLink(linkId: ProviderIdentityLinkRecord["id"]): Promise<ProviderIdentityLinkRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, user_id, household_id, runner_device_id, provider_identity_hash, destination_ciphertext,
             browser_binding_hash, confirmation_expires_at, confirmed_at, linked_at, revoked_at, updated_at
      FROM provider_identity_links WHERE id = ${linkId}
    `;
    return rows[0] === undefined ? null : linkFromRow(rows[0]);
  }

  async confirmProviderLink(userId: ProviderIdentityLinkRecord["userId"], linkId: ProviderIdentityLinkRecord["id"], browserBindingHash: string, confirmedAt: string): Promise<ProviderIdentityLinkRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE provider_identity_links SET browser_binding_hash = NULL, confirmed_at = ${confirmedAt}, updated_at = ${confirmedAt}
      WHERE id = ${linkId} AND user_id = ${userId} AND revoked_at IS NULL AND confirmed_at IS NULL
        AND browser_binding_hash = ${browserBindingHash} AND confirmation_expires_at > ${confirmedAt}
      RETURNING id, user_id, household_id, runner_device_id, provider_identity_hash, destination_ciphertext,
                browser_binding_hash, confirmation_expires_at, confirmed_at, linked_at, revoked_at, updated_at
    `;
    return rows[0] === undefined ? null : linkFromRow(rows[0]);
  }

  async revokeProviderLink(userId: ProviderIdentityLinkRecord["userId"], revokedAt: string): Promise<boolean> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE provider_identity_links SET revoked_at = ${revokedAt}, updated_at = ${revokedAt}
      WHERE provider = 'whatsapp_cloud' AND user_id = ${userId} AND revoked_at IS NULL RETURNING id
    `;
    return rows.length === 1;
  }

  async enqueueOrResume(input: MessageEnvelopeRecord, providerEventOccurredAt: string, capacity: MessageQueueCapacity): Promise<EnqueueResult> {
    return await this.connection.pooled.begin(async (sql): Promise<EnqueueResult> => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.providerMessageHash}, 0))`;
      const duplicate = await sql<Record<string, unknown>[]>`
        SELECT e.id, e.request_id, e.provider_link_id, e.provider_message_hash, e.state, e.inbound_ciphertext,
               e.response_ciphertext, e.host_session_ciphertext, e.terminal_kind, e.received_at,
               e.service_window_expires_at, e.lease_id, e.lease_device_id, e.lease_expires_at,
               e.attempt_count, e.failure_code, e.response_sent_at, e.expires_at, e.created_at, e.updated_at
        FROM message_provider_events p JOIN message_envelopes e ON e.id = p.message_envelope_id
        WHERE p.provider_message_hash = ${input.providerMessageHash}
      `;
      if (duplicate[0] !== undefined) return { kind: "duplicate" as const, envelope: envelopeFromRow(duplicate[0]) };
      const pending = await sql<Record<string, unknown>[]>`
        SELECT id FROM message_envelopes
        WHERE provider_link_id = ${input.providerLinkId} AND state = 'awaiting_user'
        ORDER BY received_at, id LIMIT 1 FOR UPDATE
      `;
      if (pending[0]?.id !== undefined) {
        const pendingEnvelopeId = MessageEnvelopeIdSchema.parse(pending[0].id);
        const rows = await sql<Record<string, unknown>[]>`
          UPDATE message_envelopes SET
            state = 'queued', inbound_ciphertext = ${input.inboundCiphertext}, response_ciphertext = NULL,
            terminal_kind = NULL, received_at = ${input.receivedAt}, service_window_expires_at = ${input.serviceWindowExpiresAt},
            updated_at = ${providerEventOccurredAt}
          WHERE id = ${pendingEnvelopeId}
          RETURNING id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
                    response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
                    service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
                    attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
        `;
        await sql`
          INSERT INTO message_provider_events (provider_message_hash, message_envelope_id, occurred_at)
          VALUES (${input.providerMessageHash}, ${pendingEnvelopeId}, ${providerEventOccurredAt})
        `;
        return { kind: "resumed" as const, envelope: envelopeFromRow(rows[0]) };
      }
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('fullwell-messaging-queue-capacity', 0))`;
      const counts = await sql<{ global_count: number; link_count: number }[]>`
        SELECT count(*)::integer AS global_count,
               count(*) FILTER (WHERE provider_link_id = ${input.providerLinkId})::integer AS link_count
        FROM message_envelopes
        WHERE state IN ('queued', 'leased', 'awaiting_user', 'response_ready')
      `;
      const count = z.object({ global_count: z.number().int().nonnegative(), link_count: z.number().int().nonnegative() }).parse(counts[0]);
      if (count.global_count >= capacity.global || count.link_count >= capacity.perLink) return { kind: "overloaded" as const };
      await insertEnvelope(sql, input);
      await sql`
        INSERT INTO message_provider_events (provider_message_hash, message_envelope_id, occurred_at)
        VALUES (${input.providerMessageHash}, ${input.id}, ${providerEventOccurredAt})
      `;
      return { kind: "created" as const, envelope: input };
    });
  }

  async claim(deviceId: RunnerDeviceRecord["id"], leaseId: MessageEnvelopeRecord["leaseId"] & string, now: string, leaseExpiresAt: string): Promise<MessageEnvelopeRecord | null> {
    return await this.connection.pooled.begin(async (sql): Promise<MessageEnvelopeRecord | null> => {
      await sql`
        UPDATE message_envelopes SET state = 'queued', lease_id = NULL, lease_device_id = NULL, lease_expires_at = NULL, updated_at = ${now}
        WHERE state = 'leased' AND lease_device_id = ${deviceId} AND lease_expires_at <= ${now}
      `;
      const rows = await sql<Record<string, unknown>[]>`
        SELECT e.id FROM message_envelopes e
        JOIN provider_identity_links l ON l.id = e.provider_link_id AND l.confirmed_at IS NOT NULL AND l.revoked_at IS NULL
        JOIN runner_devices d ON d.id = l.runner_device_id AND d.revoked_at IS NULL
        WHERE e.state = 'queued' AND l.runner_device_id = ${deviceId}
          AND e.expires_at > ${now} AND e.attempt_count < 20
        ORDER BY e.received_at, e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED
      `;
      if (rows[0]?.id === undefined) return null;
      const claimedEnvelopeId = MessageEnvelopeIdSchema.parse(rows[0].id);
      const claimed = await sql<Record<string, unknown>[]>`
        UPDATE message_envelopes SET
          state = 'leased', lease_id = ${leaseId}, lease_device_id = ${deviceId}, lease_expires_at = ${leaseExpiresAt},
          attempt_count = attempt_count + 1, updated_at = ${now}
        WHERE id = ${claimedEnvelopeId}
        RETURNING id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
                  response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
                  service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
                  attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
      `;
      await sql`UPDATE runner_devices SET last_seen_at = ${now}, updated_at = ${now} WHERE id = ${deviceId}`;
      return envelopeFromRow(claimed[0]);
    });
  }

  async heartbeat(envelopeId: MessageEnvelopeRecord["id"], deviceId: RunnerDeviceRecord["id"], leaseId: NonNullable<MessageEnvelopeRecord["leaseId"]>, now: string, leaseExpiresAt: string): Promise<MessageEnvelopeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE message_envelopes SET lease_expires_at = ${leaseExpiresAt}, updated_at = ${now}
      WHERE id = ${envelopeId} AND state = 'leased' AND lease_device_id = ${deviceId}
        AND lease_id = ${leaseId} AND lease_expires_at > ${now}
      RETURNING id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
                response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
                service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
                attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
    `;
    return rows[0] === undefined ? null : envelopeFromRow(rows[0]);
  }

  async completeLease(input: Parameters<MessageEnvelopeStorePort["completeLease"]>[0]): Promise<MessageEnvelopeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE message_envelopes SET
        state = 'response_ready', terminal_kind = ${input.terminalKind}, response_ciphertext = ${input.responseCiphertext},
        host_session_ciphertext = ${input.hostSessionCiphertext}, lease_id = NULL, lease_device_id = NULL,
        lease_expires_at = NULL, updated_at = ${input.now}
      WHERE id = ${input.envelopeId} AND state = 'leased' AND lease_device_id = ${input.deviceId}
        AND lease_id = ${input.leaseId} AND lease_expires_at > ${input.now}
      RETURNING id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
                response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
                service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
                attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
    `;
    return rows[0] === undefined ? null : envelopeFromRow(rows[0]);
  }

  async getResponseReadyForLink(linkId: ProviderIdentityLinkRecord["id"]): Promise<MessageEnvelopeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
             response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
             service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
             attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
      FROM message_envelopes WHERE provider_link_id = ${linkId} AND state = 'response_ready'
      ORDER BY received_at, id LIMIT 1
    `;
    return rows[0] === undefined ? null : envelopeFromRow(rows[0]);
  }

  async getResponseReadyForDevice(deviceId: RunnerDeviceRecord["id"]): Promise<MessageEnvelopeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      SELECT e.id, e.request_id, e.provider_link_id, e.provider_message_hash, e.state, e.inbound_ciphertext,
             e.response_ciphertext, e.host_session_ciphertext, e.terminal_kind, e.received_at,
             e.service_window_expires_at, e.lease_id, e.lease_device_id, e.lease_expires_at,
             e.attempt_count, e.failure_code, e.response_sent_at, e.expires_at, e.created_at, e.updated_at
      FROM message_envelopes e
      JOIN provider_identity_links l ON l.id = e.provider_link_id
      WHERE e.state = 'response_ready' AND l.runner_device_id = ${deviceId}
        AND l.confirmed_at IS NOT NULL AND l.revoked_at IS NULL
      ORDER BY e.received_at, e.id LIMIT 1
    `;
    return rows[0] === undefined ? null : envelopeFromRow(rows[0]);
  }

  async markResponseSent(envelopeId: MessageEnvelopeRecord["id"], sentAt: string): Promise<MessageEnvelopeRecord | null> {
    const rows = await this.connection.pooled<Record<string, unknown>[]>`
      UPDATE message_envelopes SET
        state = CASE WHEN terminal_kind = 'needs_input' THEN 'awaiting_user' ELSE 'completed' END,
        response_sent_at = ${sentAt}, response_ciphertext = NULL, updated_at = ${sentAt}
      WHERE id = ${envelopeId} AND state = 'response_ready' AND terminal_kind IS NOT NULL
      RETURNING id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
                response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
                service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
                attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
    `;
    return rows[0] === undefined ? null : envelopeFromRow(rows[0]);
  }

  async saveDeliveryReceipt(receipt: MessageDeliveryReceiptRecord): Promise<void> {
    await this.connection.pooled`
      INSERT INTO message_delivery_receipts (
        id, message_envelope_id, provider_delivery_hash, status, occurred_at, failure_code, created_at
      ) VALUES (
        ${receipt.id}, ${receipt.envelopeId}, ${receipt.providerDeliveryHash}, ${receipt.status},
        ${receipt.occurredAt}, ${receipt.failureCode}, ${receipt.createdAt}
      ) ON CONFLICT (provider_delivery_hash) DO NOTHING
    `;
  }

  async updateDeliveryStatus(providerDeliveryHash: string, status: MessageDeliveryStatus, occurredAt: string, failureCode: string | null): Promise<boolean> {
    const rows = await this.connection.pooled<{ id: string }[]>`
      UPDATE message_delivery_receipts SET status = ${status}, occurred_at = ${occurredAt}, failure_code = ${failureCode}
      WHERE provider_delivery_hash = ${providerDeliveryHash} AND occurred_at <= ${occurredAt}
      RETURNING id
    `;
    return rows.length === 1;
  }

  async operatorSnapshot(onlineSince: string): Promise<MessagingOperationalSnapshot> {
    const [messageRows, deviceRows] = await Promise.all([
      this.connection.pooled<Record<string, unknown>[]>`
        SELECT
          count(*)::integer AS open_messages,
          count(*) FILTER (WHERE state = 'queued')::integer AS queued_messages,
          count(*) FILTER (WHERE state = 'leased')::integer AS leased_messages,
          count(*) FILTER (WHERE state = 'awaiting_user')::integer AS awaiting_user_messages,
          count(*) FILTER (WHERE state = 'response_ready')::integer AS response_ready_messages,
          min(received_at) AS oldest_open_received_at
        FROM message_envelopes
        WHERE state IN ('queued', 'leased', 'awaiting_user', 'response_ready')
      `,
      this.connection.pooled<Record<string, unknown>[]>`
        SELECT
          count(*)::integer AS active_runner_devices,
          count(*) FILTER (WHERE last_seen_at >= ${onlineSince})::integer AS online_runner_devices
        FROM runner_devices
        WHERE revoked_at IS NULL
      `,
    ]);
    const messages = z.object({
      open_messages: z.number().int().nonnegative(),
      queued_messages: z.number().int().nonnegative(),
      leased_messages: z.number().int().nonnegative(),
      awaiting_user_messages: z.number().int().nonnegative(),
      response_ready_messages: z.number().int().nonnegative(),
      oldest_open_received_at: DatabaseTimestampSchema.nullable(),
    }).parse(messageRows[0]);
    const devices = z.object({
      active_runner_devices: z.number().int().nonnegative(),
      online_runner_devices: z.number().int().nonnegative(),
    }).parse(deviceRows[0]);
    return {
      openMessages: messages.open_messages,
      queuedMessages: messages.queued_messages,
      leasedMessages: messages.leased_messages,
      awaitingUserMessages: messages.awaiting_user_messages,
      responseReadyMessages: messages.response_ready_messages,
      oldestOpenReceivedAt: messages.oldest_open_received_at,
      activeRunnerDevices: devices.active_runner_devices,
      onlineRunnerDevices: devices.online_runner_devices,
    };
  }

  async deleteExpired(now: string): Promise<number> {
    return await this.connection.pooled.begin(async (sql): Promise<number> => {
      const envelopes = await sql<{ id: string }[]>`DELETE FROM message_envelopes WHERE expires_at <= ${now} RETURNING id`;
      const challenges = await sql<{ id: string }[]>`DELETE FROM provider_link_challenges WHERE expires_at <= ${now} RETURNING id`;
      const pendingLinks = await sql<{ id: string }[]>`
        DELETE FROM provider_identity_links
        WHERE confirmed_at IS NULL AND confirmation_expires_at <= ${now}
        RETURNING id
      `;
      return envelopes.length + challenges.length + pendingLinks.length;
    });
  }
}

async function insertEnvelope(sql: Queryable, input: MessageEnvelopeRecord): Promise<void> {
  await sql`
    INSERT INTO message_envelopes (
      id, request_id, provider_link_id, provider_message_hash, state, inbound_ciphertext,
      response_ciphertext, host_session_ciphertext, terminal_kind, received_at,
      service_window_expires_at, lease_id, lease_device_id, lease_expires_at,
      attempt_count, failure_code, response_sent_at, expires_at, created_at, updated_at
    ) VALUES (
      ${input.id}, ${input.requestId}, ${input.providerLinkId}, ${input.providerMessageHash}, ${input.state}, ${input.inboundCiphertext},
      ${input.responseCiphertext}, ${input.hostSessionCiphertext}, ${input.terminalKind}, ${input.receivedAt},
      ${input.serviceWindowExpiresAt}, ${input.leaseId}, ${input.leaseDeviceId}, ${input.leaseExpiresAt},
      ${input.attemptCount}, ${input.failureCode}, ${input.responseSentAt}, ${input.expiresAt}, ${input.createdAt}, ${input.updatedAt}
    )
  `;
}

function deviceFromRow(row: Record<string, unknown>): RunnerDeviceRecord {
  const parsed = DeviceRowSchema.parse(row);
  return {
    id: parsed.id, userId: parsed.user_id, householdId: parsed.household_id, name: parsed.display_name,
    lastSeenAt: parsed.last_seen_at, revokedAt: parsed.revoked_at, createdAt: parsed.created_at, updatedAt: parsed.updated_at,
  };
}

function challengeFromRow(row: Record<string, unknown>): ProviderLinkChallengeRecord {
  const parsed = ChallengeRowSchema.parse(row);
  return {
    id: parsed.id, userId: parsed.user_id, householdId: parsed.household_id, runnerDeviceId: parsed.runner_device_id,
    tokenHash: parsed.token_hash, browserBindingHash: parsed.browser_binding_hash, expiresAt: parsed.expires_at,
    consumedAt: parsed.consumed_at, createdAt: parsed.created_at,
  };
}

function linkFromRow(row: Record<string, unknown>): ProviderIdentityLinkRecord {
  const parsed = LinkRowSchema.parse(row);
  return {
    id: parsed.id, userId: parsed.user_id, householdId: parsed.household_id, runnerDeviceId: parsed.runner_device_id,
    providerIdentityHash: parsed.provider_identity_hash, destinationCiphertext: parsed.destination_ciphertext,
    browserBindingHash: parsed.browser_binding_hash, confirmationExpiresAt: parsed.confirmation_expires_at,
    confirmedAt: parsed.confirmed_at, linkedAt: parsed.linked_at, revokedAt: parsed.revoked_at, updatedAt: parsed.updated_at,
  };
}

function envelopeFromRow(row: Record<string, unknown> | undefined): MessageEnvelopeRecord {
  const parsed = EnvelopeRowSchema.parse(row);
  return {
    id: parsed.id, requestId: parsed.request_id, providerLinkId: parsed.provider_link_id,
    providerMessageHash: parsed.provider_message_hash, state: parsed.state, inboundCiphertext: parsed.inbound_ciphertext,
    responseCiphertext: parsed.response_ciphertext, hostSessionCiphertext: parsed.host_session_ciphertext,
    terminalKind: parsed.terminal_kind, receivedAt: parsed.received_at, serviceWindowExpiresAt: parsed.service_window_expires_at,
    leaseId: parsed.lease_id, leaseDeviceId: parsed.lease_device_id, leaseExpiresAt: parsed.lease_expires_at,
    attemptCount: parsed.attempt_count, failureCode: parsed.failure_code, responseSentAt: parsed.response_sent_at,
    expiresAt: parsed.expires_at, createdAt: parsed.created_at, updatedAt: parsed.updated_at,
  };
}
