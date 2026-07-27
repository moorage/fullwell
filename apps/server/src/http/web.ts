import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { renderWebRoute, type RenderedWebRoute } from "@hfj/web/server";
import type { VisualJournalPage, WebRenderContext } from "@hfj/web/types";
import {
  DateSchema,
  GitObjectIdSchema,
  IdempotencyKeySchema,
  MealPlanEventIdSchema,
  MealProposalIdSchema,
  MondayDateSchema,
} from "@hfj/contracts";
import { z } from "zod";

const ManifestSchema = z.record(z.string(), z.object({
  file: z.string().min(1),
  css: z.array(z.string().min(1)).optional(),
}));

export interface WebExperience {
  readonly assetsRoot: string;
  contextFor(request: FastifyRequest): Promise<WebRenderContext>;
  createHousehold?(request: FastifyRequest, input: WebCreateHouseholdInput): Promise<{ householdId: string }>;
  importCollection?(request: FastifyRequest, input: WebImportInput): Promise<{ householdId: string }>;
  reviewMealConstraints?(request: FastifyRequest, input: WebReviewMealConstraintsInput): Promise<void>;
  addMealProposal?(request: FastifyRequest, input: WebAddMealProposalInput): Promise<void>;
  withdrawMealProposal?(request: FastifyRequest, input: WebWithdrawMealProposalInput): Promise<void>;
  journalItems?(request: FastifyRequest, input: WebJournalItemsInput): Promise<VisualJournalPage>;
}

export type WebCreateHouseholdInput = {
  readonly name: string;
  readonly csrf: string;
  readonly idempotencyKey: string;
};

export type WebImportInput = {
  readonly token: string;
  readonly householdId: string;
  readonly itemIds: readonly string[];
  readonly csrf: string;
  readonly idempotencyKey: string;
};

export type WebReviewMealConstraintsInput = {
  readonly householdId: string;
  readonly week: string;
  readonly constraintRevision: string;
  readonly csrf: string;
  readonly idempotencyKey: string;
};

export type WebAddMealProposalInput = {
  readonly householdId: string;
  readonly week: string;
  readonly mealDate: string;
  readonly slotKind: "breakfast" | "lunch" | "dinner" | "snack";
  readonly title: string;
  readonly servings: number | null;
  readonly notes: string | null;
  readonly constraintRevision: string;
  readonly constraintReviewEventId: string;
  readonly csrf: string;
  readonly idempotencyKey: string;
};

export type WebWithdrawMealProposalInput = {
  readonly householdId: string;
  readonly week: string;
  readonly proposalId: string;
  readonly reason: string | null;
  readonly csrf: string;
  readonly idempotencyKey: string;
};

export type WebJournalItemsInput = {
  readonly householdId: string;
  readonly section: "recipes" | "groceries" | "takeout";
  readonly cursor?: string;
  readonly snapshotRevision?: string;
};

const SelectionFormSchema = z.object({
  itemIds: z.union([z.string(), z.array(z.string())]).transform((value) => Array.isArray(value) ? value : [value]),
  csrf: z.string().min(16).max(512),
  idempotencyKey: z.string().min(8).max(128),
}).passthrough();

const ImportFormSchema = SelectionFormSchema.extend({ householdId: z.string().min(8).max(128) });
const CreateHouseholdFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  csrf: z.string().min(16).max(512),
  idempotencyKey: z.string().min(8).max(128),
}).strict();
const MealMutationFormSchema = z.object({
  week: MondayDateSchema,
  csrf: z.string().min(16).max(512),
  idempotencyKey: IdempotencyKeySchema,
});
const ReviewMealConstraintsFormSchema = MealMutationFormSchema.extend({
  constraintRevision: GitObjectIdSchema,
}).strict();
const AddMealProposalFormSchema = MealMutationFormSchema.extend({
  mealDate: DateSchema,
  slotKind: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  title: z.string().trim().min(1).max(160),
  servings: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).transform((value) => value === "" ? null : value),
  notes: z.string().trim().max(500).transform((value) => value === "" ? null : value),
  constraintRevision: GitObjectIdSchema,
  constraintReviewEventId: MealPlanEventIdSchema,
}).strict();
const WithdrawMealProposalFormSchema = MealMutationFormSchema.extend({
  reason: z.string().trim().max(500).optional().transform((value) => value === undefined || value === "" ? null : value),
}).strict();
const JournalItemsQuerySchema = z.object({
  section: z.enum(["recipes", "groceries", "takeout"]),
  cursor: z.string().max(16).regex(/^v1_\d+$/).optional(),
  snapshotRevision: GitObjectIdSchema.optional(),
}).strict();

export async function registerWebExperience(app: FastifyInstance, experience: WebExperience): Promise<void> {
  const manifest = ManifestSchema.parse(JSON.parse(await readFile(resolve(experience.assetsRoot, ".vite/manifest.json"), "utf8")));
  const entry = manifest["index.html"];
  if (entry === undefined) throw new Error("The web build manifest has no index.html entry");

  await app.register(fastifyStatic, {
    root: resolve(experience.assetsRoot, "assets"),
    prefix: "/assets/",
    decorateReply: false,
    immutable: true,
    maxAge: "1y",
  });

  app.post<{ Params: { token: string } }>("/c/:token/import/plan", { config: { rateLimit: { max: 30, timeWindow: 15 * 60_000, groupId: "collection-import" } } }, async (request, reply) => {
    const form = SelectionFormSchema.parse(request.body);
    const context = await experience.contextFor(request);
    const selected = new Set(form.itemIds);
    const plannedContext = {
      ...context,
      publicCollection: { ...context.publicCollection, items: context.publicCollection.items.map((item) => ({ ...item, selected: selected.has(item.id) })) },
    };
    return sendWebPage(reply, request.url, plannedContext, entry.file, entry.css ?? [], true);
  });

  app.post<{ Params: { token: string } }>("/c/:token/import", { config: { rateLimit: { max: 30, timeWindow: 15 * 60_000, groupId: "collection-import" } } }, async (request, reply) => {
    if (experience.importCollection === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Browser import is not configured" } });
    const form = ImportFormSchema.parse(request.body);
    const result = await experience.importCollection(request, { token: request.params.token, ...form });
    return reply.redirect(`/households/${encodeURIComponent(result.householdId)}`, 303);
  });

  app.post("/households", { config: { rateLimit: { max: 10, timeWindow: 60 * 60_000, groupId: "household-create" } } }, async (request, reply) => {
    if (experience.createHousehold === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Browser household creation is not configured" } });
    const result = await experience.createHousehold(request, CreateHouseholdFormSchema.parse(request.body));
    return reply.redirect(`/households/${encodeURIComponent(result.householdId)}`, 303);
  });

  app.post<{ Params: { householdId: string } }>("/households/:householdId/meal-plan/review", async (request, reply) => {
    if (experience.reviewMealConstraints === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Browser meal planning is not configured" } });
    const form = ReviewMealConstraintsFormSchema.parse(request.body);
    await experience.reviewMealConstraints(request, { householdId: request.params.householdId, ...form });
    return reply.redirect(mealPlanRedirect(request.params.householdId, form.week, "constraints-reviewed", "constraint-review"), 303);
  });

  app.post<{ Params: { householdId: string } }>("/households/:householdId/meal-plan/proposals", async (request, reply) => {
    if (experience.addMealProposal === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Browser meal planning is not configured" } });
    const form = AddMealProposalFormSchema.parse(request.body);
    await experience.addMealProposal(request, { householdId: request.params.householdId, ...form });
    return reply.redirect(mealPlanRedirect(request.params.householdId, form.week, "proposal-added", slotAnchor(form.mealDate, form.slotKind)), 303);
  });

  app.post<{ Params: { householdId: string; proposalId: string } }>("/households/:householdId/meal-plan/proposals/:proposalId/withdraw", async (request, reply) => {
    if (experience.withdrawMealProposal === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Browser meal planning is not configured" } });
    const form = WithdrawMealProposalFormSchema.parse(request.body);
    const proposalId = MealProposalIdSchema.parse(request.params.proposalId);
    await experience.withdrawMealProposal(request, { householdId: request.params.householdId, proposalId, ...form });
    return reply.redirect(mealPlanRedirect(request.params.householdId, form.week, "proposal-withdrawn", "meal-week"), 303);
  });

  app.get<{ Params: { householdId: string } }>("/households/:householdId/journal-items", async (request, reply) => {
    if (experience.journalItems === undefined) return reply.code(501).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "Visual journal browsing is not configured" } });
    const query = JournalItemsQuerySchema.parse(request.query);
    const page = await experience.journalItems(request, {
      householdId: request.params.householdId,
      section: query.section,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.snapshotRevision === undefined ? {} : { snapshotRevision: query.snapshotRevision }),
    });
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    return reply.send(page);
  });

  app.get("/*", async (request, reply) => {
    if (!isWebPath(request.url)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route was not found" } });
    const requestUrl = new URL(request.url, "https://local.invalid");
    const context = await experience.contextFor(request);
    const privateJournal = requestUrl.pathname.endsWith("/recipes")
      || requestUrl.pathname.endsWith("/groceries")
      || requestUrl.pathname.endsWith("/takeout");
    if ((requestUrl.pathname === "/account" || requestUrl.pathname.endsWith("/meal-plan") || privateJournal) && context.viewer.displayName === "") {
      return reply.redirect(`/sign-in?returnTo=${encodeURIComponent(`${requestUrl.pathname}${requestUrl.search}`)}`, 303);
    }
    return sendWebPage(reply, request.url, context, entry.file, entry.css ?? [], request.url.startsWith("/c/") || request.url.startsWith("/invite/") || requestUrl.pathname.startsWith("/households/"));
  });
}

export function isMealPlanMutationPath(rawUrl: string): boolean {
  return /^\/households\/[^/]+\/meal-plan\/(?:review|proposals(?:\/[^/]+\/withdraw)?)$/
    .test(new URL(rawUrl, "https://local.invalid").pathname);
}

export function sendMealPlanMutationError(
  reply: import("fastify").FastifyReply,
  rawUrl: string,
  statusCode: number,
  message: string,
) {
  const householdId = /^\/households\/([^/]+)\/meal-plan\//.exec(new URL(rawUrl, "https://local.invalid").pathname)?.[1];
  const returnPath = householdId === undefined
    ? "/households"
    : `/households/${encodeURIComponent(householdId)}/meal-plan`;
  reply.header("content-type", "text/html; charset=utf-8");
  reply.header("cache-control", "no-store");
  reply.header("x-robots-tag", "noindex, nofollow");
  return reply.code(statusCode).send(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Meal plan update</title></head><body><main><h1>We could not update the meal plan</h1><p role="alert">${escapeText(message)}</p><p><a href="${escapeAttribute(returnPath)}">Return to the meal plan and try again</a></p></main></body></html>`);
}

function sendWebPage(reply: import("fastify").FastifyReply, url: string, context: WebRenderContext, script: string, styles: readonly string[], noIndex: boolean) {
  const rendered = renderWebRoute(url, context);
  reply.header("content-type", "text/html; charset=utf-8");
  reply.header("cache-control", "no-store");
  if (noIndex) reply.header("x-robots-tag", "noindex, nofollow");
  return reply.send(htmlDocument(rendered, context, script, styles));
}

function isWebPath(rawUrl: string): boolean {
  const path = new URL(rawUrl, "https://local.invalid").pathname;
  return path === "/" || ["/install", "/sign-in", "/authorize", "/households", "/account", "/about", "/company", "/privacy", "/terms", "/guides"].includes(path)
    || /^\/guides\/(?:whatsapp|household-invitations|collections\/(?:create|share))$/.test(path)
    || /^\/invite\/family\/[^/]+$/.test(path)
    || /^\/c\/[^/]+(?:\/import\/plan)?$/.test(path)
    || /^\/households\/[^/]+(?:\/(?:members|collections|meal-plan|recipes|groceries|takeout))?$/.test(path);
}

function mealPlanRedirect(householdId: string, week: string, changed: string, anchor: string): string {
  return `/households/${encodeURIComponent(householdId)}/meal-plan?week=${encodeURIComponent(week)}&changed=${encodeURIComponent(changed)}#${encodeURIComponent(anchor)}`;
}

function slotAnchor(mealDate: string, slotKind: string): string {
  return `slot-${mealDate}-${slotKind}`;
}

function htmlDocument(rendered: RenderedWebRoute, context: WebRenderContext, script: string, styles: readonly string[]): string {
  const serializedContext = JSON.stringify(context).replaceAll("<", "\\u003c");
  const links = styles.map((href) => `<link rel="stylesheet" href="/${escapeAttribute(href)}">`).join("");
  const metadata = rendered.metadata === undefined ? "" : metadataHtml(rendered.metadata);
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fbfaf6"><meta name="referrer" content="no-referrer"><title>${escapeText(rendered.title)}</title>${metadata}${links}</head><body><div id="root">${rendered.appHtml}</div><script id="web-context" type="application/json">${serializedContext}</script><script type="module" src="/${escapeAttribute(script)}"></script></body></html>`;
}

function metadataHtml(metadata: RenderedWebRoute["metadata"]): string {
  if (metadata === undefined) return "";
  const openGraph = metadata.openGraph;
  const structuredData = metadata.structuredDataJson === undefined
    ? ""
    : `<script type="application/ld+json">${metadata.structuredDataJson.replaceAll("<", "\\u003c")}</script>`;
  return [
    `<meta name="description" content="${escapeAttribute(metadata.description)}">`,
    `<link rel="canonical" href="${escapeAttribute(metadata.canonicalUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttribute(openGraph.siteName)}">`,
    `<meta property="og:title" content="${escapeAttribute(openGraph.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(openGraph.description)}">`,
    `<meta property="og:url" content="${escapeAttribute(openGraph.url)}">`,
    `<meta property="og:image" content="${escapeAttribute(openGraph.imageUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeAttribute(openGraph.imageAlt)}">`,
    structuredData,
  ].join("");
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}
