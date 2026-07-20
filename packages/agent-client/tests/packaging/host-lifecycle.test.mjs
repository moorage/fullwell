import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const localPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageRootOverride = process.env.HFJ_AGENT_PACKAGE_ROOT?.trim();
const packageRoot = packageRootOverride ? path.resolve(packageRootOverride) : localPackageRoot;
const pluginName = "household-food-journal";
const marketplaceName = "fullwell-local-test";

async function versionOf(command) {
  try {
    return (await execute(command, ["--version"])).stdout.trim();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function createPluginCopy(marketplaceRoot) {
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(path.dirname(pluginRoot), { recursive: true });
  await cp(packageRoot, pluginRoot, {
    recursive: true,
    filter: (source) => !path.relative(packageRoot, source).split(path.sep).includes("node_modules"),
  });
  return pluginRoot;
}

async function run(command, args, env) {
  return await execute(command, args, {
    cwd: packageRoot,
    env: { ...process.env, ...env },
    maxBuffer: 2 * 1024 * 1024,
  });
}

function installedPlugins(output) {
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : parsed.installed;
}

test("Codex CLI installs, reinstalls, and removes the shared package from an isolated local marketplace", async (context) => {
  const version = await versionOf("codex");
  if (version === null) return context.skip("Codex CLI is not installed");
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hfj-codex-host-"));
  try {
    const marketplaceRoot = path.join(temporaryRoot, "marketplace");
    await createPluginCopy(marketplaceRoot);
    const manifestPath = path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      name: marketplaceName,
      interface: { displayName: "Fullwell local test" },
      plugins: [{
        name: pluginName,
        source: { source: "local", path: `./plugins/${pluginName}` },
        policy: { installation: "AVAILABLE", authentication: "ON_USE" },
        category: "Lifestyle",
      }],
    }));
    const codexHome = path.join(temporaryRoot, "home");
    await mkdir(codexHome, { recursive: true });
    const env = { CODEX_HOME: codexHome };

    await run("codex", ["plugin", "marketplace", "add", marketplaceRoot, "--json"], env);
    const available = JSON.parse((await run("codex", ["plugin", "list", "--marketplace", marketplaceName, "--available", "--json"], env)).stdout);
    assert.equal(available.available[0]?.pluginId, `${pluginName}@${marketplaceName}`);
    await run("codex", ["plugin", "add", `${pluginName}@${marketplaceName}`, "--json"], env);
    const installed = JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout);
    assert.equal(installed.installed[0]?.pluginId, `${pluginName}@${marketplaceName}`);
    assert.equal(installed.installed[0]?.enabled, true);
    await run("codex", ["plugin", "remove", `${pluginName}@${marketplaceName}`, "--json"], env);
    assert.deepEqual(JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout).installed, []);
    await run("codex", ["plugin", "add", `${pluginName}@${marketplaceName}`, "--json"], env);
    assert.equal(JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout).installed[0]?.enabled, true);
    await run("codex", ["plugin", "remove", `${pluginName}@${marketplaceName}`, "--json"], env);
    await run("codex", ["plugin", "marketplace", "remove", marketplaceName, "--json"], env);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Claude Code installs, disables, enables, updates, and uninstalls the shared package in isolation", async (context) => {
  const version = await versionOf("claude");
  if (version === null) return context.skip("Claude Code is not installed");
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hfj-claude-host-"));
  try {
    const marketplaceRoot = path.join(temporaryRoot, "marketplace");
    await createPluginCopy(marketplaceRoot);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
      name: marketplaceName,
      owner: { name: "Fullwell" },
      plugins: [{
        name: pluginName,
        source: `./plugins/${pluginName}`,
        description: "Keep an evidence-backed family food journal.",
        version: "1.0.0",
      }],
    }));
    const configRoot = path.join(temporaryRoot, "home");
    const env = { CLAUDE_CONFIG_DIR: configRoot };

    await run("claude", ["plugin", "marketplace", "add", marketplaceRoot, "--scope", "user"], env);
    const available = JSON.parse((await run("claude", ["plugin", "list", "--available", "--json"], env)).stdout);
    assert.equal(available.available[0]?.pluginId, `${pluginName}@${marketplaceName}`);
    await run("claude", ["plugin", "install", `${pluginName}@${marketplaceName}`, "--scope", "user"], env);
    assert.equal(installedPlugins((await run("claude", ["plugin", "list", "--json"], env)).stdout)[0]?.enabled, true);
    await run("claude", ["plugin", "disable", `${pluginName}@${marketplaceName}`, "--scope", "user"], env);
    assert.equal(installedPlugins((await run("claude", ["plugin", "list", "--json"], env)).stdout)[0]?.enabled, false);
    await run("claude", ["plugin", "enable", `${pluginName}@${marketplaceName}`, "--scope", "user"], env);
    await run("claude", ["plugin", "update", `${pluginName}@${marketplaceName}`, "--scope", "user"], env);
    await run("claude", ["plugin", "uninstall", `${pluginName}@${marketplaceName}`, "--scope", "user", "--yes"], env);
    assert.deepEqual(installedPlugins((await run("claude", ["plugin", "list", "--json"], env)).stdout), []);
    await run("claude", ["plugin", "marketplace", "remove", marketplaceName], env);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
