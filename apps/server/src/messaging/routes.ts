import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthenticationPort, TelemetryPort } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { AppError } from "../core/errors.js";
import type { MessagingService } from "./service.js";
import type { WhatsAppWebhookBoundary } from "./whatsapp-webhook.js";

const LinkFormSchema = z.object({
  household_id: z.string(),
  device_id: z.string(),
  csrf: z.string().min(16).max(512),
}).strict();
const RevokeFormSchema = z.object({ device_id: z.string(), csrf: z.string().min(16).max(512) }).strict();
const ConfirmFormSchema = z.object({ link_id: z.string(), csrf: z.string().min(16).max(512) }).strict();
const ConfirmedRevokeFormSchema = RevokeFormSchema.extend({ confirmation: z.literal("REVOKE") }).strict();

export interface MessagingRouteDependencies {
  readonly service: MessagingService;
  readonly webhook: WhatsAppWebhookBoundary;
  readonly authentication: AuthenticationPort;
  readonly telemetry: TelemetryPort;
  requireRecentBrowserAuthentication(rawSessionToken: string): Promise<Principal>;
  verifyBrowserCsrf(request: FastifyRequest, submittedToken: string): Promise<void>;
}

export async function registerMessagingRoutes(app: FastifyInstance, dependencies: MessagingRouteDependencies): Promise<void> {
  await app.register(async (webhookApp) => {
    webhookApp.removeContentTypeParser("application/json");
    webhookApp.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 65_536 }, (_request, body, done) => done(null, body));
    webhookApp.get("/api/messaging/whatsapp/webhook", { config: { rateLimit: { max: 60, timeWindow: 60_000, groupId: "whatsapp-webhook" } } }, async (request, reply) => {
      return reply.type("text/plain; charset=utf-8").send(dependencies.webhook.verifyChallenge(request.query));
    });
    webhookApp.post("/api/messaging/whatsapp/webhook", { config: { rateLimit: { max: 300, timeWindow: 60_000, groupId: "whatsapp-webhook" } } }, async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) throw new AppError("VALIDATION_FAILED", "Webhook body was not buffered");
      const parsed = dependencies.webhook.parseSignedBody(request.body, headerValue(request.headers["x-hub-signature-256"]));
      for (const inbound of parsed.inbound) await dependencies.service.handleInboundText(inbound);
      for (const status of parsed.statuses) await dependencies.service.handleDeliveryStatus(status);
      if (parsed.unsupportedCount > 0) dependencies.telemetry.event("messaging.webhook_unsupported", { count: parsed.unsupportedCount });
      return reply.code(200).send({ received: true });
    });
  });

  app.post("/api/runner/devices", { config: { rateLimit: { max: 10, timeWindow: 60_000, groupId: "runner" } } }, async (request, reply) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    return reply.code(201).send(await dependencies.service.registerDevice(principal, request.body));
  });
  app.post("/api/runner/messages/claim", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "runner" } } }, async (request) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    return await dependencies.service.claim(principal, request.body);
  });
  app.post("/api/runner/messages/:id/heartbeat", { config: { rateLimit: { max: 240, timeWindow: 60_000, groupId: "runner" } } }, async (request) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    const params = z.object({ id: z.string() }).parse(request.params);
    return await dependencies.service.heartbeat(principal, params.id, request.body);
  });
  app.post("/api/runner/messages/:id/complete", { config: { rateLimit: { max: 120, timeWindow: 60_000, groupId: "runner" } } }, async (request) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    const params = z.object({ id: z.string() }).parse(request.params);
    return await dependencies.service.complete(principal, params.id, request.body);
  });
  app.post("/api/runner/devices/:id/revoke", { config: { rateLimit: { max: 10, timeWindow: 60 * 60_000, groupId: "runner" } } }, async (request, reply) => {
    const principal = await dependencies.authentication.authenticate(request.headers.authorization);
    const params = z.object({ id: z.string() }).parse(request.params);
    await dependencies.service.revokeRunner(principal, params.id);
    return reply.code(204).send();
  });
  app.post("/account/messaging/whatsapp/link", { config: { rateLimit: { max: 10, timeWindow: 60 * 60_000, groupId: "messaging-account" } } }, async (request, reply) => {
    const form = LinkFormSchema.parse(request.body);
    const rawSession = requiredSessionCookie(request);
    const principal = await dependencies.requireRecentBrowserAuthentication(rawSession);
    await dependencies.verifyBrowserCsrf(request, form.csrf);
    const result = await dependencies.service.createLinkChallenge(principal, rawSession, { household_id: form.household_id, device_id: form.device_id });
    return reply.code(303).redirect(result.contact_url);
  });
  app.post("/account/messaging/whatsapp/revoke", { config: { rateLimit: { max: 20, timeWindow: 60 * 60_000, groupId: "messaging-account" } } }, async (request, reply) => {
    const form = ConfirmedRevokeFormSchema.parse(request.body);
    const rawSession = requiredSessionCookie(request);
    const principal = await dependencies.requireRecentBrowserAuthentication(rawSession);
    await dependencies.verifyBrowserCsrf(request, form.csrf);
    await dependencies.service.revoke(principal, form.device_id);
    return reply.code(303).redirect("/account");
  });
  app.post("/account/messaging/whatsapp/confirm", { config: { rateLimit: { max: 20, timeWindow: 60 * 60_000, groupId: "messaging-account" } } }, async (request, reply) => {
    const form = ConfirmFormSchema.parse(request.body);
    const rawSession = requiredSessionCookie(request);
    const principal = await dependencies.requireRecentBrowserAuthentication(rawSession);
    await dependencies.verifyBrowserCsrf(request, form.csrf);
    await dependencies.service.confirmLink(principal, rawSession, form.link_id);
    return reply.code(303).redirect("/account");
  });
}

function requiredSessionCookie(request: FastifyRequest): string {
  const session = request.cookies.hfj_session;
  if (session === undefined) throw new AppError("AUTH_REQUIRED", "Sign in is required");
  return session;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
