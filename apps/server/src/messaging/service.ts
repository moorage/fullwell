import {
  HouseholdIdSchema,
  InboundRestockingTextSchema,
  MessageEnvelopeIdSchema,
  MessageLeaseIdSchema,
  ProviderLinkIdSchema,
  RequestIdSchema,
  RunnerClaimRequestSchema,
  RunnerCompletionSchema,
  RunnerDeviceIdSchema,
  RunnerDeviceRegistrationSchema,
  RunnerHeartbeatSchema,
  WhatsAppLinkRequestSchema,
  type MessageEnvelopeId,
  type ProviderLinkId,
  type RunnerClaimResponse,
} from "@hfj/contracts";
import type { Clock, RandomSource, TelemetryPort, TokenHasher } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { AppError } from "../core/errors.js";
import type {
  MessageCipherPort,
  MessageEnvelopeRecord,
  MessageEnvelopeStorePort,
  MessagingAuthorizationPort,
  ProviderIdentityLinkRecord,
  MessageDeliveryStatus,
  WhatsAppProviderPort,
} from "./ports.js";

const LINK_PREFIX = "FULLWELL LINK ";
const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const MAXIMUM_FREE_SERVICE_SEND_CUTOFF = new Date("2026-10-01T00:00:00-07:00");

export interface ProviderInboundText {
  readonly providerMessageId: string;
  readonly senderIdentity: string;
  readonly text: string;
  readonly occurredAt: string;
}

export interface ProviderDeliveryStatus {
  readonly providerDeliveryId: string;
  readonly status: Exclude<MessageDeliveryStatus, "accepted">;
  readonly occurredAt: string;
  readonly failureCode: string | null;
}

export interface MessagingServiceOptions {
  readonly freeServiceSendCutoff: Date;
  readonly contactUrl: URL;
  readonly leaseMilliseconds?: number;
  readonly retentionMilliseconds?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly intakeEnabled?: boolean;
  readonly linkingEnabled?: boolean;
  readonly runnerClaimsEnabled?: boolean;
  readonly serviceRepliesEnabled?: boolean;
  readonly maxOpenMessagesPerLink?: number;
  readonly maxOpenMessagesGlobal?: number;
}

export type MessagingAccountStatus =
  | { readonly kind: "disabled"; readonly availableThrough: string }
  | { readonly kind: "not_configured"; readonly availableThrough: string }
  | { readonly kind: "setup"; readonly availableThrough: string; readonly deviceId: string; readonly householdId: string; readonly deviceName: string }
  | { readonly kind: "pending_confirmation"; readonly availableThrough: string; readonly linkId: string; readonly deviceId: string; readonly householdId: string; readonly deviceName: string; readonly confirmationExpiresAt: string }
  | { readonly kind: "expired"; readonly availableThrough: string; readonly linkId: string; readonly deviceId: string; readonly householdId: string; readonly deviceName: string; readonly confirmationExpiresAt: string }
  | { readonly kind: "linked"; readonly availableThrough: string; readonly deviceId: string; readonly householdId: string; readonly deviceName: string; readonly lastSeenAt: string | null };

export interface MessagingOperatorHealth {
  readonly healthy: boolean;
  readonly channel_available: boolean;
  readonly open_messages: number;
  readonly queued_messages: number;
  readonly leased_messages: number;
  readonly awaiting_user_messages: number;
  readonly response_ready_messages: number;
  readonly oldest_open_age_seconds: number | null;
  readonly active_runner_devices: number;
  readonly online_runner_devices: number;
}

export class MessagingService {
  private readonly leaseMilliseconds: number;
  private readonly retentionMilliseconds: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly queueCapacity: { readonly perLink: number; readonly global: number };

  constructor(
    private readonly store: MessageEnvelopeStorePort,
    private readonly cipher: MessageCipherPort,
    private readonly provider: WhatsAppProviderPort,
    private readonly authorization: MessagingAuthorizationPort,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly hasher: TokenHasher,
    private readonly telemetry: TelemetryPort,
    private readonly options: MessagingServiceOptions,
  ) {
    if (options.freeServiceSendCutoff > MAXIMUM_FREE_SERVICE_SEND_CUTOFF) {
      throw new Error("The free WhatsApp service cutoff cannot be moved later than Meta's billing change");
    }
    this.leaseMilliseconds = options.leaseMilliseconds ?? 90_000;
    this.retentionMilliseconds = options.retentionMilliseconds ?? 7 * 24 * 60 * 60_000;
    this.sleep = options.sleep ?? (async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.queueCapacity = { perLink: options.maxOpenMessagesPerLink ?? 8, global: options.maxOpenMessagesGlobal ?? 1_000 };
    if (this.queueCapacity.perLink < 1 || this.queueCapacity.global < this.queueCapacity.perLink) {
      throw new Error("Messaging queue capacity is invalid");
    }
  }

  async registerDevice(principal: Principal, input: unknown) {
    if (this.options.linkingEnabled === false) throw new AppError("CHANNEL_DISABLED", "Runner registration is not enabled");
    requireRunnerScopes(principal);
    const parsed = RunnerDeviceRegistrationSchema.parse(input);
    await this.requireMembership(principal, parsed.household_id);
    const now = this.clock.now().toISOString();
    const device = {
      id: RunnerDeviceIdSchema.parse(this.random.opaqueId("dev")),
      userId: principal.userId,
      householdId: parsed.household_id,
      name: parsed.name,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveDevice(device);
    this.telemetry.event("messaging.runner_registered", { outcome: "success" });
    return { device_id: device.id, created_at: now };
  }

  async createLinkChallenge(principal: Principal, rawSessionToken: string, input: unknown) {
    if (this.options.linkingEnabled === false) throw new AppError("CHANNEL_DISABLED", "WhatsApp linking is not enabled");
    this.requirePreCutoff();
    const parsed = WhatsAppLinkRequestSchema.parse(input);
    await this.requireMembership(principal, parsed.household_id);
    const device = await this.requireDevice(principal, parsed.device_id);
    if (device.householdId !== parsed.household_id) throw new AppError("FORBIDDEN", "The runner belongs to a different household");
    const now = this.clock.now();
    const existing = await this.store.findCurrentLinkForUser(principal.userId);
    if (existing !== null) {
      if (existing.confirmedAt === null && Date.parse(existing.confirmationExpiresAt) <= now.getTime()) {
        await this.store.revokeProviderLink(principal.userId, now.toISOString());
      } else {
        throw new AppError("VALIDATION_FAILED", "A WhatsApp connection is already active or awaiting confirmation");
      }
    }
    const token = this.random.token(32);
    if (this.options.intakeEnabled === false) throw new AppError("CHANNEL_DISABLED", "WhatsApp intake is not enabled");
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    await this.store.saveLinkChallenge({
      id: this.random.opaqueId("challenge"),
      userId: principal.userId,
      householdId: parsed.household_id,
      runnerDeviceId: parsed.device_id,
      tokenHash: this.hasher.hash(token),
      browserBindingHash: this.hasher.hash(rawSessionToken),
      expiresAt,
      consumedAt: null,
      createdAt: now.toISOString(),
    });
    const contactUrl = new URL(this.options.contactUrl);
    contactUrl.searchParams.set("text", `${LINK_PREFIX}${token}`);
    return { expires_at: expiresAt, contact_url: contactUrl.toString() };
  }

  async handleInboundText(input: ProviderInboundText): Promise<"link_pending" | "queued" | "duplicate" | "overloaded" | "ignored" | "channel_disabled"> {
    const now = this.clock.now();
    if (this.options.intakeEnabled === false) {
      this.telemetry.event("messaging.inbound_blocked", { reason: "intake_disabled" });
      return "channel_disabled";
    }
    if (!this.isPreCutoff(now)) {
      this.telemetry.event("messaging.inbound_blocked", { reason: "paid_service_cutoff" });
      return "channel_disabled";
    }
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > now.getTime() + 5 * 60_000) {
      throw new AppError("VALIDATION_FAILED", "The provider message timestamp is invalid");
    }
    const serviceWindowExpiresAt = new Date(occurredAt.getTime() + 24 * 60 * 60_000);
    if (serviceWindowExpiresAt <= now) {
      this.telemetry.event("messaging.inbound_blocked", { reason: "service_window_expired" });
      return "ignored";
    }
    const text = InboundRestockingTextSchema.parse(input.text);
    const linkToken = parseLinkToken(text);
    if (linkToken !== null) {
      if (this.options.linkingEnabled === false) return "channel_disabled";
      return await this.consumeLinkCode(input.senderIdentity, linkToken, now, serviceWindowExpiresAt);
    }
    const link = await this.store.findActiveLinkByIdentityHash(this.hasher.hash(input.senderIdentity));
    if (link === null || !await this.authorization.isActiveMember(link.userId, link.householdId)) {
      this.telemetry.event("messaging.inbound_ignored", { reason: "unlinked_or_revoked" });
      return "ignored";
    }
    const device = await this.store.getDevice(link.runnerDeviceId);
    if (device === null || device.revokedAt !== null) {
      this.telemetry.event("messaging.inbound_ignored", { reason: "runner_revoked" });
      return "ignored";
    }
    const responseReady = await this.store.getResponseReadyForLink(link.id);
    if (responseReady !== null) await this.trySendResponse(link, responseReady, now);
    const envelopeId = MessageEnvelopeIdSchema.parse(this.random.opaqueId("msg"));
    const requestId = RequestIdSchema.parse(this.random.opaqueId("req"));
    const receivedAt = occurredAt.toISOString();
    const record: MessageEnvelopeRecord = {
      id: envelopeId,
      requestId,
      providerLinkId: link.id,
      providerMessageHash: this.hasher.hash(input.providerMessageId),
      state: "queued",
      inboundCiphertext: this.cipher.encrypt(text, inboundAssociatedData(link.id)),
      responseCiphertext: null,
      hostSessionCiphertext: null,
      terminalKind: null,
      receivedAt,
      serviceWindowExpiresAt: serviceWindowExpiresAt.toISOString(),
      leaseId: null,
      leaseDeviceId: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      failureCode: null,
      responseSentAt: null,
      expiresAt: new Date(now.getTime() + this.retentionMilliseconds).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const result = await this.store.enqueueOrResume(record, now.toISOString(), this.queueCapacity);
    this.telemetry.event("messaging.inbound_enqueued", { outcome: result.kind });
    if (result.kind === "overloaded") return "overloaded";
    return result.kind === "duplicate" ? "duplicate" : "queued";
  }

  async claim(principal: Principal, input: unknown): Promise<RunnerClaimResponse> {
    if (this.options.runnerClaimsEnabled === false) throw new AppError("CHANNEL_DISABLED", "Runner claims are not enabled");
    this.requirePreCutoff();
    requireRunnerScopes(principal);
    const parsed = RunnerClaimRequestSchema.parse(input);
    const device = await this.requireDevice(principal, parsed.device_id);
    await this.requireMembership(principal, device.householdId);
    const deadline = this.clock.now().getTime() + parsed.wait_seconds * 1_000;
    let now = this.clock.now();
    while (now.getTime() <= deadline) {
      if (this.options.serviceRepliesEnabled !== false) {
        const responseReady = await this.store.getResponseReadyForDevice(parsed.device_id);
        if (responseReady !== null) {
          const link = await this.requireActiveLink(responseReady.providerLinkId);
          await this.trySendResponse(link, responseReady, now);
        }
      }
      const leaseId = MessageLeaseIdSchema.parse(this.random.opaqueId("lse"));
      const envelope = await this.store.claim(parsed.device_id, leaseId, now.toISOString(), new Date(now.getTime() + this.leaseMilliseconds).toISOString());
      if (envelope !== null) {
        const link = await this.requireActiveLink(envelope.providerLinkId);
        return {
          kind: "work",
          envelope: {
            envelope_id: envelope.id,
            request_id: envelope.requestId,
            lease_id: leaseId,
            lease_expires_at: requiredLeaseExpiry(envelope),
            household_id: link.householdId,
            text: this.cipher.decrypt(envelope.inboundCiphertext, inboundAssociatedData(link.id)),
            received_at: envelope.receivedAt,
            service_window_expires_at: envelope.serviceWindowExpiresAt,
            resume_session_id: envelope.hostSessionCiphertext === null
              ? null
              : this.cipher.decrypt(envelope.hostSessionCiphertext, hostSessionAssociatedData(envelope.id)),
          },
        };
      }
      now = this.clock.now();
      if (now.getTime() >= deadline) return { kind: "empty" };
      await this.sleep(Math.min(250, Math.max(1, deadline - now.getTime())));
      now = this.clock.now();
    }
    return { kind: "empty" };
  }

  async heartbeat(principal: Principal, envelopeIdInput: string, input: unknown): Promise<{ lease_expires_at: string }> {
    this.requirePreCutoff();
    requireRunnerScopes(principal);
    const envelopeId = MessageEnvelopeIdSchema.parse(envelopeIdInput);
    const parsed = RunnerHeartbeatSchema.parse(input);
    await this.requireDevice(principal, parsed.device_id);
    const now = this.clock.now();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMilliseconds).toISOString();
    const envelope = await this.store.heartbeat(envelopeId, parsed.device_id, parsed.lease_id, now.toISOString(), leaseExpiresAt);
    if (envelope === null) throw new AppError("LEASE_CONFLICT", "The message lease is invalid or expired");
    return { lease_expires_at: leaseExpiresAt };
  }

  async complete(principal: Principal, envelopeIdInput: string, input: unknown): Promise<{ state: string }> {
    requireRunnerScopes(principal);
    const envelopeId = MessageEnvelopeIdSchema.parse(envelopeIdInput);
    const parsed = RunnerCompletionSchema.parse(input);
    await this.requireDevice(principal, parsed.device_id);
    const now = this.clock.now();
    const responseCiphertext = this.cipher.encrypt(parsed.terminal.message, responseAssociatedData(envelopeId));
    const hostSessionCiphertext = parsed.host_session_id === null
      ? null
      : this.cipher.encrypt(parsed.host_session_id, hostSessionAssociatedData(envelopeId));
    const envelope = await this.store.completeLease({
      envelopeId,
      deviceId: parsed.device_id,
      leaseId: parsed.lease_id,
      now: now.toISOString(),
      terminalKind: parsed.terminal.kind,
      responseCiphertext,
      hostSessionCiphertext,
    });
    if (envelope === null) throw new AppError("LEASE_CONFLICT", "The message lease is invalid or expired");
    const link = await this.requireActiveLink(envelope.providerLinkId);
    const sent = await this.trySendResponse(link, envelope, now);
    return { state: sent ? (parsed.terminal.kind === "needs_input" ? "awaiting_user" : "completed") : "response_ready" };
  }

  async revoke(principal: Principal, deviceIdInput: string): Promise<void> {
    const deviceId = RunnerDeviceIdSchema.parse(deviceIdInput);
    const now = this.clock.now().toISOString();
    const [deviceRevoked, linkRevoked] = await Promise.all([
      this.store.revokeDevice(principal.userId, deviceId, now),
      this.store.revokeProviderLink(principal.userId, now),
    ]);
    if (!deviceRevoked && !linkRevoked) throw new AppError("NOT_FOUND", "The messaging connection was not found");
  }

  async revokeRunner(principal: Principal, deviceIdInput: string): Promise<void> {
    requireRunnerScopes(principal);
    await this.revoke(principal, deviceIdInput);
  }

  async confirmLink(principal: Principal, rawSessionToken: string, linkIdInput: string): Promise<void> {
    this.requirePreCutoff();
    const linkId = ProviderLinkIdSchema.parse(linkIdInput);
    const link = await this.store.getProviderLink(linkId);
    if (link === null || link.userId !== principal.userId || link.revokedAt !== null || link.confirmedAt !== null) {
      throw new AppError("FORBIDDEN", "The pending WhatsApp connection is unavailable");
    }
    await this.requireMembership(principal, link.householdId);
    const confirmed = await this.store.confirmProviderLink(principal.userId, linkId, this.hasher.hash(rawSessionToken), this.clock.now().toISOString());
    if (confirmed === null) throw new AppError("FORBIDDEN", "The WhatsApp confirmation is invalid or expired");
    this.telemetry.event("messaging.link_confirmed", { outcome: "success" });
  }

  async accountStatus(principal: Principal, setup: { readonly deviceId?: string; readonly householdId?: string }): Promise<MessagingAccountStatus> {
    const availableThrough = this.options.freeServiceSendCutoff.toISOString();
    if (this.options.linkingEnabled === false || !this.isPreCutoff(this.clock.now())) return { kind: "disabled", availableThrough };
    const current = await this.store.findCurrentLinkForUser(principal.userId);
    if (current !== null && await this.authorization.isActiveMember(principal.userId, current.householdId)) {
      const device = await this.store.getDevice(current.runnerDeviceId);
      if (device !== null && device.revokedAt === null) {
        if (current.confirmedAt !== null) {
          return {
            kind: "linked", availableThrough, deviceId: device.id, householdId: current.householdId,
            deviceName: device.name, lastSeenAt: device.lastSeenAt,
          };
        }
        return {
          kind: Date.parse(current.confirmationExpiresAt) <= this.clock.now().getTime() ? "expired" : "pending_confirmation",
          availableThrough, linkId: current.id, deviceId: device.id, householdId: current.householdId,
          deviceName: device.name, confirmationExpiresAt: current.confirmationExpiresAt,
        };
      }
    }
    if (setup.deviceId === undefined || setup.householdId === undefined) return { kind: "not_configured", availableThrough };
    const deviceId = RunnerDeviceIdSchema.parse(setup.deviceId);
    const householdId = HouseholdIdSchema.parse(setup.householdId);
    const device = await this.requireDevice(principal, deviceId);
    await this.requireMembership(principal, householdId);
    if (device.householdId !== householdId) throw new AppError("FORBIDDEN", "The runner belongs to a different household");
    return { kind: "setup", availableThrough, deviceId, householdId, deviceName: device.name };
  }

  async cleanup(): Promise<number> {
    return await this.store.deleteExpired(this.clock.now().toISOString());
  }

  async operatorHealth(): Promise<MessagingOperatorHealth> {
    const now = this.clock.now();
    const snapshot = await this.store.operatorSnapshot(new Date(now.getTime() - 5 * 60_000).toISOString());
    const oldestOpenAgeSeconds = snapshot.oldestOpenReceivedAt === null
      ? null
      : Math.max(0, Math.floor((now.getTime() - Date.parse(snapshot.oldestOpenReceivedAt)) / 1_000));
    return {
      healthy: snapshot.openMessages === 0 || snapshot.onlineRunnerDevices > 0,
      channel_available: this.isPreCutoff(now) && this.options.intakeEnabled !== false,
      open_messages: snapshot.openMessages,
      queued_messages: snapshot.queuedMessages,
      leased_messages: snapshot.leasedMessages,
      awaiting_user_messages: snapshot.awaitingUserMessages,
      response_ready_messages: snapshot.responseReadyMessages,
      oldest_open_age_seconds: oldestOpenAgeSeconds,
      active_runner_devices: snapshot.activeRunnerDevices,
      online_runner_devices: snapshot.onlineRunnerDevices,
    };
  }

  async handleDeliveryStatus(input: ProviderDeliveryStatus): Promise<"updated" | "unknown"> {
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > this.clock.now().getTime() + 5 * 60_000) {
      throw new AppError("VALIDATION_FAILED", "The provider delivery timestamp is invalid");
    }
    const updated = await this.store.updateDeliveryStatus(
      this.hasher.hash(input.providerDeliveryId), input.status, occurredAt.toISOString(), input.failureCode,
    );
    this.telemetry.event("messaging.delivery_status", { outcome: updated ? input.status : "unknown" });
    return updated ? "updated" : "unknown";
  }

  async authorizeRunner(principal: Principal, deviceIdInput: string, householdIdInput: string): Promise<void> {
    this.requirePreCutoff();
    requireRunnerScopes(principal);
    const deviceId = RunnerDeviceIdSchema.parse(deviceIdInput);
    const householdId = HouseholdIdSchema.parse(householdIdInput);
    const device = await this.requireDevice(principal, deviceId);
    if (device.householdId !== householdId) throw new AppError("FORBIDDEN", "The runner belongs to a different household");
    await this.requireMembership(principal, householdId);
    const link = await this.store.findActiveLinkForUser(principal.userId);
    if (link === null || link.runnerDeviceId !== deviceId || link.householdId !== householdId) {
      throw new AppError("FORBIDDEN", "An active WhatsApp link is required");
    }
  }

  private async consumeLinkCode(senderIdentity: string, token: string, now: Date, serviceWindowExpiresAt: Date): Promise<"link_pending" | "ignored"> {
    const challenge = await this.store.consumeLinkChallenge(this.hasher.hash(token), now.toISOString());
    if (challenge === null || !await this.authorization.isActiveMember(challenge.userId, challenge.householdId)) {
      this.telemetry.event("messaging.link_rejected", { reason: "invalid_or_expired" });
      return "ignored";
    }
    const device = await this.store.getDevice(challenge.runnerDeviceId);
    if (device === null || device.userId !== challenge.userId || device.householdId !== challenge.householdId || device.revokedAt !== null) {
      this.telemetry.event("messaging.link_rejected", { reason: "runner_invalid" });
      return "ignored";
    }
    const linkId = ProviderLinkIdSchema.parse(this.random.opaqueId("lnk"));
    await this.store.createProviderLink({
      id: linkId,
      userId: challenge.userId,
      householdId: challenge.householdId,
      runnerDeviceId: challenge.runnerDeviceId,
      providerIdentityHash: this.hasher.hash(senderIdentity),
      destinationCiphertext: this.cipher.encrypt(senderIdentity, destinationAssociatedData(linkId)),
      browserBindingHash: challenge.browserBindingHash,
      confirmationExpiresAt: challenge.expiresAt,
      confirmedAt: null,
      linkedAt: now.toISOString(),
      revokedAt: null,
      updatedAt: now.toISOString(),
    });
    if (this.options.serviceRepliesEnabled !== false && now < serviceWindowExpiresAt && this.isPreCutoff(now)) {
      await this.provider.sendServiceText({
        destination: senderIdentity,
        text: "Return to your Fullwell Account page to confirm this WhatsApp connection.",
        requestId: RequestIdSchema.parse(this.random.opaqueId("req")),
      });
    }
    this.telemetry.event("messaging.link_pending", { outcome: "success" });
    return "link_pending";
  }

  private async trySendResponse(link: ProviderIdentityLinkRecord, envelope: MessageEnvelopeRecord, now: Date): Promise<boolean> {
    if (envelope.state !== "response_ready" || envelope.responseCiphertext === null) return false;
    if (this.options.serviceRepliesEnabled === false) return false;
    if (!this.isPreCutoff(now) || Date.parse(envelope.serviceWindowExpiresAt) <= now.getTime()) {
      this.telemetry.event("messaging.response_blocked", { reason: this.isPreCutoff(now) ? "service_window_expired" : "paid_service_cutoff" });
      return false;
    }
    const response = this.cipher.decrypt(envelope.responseCiphertext, responseAssociatedData(envelope.id));
    const destination = this.cipher.decrypt(link.destinationCiphertext, destinationAssociatedData(link.id));
    const delivery = await this.provider.sendServiceText({ destination, text: response, requestId: envelope.requestId });
    await this.store.saveDeliveryReceipt({
      id: this.random.opaqueId("delivery"),
      envelopeId: envelope.id,
      providerDeliveryHash: this.hasher.hash(delivery.providerDeliveryId),
      status: "accepted",
      occurredAt: now.toISOString(),
      failureCode: null,
      createdAt: now.toISOString(),
    });
    if (await this.store.markResponseSent(envelope.id, now.toISOString()) === null) {
      throw new AppError("INTERNAL_ERROR", "The message response state changed unexpectedly");
    }
    this.telemetry.event("messaging.response_sent", { outcome: "success" });
    return true;
  }

  private async requireDevice(principal: Principal, deviceId: ReturnType<typeof RunnerDeviceIdSchema.parse>) {
    const device = await this.store.getDevice(deviceId);
    if (device === null || device.userId !== principal.userId || device.revokedAt !== null) {
      throw new AppError("FORBIDDEN", "The runner device is unavailable");
    }
    return device;
  }

  private async requireActiveLink(linkId: ProviderLinkId) {
    const link = await this.store.getProviderLink(linkId);
    if (link === null || link.confirmedAt === null || link.revokedAt !== null) throw new AppError("FORBIDDEN", "The messaging connection is revoked");
    return link;
  }

  private async requireMembership(principal: Principal, householdId: ReturnType<typeof HouseholdIdSchema.parse>): Promise<void> {
    if (!await this.authorization.isActiveMember(principal.userId, householdId)) {
      throw new AppError("FORBIDDEN", "Current household membership is required");
    }
  }

  private isPreCutoff(now: Date): boolean {
    return now < this.options.freeServiceSendCutoff;
  }

  private requirePreCutoff(): void {
    if (!this.isPreCutoff(this.clock.now())) throw new AppError("CHANNEL_DISABLED", "WhatsApp restocking is disabled before paid service-message billing begins");
  }
}

function requireRunnerScopes(principal: Principal): void {
  if (!principal.scopes.has("runner:messages") || !principal.scopes.has("journal:read")) {
    throw new AppError("FORBIDDEN", "Runner message and journal read permissions are required");
  }
}

function parseLinkToken(text: string): string | null {
  if (!text.startsWith(LINK_PREFIX)) return null;
  const token = text.slice(LINK_PREFIX.length);
  return LINK_TOKEN.test(token) ? token : null;
}

function inboundAssociatedData(linkId: ProviderLinkId): string { return `provider-link:${linkId}:inbound`; }
function destinationAssociatedData(linkId: ProviderLinkId): string { return `provider-link:${linkId}:destination`; }
function responseAssociatedData(envelopeId: MessageEnvelopeId): string { return `message:${envelopeId}:response`; }
function hostSessionAssociatedData(envelopeId: MessageEnvelopeId): string { return `message:${envelopeId}:host-session`; }

function requiredLeaseExpiry(envelope: MessageEnvelopeRecord): string {
  if (envelope.leaseExpiresAt === null) throw new AppError("INTERNAL_ERROR", "A claimed message did not have a lease expiry");
  return envelope.leaseExpiresAt;
}
