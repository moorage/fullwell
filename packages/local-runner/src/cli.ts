#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { HouseholdIdSchema } from "@hfj/contracts";
import { connectNativeRunner } from "./auth/connect.js";
import { MacOSKeychain } from "./auth/keychain.js";
import { OAuthTokenManager } from "./auth/token-manager.js";
import { defaultApplicationRoot, parseRunnerConfig, type RunnerConfig } from "./config.js";
import { FullwellGatewayClient } from "./gateway-client.js";
import { ClaudeHostAdapter } from "./host/claude.js";
import { CodexHostAdapter } from "./host/codex.js";
import type { AgentHostPort } from "./host/types.js";
import { LaunchdManager } from "./launchd.js";
import { stableNode24Executable } from "./node-runtime.js";
import { LocalRunner } from "./runner.js";
import { SnapshotCache } from "./snapshot-cache.js";
import { ActionReceiptStore } from "./state/action-receipts.js";

const executeFile = promisify(execFile);
const KEYCHAIN_ACCOUNT = "fullwell-local-runner";

export async function runCli(argv: readonly string[]): Promise<void> {
  const command = argv[0] ?? "status";
  const options = parseOptions(argv.slice(1));
  const applicationRoot = resolve(options.get("root") ?? defaultApplicationRoot());
  const configPath = join(applicationRoot, "config.json");
  const launchd = new LaunchdManager(join(homedir(), "Library/LaunchAgents/com.fullwell.local-runner.plist"));

  switch (command) {
    case "connect":
      await connect(applicationRoot, configPath, options);
      return;
    case "install": {
      await loadConfig(configPath);
      const entrypoint = fileURLToPath(import.meta.url);
      await launchd.install([await stableNode24Executable(), entrypoint, "run", "--root", applicationRoot], join(applicationRoot, "logs"));
      process.stdout.write("Fullwell local runner installed and started.\n");
      return;
    }
    case "status": {
      const config = await optionalConfig(configPath);
      const service = await launchd.status();
      process.stdout.write(`${JSON.stringify({ connected: config !== null, service, host: config?.host ?? null, device_id: config?.device_id ?? null })}\n`);
      return;
    }
    case "run": {
      const runtime = await createRuntime(await loadConfig(configPath));
      const controller = shutdownController();
      await runtime.run(controller.signal);
      return;
    }
    case "drain-once": {
      const runtime = await createRuntime(await loadConfig(configPath));
      process.stdout.write(`${JSON.stringify({ result: await runtime.drainOnce(new AbortController().signal, true) })}\n`);
      return;
    }
    case "disconnect":
      await disconnect(applicationRoot, configPath, launchd);
      return;
    case "uninstall":
      await launchd.uninstall();
      process.stdout.write("Fullwell local runner LaunchAgent removed.\n");
      return;
    default:
      throw new Error(`Unknown local runner command: ${command}`);
  }
}

async function connect(applicationRoot: string, configPath: string, options: ReadonlyMap<string, string>): Promise<void> {
  const origin = new URL(requiredOption(options, "origin"));
  const householdId = HouseholdIdSchema.parse(requiredOption(options, "household"));
  const host = requiredOption(options, "host");
  if (host !== "codex" && host !== "claude") throw new Error("--host must be codex or claude");
  const retailerOrigin = new URL(requiredOption(options, "retailer"));
  const name = options.get("name") ?? `${basename(homedir())}'s Mac`;
  const hostExecutable = await findExecutable(options.get("host-executable") ?? host);
  const hostProjectDirectory = host === "codex"
    ? await realpath(options.get("host-project") ?? resolve(homedir(), "Projects/fullwell-isolated-project-env"))
    : null;
  const keychain = new MacOSKeychain(KEYCHAIN_ACCOUNT);
  const connected = await connectNativeRunner({ origin, keychain });
  const gateway = new FullwellGatewayClient(origin, { accessToken: async () => connected.accessToken, invalidate: () => undefined });
  const device = await gateway.registerDevice(householdId, name);
  const config = parseRunnerConfig({
    public_origin: origin.toString(),
    household_id: householdId,
    device_id: device.device_id,
    host,
    host_executable: hostExecutable,
    host_project_directory: hostProjectDirectory,
    retailer_origin: retailerOrigin.toString(),
    application_root: applicationRoot,
  });
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  const account = new URL("/account", origin);
  account.searchParams.set("runner_device", device.device_id);
  account.searchParams.set("household_id", householdId);
  await executeFile("/usr/bin/open", [account.toString()], { encoding: "utf8", maxBuffer: 16_384 });
  process.stdout.write(`Runner ${device.device_id} registered. Complete the WhatsApp link in the opened Fullwell account page.\n`);
}

async function createRuntime(config: RunnerConfig): Promise<LocalRunner> {
  const keychain = new MacOSKeychain(KEYCHAIN_ACCOUNT);
  const tokens = new OAuthTokenManager(new URL(config.public_origin), keychain);
  const gateway = new FullwellGatewayClient(new URL(config.public_origin), tokens);
  const host: AgentHostPort = config.host === "codex"
    ? new CodexHostAdapter(config.host_executable, requiredCodexProjectDirectory(config))
    : new ClaudeHostAdapter(config.host_executable);
  return new LocalRunner(
    config,
    gateway,
    new SnapshotCache(config.application_root),
    new ActionReceiptStore(join(config.application_root, "receipts")),
    host,
  );
}

function requiredCodexProjectDirectory(config: RunnerConfig): string {
  if (config.host_project_directory === null) throw new Error("Codex requires an isolated host project directory");
  return config.host_project_directory;
}

async function disconnect(applicationRoot: string, configPath: string, launchd: LaunchdManager): Promise<void> {
  const config = await loadConfig(configPath);
  const keychain = new MacOSKeychain(KEYCHAIN_ACCOUNT);
  const tokens = new OAuthTokenManager(new URL(config.public_origin), keychain);
  const gateway = new FullwellGatewayClient(new URL(config.public_origin), tokens);
  await launchd.uninstall();
  await revokeWithRequiredLocalPurge(async () => {
    await gateway.revokeDevice(config.device_id);
    const refreshToken = await keychain.read("oauth-refresh-token");
    if (refreshToken !== null) {
      const response = await fetch(new URL("/oauth/revoke", config.public_origin), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Fullwell OAuth revocation failed with status ${response.status}`);
    }
  }, async () => {
    await Promise.all([
      keychain.delete("oauth-client-id"),
      keychain.delete("oauth-refresh-token"),
      new SnapshotCache(applicationRoot).purge(config.household_id),
      new ActionReceiptStore(join(applicationRoot, "receipts")).purge(),
      rm(configPath, { force: true }),
    ]);
  });
  process.stdout.write("Fullwell local runner disconnected and local household data removed.\n");
}

export async function revokeWithRequiredLocalPurge(revoke: () => Promise<void>, purge: () => Promise<void>): Promise<void> {
  try {
    await revoke();
  } finally {
    await purge();
  }
}

async function loadConfig(path: string): Promise<RunnerConfig> {
  return parseRunnerConfig(JSON.parse(await readFile(path, "utf8")));
}

async function optionalConfig(path: string): Promise<RunnerConfig | null> {
  try {
    return await loadConfig(path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseOptions(args: readonly string[]): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (name === undefined || !name.startsWith("--") || value === undefined) throw new Error("Runner options must use --name value pairs");
    values.set(name.slice(2), value);
  }
  return values;
}

function requiredOption(options: ReadonlyMap<string, string>, name: string): string {
  const value = options.get(name);
  if (value === undefined) throw new Error(`--${name} is required`);
  return value;
}

async function findExecutable(command: string): Promise<string> {
  if (command.startsWith("/")) return await realpath(command);
  const result = await executeFile("/usr/bin/which", [command], { encoding: "utf8", maxBuffer: 16_384 });
  return await realpath(result.stdout.trim());
}

function shutdownController(): AbortController {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  return controller;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${JSON.stringify({ level: "error", event: "runner.command_failed", error: error instanceof Error ? error.message : "Unknown failure" })}\n`);
    process.exitCode = 1;
  });
}
