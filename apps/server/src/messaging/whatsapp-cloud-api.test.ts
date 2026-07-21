import { RequestIdSchema } from "@hfj/contracts";
import { describe, expect, it, vi } from "vitest";
import { WhatsAppCloudApiAdapter } from "./whatsapp-cloud-api.js";

const requestId = RequestIdSchema.parse("req_0000000000000001");

describe("WhatsAppCloudApiAdapter", () => {
  it("sends only direct free-form service text", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe("https://graph.facebook.com/v24.0/123456789012346/messages");
      expect(init?.headers).toEqual({ authorization: "Bearer test-access-token", "content-type": "application/json" });
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
      expect(JSON.parse(init.body)).toEqual({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "15551234567",
        type: "text",
        text: { preview_url: false, body: "Salted or unsalted?" },
      });
      return new Response(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.outbound" }] }), { status: 200 });
    });
    const adapter = new WhatsAppCloudApiAdapter({ graphApiVersion: "v24.0", phoneNumberId: "123456789012346", accessToken: "test-access-token", fetcher });
    await expect(adapter.sendServiceText({ destination: "15551234567", text: "Salted or unsalted?", requestId }))
      .resolves.toEqual({ providerDeliveryId: "wamid.outbound" });
  });

  it("fails closed on invalid configuration and provider responses", async () => {
    expect(() => new WhatsAppCloudApiAdapter({ graphApiVersion: "latest", phoneNumberId: "123456789012346", accessToken: "token" })).toThrow(/API_VERSION/);
    expect(() => new WhatsAppCloudApiAdapter({ graphApiVersion: "v24.0", phoneNumberId: "not-an-id", accessToken: "token" })).toThrow(/PHONE_NUMBER_ID/);
    const unavailable = new WhatsAppCloudApiAdapter({ graphApiVersion: "v24.0", phoneNumberId: "123456789012346", accessToken: "token", fetcher: async () => new Response(null, { status: 503 }) });
    await expect(unavailable.sendServiceText({ destination: "15551234567", text: "text", requestId })).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
    const graphError = new WhatsAppCloudApiAdapter({
      graphApiVersion: "v24.0",
      phoneNumberId: "123456789012346",
      accessToken: "token",
      fetcher: async () => new Response(JSON.stringify({ error: { code: 131000, error_subcode: 2494010, message: "private provider detail" } }), { status: 400 }),
    });
    await expect(graphError.sendServiceText({ destination: "15551234567", text: "text", requestId }))
      .rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", message: "WhatsApp delivery failed with Graph code 131000/2494010" });
    const malformed = new WhatsAppCloudApiAdapter({ graphApiVersion: "v24.0", phoneNumberId: "123456789012346", accessToken: "token", fetcher: async () => new Response("not-json", { status: 200 }) });
    await expect(malformed.sendServiceText({ destination: "15551234567", text: "text", requestId })).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    const wrongShape = new WhatsAppCloudApiAdapter({ graphApiVersion: "v24.0", phoneNumberId: "123456789012346", accessToken: "token", fetcher: async () => new Response("{}", { status: 200 }) });
    await expect(wrongShape.sendServiceText({ destination: "15551234567", text: "text", requestId })).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
