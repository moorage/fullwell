import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2] ?? "local";
const configuredRoot = process.env.HOUSEHOLD_REPOSITORY_ROOT;
const root = resolve(configuredRoot ?? (target === "local" ? ".local/households" : ""));

if (!configuredRoot && target !== "local") {
  throw new Error("Set HOUSEHOLD_REPOSITORY_ROOT to the mounted staging repository root.");
}

if (target !== "local" && root === resolve("/data/households")) {
  throw new Error("Run the staging persistence smoke on the Droplet, not from a workstation path alias.");
}

await mkdir(root, { recursive: true });
const canaryPath = resolve(root, `.persistence-canary-${randomUUID()}`);
const expected = `${new Date().toISOString()}\n`;
const handle = await open(canaryPath, "wx", 0o600);
try {
  await handle.writeFile(expected, "utf8");
  await handle.sync();
} finally {
  await handle.close();
}

const actual = await readFile(canaryPath, "utf8");
await rm(canaryPath);
if (actual !== expected) {
  throw new Error("Persistence canary did not round-trip exactly.");
}

console.log(`Persistence smoke passed for ${root}.`);
