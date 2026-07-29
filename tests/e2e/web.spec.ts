import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  demoWebContext,
  groceryVisualJournalFixture,
  recipeVisualJournalFixture,
  takeoutVisualJournalFixture,
} from "../../apps/web/src/fixtures.js";
import type { VisualJournalPage, WebRenderContext } from "../../apps/web/src/types.js";

test("serves a responsive, keyboard-usable install experience", async ({ page }, testInfo) => {
  const response = await page.goto("/install");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Your household assistant for keeping the pantry full and meals organized" })).toBeVisible();
  await expect(page.getByText("Fullwell by Sous Chef Studio")).toBeVisible();
  await expect(page.getByText(/household-assistant product developed and operated by Sous Chef Studio, Inc/)).toBeVisible();
  await expect(page.locator(".install-hero__character-image")).toBeVisible();
  await expect(page.locator(".install-hero__character-image")).toHaveAttribute("alt", "");
  await expect(page.locator(".install-hero__character-image")).toHaveAttribute("width", "1046");
  await expect(page.locator(".install-hero__character-image")).toHaveAttribute("height", "1044");
  await expect(page.locator(".install-hero__character-image")).toHaveAttribute("src", "/assets/fullwell-full-body-tall.png?v=696d8325");
  expect(
    await page.locator(".install-hero__character").evaluate((element) =>
      getComputedStyle(element, "::before").content),
  ).toBe("none");
  await expect(page.locator(".wordmark__face")).toBeVisible();
  await expect(page.locator(".wordmark__face")).toHaveAttribute("alt", "");
  await expect(page.locator(".wordmark")).toHaveAccessibleName("Fullwell");
  if (testInfo.project.name === "desktop-webkit") {
    const chooser = await page.getByRole("group", { name: "Choose your agent" }).boundingBox();
    expect(chooser, "The desktop agent chooser should be rendered").not.toBeNull();
    expect((chooser?.y ?? 900) + (chooser?.height ?? 0), "The desktop agent chooser should remain above the fold").toBeLessThan(900);
  }

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

test("serves crawlable Fullwell company and WhatsApp identity", async ({ page, request }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const initialHtml = await response?.text();
  expect(initialHtml).toContain("Fullwell");
  expect(initialHtml).toContain("household assistant");
  expect(initialHtml).toContain("Sous Chef Studio, Inc.");
  expect(initialHtml).toContain("WhatsApp");

  await expect(page).toHaveTitle("Fullwell Household Assistant | By Sous Chef Studio");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://127.0.0.1:4187/");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Fullwell");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Fullwell Household Assistant");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", "http://127.0.0.1:4187/assets/fullwell-social-card.png");
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute("href", "/assets/fullwell-icon-32.png");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/assets/fullwell-icon-180.png");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/site.webmanifest");
  const structuredDataText = await page.locator('script[type="application/ld+json"]').textContent();
  const structuredData = z.object({
    "@graph": z.array(z.object({ "@type": z.string(), name: z.string() }).passthrough()),
  }).parse(JSON.parse(structuredDataText ?? ""));
  expect(structuredData["@graph"]).toEqual(expect.arrayContaining([
    expect.objectContaining({ "@type": "Organization", name: "Sous Chef Studio, Inc." }),
    expect.objectContaining({
      "@type": "WebApplication",
      name: "Fullwell",
      image: "http://127.0.0.1:4187/assets/fullwell-icon.png",
      thumbnailUrl: "http://127.0.0.1:4187/assets/fullwell-icon.png",
      brand: expect.objectContaining({
        "@type": "Brand",
        name: "Fullwell",
        logo: "http://127.0.0.1:4187/assets/fullwell-icon.png",
      }),
    }),
  ]));

  const whatsapp = page.getByRole("region", { name: "Use Fullwell from WhatsApp" });
  await expect(whatsapp).toContainText("WhatsApp is an optional communication channel for Fullwell.");
  await expect(page.getByRole("link", { name: "About Fullwell", exact: true })).toHaveAttribute("href", "/about");
  await expect(page.getByRole("link", { name: "Support", exact: true })).toHaveAttribute("href", "mailto:support@fullwell.ai");
  await expect(page.locator(".wordmark")).toHaveText("Fullwell");
  await expect(page.locator(".wordmark__face")).toHaveAttribute("src", "/assets/fullwell-icon.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  for (const route of ["/about", "/company", "/privacy", "/terms"]) {
    const publicResponse = await page.goto(route);
    expect(publicResponse?.status(), route).toBe(200);
    await expect(page.locator("body"), route).toContainText("Fullwell");
    await expect(page.locator("body"), route).toContainText("Sous Chef Studio, Inc.");
    await expect(page.locator('link[rel="canonical"]'), route).toHaveCount(1);
  }
  const imageAssets = [
    ["/assets/fullwell-full-body-tall.png", "696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189", 1046, 1044],
    ["/assets/fullwell-icon.png", "696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189", 1046, 1044],
    ["/assets/fullwell-icon-16.png", "45512f1a7a52f9e1b224737bfdb9a5ca96efbd00cb855c1e2c90ccf7588bdd4a", 16, 16],
    ["/assets/fullwell-icon-32.png", "f74327507cacbb993fd78dce43b6b76a1178bf7086cdc5ac32d5ef37032020b4", 32, 32],
    ["/assets/fullwell-icon-180.png", "3f71ff3935344e09e5be29a6b3956cd7117383d2a69727d0f952f6513aec09a8", 180, 180],
    ["/assets/fullwell-icon-192.png", "b2c23626a8f13cd74b60c2f124d68a467f8c80b5de5cc425a50dde7cbbd48734", 192, 192],
    ["/assets/fullwell-icon-512.png", "50a821d69d20ea588d7ef7bdc69ee0d5bd36b1a457b859775ae104b3b243bd5b", 512, 512],
    ["/assets/fullwell-social-card.png", "5a22ec1452c8af2d3a2cb251e8ec816f37255ef0e9a8e2c80bff1306fea13160", 1200, 630],
  ] as const;
  for (const [path, expectedSha256, width, height] of imageAssets) {
    const asset = await request.get(path);
    expect(asset.status(), path).toBe(200);
    expect(asset.headers()["content-type"], path).toContain("image/png");
    if (path === "/assets/fullwell-full-body-tall.png") {
      expect(asset.headers()["cache-control"], path).toBe("public, max-age=3600, must-revalidate");
    }
    const body = await asset.body();
    expect(createHash("sha256").update(body).digest("hex"), path).toBe(expectedSha256);
    expect(body.readUInt32BE(16), `${path} width`).toBe(width);
    expect(body.readUInt32BE(20), `${path} height`).toBe(height);
  }
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toContain("image/x-icon");
  expect(createHash("sha256").update(await favicon.body()).digest("hex")).toBe("a9572c2e06d06c19ce9452d44ed1616b2c0fcd1b88e5595e911e8066ca83c97b");
  const siteManifest = await request.get("/site.webmanifest");
  expect(siteManifest.status()).toBe(200);
  expect(siteManifest.headers()["content-type"]).toContain("application/manifest+json");
  expect(await siteManifest.json()).toMatchObject({
    name: "Fullwell",
    icons: [
      { src: "/assets/fullwell-icon-192.png", sizes: "192x192" },
      { src: "/assets/fullwell-icon-512.png", sizes: "512x512" },
    ],
  });
  await page.goto("/");
  await page.screenshot({ path: testInfo.outputPath("fullwell-public-identity.png"), fullPage: true });
});

test("renders the advanced guide hub and direct workflow destinations", async ({ page }, testInfo) => {
  const response = await page.goto("/guides");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Do more with Fullwell" })).toBeVisible();
  const destinations = [
    ["/guides/whatsapp", "Connect WhatsApp"],
    ["/guides/household-name", "Name your household"],
    ["/guides/household-invitations", "Invite household members"],
    ["/guides/collections/create", "Create a collection"],
    ["/guides/collections/share", "Share a collection"],
  ] as const;
  for (const [href, name] of destinations) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("guide-hub.png"), fullPage: true });

  await page.goto("/guides/household-name");
  await expect(page.getByRole("heading", { name: "Name your household" })).toBeVisible();
  await expect(page.getByText("“Rename our household to Garden Table.”")).toBeVisible();
  await expect(page.getByText(/Only a household owner/)).toBeVisible();

  await page.goto("/guides/collections/share");
  await expect(page.getByRole("heading", { name: "Share a collection" })).toBeVisible();
  await expect(page.getByText("“Share my Weeknight favorites collection for 7 days.”")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("guide-share-collection.png"), fullPage: true });
});

test("lets an owner rename a household from a hover-revealed, focused dialog", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-webkit", "One hydrated desktop browser proves the complete rename mutation");
  const createdResponse = await page.request.post("/api/tools/hfj_create_household", {
    headers: { authorization: "Bearer test-owner-token" },
    data: { name: "E2E Rename Kitchen", idempotency_key: "e2e-household-rename-create-0001" },
  });
  expect(createdResponse.status()).toBe(200);
  const created = z.object({
    data: z.object({ household_id: z.string() }),
  }).parse(await createdResponse.json());
  await page.setExtraHTTPHeaders({ authorization: "Bearer test-owner-token" });
  await page.goto(`/households/${created.data.household_id}`);
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "Edit household name" });
  await expect(trigger).toHaveCSS("opacity", "0");
  await page.getByRole("heading", { name: "E2E Rename Kitchen" }).hover({ position: { x: 4, y: 4 } });
  await expect(trigger).toHaveCSS("opacity", "1");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Change household name" });
  const nameInput = dialog.getByRole("textbox", { name: "Household name" });
  await expect(dialog).toBeVisible();
  await expect(nameInput).toBeFocused();
  expect(await nameInput.evaluate((input: HTMLInputElement) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
    value: input.value,
  }))).toEqual({ start: 0, end: "E2E Rename Kitchen".length, value: "E2E Rename Kitchen" });
  await nameInput.fill("Garden Table");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(page).toHaveURL(new RegExp(`/households/${created.data.household_id}\\?renamed=1#household-name$`));
  await expect(page.getByRole("heading", { name: "Garden Table" })).toBeVisible();
});

test("keeps a direct household rename form when JavaScript is disabled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-webkit", "The no-JavaScript project proves the server-rendered fallback");
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const rendered = renderWebRoute("/households/alvarez-home", demoWebContext);
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
  const fallback = page.locator("form.household-name-fallback");
  await expect(fallback.getByRole("textbox", { name: "Change household name" })).toHaveValue("Alvarez home");
  await expect(fallback.getByRole("button", { name: "Save name" })).toBeVisible();
  await expect(fallback.locator('input[name="expectedHead"]')).toHaveValue("a".repeat(40));
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
  const deleteButton = page.getByRole("button", { name: "Delete cloud account" });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Delete your Fullwell cloud account?" });
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
    {
      route: `/households/${takeoutVisualJournalFixture.householdId}/takeout`,
      page: { ...takeoutVisualJournalFixture, items: takeoutVisualJournalFixture.items.slice(0, 12), nextCursor: "v1_12" },
      heading: "Delivery & takeout in Alvarez home",
      loadMore: "Load more takeout items",
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

test("automatically appends snapshot-bound takeout pages without collapsing locations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-webkit", "One hydrated browser proves automatic continuation across two batches");
  const [{ renderWebRoute }, manifest] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/dist/.vite/manifest.json", import.meta.url), "utf8").then((value) =>
      JSON.parse(value) as Record<string, { file: string; css?: string[] }>),
  ]);
  const entry = manifest["index.html"];
  if (entry === undefined) throw new Error("web manifest entry missing");
  const initial: VisualJournalPage = {
    ...takeoutVisualJournalFixture,
    items: takeoutVisualJournalFixture.items.slice(0, 12),
    nextCursor: "v1_12",
  };
  const renderContext: WebRenderContext = { ...demoWebContext, visualJournal: initial };
  const routePath = `/households/${initial.householdId}/takeout`;
  const rendered = renderWebRoute(routePath, renderContext);
  const serializedContext = JSON.stringify(renderContext).replace(/</g, "\\u003c");
  const links = (entry.css ?? []).map((href) => `<link rel="stylesheet" href="/${href}">`).join("");
  const requestedCursors: string[] = [];
  await page.route(`**${routePath}`, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${links}</head><body><div id="root">${rendered.appHtml}</div><script id="web-context" type="application/json">${serializedContext}</script><script type="module" src="/${entry.file}"></script></body></html>`,
    });
  });
  await page.route("**/journal-items?*", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor") ?? "";
    requestedCursors.push(cursor);
    const pageBody = cursor === "v1_12"
      ? { ...takeoutVisualJournalFixture, items: takeoutVisualJournalFixture.items.slice(12, 24), nextCursor: "v1_24" }
      : { ...takeoutVisualJournalFixture, items: takeoutVisualJournalFixture.items.slice(24), nextCursor: null };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(pageBody) });
  });

  await page.goto(routePath);
  await expect(page.getByRole("heading", { name: "Delivery & takeout in Alvarez home" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Wintermelon boba" })).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.getByText("Palo Alto, CA")).toBeVisible();
  await expect(page.getByText("Cupertino, CA")).toBeVisible();
  await page.locator(".journal-loader").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Truffle fries" })).toBeVisible();
  await page.locator(".journal-loader").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Canned citrus spritz" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("reached the end");
  expect(requestedCursors).toEqual(["v1_12", "v1_24"]);
});
