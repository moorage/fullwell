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
      const committed = await repository.commit(householdId, head, [{ path: "profiles/snacks.md", content: "# Shops\n", appendOnly: false }], {
        requestId: RequestIdSchema.parse("req_0123456789abcdef"), householdId, actorId, tool: "hfj_update_profile", client: "test", summary: "profiles: update snacks", occurredAt: "2026-07-15T12:01:00.000Z",
      });
      expect(committed).not.toBe(head);
      expect(await repository.read(householdId, "profiles/snacks.md")).toBe("# Shops\n");
      expect((await repository.verify(householdId)).valid).toBe(true);
      expect((await repository.bundle(householdId)).byteLength).toBeGreaterThan(100);
      await expect(repository.commit(householdId, head, [], {
        requestId: RequestIdSchema.parse("req_0123456789abcdee"), householdId, actorId, tool: "hfj_update_profile", client: "test", summary: "stale", occurredAt: "2026-07-15T12:02:00.000Z",
      })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
