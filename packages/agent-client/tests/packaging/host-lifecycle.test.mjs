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
const codexPluginName = "fullwell";
const codexMarketplaceName = "fullwell";
const claudePluginName = "fullwell";
const claudeMarketplaceName = "fullwell";

async function versionOf(command) {
  try {
    return (await execute(command, ["--version"])).stdout.trim();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function createPluginCopy(marketplaceRoot, pluginName) {
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(path.dirname(pluginRoot), { recursive: true });
  await cp(packageRoot, pluginRoot, {
    recursive: true,
    filter: (source) => !path.relative(packageRoot, source).split(path.sep).includes("node_modules"),
  });
  return pluginRoot;
}

async function run(command, args, env, cwd = packageRoot) {
  return await execute(command, args, {
    cwd,
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
    await createPluginCopy(marketplaceRoot, codexPluginName);
    const manifestPath = path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      name: codexMarketplaceName,
      interface: { displayName: "Fullwell local test" },
      plugins: [{
        name: codexPluginName,
        source: { source: "local", path: `./plugins/${codexPluginName}` },
        policy: { installation: "AVAILABLE", authentication: "ON_USE" },
        category: "Lifestyle",
      }],
    }));
    const codexHome = path.join(temporaryRoot, "home");
    await mkdir(codexHome, { recursive: true });
    const env = { CODEX_HOME: codexHome };

    await run("codex", ["plugin", "marketplace", "add", marketplaceRoot, "--json"], env);
    const available = JSON.parse((await run("codex", ["plugin", "list", "--marketplace", codexMarketplaceName, "--available", "--json"], env)).stdout);
    assert.equal(available.available[0]?.pluginId, `${codexPluginName}@${codexMarketplaceName}`);
    await run("codex", ["plugin", "add", `${codexPluginName}@${codexMarketplaceName}`, "--json"], env);
    const installed = JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout);
    assert.equal(installed.installed[0]?.pluginId, `${codexPluginName}@${codexMarketplaceName}`);
    assert.equal(installed.installed[0]?.enabled, true);
    const mcpServers = JSON.parse((await run("codex", ["mcp", "list", "--json"], env)).stdout);
    const localMcp = mcpServers.find((server) => server.name === "fullwell-local");
    assert.equal(localMcp?.transport.command, "node");
    assert.deepEqual(localMcp?.transport.args, ["./runtime/local-household-mcp.mjs"]);
    assert.match(localMcp?.transport.cwd, /plugins[/\\]cache[/\\]fullwell[/\\]fullwell[/\\][^/\\]+[/\\]\.$/);
    assert.ok(mcpServers.some((server) => server.name === "household-food-journal"));
    await run("codex", ["plugin", "remove", `${codexPluginName}@${codexMarketplaceName}`, "--json"], env);
    assert.deepEqual(JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout).installed, []);
    await run("codex", ["plugin", "add", `${codexPluginName}@${codexMarketplaceName}`, "--json"], env);
    assert.equal(JSON.parse((await run("codex", ["plugin", "list", "--json"], env)).stdout).installed[0]?.enabled, true);
    await run("codex", ["plugin", "remove", `${codexPluginName}@${codexMarketplaceName}`, "--json"], env);
    await run("codex", ["plugin", "marketplace", "remove", codexMarketplaceName, "--json"], env);
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
    await createPluginCopy(marketplaceRoot, claudePluginName);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
      name: claudeMarketplaceName,
      owner: { name: "Fullwell" },
      plugins: [{
        name: claudePluginName,
        source: `./plugins/${claudePluginName}`,
        description: "Keep an evidence-backed family food journal.",
        version: "1.0.0",
      }],
    }));
    const configRoot = path.join(temporaryRoot, "home");
    const env = { CLAUDE_CONFIG_DIR: configRoot };
    const runClaude = async (args) => await run("claude", args, env, temporaryRoot);

    await runClaude(["plugin", "marketplace", "add", marketplaceRoot, "--scope", "user"]);
    const available = JSON.parse((await runClaude(["plugin", "list", "--available", "--json"])).stdout);
    assert.equal(available.available[0]?.pluginId, `${claudePluginName}@${claudeMarketplaceName}`);
    await runClaude(["plugin", "install", `${claudePluginName}@${claudeMarketplaceName}`, "--scope", "user"]);
    assert.equal(installedPlugins((await runClaude(["plugin", "list", "--json"])).stdout)[0]?.enabled, true);
    const mcpServers = (await runClaude(["mcp", "list"])).stdout;
    assert.match(mcpServers, /plugin:fullwell:fullwell-local:.*Connected/);
    assert.match(mcpServers, /household-food-journal/);
    await runClaude(["plugin", "disable", `${claudePluginName}@${claudeMarketplaceName}`, "--scope", "user"]);
    assert.equal(installedPlugins((await runClaude(["plugin", "list", "--json"])).stdout)[0]?.enabled, false);
    await runClaude(["plugin", "enable", `${claudePluginName}@${claudeMarketplaceName}`, "--scope", "user"]);
    await runClaude(["plugin", "update", `${claudePluginName}@${claudeMarketplaceName}`, "--scope", "user"]);
    await runClaude(["plugin", "uninstall", `${claudePluginName}@${claudeMarketplaceName}`, "--scope", "user", "--yes"]);
    assert.deepEqual(installedPlugins((await runClaude(["plugin", "list", "--json"])).stdout), []);
    await runClaude(["plugin", "marketplace", "remove", claudeMarketplaceName]);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
