import { z } from "zod";
import { HostResolutionSchema, HostTerminalSchema, type AgentHostPort, type HostActInput, type HostResolveInput } from "./types.js";
import { actionPrompt, HOST_OUTPUT_JSON_SCHEMA, resolutionPrompt } from "./prompt.js";
import { runProcess, type ProcessRunner } from "./process.js";
import { restockingSnapshotPrompt } from "../snapshot-cache.js";

const ClaudeResultSchema = z.object({
  session_id: z.string().min(1).max(256),
  structured_output: z.unknown(),
  is_error: z.boolean().optional(),
}).passthrough();

export class ClaudeHostAdapter implements AgentHostPort {
  constructor(
    private readonly executable = "/usr/local/bin/claude",
    private readonly processRunner: ProcessRunner = runProcess,
  ) {}

  async resolve(input: HostResolveInput) {
    return HostResolutionSchema.parse(await this.invoke(input, resolutionPrompt(input, await restockingSnapshotPrompt(input.snapshotDirectory))));
  }

  async act(input: HostActInput) {
    return HostTerminalSchema.parse(await this.invoke(input, actionPrompt(input)));
  }

  private async invoke(input: HostResolveInput, prompt: string): Promise<unknown> {
    const args = [
      "-p",
      "--chrome",
      "--output-format", "json",
      "--json-schema", JSON.stringify(HOST_OUTPUT_JSON_SCHEMA),
      "--permission-mode", "dontAsk",
      "--allowedTools", "mcp__claude-in-chrome__*",
      ...(input.resumeSessionId === null ? [] : ["--resume", input.resumeSessionId]),
      "-",
    ];
    const result = await this.processRunner({
      command: this.executable,
      args,
      cwd: input.snapshotDirectory,
      stdin: prompt,
      signal: input.signal,
      timeoutMilliseconds: 10 * 60_000,
      maxOutputBytes: 1_048_576,
    });
    const parsed = ClaudeResultSchema.parse(JSON.parse(result.stdout));
    if (parsed.is_error === true) throw new Error("Claude reported an unsuccessful host result");
    if (typeof parsed.structured_output !== "object" || parsed.structured_output === null) throw new Error("Claude returned a non-object structured result");
    return { ...parsed.structured_output, host_session_id: parsed.session_id };
  }
}
