import { ActorIdSchema, HouseholdIdSchema, UserIdSchema, type RequestId } from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { DeterministicRandomSource, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import type { Principal } from "../core/types.js";
import { AesGcmMessageCipher } from "./cipher.js";
import { MemoryMessageEnvelopeStore } from "./memory-store.js";
import type { WhatsAppProviderPort } from "./ports.js";
import { MAXIMUM_FREE_SERVICE_SEND_CUTOFF, MessagingService } from "./service.js";

const userId = UserIdSchema.parse("usr_0000000000000401");
const householdId = HouseholdIdSchema.parse("hsh_0000000000000401");
const principal: Principal = {
  userId,
  actorId: ActorIdSchema.parse("act_0000000000000401"),
  displayName: "Runner Owner",
  scopes: new Set(["journal:read", "runner:messages"]),
  client: "codex",
};

function fixture(overrides: {
  readonly clock?: FixedClock;
  readonly member?: boolean;
  readonly intake?: boolean;
  readonly linking?: boolean;
  readonly claims?: boolean;
  readonly replies?: boolean;
  readonly perLinkCapacity?: number;
  readonly globalCapacity?: number;
  readonly leaseMilliseconds?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
} = {}) {
  const store = new MemoryMessageEnvelopeStore();
  const clock = overrides.clock ?? new FixedClock(new Date("2026-07-20T16:00:00.000Z"));
  const deliveries: Array<{ destination: string; text: string; requestId: RequestId }> = [];
  const provider: WhatsAppProviderPort = {
    sendServiceText: vi.fn(async (input) => {
      deliveries.push(input);
      return { providerDeliveryId: `delivery-${deliveries.length}` };
    }),
  };
  const options = {
    freeServiceSendCutoff: MAXIMUM_FREE_SERVICE_SEND_CUTOFF,
    contactUrl: new URL("https://wa.me/15550100123"),
    intakeEnabled: overrides.intake ?? true,
    linkingEnabled: overrides.linking ?? true,
    runnerClaimsEnabled: overrides.claims ?? true,
    serviceRepliesEnabled: overrides.replies ?? true,
    maxOpenMessagesPerLink: overrides.perLinkCapacity ?? 8,
    maxOpenMessagesGlobal: overrides.globalCapacity ?? 1_000,
    ...(overrides.leaseMilliseconds === undefined ? {} : { leaseMilliseconds: overrides.leaseMilliseconds }),
    ...(overrides.sleep === undefined ? {} : { sleep: overrides.sleep }),
  };
  const service = new MessagingService(
    store,
    new AesGcmMessageCipher(Buffer.alloc(32, 4).toString("base64url"), () => Buffer.alloc(12, 5)),
    provider,
    { isActiveMember: async () => overrides.member ?? true },
    clock,
    new DeterministicRandomSource(),
    new HmacTokenHasher("messaging-test-pepper-that-is-long-enough"),
    new NoopTelemetry(),
    options,
  );
  return { service, store, clock, deliveries, options };
}

async function link(fixtureValue: ReturnType<typeof fixture>) {
  const registration = await fixtureValue.service.registerDevice(principal, { household_id: householdId, name: "Kitchen Mac" });
  const challenge = await fixtureValue.service.createLinkChallenge(principal, "browser-session-token", { household_id: householdId, device_id: registration.device_id });
  const linkText = new URL(challenge.contact_url).searchParams.get("text");
  if (linkText === null) throw new Error("Fixture link did not contain a challenge");
  await expect(fixtureValue.service.handleInboundText({ providerMessageId: "wamid.link", senderIdentity: "15551234567", text: linkText, occurredAt: fixtureValue.clock.now().toISOString() }))
    .resolves.toBe("link_pending");
  const pending = await fixtureValue.service.accountStatus(principal, {});
  expect(pending.kind).toBe("pending_confirmation");
  if (pending.kind !== "pending_confirmation") throw new Error("Expected a pending link");
  await fixtureValue.service.confirmLink(principal, "browser-session-token", pending.linkId);
  return registration.device_id;
}

describe("MessagingService", () => {
  it("links, deduplicates, leases, asks a question, resumes, and completes", async () => {
    const context = fixture();
    const deviceId = await link(context);
    expect(context.deliveries[0]?.text).toMatch(/Return to your Fullwell Account/);
    await expect(context.service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "linked", deviceId });

    const inbound = { providerMessageId: "wamid.request", senderIdentity: "15551234567", text: "We're out of cashews, get more", occurredAt: context.clock.now().toISOString() };
    await expect(context.service.handleInboundText(inbound)).resolves.toBe("queued");
    await expect(context.service.handleInboundText(inbound)).resolves.toBe("duplicate");
    await expect(context.service.operatorHealth()).resolves.toMatchObject({
      healthy: false, open_messages: 1, queued_messages: 1, active_runner_devices: 1, online_runner_devices: 0,
    });

    const claim = await context.service.claim(principal, { device_id: deviceId, wait_seconds: 0 });
    expect(claim.kind).toBe("work");
    if (claim.kind !== "work") throw new Error("Expected a claimed message");
    await expect(context.service.operatorHealth()).resolves.toMatchObject({ healthy: true, leased_messages: 1, online_runner_devices: 1 });
    expect(claim.envelope).toMatchObject({ text: inbound.text, household_id: householdId, resume_session_id: null });
    await expect(context.service.heartbeat(principal, claim.envelope.envelope_id, { device_id: deviceId, lease_id: claim.envelope.lease_id }))
      .resolves.toHaveProperty("lease_expires_at");
    await expect(context.service.complete(principal, claim.envelope.envelope_id, {
      device_id: deviceId,
      lease_id: claim.envelope.lease_id,
      terminal: { kind: "needs_input", message: "Salted or unsalted?" },
      host_session_id: "codex-session-one",
    })).resolves.toEqual({ state: "awaiting_user" });
    expect(context.deliveries.at(-1)?.text).toBe("Salted or unsalted?");

    context.clock.advance(1_000);
    await expect(context.service.handleInboundText({ ...inbound, providerMessageId: "wamid.followup", text: "Salted" })).resolves.toBe("queued");
    const resumed = await context.service.claim(principal, { device_id: deviceId, wait_seconds: 0 });
    expect(resumed.kind).toBe("work");
    if (resumed.kind !== "work") throw new Error("Expected a resumed message");
    expect(resumed.envelope.resume_session_id).toBe("codex-session-one");
    await expect(context.service.complete(principal, resumed.envelope.envelope_id, {
      device_id: deviceId,
      lease_id: resumed.envelope.lease_id,
      terminal: { kind: "completed", message: "Added one bag of the salted cashews to the cart." },
      host_session_id: "codex-session-one",
    })).resolves.toEqual({ state: "completed" });
    expect(context.deliveries.at(-1)?.text).toMatch(/Added one bag/);
    const finalDelivery = context.deliveries.length;
    await expect(context.service.handleDeliveryStatus({
      providerDeliveryId: `delivery-${finalDelivery}`, status: "delivered", occurredAt: context.clock.now().toISOString(), failureCode: null,
    })).resolves.toBe("updated");
    await expect(context.service.handleDeliveryStatus({
      providerDeliveryId: "delivery-unknown", status: "read", occurredAt: context.clock.now().toISOString(), failureCode: null,
    })).resolves.toBe("unknown");
    await expect(context.service.claim(principal, { device_id: deviceId, wait_seconds: 0 })).resolves.toEqual({ kind: "empty" });
  });

  it("fails closed for gates, membership, scopes, revocation, leases, and cutoff", async () => {
    const disabled = fixture({ intake: false });
    await expect(disabled.service.handleInboundText({ providerMessageId: "wamid.one", senderIdentity: "sender", text: "cashews", occurredAt: disabled.clock.now().toISOString() }))
      .resolves.toBe("channel_disabled");

    const noMember = fixture({ member: false });
    await expect(noMember.service.registerDevice(principal, { household_id: householdId, name: "Mac" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const noScope = { ...principal, scopes: new Set(["journal:read"] as const) };
    await expect(fixture().service.registerDevice(noScope, { household_id: householdId, name: "Mac" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const context = fixture({ replies: false });
    const deviceId = await link(context);
    expect(context.deliveries).toHaveLength(0);
    await expect(context.service.authorizeRunner(principal, deviceId, householdId)).resolves.toBeUndefined();
    await expect(context.service.authorizeRunner(principal, deviceId, "hsh_0000000000000999")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await context.service.revoke(principal, deviceId);
    await expect(context.service.claim(principal, { device_id: deviceId, wait_seconds: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(context.service.revoke(principal, deviceId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const invalidLease = fixture();
    const activeDevice = await link(invalidLease);
    await expect(invalidLease.service.heartbeat(principal, "msg_0000000000000001", { device_id: activeDevice, lease_id: "lse_0000000000000001" }))
      .rejects.toMatchObject({ code: "LEASE_CONFLICT" });

    const postCutoff = fixture({ clock: new FixedClock(new Date("2026-10-01T07:00:00.000Z")) });
    await expect(postCutoff.service.handleInboundText({ providerMessageId: "wamid.late", senderIdentity: "sender", text: "cashews", occurredAt: postCutoff.clock.now().toISOString() }))
      .resolves.toBe("channel_disabled");
    expect(() => new MessagingService(
      new MemoryMessageEnvelopeStore(),
      new AesGcmMessageCipher(Buffer.alloc(32, 4).toString("base64url")),
      { sendServiceText: async () => ({ providerDeliveryId: "one" }) },
      { isActiveMember: async () => true },
      postCutoff.clock,
      new DeterministicRandomSource(),
      new HmacTokenHasher("messaging-test-pepper-that-is-long-enough"),
      new NoopTelemetry(),
      { freeServiceSendCutoff: new Date("2026-10-01T07:00:00.001Z"), contactUrl: new URL("https://wa.me/15550100123") },
    )).toThrow(/cannot be moved later/);
  });

  it("expires records and rejects invalid or expired linking input", async () => {
    const context = fixture();
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    await expect(context.service.createLinkChallenge(principal, "session", { household_id: "hsh_invalid", device_id: registration.device_id })).rejects.toThrow();
    const challenge = await context.service.createLinkChallenge(principal, "session", { household_id: householdId, device_id: registration.device_id });
    const linkText = new URL(challenge.contact_url).searchParams.get("text");
    if (linkText === null) throw new Error("Fixture link did not contain a challenge");
    await context.service.handleInboundText({ providerMessageId: "wamid.expiring-link", senderIdentity: "sender", text: linkText, occurredAt: context.clock.now().toISOString() });
    await expect(context.service.handleInboundText({ providerMessageId: "wamid.old", senderIdentity: "sender", text: "cashews", occurredAt: "2026-07-19T15:00:00.000Z" })).resolves.toBe("ignored");
    await expect(context.service.handleInboundText({ providerMessageId: "wamid.future", senderIdentity: "sender", text: "cashews", occurredAt: "2026-07-21T16:00:00.000Z" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    context.clock.advance(11 * 60_000);
    expect(await context.service.cleanup()).toBe(2);
    await expect(context.service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "not_configured" });
  });

  it("does not activate a provider sender until the bound browser confirms", async () => {
    const context = fixture();
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Kitchen Mac" });
    const challenge = await context.service.createLinkChallenge(principal, "bound-browser-session", { household_id: householdId, device_id: registration.device_id });
    const linkText = new URL(challenge.contact_url).searchParams.get("text");
    if (linkText === null) throw new Error("Fixture link did not contain a challenge");
    await context.service.handleInboundText({ providerMessageId: "wamid.link-pending", senderIdentity: "15551234567", text: linkText, occurredAt: context.clock.now().toISOString() });
    await expect(context.service.handleInboundText({ providerMessageId: "wamid.before-confirm", senderIdentity: "15551234567", text: "cashews", occurredAt: context.clock.now().toISOString() }))
      .resolves.toBe("ignored");
    const pending = await context.service.accountStatus(principal, {});
    if (pending.kind !== "pending_confirmation") throw new Error("Expected a pending link");
    await expect(context.service.confirmLink(principal, "different-browser-session", pending.linkId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await context.service.confirmLink(principal, "bound-browser-session", pending.linkId);
    await expect(context.service.handleInboundText({ providerMessageId: "wamid.after-confirm", senderIdentity: "15551234567", text: "cashews", occurredAt: context.clock.now().toISOString() }))
      .resolves.toBe("queued");
  });

  it("accepts a link code without sending when service replies are disabled", async () => {
    const context = fixture({ replies: false });
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Kitchen Mac" });
    const challenge = await context.service.createLinkChallenge(principal, "browser-session", { household_id: householdId, device_id: registration.device_id });
    const linkText = new URL(challenge.contact_url).searchParams.get("text");
    if (linkText === null) throw new Error("Fixture link did not contain a challenge");

    await expect(context.service.handleInboundText({
      providerMessageId: "wamid.link-with-replies-disabled",
      senderIdentity: "15551234567",
      text: linkText,
      occurredAt: context.clock.now().toISOString(),
    })).resolves.toBe("link_pending");
    expect(context.deliveries).toEqual([]);
    await expect(context.service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "pending_confirmation" });
  });

  it("deduplicates before enforcing bounded per-link queue capacity", async () => {
    const context = fixture({ perLinkCapacity: 1 });
    await link(context);
    const first = { providerMessageId: "wamid.capacity-one", senderIdentity: "15551234567", text: "cashews", occurredAt: context.clock.now().toISOString() };
    await expect(context.service.handleInboundText(first)).resolves.toBe("queued");
    await expect(context.service.handleInboundText(first)).resolves.toBe("duplicate");
    await expect(context.service.handleInboundText({ ...first, providerMessageId: "wamid.capacity-two" })).resolves.toBe("overloaded");
  });

  it("reports setup and expiry states and replaces an expired pending link", async () => {
    const context = fixture();
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Kitchen Mac" });
    await expect(context.service.accountStatus(principal, { deviceId: registration.device_id, householdId }))
      .resolves.toMatchObject({ kind: "setup", deviceName: "Kitchen Mac" });
    const challenge = await context.service.createLinkChallenge(principal, "browser-session", { household_id: householdId, device_id: registration.device_id });
    const linkText = new URL(challenge.contact_url).searchParams.get("text");
    if (linkText === null) throw new Error("Fixture link did not contain a challenge");
    await context.service.handleInboundText({ providerMessageId: "wamid.expiring", senderIdentity: "sender", text: linkText, occurredAt: context.clock.now().toISOString() });
    await expect(context.service.createLinkChallenge(principal, "browser-session", { household_id: householdId, device_id: registration.device_id }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    context.clock.advance(11 * 60_000);
    await expect(context.service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "expired" });
    await expect(context.service.createLinkChallenge(principal, "browser-session", { household_id: householdId, device_id: registration.device_id }))
      .resolves.toHaveProperty("contact_url");
  });

  it("fails closed across disabled service gates and invalid boundary state", async () => {
    const disabledLinking = fixture({ linking: false });
    await expect(disabledLinking.service.registerDevice(principal, { household_id: householdId, name: "Mac" })).rejects.toMatchObject({ code: "CHANNEL_DISABLED" });
    await expect(disabledLinking.service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "disabled" });

    const intakeDisabled = fixture({ intake: false });
    const registration = await intakeDisabled.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    await expect(intakeDisabled.service.createLinkChallenge(principal, "session", { household_id: householdId, device_id: registration.device_id }))
      .rejects.toMatchObject({ code: "CHANNEL_DISABLED" });

    const claimsDisabled = fixture({ claims: false });
    const claimsDevice = await claimsDisabled.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    await expect(claimsDisabled.service.claim(principal, { device_id: claimsDevice.device_id, wait_seconds: 0 }))
      .rejects.toMatchObject({ code: "CHANNEL_DISABLED" });

    const noJournalScope = { ...principal, scopes: new Set(["runner:messages"] as const) };
    await expect(fixture().service.registerDevice(noJournalScope, { household_id: householdId, name: "Mac" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(() => fixture({ perLinkCapacity: 0 })).toThrow(/capacity/);
    expect(() => fixture({ perLinkCapacity: 2, globalCapacity: 1 })).toThrow(/capacity/);
  });

  it("polls an empty queue, validates delivery time, and reports an idle operator", async () => {
    const clock = new FixedClock(new Date("2026-07-20T16:00:00.000Z"));
    const context = fixture({ clock, sleep: async (milliseconds) => { clock.advance(milliseconds); } });
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    await expect(context.service.claim(principal, { device_id: registration.device_id, wait_seconds: 1 })).resolves.toEqual({ kind: "empty" });
    await expect(context.service.operatorHealth()).resolves.toMatchObject({ healthy: true, oldest_open_age_seconds: null, open_messages: 0 });
    await expect(context.service.handleDeliveryStatus({
      providerDeliveryId: "delivery", status: "read", occurredAt: "not-a-date", failureCode: null,
    })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(context.service.authorizeRunner(principal, registration.device_id, householdId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects disabled linking codes, household mismatches, and invalid confirmations", async () => {
    const disabled = fixture({ linking: false });
    await expect(disabled.service.handleInboundText({
      providerMessageId: "wamid.disabled-link", senderIdentity: "sender",
      text: `FULLWELL LINK ${"a".repeat(43)}`, occurredAt: disabled.clock.now().toISOString(),
    })).resolves.toBe("channel_disabled");

    const context = fixture();
    const registration = await context.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    await expect(context.service.createLinkChallenge(principal, "session", {
      household_id: "hsh_0000000000000402", device_id: registration.device_id,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(context.service.confirmLink(principal, "session", "lnk_0000000000000499"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(context.service.handleInboundText({
      providerMessageId: "wamid.invalid-link", senderIdentity: "sender",
      text: "FULLWELL LINK invalid", occurredAt: context.clock.now().toISOString(),
    })).resolves.toBe("ignored");
    await expect(context.service.handleInboundText({
      providerMessageId: "wamid.missing-link", senderIdentity: "sender",
      text: `FULLWELL LINK ${"b".repeat(43)}`, occurredAt: context.clock.now().toISOString(),
    })).resolves.toBe("ignored");
  });

  it("ignores revoked linking devices and retains responses when replies are disabled", async () => {
    const revoked = fixture();
    const registration = await revoked.service.registerDevice(principal, { household_id: householdId, name: "Mac" });
    const challenge = await revoked.service.createLinkChallenge(principal, "session", { household_id: householdId, device_id: registration.device_id });
    const linkText = new URL(challenge.contact_url).searchParams.get("text");
    if (linkText === null) throw new Error("Fixture link did not contain a challenge");
    await revoked.store.revokeDevice(principal.userId, registration.device_id, revoked.clock.now().toISOString());
    await expect(revoked.service.handleInboundText({
      providerMessageId: "wamid.revoked-device-link", senderIdentity: "sender", text: linkText, occurredAt: revoked.clock.now().toISOString(),
    })).resolves.toBe("ignored");

    const noReplies = fixture({ replies: false });
    const deviceId = await link(noReplies);
    await noReplies.service.handleInboundText({
      providerMessageId: "wamid.no-reply", senderIdentity: "15551234567", text: "cashews", occurredAt: noReplies.clock.now().toISOString(),
    });
    const claim = await noReplies.service.claim(principal, { device_id: deviceId, wait_seconds: 0 });
    if (claim.kind !== "work") throw new Error("Expected work");
    await expect(noReplies.service.complete(principal, claim.envelope.envelope_id, {
      device_id: deviceId, lease_id: claim.envelope.lease_id,
      terminal: { kind: "completed", message: "Done" }, host_session_id: null,
    })).resolves.toEqual({ state: "response_ready" });
    await expect(noReplies.service.operatorHealth()).resolves.toMatchObject({ response_ready_messages: 1 });
    noReplies.options.serviceRepliesEnabled = true;
    await expect(noReplies.service.claim(principal, { device_id: deviceId, wait_seconds: 0 })).resolves.toEqual({ kind: "empty" });
    expect(noReplies.deliveries).toHaveLength(1);
    expect(noReplies.deliveries[0]?.text).toBe("Done");
    await expect(noReplies.service.operatorHealth()).resolves.toMatchObject({ response_ready_messages: 0 });
    await expect(noReplies.service.complete(principal, claim.envelope.envelope_id, {
      device_id: deviceId, lease_id: claim.envelope.lease_id,
      terminal: { kind: "completed", message: "Done" }, host_session_id: null,
    })).rejects.toMatchObject({ code: "LEASE_CONFLICT" });
  });

  it("never sends a completion after the billing cutoff", async () => {
    const context = fixture({ leaseMilliseconds: 100 * 24 * 60 * 60_000 });
    const deviceId = await link(context);
    await context.service.handleInboundText({
      providerMessageId: "wamid.before-cutoff", senderIdentity: "15551234567", text: "cashews", occurredAt: context.clock.now().toISOString(),
    });
    const claim = await context.service.claim(principal, { device_id: deviceId, wait_seconds: 0 });
    if (claim.kind !== "work") throw new Error("Expected work");
    context.clock.advance(MAXIMUM_FREE_SERVICE_SEND_CUTOFF.getTime() - context.clock.now().getTime());
    await expect(context.service.complete(principal, claim.envelope.envelope_id, {
      device_id: deviceId, lease_id: claim.envelope.lease_id,
      terminal: { kind: "completed", message: "Done" }, host_session_id: null,
    })).resolves.toEqual({ state: "response_ready" });
    await expect(context.service.authorizeRunner(principal, deviceId, householdId)).rejects.toMatchObject({ code: "CHANNEL_DISABLED" });
  });
});
