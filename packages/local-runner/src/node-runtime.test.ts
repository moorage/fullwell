import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stableNode24Executable } from "./node-runtime.js";

describe("stableNode24Executable", () => {
  it("selects the newest stable Node 24 executable instead of the current unsupported runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-node-runtime-"));
    try {
      const current = join(root, "current-node");
      await writeFile(current, "", "utf8");
      await chmod(current, 0o700);
      for (const version of ["v24.13.0", "v24.15.0", "v25.1.0"]) {
        const directory = join(root, version, "installation/bin");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, "node"), "", "utf8");
        await chmod(join(directory, "node"), 0o700);
      }
      await expect(stableNode24Executable({ currentExecutable: current, currentVersion: "v26.2.0", versionsRoot: root }))
        .resolves.toBe(await realpath(join(root, "v24.15.0/installation/bin/node")));
      await expect(stableNode24Executable({ currentExecutable: current, currentVersion: "v24.1.0", versionsRoot: root }))
        .resolves.toBe(await realpath(current));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing and incomplete Node 24 installations", async () => {
    const root = await mkdtemp(join(tmpdir(), "fullwell-node-runtime-missing-"));
    try {
      const current = join(root, "current-node");
      await writeFile(current, "", "utf8");
      await chmod(current, 0o700);
      await mkdir(join(root, "v24.15.1/installation/bin"), { recursive: true });
      await expect(stableNode24Executable({ currentExecutable: current, currentVersion: "not-a-version", versionsRoot: root }))
        .rejects.toThrow(/requires a stable Node 24/);
      await expect(stableNode24Executable({ currentExecutable: current, currentVersion: "v26.2.0", versionsRoot: join(root, "missing") }))
        .rejects.toThrow(/requires a stable Node 24/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
