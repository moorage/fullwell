import type {
  HouseholdId,
  MessageEnvelopeId,
  MessageEnvelopeState,
  MessageLeaseId,
  ProviderLinkId,
  RequestId,
  RunnerDeviceId,
  RunnerTerminalState,
  UserId,
} from "@hfj/contracts";

export interface RunnerDeviceRecord {
  readonly id: RunnerDeviceId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly name: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface ProviderLinkChallengeRecord {
  readonly id: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly runnerDeviceId: RunnerDeviceId;
  readonly tokenHash: string;
  readonly browserBindingHash: string;
  readonly expiresAt: string;
  consumedAt: string | null;
  readonly createdAt: string;
}

export interface ProviderIdentityLinkRecord {
  readonly id: ProviderLinkId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly runnerDeviceId: RunnerDeviceId;
  readonly providerIdentityHash: string;
  readonly destinationCiphertext: string;
  browserBindingHash: string | null;
  readonly confirmationExpiresAt: string;
  confirmedAt: string | null;
  readonly linkedAt: string;
  revokedAt: string | null;
  updatedAt: string;
}

export interface MessageEnvelopeRecord {
  readonly id: MessageEnvelopeId;
  readonly requestId: RequestId;
  readonly providerLinkId: ProviderLinkId;
  readonly providerMessageHash: string;
  state: MessageEnvelopeState;
  inboundCiphertext: string;
  responseCiphertext: string | null;
  hostSessionCiphertext: string | null;
  terminalKind: RunnerTerminalState["kind"] | null;
  receivedAt: string;
  serviceWindowExpiresAt: string;
  leaseId: MessageLeaseId | null;
  leaseDeviceId: RunnerDeviceId | null;
  leaseExpiresAt: string | null;
  attemptCount: number;
  failureCode: string | null;
  responseSentAt: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  updatedAt: string;
}

export type MessageDeliveryStatus = "accepted" | "sent" | "delivered" | "read" | "failed";

export interface MessageDeliveryReceiptRecord {
  readonly id: string;
  readonly envelopeId: MessageEnvelopeId;
  readonly providerDeliveryHash: string;
  readonly status: MessageDeliveryStatus;
  readonly occurredAt: string;
  readonly failureCode: string | null;
  readonly createdAt: string;
}

export type EnqueueResult =
  | { readonly kind: "created" | "resumed"; readonly envelope: MessageEnvelopeRecord }
  | { readonly kind: "duplicate"; readonly envelope: MessageEnvelopeRecord }
  | { readonly kind: "overloaded" };

export interface MessageQueueCapacity {
  readonly perLink: number;
  readonly global: number;
}

export interface MessagingOperationalSnapshot {
  readonly openMessages: number;
  readonly queuedMessages: number;
  readonly leasedMessages: number;
  readonly awaitingUserMessages: number;
  readonly responseReadyMessages: number;
  readonly oldestOpenReceivedAt: string | null;
  readonly activeRunnerDevices: number;
  readonly onlineRunnerDevices: number;
}

export interface MessageEnvelopeStorePort {
  saveDevice(device: RunnerDeviceRecord): Promise<void>;
  getDevice(deviceId: RunnerDeviceId): Promise<RunnerDeviceRecord | null>;
  revokeDevice(userId: UserId, deviceId: RunnerDeviceId, revokedAt: string): Promise<boolean>;
  saveLinkChallenge(challenge: ProviderLinkChallengeRecord): Promise<void>;
  consumeLinkChallenge(tokenHash: string, consumedAt: string): Promise<ProviderLinkChallengeRecord | null>;
  createProviderLink(link: ProviderIdentityLinkRecord): Promise<void>;
  findActiveLinkByIdentityHash(providerIdentityHash: string): Promise<ProviderIdentityLinkRecord | null>;
  findActiveLinkForUser(userId: UserId): Promise<ProviderIdentityLinkRecord | null>;
  findCurrentLinkForUser(userId: UserId): Promise<ProviderIdentityLinkRecord | null>;
  getProviderLink(linkId: ProviderLinkId): Promise<ProviderIdentityLinkRecord | null>;
  confirmProviderLink(userId: UserId, linkId: ProviderLinkId, browserBindingHash: string, confirmedAt: string): Promise<ProviderIdentityLinkRecord | null>;
  revokeProviderLink(userId: UserId, revokedAt: string): Promise<boolean>;
  enqueueOrResume(input: MessageEnvelopeRecord, providerEventOccurredAt: string, capacity: MessageQueueCapacity): Promise<EnqueueResult>;
  claim(deviceId: RunnerDeviceId, leaseId: MessageLeaseId, now: string, leaseExpiresAt: string, recoverSaturated: boolean): Promise<MessageEnvelopeRecord | null>;
  heartbeat(envelopeId: MessageEnvelopeId, deviceId: RunnerDeviceId, leaseId: MessageLeaseId, now: string, leaseExpiresAt: string): Promise<MessageEnvelopeRecord | null>;
  completeLease(input: {
    readonly envelopeId: MessageEnvelopeId;
    readonly deviceId: RunnerDeviceId;
    readonly leaseId: MessageLeaseId;
    readonly now: string;
    readonly terminalKind: RunnerTerminalState["kind"];
    readonly responseCiphertext: string;
    readonly hostSessionCiphertext: string | null;
  }): Promise<MessageEnvelopeRecord | null>;
  getResponseReadyForLink(linkId: ProviderLinkId): Promise<MessageEnvelopeRecord | null>;
  getResponseReadyForDevice(deviceId: RunnerDeviceId): Promise<MessageEnvelopeRecord | null>;
  markResponseSent(envelopeId: MessageEnvelopeId, sentAt: string): Promise<MessageEnvelopeRecord | null>;
  saveDeliveryReceipt(receipt: MessageDeliveryReceiptRecord): Promise<void>;
  updateDeliveryStatus(providerDeliveryHash: string, status: MessageDeliveryStatus, occurredAt: string, failureCode: string | null): Promise<boolean>;
  operatorSnapshot(onlineSince: string): Promise<MessagingOperationalSnapshot>;
  deleteExpired(now: string): Promise<number>;
}

export interface MessageCipherPort {
  encrypt(plaintext: string, associatedData: string): string;
  decrypt(ciphertext: string, associatedData: string): string;
}

export interface WhatsAppProviderPort {
  sendServiceText(input: {
    readonly destination: string;
    readonly text: string;
    readonly requestId: RequestId;
  }): Promise<{ readonly providerDeliveryId: string }>;
}

export interface MessagingAuthorizationPort {
  isActiveMember(userId: UserId, householdId: HouseholdId): Promise<boolean>;
}
