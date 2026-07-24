import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalHouseholdError } from "../../runtime/local-household.mjs";
import { stopLocalWhatsAppRunner } from "../../runtime/local-runner-control.mjs";

function exitError(code) {
  return Object.assign(new Error(`exit ${code}`), { code });
}

async function withHome(run) {
  const home = await mkdtemp(path.join(tmpdir(), "fullwell-runner-control-"));
  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("runner stop unloads only the fixed Fullwell service and preserves connection data", async () => {
  await withHome(async (home) => {
    const launchAgents = path.join(home, "Library", "LaunchAgents");
    const plist = path.join(launchAgents, "com.fullwell.local-runner.plist");
    await mkdir(launchAgents, { recursive: true });
    await writeFile(plist, "runner definition");
    const calls = [];
    const result = await stopLocalWhatsAppRunner({
      platform: "darwin",
      home,
      uid: 501,
      execute: async (file, args) => {
        calls.push([file, args]);
        if (args[0] === "print") throw exitError(113);
      },
    });

    assert.deepEqual(result, {
      status: "stopped",
      connection_preserved: true,
      restart_command: "fullwell-runner install",
    });
    assert.deepEqual(calls, [
      ["/bin/launchctl", ["bootout", "gui/501/com.fullwell.local-runner"]],
      ["/bin/launchctl", ["print", "gui/501/com.fullwell.local-runner"]],
    ]);
    await assert.rejects(readFile(plist), (error) => error.code === "ENOENT");
  });
});

test("runner stop is idempotent and rejects a service that remains loaded", async () => {
  await withHome(async (home) => {
    const stopped = await stopLocalWhatsAppRunner({
      platform: "darwin",
      home,
      uid: 501,
      execute: async () => {
        throw exitError(113);
      },
    });
    assert.equal(stopped.status, "already_stopped");

    await assert.rejects(
      stopLocalWhatsAppRunner({
        platform: "darwin",
        home,
        uid: 501,
        execute: async () => ({ stdout: "", stderr: "" }),
      }),
      (error) => error instanceof LocalHouseholdError && error.code === "RUNNER_STOP_FAILED",
    );
  });
});
