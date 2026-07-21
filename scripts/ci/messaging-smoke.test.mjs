import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { runMessagingSmoke } from "./messaging-smoke.mjs";

test("messaging smoke verifies challenge and signed empty webhook without a message send", async () => {
  const settings = {
    baseUrl: "https://fullwell.example.test",
    verifyToken: "verify-token",
    appSecret: "app-secret",
    businessAccountId: "business-account",
    phoneNumberId: "phone-number",
  };
  const requests = [];
  const fetcher = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const parsed = new URL(url);
    if (init.method !== "POST") {
      return parsed.searchParams.get("hub.verify_token") === settings.verifyToken
        ? new Response(parsed.searchParams.get("hub.challenge"), { status: 200 })
        : new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
    }
    const body = String(init.body);
    const supplied = new Headers(init.headers).get("x-hub-signature-256");
    if (supplied === null) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
    const expected = `sha256=${createHmac("sha256", settings.appSecret).update(body).digest("hex")}`;
    assert.equal(supplied, expected);
    assert.equal(JSON.parse(body).entry[0].changes[0].value.messages, undefined);
    return Response.json({ received: true });
  };

  await runMessagingSmoke(settings, fetcher);

  assert.equal(requests.length, 4);
  assert.equal(requests.filter((request) => request.init.method === "POST").length, 2);
});
