import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HouseholdIdSchema } from "@hfj/contracts";
import { describe, expect, it } from "vitest";
import { restockingSnapshotPrompt, SnapshotCache } from "./snapshot-cache.js";
import { snapshotResponse } from "./testing/snapshot.fixture.js";

const householdId = HouseholdIdSchema.parse("hsh_0000000000000801");

describe("SnapshotCache", () => {
  it("validates and atomically installs current and previous snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-snapshot-test-"));
    try {
      const cache = new SnapshotCache(root);
      expect(await cache.current(householdId)).toBeNull();
      const first = await cache.install(householdId, snapshotResponse("a"));
      await expect(cache.install(householdId, snapshotResponse("a"))).resolves.toMatchObject({ head: first.head });
      expect(await readFile(join(first.directory, "snacks/items/cashews.md"), "utf8")).toBe("# Salted cashews\n");
      expect(await readFile(join(first.directory, "ingredients/items/parsley.md"), "utf8")).toBe("# Flat-leaf parsley\n");
      expect((await stat(join(first.directory, "snacks/items/cashews.md"))).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await restockingSnapshotPrompt(first.directory))).toEqual(expect.arrayContaining([
        { path: "snacks/items/cashews.md", content: "# Salted cashews\n" },
        { path: "ingredients/items/parsley.md", content: "# Flat-leaf parsley\n" },
        { path: "condiments/items/mayonnaise.md", content: "# Standard mayonnaise\n" },
        { path: "groceries/items/dish-soap.md", content: "# Dish soap\n" },
        { path: "groceries/evidence/2026/order-one.json", content: "{\"store\":\"Market\"}\n" },
      ]));
      await mkdir(join(first.directory, "outside-allowlist"));
      await expect(restockingSnapshotPrompt(first.directory)).rejects.toThrow(/directory outside/);
      await rm(join(first.directory, "outside-allowlist"), { recursive: true });
      const second = await cache.install(householdId, snapshotResponse("b"));
      const third = await cache.install(householdId, snapshotResponse("c"));
      expect((await cache.current(householdId))?.head).toBe(third.head);
      await expect(stat(first.directory)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(second.directory)).resolves.toBeDefined();
      await cache.purge(householdId);
      expect(await cache.current(householdId)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects tampering, traversal, and manifest/archive mismatch", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-snapshot-invalid-"));
    try {
      const cache = new SnapshotCache(root);
      const tampered = snapshotResponse();
      const firstFile = tampered.manifest.files[0];
      if (firstFile === undefined) throw new Error("Fixture has no manifest files");
      tampered.manifest.files[0] = { ...firstFile, sha256: "0".repeat(64) };
      await expect(cache.install(householdId, tampered)).rejects.toThrow(/hash/);
      const traversal = snapshotResponse("b", { FORMAT_VERSION: "1\n", "../escape.md": "bad\n" });
      await expect(cache.install(householdId, traversal)).rejects.toThrow(/allowlist/);
      const missing = snapshotResponse("c");
      missing.manifest.files.pop();
      await expect(cache.install(householdId, missing)).rejects.toThrow(/paths/);

      const wrongHousehold = snapshotResponse("d");
      wrongHousehold.manifest.household_id = HouseholdIdSchema.parse("hsh_0000000000000802");
      await expect(cache.install(householdId, wrongHousehold)).rejects.toThrow(/household/);

      const wrongSize = snapshotResponse("e");
      const sizedFile = wrongSize.manifest.files[0];
      if (sizedFile === undefined) throw new Error("Fixture has no manifest files");
      wrongSize.manifest.files[0] = { ...sizedFile, bytes: sizedFile.bytes + 1 };
      await expect(cache.install(householdId, wrongSize)).rejects.toThrow(/size/);

      await expect(cache.install(householdId, snapshotResponse("f", { FORMAT_VERSION: "1\r\n" }))).rejects.toThrow(/LF line endings/);
      const wrongContentHash = snapshotResponse("1");
      wrongContentHash.manifest.content_sha256 = "0".repeat(64);
      await expect(cache.install(householdId, wrongContentHash)).rejects.toThrow(/content hash/);

      await mkdir(join(root, "households", householdId), { recursive: true });
      await writeFile(join(root, "households", householdId, "current"), "not-a-head\n", "utf8");
      await expect(cache.current(householdId)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
