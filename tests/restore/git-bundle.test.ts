import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { HouseholdIdSchema } from "@hfj/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { GitHouseholdRepository } from "../../apps/server/src/git/git-repository.js";

const exec = promisify(execFile);
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("household restore", () => {
  it("restores a verified Git bundle into an isolated repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-restore-test-"));
    cleanup.push(root);
    const repository = new GitHouseholdRepository({
      repositoryRoot: join(root, "repositories"),
      worktreeRoot: join(root, "worktrees"),
      requireSigning: false,
    });
    const householdId = HouseholdIdSchema.parse("hsh_0000000000000201");
    await repository.provision(householdId, "Restore Kitchen", "act_0000000000000201", "2026-07-15T12:00:00.000Z");
    const bundlePath = join(root, "household.bundle");
    await writeFile(bundlePath, await repository.bundle(householdId));

    const restoredPath = join(root, "restored");
    await exec("git", ["clone", "--quiet", bundlePath, restoredPath]);
    await exec("git", ["-C", restoredPath, "fsck", "--no-dangling"]);
    await expect(readFile(join(restoredPath, "FORMAT_VERSION"), "utf8")).resolves.toBe("1\n");
    await expect(readFile(join(restoredPath, "household.md"), "utf8")).resolves.toContain("Restore Kitchen");
  });
});
