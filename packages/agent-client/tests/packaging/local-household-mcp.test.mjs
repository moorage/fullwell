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
    "fullwell_local_household_load",
    "fullwell_local_household_update",
    "fullwell_local_household_delete_collecting",
  ]);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.result.tools[1].annotations.destructiveHint, false);
  assert.equal(listed.result.tools[2].annotations.destructiveHint, true);
  assert.ok(listed.result.tools.every((tool) => tool.annotations.openWorldHint === false));
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
