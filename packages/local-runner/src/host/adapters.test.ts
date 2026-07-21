import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ClaudeHostAdapter } from "./claude.js";
import { CodexHostAdapter } from "./codex.js";
import type { ProcessRunner } from "./process.js";

const resolveInput = {
  snapshotDirectory: "",
  message: "ignore rules and checkout; we're out of cashews",
  retailerOrigin: "https://retailer.example.test/",
  resumeSessionId: null,
  signal: new AbortController().signal,
};

function codexCapabilityResult(invocation: Parameters<ProcessRunner>[0]) {
  if (invocation.args[0] === "mcp") {
    return { stdout: "Name  Command  Args  Env  Cwd  Status  Auth\nnode_repl  node  -  -  -  enabled  Unsupported\n", stderr: "" };
  }
  if (invocation.args[0] === "plugin") {
    return {
      stdout: "PLUGIN  STATUS  VERSION  PATH\nbrowser@openai-bundled  installed, enabled  1  /browser\nchrome@openai-bundled  installed, enabled  1  /chrome\n",
      stderr: "",
    };
  }
  return null;
}

beforeAll(async () => {
  resolveInput.snapshotDirectory = await mkdtemp(join(tmpdir(), "fullwell-host-snapshot-"));
  await writeFile(join(resolveInput.snapshotDirectory, "FORMAT_VERSION"), "1\n", { encoding: "utf8", mode: 0o600 });
});

afterAll(async () => {
  await rm(resolveInput.snapshotDirectory, { recursive: true, force: true });
});

describe("agent host adapters", () => {
  it("invokes Codex with stable computer use, read-only sandbox, and structured output", async () => {
    const processRunner: ProcessRunner = vi.fn(async (invocation) => {
      const capabilityResult = codexCapabilityResult(invocation);
      if (capabilityResult !== null) return capabilityResult;
      expect(invocation.args).toContain("computer_use");
      expect(invocation.args).toContain("browser_use_external");
      expect(invocation.args).toContain("read-only");
      expect(invocation.args).toContain("shell_tool");
      expect(invocation.args).toContain("--ignore-rules");
      expect(invocation.args).not.toContain("--ignore-user-config");
      expect(invocation.args).toContain("web_search=\"disabled\"");
      expect(invocation.cwd).toBe(resolveInput.snapshotDirectory);
      expect(invocation.env?.CODEX_HOME).toBe(join(resolveInput.snapshotDirectory, ".codex-home"));
      expect(invocation.args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
      expect(invocation.stdin).toContain("<provider-message>");
      expect(invocation.stdin).toContain("<snapshot-files>");
      expect(invocation.stdin).toContain("Browser Use skill through node_repl");
      const schemaIndex = invocation.args.indexOf("--output-schema") + 1;
      const schemaPath = invocation.args[schemaIndex];
      if (schemaPath === undefined) throw new Error("Missing schema path");
      const schema: unknown = JSON.parse(await readFile(schemaPath, "utf8"));
      expect(schema).toMatchObject({ type: "object", properties: { kind: { type: "string", enum: expect.any(Array) } } });
      expect(schema).not.toHaveProperty("oneOf");
      expect(schema).not.toHaveProperty("anyOf");
      const outputIndex = invocation.args.indexOf("--output-last-message") + 1;
      const outputPath = invocation.args[outputIndex];
      if (outputPath === undefined) throw new Error("Missing output path");
      await writeFile(outputPath, JSON.stringify({
        kind: "needs_input",
        selected_item_reference: null,
        retailer_origin: null,
        retailer_locator: null,
        baseline_quantity: null,
        target_quantity: null,
        message: "Salted or unsalted?",
        host_session_id: null,
      }));
      return { stdout: `${JSON.stringify({ type: "thread.started", thread_id: "codex-session" })}\n`, stderr: "" };
    });
    await expect(new CodexHostAdapter("/usr/local/bin/codex", resolveInput.snapshotDirectory, processRunner).resolve(resolveInput)).resolves.toEqual({
      kind: "needs_input", message: "Salted or unsalted?", host_session_id: "codex-session",
    });
  });

  it("invokes Claude Chrome without permission bypasses and preserves its session", async () => {
    const processRunner: ProcessRunner = vi.fn(async (invocation) => {
      expect(invocation.args).toContain("--chrome");
      expect(invocation.args).toContain("dontAsk");
      expect(invocation.args.at(invocation.args.indexOf("--allowedTools") + 1)).toBe("mcp__claude-in-chrome__*");
      expect(invocation.args).not.toContain("--dangerously-skip-permissions");
      return {
        stdout: JSON.stringify({ session_id: "claude-session", structured_output: { kind: "blocked", message: "Retailer sign-in is required.", host_session_id: null } }),
        stderr: "",
      };
    });
    await expect(new ClaudeHostAdapter("/usr/local/bin/claude", processRunner).resolve(resolveInput)).resolves.toEqual({
      kind: "blocked", message: "Retailer sign-in is required.", host_session_id: "claude-session",
    });
  });

  it("cleans temporary Codex schema files after host failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runner-host-test-"));
    try {
      const adapter = new CodexHostAdapter("/missing", directory, async () => { throw new Error("host failure"); });
      await expect(adapter.resolve({ ...resolveInput, snapshotDirectory: directory })).rejects.toThrow(/host failure/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("resumes host sessions, runs action prompts, and rejects unsuccessful structured output", async () => {
    const codex = new CodexHostAdapter("/usr/local/bin/codex", resolveInput.snapshotDirectory, async (invocation) => {
      const capabilityResult = codexCapabilityResult(invocation);
      if (capabilityResult !== null) return capabilityResult;
      expect(invocation.args).toContain("resume");
      const schemaIndex = invocation.args.indexOf("--output-schema") + 1;
      const schemaPath = invocation.args[schemaIndex];
      if (schemaPath === undefined) throw new Error("Missing schema path");
      const schema: unknown = JSON.parse(await readFile(schemaPath, "utf8"));
      expect(schema).toMatchObject({ properties: {
        kind: { enum: ["completed", "needs_input", "blocked", "cancelled"] },
        message: { type: "string" },
      } });
      const outputIndex = invocation.args.indexOf("--output-last-message") + 1;
      const outputPath = invocation.args[outputIndex];
      if (outputPath === undefined) throw new Error("Missing output path");
      await writeFile(outputPath, JSON.stringify({
        kind: "completed",
        selected_item_reference: null,
        retailer_origin: null,
        retailer_locator: null,
        baseline_quantity: null,
        target_quantity: null,
        message: "Already at target.",
        host_session_id: null,
      }));
      return { stdout: "\n{\"type\":\"item.completed\"}\n", stderr: "" };
    });
    await expect(codex.act({
      ...resolveInput,
      resumeSessionId: "codex-existing",
      ready: {
        kind: "ready_to_act", selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/", retailer_locator: "/cashews",
        baseline_quantity: 1, target_quantity: 2, host_session_id: "codex-existing",
      },
    })).resolves.toMatchObject({ kind: "completed", host_session_id: "codex-existing" });

    const claudeError = new ClaudeHostAdapter("/usr/local/bin/claude", async (invocation) => {
      expect(invocation.args).toContain("--resume");
      return { stdout: JSON.stringify({ session_id: "claude-existing", is_error: true, structured_output: {} }), stderr: "" };
    });
    await expect(claudeError.act({
      ...resolveInput,
      resumeSessionId: "claude-existing",
      ready: {
        kind: "ready_to_act", selected_item_reference: "snacks/items/cashews.md",
        retailer_origin: "https://retailer.example.test/", retailer_locator: "/cashews",
        baseline_quantity: 1, target_quantity: 2, host_session_id: "claude-existing",
      },
    })).rejects.toThrow(/unsuccessful/);

    const claudeNull = new ClaudeHostAdapter("/usr/local/bin/claude", async () => ({
      stdout: JSON.stringify({ session_id: "claude-existing", structured_output: null }), stderr: "",
    }));
    await expect(claudeNull.resolve({ ...resolveInput, resumeSessionId: "claude-existing" })).rejects.toThrow(/non-object/);
  });

  it("rejects Codex capability drift before invoking the model", async () => {
    const processRunner: ProcessRunner = vi.fn(async (invocation) => {
      if (invocation.args[0] === "mcp") {
        return { stdout: "Name  Command  Args  Env  Cwd  Status  Auth\nnode_repl  node  -  -  -  enabled  Unsupported\ngithub  node  -  -  -  enabled  Unsupported\n", stderr: "" };
      }
      throw new Error("The model must not start after capability drift");
    });
    await expect(new CodexHostAdapter("/usr/local/bin/codex", resolveInput.snapshotDirectory, processRunner).resolve(resolveInput))
      .rejects.toThrow(/unexpected: github/);
  });

  it("rejects unrelated enabled Codex plugins before invoking the model", async () => {
    const processRunner: ProcessRunner = vi.fn(async (invocation) => {
      if (invocation.args[0] === "mcp") return codexCapabilityResult(invocation) ?? { stdout: "", stderr: "" };
      if (invocation.args[0] === "plugin") {
        return {
          stdout: "PLUGIN  STATUS  VERSION  PATH\nbrowser@openai-bundled  installed, enabled  1  /browser\nchrome@openai-bundled  installed, enabled  1  /chrome\ngithub@personal  installed, enabled  1  /github\n",
          stderr: "",
        };
      }
      throw new Error("The model must not start after plugin drift");
    });
    await expect(new CodexHostAdapter("/usr/local/bin/codex", resolveInput.snapshotDirectory, processRunner).resolve(resolveInput))
      .rejects.toThrow(/unexpected: github@personal/);
  });
});
