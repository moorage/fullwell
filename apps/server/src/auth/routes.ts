import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MagicLinkCompleteSchema, MagicLinkRequestSchema } from "@hfj/contracts";
import { z } from "zod";
import { AppError } from "../core/errors.js";
import type { BrowserAuthService } from "./service.js";

const AppleCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(32).max(512),
  browser_binding: z.string().min(32).max(512),
  redirect_uri: z.url().max(4096).optional(),
}).strict();
const StartAuthSchema = z.object({ pending_intent: z.string().max(2048).optional() }).strict();
const PasskeyCompleteSchema = z.object({
  transaction: z.string().min(32).max(512),
  response: z.unknown(),
}).strict();
const PasskeyRegistrationStartSchema = z.object({ csrf: z.string().min(32).max(512) }).strict();
const PasskeyRegistrationCompleteSchema = PasskeyCompleteSchema.extend({ csrf: z.string().min(32).max(512) }).strict();
const PasskeyCredentialParamsSchema = z.object({ credentialId: z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/) }).strict();
const LinkMagicSchema = z.object({ csrf: z.string().min(32).max(512), email: z.email().max(320) }).strict();
const LinkMagicCompleteSchema = z.object({ token: z.string().min(32).max(512) }).strict();
const CsrfSchema = z.object({ csrf: z.string().min(32).max(512) }).strict();

export interface BrowserAuthRouteDependencies {
  readonly auth: BrowserAuthService;
  readonly secureCookies: boolean;
  readonly appleAuthorization?: { readonly clientId: string; readonly redirectUri: string };
}

export async function registerBrowserAuthRoutes(app: FastifyInstance, dependencies: BrowserAuthRouteDependencies): Promise<void> {
  app.post("/auth/magic-link", async (request, reply) => {
    const body = MagicLinkRequestSchema.parse(request.body);
    await dependencies.auth.requestMagicLink(body.email, body.pending_intent);
    if (request.headers.accept?.includes("text/html")) return reply.redirect("/sign-in?emailSent=1", 303);
    return reply.code(202).send({ accepted: true });
  });

  app.get("/auth/magic-link/complete", async (request, reply) => {
    const query = MagicLinkCompleteSchema.parse(request.query);
    const session = await dependencies.auth.completeMagicLink(query.token, query.transaction);
    setSessionCookie(reply, session.sessionToken, dependencies.secureCookies);
    setCsrfCookie(reply, session.csrfToken, dependencies.secureCookies);
    return reply.redirect(session.pendingIntent ?? "/households");
  });

  app.post("/account/sign-in-methods/magic_link/start", async (request, reply) => {
    const body = LinkMagicSchema.parse(request.body);
    const sessionToken = requireSessionCookie(request);
    await dependencies.auth.verifyCsrf(sessionToken, body.csrf);
    const principal = await dependencies.auth.authenticateSession(sessionToken);
    await dependencies.auth.requestMagicLinkIdentity(principal.userId, sessionToken, body.email);
    return reply.redirect("/account?emailLinkSent=1", 303);
  });

  app.get("/account/sign-in-methods/magic_link/complete", async (request, reply) => {
    const { token } = LinkMagicCompleteSchema.parse(request.query);
    await dependencies.auth.completeMagicLinkIdentity(token, requireSessionCookie(request));
    return reply.redirect("/account?methodLinked=magic_link", 302);
  });

  app.post("/auth/apple/start", async (request, reply) => {
    const body = StartAuthSchema.parse(request.body ?? {});
    const started = await dependencies.auth.beginApple(body.pending_intent);
    reply.setCookie("hfj_auth_binding", started.browserBinding, {
      path: "/auth/apple/callback", httpOnly: true, secure: dependencies.secureCookies, sameSite: "lax", maxAge: 10 * 60,
    });
    if (dependencies.appleAuthorization === undefined) return reply.code(202).send({ state: started.state });
    return reply.redirect(appleAuthorizationUrl(dependencies.appleAuthorization, started.state).toString());
  });

  app.post("/account/sign-in-methods/apple/start", async (request, reply) => {
    const { csrf } = CsrfSchema.parse(request.body);
    const sessionToken = requireSessionCookie(request);
    await dependencies.auth.verifyCsrf(sessionToken, csrf);
    const principal = await dependencies.auth.authenticateSession(sessionToken);
    const started = await dependencies.auth.beginAppleIdentity(principal.userId, sessionToken);
    reply.setCookie("hfj_auth_binding", started.browserBinding, {
      path: "/auth/apple/callback", httpOnly: true, secure: dependencies.secureCookies, sameSite: "lax", maxAge: 10 * 60,
    });
    if (dependencies.appleAuthorization === undefined) return reply.code(503).send({ error: { code: "PROVIDER_UNAVAILABLE" } });
    return reply.redirect(appleAuthorizationUrl(dependencies.appleAuthorization, started.state).toString());
  });

  app.post("/auth/apple/callback", async (request, reply) => {
    const parsed = AppleCallbackSchema.omit({ browser_binding: true }).safeParse(request.body);
    const body = parsed.success
      ? { ...parsed.data, browser_binding: request.cookies.hfj_auth_binding }
      : AppleCallbackSchema.parse(request.body);
    if (body.browser_binding === undefined) throw new AppError("AUTH_REQUIRED", "The Apple sign-in request is invalid or expired");
    const session = await dependencies.auth.completeApple({
      code: body.code,
      state: body.state,
      browserBinding: body.browser_binding,
      redirectUri: dependencies.appleAuthorization?.redirectUri ?? body.redirect_uri ?? "",
      ...(request.cookies.hfj_session === undefined ? {} : { rawSessionToken: request.cookies.hfj_session }),
    });
    setSessionCookie(reply, session.sessionToken, dependencies.secureCookies);
    setCsrfCookie(reply, session.csrfToken, dependencies.secureCookies);
    reply.clearCookie("hfj_auth_binding", { path: "/auth/apple/callback" });
    return reply.redirect(session.pendingIntent ?? "/households", 303);
  });

  app.post("/auth/passkey/options", async (request, reply) => {
    return startPasskeyAuthentication(request, reply, dependencies);
  });

  app.post("/auth/passkey/start", async (request, reply) => {
    return startPasskeyAuthentication(request, reply, dependencies);
  });

  app.post("/auth/passkey/authentication/complete", async (request, reply) => {
    const body = PasskeyCompleteSchema.parse(request.body);
    const browserBinding = request.cookies.hfj_passkey_binding;
    if (browserBinding === undefined) throw new AppError("AUTH_REQUIRED", "The passkey sign-in request is invalid or expired");
    const session = await dependencies.auth.completePasskeyAuthentication({ ...body, browserBinding });
    setSessionCookie(reply, session.sessionToken, dependencies.secureCookies);
    setCsrfCookie(reply, session.csrfToken, dependencies.secureCookies);
    reply.clearCookie("hfj_passkey_binding", { path: "/auth/passkey/authentication/complete" });
    return { authenticated: true, redirect_to: session.pendingIntent ?? "/households" };
  });

  app.post("/auth/passkey/registration/options", async (request) => {
    const sessionToken = requireSessionCookie(request);
    const body = PasskeyRegistrationStartSchema.parse(request.body);
    await dependencies.auth.verifyCsrf(sessionToken, body.csrf);
    const principal = await dependencies.auth.authenticateSession(sessionToken);
    return dependencies.auth.beginPasskeyRegistration(principal.userId, sessionToken);
  });

  app.post("/auth/passkey/registration/complete", async (request) => {
    const sessionToken = requireSessionCookie(request);
    const body = PasskeyRegistrationCompleteSchema.parse(request.body);
    await dependencies.auth.verifyCsrf(sessionToken, body.csrf);
    const principal = await dependencies.auth.authenticateSession(sessionToken);
    const credential = await dependencies.auth.completePasskeyRegistration({
      userId: principal.userId,
      rawSessionToken: sessionToken,
      transaction: body.transaction,
      response: body.response,
    });
    return {
      id: credential.credentialId,
      name: credential.name,
      created_at: credential.createdAt,
      last_used_at: credential.lastUsedAt,
    };
  });

  app.post("/auth/passkeys/:credentialId/remove", async (request, reply) => {
    const sessionToken = requireSessionCookie(request);
    const params = PasskeyCredentialParamsSchema.parse(request.params);
    const csrf = z.union([
      z.object({ csrf_token: z.string().min(32).max(512) }).strict().transform((value) => value.csrf_token),
      z.object({ csrf: z.string().min(32).max(512) }).strict().transform((value) => value.csrf),
    ]).parse(request.body);
    await dependencies.auth.verifyCsrf(sessionToken, csrf);
    const principal = await dependencies.auth.authenticateSession(sessionToken);
    await dependencies.auth.removePasskey(principal.userId, params.credentialId);
    if (request.headers.accept?.includes("text/html")) return reply.redirect("/account", 303);
    return reply.code(204).send();
  });

  app.post("/auth/sign-out", async (request, reply) => {
    const sessionToken = requireSessionCookie(request);
    const body = z.union([
      z.object({ csrf_token: z.string().min(32).max(512) }).strict().transform((value) => value.csrf_token),
      z.object({ csrf: z.string().min(32).max(512) }).strict().transform((value) => value.csrf),
    ]).parse(request.body);
    await dependencies.auth.verifyCsrf(sessionToken, body);
    await dependencies.auth.signOut(sessionToken);
    reply.clearCookie("hfj_session", { path: "/" });
    reply.clearCookie("hfj_csrf", { path: "/" });
    if (request.headers.accept?.includes("text/html")) return reply.redirect("/install", 303);
    return reply.code(204).send();
  });
}

function setCsrfCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie("hfj_csrf", token, {
    path: "/", httpOnly: false, secure, sameSite: "lax", maxAge: 60 * 60 * 24 * 30,
  });
}

export function browserPrincipalResolver(auth: BrowserAuthService) {
  return async (request: FastifyRequest) => auth.authenticateSession(requireSessionCookie(request));
}

export function browserCsrfVerifier(auth: BrowserAuthService) {
  return async (request: FastifyRequest, submittedToken: string) => auth.verifyCsrf(requireSessionCookie(request), submittedToken);
}

function requireSessionCookie(request: FastifyRequest): string {
  const token = request.cookies.hfj_session;
  if (token === undefined) throw new AppError("AUTH_REQUIRED", "Sign in is required");
  return token;
}

function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie("hfj_session", token, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function startPasskeyAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: BrowserAuthRouteDependencies,
): Promise<{ readonly transaction: string; readonly publicOptions: object }> {
  const body = StartAuthSchema.parse(request.body ?? {});
  const started = await dependencies.auth.beginPasskeyAuthentication(body.pending_intent);
  reply.setCookie("hfj_passkey_binding", started.browserBinding, {
    path: "/auth/passkey/authentication/complete",
    httpOnly: true,
    secure: dependencies.secureCookies,
    sameSite: "strict",
    maxAge: 5 * 60,
  });
  return { transaction: started.transaction, publicOptions: started.publicOptions };
}

function appleAuthorizationUrl(configuration: NonNullable<BrowserAuthRouteDependencies["appleAuthorization"]>, state: string): URL {
  const authorization = new URL("https://appleid.apple.com/auth/authorize");
  authorization.search = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: configuration.redirectUri,
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce: state,
  }).toString();
  return authorization;
}
