import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { HouseholdIdSchema } from "@hfj/contracts";
import { z } from "zod";
import type { BrowserAuthService } from "../auth/service.js";
import { AppError } from "../core/errors.js";
import type { AccountService } from "./service.js";
import type { HouseholdFoodJournalService } from "../services/household-food-journal.js";

const CsrfSchema = z.object({ csrf: z.string().min(32).max(512) }).passthrough();
const RenameSchema = CsrfSchema.extend({ display_name: z.string().min(1).max(120) });
const ConfirmSchema = CsrfSchema.extend({ confirmation: z.string() });
const MethodParamsSchema = z.object({ provider: z.enum(["apple", "magic_link"]) }).strict();
const GrantParamsSchema = z.object({ grantId: z.string().min(1).max(256) }).strict();
const HouseholdParamsSchema = z.object({ householdId: HouseholdIdSchema }).strict();
const ExportSchema = CsrfSchema.extend({ format: z.enum(["readable_zip", "git_bundle"]), idempotency_key: z.string().min(8).max(128) });

export interface AccountRouteDependencies {
  readonly auth: BrowserAuthService;
  readonly accounts: AccountService;
  readonly journal?: HouseholdFoodJournalService;
}

export async function registerAccountRoutes(app: FastifyInstance, dependencies: AccountRouteDependencies): Promise<void> {
  app.post("/account/profile", async (request, reply) => {
    const body = RenameSchema.parse(request.body);
    const { userId } = await authorizeMutation(request, dependencies.auth, body.csrf);
    await dependencies.accounts.rename(userId, body.display_name);
    return accountResponse(reply);
  });

  app.post("/account/sign-in-methods/:provider/remove", async (request, reply) => {
    const body = CsrfSchema.parse(request.body);
    const { userId } = await authorizeMutation(request, dependencies.auth, body.csrf);
    const { provider } = MethodParamsSchema.parse(request.params);
    await dependencies.accounts.removeIdentityMethod(userId, provider);
    return accountResponse(reply);
  });

  app.post("/account/grants/:grantId/revoke", async (request, reply) => {
    const body = CsrfSchema.parse(request.body);
    const sessionToken = requireSessionCookie(request);
    await dependencies.auth.verifyCsrf(sessionToken, body.csrf);
    const principal = await dependencies.auth.requireRecentAuthentication(sessionToken);
    const { grantId } = GrantParamsSchema.parse(request.params);
    await dependencies.accounts.revokeGrant(principal.userId, grantId);
    return accountResponse(reply);
  });

  app.post("/account/households/:householdId/leave", async (request, reply) => {
    const body = ConfirmSchema.parse(request.body);
    if (body.confirmation !== "LEAVE") throw new AppError("VALIDATION_FAILED", "Type LEAVE to confirm");
    const { userId } = await authorizeMutation(request, dependencies.auth, body.csrf);
    await dependencies.accounts.leaveHousehold(userId, HouseholdParamsSchema.parse(request.params).householdId);
    return accountResponse(reply);
  });

  if (dependencies.journal !== undefined) {
    const journal = dependencies.journal;
    app.post("/account/households/:householdId/exports", { config: { rateLimit: { max: 10, timeWindow: 60 * 60_000 } } }, async (request, reply) => {
      const body = ExportSchema.parse(request.body);
      const { principal } = await authorizeMutation(request, dependencies.auth, body.csrf);
      const result = await journal.call("hfj_export_household", {
        household_id: HouseholdParamsSchema.parse(request.params).householdId,
        format: body.format,
        idempotency_key: body.idempotency_key,
      }, principal);
      if (!result.ok) throw new AppError(result.error.code, result.error.message);
      const url = z.object({ download_url: z.url() }).parse(result.data).download_url;
      return reply.redirect(url, 303);
    });
  }

  app.post("/account/delete", { config: { rateLimit: { max: 10, timeWindow: 15 * 60_000 } } }, async (request, reply) => {
    const body = ConfirmSchema.parse(request.body);
    if (body.confirmation !== "DELETE") throw new AppError("VALIDATION_FAILED", "Type DELETE to confirm");
    const sessionToken = requireSessionCookie(request);
    await dependencies.auth.verifyCsrf(sessionToken, body.csrf);
    const principal = await dependencies.auth.requireRecentAuthentication(sessionToken);
    await dependencies.accounts.deleteAccount(principal.userId);
    reply.clearCookie("hfj_session", { path: "/" });
    reply.clearCookie("hfj_csrf", { path: "/" });
    return reply.redirect("/install", 303);
  });
}

async function authorizeMutation(request: FastifyRequest, auth: BrowserAuthService, csrf: string) {
  const sessionToken = requireSessionCookie(request);
  await auth.verifyCsrf(sessionToken, csrf);
  const principal = await auth.authenticateSession(sessionToken);
  return { sessionToken, userId: principal.userId, principal };
}

function requireSessionCookie(request: FastifyRequest): string {
  const sessionToken = request.cookies.hfj_session;
  if (sessionToken === undefined) throw new AppError("AUTH_REQUIRED", "Sign in is required");
  return sessionToken;
}

function accountResponse(reply: FastifyReply) {
  return reply.redirect("/account", 303);
}
