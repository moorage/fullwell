import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { ProviderDeliveryStatus, ProviderInboundText } from "./service.js";

const VerificationQuerySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(512),
  "hub.challenge": z.string().min(1).max(512),
}).passthrough();

const TextMessageSchema = z.object({
  from: z.string().min(1).max(128),
  id: z.string().min(1).max(256),
  timestamp: z.string().regex(/^\d{1,16}$/),
  type: z.string().min(1).max(64),
  text: z.object({ body: z.string().min(1).max(1_024) }).passthrough().optional(),
}).passthrough();

const ChangeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({ phone_number_id: z.string().min(1).max(128) }).passthrough(),
  messages: z.array(TextMessageSchema).max(50).optional(),
  statuses: z.array(z.object({
    id: z.string().min(1).max(256),
    status: z.enum(["sent", "delivered", "read", "failed"]),
    timestamp: z.string().regex(/^\d{1,16}$/),
    errors: z.array(z.object({ code: z.union([z.number().int(), z.string().max(64)]) }).passthrough()).max(10).optional(),
  }).passthrough()).max(100).optional(),
}).passthrough();

const WebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string().min(1).max(128),
    changes: z.array(z.object({ field: z.literal("messages"), value: ChangeValueSchema }).passthrough()).max(20),
  }).passthrough()).max(10),
}).passthrough();

export interface WhatsAppWebhookOptions {
  readonly appSecret: string;
  readonly verifyToken: string;
  readonly businessAccountId: string;
  readonly phoneNumberId: string;
}

export interface ParsedWhatsAppWebhook {
  readonly inbound: readonly ProviderInboundText[];
  readonly unsupportedCount: number;
  readonly statuses: readonly ProviderDeliveryStatus[];
}

export class WhatsAppWebhookBoundary {
  constructor(private readonly options: WhatsAppWebhookOptions) {}

  verifyChallenge(query: unknown): string {
    const parsed = VerificationQuerySchema.parse(query);
    if (!constantTimeTextEqual(parsed["hub.verify_token"], this.options.verifyToken)) {
      throw new AppError("FORBIDDEN", "Webhook verification failed");
    }
    return parsed["hub.challenge"];
  }

  parseSignedBody(body: Buffer, signature: string | undefined): ParsedWhatsAppWebhook {
    if (signature === undefined || !/^sha256=[0-9a-f]{64}$/.test(signature)) {
      throw new AppError("FORBIDDEN", "Webhook signature verification failed");
    }
    const expected = createHmac("sha256", this.options.appSecret).update(body).digest();
    const supplied = Buffer.from(signature.slice("sha256=".length), "hex");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new AppError("FORBIDDEN", "Webhook signature verification failed");
    }
    const parsed = WebhookSchema.parse(parseJsonBody(body));
    const inbound: ProviderInboundText[] = [];
    let unsupportedCount = 0;
    const statuses: ProviderDeliveryStatus[] = [];
    for (const entry of parsed.entry) {
      if (entry.id !== this.options.businessAccountId) throw new AppError("FORBIDDEN", "Webhook account did not match");
      for (const change of entry.changes) {
        if (change.value.metadata.phone_number_id !== this.options.phoneNumberId) {
          throw new AppError("FORBIDDEN", "Webhook destination did not match");
        }
        for (const status of change.value.statuses ?? []) {
          statuses.push({
            providerDeliveryId: status.id,
            status: status.status,
            occurredAt: new Date(Number(status.timestamp) * 1_000).toISOString(),
            failureCode: status.errors?.[0] === undefined ? null : String(status.errors[0].code).slice(0, 64),
          });
        }
        for (const message of change.value.messages ?? []) {
          if (message.type !== "text" || message.text === undefined) {
            unsupportedCount += 1;
            continue;
          }
          inbound.push({
            providerMessageId: message.id,
            senderIdentity: message.from,
            text: message.text.body,
            occurredAt: new Date(Number(message.timestamp) * 1_000).toISOString(),
          });
        }
      }
    }
    return { inbound, unsupportedCount, statuses };
  }
}

function parseJsonBody(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new AppError("VALIDATION_FAILED", "Webhook body was not valid JSON");
    throw error;
  }
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftDigest = createHmac("sha256", "fullwell-webhook-verification").update(left).digest();
  const rightDigest = createHmac("sha256", "fullwell-webhook-verification").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
