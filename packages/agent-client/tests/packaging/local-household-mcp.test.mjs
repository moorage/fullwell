import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  handleLocalHouseholdMcpMessage,
  serveLocalHouseholdMcp,
} from "../../runtime/local-household-mcp.mjs";
import { localHouseholdPath } from "../../runtime/local-household.mjs";

async function withLocalRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-local-mcp-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function call(root, id, name, args = {}) {
  return await handleLocalHouseholdMcpMessage(root, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

function parsedToolContent(response) {
  return JSON.parse(response.result.content[0].text);
}

test("the local MCP server exposes stable, truthful tool identities", async () => {
  const initialized = await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  });
  assert.deepEqual(initialized.result.serverInfo, { name: "fullwell-local", version: "1" });

  const listed = await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
    "fullwell_local_profile_load",
    "fullwell_local_profile_update",
    "fullwell_local_household_load",
    "fullwell_local_household_update",
    "fullwell_local_household_delete_collecting",
    "fullwell_local_recipe_board_create",
    "fullwell_local_whatsapp_runner_stop",
  ]);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.result.tools[1].annotations.destructiveHint, false);
  assert.equal(listed.result.tools[4].annotations.destructiveHint, true);
  assert.equal(listed.result.tools[5].annotations.idempotentHint, true);
  assert.equal(listed.result.tools[6].annotations.destructiveHint, true);
  assert.ok(listed.result.tools.every((tool) => tool.annotations.openWorldHint === false));
  assert.ok(listed.result.tools.every((tool) => tool.inputSchema.type === "object"));
  const updateVariants = listed.result.tools[3].inputSchema.oneOf;
  assert.equal(updateVariants.length, 12);
  const repairVariant = updateVariants.find((schema) =>
    schema.properties.operation.const === "repair_compatibility");
  assert.deepEqual(repairVariant.required, ["operation"]);
  assert.equal(repairVariant.additionalProperties, false);
  const profileVariant = updateVariants.find((schema) =>
    schema.properties.operation.const === "save_meal_planning_profile");
  assert.ok(profileVariant.required.includes("idempotency_key"));
  assert.equal(profileVariant.additionalProperties, false);
  const stagedDelivery = updateVariants.find((schema) =>
    schema.properties.operation.const === "stage_delivery_promotion");
  assert.deepEqual(stagedDelivery.required, [
    "operation",
    "expected_revision",
    "provider_origin",
    "payload_fingerprint",
    "cloud_user_id",
    "cloud_household_id",
    "expected_repository_head",
  ]);
  const recordedDelivery = updateVariants.find((schema) =>
    schema.properties.operation.const === "record_delivery_promotion");
  assert.ok(recordedDelivery.required.includes("promotion_idempotency_key"));
  assert.equal(recordedDelivery.additionalProperties, false);
  const proposalVariant = updateVariants.find((schema) =>
    schema.properties.operation.const === "append_meal_proposal");
  const deliverySource = proposalVariant.properties.source.oneOf.find((schema) =>
    schema.properties.kind.const === "journal_delivery_dish");
  assert.deepEqual(deliverySource.required, ["kind", "item_id", "item_revision", "evidence_ids"]);
  assert.equal(deliverySource.properties.evidence_ids.uniqueItems, true);

  const codexListed = await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
  }, {
    enableCodexAuditLifecycle: true,
    stopRunner: async () => ({ status: "not_configured", connection_preserved: true }),
  });
  assert.deepEqual(
    codexListed.result.tools.slice(0, -1).map((tool) => tool.name),
    listed.result.tools.map((tool) => tool.name),
  );
  const lifecycle = codexListed.result.tools.at(-1);
  assert.equal(lifecycle.name, "fullwell_local_codex_grocery_audit_lifecycle");
  assert.deepEqual(
    lifecycle.inputSchema.oneOf.map((variant) => variant.properties.operation.const),
    ["begin", "resume", "checkpoint", "finish"],
  );
  assert.equal(lifecycle.annotations.destructiveHint, false);
});

test("the Codex-only grocery audit lifecycle validates and echoes bounded coordination metadata", async () => {
  const callCodexLifecycle = async (id, args) => await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: "fullwell_local_codex_grocery_audit_lifecycle",
      arguments: args,
    },
  }, {
    enableCodexAuditLifecycle: true,
    stopRunner: async () => ({ status: "not_configured", connection_preserved: true }),
  });
  const runId = "550e8400-e29b-41d4-a716-446655440000";
  assert.deepEqual(parsedToolContent(await callCodexLifecycle(1, {
    operation: "begin",
    run_id: runId,
    completed_order_count: 8,
    remaining_order_count: null,
  })), {
    ok: true,
    workflow: "grocery_order_audit",
    operation: "begin",
    run_id: runId,
    status: "collecting",
    revision: 1,
    completed_order_count: 8,
    remaining_order_count: null,
  });
  assert.equal(parsedToolContent(await callCodexLifecycle(2, {
    operation: "resume",
    run_id: runId,
    expected_revision: 1,
  })).revision, 1);
  assert.equal(parsedToolContent(await callCodexLifecycle(3, {
    operation: "checkpoint",
    run_id: runId,
    expected_revision: 1,
    completed_order_count: 9,
    remaining_order_count: 4,
  })).revision, 2);
  assert.equal(parsedToolContent(await callCodexLifecycle(4, {
    operation: "finish",
    run_id: runId,
    expected_revision: 2,
    outcome: "partially_completed",
  })).status, "partially_completed");

  const unavailable = await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "fullwell_local_codex_grocery_audit_lifecycle",
      arguments: {
        operation: "begin",
        run_id: runId,
        completed_order_count: 0,
        remaining_order_count: null,
      },
    },
  });
  assert.equal(unavailable.error.code, -32602);

  for (const [id, args] of [
    [6, { operation: "begin", run_id: "household@example.com", completed_order_count: 0, remaining_order_count: null }],
    [7, { operation: "resume", run_id: runId, expected_revision: 0 }],
    [8, { operation: "checkpoint", run_id: runId, expected_revision: 1, completed_order_count: -1, remaining_order_count: null }],
    [9, { operation: "finish", run_id: runId, expected_revision: 1, outcome: "collecting" }],
    [10, { operation: "finish", run_id: runId, expected_revision: 1, outcome: "completed", extra: true }],
  ]) {
    const response = await callCodexLifecycle(id, args);
    assert.equal(response.result.isError, true);
    assert.equal(parsedToolContent(response).error.code, "VALIDATION_FAILED");
  }
});

test("local profile, household naming, and runner control are available through chat-safe tools", async () => {
  await withLocalRoot(async (root) => {
    assert.deepEqual(parsedToolContent(await call(root, 1, "fullwell_local_profile_load")), {
      ok: true,
      status: "missing",
    });
    const profile = parsedToolContent(await call(root, 2, "fullwell_local_profile_update", {
      expected_revision: 0,
      display_name: "Chris",
    }));
    assert.equal(profile.default_household_name, "Chris' Household");
    const household = parsedToolContent(await call(root, 3, "fullwell_local_household_update", {
      operation: "initialize",
      household_name: profile.default_household_name,
    }));
    assert.equal(household.journal.household.display_name, "Chris' Household");
    const renamed = parsedToolContent(await call(root, 4, "fullwell_local_household_update", {
      operation: "rename_household",
      expected_revision: household.revision,
      household_name: "Garden Table",
    }));
    assert.equal(renamed.journal.household.display_name, "Garden Table");

    const stopped = await handleLocalHouseholdMcpMessage(root, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "fullwell_local_whatsapp_runner_stop", arguments: {} },
    }, {
      stopRunner: async () => ({
        status: "stopped",
        connection_preserved: true,
        restart_command: "fullwell-runner install",
      }),
    });
    assert.equal(parsedToolContent(stopped).connection_preserved, true);
  });
});

test("stable local tools preserve the existing revisioned household contract", async () => {
  await withLocalRoot(async (root) => {
    const missing = await call(root, 1, "fullwell_local_household_load");
    assert.deepEqual(parsedToolContent(missing), { ok: true, status: "missing" });

    const initialized = await call(root, 2, "fullwell_local_household_update", { operation: "initialize" });
    assert.equal(parsedToolContent(initialized).revision, 1);
    const saved = await call(root, 3, "fullwell_local_household_update", {
      operation: "save",
      expected_revision: 1,
      journal: { stage: "groceries", items: [{ kind: "ingredient", title: "Parsley" }] },
    });
    assert.equal(parsedToolContent(saved).revision, 2);

    const loaded = await call(root, 4, "fullwell_local_household_load");
    assert.equal(parsedToolContent(loaded).journal.items[0].title, "Parsley");
    assert.equal(JSON.parse(await readFile(localHouseholdPath(root), "utf8")).revision, 2);
    const compatible = await call(root, 5, "fullwell_local_household_update", {
      operation: "repair_compatibility",
    });
    assert.equal(parsedToolContent(compatible).status, "already_compatible");
    assert.equal(parsedToolContent(compatible).repaired_delivery_dish_count, 0);
    assert.equal(parsedToolContent(compatible).split_delivery_dish_count, 0);
    assert.equal(parsedToolContent(compatible).repaired_delivery_report_count, 0);
    assert.equal(parsedToolContent(compatible).repaired_delivery_report_row_count, 0);
    assert.equal(parsedToolContent(compatible).removed_legacy_browser_label_count, 0);
    assert.equal(parsedToolContent(compatible).revision, 2);
  });
});

test("the ordinary update tool cannot cross the destructive deletion boundary", async () => {
  await withLocalRoot(async (root) => {
    await call(root, 1, "fullwell_local_household_update", { operation: "initialize" });
    const denied = await call(root, 2, "fullwell_local_household_update", {
      operation: "delete_collecting",
      expected_revision: 1,
    });
    assert.equal(denied.result.isError, true);
    assert.equal(parsedToolContent(denied).error.code, "VALIDATION_FAILED");
    assert.equal(parsedToolContent(await call(root, 3, "fullwell_local_household_load")).status, "found");

    const deleted = await call(root, 4, "fullwell_local_household_delete_collecting", { expected_revision: 1 });
    assert.deepEqual(parsedToolContent(deleted), { ok: true, status: "deleted" });
  });
});

test("the stdio adapter bounds and parses each JSON-RPC line before dispatch", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let emitted = "";
  output.setEncoding("utf8");
  output.on("data", (chunk) => { emitted += chunk; });
  const serving = serveLocalHouseholdMcp({ input, output, root: "/unused", maxMessageBytes: 64 });
  input.end(`${"x".repeat(65)}\n`);
  await serving;
  assert.deepEqual(JSON.parse(emitted), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32600, message: "MCP message exceeds the local Fullwell limit" },
  });
});

test("unexpected failures are redacted while local domain errors remain actionable", async () => {
  const invalid = await handleLocalHouseholdMcpMessage("/unused", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "fullwell_local_household_update",
      arguments: { operation: "save", expected_revision: 1, journal: { access_token: "secret" } },
    },
  });
  const content = parsedToolContent(invalid);
  assert.equal(invalid.result.isError, true);
  assert.equal(content.error.code, "PROHIBITED_LOCAL_DATA");
  assert.doesNotMatch(JSON.stringify(invalid), /secret/);
});

test("the MCP update boundary appends meal proposals and the board tool returns only its generated path", async () => {
  await withLocalRoot(async (root) => {
    await call(root, 1, "fullwell_local_household_update", { operation: "initialize" });
    const profiled = parsedToolContent(await call(root, 2, "fullwell_local_household_update", {
      operation: "save_meal_planning_profile",
      expected_revision: 1,
      idempotency_key: "meal-profile-mcp-000001",
      actor_label: "Maya",
      constraints: {
        status: "confirmed_none",
        time_zone: "America/Los_Angeles",
        reviewed_at: "2026-07-23T18:00:00.000Z",
      },
    }));
    const reviewed = parsedToolContent(await call(root, 3, "fullwell_local_household_update", {
      operation: "review_meal_constraints",
      expected_revision: profiled.revision,
      idempotency_key: "review-week-2026-07-20",
      actor_label: "Maya",
      week_start: "2026-07-20",
      constraint_revision: 1,
    }));
    const proposed = parsedToolContent(await call(root, 4, "fullwell_local_household_update", {
      operation: "append_meal_proposal",
      expected_revision: reviewed.revision,
      idempotency_key: "proposal-mcp-pizza-0001",
      actor_label: "Maya",
      week_start: "2026-07-20",
      meal_date: "2026-07-20",
      slot: { kind: "dinner" },
      source: { kind: "freeform", title: "Pizza" },
      servings: null,
      notes: null,
      constraint_revision: 1,
      constraint_review_event_id: reviewed.event.id,
      compatibility: "incomplete_evidence",
      compatibility_caveat: "Ingredients are not yet known.",
    }));
    assert.equal(proposed.proposal.source.title, "Pizza");

    const board = parsedToolContent(await call(root, 5, "fullwell_local_recipe_board_create", {
      idempotency_key: "recipe-board-mcp-00001",
      title: "Dinner ideas",
      context_label: null,
      cards: [{
        id: "card-pizza",
        title: "Pizza",
        image_url: null,
        image_page_url: null,
        recipe_url: null,
        source_label: "Household idea",
        why_recommended: "Flexible for dinner.",
        journal_statuses: [],
        proposed_slot: "Monday dinner",
        compatibility: "incomplete_evidence",
        compatibility_caveat: "Ingredients are not yet known.",
      }],
    }));
    assert.equal(board.card_count, 1);
    assert.ok(board.file_path.includes(path.join("fullwell", "local", "views", "recipe-boards")));
    assert.equal(Object.hasOwn(board, "html"), false);
  });
});
