import type { RequestId } from "@hfj/contracts";
import { z } from "zod";
import type { WhatsAppProviderPort } from "./ports.js";
import { AppError } from "../core/errors.js";

const GraphResponseSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  messages: z.array(z.object({ id: z.string().min(1).max(256) }).passthrough()).min(1).max(1),
}).passthrough();
const GraphErrorSchema = z.object({
  error: z.object({
    code: z.number().int(),
    error_subcode: z.number().int().optional(),
  }).passthrough(),
}).passthrough();

export interface WhatsAppCloudApiOptions {
  readonly graphApiVersion: string;
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly fetcher?: typeof fetch;
}

export class WhatsAppCloudApiAdapter implements WhatsAppProviderPort {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: WhatsAppCloudApiOptions) {
    if (!/^v\d+\.\d+$/.test(options.graphApiVersion)) throw new Error("WHATSAPP_GRAPH_API_VERSION is invalid");
    if (!/^\d{6,32}$/.test(options.phoneNumberId)) throw new Error("WHATSAPP_PHONE_NUMBER_ID is invalid");
    this.fetcher = options.fetcher ?? fetch;
  }

  async sendServiceText(input: { readonly destination: string; readonly text: string; readonly requestId: RequestId }) {
    const response = await this.fetcher(`https://graph.facebook.com/${this.options.graphApiVersion}/${this.options.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.destination,
        type: "text",
        text: { preview_url: false, body: input.text },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    if (!response.ok) throw graphDeliveryError(body);
    const parsed = parseGraphResponse(body);
    const delivery = parsed.messages[0];
    if (delivery === undefined) throw new AppError("PROVIDER_UNAVAILABLE", "WhatsApp delivery did not return a message identifier", true, 30);
    return { providerDeliveryId: delivery.id };
  }
}

function graphDeliveryError(body: string): AppError {
  try {
    const parsed = GraphErrorSchema.safeParse(JSON.parse(body));
    if (parsed.success) {
      const subcode = parsed.data.error.error_subcode;
      const diagnostic = subcode === undefined ? `${parsed.data.error.code}` : `${parsed.data.error.code}/${subcode}`;
      return new AppError("PROVIDER_UNAVAILABLE", `WhatsApp delivery failed with Graph code ${diagnostic}`, true, 30);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return new AppError("PROVIDER_UNAVAILABLE", "WhatsApp delivery is temporarily unavailable", true, 30);
}

function parseGraphResponse(body: string): z.infer<typeof GraphResponseSchema> {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) throw new AppError("PROVIDER_UNAVAILABLE", "WhatsApp delivery returned an invalid response", true, 30);
    throw error;
  }
  const parsed = GraphResponseSchema.safeParse(value);
  if (!parsed.success) throw new AppError("PROVIDER_UNAVAILABLE", "WhatsApp delivery returned an invalid response", true, 30);
  return parsed.data;
}
