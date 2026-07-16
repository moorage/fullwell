import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActorIdSchema, GitObjectIdSchema, HouseholdIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { GitHouseholdRepository } from "../git/git-repository.js";
import { GitBundleRestoreVerifier } from "./git-bundle-restore-verifier.js";

describe("GitBundleRestoreVerifier", () => {
  it("verifies and restores a real household bundle in isolation", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-restore-verifier-test-"));
    try {
      const householdId = HouseholdIdSchema.parse("hsh_0000000000000601");
      const signingKey = join(root, "signing-key");
      const generated = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", signingKey], { encoding: "utf8" });
      if (generated.status !== 0) throw new Error(`Unable to generate SSH test key: ${generated.stderr}`);
      const allowedSignersFile = join(root, "allowed-signers");
      await writeFile(allowedSignersFile, `service@invalid.local ${(await readFile(`${signingKey}.pub`, "utf8")).trim()}\n`, { mode: 0o600 });
      const repository = new GitHouseholdRepository({
        repositoryRoot: join(root, "households"), worktreeRoot: join(root, "worktrees"),
        signingKey, allowedSignersFile, requireSigning: true,
      });
      const head = await repository.provision(householdId, "Restore Test", ActorIdSchema.parse("act_0000000000000601"), "2026-07-15T12:00:00.000Z");
      const bundle = await repository.bundle(householdId);
      const objectCount = await repository.objectCount(householdId);

      const manifest = {
        schema_version: 1,
        household_id: householdId,
        repository_head: head,
        object_count: objectCount,
        bundle_sha256: "a".repeat(64),
        created_at: "2026-07-15T12:00:00.000Z",
        retained_until: "2026-08-19T12:00:00.000Z",
      } as const;
      const verifier = new GitBundleRestoreVerifier({ requireSignatures: true, allowedSignersFile });
      await expect(verifier.verify(bundle, manifest)).resolves.toBeUndefined();
      await expect(verifier.verify(bundle, { ...manifest, repository_head: GitObjectIdSchema.parse("f".repeat(40)) })).rejects.toThrow(/HEAD/);
      await expect(verifier.verify(bundle, { ...manifest, object_count: objectCount + 1 })).rejects.toThrow(/object count/);
      expect(() => new GitBundleRestoreVerifier({ requireSignatures: true })).toThrow(/allowed-signers/);
      expect(() => new GitBundleRestoreVerifier({ requireSignatures: false })).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
