import { join } from "node:path";
import type { ProcessRunner } from "./process.js";
import { safeHostEnvironment } from "./process.js";

const ALLOWED_MCP_SERVERS = new Set(["node_repl"]);
const ALLOWED_PLUGINS = new Set(["browser@openai-bundled", "chrome@openai-bundled"]);

export async function verifyIsolatedCodexCapabilities(
  executable: string,
  projectDirectory: string,
  processRunner: ProcessRunner,
  signal: AbortSignal,
): Promise<void> {
  const mcp = await processRunner({
    command: executable,
    args: ["mcp", "list"],
    cwd: projectDirectory,
    stdin: "",
    signal,
    timeoutMilliseconds: 30_000,
    maxOutputBytes: 1_048_576,
    env: isolatedCodexEnvironment(projectDirectory),
  });
  assertExactCapabilitySet(enabledMcpServers(mcp.stdout), ALLOWED_MCP_SERVERS, "MCP servers");

  const plugins = await processRunner({
    command: executable,
    args: ["plugin", "list"],
    cwd: projectDirectory,
    stdin: "",
    signal,
    timeoutMilliseconds: 30_000,
    maxOutputBytes: 1_048_576,
    env: isolatedCodexEnvironment(projectDirectory),
  });
  assertExactCapabilitySet(enabledPlugins(plugins.stdout), ALLOWED_PLUGINS, "plugins");
}

export function isolatedCodexEnvironment(projectDirectory: string): NodeJS.ProcessEnv {
  return { ...safeHostEnvironment(), CODEX_HOME: join(projectDirectory, ".codex-home") };
}

export function enabledMcpServers(output: string): ReadonlySet<string> {
  const enabled = new Set<string>();
  for (const line of output.split("\n")) {
    const columns = line.trim().split(/\s{2,}/);
    if (columns.length > 1 && columns.includes("enabled")) enabled.add(columns[0] ?? "");
  }
  enabled.delete("");
  return enabled;
}

export function enabledPlugins(output: string): ReadonlySet<string> {
  const enabled = new Set<string>();
  for (const line of output.split("\n")) {
    const columns = line.trim().split(/\s{2,}/);
    if (columns[1] === "installed, enabled" && columns[0] !== undefined) enabled.add(columns[0]);
  }
  return enabled;
}

function assertExactCapabilitySet(actual: ReadonlySet<string>, expected: ReadonlySet<string>, label: string): void {
  const unexpected = [...actual].filter((name) => !expected.has(name)).sort();
  const missing = [...expected].filter((name) => !actual.has(name)).sort();
  if (unexpected.length === 0 && missing.length === 0) return;
  throw new Error(`Codex isolated project ${label} mismatch (unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"})`);
}
