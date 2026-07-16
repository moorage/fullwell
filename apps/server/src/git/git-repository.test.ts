import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ActorIdSchema, HouseholdIdSchema, RequestIdSchema } from "@hfj/contracts";
import { GitHouseholdRepository } from "./git-repository.js";

describe("GitHouseholdRepository", () => {
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
      const signingRepository = new GitHouseholdRepository({ repositoryRoot: join(root, "signed-repositories"), worktreeRoot: join(root, "signed-worktrees"), requireSigning: true });
      await expect(signingRepository.provision(missingId, "Signed", actorId, "2026-07-15T12:06:00.000Z")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 15_000);
});
