#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import path from "node:path";

import {
  LocalHouseholdError,
  activeCodexHome,
  runRequest,
} from "./local-household.mjs";

const SERVER_NAME = "fullwell-local";
const SERVER_VERSION = "1";
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const UPDATE_OPERATIONS = new Set(["initialize", "save", "finalize", "record_cloud_backup"]);

const emptyObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const revisionSchema = {
  type: "integer",
  minimum: 1,
};

const localTools = [
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
    description: "Initializes, revision-checks, saves, finalizes, or records cloud linkage for the bounded local Fullwell guest household.",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["initialize", "save", "finalize", "record_cloud_backup"],
        },
        expected_revision: revisionSchema,
        journal: { type: "object" },
        user_id: { type: "string" },
        household_id: { type: "string" },
        repository_head: { type: "string" },
      },
      additionalProperties: false,
    },
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
];

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

async function callLocalTool(root, name, input) {
  try {
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
export async function handleLocalHouseholdMcpMessage(root, message) {
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
  if (message.method === "tools/list") return jsonRpcResult(id, { tools: localTools });
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (typeof name !== "string") return jsonRpcError(id, -32602, "Invalid params");
    const result = await callLocalTool(root, name, message.params?.arguments ?? {});
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
        const response = await handleLocalHouseholdMcpMessage(root, message);
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await serveLocalHouseholdMcp();
}
