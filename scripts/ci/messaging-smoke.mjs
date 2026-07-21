import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function runMessagingSmoke(settings, fetcher = fetch) {
  const challenge = "fullwell-messaging-smoke-challenge";
  const webhook = new URL("/api/messaging/whatsapp/webhook", settings.baseUrl);
  webhook.search = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": settings.verifyToken,
    "hub.challenge": challenge,
  }).toString();
  const verified = await fetcher(webhook, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
  if (verified.status !== 200 || await verified.text() !== challenge) throw new Error("WhatsApp webhook verification challenge failed.");

  webhook.searchParams.set("hub.verify_token", `${settings.verifyToken}-wrong`);
  const rejectedChallenge = await fetcher(webhook, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
  if (rejectedChallenge.status !== 403) throw new Error(`Invalid webhook verification returned ${rejectedChallenge.status}; expected 403.`);

  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: settings.businessAccountId,
      changes: [{
        field: "messages",
        value: { messaging_product: "whatsapp", metadata: { phone_number_id: settings.phoneNumberId } },
      }],
    }],
  });
  const unsigned = await fetcher(new URL("/api/messaging/whatsapp/webhook", settings.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (unsigned.status !== 403) throw new Error(`Unsigned webhook returned ${unsigned.status}; expected 403.`);

  const signature = createHmac("sha256", settings.appSecret).update(body).digest("hex");
  const signed = await fetcher(new URL("/api/messaging/whatsapp/webhook", settings.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${signature}` },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (signed.status !== 200) throw new Error(`Signed empty webhook returned ${signed.status}; expected 200.`);
  const response = await signed.json();
  if (response?.received !== true) throw new Error("Signed empty webhook did not return the bounded acknowledgement.");
}

async function settingsFromEnvironment(environment) {
  const baseUrl = environment.STAGING_BASE_URL ?? environment.PUBLIC_BASE_URL;
  if (baseUrl === undefined) throw new Error("Set STAGING_BASE_URL or PUBLIC_BASE_URL for the messaging smoke.");
  return {
    baseUrl,
    verifyToken: await credentialFile(environment, "MESSAGING_SMOKE_VERIFY_TOKEN_FILE"),
    appSecret: await credentialFile(environment, "MESSAGING_SMOKE_APP_SECRET_FILE"),
    businessAccountId: await credentialFile(environment, "MESSAGING_SMOKE_BUSINESS_ACCOUNT_ID_FILE"),
    phoneNumberId: await credentialFile(environment, "MESSAGING_SMOKE_PHONE_NUMBER_ID_FILE"),
  };
}

async function credentialFile(environment, name) {
  const path = environment[name];
  if (path === undefined) throw new Error(`${name} must point to a credential file.`);
  const value = (await readFile(path, "utf8")).trim();
  if (value.length === 0 || value.length > 512) throw new Error(`${name} contained an invalid value.`);
  return value;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runMessagingSmoke(await settingsFromEnvironment(process.env));
  console.log("Non-destructive WhatsApp webhook smoke passed.");
}
