import { execFile } from "node:child_process";
import { lstat, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { LocalHouseholdError } from "./local-household.mjs";

const executeFile = promisify(execFile);
const RUNNER_LABEL = "com.fullwell.local-runner";

function processExitCode(error) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
    ? error.code
    : null;
}

async function existsAsFile(filePath) {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() && !metadata.isSymbolicLink()) {
      throw new LocalHouseholdError("UNSAFE_LOCAL_PATH", "Fullwell runner definition is not a regular file");
    }
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function stopLocalWhatsAppRunner({
  platform = process.platform,
  home = homedir(),
  uid = process.getuid?.() ?? process.geteuid?.() ?? 0,
  execute = async (file, args) => await executeFile(file, args, { encoding: "utf8", maxBuffer: 64 * 1024 }),
} = {}) {
  if (platform !== "darwin") {
    throw new LocalHouseholdError("RUNNER_CONTROL_UNAVAILABLE", "The Fullwell WhatsApp runner can only be stopped on macOS");
  }
  const service = `gui/${uid}/${RUNNER_LABEL}`;
  const plistPath = path.join(home, "Library", "LaunchAgents", `${RUNNER_LABEL}.plist`);
  const definitionExisted = await existsAsFile(plistPath);
  try {
    await execute("/bin/launchctl", ["bootout", service]);
  } catch (error) {
    if (processExitCode(error) === null || processExitCode(error) === 0) throw error;
  }
  try {
    await execute("/bin/launchctl", ["print", service]);
    throw new LocalHouseholdError("RUNNER_STOP_FAILED", "The Fullwell WhatsApp runner is still running");
  } catch (error) {
    if (error instanceof LocalHouseholdError) throw error;
    if (processExitCode(error) === null || processExitCode(error) === 0) throw error;
  }
  await rm(plistPath, { force: true });
  return {
    status: definitionExisted ? "stopped" : "already_stopped",
    connection_preserved: true,
    restart_command: "fullwell-runner install",
  };
}
