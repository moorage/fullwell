import { access, readdir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface NodeRuntimeOptions {
  readonly currentExecutable?: string;
  readonly currentVersion?: string;
  readonly versionsRoot?: string;
}

export async function stableNode24Executable(options: NodeRuntimeOptions = {}): Promise<string> {
  const current = await realpath(options.currentExecutable ?? process.execPath);
  if (nodeMajor(options.currentVersion ?? process.version) === 24) return current;
  const versionsRoot = options.versionsRoot ?? join(homedir(), ".local/share/fnm/node-versions");
  const versions = await readdir(versionsRoot).catch((error: unknown) => {
    if (isMissing(error)) return [];
    throw error;
  });
  for (const version of versions.filter((value) => /^v24\.\d+\.\d+$/.test(value)).sort(compareVersionsDescending)) {
    const candidate = join(versionsRoot, version, "installation/bin/node");
    try {
      await access(candidate, constants.X_OK);
      return await realpath(candidate);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  throw new Error("Fullwell local runner requires a stable Node 24 installation");
}

function nodeMajor(version: string): number {
  return Number(/^v?(\d+)/.exec(version)?.[1] ?? Number.NaN);
}

function compareVersionsDescending(left: string, right: string): number {
  const leftParts = left.slice(1).split(".").map(Number);
  const rightParts = right.slice(1).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
