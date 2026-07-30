import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findSensitiveFindings,
  scanSensitiveContent,
} from "./check-sensitive-content.mjs";

const scriptPath = fileURLToPath(new URL("./check-sensitive-content.mjs", import.meta.url));
const constructedGitHubToken = ["ghp", "123456789012345678901234567890123456"].join("_");

assert.deepEqual(
  findSensitiveFindings({ filePath: ".env.example", content: "TOKEN=replace-me\n" }),
  [],
  "example environment files are allowed",
);
assert.deepEqual(
  findSensitiveFindings({ filePath: "docs/path.md", content: "Use /Users/ as the generic macOS root.\n" }),
  [],
  "generic platform paths are allowed",
);
assert.equal(
  findSensitiveFindings({ filePath: ".beads/issues.jsonl", content: "{}\n" })[0]?.kind,
  "private Beads export",
  "private tracker exports are rejected",
);
assert.equal(
  findSensitiveFindings({ filePath: "notes.txt", content: `token=${constructedGitHubToken}\n` })[0]?.kind,
  "GitHub access token",
  "recognizable credentials are rejected",
);
assert.equal(
  findSensitiveFindings({
    filePath: "notes.txt",
    content: `source=${["", "Users", "private-user", "Desktop", "input.png"].join("/")}\n`,
  })[0]?.kind,
  "personal macOS home path",
  "author-identifying home paths are rejected",
);

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "sensitive-content-test-"));
try {
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: tempRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init", "--quiet");
  writeFileSync(path.join(tempRoot, "candidate.txt"), `credential=${constructedGitHubToken}\n`, "utf8");
  git("add", "candidate.txt");

  const rejected = spawnSync(process.execPath, [scriptPath, "--staged"], {
    cwd: tempRoot,
    encoding: "utf8",
  });
  assert.equal(rejected.status, 1, "the staged-file boundary rejects sensitive content");
  assert.match(rejected.stderr, /candidate\.txt:1: GitHub access token/);
  assert.doesNotMatch(rejected.stderr, new RegExp(constructedGitHubToken));

  writeFileSync(path.join(tempRoot, "candidate.txt"), "credential=read-from-runtime-secret-store\n", "utf8");
  git("add", "candidate.txt");
  const accepted = spawnSync(process.execPath, [scriptPath, "--staged"], {
    cwd: tempRoot,
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /sensitive-content check passed/);

  assert.deepEqual(await scanSensitiveContent({ cwd: tempRoot }), []);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("sensitive-content tests passed.");
