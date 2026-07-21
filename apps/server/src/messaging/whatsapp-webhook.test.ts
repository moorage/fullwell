import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WhatsAppWebhookBoundary } from "./whatsapp-webhook.js";

const options = {
  appSecret: "test-app-secret-that-is-long",
  verifyToken: "test-verification-token",
  businessAccountId: "123456789012345",
  phoneNumberId: "123456789012346",
};

function signed(body: Buffer): string {
  return `sha256=${createHmac("sha256", options.appSecret).update(body).digest("hex")}`;
}

function payload(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: options.businessAccountId,
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: options.phoneNumberId },
          messages: [
            { from: "15551234567", id: "wamid.one", timestamp: "1784563200", type: "text", text: { body: "Get cashews" } },
            { from: "15551234567", id: "wamid.two", timestamp: "1784563201", type: "image" },
          ],
          statuses: [{ id: "wamid.outbound", status: "delivered", timestamp: "1784563202" }],
          ...overrides,
        },
      }],
    }],
  }));
}

describe("WhatsAppWebhookBoundary", () => {
  it("verifies setup challenges without reflecting an invalid challenge", () => {
    const boundary = new WhatsAppWebhookBoundary(options);
    expect(boundary.verifyChallenge({ "hub.mode": "subscribe", "hub.verify_token": options.verifyToken, "hub.challenge": "challenge-value" })).toBe("challenge-value");
    expect(() => boundary.verifyChallenge({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "secret-challenge" }))
      .toThrow(/verification failed/);
  });

  it("authenticates the raw body and separates text, unsupported, and status events", () => {
    const boundary = new WhatsAppWebhookBoundary(options);
    const body = payload();
    expect(boundary.parseSignedBody(body, signed(body))).toEqual({
      inbound: [{ providerMessageId: "wamid.one", senderIdentity: "15551234567", text: "Get cashews", occurredAt: "2026-07-20T16:00:00.000Z" }],
      unsupportedCount: 1,
      statuses: [{ providerDeliveryId: "wamid.outbound", status: "delivered", occurredAt: "2026-07-20T16:00:02.000Z", failureCode: null }],
    });

    const failed = payload({
      messages: undefined,
      statuses: [
        { id: "wamid.failed-one", status: "failed", timestamp: "1784563203", errors: [{ code: 131026 }] },
        { id: "wamid.failed-two", status: "failed", timestamp: "1784563204", errors: [{ code: "provider-code" }] },
      ],
    });
    expect(boundary.parseSignedBody(failed, signed(failed))).toMatchObject({
      inbound: [], unsupportedCount: 0,
      statuses: [
        { failureCode: "131026" },
        { failureCode: "provider-code" },
      ],
    });
  });

  it("rejects missing signatures, malformed JSON, and destination mismatches", () => {
    const boundary = new WhatsAppWebhookBoundary(options);
    const body = payload();
    expect(() => boundary.parseSignedBody(body, undefined)).toThrow(/signature/);
    expect(() => boundary.parseSignedBody(body, `sha256=${"0".repeat(64)}`)).toThrow(/signature/);
    const malformed = Buffer.from("{");
    expect(() => boundary.parseSignedBody(malformed, signed(malformed))).toThrow(/valid JSON/);
    const wrongDestination = payload({ metadata: { phone_number_id: "999999999999999" } });
    expect(() => boundary.parseSignedBody(wrongDestination, signed(wrongDestination))).toThrow(/destination/);
    const wrongAccount = Buffer.from(body.toString().replace(options.businessAccountId, "999999999999998"));
    expect(() => boundary.parseSignedBody(wrongAccount, signed(wrongAccount))).toThrow(/account/);
  });
});
