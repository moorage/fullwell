import type { MessageEnvelopeId, MessageLeaseId, ProviderLinkId, RunnerDeviceId, UserId } from "@hfj/contracts";
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

export class MemoryMessageEnvelopeStore implements MessageEnvelopeStorePort {
  private readonly devices = new Map<RunnerDeviceId, RunnerDeviceRecord>();
  private readonly challenges = new Map<string, ProviderLinkChallengeRecord>();
  private readonly links = new Map<ProviderLinkId, ProviderIdentityLinkRecord>();
  private readonly envelopes = new Map<MessageEnvelopeId, MessageEnvelopeRecord>();
  private readonly providerEvents = new Map<string, MessageEnvelopeId>();
  private readonly deliveryReceipts = new Map<string, MessageDeliveryReceiptRecord>();

  async saveDevice(device: RunnerDeviceRecord): Promise<void> {
    for (const current of this.devices.values()) {
      if (current.userId === device.userId && current.householdId === device.householdId && current.revokedAt === null) {
        throw new Error("An active runner already exists for this household");
      }
    }
    this.devices.set(device.id, { ...device });
  }

  async getDevice(deviceId: RunnerDeviceId): Promise<RunnerDeviceRecord | null> {
    const device = this.devices.get(deviceId);
    return device === undefined ? null : { ...device };
  }

  async revokeDevice(userId: UserId, deviceId: RunnerDeviceId, revokedAt: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (device === undefined || device.userId !== userId || device.revokedAt !== null) return false;
    device.revokedAt = revokedAt;
    device.updatedAt = revokedAt;
    return true;
  }

  async saveLinkChallenge(challenge: ProviderLinkChallengeRecord): Promise<void> {
    this.challenges.set(challenge.tokenHash, { ...challenge });
  }

  async consumeLinkChallenge(tokenHash: string, consumedAt: string): Promise<ProviderLinkChallengeRecord | null> {
    const challenge = this.challenges.get(tokenHash);
    if (challenge === undefined || challenge.consumedAt !== null || challenge.expiresAt <= consumedAt) return null;
    challenge.consumedAt = consumedAt;
    return { ...challenge };
  }

  async createProviderLink(link: ProviderIdentityLinkRecord): Promise<void> {
    for (const current of this.links.values()) {
      if (current.revokedAt === null && (current.providerIdentityHash === link.providerIdentityHash || current.userId === link.userId)) {
        throw new Error("An active provider link already exists");
      }
    }
    this.links.set(link.id, { ...link });
  }

  async findActiveLinkByIdentityHash(providerIdentityHash: string): Promise<ProviderIdentityLinkRecord | null> {
    const link = [...this.links.values()].find((candidate) => candidate.providerIdentityHash === providerIdentityHash && candidate.confirmedAt !== null && candidate.revokedAt === null);
    return link === undefined ? null : { ...link };
  }

  async findActiveLinkForUser(userId: UserId): Promise<ProviderIdentityLinkRecord | null> {
    const link = [...this.links.values()].find((candidate) => candidate.userId === userId && candidate.confirmedAt !== null && candidate.revokedAt === null);
    return link === undefined ? null : { ...link };
  }

  async findCurrentLinkForUser(userId: UserId): Promise<ProviderIdentityLinkRecord | null> {
    const link = [...this.links.values()].find((candidate) => candidate.userId === userId && candidate.revokedAt === null);
    return link === undefined ? null : { ...link };
  }

  async getProviderLink(linkId: ProviderLinkId): Promise<ProviderIdentityLinkRecord | null> {
    const link = this.links.get(linkId);
    return link === undefined ? null : { ...link };
  }

  async confirmProviderLink(userId: UserId, linkId: ProviderLinkId, browserBindingHash: string, confirmedAt: string): Promise<ProviderIdentityLinkRecord | null> {
    const link = this.links.get(linkId);
    if (link === undefined || link.userId !== userId || link.revokedAt !== null || link.confirmedAt !== null ||
      link.browserBindingHash !== browserBindingHash || link.confirmationExpiresAt <= confirmedAt) return null;
    link.browserBindingHash = null;
    link.confirmedAt = confirmedAt;
    link.updatedAt = confirmedAt;
    return { ...link };
  }

  async revokeProviderLink(userId: UserId, revokedAt: string): Promise<boolean> {
    const link = [...this.links.values()].find((candidate) => candidate.userId === userId && candidate.revokedAt === null);
    if (link === undefined) return false;
    link.revokedAt = revokedAt;
    link.updatedAt = revokedAt;
    return true;
  }

  async enqueueOrResume(input: MessageEnvelopeRecord, providerEventOccurredAt: string, capacity: MessageQueueCapacity): Promise<EnqueueResult> {
    const duplicateId = this.providerEvents.get(input.providerMessageHash);
    if (duplicateId !== undefined) return { kind: "duplicate", envelope: this.copyEnvelope(duplicateId) };
    const pending = [...this.envelopes.values()].find((envelope) => envelope.providerLinkId === input.providerLinkId && envelope.state === "awaiting_user");
    if (pending !== undefined) {
      pending.inboundCiphertext = input.inboundCiphertext;
      pending.responseCiphertext = null;
      pending.terminalKind = null;
      pending.receivedAt = input.receivedAt;
      pending.serviceWindowExpiresAt = input.serviceWindowExpiresAt;
      pending.state = "queued";
      pending.updatedAt = providerEventOccurredAt;
      this.providerEvents.set(input.providerMessageHash, pending.id);
      return { kind: "resumed", envelope: { ...pending } };
    }
    const open = [...this.envelopes.values()].filter((envelope) =>
      envelope.state === "queued" || envelope.state === "leased" || envelope.state === "awaiting_user" || envelope.state === "response_ready");
    if (open.length >= capacity.global || open.filter((envelope) => envelope.providerLinkId === input.providerLinkId).length >= capacity.perLink) {
      return { kind: "overloaded" };
    }
    this.envelopes.set(input.id, { ...input });
    this.providerEvents.set(input.providerMessageHash, input.id);
    return { kind: "created", envelope: { ...input } };
  }

  async claim(deviceId: RunnerDeviceId, leaseId: MessageLeaseId, now: string, leaseExpiresAt: string): Promise<MessageEnvelopeRecord | null> {
    const device = this.devices.get(deviceId);
    if (device === undefined || device.revokedAt !== null) return null;
    for (const envelope of this.envelopes.values()) {
      if (envelope.state === "leased" && envelope.leaseDeviceId === deviceId && envelope.leaseExpiresAt !== null && envelope.leaseExpiresAt <= now) {
        envelope.state = "queued";
        envelope.leaseId = null;
        envelope.leaseDeviceId = null;
        envelope.leaseExpiresAt = null;
      }
    }
    const queued = [...this.envelopes.values()]
      .filter((envelope) => envelope.state === "queued")
      .filter((envelope) => {
        const link = this.links.get(envelope.providerLinkId);
        return link?.runnerDeviceId === deviceId && link.confirmedAt !== null && link.revokedAt === null;
      })
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))[0];
    if (queued === undefined || queued.expiresAt <= now || queued.attemptCount >= 20) return null;
    queued.state = "leased";
    queued.leaseId = leaseId;
    queued.leaseDeviceId = deviceId;
    queued.leaseExpiresAt = leaseExpiresAt;
    queued.attemptCount += 1;
    queued.updatedAt = now;
    device.lastSeenAt = now;
    device.updatedAt = now;
    return { ...queued };
  }

  async heartbeat(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId, now: string, leaseExpiresAt: string): Promise<MessageEnvelopeRecord | null> {
    const envelope = this.envelopes.get(envelopeId);
    if (!validLease(envelope, deviceId, leaseId, now)) return null;
    envelope.leaseExpiresAt = leaseExpiresAt;
    envelope.updatedAt = now;
    return { ...envelope };
  }

  async completeLease(input: {
    readonly envelopeId: MessageEnvelopeId;
    readonly deviceId: RunnerDeviceId;
    readonly leaseId: MessageLeaseId;
    readonly now: string;
    readonly terminalKind: "completed" | "needs_input" | "blocked" | "cancelled";
    readonly responseCiphertext: string;
    readonly hostSessionCiphertext: string | null;
  }): Promise<MessageEnvelopeRecord | null> {
    const envelope = this.envelopes.get(input.envelopeId);
    if (!validLease(envelope, input.deviceId, input.leaseId, input.now)) return null;
    envelope.state = "response_ready";
    envelope.responseCiphertext = input.responseCiphertext;
    envelope.hostSessionCiphertext = input.hostSessionCiphertext;
    envelope.terminalKind = input.terminalKind;
    envelope.leaseId = null;
    envelope.leaseDeviceId = null;
    envelope.leaseExpiresAt = null;
    envelope.updatedAt = input.now;
    return { ...envelope };
  }

  async getResponseReadyForLink(linkId: ProviderLinkId): Promise<MessageEnvelopeRecord | null> {
    const envelope = [...this.envelopes.values()]
      .filter((candidate) => candidate.providerLinkId === linkId && candidate.state === "response_ready")
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))[0];
    return envelope === undefined ? null : { ...envelope };
  }

  async getResponseReadyForDevice(deviceId: RunnerDeviceId): Promise<MessageEnvelopeRecord | null> {
    const envelope = [...this.envelopes.values()]
      .filter((candidate) => {
        const link = this.links.get(candidate.providerLinkId);
        return candidate.state === "response_ready" && link?.runnerDeviceId === deviceId && link.confirmedAt !== null && link.revokedAt === null;
      })
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))[0];
    return envelope === undefined ? null : { ...envelope };
  }

  async markResponseSent(envelopeId: MessageEnvelopeId, sentAt: string): Promise<MessageEnvelopeRecord | null> {
    const envelope = this.envelopes.get(envelopeId);
    if (envelope === undefined || envelope.state !== "response_ready" || envelope.terminalKind === null) return null;
    envelope.responseSentAt = sentAt;
    envelope.responseCiphertext = null;
    envelope.state = envelope.terminalKind === "needs_input" ? "awaiting_user" : "completed";
    envelope.updatedAt = sentAt;
    return { ...envelope };
  }

  async saveDeliveryReceipt(receipt: MessageDeliveryReceiptRecord): Promise<void> {
    if (!this.deliveryReceipts.has(receipt.providerDeliveryHash)) this.deliveryReceipts.set(receipt.providerDeliveryHash, { ...receipt });
  }

  async updateDeliveryStatus(providerDeliveryHash: string, status: MessageDeliveryStatus, occurredAt: string, failureCode: string | null): Promise<boolean> {
    const receipt = this.deliveryReceipts.get(providerDeliveryHash);
    if (receipt === undefined || receipt.occurredAt > occurredAt) return false;
    this.deliveryReceipts.set(providerDeliveryHash, { ...receipt, status, occurredAt, failureCode });
    return true;
  }

  async operatorSnapshot(onlineSince: string): Promise<MessagingOperationalSnapshot> {
    const open = [...this.envelopes.values()].filter((envelope) =>
      envelope.state === "queued" || envelope.state === "leased" || envelope.state === "awaiting_user" || envelope.state === "response_ready");
    const activeDevices = [...this.devices.values()].filter((device) => device.revokedAt === null);
    return {
      openMessages: open.length,
      queuedMessages: open.filter((envelope) => envelope.state === "queued").length,
      leasedMessages: open.filter((envelope) => envelope.state === "leased").length,
      awaitingUserMessages: open.filter((envelope) => envelope.state === "awaiting_user").length,
      responseReadyMessages: open.filter((envelope) => envelope.state === "response_ready").length,
      oldestOpenReceivedAt: open.map((envelope) => envelope.receivedAt).sort()[0] ?? null,
      activeRunnerDevices: activeDevices.length,
      onlineRunnerDevices: activeDevices.filter((device) => device.lastSeenAt !== null && device.lastSeenAt >= onlineSince).length,
    };
  }

  async deleteExpired(now: string): Promise<number> {
    const expired = [...this.envelopes.values()].filter((envelope) => envelope.expiresAt <= now);
    for (const envelope of expired) {
      this.envelopes.delete(envelope.id);
      for (const [deliveryHash, receipt] of this.deliveryReceipts) {
        if (receipt.envelopeId === envelope.id) this.deliveryReceipts.delete(deliveryHash);
      }
      for (const [providerHash, envelopeId] of this.providerEvents) {
        if (envelopeId === envelope.id) this.providerEvents.delete(providerHash);
      }
    }
    const expiredChallenges = [...this.challenges.entries()].filter(([, challenge]) => challenge.expiresAt <= now);
    for (const [tokenHash] of expiredChallenges) this.challenges.delete(tokenHash);
    const expiredPendingLinks = [...this.links.entries()].filter(([, link]) => link.confirmedAt === null && link.confirmationExpiresAt <= now);
    for (const [linkId] of expiredPendingLinks) this.links.delete(linkId);
    return expired.length + expiredChallenges.length + expiredPendingLinks.length;
  }

  private copyEnvelope(id: MessageEnvelopeId): MessageEnvelopeRecord {
    const envelope = this.envelopes.get(id);
    if (envelope === undefined) throw new Error("Provider event points to a missing envelope");
    return { ...envelope };
  }
}

function validLease(
  envelope: MessageEnvelopeRecord | undefined,
  deviceId: RunnerDeviceId,
  leaseId: MessageLeaseId,
  now: string,
): envelope is MessageEnvelopeRecord {
  return envelope !== undefined && envelope.state === "leased" && envelope.leaseDeviceId === deviceId &&
    envelope.leaseId === leaseId && envelope.leaseExpiresAt !== null && envelope.leaseExpiresAt > now;
}
