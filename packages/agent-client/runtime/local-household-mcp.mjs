#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  LocalHouseholdError,
  activeCodexHome,
  runRequest,
} from "./local-household.mjs";
import { loadLocalProfile, updateLocalProfile } from "./local-profile.mjs";
import { createLocalRecipeBoard } from "./local-recipe-board.mjs";
import { stopLocalWhatsAppRunner } from "./local-runner-control.mjs";

const SERVER_NAME = "fullwell-local";
const SERVER_VERSION = "1";
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const CODEX_AUDIT_LIFECYCLE_ARGUMENT = "--codex-audit-lifecycle";
const CODEX_AUDIT_LIFECYCLE_TOOL = "fullwell_local_codex_grocery_audit_lifecycle";
const AUDIT_RUN_ID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const MAX_AUDIT_ORDER_COUNT = 100_000;
const UPDATE_OPERATIONS = new Set([
  "initialize",
  "repair_compatibility",
  "save",
  "rename_household",
  "finalize",
  "record_cloud_backup",
  "save_meal_planning_profile",
  "review_meal_constraints",
  "append_meal_proposal",
  "record_meal_plan_event",
  "stage_delivery_promotion",
  "record_delivery_promotion",
]);

const emptyObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const revisionSchema = {
  type: "integer",
  minimum: 1,
};
const expectedProfileRevisionSchema = {
  type: "integer",
  minimum: 0,
};
const localDisplayNameSchema = {
  type: "string",
  minLength: 1,
  maxLength: 108,
};
const householdNameSchema = {
  type: "string",
  minLength: 1,
  maxLength: 120,
};

const nullableStringSchema = { type: ["string", "null"] };
const localMealSlotSchema = {
  oneOf: [
    {
      type: "object",
      required: ["kind"],
      properties: { kind: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] } },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["kind", "label"],
      properties: {
        kind: { const: "custom" },
        label: { type: "string", minLength: 1, maxLength: 80 },
      },
      additionalProperties: false,
    },
  ],
};
const localMealSourceSchema = {
  oneOf: [
    {
      type: "object",
      required: ["kind", "title"],
      properties: {
        kind: { const: "freeform" },
        title: { type: "string", minLength: 1, maxLength: 300 },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["kind", "item_id", "item_revision", "liked_evidence_ids"],
      properties: {
        kind: { const: "journal_recipe" },
        item_id: { type: "string" },
        item_revision: { type: "string" },
        liked_evidence_ids: { type: "array", minItems: 1, maxItems: 100, items: { type: "string" } },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["kind", "item_id", "item_revision", "evidence_ids"],
      properties: {
        kind: { const: "journal_delivery_dish" },
        item_id: { type: "string" },
        item_revision: { type: "string" },
        evidence_ids: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: { type: "string" } },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["kind", "title", "canonical_url", "site_name", "discovered_at"],
      properties: {
        kind: { const: "external_recipe" },
        title: { type: "string", minLength: 1, maxLength: 300 },
        canonical_url: { type: "string", format: "uri" },
        site_name: { type: "string", minLength: 1, maxLength: 200 },
        discovered_at: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
  ],
};
const mealConstraintsSchema = {
  oneOf: [
    {
      type: "object",
      required: ["status", "time_zone", "reviewed_at"],
      properties: {
        status: { const: "confirmed_none" },
        time_zone: { type: "string" },
        reviewed_at: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["status", "time_zone", "allergy_labels", "sensitivity_labels", "reviewed_at"],
      properties: {
        status: { const: "recorded" },
        time_zone: { type: "string" },
        allergy_labels: { type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 120 } },
        sensitivity_labels: { type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 120 } },
        reviewed_at: { type: "string", format: "date-time" },
      },
      additionalProperties: false,
    },
  ],
};
const idempotencyKeySchema = { type: "string", minLength: 8, maxLength: 128 };
const providerOriginSchema = {
  type: "string",
  format: "uri",
  maxLength: 2_048,
  pattern: "^https://[^/?#]+/$",
};
const payloadFingerprintSchema = {
  type: "string",
  pattern: "^sha256:[0-9a-f]{64}$",
};
const actorLabelSchema = { type: "string", minLength: 1, maxLength: 80 };
const weekStartSchema = { type: "string", format: "date" };
const withdrawalEventSchema = {
  type: "object",
  required: ["kind", "proposal_id", "reason"],
  properties: {
    kind: { const: "proposal_withdrawn" },
    proposal_id: { type: "string" },
    reason: nullableStringSchema,
  },
  additionalProperties: false,
};
const updateOperationSchema = (operation, properties = {}) => ({
  type: "object",
  required: ["operation", ...Object.keys(properties)],
  properties: { operation: { const: operation }, ...properties },
  additionalProperties: false,
});
const householdUpdateSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      required: ["operation"],
      properties: {
        operation: { const: "initialize" },
        household_name: householdNameSchema,
      },
      additionalProperties: false,
    },
    updateOperationSchema("repair_compatibility"),
    updateOperationSchema("save", {
      expected_revision: revisionSchema,
      journal: { type: "object" },
    }),
    updateOperationSchema("rename_household", {
      expected_revision: revisionSchema,
      household_name: householdNameSchema,
    }),
    updateOperationSchema("finalize", { expected_revision: revisionSchema }),
    updateOperationSchema("record_cloud_backup", {
      expected_revision: revisionSchema,
      user_id: { type: "string" },
      household_id: { type: "string" },
      repository_head: { type: "string" },
    }),
    updateOperationSchema("save_meal_planning_profile", {
      expected_revision: revisionSchema,
      idempotency_key: idempotencyKeySchema,
      actor_label: actorLabelSchema,
      constraints: mealConstraintsSchema,
    }),
    updateOperationSchema("review_meal_constraints", {
      expected_revision: revisionSchema,
      idempotency_key: idempotencyKeySchema,
      actor_label: actorLabelSchema,
      week_start: weekStartSchema,
      constraint_revision: revisionSchema,
    }),
    updateOperationSchema("append_meal_proposal", {
      expected_revision: revisionSchema,
      idempotency_key: idempotencyKeySchema,
      actor_label: actorLabelSchema,
      week_start: weekStartSchema,
      meal_date: { type: "string", format: "date" },
      slot: localMealSlotSchema,
      source: localMealSourceSchema,
      servings: { type: ["integer", "null"], minimum: 1, maximum: 100 },
      notes: nullableStringSchema,
      constraint_revision: revisionSchema,
      constraint_review_event_id: { type: "string" },
      compatibility: { type: "string", enum: ["appears_compatible", "incomplete_evidence", "needs_recheck"] },
      compatibility_caveat: { type: "string", minLength: 1, maxLength: 1_000 },
    }),
    updateOperationSchema("record_meal_plan_event", {
      expected_revision: revisionSchema,
      idempotency_key: idempotencyKeySchema,
      actor_label: actorLabelSchema,
      week_start: weekStartSchema,
      event: withdrawalEventSchema,
    }),
    updateOperationSchema("stage_delivery_promotion", {
      expected_revision: revisionSchema,
      provider_origin: providerOriginSchema,
      payload_fingerprint: payloadFingerprintSchema,
      cloud_user_id: { type: "string" },
      cloud_household_id: { type: "string" },
      expected_repository_head: { type: "string" },
    }),
    updateOperationSchema("record_delivery_promotion", {
      expected_revision: revisionSchema,
      provider_origin: providerOriginSchema,
      promotion_idempotency_key: idempotencyKeySchema,
      user_id: { type: "string" },
      household_id: { type: "string" },
      repository_head: { type: "string" },
    }),
  ],
};

const localTools = [
  {
    name: "fullwell_local_profile_load",
    title: "Load Fullwell's private local member profile",
    description: "Loads the remembered local member display name and its deterministic first-household name without contacting Fullwell's cloud service.",
    inputSchema: emptyObjectSchema,
    annotations: {
      title: "Load local Fullwell member profile",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_profile_update",
    title: "Update Fullwell's private local member profile",
    description: "Creates or revision-checks the remembered local member display name without changing household authority or contacting Fullwell's cloud service.",
    inputSchema: {
      type: "object",
      required: ["expected_revision", "display_name"],
      properties: {
        expected_revision: expectedProfileRevisionSchema,
        display_name: localDisplayNameSchema,
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Update local Fullwell member profile",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_household_load",
    title: "Load Fullwell's private local household journal",
    description: "Loads the bounded local Fullwell guest household from the active Codex home without contacting Fullwell's cloud service.",
    inputSchema: emptyObjectSchema,
    annotations: {
      title: "Load local Fullwell household",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_household_update",
    title: "Update Fullwell's private local household journal",
    description: "Initializes, safely repairs recognized older local formats, revision-checks, saves, finalizes, records confirmed cloud linkage, stages delivery promotion authority with a one-way target digest, or appends validated meal-planning state for the bounded local Fullwell guest household.",
    inputSchema: householdUpdateSchema,
    annotations: {
      title: "Update local Fullwell household",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_household_delete_collecting",
    title: "Delete an unfinished local Fullwell household",
    description: "Deletes only an unfinished local guest household at the exact expected revision after the user confirms cancellation.",
    inputSchema: {
      type: "object",
      required: ["expected_revision"],
      properties: { expected_revision: revisionSchema },
      additionalProperties: false,
    },
    annotations: {
      title: "Delete unfinished local Fullwell household",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_recipe_board_create",
    title: "Create a private local Fullwell recipe board",
    description: "Creates one bounded static recipe-board snapshot beneath Fullwell's private local directory without searching, fetching images, opening a browser, or changing a journal.",
    inputSchema: {
      type: "object",
      required: ["idempotency_key", "title", "context_label", "cards"],
      properties: {
        idempotency_key: { type: "string", minLength: 8, maxLength: 128 },
        title: { type: "string", minLength: 1, maxLength: 300 },
        context_label: nullableStringSchema,
        cards: {
          type: "array",
          minItems: 1,
          maxItems: 48,
          items: {
            type: "object",
            required: [
              "id",
              "title",
              "image_url",
              "image_page_url",
              "recipe_url",
              "source_label",
              "why_recommended",
              "journal_statuses",
              "proposed_slot",
              "compatibility",
              "compatibility_caveat",
            ],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 120 },
              title: { type: "string", minLength: 1, maxLength: 300 },
              image_url: nullableStringSchema,
              image_page_url: nullableStringSchema,
              recipe_url: nullableStringSchema,
              source_label: { type: "string", minLength: 1, maxLength: 200 },
              why_recommended: { type: "string", minLength: 1, maxLength: 1_000 },
              journal_statuses: {
                type: "array",
                maxItems: 3,
                uniqueItems: true,
                items: { type: "string", enum: ["Saved", "Cooked", "Liked"] },
              },
              proposed_slot: nullableStringSchema,
              compatibility: { type: "string", enum: ["appears_compatible", "incomplete_evidence", "needs_recheck"] },
              compatibility_caveat: { type: "string", minLength: 1, maxLength: 1_000 },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Create private recipe board",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "fullwell_local_whatsapp_runner_stop",
    title: "Stop the local Fullwell WhatsApp runner",
    description: "Stops and removes only the macOS Fullwell runner LaunchAgent while preserving its cloud connection, Keychain credentials, snapshots, receipts, and local journal.",
    inputSchema: emptyObjectSchema,
    annotations: {
      title: "Stop local Fullwell WhatsApp runner",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

const codexAuditLifecycleTool = {
  name: CODEX_AUDIT_LIFECYCLE_TOOL,
  title: "Coordinate one active Codex grocery-order audit",
  description: "Signals the installed Codex lifecycle hooks when one grocery-order audit begins, resumes, reaches a durable checkpoint, or records a terminal outcome. It stores no food, store, order, household, browser, or credential data and does not mutate the household journal.",
  inputSchema: {
    type: "object",
    oneOf: [
      {
        required: ["operation", "run_id", "completed_order_count", "remaining_order_count"],
        properties: {
          operation: { const: "begin" },
          run_id: { type: "string", pattern: AUDIT_RUN_ID_PATTERN },
          completed_order_count: { type: "integer", minimum: 0, maximum: MAX_AUDIT_ORDER_COUNT },
          remaining_order_count: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: MAX_AUDIT_ORDER_COUNT,
          },
        },
        additionalProperties: false,
      },
      {
        required: ["operation", "run_id", "expected_revision"],
        properties: {
          operation: { const: "resume" },
          run_id: { type: "string", pattern: AUDIT_RUN_ID_PATTERN },
          expected_revision: revisionSchema,
        },
        additionalProperties: false,
      },
      {
        required: [
          "operation",
          "run_id",
          "expected_revision",
          "completed_order_count",
          "remaining_order_count",
        ],
        properties: {
          operation: { const: "checkpoint" },
          run_id: { type: "string", pattern: AUDIT_RUN_ID_PATTERN },
          expected_revision: revisionSchema,
          completed_order_count: { type: "integer", minimum: 0, maximum: MAX_AUDIT_ORDER_COUNT },
          remaining_order_count: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: MAX_AUDIT_ORDER_COUNT,
          },
        },
        additionalProperties: false,
      },
      {
        required: ["operation", "run_id", "expected_revision", "outcome"],
        properties: {
          operation: { const: "finish" },
          run_id: { type: "string", pattern: AUDIT_RUN_ID_PATTERN },
          expected_revision: revisionSchema,
          outcome: {
            type: "string",
            enum: ["completed", "partially_completed", "blocked", "cancelled"],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  annotations: {
    title: "Coordinate Codex grocery audit",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function toolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: true, ...result }) }],
    isError: false,
  };
}

function toolError(error) {
  const known = error instanceof LocalHouseholdError;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        ok: false,
        error: {
          code: known ? error.code : "LOCAL_HOUSEHOLD_FAILED",
          message: known ? error.message : "Local household operation failed",
        },
      }),
    }],
    isError: true,
  };
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new LocalHouseholdError("VALIDATION_FAILED", `${label} must be an object`);
  }
  return value;
}

function assertEmptyArguments(value) {
  const input = assertPlainObject(value ?? {}, "arguments");
  if (Object.keys(input).length !== 0) {
    throw new LocalHouseholdError("VALIDATION_FAILED", "load arguments must be empty");
  }
}

function assertExactArguments(input, keys) {
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  if (actual.join(",") !== expected.join(",")) {
    throw new LocalHouseholdError("VALIDATION_FAILED", "audit lifecycle arguments are invalid");
  }
}

function assertAuditRunId(value) {
  if (typeof value !== "string" || !new RegExp(AUDIT_RUN_ID_PATTERN).test(value)) {
    throw new LocalHouseholdError("VALIDATION_FAILED", "audit run_id must be opaque");
  }
}

function assertAuditRevision(value) {
  if (!Number.isInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new LocalHouseholdError("VALIDATION_FAILED", "audit revision is invalid");
  }
}

function assertAuditCount(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_AUDIT_ORDER_COUNT) {
    throw new LocalHouseholdError("VALIDATION_FAILED", `${label} is invalid`);
  }
}

function normalizeCodexAuditLifecycle(value) {
  const input = assertPlainObject(value, "arguments");
  assertAuditRunId(input.run_id);
  const base = {
    workflow: "grocery_order_audit",
    operation: input.operation,
    run_id: input.run_id,
  };
  if (input.operation === "begin") {
    assertExactArguments(input, ["operation", "run_id", "completed_order_count", "remaining_order_count"]);
    assertAuditCount(input.completed_order_count, "completed_order_count");
    if (input.remaining_order_count !== null) {
      assertAuditCount(input.remaining_order_count, "remaining_order_count");
    }
    return {
      ...base,
      status: "collecting",
      revision: 1,
      completed_order_count: input.completed_order_count,
      remaining_order_count: input.remaining_order_count,
    };
  }
  if (input.operation === "resume") {
    assertExactArguments(input, ["operation", "run_id", "expected_revision"]);
    assertAuditRevision(input.expected_revision);
    return { ...base, status: "collecting", revision: input.expected_revision };
  }
  if (input.operation === "checkpoint") {
    assertExactArguments(input, [
      "operation",
      "run_id",
      "expected_revision",
      "completed_order_count",
      "remaining_order_count",
    ]);
    assertAuditRevision(input.expected_revision);
    assertAuditCount(input.completed_order_count, "completed_order_count");
    if (input.remaining_order_count !== null) {
      assertAuditCount(input.remaining_order_count, "remaining_order_count");
    }
    return {
      ...base,
      status: "collecting",
      revision: input.expected_revision + 1,
      completed_order_count: input.completed_order_count,
      remaining_order_count: input.remaining_order_count,
    };
  }
  if (input.operation === "finish") {
    assertExactArguments(input, ["operation", "run_id", "expected_revision", "outcome"]);
    assertAuditRevision(input.expected_revision);
    if (!["completed", "partially_completed", "blocked", "cancelled"].includes(input.outcome)) {
      throw new LocalHouseholdError("VALIDATION_FAILED", "audit outcome is invalid");
    }
    return {
      ...base,
      status: input.outcome,
      revision: input.expected_revision + 1,
    };
  }
  throw new LocalHouseholdError("VALIDATION_FAILED", "audit lifecycle operation is unsupported");
}

async function callLocalTool(root, name, input, controls, enableCodexAuditLifecycle) {
  try {
    if (name === "fullwell_local_profile_load") {
      assertEmptyArguments(input);
      return toolResult(await loadLocalProfile(root));
    }
    if (name === "fullwell_local_profile_update") {
      return toolResult(await updateLocalProfile(root, assertPlainObject(input, "arguments")));
    }
    if (name === "fullwell_local_household_load") {
      assertEmptyArguments(input);
      return toolResult(await runRequest(root, { operation: "load" }));
    }
    if (name === "fullwell_local_household_update") {
      const args = assertPlainObject(input, "arguments");
      if (!UPDATE_OPERATIONS.has(args.operation)) {
        throw new LocalHouseholdError("VALIDATION_FAILED", "update operation is unsupported");
      }
      return toolResult(await runRequest(root, args));
    }
    if (name === "fullwell_local_household_delete_collecting") {
      const args = assertPlainObject(input, "arguments");
      return toolResult(await runRequest(root, { ...args, operation: "delete_collecting" }));
    }
    if (name === "fullwell_local_recipe_board_create") {
      return toolResult(await createLocalRecipeBoard(root, assertPlainObject(input, "arguments")));
    }
    if (name === "fullwell_local_whatsapp_runner_stop") {
      assertEmptyArguments(input);
      return toolResult(await controls.stopRunner());
    }
    if (enableCodexAuditLifecycle && name === CODEX_AUDIT_LIFECYCLE_TOOL) {
      return toolResult(normalizeCodexAuditLifecycle(input));
    }
    return null;
  } catch (error) {
    return toolError(error);
  }
}

/**
 * Handles one parsed MCP message without exposing local journal content to logs.
 *
 * Domain validation remains in `local-household.mjs`, so the stdio adapter
 * cannot drift from the file, revision, size, or prohibited-data boundary.
 */
export async function handleLocalHouseholdMcpMessage(
  root,
  message,
  controls = {
    stopRunner: stopLocalWhatsAppRunner,
    enableCodexAuditLifecycle: false,
  },
) {
  if (message === null || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0") {
    return jsonRpcError(null, -32600, "Invalid Request");
  }
  const id = Object.hasOwn(message, "id") ? message.id : undefined;
  if (typeof message.method !== "string") return id === undefined ? null : jsonRpcError(id, -32600, "Invalid Request");
  if (message.method === "notifications/initialized") return null;
  if (id === undefined) return null;
  if (message.method === "initialize") {
    const requestedVersion = message.params?.protocolVersion;
    return jsonRpcResult(id, {
      protocolVersion: typeof requestedVersion === "string" ? requestedVersion : "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
  }
  if (message.method === "ping") return jsonRpcResult(id, {});
  if (message.method === "tools/list") {
    return jsonRpcResult(id, {
      tools: controls.enableCodexAuditLifecycle
        ? [...localTools, codexAuditLifecycleTool]
        : localTools,
    });
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (typeof name !== "string") return jsonRpcError(id, -32602, "Invalid params");
    const result = await callLocalTool(
      root,
      name,
      message.params?.arguments ?? {},
      controls,
      controls.enableCodexAuditLifecycle === true,
    );
    return result === null
      ? jsonRpcError(id, -32602, `Unknown local Fullwell tool: ${name}`)
      : jsonRpcResult(id, result);
  }
  return jsonRpcError(id, -32601, "Method not found");
}

/** Runs the bounded newline-delimited MCP stdio loop used by both host plugins. */
export async function serveLocalHouseholdMcp({
  input = process.stdin,
  output = process.stdout,
  root = activeCodexHome(),
  maxMessageBytes = MAX_MESSAGE_BYTES,
  enableCodexAuditLifecycle = false,
} = {}) {
  input.setEncoding("utf8");
  let pending = "";
  const emit = (message) => output.write(`${JSON.stringify(message)}\n`);
  for await (const chunk of input) {
    pending += chunk;
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (Buffer.byteLength(line) > maxMessageBytes) {
        emit(jsonRpcError(null, -32600, "MCP message exceeds the local Fullwell limit"));
        return;
      }
      if (line.trim().length > 0) {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          emit(jsonRpcError(null, -32700, "Parse error"));
          newline = pending.indexOf("\n");
          continue;
        }
        const response = await handleLocalHouseholdMcpMessage(root, message, {
          stopRunner: stopLocalWhatsAppRunner,
          enableCodexAuditLifecycle,
        });
        if (response !== null) emit(response);
      }
      newline = pending.indexOf("\n");
    }
    if (Buffer.byteLength(pending) > maxMessageBytes) {
      emit(jsonRpcError(null, -32600, "MCP message exceeds the local Fullwell limit"));
      return;
    }
  }
  if (pending.trim().length > 0) emit(jsonRpcError(null, -32700, "Parse error"));
}

if (process.argv[1] !== undefined
  && await realpath(fileURLToPath(import.meta.url)) === await realpath(process.argv[1])) {
  await serveLocalHouseholdMcp({
    enableCodexAuditLifecycle: process.argv.includes(CODEX_AUDIT_LIFECYCLE_ARGUMENT),
  });
}
