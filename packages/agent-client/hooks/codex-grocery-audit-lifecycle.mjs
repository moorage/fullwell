#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 1;
const MAX_EVENT_BYTES = 128 * 1024;
const MAX_STATE_BYTES = 16 * 1024;
const STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE_PATTERN = /^[0-9a-f-]{36}$/;
const TOOL_NAMES = new Set([
  "mcp__fullwell_local__fullwell_local_codex_grocery_audit_lifecycle",
  "mcp__fullwell-local__fullwell_local_codex_grocery_audit_lifecycle",
]);
const TERMINAL_OUTCOMES = new Set([
  "completed",
  "partially_completed",
  "blocked",
  "cancelled",
]);

class AuditHookError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditHookError";
    this.code = code;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100_000;
}

function validOpaqueId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) return false;
  return [...value].every((character) => {
    const code = character.codePointAt(0);
    return code >= 32 && code !== 127;
  });
}

function validRevision(value) {
  return Number.isInteger(value) && value >= 1 && value <= Number.MAX_SAFE_INTEGER;
}

function validIsoDate(value) {
  return typeof value === "string"
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function stateFile(pluginData, sessionId) {
  if (typeof pluginData !== "string" || pluginData.length === 0) {
    throw new AuditHookError("PLUGIN_DATA_MISSING", "Fullwell hook data directory is unavailable");
  }
  if (!validOpaqueId(sessionId)) {
    throw new AuditHookError("SESSION_INVALID", "Codex session identifier is invalid");
  }
  const digest = createHash("sha256").update(sessionId).digest("hex");
  const directory = path.join(path.resolve(pluginData), "grocery-audit-continuations");
  return { directory, file: path.join(directory, `${digest}.json`) };
}

async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new AuditHookError("STATE_DIRECTORY_UNSAFE", "Fullwell hook state directory is unsafe");
  }
  await chmod(directory, 0o700);
}

function validateState(value) {
  const keys = [
    "active_turn_id",
    "completed_order_count",
    "continuation_nonce",
    "continuation_revision",
    "progress_updated_at",
    "remaining_order_count",
    "revision",
    "run_id",
    "schema_version",
    "status",
    "stop_attempts",
  ];
  if (!exactKeys(value, keys)
    || value.schema_version !== SCHEMA_VERSION
    || value.status !== "collecting"
    || typeof value.run_id !== "string"
    || !RUN_ID_PATTERN.test(value.run_id)
    || !validRevision(value.revision)
    || !validCount(value.completed_order_count)
    || !(value.remaining_order_count === null || validCount(value.remaining_order_count))
    || !(value.active_turn_id === null
      || validOpaqueId(value.active_turn_id))
    || !(value.continuation_nonce === null
      || (typeof value.continuation_nonce === "string" && NONCE_PATTERN.test(value.continuation_nonce)))
    || !(value.continuation_revision === null || validRevision(value.continuation_revision))
    || !Number.isInteger(value.stop_attempts)
    || value.stop_attempts < 0
    || value.stop_attempts > 100_000
    || !validIsoDate(value.progress_updated_at)) {
    throw new AuditHookError("STATE_INVALID", "Fullwell hook state is invalid");
  }
  if ((value.continuation_nonce === null) !== (value.continuation_revision === null)) {
    throw new AuditHookError("STATE_INVALID", "Fullwell hook continuation state is invalid");
  }
  return value;
}

async function removeStateFile(file) {
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new AuditHookError("STATE_FILE_UNSAFE", "Fullwell hook state file is unsafe");
  }
  await unlink(file);
}

async function loadState(pluginData, sessionId, now = new Date()) {
  const location = stateFile(pluginData, sessionId);
  let info;
  try {
    info = await lstat(location.file);
  } catch (error) {
    if (error?.code === "ENOENT") return { ...location, state: null };
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_STATE_BYTES) {
    throw new AuditHookError("STATE_FILE_UNSAFE", "Fullwell hook state file is unsafe");
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(location.file, "utf8"));
  } catch {
    throw new AuditHookError("STATE_INVALID", "Fullwell hook state is unreadable");
  }
  const state = validateState(parsed);
  if (now.getTime() - Date.parse(state.progress_updated_at) >= STATE_TTL_MS) {
    await removeStateFile(location.file);
    return { ...location, state: null };
  }
  return { ...location, state };
}

async function saveState(directory, file, state) {
  validateState(state);
  await ensurePrivateDirectory(directory);
  try {
    const current = await lstat(file);
    if (current.isSymbolicLink() || !current.isFile()) {
      throw new AuditHookError("STATE_FILE_UNSAFE", "Fullwell hook state file is unsafe");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    await chmod(file, 0o600);
  } catch (error) {
    try {
      await unlink(temporary);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

function lifecycleResult(response) {
  const candidates = [response, response?.result].filter(isPlainObject);
  if (candidates.some((candidate) => candidate.isError === true)) return null;
  for (const candidate of candidates) {
    const contents = Array.isArray(candidate.content) ? candidate.content : [];
    for (const content of contents) {
      if (!isPlainObject(content) || content.type !== "text" || typeof content.text !== "string") continue;
      try {
        const parsed = JSON.parse(content.text);
        if (isPlainObject(parsed) && parsed.ok === true) return parsed;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function validLifecycleEcho(input, result) {
  if (!isPlainObject(input)
    || !isPlainObject(result)
    || result.workflow !== "grocery_order_audit"
    || result.operation !== input.operation
    || result.run_id !== input.run_id
    || typeof input.run_id !== "string"
    || !RUN_ID_PATTERN.test(input.run_id)) {
    return false;
  }
  if (input.operation === "begin") {
    return exactKeys(input, ["operation", "run_id", "completed_order_count", "remaining_order_count"])
      && result.status === "collecting"
      && result.revision === 1
      && result.completed_order_count === input.completed_order_count
      && result.remaining_order_count === input.remaining_order_count
      && validCount(input.completed_order_count)
      && (input.remaining_order_count === null || validCount(input.remaining_order_count));
  }
  if (input.operation === "resume") {
    return exactKeys(input, ["operation", "run_id", "expected_revision"])
      && result.status === "collecting"
      && result.revision === input.expected_revision
      && validRevision(input.expected_revision);
  }
  if (input.operation === "checkpoint") {
    return exactKeys(input, [
      "operation",
      "run_id",
      "expected_revision",
      "completed_order_count",
      "remaining_order_count",
    ])
      && result.status === "collecting"
      && result.revision === input.expected_revision + 1
      && result.completed_order_count === input.completed_order_count
      && result.remaining_order_count === input.remaining_order_count
      && validRevision(input.expected_revision)
      && validCount(input.completed_order_count)
      && (input.remaining_order_count === null || validCount(input.remaining_order_count));
  }
  if (input.operation === "finish") {
    return exactKeys(input, ["operation", "run_id", "expected_revision", "outcome"])
      && TERMINAL_OUTCOMES.has(input.outcome)
      && result.status === input.outcome
      && result.revision === input.expected_revision + 1
      && validRevision(input.expected_revision);
  }
  return false;
}

function transitionConflict(reason) {
  return {
    decision: "block",
    reason: `The Fullwell grocery-audit lifecycle update was not applied: ${reason}. Reload the current durable audit checkpoint and retry the exact lifecycle transition before continuing.`,
  };
}

async function postToolUse(event, pluginData, now) {
  if (!TOOL_NAMES.has(event.tool_name)) return {};
  const result = lifecycleResult(event.tool_response);
  if (result === null || !validLifecycleEcho(event.tool_input, result)) return {};
  if (!validOpaqueId(event.turn_id)) {
    return transitionConflict("the Codex turn identifier was invalid");
  }

  const loaded = await loadState(pluginData, event.session_id, now);
  const input = event.tool_input;
  const progressUpdatedAt = now.toISOString();
  if (input.operation === "begin") {
    if (loaded.state !== null
      && loaded.state.active_turn_id !== null
      && loaded.state.active_turn_id !== event.turn_id) {
      return transitionConflict("another collecting audit is armed");
    }
    if (loaded.state !== null && loaded.state.active_turn_id === event.turn_id) {
      const idempotent = loaded.state.run_id === input.run_id
        && loaded.state.revision === 1
        && loaded.state.completed_order_count === input.completed_order_count
        && loaded.state.remaining_order_count === input.remaining_order_count;
      if (!idempotent) return transitionConflict("begin would replace an armed audit");
      return {};
    }
    await saveState(loaded.directory, loaded.file, {
      schema_version: SCHEMA_VERSION,
      run_id: input.run_id,
      status: "collecting",
      revision: 1,
      completed_order_count: input.completed_order_count,
      remaining_order_count: input.remaining_order_count,
      active_turn_id: event.turn_id,
      continuation_nonce: null,
      continuation_revision: null,
      stop_attempts: 0,
      progress_updated_at: progressUpdatedAt,
    });
    return {};
  }
  if (loaded.state === null
    || loaded.state.run_id !== input.run_id
    || loaded.state.revision !== input.expected_revision) {
    return transitionConflict("the run or revision was stale");
  }
  if (input.operation === "resume") {
    if (loaded.state.active_turn_id !== null && loaded.state.active_turn_id !== event.turn_id) {
      return transitionConflict("another turn has this audit armed");
    }
    await saveState(loaded.directory, loaded.file, {
      ...loaded.state,
      active_turn_id: event.turn_id,
      continuation_nonce: null,
      continuation_revision: null,
      progress_updated_at: progressUpdatedAt,
    });
    return {};
  }
  if (loaded.state.active_turn_id !== event.turn_id) {
    return transitionConflict("the audit was not armed for this turn");
  }
  if (input.operation === "checkpoint") {
    if (input.completed_order_count < loaded.state.completed_order_count) {
      return transitionConflict("the completed-order count moved backward");
    }
    await saveState(loaded.directory, loaded.file, {
      ...loaded.state,
      revision: result.revision,
      completed_order_count: input.completed_order_count,
      remaining_order_count: input.remaining_order_count,
      continuation_nonce: null,
      continuation_revision: null,
      stop_attempts: 0,
      progress_updated_at: progressUpdatedAt,
    });
    return {};
  }
  if (input.operation === "finish") {
    await removeStateFile(loaded.file);
    return {};
  }
  return {};
}

function continuationMarker(state) {
  return `[[fullwell-audit-continuation:${state.continuation_nonce}:${state.run_id}:${state.revision}]]`;
}

async function userPromptSubmit(event, pluginData, now) {
  if (!validOpaqueId(event.turn_id)) return {};
  const loaded = await loadState(pluginData, event.session_id, now);
  if (loaded.state === null) return {};
  const prompt = typeof event.prompt === "string" ? event.prompt : "";
  const isOwnContinuation = loaded.state.continuation_nonce !== null
    && loaded.state.continuation_revision === loaded.state.revision
    && prompt.startsWith(continuationMarker(loaded.state));
  if (isOwnContinuation) {
    await saveState(loaded.directory, loaded.file, {
      ...loaded.state,
      active_turn_id: event.turn_id,
      continuation_nonce: null,
      continuation_revision: null,
    });
    return {};
  }
  if (loaded.state.active_turn_id === null
    && loaded.state.continuation_nonce === null
    && loaded.state.continuation_revision === null) {
    return {};
  }
  await saveState(loaded.directory, loaded.file, {
    ...loaded.state,
    active_turn_id: null,
    continuation_nonce: null,
    continuation_revision: null,
  });
  return {};
}

async function sessionStart(event, pluginData, now) {
  if (event.source !== "compact" && event.source !== "resume") return {};
  const loaded = await loadState(pluginData, event.session_id, now);
  if (loaded.state === null || loaded.state.active_turn_id === null) return {};
  const remaining = loaded.state.remaining_order_count === null
    ? "unknown"
    : String(loaded.state.remaining_order_count);
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: [
        "An explicitly started Fullwell grocery-order audit remains collecting in this interrupted Codex turn.",
        `Opaque run: ${loaded.state.run_id}. Progress revision: ${loaded.state.revision}.`,
        `Durably checkpointed orders: ${loaded.state.completed_order_count}. Remaining orders: ${remaining}.`,
        "Continue from the saved audit checkpoint; do not restart discovery or infer completion.",
        "After durable progress, record a lifecycle checkpoint. Before any final response, record completed, partially_completed, blocked, or cancelled.",
      ].join("\n"),
    },
  };
}

async function stop(event, pluginData, now) {
  if (!validOpaqueId(event.turn_id)) return {};
  const loaded = await loadState(pluginData, event.session_id, now);
  if (loaded.state === null || loaded.state.active_turn_id !== event.turn_id) return {};
  const next = {
    ...loaded.state,
    active_turn_id: null,
    continuation_nonce: randomUUID(),
    continuation_revision: loaded.state.revision,
    stop_attempts: loaded.state.stop_attempts + 1,
  };
  await saveState(loaded.directory, loaded.file, next);
  const remaining = next.remaining_order_count === null ? "unknown" : String(next.remaining_order_count);
  const stalled = next.stop_attempts > 1
    ? "No new lifecycle checkpoint was recorded after the prior continuation. Either make and checkpoint real progress now, or record a truthful partially_completed or blocked outcome before responding."
    : "Continue the already-authorized audit now from its durable checkpoint.";
  return {
    decision: "block",
    reason: [
      continuationMarker(next),
      stalled,
      `Opaque run ${next.run_id}, revision ${next.revision}; ${next.completed_order_count} orders checkpointed and ${remaining} remaining.`,
      "At the start of this continuation, call the grocery-audit lifecycle resume for that exact run and revision, then continue from the durable order checkpoint.",
      "Do not claim the audit is complete while its lifecycle status is collecting.",
    ].join("\n"),
  };
}

function stateFailure(event) {
  if (event.hook_event_name === "PostToolUse" && TOOL_NAMES.has(event.tool_name)) {
    return transitionConflict("the private continuation marker was unavailable or invalid");
  }
  return {};
}

export async function handleCodexGroceryAuditHook(
  event,
  {
    pluginData = process.env.PLUGIN_DATA,
    now = new Date(),
  } = {},
) {
  if (!isPlainObject(event)
    || typeof event.hook_event_name !== "string"
    || typeof event.session_id !== "string") {
    return {};
  }
  try {
    if (event.hook_event_name === "PostToolUse") return await postToolUse(event, pluginData, now);
    if (event.hook_event_name === "UserPromptSubmit") return await userPromptSubmit(event, pluginData, now);
    if (event.hook_event_name === "SessionStart") return await sessionStart(event, pluginData, now);
    if (event.hook_event_name === "Stop") return await stop(event, pluginData, now);
    return {};
  } catch (error) {
    if (error instanceof AuditHookError) return stateFailure(event);
    throw error;
  }
}

async function readEvent(input = process.stdin) {
  input.setEncoding("utf8");
  let body = "";
  for await (const chunk of input) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_EVENT_BYTES) {
      throw new AuditHookError("EVENT_TOO_LARGE", "Codex hook event exceeds the Fullwell limit");
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new AuditHookError("EVENT_INVALID", "Codex hook event is invalid");
  }
}

async function main() {
  const event = await readEvent();
  const result = await handleCodexGroceryAuditHook(event);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] !== undefined
  && await realpath(fileURLToPath(import.meta.url)) === await realpath(process.argv[1])) {
  try {
    await main();
  } catch (error) {
    const code = error instanceof AuditHookError ? error.code : "HOOK_FAILED";
    process.stderr.write(`Fullwell grocery audit hook failed safely (${code}).\n`);
    process.exitCode = 1;
  }
}
