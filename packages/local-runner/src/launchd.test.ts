import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LaunchdManager, renderLaunchAgent } from "./launchd.js";

describe("LaunchdManager", () => {
  it("renders a fixed secret-free LaunchAgent definition", () => {
    const definition = renderLaunchAgent(["/usr/local/bin/node", "/opt/fullwell/cli.js", "run"], "/tmp/fullwell&logs", "chrome");
    expect(definition).toContain("com.fullwell.local-runner");
    expect(definition).toContain("/opt/fullwell/cli.js");
    expect(definition).toContain("/tmp/fullwell&amp;logs/runner.log");
    expect(definition).toContain("BROWSER_USE_AVAILABLE_BACKENDS");
    expect(definition).toContain("<string>chrome</string>");
    expect(definition.split("<string>chrome</string>")).toHaveLength(2);
    expect(definition).not.toMatch(/access.token|refresh.token|authorization/i);

    const safari = renderLaunchAgent(["/usr/local/bin/node", "/opt/fullwell/cli.js", "run"], "/tmp/fullwell-logs", "safari");
    expect(safari).not.toContain("BROWSER_USE_AVAILABLE_BACKENDS");
    expect(safari).not.toContain("<string>safari</string>");
  });

  it("installs, inspects, and removes the per-user LaunchAgent idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-launchd-"));
    try {
      const calls: string[][] = [];
      const execute = vi.fn(async (_file: string, args: readonly string[]) => {
        calls.push([...args]);
        return { stdout: "", stderr: "" };
      });
      const plist = join(root, "LaunchAgents/com.fullwell.local-runner.plist");
      const manager = new LaunchdManager(plist, execute);
      await manager.install(["/usr/local/bin/node", "/opt/fullwell/cli.js", "run"], join(root, "logs"), "chrome");
      expect((await stat(plist)).mode & 0o777).toBe(0o600);
      expect(await manager.readDefinition()).toContain("/usr/local/bin/node");
      expect(await manager.status()).toBe("running");
      expect(calls.some((args) => args[0] === "bootstrap")).toBe(true);
      expect(calls).toContainEqual(["bootout", expect.stringMatching(/^gui\/\d+$/), plist]);
      await manager.uninstall();
      expect(await manager.readDefinition()).toBeNull();
      await expect(manager.install(["relative-node"], join(root, "logs"), "chrome")).rejects.toThrow(/absolute path/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports stopped jobs and surfaces unexpected launchctl and file errors", async () => {
    const stopped = new LaunchdManager("/tmp/missing-fullwell.plist", async () => {
      throw Object.assign(new Error("not loaded"), { code: 3 });
    });
    await expect(stopped.status()).resolves.toBe("stopped");

    const unexpected = new LaunchdManager("/tmp", async () => {
      throw Object.assign(new Error("launchctl failed"), { code: 0 });
    });
    await expect(unexpected.status()).rejects.toThrow(/launchctl failed/);
    await expect(unexpected.readDefinition()).rejects.toThrow();
  });
});
