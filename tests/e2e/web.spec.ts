import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoWebContext, groceryVisualJournalFixture, recipeVisualJournalFixture } from "../../apps/web/src/fixtures.js";

test("serves a responsive, keyboard-usable install experience", async ({ page }, testInfo) => {
  const response = await page.goto("/install");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Your household food journal, in the agent you already use" })).toBeVisible();

  if (testInfo.project.name !== "no-js-webkit") {
    await expect(page.getByRole("link", { name: "Start Fullwell setup" })).toHaveAttribute("href", /^codex:\/\/new\?prompt=/);
    await expect(page.getByText("@Fullwell hi")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("install-codex.png"), fullPage: true });
    await page.getByRole("button", { name: "Use with Claude" }).click();
    await expect(page.getByRole("heading", { name: "Install for Claude" })).toBeVisible();
    await expect(page.getByText("Hi Fullwell.")).toBeVisible();
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

test("renders the advanced guide hub and direct workflow destinations", async ({ page }, testInfo) => {
  const response = await page.goto("/guides");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Do more with Fullwell in chat" })).toBeVisible();
  const destinations = [
    ["/guides/whatsapp", "Connect WhatsApp"],
    ["/guides/household-invitations", "Invite household members"],
    ["/guides/collections/create", "Create a collection"],
    ["/guides/collections/share", "Share a collection"],
  ] as const;
  for (const [href, name] of destinations) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("guide-hub.png"), fullPage: true });

  await page.goto("/guides/collections/share");
  await expect(page.getByRole("heading", { name: "Share a collection" })).toBeVisible();
  await expect(page.getByText("“Share my Weeknight favorites collection for 7 days.”")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("guide-share-collection.png"), fullPage: true });
});

test("renders unknown capability links without private fixture data", async ({ page }) => {
  const response = await page.goto("/c/not-a-real-token");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(response?.headers()["cache-control"]).toBe("no-store");
  await expect(page.getByRole("heading", { name: "We could not open this collection" })).toBeVisible();
  await expect(page.getByText("Alvarez home")).toHaveCount(0);
});

test("renders public delivery dishes with accessible location and no private order authority", async ({ page }, testInfo) => {
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const rendered = renderWebRoute("/c/summer-table-7Qc9", demoWebContext);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
  await expect(page.getByRole("heading", { name: "Delivery dishes" })).toBeVisible();
  await expect(page.getByText("Wanpo")).toBeVisible();
  await expect(page.getByText("Stanford")).toBeVisible();
  const publicAddress = page.getByText("Palo Alto, CA");
  await expect(publicAddress).toHaveCount(2);
  await expect(publicAddress.first()).toBeVisible();
  await expect(page.getByText("Alcohol")).toBeVisible();
  const wintermelon = page.getByRole("checkbox", { name: /Wintermelon boba/ });
  await wintermelon.focus();
  await expect(wintermelon).toBeFocused();
  await expect(page.locator("body")).not.toContainText(/provider origin|order locator|merchant locator|menu locator|reorder authority/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("collection-delivery-320.png"), fullPage: true });
  if (testInfo.project.name !== "no-js-webkit") {
    await page.getByRole("heading", { name: "Delivery dishes" }).scrollIntoViewIfNeeded();
  }
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
  await expect(page.locator('input[name="confirmation"]')).toHaveCount(
    testInfo.project.name === "no-js-webkit" ? demoWebContext.households.length + 1 : 0,
  );
  await page.getByText("Advanced export").dispatchEvent("click");
  await expect(page.getByRole("button", { name: /history bundle/ })).toHaveCount(demoWebContext.households.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("account-exports.png"), fullPage: true });
});

test("uses a cancellable dialog for destructive Account actions", async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({ authorization: "Bearer test-owner-token" });
  const response = await page.goto("/account");
  expect(response?.status()).toBe(200);

  if (testInfo.project.name === "no-js-webkit") {
    const deleteSection = page.locator("section.danger-zone");
    const typedFallback = deleteSection.locator('input[name="confirmation"]');
    await expect(typedFallback).toBeVisible();
    expect(await typedFallback.evaluate((input) => input.parentElement?.textContent)).toContain("Type DELETE to continue");
    return;
  }

  await page.waitForLoadState("networkidle");
  await expect(page.locator('input[name="confirmation"]')).toHaveCount(0);
  const deleteButton = page.getByRole("button", { name: "Delete account" });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Delete your Fullwell account?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(deleteButton).toBeFocused();

  await deleteButton.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(deleteButton).toBeFocused();
});

test("renders WhatsApp setup, confirmation, and linked runner states without provider identifiers", async ({ page }, testInfo) => {
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const states = [
    { kind: "setup", availableThroughLabel: "Sep 30, 2026", deviceId: "dev_fixture", householdId: "hsh_fixture", deviceName: "Kitchen Mac" },
    { kind: "pending_confirmation", availableThroughLabel: "Sep 30, 2026", linkId: "lnk_fixture", deviceId: "dev_fixture", householdId: "hsh_fixture", deviceName: "Kitchen Mac", confirmationExpiresLabel: "in 8 minutes" },
    { kind: "linked", availableThroughLabel: "Sep 30, 2026", deviceId: "dev_fixture", householdId: "hsh_fixture", deviceName: "Kitchen Mac", lastSeenLabel: null },
  ] as const;

  for (const state of states) {
    const rendered = renderWebRoute("/account", { ...demoWebContext, messaging: state });
    await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
    await expect(page.getByRole("heading", { name: "WhatsApp", exact: true })).toBeVisible();
    await expect(page.getByText("Kitchen Mac")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\+?1?[ .-]?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`account-whatsapp-${state.kind}.png`), fullPage: true });
  }
});

test("renders visual journal prefixes with accessible load-more fallbacks", async ({ page }, testInfo) => {
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const fixtures = [
    {
      route: `/households/${recipeVisualJournalFixture.householdId}/recipes`,
      page: { ...recipeVisualJournalFixture, items: recipeVisualJournalFixture.items.slice(0, 12), nextCursor: "v1_12" },
      heading: "Recipes in Alvarez home",
      loadMore: "Load more recipes",
    },
    {
      route: `/households/${groceryVisualJournalFixture.householdId}/groceries`,
      page: { ...groceryVisualJournalFixture, items: groceryVisualJournalFixture.items.slice(0, 12), nextCursor: "v1_12" },
      heading: "Groceries in Alvarez home",
      loadMore: "Load more groceries",
    },
  ] as const;
  for (const fixture of fixtures) {
    const rendered = renderWebRoute(fixture.route, { ...demoWebContext, visualJournal: fixture.page });
    await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
    await expect(page.getByRole("heading", { name: fixture.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: fixture.loadMore })).toHaveAttribute("href", "?page=2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`${fixture.page.section}.png`), fullPage: true });
  }
});
