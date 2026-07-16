import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { renderWebRoute } from "@hfj/web/server";
import type { WebRenderContext } from "@hfj/web/types";
import { z } from "zod";

const ManifestSchema = z.record(z.string(), z.object({
  file: z.string().min(1),
  css: z.array(z.string().min(1)).optional(),
}));

export interface WebExperience {
  readonly assetsRoot: string;
  contextFor(request: FastifyRequest): Promise<WebRenderContext>;
  importCollection?(request: FastifyRequest, input: WebImportInput): Promise<{ householdId: string }>;
}

export type WebImportInput = {
  readonly token: string;
  readonly householdId: string;
  readonly itemIds: readonly string[];
  readonly csrf: string;
  readonly idempotencyKey: string;
};

const SelectionFormSchema = z.object({
  itemIds: z.union([z.string(), z.array(z.string())]).transform((value) => Array.isArray(value) ? value : [value]),
  csrf: z.string().min(16).max(512),
  idempotencyKey: z.string().min(8).max(128),
}).passthrough();

const ImportFormSchema = SelectionFormSchema.extend({ householdId: z.string().min(8).max(128) });

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

  app.get("/*", async (request, reply) => {
    if (!isWebPath(request.url)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route was not found" } });
    const context = await experience.contextFor(request);
    if (new URL(request.url, "https://local.invalid").pathname === "/account" && context.viewer.displayName === "") {
      return reply.redirect("/sign-in?returnTo=%2Faccount", 303);
    }
    return sendWebPage(reply, request.url, context, entry.file, entry.css ?? [], request.url.startsWith("/c/") || request.url.startsWith("/invite/"));
  });
}

function sendWebPage(reply: import("fastify").FastifyReply, url: string, context: WebRenderContext, script: string, styles: readonly string[], noIndex: boolean) {
  const rendered = renderWebRoute(url, context);
  reply.header("content-type", "text/html; charset=utf-8");
  reply.header("cache-control", "no-store");
  if (noIndex) reply.header("x-robots-tag", "noindex, nofollow");
  return reply.send(htmlDocument(rendered.title, rendered.appHtml, context, script, styles));
}

function isWebPath(rawUrl: string): boolean {
  const path = new URL(rawUrl, "https://local.invalid").pathname;
  return path === "/" || ["/install", "/sign-in", "/authorize", "/households", "/account", "/privacy", "/terms"].includes(path)
    || /^\/invite\/family\/[^/]+$/.test(path)
    || /^\/c\/[^/]+(?:\/import\/plan)?$/.test(path)
    || /^\/households\/[^/]+(?:\/(?:members|collections))?$/.test(path);
}

function htmlDocument(title: string, appHtml: string, context: WebRenderContext, script: string, styles: readonly string[]): string {
  const serializedContext = JSON.stringify(context).replaceAll("<", "\\u003c");
  const links = styles.map((href) => `<link rel="stylesheet" href="/${escapeAttribute(href)}">`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fbfaf6"><meta name="referrer" content="no-referrer"><title>${escapeText(title)}</title>${links}</head><body><div id="root">${appHtml}</div><script id="web-context" type="application/json">${serializedContext}</script><script type="module" src="/${escapeAttribute(script)}"></script></body></html>`;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}
