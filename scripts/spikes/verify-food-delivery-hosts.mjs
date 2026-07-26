import { spawn } from "node:child_process";
import { once } from "node:events";

if (!process.argv.includes("--fake-provider")) {
  throw new Error("Use --fake-provider; live delivery-provider verification requires separate authorization");
}

const ports = {
  control: 4390,
  doordash: 4391,
  uberEats: 4392,
};
const origins = {
  control: `http://127.0.0.1:${ports.control}`,
  doordash: `http://127.0.0.1:${ports.doordash}`,
  uberEats: `http://127.0.0.1:${ports.uberEats}`,
};
const child = spawn(process.execPath, ["tests/fixtures/fake-delivery-provider/server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FAKE_DELIVERY_CONTROL_PORT: String(ports.control),
    FAKE_DELIVERY_DOORDASH_PORT: String(ports.doordash),
    FAKE_DELIVERY_UBER_EATS_PORT: String(ports.uberEats),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const childExit = once(child, "exit");

try {
  await waitForHealth();
  const health = await fetchJson(`${origins.control}/health`);
  assertDeepEqual(
    health.allowed_origins,
    [origins.doordash, origins.uberEats],
    "The fixture must advertise only the two exact provider origins",
  );

  const hostResults = [];
  for (const hostName of ["codex", "claude"]) {
    let fetchCalls = 0;
    const policy = hostName === "codex"
      ? createCodexWorkflowAdapter(health.allowed_origins)
      : createClaudeWorkflowAdapter(health.allowed_origins);
    const countedFetch = (...args) => {
      fetchCalls += 1;
      return fetch(...args);
    };
    const authorized = await policy.fetch(
      `${origins.doordash}/api/orders`,
      { capability: "read_provider" },
      {
        headers: { "x-fullwell-authorized-origin": origins.doordash },
        signal: AbortSignal.timeout(2_000),
      },
      countedFetch,
    );
    if (!authorized.ok) throw new Error(`${hostName} policy did not authorize the exact DoorDash fixture origin`);
    const history = await authorized.json();
    const selectedOrder = history.orders.find((order) =>
      order.status === "completed"
      && order.fulfillment_mode === "delivery"
      && order.restaurant.name === "Wanpo"
      && order.restaurant.location === "Stanford");
    if (selectedOrder === undefined) throw new Error(`${hostName} workflow did not resolve history`);
    const orderPageResult = await policy.fetch(
      `${origins.doordash}/orders/${encodeURIComponent(selectedOrder.order_id)}`,
      { capability: "read_provider" },
      { signal: AbortSignal.timeout(2_000) },
      countedFetch,
    );
    const orderHtml = await orderPageResult.text();
    const expandedDetails = policy.expandOrderDetails(orderHtml);
    const coconutLine = selectedOrder.lines.find((line) => line.item_id === "coconut-milk-tea");
    if (expandedDetails.lineCount !== selectedOrder.lines.length
      || expandedDetails.modifierGroups !== selectedOrder.lines.length
      || coconutLine?.modifiers.join("|") !== "50% sweet|less ice|aloe") {
      throw new Error(`${hostName} workflow did not expand and reconcile complete order details`);
    }
    const planResponse = await policy.fetch(
      `${origins.doordash}/api/cart/plan`,
      { capability: "plan_cart" },
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fullwell-authorized-origin": origins.doordash,
        },
        body: JSON.stringify({
          order_id: selectedOrder.order_id,
          edits: [{ from: "coconut-milk-tea", to: "wintermelon-milk-tea" }],
          maximum_cents: 10_000,
          replacement_confirmed: false,
        }),
        signal: AbortSignal.timeout(2_000),
      },
      countedFetch,
    );
    if (!planResponse.ok) throw new Error(`${hostName} workflow could not prepare a bounded plan`);
    const plan = await planResponse.json();
    const applyResponse = await policy.fetch(
      `${origins.doordash}/api/cart/apply`,
      { capability: "apply_cart_plan" },
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fullwell-authorized-origin": origins.doordash,
        },
        body: JSON.stringify({ plan_id: plan.plan_id }),
        signal: AbortSignal.timeout(2_000),
      },
      countedFetch,
    );
    if (!applyResponse.ok || (await applyResponse.json()).verified !== true) {
      throw new Error(`${hostName} workflow did not verify the prepared cart`);
    }

    const callsBeforeRedirectTrap = fetchCalls;
    await assertRejects(
      () => policy.fetch(
        `${origins.doordash}/redirect-chain`,
        { capability: "read_provider" },
        { signal: AbortSignal.timeout(2_000) },
        countedFetch,
      ),
      "origin_not_authorized",
    );
    if (fetchCalls !== callsBeforeRedirectTrap + 2) {
      throw new Error(`${hostName} policy fetched the cross-origin redirect target`);
    }

    const callsAfterAuthorizedFetch = fetchCalls;
    await assertRejects(
      () => policy.fetch(
        `http://127.0.0.1.malicious.example.test:${ports.doordash}/api/orders`,
        { capability: "read_provider" },
        {},
        countedFetch,
      ),
      "origin_not_authorized",
    );
    await assertRejects(
      () => policy.fetch(
        `${origins.doordash}/checkout`,
        { capability: "read_provider" },
        { method: "POST" },
        countedFetch,
      ),
      "action_not_authorized",
    );
    await assertRejects(
      () => policy.fetch(
        `${origins.doordash}/orders`,
        { capability: "checkout" },
        {},
        countedFetch,
      ),
      "action_not_authorized",
    );
    for (const unsafe of [
      { url: `${origins.doordash}/payment`, capability: "read_provider" },
      { url: `${origins.doordash}/membership`, capability: "read_provider" },
      { url: `${origins.doordash}/subscription`, capability: "read_provider" },
      { url: `${origins.doordash}/age-verification`, capability: "read_provider" },
      { url: `${origins.doordash}/identity`, capability: "read_provider" },
      { url: `${origins.doordash}/orders`, capability: "shell" },
      { url: `${origins.doordash}/orders`, capability: "search" },
      { url: `${origins.doordash}/orders`, capability: "broaden_tools" },
    ]) {
      await assertRejects(
        () => policy.fetch(unsafe.url, { capability: unsafe.capability }, {}, countedFetch),
        "action_not_authorized",
      );
    }
    await assertRejects(
      () => policy.fetch(
        `${origins.doordash}/orders/dd-order-1001`,
        { capability: "read_provider", embeddedInstruction: true },
        {},
        countedFetch,
      ),
      "action_not_authorized",
    );
    if (fetchCalls !== callsAfterAuthorizedFetch) {
      throw new Error(`${hostName} policy performed a fetch after rejecting authority`);
    }
    hostResults.push({
      host: hostName,
      policy: "passed",
      denied_before_fetch: true,
      redirect_denied_before_followup: true,
    });
  }

  const deceptiveOrigin = await fetch(`${origins.doordash}/api/orders`, {
    headers: { "x-fullwell-authorized-origin": `${origins.doordash}.malicious.example.test` },
    signal: AbortSignal.timeout(2_000),
  });
  if (deceptiveOrigin.status !== 403) throw new Error("The provider boundary accepted a deceptive authority value");

  const orderPage = await fetch(`${origins.doordash}/orders/dd-order-1001`, {
    signal: AbortSignal.timeout(2_000),
  }).then((response) => response.text());
  const crossOrigin = orderPage.match(/id="cross-origin" href="([^"]+)"/)?.[1];
  if (crossOrigin === undefined) throw new Error("The provider fixture did not expose its cross-origin trap");
  if (health.allowed_origins.includes(new URL(crossOrigin).origin)) {
    throw new Error("The cross-origin trap was included in provider authority");
  }

  for (const pathname of ["/checkout", "/api/checkout"]) {
    const response = await fetch(`${origins.doordash}${pathname}`, {
      method: "POST",
      headers: { "x-fullwell-authorized-origin": origins.doordash },
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status !== 405) throw new Error(`${pathname} did not structurally prohibit checkout`);
  }
  const actionCheckout = await fetch(`${origins.doordash}/api/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fullwell-authorized-origin": origins.doordash,
    },
    body: JSON.stringify({ action: "checkout" }),
    signal: AbortSignal.timeout(2_000),
  });
  if (actionCheckout.status !== 400) throw new Error("The generic action API accepted checkout");

  const state = await fetchJson(`${origins.control}/api/state`);
  if (state.checkout_attempts !== 0 || state.paid_orders !== 0 || state.redirect_followups !== 0) {
    throw new Error("The fixture recorded a prohibited checkout or redirect side effect");
  }

  process.stdout.write(`${JSON.stringify({
    fake_provider: "passed",
    exact_origins: health.allowed_origins,
    host_policy_harness: hostResults,
    cross_origin: "blocked",
    checkout: "structurally_prohibited",
    live_doordash: "not_run",
    live_uber_eats: "not_run",
  })}\n`);
} finally {
  child.kill("SIGTERM");
  await childExit;
}

async function waitForHealth() {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origins.control}/health`, {
        signal: AbortSignal.timeout(250),
      });
      if (response.ok) return;
    } catch {
      // Startup connection failures are expected until all three fixture listeners are ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the fake delivery provider");
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error(`Fixture request failed: ${response.status} ${url}`);
  return response.json();
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function createCodexWorkflowAdapter(allowedOrigins) {
  return createWorkflowAdapter("codex", allowedOrigins, new Set([
    "read_provider",
    "plan_cart",
    "apply_cart_plan",
    "cancel_cart_plan",
  ]));
}

function createClaudeWorkflowAdapter(allowedOrigins) {
  return createWorkflowAdapter("claude", allowedOrigins, new Set([
    "read_provider",
    "plan_cart",
    "apply_cart_plan",
    "cancel_cart_plan",
  ]));
}

function createWorkflowAdapter(hostName, allowedOrigins, allowedCapabilities) {
  const exactOrigins = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
  const forbiddenPath = /(?:^|\/)(?:checkout|payment|pay|place-order|schedule|tip|address|membership|subscription|age(?:-verification)?|identity)(?:\/|$)/u;
  return {
    async fetch(url, request, init, fetcher) {
      if (!allowedCapabilities.has(request.capability)) throw new Error("action_not_authorized");
      if (request.embeddedInstruction === true) throw new Error("action_not_authorized");
      let requestedUrl = new URL(url);
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        if (!exactOrigins.has(requestedUrl.origin)) throw new Error("origin_not_authorized");
        if (forbiddenPath.test(requestedUrl.pathname)) throw new Error("action_not_authorized");
        const response = await fetcher(requestedUrl, { ...init, redirect: "manual" });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get("location");
        if (location === null) throw new Error("redirect_location_missing");
        requestedUrl = new URL(location, requestedUrl);
      }
      throw new Error("redirect_limit_exceeded");
    },
    expandOrderDetails(html) {
      const lineGroup = html.match(/<details data-order-lines>[\s\S]*?<\/details>/u);
      if (lineGroup === null) throw new Error("order_lines_not_expandable");
      return {
        lineCount: (html.match(/<li><strong>/gu) ?? []).length,
        modifierGroups: (html.match(/<details data-line-modifiers>/gu) ?? []).length,
      };
    },
    hostName,
  };
}

async function assertRejects(operation, expectedMessage) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${expectedMessage}`);
}
