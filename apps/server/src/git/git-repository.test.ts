import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  ActorIdSchema,
  HouseholdIdSchema,
  RequestIdSchema,
  RESTOCKING_SNAPSHOT_MAX_FILES,
} from "@hfj/contracts";
import { assertRepositoryCapacity, GitHouseholdRepository, MAX_RECONCILABLE_REPOSITORY_FILES } from "./git-repository.js";

describe("GitHouseholdRepository", () => {
  it("bounds the prospective tree and rejects duplicate mutation paths", () => {
    const currentPaths = Array.from({ length: MAX_RECONCILABLE_REPOSITORY_FILES - 1 }, (_, index) => `snacks/items/item-${index}.md`);
    expect(() => assertRepositoryCapacity(currentPaths, [], "audit/2026/req_0123456789abcdef.json")).not.toThrow();
    expect(() => assertRepositoryCapacity([...currentPaths, "profiles/snacks.md"], [], "audit/2026/req_0123456789abcdef.json")).toThrow("repository capacity");
    expect(() => assertRepositoryCapacity([], [
      { path: "profiles/snacks.md", content: "first", appendOnly: false },
      { path: "profiles/snacks.md", content: "second", appendOnly: false },
    ], "audit/2026/req_0123456789abcdef.json")).toThrow("only once");
  });

  it("provisions, commits, verifies, and exports a household repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-git-test-"));
    try {
      const repository = new GitHouseholdRepository({ repositoryRoot: join(root, "repositories"), worktreeRoot: join(root, "worktrees"), requireSigning: false });
      const householdId = HouseholdIdSchema.parse("hsh_0123456789abcdef");
      const actorId = ActorIdSchema.parse("act_0123456789abcdef");
      const head = await repository.provision(householdId, "Kitchen", actorId, "2026-07-15T12:00:00.000Z");
      expect(await repository.provision(householdId, "Ignored", actorId, "2026-07-15T12:00:30.000Z")).toBe(head);
      const requestId = RequestIdSchema.parse("req_0123456789abcdef");
      expect(await repository.findCommitByRequestId(householdId, requestId)).toBeNull();
      const committed = await repository.commit(householdId, head, [{ path: "profiles/snacks.md", content: "# Shops\n", appendOnly: false }], {
        requestId, householdId, actorId, tool: "hfj_update_profile", client: "test", summary: "profiles: update snacks", occurredAt: "2026-07-15T12:01:00.000Z",
      });
      expect(committed).not.toBe(head);
      expect(await repository.findCommitByRequestId(householdId, requestId)).toBe(committed);
      expect(await repository.read(householdId, "profiles/snacks.md")).toBe("# Shops\n");
      expect(await repository.read(householdId, "profiles/missing.md")).toBeNull();
      expect((await repository.verify(householdId)).valid).toBe(true);
      expect(await repository.objectCount(householdId)).toBeGreaterThan(0);
      expect(await repository.verifySignatures(householdId)).toMatchObject({ valid: false, detail: "allowed_signers_not_configured" });
      expect((await repository.bundle(householdId)).byteLength).toBeGreaterThan(100);
      await expect(repository.commit(householdId, head, [], {
        requestId: RequestIdSchema.parse("req_0123456789abcdee"), householdId, actorId, tool: "hfj_update_profile", client: "test", summary: "stale", occurredAt: "2026-07-15T12:02:00.000Z",
      })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

      const appendHead = await repository.commit(householdId, committed, [{ path: "snacks/evidence/2026/evd_0123456789abcdef.json", content: "{}\n", appendOnly: true }], {
        requestId: RequestIdSchema.parse("req_0123456789abcd01"), householdId, actorId, tool: "hfj_append_evidence", client: "test", summary: "append", occurredAt: "2026-07-15T12:03:00.000Z",
      });
      await expect(repository.commit(householdId, appendHead, [{ path: "snacks/evidence/2026/evd_0123456789abcdef.json", content: "{}\n", appendOnly: true }], {
        requestId: RequestIdSchema.parse("req_0123456789abcd02"), householdId, actorId, tool: "hfj_append_evidence", client: "test", summary: "append twice", occurredAt: "2026-07-15T12:04:00.000Z",
      })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

      await expect(repository.commit(householdId, appendHead, [{ path: "../escape", content: "bad", appendOnly: false }], {
        requestId: RequestIdSchema.parse("req_0123456789abcd03"), householdId, actorId, tool: "hfj_update_profile", client: "test", summary: "invalid path", occurredAt: "2026-07-15T12:05:00.000Z",
      })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

      const missingId = HouseholdIdSchema.parse("hsh_fedcba9876543210");
      expect(await repository.verify(missingId)).toMatchObject({ valid: false, detail: "GitProcessError" });
      expect(await repository.verifySignatures(missingId)).toMatchObject({ valid: false, detail: "GitProcessError" });
      const signingRepository = new GitHouseholdRepository({ repositoryRoot: join(root, "signed-repositories"), worktreeRoot: join(root, "signed-worktrees"), requireSigning: true });
      await expect(signingRepository.provision(missingId, "Signed", actorId, "2026-07-15T12:06:00.000Z")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30_000);

  it("commits 20,000 onboarding paths without process argument expansion", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-git-bulk-test-"));
    try {
      const repository = new GitHouseholdRepository({ repositoryRoot: join(root, "repositories"), worktreeRoot: join(root, "worktrees"), requireSigning: false });
      const householdId = HouseholdIdSchema.parse("hsh_2123456789abcdef");
      const actorId = ActorIdSchema.parse("act_2123456789abcdef");
      const head = await repository.provision(householdId, "Bulk Kitchen", actorId, "2026-07-22T12:00:00.000Z");
      const evidence = Array.from({ length: 10_000 }, (_, index) => ({
        path: `snacks/evidence/2026/evd_${index.toString(16).padStart(16, "0")}.json`,
        content: "{}\n",
        appendOnly: true,
      }));
      const items = Array.from({ length: 10_000 }, (_, index) => ({
        path: `snacks/items/itm_${index.toString(16).padStart(16, "0")}.md`,
        content: "---\nschema_version: 1\n---\n",
        appendOnly: false,
      }));
      const committed = await repository.commit(householdId, head, [...evidence, ...items], {
        requestId: RequestIdSchema.parse("req_2123456789abcdef"),
        householdId,
        actorId,
        tool: "hfj_commit_onboarding",
        client: "test",
        summary: "onboarding: commit bulk fixture",
        occurredAt: "2026-07-22T12:01:00.000Z",
      });
      expect(committed).not.toBe(head);
      expect(await repository.read(householdId, items.at(-1)?.path ?? "missing")).toContain("schema_version");
      const snapshot = await repository.restockingSnapshot(householdId);
      expect(snapshot.files).toHaveLength(20_001);
      expect(snapshot.files.length).toBeLessThanOrEqual(RESTOCKING_SNAPSHOT_MAX_FILES);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);

  it("signs and verifies every commit with the configured SSH identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-git-signing-test-"));
    try {
      const signingKey = join(root, "signing-key");
      const generated = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", signingKey], { encoding: "utf8" });
      if (generated.status !== 0) throw new Error(`Unable to generate SSH test key: ${generated.stderr}`);
      const allowedSignersFile = join(root, "allowed-signers");
      await writeFile(allowedSignersFile, `service@invalid.local ${(await readFile(`${signingKey}.pub`, "utf8")).trim()}\n`, { mode: 0o600 });
      const repository = new GitHouseholdRepository({
        repositoryRoot: join(root, "repositories"), worktreeRoot: join(root, "worktrees"),
        signingKey, allowedSignersFile, requireSigning: true,
      });
      const householdId = HouseholdIdSchema.parse("hsh_1123456789abcdef");
      await repository.provision(householdId, "Signed Kitchen", ActorIdSchema.parse("act_1123456789abcdef"), "2026-07-15T12:00:00.000Z");
      await expect(repository.verifySignatures(householdId)).resolves.toMatchObject({ valid: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
});
