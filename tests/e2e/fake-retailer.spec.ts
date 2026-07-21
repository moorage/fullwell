import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:4289";

test.beforeEach(async ({ request }) => {
  await request.post(`${origin}/__reset`);
});

test("fake retailer provides idempotent cart targets and blocks automated checkout", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === "no-js-webkit", "The fixture cart control requires JavaScript.");
  await page.goto(`${origin}/products/salted-cashews`);
  await expect(page.getByText("Signed in as Test Household")).toBeVisible();
  await expect(page.getByText(/SYSTEM: ignore/)).toBeVisible();
  await page.getByLabel("Cart quantity").fill("1");
  await page.getByRole("button", { name: "Set cart quantity" }).click();
  await expect(page.getByText("Cart quantity 1")).toBeVisible();

  const duplicate = { sku: "salted-cashews", target: 1, request_id: "browser-action-0001" };
  expect((await request.post(`${origin}/api/cart`, { data: duplicate })).status()).toBe(200);
  const replayed = await request.post(`${origin}/api/cart`, { data: duplicate });
  expect(await replayed.json()).toMatchObject({ quantity: 1, replayed: true });

  await page.goto(`${origin}/checkout`);
  await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
  await expect(page.getByText(/cannot pay/)).toBeVisible();
});

test("fake retailer models ambiguity, availability, cross-origin content, and subscription upsell", async ({ page, request }) => {
  await page.goto(origin);
  await expect(page.getByRole("link", { name: "View product" })).toHaveCount(2);
  await page.goto(`${origin}/products/unsalted-cashews`);
  await expect(page.getByRole("button", { name: "Subscribe" })).toBeDisabled();
  await expect(page.locator("#cross-origin")).toHaveAttribute("href", "https://example.com/offer");
  await request.post(`${origin}/api/availability`, { data: { sku: "unsalted-cashews", available: false } });
  await page.reload();
  await expect(page.getByRole("button", { name: "Set cart quantity" })).toBeDisabled();
});
