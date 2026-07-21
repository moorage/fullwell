import { createHmac } from "node:crypto";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { HouseholdIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { DeterministicRandomSource, DeterministicTestAuthenticator, FixedClock, HmacTokenHasher, NoopTelemetry } from "../adapters/providers.js";
import { AesGcmMessageCipher } from "./cipher.js";
import { MemoryMessageEnvelopeStore } from "./memory-store.js";
import { registerMessagingRoutes } from "./routes.js";
import { MAXIMUM_FREE_SERVICE_SEND_CUTOFF, MessagingService } from "./service.js";
import { WhatsAppWebhookBoundary } from "./whatsapp-webhook.js";

describe("messaging routes", () => {
  it("links through a signed webhook and the same recent browser session", async () => {
    const appSecret = "route-test-app-secret-that-is-long";
    const businessAccountId = "123456789012345";
    const phoneNumberId = "123456789012346";
    const clock = new FixedClock(new Date("2026-07-20T16:00:00.000Z"));
    const authentication = new DeterministicTestAuthenticator();
    const principal = await authentication.authenticate("Bearer test-owner-token");
    const app = Fastify();
    let providerSendCount = 0;
    const service = new MessagingService(
      new MemoryMessageEnvelopeStore(),
      new AesGcmMessageCipher(Buffer.alloc(32, 7).toString("base64url"), () => Buffer.alloc(12, 8)),
      { sendServiceText: async () => {
        providerSendCount += 1;
        throw new Error("Provider sends must remain gated during linking");
      } },
      { isActiveMember: async () => true },
      clock,
      new DeterministicRandomSource(),
      new HmacTokenHasher("messaging-route-test-pepper-that-is-long"),
      new NoopTelemetry(),
      {
        freeServiceSendCutoff: MAXIMUM_FREE_SERVICE_SEND_CUTOFF,
        contactUrl: new URL("https://wa.me/15550100123"),
        serviceRepliesEnabled: false,
      },
    );
    await app.register(cookie);
    await registerMessagingRoutes(app, {
      service,
      webhook: new WhatsAppWebhookBoundary({ appSecret, verifyToken: "verify-token", businessAccountId, phoneNumberId }),
      authentication,
      telemetry: new NoopTelemetry(),
      requireRecentBrowserAuthentication: async (rawSessionToken) => {
        if (rawSessionToken !== "recent-session") throw new Error("unexpected session");
        return principal;
      },
      verifyBrowserCsrf: async (_request, token) => { if (token !== "c".repeat(32)) throw new Error("invalid csrf"); },
    });
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000001");
    const device = await service.registerDevice(principal, { household_id: householdId, name: "Kitchen Mac" });
    const linked = await app.inject({
      method: "POST",
      url: "/account/messaging/whatsapp/link",
      headers: { cookie: "hfj_session=recent-session" },
      payload: { household_id: householdId, device_id: device.device_id, csrf: "c".repeat(32) },
    });
    expect(linked.statusCode).toBe(303);
    const contact = new URL(linked.headers.location ?? "https://invalid.test");
    const text = contact.searchParams.get("text");
    if (text === null) throw new Error("Link redirect did not include a challenge");
    const body = Buffer.from(JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: businessAccountId, changes: [{ field: "messages", value: {
        messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId },
        messages: [{ from: "15551234567", id: "wamid.link", timestamp: "1784563200", type: "text", text: { body: text } }],
      } }] }],
    }));
    const signature = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
    const webhook = await app.inject({ method: "POST", url: "/api/messaging/whatsapp/webhook", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, payload: body });
    expect(webhook.statusCode).toBe(200);
    expect(providerSendCount).toBe(0);
    const pending = await service.accountStatus(principal, {});
    if (pending.kind !== "pending_confirmation") throw new Error("Expected a pending connection");
    const confirmed = await app.inject({
      method: "POST", url: "/account/messaging/whatsapp/confirm", headers: { cookie: "hfj_session=recent-session" },
      payload: { link_id: pending.linkId, csrf: "c".repeat(32) },
    });
    expect(confirmed.statusCode).toBe(303);
    await expect(service.accountStatus(principal, {})).resolves.toMatchObject({ kind: "linked", deviceId: device.device_id });
    await app.close();
  });
});
