import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileExportArtifactStore, MemoryExportArtifactStore } from "./artifact-store.js";

describe("export artifact stores", () => {
  it("writes private files, reads them, and removes them idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-exports-"));
    try {
      const store = new FileExportArtifactStore(root);
      const path = await store.write("exp_0000000000000001", new Uint8Array([1, 2, 3]));
      expect(Array.from(await store.read(path))).toEqual([1, 2, 3]);
      expect((await stat(join(root, path))).mode & 0o777).toBe(0o600);
      await store.remove(path);
      await expect(store.read(path)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(store.remove(path)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects traversal, duplicate writes, and oversized artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "hfj-exports-"));
    try {
      const store = new FileExportArtifactStore(root, 2);
      await expect(store.write("../escape", new Uint8Array())).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(store.read("../escape.bin")).rejects.toMatchObject({ code: "NOT_FOUND" });
      await store.write("exp_0000000000000001", new Uint8Array([1]));
      await expect(store.write("exp_0000000000000001", new Uint8Array([1]))).rejects.toMatchObject({ code: "EEXIST" });
      await expect(store.write("exp_0000000000000002", new Uint8Array([1, 2, 3]))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(new MemoryExportArtifactStore(2).write("exp_0000000000000003", new Uint8Array([1, 2, 3]))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
