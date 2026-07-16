import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoWebContext } from "../../apps/web/src/fixtures.js";

test("serves a responsive, keyboard-usable install experience", async ({ page }, testInfo) => {
  const response = await page.goto("/install");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Your household food journal, in the agent you already use" })).toBeVisible();

  if (testInfo.project.name !== "no-js-webkit") {
    await page.getByRole("button", { name: "Use with Claude" }).click();
    await expect(page.getByRole("heading", { name: "Install for Claude" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Use with Claude" })).toBeVisible();
  }

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("install.png"), fullPage: true });
});

test("renders unknown capability links without private fixture data", async ({ page }) => {
  const response = await page.goto("/c/not-a-real-token");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(response?.headers()["cache-control"]).toBe("no-store");
  await expect(page.getByRole("heading", { name: "We could not open this collection" })).toBeVisible();
  await expect(page.getByText("Alvarez home")).toHaveCount(0);
});

test("renders account exports without overflow and exposes the advanced bundle option", async ({ page }, testInfo) => {
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const rendered = renderWebRoute("/account", demoWebContext);
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
  await expect(page.getByRole("heading", { name: "Household exports" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download ZIP" })).toHaveCount(demoWebContext.households.length);
  await page.getByText("Advanced export").dispatchEvent("click");
  await expect(page.getByRole("button", { name: /history bundle/ })).toHaveCount(demoWebContext.households.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("account-exports.png"), fullPage: true });
});
