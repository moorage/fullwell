import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { RunnerBrowserBackend } from "../config.js";
import { isolatedCodexEnvironment, verifyIsolatedCodexCapabilities } from "./codex-capabilities.js";
import { HostResolutionSchema, HostTerminalSchema, type AgentHostPort, type HostActInput, type HostResolveInput } from "./types.js";
import { actionPrompt, CODEX_OUTPUT_JSON_SCHEMA, CODEX_TERMINAL_OUTPUT_JSON_SCHEMA, resolutionPrompt } from "./prompt.js";
import { runProcess, type ProcessRunner } from "./process.js";
import { restockingSnapshotPrompt } from "../snapshot-cache.js";

const CodexEventSchema = z.object({
  type: z.string(),
  thread_id: z.string().min(1).max(256).optional(),
}).passthrough();

const CodexOutputSchema = z.object({
  kind: z.enum(["ready_to_act", "completed", "needs_input", "blocked", "cancelled"]),
  selected_item_reference: z.string().nullable(),
  retailer_origin: z.string().nullable(),
  retailer_locator: z.string().nullable(),
  baseline_quantity: z.number().int().nullable(),
  target_quantity: z.number().int().nullable(),
  currency: z.string().nullable(),
  incremental_amount_minor: z.number().int().nullable(),
  automatic_add_maximum_minor: z.number().int().nullable(),
  authorization_mode: z.enum(["automatic_under_maximum", "user_confirmed"]).nullable(),
  message: z.string().nullable(),
  host_session_id: z.string().nullable(),
}).strict();

export class CodexHostAdapter implements AgentHostPort {
  constructor(
    private readonly executable: string,
    private readonly projectDirectory: string,
    private readonly browserBackend: RunnerBrowserBackend,
    private readonly processRunner: ProcessRunner = runProcess,
  ) {}

  async resolve(input: HostResolveInput) {
    return HostResolutionSchema.parse(await this.invoke(input, resolutionPrompt(input, await restockingSnapshotPrompt(input.snapshotDirectory), this.browserBackend), CODEX_OUTPUT_JSON_SCHEMA));
  }

  async act(input: HostActInput) {
    return HostTerminalSchema.parse(await this.invoke(input, actionPrompt(input, this.browserBackend), CODEX_TERMINAL_OUTPUT_JSON_SCHEMA));
  }

  private async invoke(input: HostResolveInput, prompt: string, outputSchema: object): Promise<unknown> {
    const temporary = await mkdtemp(join(tmpdir(), "fullwell-codex-"));
    const schemaPath = join(temporary, "output.schema.json");
    const outputPath = join(temporary, "result.json");
    try {
      await verifyIsolatedCodexCapabilities(this.executable, this.projectDirectory, this.browserBackend, this.processRunner, input.signal);
      await writeFile(schemaPath, `${JSON.stringify(outputSchema)}\n`, { encoding: "utf8", mode: 0o600 });
      const browserFeatures = this.browserBackend === "chrome"
        ? ["--enable", "browser_use", "--enable", "browser_use_external"]
        : ["--disable", "browser_use", "--disable", "browser_use_external"];
      const common = [
        "--enable", "computer_use",
        ...browserFeatures,
        "--disable", "shell_tool",
        "--disable", "unified_exec",
        "--disable", "standalone_web_search",
        "--disable", "apps",
        "--disable", "hooks",
        "--disable", "multi_agent",
        "--disable", "remote_plugin",
        "--config", "web_search=\"disabled\"",
        "--config", "notify=[]",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--output-schema", schemaPath,
        "--json",
        "--output-last-message", outputPath,
      ];
      const args = input.resumeSessionId === null
        ? ["exec", "--sandbox", "read-only", "--cd", this.projectDirectory, ...common, "-"]
        : ["exec", "resume", ...common, input.resumeSessionId, "-"];
      const result = await this.processRunner({
        command: this.executable,
        args,
        cwd: this.projectDirectory,
        stdin: prompt,
        signal: input.signal,
        timeoutMilliseconds: 10 * 60_000,
        maxOutputBytes: 1_048_576,
        env: isolatedCodexEnvironment(this.projectDirectory, this.browserBackend),
      });
      const threadId = codexThreadId(result.stdout) ?? input.resumeSessionId;
      const parsed: unknown = JSON.parse(await readFile(outputPath, "utf8"));
      if (typeof parsed !== "object" || parsed === null) throw new Error("Codex returned a non-object result");
      return codexOutput(parsed, threadId);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}

function codexOutput(value: unknown, hostSessionId: string | null) {
  const parsed = CodexOutputSchema.parse(value);
  if (parsed.kind === "ready_to_act") {
    return HostResolutionSchema.parse({
      kind: parsed.kind,
      selected_item_reference: parsed.selected_item_reference,
      retailer_origin: parsed.retailer_origin,
      retailer_locator: parsed.retailer_locator,
      baseline_quantity: parsed.baseline_quantity,
      target_quantity: parsed.target_quantity,
      currency: parsed.currency,
      incremental_amount_minor: parsed.incremental_amount_minor,
      automatic_add_maximum_minor: parsed.automatic_add_maximum_minor,
      authorization_mode: parsed.authorization_mode,
      host_session_id: hostSessionId,
    });
  }
  return HostTerminalSchema.parse({ kind: parsed.kind, message: parsed.message, host_session_id: hostSessionId });
}

function codexThreadId(output: string): string | null {
  for (const line of output.split("\n")) {
    if (line.trim() === "") continue;
    const value: unknown = JSON.parse(line);
    const event = CodexEventSchema.safeParse(value);
    if (event.success && event.data.type === "thread.started" && event.data.thread_id !== undefined) return event.data.thread_id;
  }
  return null;
}
