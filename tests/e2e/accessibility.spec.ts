import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoWebContext, groceryVisualJournalFixture, recipeVisualJournalFixture } from "../../apps/web/src/fixtures.js";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const publicRoutes = [
  "/install",
  "/guides",
  "/guides/whatsapp",
  "/guides/household-invitations",
  "/guides/collections/create",
  "/guides/collections/share",
  "/sign-in",
  "/privacy",
  "/terms",
  "/c/not-a-real-token",
];
const renderedRoutes = [
  "/authorize",
  "/invite/family/invite-fixture",
  `/c/${demoWebContext.publicCollection.token}`,
  `/c/${demoWebContext.publicCollection.token}/import/plan`,
  "/households",
  `/households/${demoWebContext.households[0]?.id ?? "missing"}`,
  `/households/${demoWebContext.households[0]?.id ?? "missing"}/meal-plan?week=2026-07-20`,
  `/households/${demoWebContext.households[0]?.id ?? "missing"}/members`,
  `/households/${demoWebContext.households[0]?.id ?? "missing"}/collections`,
  "/account",
];
const visualRoutes = [
  {
    route: `/households/${demoWebContext.households[0]?.id ?? "missing"}/recipes`,
    context: { ...demoWebContext, visualJournal: recipeVisualJournalFixture },
  },
  {
    route: `/households/${demoWebContext.households[0]?.id ?? "missing"}/groceries`,
    context: { ...demoWebContext, visualJournal: groceryVisualJournalFixture },
  },
];

async function expectNoWcagViolations(page: Page, route: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(result.violations, `${route}: ${result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ")}`).toEqual([]);
}

test("public routes have no automated WCAG A/AA violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "no-js-webkit", "axe requires script injection; the no-JavaScript project has separate interaction coverage");
  for (const route of publicRoutes) {
    await page.goto(route);
    await expectNoWcagViolations(page, route);
  }
});

test("authenticated and pending-intent screens have no automated WCAG A/AA violations", async ({ page }, testInfo) => {
  test.skip(!["desktop-webkit", "narrow-webkit"].includes(testInfo.project.name), "The semantic screen matrix runs at desktop and 320 CSS pixels");
  const { renderWebRoute } = await import("../../apps/web/dist/server/server.js");
  const styles = await readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8");
  for (const route of renderedRoutes) {
    const rendered = renderWebRoute(route, demoWebContext);
    await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${rendered.title}</title><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
    await expectNoWcagViolations(page, route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), `${route} overflows horizontally`).toBe(false);
  }
  for (const { route, context } of visualRoutes) {
    const rendered = renderWebRoute(route, context);
    await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${rendered.title}</title><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
    await expectNoWcagViolations(page, route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), `${route} overflows horizontally`).toBe(false);
  }
});

test("reduced motion removes meaningful page animation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-webkit", "One browser project proves the CSS media-query contract");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/install");
  const style = await page.locator(".page-band").evaluate((element) => {
    const computed = getComputedStyle(element);
    return { animationDuration: computed.animationDuration, scrollBehavior: computed.scrollBehavior };
  });
  expect(Number.parseFloat(style.animationDuration)).toBeLessThanOrEqual(0.01);
  expect(style.scrollBehavior).toBe("auto");
});
