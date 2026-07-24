import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoWebContext } from "../../apps/web/src/fixtures.js";
import { z } from "zod";

test("the connected week keeps every same-slot proposal visible at responsive widths", async ({ page }, testInfo) => {
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const householdId = demoWebContext.households[0]?.id;
  if (householdId === undefined) throw new Error("meal-planning household fixture missing");
  const route = `/households/${householdId}/meal-plan?week=2026-07-20`;
  const rendered = renderWebRoute(route, demoWebContext);
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);

  const mondayLunch = page.getByRole("region", { name: "Monday, July 20 lunch" });
  await expect(mondayLunch.getByRole("heading", { name: "Egg salad sandwich" })).toBeVisible();
  await expect(mondayLunch.getByRole("heading", { name: "Pizza" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /day,/ })).toHaveCount(7);
  await expect(page.getByText("Needs review against the current household constraints")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add meal idea" })).toBeVisible();
  expect(await page.getByRole("button", { name: "Add meal idea" }).evaluate((button) => button.closest("form")?.method)).toBe("post");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  await page.getByRole("button", { name: "Add meal idea" }).focus();
  await expect(page.getByRole("button", { name: "Add meal idea" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("connected-meal-week.png"), fullPage: true });
});

test("the no-JavaScript week preserves ordinary forms and a complete empty week", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-webkit", "The no-JavaScript contract runs once");
  const [{ renderWebRoute }, styles] = await Promise.all([
    import("../../apps/web/dist/server/server.js"),
    readFile(new URL("../../apps/web/src/styles.css", import.meta.url), "utf8"),
  ]);
  const mealPlan = demoWebContext.mealPlan;
  const householdId = demoWebContext.households[0]?.id;
  if (mealPlan === null || householdId === undefined) throw new Error("meal-planning fixture missing");
  const emptyContext = {
    ...demoWebContext,
    mealPlan: {
      ...mealPlan,
      proposalCount: 0,
      days: mealPlan.days.map((day) => ({
        ...day,
        slots: day.slots.map((slot) => ({ ...slot, proposals: [] })),
      })),
    },
  };
  const rendered = renderWebRoute(`/households/${householdId}/meal-plan?week=2026-07-20`, emptyContext);
  await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${rendered.appHtml}</body></html>`);
  await expect(page.getByText("No meals have been proposed yet.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /day,/ })).toHaveCount(7);
  await expect(page.locator(`form[action="/households/${householdId}/meal-plan/proposals"][method="post"]`)).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("two authenticated browser principals can add different proposals from the same initial week", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-webkit", "The live two-principal race runs once");
  const browser = page.context().browser();
  if (browser === null) throw new Error("browser fixture missing");
  const ownerAuthorization = "Bearer test-owner-token";
  const editorAuthorization = "Bearer test-member-token";
  const callTool = async (authorization: string, name: string, data: Record<string, unknown>) => {
    const response = await request.post(`/api/tools/${name}`, {
      headers: { authorization },
      data,
    });
    if (!response.ok()) throw new Error(`${name}: ${await response.text()}`);
    return z.object({
      ok: z.literal(true),
      data: z.record(z.string(), z.json()),
      repository_head: z.string(),
    }).passthrough().parse(await response.json());
  };
  const suffix = "desktop-webkit";
  const created = await callTool(ownerAuthorization, "hfj_create_household", {
    name: "Browser Race Kitchen",
    idempotency_key: `browser-race-household-${suffix}`,
  });
  const householdId = z.object({ household_id: z.string() }).parse(created.data).household_id;
  const invitation = await callTool(ownerAuthorization, "hfj_create_family_invite", {
    household_id: householdId,
    role: "editor",
    expires_in_days: 7,
    expected_head: created.repository_head,
    idempotency_key: `browser-race-invite-${suffix}`,
  });
  const invitationUrl = z.object({ url: z.url() }).parse(invitation.data).url;
  const invitationToken = /\/invite\/family\/([^/?#]+)$/.exec(invitationUrl)?.[1];
  if (invitationToken === undefined) throw new Error("browser race invitation token missing");
  const accepted = await callTool(editorAuthorization, "hfj_accept_family_invite", {
    token: invitationToken,
    accept: true,
    idempotency_key: `browser-race-accept-${suffix}`,
  });
  const constraints = await callTool(ownerAuthorization, "hfj_update_meal_planning_constraints", {
    household_id: householdId,
    expected_head: accepted.repository_head,
    idempotency_key: `browser-race-constraints-${suffix}`,
    constraints: {
      status: "confirmed_none",
      time_zone: "America/Los_Angeles",
      reviewed_at: "2026-07-20T16:00:00.000Z",
    },
  });
  const constraintRevision = z.object({ constraint_revision: z.string() }).parse(constraints.data).constraint_revision;
  await callTool(ownerAuthorization, "hfj_review_meal_constraints", {
    household_id: householdId,
    week_start: "2026-07-20",
    constraint_revision: constraintRevision,
    idempotency_key: `browser-race-review-${suffix}`,
  });

  const ownerContext = await browser.newContext({ extraHTTPHeaders: { authorization: ownerAuthorization } });
  const editorContext = await browser.newContext({ extraHTTPHeaders: { authorization: editorAuthorization } });
  try {
    const ownerPage = await ownerContext.newPage();
    const editorPage = await editorContext.newPage();
    const weekUrl = `/households/${householdId}/meal-plan?week=2026-07-20`;
    await Promise.all([ownerPage.goto(weekUrl), editorPage.goto(weekUrl)]);
    for (const page of [ownerPage, editorPage]) {
      await page.locator('select[name="mealDate"]').selectOption("2026-07-20");
      await page.locator('select[name="slotKind"]').selectOption("lunch");
    }
    await ownerPage.locator('input[name="title"]').fill("Egg salad sandwich");
    await editorPage.locator('input[name="title"]').fill("Pizza");
    await Promise.all([
      ownerPage.waitForURL(/changed=proposal-added/),
      editorPage.waitForURL(/changed=proposal-added/),
      ownerPage.getByRole("button", { name: "Add meal idea" }).click(),
      editorPage.getByRole("button", { name: "Add meal idea" }).click(),
    ]);
    expect(ownerPage.url()).toContain("#slot-2026-07-20-lunch");
    await expect(ownerPage.getByRole("status")).toContainText("selected date and slot");
    expect(await ownerPage.evaluate(() => document.activeElement?.id)).toBe("slot-2026-07-20-lunch");
    await ownerPage.goto(weekUrl);
    const mondayLunch = ownerPage.getByRole("region", { name: "Monday, July 20 lunch" });
    await expect(mondayLunch.getByRole("heading", { name: "Egg salad sandwich" })).toBeVisible();
    await expect(mondayLunch.getByRole("heading", { name: "Pizza" })).toBeVisible();
  } finally {
    await Promise.all([ownerContext.close(), editorContext.close()]);
  }
});
