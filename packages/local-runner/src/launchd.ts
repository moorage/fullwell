import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { RunnerBrowserBackend } from "./config.js";

const executeFile = promisify(execFile);
export const LAUNCH_AGENT_LABEL = "com.fullwell.local-runner";
type ExecuteFile = (file: string, args: readonly string[], options: { readonly encoding: "utf8"; readonly maxBuffer: number }) => Promise<{ readonly stdout: string; readonly stderr: string }>;
const defaultExecute: ExecuteFile = async (file, args, options) => await executeFile(file, args, options);

export class LaunchdManager {
  constructor(
    private readonly plistPath: string,
    private readonly execute: ExecuteFile = defaultExecute,
  ) {}

  async install(programArguments: readonly string[], logDirectory: string, browserBackend: RunnerBrowserBackend): Promise<void> {
    if (programArguments.length < 1 || programArguments[0]?.startsWith("/") !== true) {
      throw new Error("The LaunchAgent executable must use an absolute path");
    }
    await mkdir(dirname(this.plistPath), { recursive: true, mode: 0o700 });
    await mkdir(logDirectory, { recursive: true, mode: 0o700 });
    await writeFile(this.plistPath, renderLaunchAgent(programArguments, logDirectory, browserBackend), { encoding: "utf8", mode: 0o600 });
    await this.bootout(false, [domain(), this.plistPath]);
    await this.execute("/bin/launchctl", ["bootstrap", domain(), this.plistPath], { encoding: "utf8", maxBuffer: 64 * 1_024 });
  }

  async uninstall(): Promise<void> {
    await this.bootout(false, [`${domain()}/${LAUNCH_AGENT_LABEL}`]);
    await rm(this.plistPath, { force: true });
  }

  async status(): Promise<"running" | "stopped"> {
    try {
      await this.execute("/bin/launchctl", ["print", `${domain()}/${LAUNCH_AGENT_LABEL}`], { encoding: "utf8", maxBuffer: 64 * 1_024 });
      return "running";
    } catch (error) {
      if (processExitCode(error) !== 0) return "stopped";
      throw error;
    }
  }

  async readDefinition(): Promise<string | null> {
    try {
      return await readFile(this.plistPath, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  private async bootout(required: boolean, target: readonly string[]): Promise<void> {
    try {
      await this.execute("/bin/launchctl", ["bootout", ...target], { encoding: "utf8", maxBuffer: 64 * 1_024 });
    } catch (error) {
      if (required || processExitCode(error) === 0) throw error;
    }
  }
}

export function renderLaunchAgent(
  programArguments: readonly string[],
  logDirectory: string,
  browserBackend: RunnerBrowserBackend,
): string {
  const browserEnvironment = browserBackend === "chrome"
    ? `    <key>BROWSER_USE_AVAILABLE_BACKENDS</key>
    <string>chrome</string>`
    : "";
  const argumentsXml = programArguments.map((argument) => `    <string>${escapeXml(argument)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argumentsXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>EnvironmentVariables</key>
  <dict>
${browserEnvironment}
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${escapeXml(`${logDirectory}/runner.log`)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(`${logDirectory}/runner-error.log`)}</string>
</dict>
</plist>
`;
}

function domain(): string {
  return `gui/${process.getuid?.() ?? process.geteuid?.() ?? 0}`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function processExitCode(error: unknown): number | null {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : null;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
