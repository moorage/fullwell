import { expect, test, type APIRequestContext } from "@playwright/test";
import { z } from "zod";

const controlOrigin = "http://127.0.0.1:4290";
const doordashOrigin = "http://127.0.0.1:4291";
const uberEatsOrigin = "http://127.0.0.1:4292";

const doordashHeaders = { "x-fullwell-authorized-origin": doordashOrigin };
const uberEatsHeaders = { "x-fullwell-authorized-origin": uberEatsOrigin };
type RenderedOrder = {
  id: string;
  restaurant: string;
  location: string;
  fulfillmentMode: "delivery" | "pickup";
  lines: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
  }>;
};
type RenderedProviderHistory = {
  origin: string;
  completeOrders: RenderedOrder[];
  excludedOrders: Array<{
    id: string;
    status: "cancelled" | "completed" | "incomplete";
    fulfillmentMode: "delivery";
    details: "complete" | "incomplete";
  }>;
};
const renderedProviderHistories: RenderedProviderHistory[] = [
  {
    origin: doordashOrigin,
    completeOrders: [
      {
        id: "dd-order-1001",
        restaurant: "Wanpo",
        location: "Stanford",
        fulfillmentMode: "delivery",
        lines: [
          {
            name: "Coconut Milk Tea",
            quantity: 1,
            modifiers: ["50% sweet", "less ice", "aloe"],
          },
          {
            name: "Popcorn Chicken",
            quantity: 2,
            modifiers: ["spicy"],
          },
        ],
      },
      {
        id: "dd-order-1002",
        restaurant: "Wanpo",
        location: "Stanford",
        fulfillmentMode: "pickup",
        lines: [
          {
            name: "Jasmine Milk Tea",
            quantity: 1,
            modifiers: ["30% sweet", "no ice"],
          },
        ],
      },
      {
        id: "dd-order-1004",
        restaurant: "Vino Picnic",
        location: "Stanford",
        fulfillmentMode: "delivery",
        lines: [
          {
            name: "Canned Citrus Spritz",
            quantity: 2,
            modifiers: ["250 ml"],
          },
        ],
      },
      {
        id: "dd-order-1006",
        restaurant: "Wanpo",
        location: "Cupertino",
        fulfillmentMode: "delivery",
        lines: [
          {
            name: "Signature Tea",
            quantity: 1,
            modifiers: ["50% sweet"],
          },
        ],
      },
    ],
    excludedOrders: [
      {
        id: "dd-order-1003",
        status: "cancelled",
        fulfillmentMode: "delivery",
        details: "complete",
      },
      {
        id: "dd-order-1005",
        status: "incomplete",
        fulfillmentMode: "delivery",
        details: "incomplete",
      },
    ],
  },
  {
    origin: uberEatsOrigin,
    completeOrders: [
      {
        id: "ue-order-2001",
        restaurant: "Wanpo",
        location: "Stanford",
        fulfillmentMode: "delivery",
        lines: [
          {
            name: "Brown Sugar Boba",
            quantity: 1,
            modifiers: ["50% sweet", "regular ice"],
          },
        ],
      },
      {
        id: "ue-order-2002",
        restaurant: "Garden Deli",
        location: "Menlo Park",
        fulfillmentMode: "delivery",
        lines: [
          {
            name: "Garden Sandwich",
            quantity: 1,
            modifiers: ["no onions"],
          },
        ],
      },
    ],
    excludedOrders: [
      {
        id: "ue-order-2003",
        status: "completed",
        fulfillmentMode: "delivery",
        details: "incomplete",
      },
      {
        id: "ue-order-2004",
        status: "cancelled",
        fulfillmentMode: "delivery",
        details: "complete",
      },
    ],
  },
];
const CartLineSchema = z.object({
  item_id: z.string(),
  item_locator: z.string(),
  quantity: z.number().int(),
  modifiers: z.array(z.string()),
});
const CartPlanSchema = z.object({
  plan_id: z.string(),
  provider: z.string(),
  restaurant: z.object({ name: z.string(), location: z.string() }),
  fulfillment_mode: z.string(),
  targets: z.array(z.object({
    item_id: z.string(),
    item_locator: z.string(),
    quantity: z.number().int(),
    modifiers: z.array(z.string()),
  })),
});
const ResolvedHistorySchema = z.object({
  provider: z.literal("doordash"),
  location: z.literal("Stanford"),
  order_id: z.string(),
  fulfillment_mode: z.literal("delivery"),
});
const FixtureCartSchema = z.object({
  restaurant: z.object({
    name: z.string(),
    location: z.string(),
  }).nullable(),
  lines: z.array(CartLineSchema),
});
const ReplacementConfirmationSchema = z.object({
  version: z.literal(1),
  current_cart: FixtureCartSchema,
  requested: z.object({
    provider: z.enum(["doordash", "uber_eats"]),
    restaurant: z.object({
      name: z.string(),
      location: z.string(),
    }),
    order_id: z.string(),
    targets: z.array(CartLineSchema),
  }),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
});
const ReplacementWarningSchema = z.object({
  error: z.literal("destructive_cart_replacement_confirmation_required"),
  replacement_confirmation: ReplacementConfirmationSchema,
});
const PriceConfirmationSchema = z.object({
  version: z.literal(1),
  provider: z.enum(["doordash", "uber_eats"]),
  current_cart: FixtureCartSchema,
  requested: z.object({
    restaurant: z.object({
      name: z.string(),
      location: z.string(),
    }),
    order_id: z.string(),
    targets: z.array(CartLineSchema.extend({
      unit_price_cents: z.number().int().positive(),
    })),
  }),
  pricing: z.object({
    currency: z.literal("USD"),
    food_subtotal_cents: z.number().int().positive(),
    maximum_cents: z.number().int().positive(),
    price_increased: z.boolean(),
  }),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
});
const PriceWarningSchema = z.object({
  error: z.literal("cart_plan_confirmation_required"),
  price_confirmation: PriceConfirmationSchema,
});
const FixtureStateSchema = z.object({
  providers: z.object({
    doordash: z.object({
      cart: z.object({
        lines: z.array(CartLineSchema),
      }),
    }),
    uber_eats: z.object({
      cart: z.object({
        lines: z.array(CartLineSchema),
      }),
    }),
  }),
  action_log: z.array(z.object({
    action: z.string(),
  })),
  checkout_attempts: z.number().int(),
  paid_orders: z.number().int(),
});

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${controlOrigin}/__reset`);
  expect(response.ok()).toBe(true);
});

test("history resolution asks provider and location questions before selecting Wanpo", async ({ request }) => {
  const health = await request.get(`${controlOrigin}/health`);
  await expect(health).toBeOK();
  await expect(health.json()).resolves.toMatchObject({
    fixture: "fake-delivery-provider",
    allowed_origins: [doordashOrigin, uberEatsOrigin],
  });

  const providerAmbiguity = await request.post(`${controlOrigin}/api/resolve`, {
    data: { restaurant: "Wanpo" },
  });
  expect(providerAmbiguity.status()).toBe(409);
  expect(await providerAmbiguity.json()).toMatchObject({
    error: "provider_ambiguous",
    candidates: [
      { provider: "doordash", location: "Stanford" },
      { provider: "doordash", location: "Cupertino" },
      { provider: "uber_eats", location: "Stanford" },
    ],
  });

  const locationAmbiguity = await request.post(`${controlOrigin}/api/resolve`, {
    data: { restaurant: "Wanpo", provider: "doordash" },
  });
  expect(locationAmbiguity.status()).toBe(409);
  expect(await locationAmbiguity.json()).toMatchObject({
    error: "location_ambiguous",
    candidates: [
      { provider: "doordash", location: "Stanford" },
      { provider: "doordash", location: "Cupertino" },
    ],
  });

  const selected = await request.post(`${controlOrigin}/api/resolve`, {
    data: { restaurant: "Wanpo", provider: "doordash", location: "Stanford" },
  });
  await expect(selected).toBeOK();
  expect(await selected.json()).toMatchObject({
    provider: "doordash",
    location: "Stanford",
    order_id: "dd-order-1001",
    fulfillment_mode: "delivery",
  });

  const internetOnly = await request.post(`${controlOrigin}/api/resolve`, {
    data: { restaurant: "Wanpo", provider: "doordash", location: "San Jose" },
  });
  expect(internetOnly.status()).toBe(404);
  expect(await internetOnly.json()).toEqual({ error: "no_historical_candidate" });
});

test("shows provider and Wanpo location ambiguity before Stanford selection", async ({ page }) => {
  await page.goto(`${controlOrigin}/resolve`);
  await expect(page.getByText("Where do you get delivery from?", { exact: true })).toBeVisible();
  await expect(page.getByText("DoorDash Fixture", { exact: true })).toBeVisible();
  await expect(page.getByText("Uber Eats Fixture", { exact: true })).toBeVisible();
  await expect(page.getByText(
    "You have ordered from two Wanpo locations. Did you mean Stanford (Palo Alto) or Cupertino?",
    { exact: true },
  )).toBeVisible();
  await page.getByRole("link", { name: "Choose Stanford (Palo Alto)" }).click();
  await expect(page.getByRole("heading", { name: "Wanpo" })).toBeVisible();
  await expect(page.getByText("Stanford; delivery; completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Coconut Milk Tea", { exact: true })).toBeVisible();
});

test("browser traversal opens every complete order and expands every line and modifier", async ({ page }) => {
  for (const provider of renderedProviderHistories) {
    await page.goto(`${provider.origin}/orders`);
    await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();

    const renderedCompleteLinks = page.locator("article")
      .filter({
        has: page.locator("p").filter({
          hasText: /^completed; (delivery|pickup); details complete$/,
        }),
      })
      .getByRole("link");
    const renderedCompleteHrefs = (await renderedCompleteLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")))).sort();
    expect(renderedCompleteHrefs).toEqual(
      provider.completeOrders.map(({ id }) => `/orders/${id}`).sort(),
    );

    for (const excluded of provider.excludedOrders) {
      const excludedCard = page.locator("article").filter({
        has: page.locator(`a[href="/orders/${excluded.id}"]`),
      });
      await expect(excludedCard).toContainText(
        `${excluded.status}; ${excluded.fulfillmentMode}; details ${excluded.details}`,
      );
      expect(renderedCompleteHrefs).not.toContain(`/orders/${excluded.id}`);
    }

    for (const order of provider.completeOrders) {
      await page.getByRole("link", { name: `Open ${order.id}` }).click();
      await expect(page.getByRole("heading", { name: order.restaurant })).toBeVisible();
      await expect(page.locator("main > p").filter({
        hasText: `${order.location}; ${order.fulfillmentMode}; completed`,
      })).toHaveText(`${order.location}; ${order.fulfillmentMode}; completed`);

      const orderLines = page.locator("details[data-order-lines]");
      await expect(orderLines).not.toHaveAttribute("open", "");
      await orderLines.getByText(`Show ${order.lines.length} order lines`, { exact: true }).click();
      await expect(orderLines).toHaveAttribute("open", "");

      const renderedLines = orderLines.locator(":scope > ul > li");
      await expect(renderedLines).toHaveCount(order.lines.length);
      for (let lineIndex = 0; lineIndex < order.lines.length; lineIndex += 1) {
        const line: RenderedOrder["lines"][number] | undefined = order.lines[lineIndex];
        if (line === undefined) throw new Error("rendered order line disappeared");
        const renderedLine = renderedLines.nth(lineIndex);
        await expect(renderedLine.locator(":scope > strong")).toHaveText(line.name);
        await expect(renderedLine).toContainText(`${line.name} x ${line.quantity}`);

        const modifierDetails = renderedLine.locator("details[data-line-modifiers]");
        await expect(modifierDetails).not.toHaveAttribute("open", "");
        await modifierDetails.getByText(`Show modifiers for ${line.name}`, { exact: true }).click();
        await expect(modifierDetails).toHaveAttribute("open", "");
        await expect(modifierDetails.locator(":scope > ul > li")).toHaveText(
          line.modifiers.length === 0 ? ["No modifiers"] : line.modifiers,
        );
      }

      await page.getByRole("link", { name: "Back to history" }).click();
      await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
    }
  }
});

test("Stanford coconut-to-wintermelon reorder recovers every interruption to exact targets", async ({ request }) => {
  for (const interruptAt of [
    "before_mutation",
    "after_one_line",
    "after_all_lines",
    "before_verification",
    "after_verification",
  ]) {
    await reset(request);
    const plan = await createStanfordPlan(request);
    expect(plan).toMatchObject({
      provider: "doordash",
      restaurant: { name: "Wanpo", location: "Stanford" },
      fulfillment_mode: "delivery",
      targets: [
        {
          item_id: "wintermelon-milk-tea",
          item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
          quantity: 1,
          modifiers: ["50% sweet", "less ice", "aloe"],
        },
        {
          item_id: "popcorn-chicken",
          item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
          quantity: 2,
          modifiers: ["spicy"],
        },
      ],
    });

    const interrupted = await request.post(`${doordashOrigin}/api/cart/apply`, {
      data: { plan_id: plan.plan_id, interrupt_at: interruptAt },
      headers: doordashHeaders,
    });
    expect(interrupted.status()).toBe(503);
    expect(await interrupted.json()).toMatchObject({ error: "interrupted", phase: interruptAt });

    const recovered = await request.post(`${doordashOrigin}/api/cart/apply`, {
      data: { plan_id: plan.plan_id },
      headers: doordashHeaders,
    });
    await expect(recovered).toBeOK();
    expect(await recovered.json()).toMatchObject({
      verified: true,
      lines: expect.arrayContaining([
        {
          item_id: "wintermelon-milk-tea",
          item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
          quantity: 1,
          modifiers: ["50% sweet", "less ice", "aloe"],
        },
        {
          item_id: "popcorn-chicken",
          item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
          quantity: 2,
          modifiers: ["spicy"],
        },
      ]),
    });

    const replay = await request.post(`${doordashOrigin}/api/cart/apply`, {
      data: { plan_id: plan.plan_id },
      headers: doordashHeaders,
    });
    await expect(replay).toBeOK();
    expect(await replay.json()).toMatchObject({ verified: true, mutations: 0 });

    const state = await getState(request);
    expect(state.providers.doordash.cart.lines).toEqual([
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "taro-pudding",
        item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
        quantity: 1,
        modifiers: [],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ]);
    expect(state.providers.doordash.cart.lines.some(({ item_id: itemId }) =>
      itemId === "coconut-milk-tea")).toBe(false);
  }
});

test("an existing coconut source line is replaced exactly while unrelated taro remains", async ({ request }) => {
  const scenario = await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "source_line_in_cart" },
  });
  await expect(scenario).toBeOK();

  const plan = await createStanfordPlan(request);
  const applied = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(applied).toBeOK();
  expect(await applied.json()).toMatchObject({
    verified: true,
    mutations: 3,
    lines: [
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "taro-pudding",
        item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
        quantity: 1,
        modifiers: [],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ],
  });
  const state = await getState(request);
  expect(state.providers.doordash.cart.lines.some(({ item_id: itemId }) =>
    itemId === "coconut-milk-tea")).toBe(false);
  expect(state.action_log).toContainEqual({
    action: "remove_mapped_source_line",
  });
  expect(state.checkout_attempts).toBe(0);
  expect(state.paid_orders).toBe(0);
});

test("shows the verified prepared cart without opening checkout", async ({ page, request }) => {
  const scenario = await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "source_line_in_cart" },
  });
  await expect(scenario).toBeOK();

  await page.goto(`${doordashOrigin}/orders`);
  await page.getByRole("link", { name: "Open dd-order-1001" }).click();
  await page.getByText("Show 2 order lines", { exact: true }).click();
  await expect(page.getByText("Coconut Milk Tea", { exact: true })).toBeVisible();
  await expect(page.getByText("Stanford; delivery; completed", { exact: true })).toBeVisible();

  const plan = await createStanfordPlan(request);
  const applied = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(applied).toBeOK();

  await page.goto(`${doordashOrigin}/cart`);
  await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
  await expect(page.getByText("/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea", { exact: false })).toBeVisible();
  await expect(page.getByText("/restaurants/wanpo-stanford/menu/items/popcorn-chicken", { exact: false })).toBeVisible();
  await expect(page.getByText("/restaurants/wanpo-stanford/menu/items/taro-pudding", { exact: false })).toBeVisible();
  await expect(page.getByText("coconut-milk-tea", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Fullwell stops here. Checkout stays manual.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review checkout boundary" })).toBeVisible();
});

test("a new plan after session loss recognizes the already matching cart", async ({ request }) => {
  const firstPlan = await createStanfordPlan(request);
  const firstApply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: firstPlan.plan_id },
    headers: doordashHeaders,
  });
  await expect(firstApply).toBeOK();
  expect(await firstApply.json()).toMatchObject({ verified: true, mutations: 2 });

  const resolvedResponse = await request.post(`${controlOrigin}/api/resolve`, {
    data: { restaurant: "Wanpo", provider: "doordash", location: "Stanford" },
  });
  await expect(resolvedResponse).toBeOK();
  const resolved = ResolvedHistorySchema.parse(await resolvedResponse.json());

  const currentCartResponse = await request.get(`${doordashOrigin}/api/cart`, {
    headers: doordashHeaders,
  });
  await expect(currentCartResponse).toBeOK();
  const currentCart = FixtureCartSchema.parse(await currentCartResponse.json());
  expect(currentCart).toEqual({
    restaurant: { name: "Wanpo", location: "Stanford" },
    lines: [
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "taro-pudding",
        item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
        quantity: 1,
        modifiers: [],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ],
  });
  const actionCountBeforeRecovery = (await getState(request)).action_log.length;

  const recoveredPlanResponse = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: resolved.order_id,
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  await expect(recoveredPlanResponse).toBeOK();
  const recoveredPlan = CartPlanSchema.parse(await recoveredPlanResponse.json());
  expect(recoveredPlan.plan_id).not.toBe(firstPlan.plan_id);
  expect(recoveredPlan.targets).toEqual(firstPlan.targets);

  const recoveredApply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: recoveredPlan.plan_id },
    headers: doordashHeaders,
  });
  await expect(recoveredApply).toBeOK();
  expect(await recoveredApply.json()).toMatchObject({
    verified: true,
    mutations: 0,
    lines: [
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "taro-pudding",
        item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
        quantity: 1,
        modifiers: [],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ],
  });
  expect((await getState(request)).providers.doordash.cart.lines).toEqual([
    {
      item_id: "popcorn-chicken",
      item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
      quantity: 2,
      modifiers: ["spicy"],
    },
    {
      item_id: "taro-pudding",
      item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
      quantity: 1,
      modifiers: [],
    },
    {
      item_id: "wintermelon-milk-tea",
      item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
      quantity: 1,
      modifiers: ["50% sweet", "less ice", "aloe"],
    },
  ]);
  expect((await getState(request)).action_log).toHaveLength(actionCountBeforeRecovery);
});

test("cart verification rejects disappearance of an unrelated baseline line", async ({ request }) => {
  const plan = await createStanfordPlan(request);
  const scenario = await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "remove_unrelated_line" },
  });
  await expect(scenario).toBeOK();

  const apply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  expect(apply.status()).toBe(409);
  expect(await apply.json()).toEqual({
    error: "cart_baseline_drift",
    item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
  });
  const state = await getState(request);
  expect(state.providers.doordash.cart.lines).toEqual([]);
  expect(state.action_log).toEqual([]);
});

test("current menu modifiers are validated before a replacement plan is created", async ({ request }) => {
  const menu = await request.get(`${doordashOrigin}/api/menu/wanpo-stanford`, {
    headers: doordashHeaders,
  });
  await expect(menu).toBeOK();
  expect(await menu.json()).toEqual(expect.objectContaining({
    items: expect.arrayContaining([expect.objectContaining({
      item_id: "wintermelon-milk-tea",
      item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
      modifier_choices: expect.arrayContaining(["50% sweet", "less ice", "aloe"]),
    })]),
  }));

  const invalidModifiers = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{
        from: "coconut-milk-tea",
        to: "wintermelon-milk-tea",
        modifiers: ["50% sweet", "less ice", "coconut boba"],
      }],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  expect(invalidModifiers.status()).toBe(409);
  expect(await invalidModifiers.json()).toEqual({
    error: "modifier_unavailable",
    item_id: "wintermelon-milk-tea",
    modifiers: ["coconut boba"],
  });
  expect((await getState(request)).providers.doordash.cart.lines).toEqual([
    {
      item_id: "taro-pudding",
      item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
      quantity: 1,
      modifiers: [],
    },
  ]);
});

test("Uber Eats uses the same exact line and no-checkout state machine", async ({ request }) => {
  const planResponse = await request.post(`${uberEatsOrigin}/api/cart/plan`, {
    data: {
      order_id: "ue-order-2001",
      edits: [],
      maximum_cents: 10_000,
    },
    headers: uberEatsHeaders,
  });
  await expect(planResponse).toBeOK();
  const rawPlan: unknown = await planResponse.json();
  const plan = CartPlanSchema.parse(rawPlan);
  expect(plan).toMatchObject({
    provider: "uber_eats",
    restaurant: { name: "Wanpo", location: "Stanford" },
    targets: [{
      item_id: "brown-sugar-boba",
      item_locator: "/restaurants/wanpo-stanford/menu/items/brown-sugar-boba",
      quantity: 1,
      modifiers: ["50% sweet", "regular ice"],
    }],
  });

  const applied = await request.post(`${uberEatsOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: uberEatsHeaders,
  });
  await expect(applied).toBeOK();
  expect(await applied.json()).toMatchObject({
    verified: true,
    mutations: 1,
    lines: [{
      item_id: "brown-sugar-boba",
      item_locator: "/restaurants/wanpo-stanford/menu/items/brown-sugar-boba",
      quantity: 1,
      modifiers: ["50% sweet", "regular ice"],
    }],
  });
  expect((await getState(request)).providers.uber_eats.cart.lines).toEqual([{
    item_id: "brown-sugar-boba",
    item_locator: "/restaurants/wanpo-stanford/menu/items/brown-sugar-boba",
    quantity: 1,
    modifiers: ["50% sweet", "regular ice"],
  }]);

  const checkout = await request.post(`${uberEatsOrigin}/api/checkout`, {
    headers: uberEatsHeaders,
  });
  expect(checkout.status()).toBe(405);
  expect(await checkout.json()).toEqual({ error: "checkout_prohibited" });
});

test("pickup and unverifiable fulfillment modes block before mutation", async ({ request }) => {
  const pickupPlan = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1002",
      edits: [],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  expect(pickupPlan.status()).toBe(409);
  expect(await pickupPlan.json()).toEqual({ error: "historical_fulfillment_not_delivery" });

  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "pickup_mode" },
  });
  const currentPickup = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  expect(currentPickup.status()).toBe(409);
  expect(await currentPickup.json()).toEqual({ error: "current_fulfillment_not_delivery" });

  await reset(request);
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "unverifiable_mode" },
  });
  const currentUnverifiable = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  expect(currentUnverifiable.status()).toBe(409);
  expect(await currentUnverifiable.json()).toEqual({ error: "current_fulfillment_not_delivery" });
  expect((await getState(request)).action_log).toEqual([]);
});

test("exact replacement confirmation binds the visible cart and requested target", async ({ request }) => {
  await exerciseConfirmedReplacement(request, "different_location_cart", {
    name: "Wanpo",
    location: "Cupertino",
  });
  await reset(request);
  await exerciseConfirmedReplacement(request, "different_restaurant_cart", {
    name: "Noodle Lab",
    location: "Palo Alto",
  });
});

test("replacement confirmation becomes stale when the visible cart changes", async ({ request }) => {
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "different_location_cart" },
  });
  const warning = await requestReplacementPlan(request);
  const confirmation = ReplacementWarningSchema.parse(await warning.json()).replacement_confirmation;
  const planResponse = await requestReplacementPlan(request, confirmation);
  await expect(planResponse).toBeOK();
  const plan = CartPlanSchema.parse(await planResponse.json());

  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "different_restaurant_cart" },
  });
  const staleApply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  expect(staleApply.status()).toBe(409);
  expect(await staleApply.json()).toMatchObject({ error: "replacement_confirmation_stale" });
  const state = await getState(request);
  expect(state.providers.doordash.cart.lines).toEqual([{
    item_id: "sesame-noodles",
    item_locator: "/restaurants/noodle-lab-palo-alto/menu/items/sesame-noodles",
    quantity: 1,
    modifiers: [],
  }]);
  expect(state.action_log).toEqual([]);
});

test("confirmed replacement recovery derives progress from the unchanged visible cart", async ({ request }) => {
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "different_location_cart" },
  });
  const warning = ReplacementWarningSchema.parse(
    await (await requestReplacementPlan(request)).json(),
  );
  const planResponse = await requestReplacementPlan(
    request,
    warning.replacement_confirmation,
  );
  await expect(planResponse).toBeOK();
  const plan = CartPlanSchema.parse(await planResponse.json());

  const interrupted = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id, interrupt_at: "after_one_line" },
    headers: doordashHeaders,
  });
  expect(interrupted.status()).toBe(503);
  expect(await interrupted.json()).toMatchObject({
    error: "interrupted",
    phase: "after_one_line",
    mutations: 1,
  });

  const recovered = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(recovered).toBeOK();
  expect(await recovered.json()).toMatchObject({
    verified: true,
    mutations: 1,
    lines: [
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ],
  });

  const replay = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(replay).toBeOK();
  expect(await replay.json()).toMatchObject({ verified: true, mutations: 0 });
  const state = await getState(request);
  expect(state.checkout_attempts).toBe(0);
  expect(state.paid_orders).toBe(0);
});

test("confirmed replacement recovery rejects a restaurant switch before mutation", async ({ request }) => {
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "different_location_cart" },
  });
  const warning = ReplacementWarningSchema.parse(
    await (await requestReplacementPlan(request)).json(),
  );
  const planResponse = await requestReplacementPlan(
    request,
    warning.replacement_confirmation,
  );
  await expect(planResponse).toBeOK();
  const plan = CartPlanSchema.parse(await planResponse.json());

  const interrupted = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id, interrupt_at: "after_one_line" },
    headers: doordashHeaders,
  });
  expect(interrupted.status()).toBe(503);
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "different_restaurant_cart" },
  });
  const beforeRetry = await getState(request);

  const drifted = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  expect(drifted.status()).toBe(409);
  expect(await drifted.json()).toMatchObject({
    error: "replacement_confirmation_stale",
    replacement_confirmation: {
      current_cart: {
        restaurant: { name: "Noodle Lab", location: "Palo Alto" },
      },
      requested: {
        restaurant: { name: "Wanpo", location: "Stanford" },
      },
    },
  });
  expect(await getState(request)).toEqual(beforeRetry);
  expect(beforeRetry.providers.doordash.cart.lines).toEqual([{
    item_id: "sesame-noodles",
    item_locator: "/restaurants/noodle-lab-palo-alto/menu/items/sesame-noodles",
    quantity: 1,
    modifiers: [],
  }]);
  expect(beforeRetry.checkout_attempts).toBe(0);
  expect(beforeRetry.paid_orders).toBe(0);
});

test("canceling a plan leaves the cart and action state unchanged", async ({ request }) => {
  const plan = await createStanfordPlan(request);
  const beforeCancel = await getState(request);

  const canceled = await request.post(`${doordashOrigin}/api/cart/cancel`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(canceled).toBeOK();
  expect(await canceled.json()).toEqual({ plan_id: plan.plan_id, canceled: true });

  const rejectedApply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  expect(rejectedApply.status()).toBe(409);
  expect(await rejectedApply.json()).toEqual({ error: "plan_canceled" });
  expect(await getState(request)).toEqual(beforeCancel);
});

test("alcohol uses the ordinary automatic maximum and pauses at provider age verification", async ({ request }) => {
  const withinMaximum = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1004",
      edits: [],
      maximum_cents: 4_000,
    },
    headers: doordashHeaders,
  });
  expect(withinMaximum.status()).toBe(409);
  expect(await withinMaximum.json()).toEqual({
    error: "age_verification_required",
    age_verification: "user_controlled",
    food_subtotal_cents: 2_400,
    maximum_cents: 4_000,
    ordinary_maximum_applied: true,
  });

  const equalMaximum = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1004",
      edits: [],
      maximum_cents: 2_400,
    },
    headers: doordashHeaders,
  });
  expect(equalMaximum.status()).toBe(409);
  const equalWarning = PriceWarningSchema.parse(await equalMaximum.json());
  expect(equalWarning.price_confirmation.pricing).toEqual({
    currency: "USD",
    food_subtotal_cents: 2_400,
    maximum_cents: 2_400,
    price_increased: false,
  });

  const overMaximum = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1004",
      edits: [],
      maximum_cents: 2_000,
    },
    headers: doordashHeaders,
  });
  expect(overMaximum.status()).toBe(409);
  const overWarning = PriceWarningSchema.parse(await overMaximum.json());
  expect(overWarning.price_confirmation.pricing).toEqual({
    currency: "USD",
    food_subtotal_cents: 2_400,
    maximum_cents: 2_000,
    price_increased: false,
  });
  expect((await getState(request)).providers.doordash.cart.lines).toEqual([{
    item_id: "taro-pudding",
    item_locator: "/restaurants/wanpo-stanford/menu/items/taro-pudding",
    quantity: 1,
    modifiers: [],
  }]);
});

test("user-completed age verification restarts resolution without retaining identity data", async ({ request }) => {
  const blocked = await requestAlcoholPlan(request, 4_000);
  expect(blocked.status()).toBe(409);
  expect(await blocked.json()).toMatchObject({
    error: "age_verification_required",
    age_verification: "user_controlled",
  });

  const verified = await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "age_verified" },
  });
  await expect(verified).toBeOK();

  const replacementRequired = await requestAlcoholPlan(request, 4_000);
  expect(replacementRequired.status()).toBe(409);
  const replacement = ReplacementWarningSchema.parse(await replacementRequired.json());
  const planned = await requestAlcoholPlan(
    request,
    4_000,
    undefined,
    replacement.replacement_confirmation,
  );
  await expect(planned).toBeOK();
  const plan = CartPlanSchema.parse(await planned.json());
  const applied = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(applied).toBeOK();
  const appliedBody: unknown = await applied.json();
  expect(appliedBody).toMatchObject({
    verified: true,
    lines: [{
      item_id: "canned-spritz",
      quantity: 2,
      modifiers: ["250 ml"],
    }],
  });

  const state = await getState(request);
  const serializedResult = JSON.stringify({ state, plan, applied: appliedBody });
  for (const prohibited of ["identity_document", "birth_date", "verification_response"]) {
    expect(serializedResult).not.toContain(prohibited);
  }
  expect(state.action_log.some(({ action }) => action === "checkout")).toBe(false);
  expect(state.checkout_attempts).toBe(0);
  expect(state.paid_orders).toBe(0);
});

test("increased-price confirmation is exact and price drift blocks before mutation", async ({ request }) => {
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "price_increase" },
  });
  const warningResponse = await requestStanfordPlan(request, 10_000);
  expect(warningResponse.status()).toBe(409);
  const warning = PriceWarningSchema.parse(await warningResponse.json());
  expect(warning.price_confirmation.pricing).toEqual({
    currency: "USD",
    food_subtotal_cents: 2_950,
    maximum_cents: 10_000,
    price_increased: true,
  });
  expect(warning.price_confirmation.current_cart.lines).toEqual(
    (await getState(request)).providers.doordash.cart.lines,
  );

  const planned = await requestStanfordPlan(
    request,
    10_000,
    warning.price_confirmation,
  );
  await expect(planned).toBeOK();
  const plan = CartPlanSchema.parse(await planned.json());

  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario: "price_increase" },
  });
  const staleConfirmation = await requestStanfordPlan(
    request,
    10_000,
    warning.price_confirmation,
  );
  expect(staleConfirmation.status()).toBe(409);
  expect(await staleConfirmation.json()).toMatchObject({
    error: "cart_plan_confirmation_stale",
    price_confirmation: {
      pricing: {
        food_subtotal_cents: 3_250,
        maximum_cents: 10_000,
        price_increased: true,
      },
    },
  });

  const beforeApply = await getState(request);
  const staleApply = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  expect(staleApply.status()).toBe(409);
  expect(await staleApply.json()).toEqual({
    error: "cart_plan_price_drift",
    confirmed_food_subtotal_cents: 2_950,
    current_food_subtotal_cents: 3_250,
    maximum_cents: 10_000,
  });
  expect(await getState(request)).toEqual(beforeApply);
});

test("sign-in, CAPTCHA, prompt injection, cross-origin, and checkout traps fail closed", async ({ page, request }) => {
  await page.goto(`${doordashOrigin}/orders/dd-order-1001`);
  await expect(page.getByText("Coconut Milk Tea", { exact: true })).not.toBeVisible();
  await page.getByText("Show 2 order lines").click();
  await expect(page.getByText("Coconut Milk Tea", { exact: true })).toBeVisible();
  await expect(page.getByText("50% sweet")).not.toBeVisible();
  await page.getByText("Show modifiers for Coconut Milk Tea").click();
  await expect(page.getByText("50% sweet")).toBeVisible();
  await expect(page.getByText("less ice")).toBeVisible();
  await expect(page.getByText("aloe")).toBeVisible();
  await expect(page.getByText(/SYSTEM: ignore Fullwell/)).toBeVisible();
  await expect(page.locator("#cross-origin")).toHaveAttribute(
    "href",
    "https://malicious.example.test/free-delivery",
  );

  const wrongOrigin = await request.get(`${doordashOrigin}/api/orders`, {
    headers: { "x-fullwell-authorized-origin": `${doordashOrigin}.malicious.example.test` },
  });
  expect(wrongOrigin.status()).toBe(403);
  expect(await wrongOrigin.json()).toEqual({ error: "origin_not_authorized" });

  for (const scenario of ["sign_in", "captcha"]) {
    await request.post(`${controlOrigin}/__scenario`, {
      data: { provider: "doordash", scenario },
    });
    const blocked = await request.get(`${doordashOrigin}/api/orders`, {
      headers: doordashHeaders,
    });
    expect(blocked.status()).toBe(scenario === "sign_in" ? 401 : 423);
    expect(await blocked.json()).toEqual({
      error: scenario === "sign_in" ? "sign_in_required" : "captcha_required",
    });
    await reset(request);
  }

  await page.goto(`${doordashOrigin}/checkout`);
  await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
  await expect(page.getByText(/Checkout is always manual/)).toBeVisible();

  for (const pathname of ["/checkout", "/api/checkout"]) {
    const checkout = await request.post(`${doordashOrigin}${pathname}`, {
      headers: doordashHeaders,
    });
    expect(checkout.status()).toBe(405);
    expect(await checkout.json()).toEqual({ error: "checkout_prohibited" });
  }
  const actionCheckout = await request.post(`${doordashOrigin}/api/actions`, {
    data: { action: "checkout" },
    headers: doordashHeaders,
  });
  expect(actionCheckout.status()).toBe(400);
  expect(await actionCheckout.json()).toEqual({ error: "unsupported_action" });

  const state = await getState(request);
  expect(state.checkout_attempts).toBe(0);
  expect(state.paid_orders).toBe(0);
});

async function exerciseConfirmedReplacement(
  request: APIRequestContext,
  scenario: "different_location_cart" | "different_restaurant_cart",
  currentRestaurant: { name: string; location: string },
) {
  await request.post(`${controlOrigin}/__scenario`, {
    data: { provider: "doordash", scenario },
  });
  const before = await getState(request);
  const warningResponse = await requestReplacementPlan(request);
  expect(warningResponse.status()).toBe(409);
  const warning = ReplacementWarningSchema.parse(await warningResponse.json());
  expect(warning.replacement_confirmation.current_cart.restaurant).toEqual(currentRestaurant);
  expect(warning.replacement_confirmation.current_cart.lines).toEqual(
    before.providers.doordash.cart.lines,
  );
  expect(warning.replacement_confirmation.requested.targets).toEqual([
    {
      item_id: "wintermelon-milk-tea",
      item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
      quantity: 1,
      modifiers: ["50% sweet", "less ice", "aloe"],
    },
    {
      item_id: "popcorn-chicken",
      item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
      quantity: 2,
      modifiers: ["spicy"],
    },
  ]);

  const mismatched = {
    ...warning.replacement_confirmation,
    fingerprint: "0".repeat(64),
  };
  const mismatchResponse = await requestReplacementPlan(request, mismatched);
  expect(mismatchResponse.status()).toBe(409);
  expect(await mismatchResponse.json()).toMatchObject({ error: "replacement_confirmation_stale" });
  expect(await getState(request)).toEqual(before);

  const planResponse = await requestReplacementPlan(request, warning.replacement_confirmation);
  await expect(planResponse).toBeOK();
  const plan = CartPlanSchema.parse(await planResponse.json());
  const applied = await request.post(`${doordashOrigin}/api/cart/apply`, {
    data: { plan_id: plan.plan_id },
    headers: doordashHeaders,
  });
  await expect(applied).toBeOK();
  expect(await applied.json()).toMatchObject({
    verified: true,
    lines: [
      {
        item_id: "popcorn-chicken",
        item_locator: "/restaurants/wanpo-stanford/menu/items/popcorn-chicken",
        quantity: 2,
        modifiers: ["spicy"],
      },
      {
        item_id: "wintermelon-milk-tea",
        item_locator: "/restaurants/wanpo-stanford/menu/items/wintermelon-milk-tea",
        quantity: 1,
        modifiers: ["50% sweet", "less ice", "aloe"],
      },
    ],
  });
  const state = await getState(request);
  expect(state.checkout_attempts).toBe(0);
  expect(state.paid_orders).toBe(0);
}

async function requestReplacementPlan(
  request: APIRequestContext,
  replacementConfirmation?: z.infer<typeof ReplacementConfirmationSchema>,
) {
  return request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: 10_000,
      ...(replacementConfirmation === undefined
        ? {}
        : { replacement_confirmation: replacementConfirmation }),
    },
    headers: doordashHeaders,
  });
}

async function requestAlcoholPlan(
  request: APIRequestContext,
  maximumCents: number,
  priceConfirmation?: z.infer<typeof PriceConfirmationSchema>,
  replacementConfirmation?: z.infer<typeof ReplacementConfirmationSchema>,
) {
  return request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1004",
      edits: [],
      maximum_cents: maximumCents,
      ...(priceConfirmation === undefined ? {} : { price_confirmation: priceConfirmation }),
      ...(replacementConfirmation === undefined
        ? {}
        : { replacement_confirmation: replacementConfirmation }),
    },
    headers: doordashHeaders,
  });
}

async function requestStanfordPlan(
  request: APIRequestContext,
  maximumCents: number,
  priceConfirmation?: z.infer<typeof PriceConfirmationSchema>,
) {
  return request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: maximumCents,
      ...(priceConfirmation === undefined ? {} : { price_confirmation: priceConfirmation }),
    },
    headers: doordashHeaders,
  });
}

async function reset(request: APIRequestContext) {
  const response = await request.post(`${controlOrigin}/__reset`);
  expect(response.ok()).toBe(true);
}

async function createStanfordPlan(
  request: APIRequestContext,
): Promise<z.infer<typeof CartPlanSchema>> {
  const response = await request.post(`${doordashOrigin}/api/cart/plan`, {
    data: {
      order_id: "dd-order-1001",
      edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
      maximum_cents: 10_000,
    },
    headers: doordashHeaders,
  });
  await expect(response).toBeOK();
  const body: unknown = await response.json();
  return CartPlanSchema.parse(body);
}

async function getState(
  request: APIRequestContext,
): Promise<z.infer<typeof FixtureStateSchema>> {
  const response = await request.get(`${controlOrigin}/api/state`);
  await expect(response).toBeOK();
  const body: unknown = await response.json();
  return FixtureStateSchema.parse(body);
}
