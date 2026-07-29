import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { handleCodexGroceryAuditHook } from "../../hooks/codex-grocery-audit-lifecycle.mjs";
import { handleLocalHouseholdMcpMessage } from "../../runtime/local-household-mcp.mjs";

const toolName = "mcp__fullwell_local__fullwell_local_codex_grocery_audit_lifecycle";
const hookPath = fileURLToPath(
  new URL("../../hooks/codex-grocery-audit-lifecycle.mjs", import.meta.url),
);
const sessionId = "019fb000-1111-7222-8333-444455556666";
const runId = "550e8400-e29b-41d4-a716-446655440000";
const controls = {
  enableCodexAuditLifecycle: true,
  stopRunner: async () => ({ status: "not_configured", connection_preserved: true }),
};

async function withRoots(run) {
  const root = await mkdtemp(path.join(tmpdir(), "fullwell-audit-hook-"));
  try {
    await run({
      root,
      pluginData: path.join(root, "plugin-data"),
      codexHome: path.join(root, "codex-home"),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function hookEvent(hookEventName, fields = {}) {
  return {
    session_id: sessionId,
    transcript_path: "/private/path/that-must-not-be-read.jsonl",
    cwd: "/unused",
    hook_event_name: hookEventName,
    ...fields,
  };
}

async function lifecycleResponse(codexHome, id, input) {
  const response = await handleLocalHouseholdMcpMessage(codexHome, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: "fullwell_local_codex_grocery_audit_lifecycle",
      arguments: input,
    },
  }, controls);
  assert.equal(response.result.isError, false);
  return response.result;
}

async function lifecycleHook(codexHome, pluginData, turnId, id, input, now) {
  return await handleCodexGroceryAuditHook(hookEvent("PostToolUse", {
    turn_id: turnId,
    tool_name: toolName,
    tool_use_id: `call-${id}`,
    tool_input: input,
    tool_response: await lifecycleResponse(codexHome, id, input),
  }), { pluginData, now });
}

function continuationPrompt(stopResult) {
  assert.equal(stopResult.decision, "block");
  return stopResult.reason;
}

function statePath(pluginData, id = sessionId) {
  const digest = createHash("sha256").update(id).digest("hex");
  return path.join(pluginData, "grocery-audit-continuations", `${digest}.json`);
}

test("an armed audit survives compaction and cannot stop before an explicit terminal outcome", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    const now = new Date("2026-07-29T20:00:00.000Z");
    const begin = {
      operation: "begin",
      run_id: runId,
      completed_order_count: 8,
      remaining_order_count: null,
    };
    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-1", 1, begin, now), {});

    const stateInfo = await lstat(statePath(pluginData));
    assert.equal(stateInfo.isFile(), true);
    assert.equal(stateInfo.mode & 0o777, 0o600);
    const stored = JSON.parse(await readFile(statePath(pluginData), "utf8"));
    assert.deepEqual(Object.keys(stored).sort(), [
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
    ]);
    assert.doesNotMatch(JSON.stringify(stored), /Amazon|cashew|household|transcript|\/private\//i);

    const compact = await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
      source: "compact",
    }), { pluginData, now });
    assert.match(compact.hookSpecificOutput.additionalContext, /8/);
    assert.match(compact.hookSpecificOutput.additionalContext, /do not restart discovery/i);

    const stopped = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-1",
      stop_hook_active: false,
      last_assistant_message: "Corrected - I will audit both sources.",
    }), { pluginData, now });
    const syntheticPrompt = continuationPrompt(stopped);
    assert.match(syntheticPrompt, /^\[\[fullwell-audit-continuation:/);

    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-2",
      prompt: syntheticPrompt,
    }), { pluginData, now }), {});

    const checkpoint = {
      operation: "checkpoint",
      run_id: runId,
      expected_revision: 1,
      completed_order_count: 9,
      remaining_order_count: 4,
    };
    assert.deepEqual(
      await lifecycleHook(codexHome, pluginData, "turn-2", 2, checkpoint, now),
      {},
    );
    const afterProgress = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-2",
      stop_hook_active: true,
      last_assistant_message: "Still working.",
    }), { pluginData, now });
    assert.equal(afterProgress.decision, "block");
    assert.doesNotMatch(afterProgress.reason, /No new lifecycle checkpoint/);
    assert.match(afterProgress.reason, /revision 2/);
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-3",
      prompt: continuationPrompt(afterProgress),
    }), { pluginData, now }), {});

    const finish = {
      operation: "finish",
      run_id: runId,
      expected_revision: 2,
      outcome: "completed",
    };
    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-3", 3, finish, now), {});
    await assert.rejects(access(statePath(pluginData)), { code: "ENOENT" });
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-3",
      stop_hook_active: true,
      last_assistant_message: "Finished.",
    }), { pluginData, now }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
      source: "compact",
    }), { pluginData, now }), {});
  });
});

test("a normal new prompt disarms an old audit so adjacent and unrelated operations stay inert", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    const prompts = [
      "i'm out of cashews",
      "reorder from Wanpo in stanford mall",
      "plan dinners for next week",
      "explain why the sky is blue",
    ];
    for (let index = 0; index < prompts.length; index += 1) {
      const currentRun = [
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
        "550e8400-e29b-41d4-a716-446655440003",
        "550e8400-e29b-41d4-a716-446655440004",
      ][index];
      assert.deepEqual(await lifecycleHook(codexHome, pluginData, `audit-${index}`, index + 1, {
        operation: "begin",
        run_id: currentRun,
        completed_order_count: index,
        remaining_order_count: null,
      }), {});
      const nextTurn = `ordinary-${index}`;
      assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
        turn_id: nextTurn,
        prompt: prompts[index],
      }), { pluginData }), {});
      assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Stop", {
        turn_id: nextTurn,
        stop_hook_active: false,
        last_assistant_message: "Ordinary response.",
      }), { pluginData }), {});
      assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
        source: "compact",
      }), { pluginData }), {});
      assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("PostToolUse", {
        turn_id: nextTurn,
        tool_name: "mcp__fullwell_local__fullwell_local_household_load",
        tool_use_id: `ordinary-${index}`,
        tool_input: {},
        tool_response: { content: [{ type: "text", text: "{\"ok\":true}" }], isError: false },
      }), { pluginData }), {});
    }
  });
});

test("failed, malformed, lookalike, stale, backward, and replayed lifecycle events fail closed", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    const begin = {
      operation: "begin",
      run_id: runId,
      completed_order_count: 2,
      remaining_order_count: 8,
    };
    const base = hookEvent("PostToolUse", {
      turn_id: "turn-1",
      tool_use_id: "bad-call",
      tool_input: begin,
    });
    assert.deepEqual(await handleCodexGroceryAuditHook({
      ...base,
      tool_name: toolName,
      tool_response: { content: [{ type: "text", text: "{\"ok\":false}" }], isError: true },
    }, { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook({
      ...base,
      tool_name: toolName,
      tool_response: { content: [{ type: "text", text: "not-json" }], isError: false },
    }, { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook({
      ...base,
      tool_name: `${toolName}_lookalike`,
      tool_response: await lifecycleResponse(codexHome, 1, begin),
    }, { pluginData }), {});
    await assert.rejects(access(statePath(pluginData)), { code: "ENOENT" });

    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-1", 2, begin), {});
    const firstStop = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-1",
      stop_hook_active: false,
      last_assistant_message: null,
    }), { pluginData });
    const prompt = continuationPrompt(firstStop);
    await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-2",
      prompt,
    }), { pluginData });
    await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-3",
      prompt,
    }), { pluginData });
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-3",
      stop_hook_active: false,
      last_assistant_message: "Replay",
    }), { pluginData }), {});

    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-4", 3, {
      operation: "resume",
      run_id: runId,
      expected_revision: 1,
    }), {});
    const backward = await lifecycleHook(codexHome, pluginData, "turn-4", 4, {
      operation: "checkpoint",
      run_id: runId,
      expected_revision: 1,
      completed_order_count: 1,
      remaining_order_count: 9,
    });
    assert.equal(backward.decision, "block");
    assert.match(backward.reason, /moved backward/);
    const stale = await lifecycleHook(codexHome, pluginData, "turn-4", 5, {
      operation: "finish",
      run_id: runId,
      expected_revision: 2,
      outcome: "completed",
    });
    assert.equal(stale.decision, "block");
    assert.match(stale.reason, /stale/);
  });
});

test("expired state is removed and symlinked state never supplies continuation context", async () => {
  await withRoots(async ({ root, pluginData, codexHome }) => {
    const old = new Date("2026-01-01T00:00:00.000Z");
    await lifecycleHook(codexHome, pluginData, "turn-old", 1, {
      operation: "begin",
      run_id: runId,
      completed_order_count: 1,
      remaining_order_count: null,
    }, old);
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
      source: "resume",
    }), {
      pluginData,
      now: new Date("2026-02-01T00:00:00.000Z"),
    }), {});
    await assert.rejects(access(statePath(pluginData)), { code: "ENOENT" });

    const directory = path.dirname(statePath(pluginData));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const target = path.join(root, "outside-state.json");
    await writeFile(target, "{\"private\":\"unchanged\"}\n", { mode: 0o600 });
    await symlink(target, statePath(pluginData));
    const warning = await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
      source: "compact",
    }), { pluginData });
    assert.deepEqual(warning, {});
    const blocked = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-symlink",
      stop_hook_active: false,
      last_assistant_message: null,
    }), { pluginData });
    assert.deepEqual(blocked, {});
    assert.equal(await readFile(target, "utf8"), "{\"private\":\"unchanged\"}\n");
  });
});

test("repeated stops at one revision require progress or a truthful terminal state", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    await lifecycleHook(codexHome, pluginData, "turn-1", 1, {
      operation: "begin",
      run_id: runId,
      completed_order_count: 3,
      remaining_order_count: 10,
    });
    const first = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-1",
      stop_hook_active: false,
      last_assistant_message: null,
    }), { pluginData });
    await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-2",
      prompt: continuationPrompt(first),
    }), { pluginData });
    const second = await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "turn-2",
      stop_hook_active: true,
      last_assistant_message: "No progress.",
    }), { pluginData });
    assert.equal(second.decision, "block");
    assert.match(second.reason, /No new lifecycle checkpoint/);
    assert.match(second.reason, /partially_completed or blocked/);
  });
});

test("concurrent turns and non-idempotent begin calls cannot replace an armed audit", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    const begin = {
      operation: "begin",
      run_id: runId,
      completed_order_count: 3,
      remaining_order_count: null,
    };
    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-1", 1, begin), {});
    assert.deepEqual(await lifecycleHook(codexHome, pluginData, "turn-1", 2, begin), {});

    const changedBegin = await lifecycleHook(codexHome, pluginData, "turn-1", 3, {
      ...begin,
      completed_order_count: 4,
    });
    assert.equal(changedBegin.decision, "block");
    assert.match(changedBegin.reason, /replace an armed audit/);

    const concurrentBegin = await lifecycleHook(codexHome, pluginData, "turn-2", 4, begin);
    assert.equal(concurrentBegin.decision, "block");
    assert.match(concurrentBegin.reason, /another collecting audit/);
    const concurrentResume = await lifecycleHook(codexHome, pluginData, "turn-2", 5, {
      operation: "resume",
      run_id: runId,
      expected_revision: 1,
    });
    assert.equal(concurrentResume.decision, "block");
    assert.match(concurrentResume.reason, /another turn/);

    await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-2",
      prompt: "an ordinary new request",
    }), { pluginData });
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("UserPromptSubmit", {
      turn_id: "turn-3",
      prompt: "another ordinary request",
    }), { pluginData }), {});
    const unarmedCheckpoint = await lifecycleHook(codexHome, pluginData, "turn-3", 6, {
      operation: "checkpoint",
      run_id: runId,
      expected_revision: 1,
      completed_order_count: 4,
      remaining_order_count: null,
    });
    assert.equal(unarmedCheckpoint.decision, "block");
    assert.match(unarmedCheckpoint.reason, /not armed for this turn/);
  });
});

test("unsafe lifecycle storage blocks only the exact lifecycle call and stays inert elsewhere", async () => {
  await withRoots(async ({ root, pluginData, codexHome }) => {
    const begin = {
      operation: "begin",
      run_id: runId,
      completed_order_count: 0,
      remaining_order_count: null,
    };
    const response = await lifecycleResponse(codexHome, 1, begin);
    const post = (data) => handleCodexGroceryAuditHook(hookEvent("PostToolUse", {
      turn_id: "turn-1",
      tool_name: toolName,
      tool_use_id: "unsafe-state",
      tool_input: begin,
      tool_response: response,
    }), { pluginData: data });
    const missingData = await post("");
    assert.equal(missingData.decision, "block");
    assert.match(missingData.reason, /unavailable or invalid/);

    const directory = path.dirname(statePath(pluginData));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(statePath(pluginData), "not-json\n", { mode: 0o600 });
    const malformed = await post(pluginData);
    assert.equal(malformed.decision, "block");
    await rm(statePath(pluginData));

    await writeFile(statePath(pluginData), "x".repeat(17 * 1024), { mode: 0o600 });
    const oversized = await post(pluginData);
    assert.equal(oversized.decision, "block");
    await rm(statePath(pluginData));

    await rm(directory, { recursive: true });
    const outside = path.join(root, "outside-directory");
    await mkdir(outside, { mode: 0o700 });
    await symlink(outside, directory);
    const unsafeDirectory = await post(pluginData);
    assert.equal(unsafeDirectory.decision, "block");
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "ordinary-turn",
      stop_hook_active: false,
      last_assistant_message: null,
    }), { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("SessionStart", {
      source: "startup",
    }), { pluginData }), {});
  });
});

test("the packaged hook command accepts bounded JSON and rejects malformed or oversized stdin", async () => {
  await withRoots(async ({ pluginData }) => {
    const execute = (input) => spawnSync(process.execPath, [hookPath], {
      input,
      encoding: "utf8",
      env: { ...process.env, PLUGIN_DATA: pluginData },
      maxBuffer: 1024 * 1024,
    });
    const ordinary = execute(JSON.stringify(hookEvent("UserPromptSubmit", {
      turn_id: "turn-cli",
      prompt: "ordinary prompt",
    })));
    assert.equal(ordinary.status, 0);
    assert.deepEqual(JSON.parse(ordinary.stdout), {});

    const malformed = execute("{");
    assert.equal(malformed.status, 1);
    assert.match(malformed.stderr, /EVENT_INVALID/);

    const oversized = execute(`"${"x".repeat(129 * 1024)}"`);
    assert.equal(oversized.status, 1);
    assert.match(oversized.stderr, /EVENT_TOO_LARGE/);
  });
});

test("invalid hook events and unsuccessful response shapes never create state", async () => {
  await withRoots(async ({ pluginData, codexHome }) => {
    assert.deepEqual(await handleCodexGroceryAuditHook(null, { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook([], { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook({ hook_event_name: "Stop" }, { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Unknown"), { pluginData }), {});
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("Stop", {
      turn_id: "\n",
    }), { pluginData }), {});

    const input = {
      operation: "begin",
      run_id: runId,
      completed_order_count: 0,
      remaining_order_count: null,
    };
    const success = await lifecycleResponse(codexHome, 1, input);
    const variants = [
      { result: success },
      { content: [{ type: "image", data: "ignored" }], isError: false },
      { content: [{ type: "text", text: JSON.stringify({ ok: true, workflow: "wrong" }) }], isError: false },
      { content: [{ type: "text", text: JSON.stringify({ ok: true, workflow: "grocery_order_audit", operation: "unknown", run_id: runId }) }], isError: false },
    ];
    for (let index = 1; index < variants.length; index += 1) {
      assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("PostToolUse", {
        turn_id: "turn-shape",
        tool_name: toolName,
        tool_use_id: `shape-${index}`,
        tool_input: input,
        tool_response: variants[index],
      }), { pluginData }), {});
    }
    assert.deepEqual(await handleCodexGroceryAuditHook(hookEvent("PostToolUse", {
      turn_id: "turn-shape",
      tool_name: toolName,
      tool_use_id: "shape-wrapper",
      tool_input: input,
      tool_response: variants[0],
    }), { pluginData }), {});
    await access(statePath(pluginData));
  });
});
