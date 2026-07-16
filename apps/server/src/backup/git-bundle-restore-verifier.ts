import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackupManifest, BackupRestoreVerifier } from "./backup-service.js";

export class GitBundleRestoreVerifier implements BackupRestoreVerifier {
  private readonly allowedSignersFile: string | undefined;
  constructor(options: { readonly requireSignatures: boolean; readonly allowedSignersFile?: string }) {
    if (options.requireSignatures && options.allowedSignersFile === undefined) throw new Error("An allowed-signers file is required for restore verification");
    this.allowedSignersFile = options.requireSignatures ? options.allowedSignersFile : undefined;
  }

  async verify(bundle: Uint8Array, manifest: BackupManifest): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "hfj-restore-drill-"));
    const bundlePath = join(root, "household.bundle");
    const inspectionRepository = join(root, "inspection.git");
    const restoredRepository = join(root, "restored.git");
    try {
      await writeFile(bundlePath, bundle, { mode: 0o600 });
      await git(["init", "--quiet", "--bare", inspectionRepository]);
      await git(["--git-dir", inspectionRepository, "bundle", "verify", bundlePath]);
      await git(["clone", "--quiet", "--bare", bundlePath, restoredRepository]);
      await git(["--git-dir", restoredRepository, "fsck", "--full", "--no-dangling"]);
      const head = (await git(["--git-dir", restoredRepository, "rev-parse", "refs/heads/main"])).trim();
      if (head !== manifest.repository_head) throw new Error("Restored repository HEAD does not match the manifest");
      const objects = (await git(["--git-dir", restoredRepository, "rev-list", "--objects", "--all"])).trim().split("\n").filter(Boolean);
      if (objects.length !== manifest.object_count) throw new Error("Restored repository object count does not match the manifest");
      if (this.allowedSignersFile !== undefined) {
        const commits = (await git(["--git-dir", restoredRepository, "rev-list", "--all"])).trim().split("\n").filter(Boolean);
        for (const commit of commits) await git([
          "-c", "gpg.format=ssh", "-c", `gpg.ssh.allowedSignersFile=${this.allowedSignersFile}`,
          "--git-dir", restoredRepository, "verify-commit", commit,
        ]);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

async function git(args: ReadonlyArray<string>): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      shell: false,
      env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", HOME: process.env.HOME ?? "/nonexistent", LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
      else reject(new Error(`Git restore verification failed: ${Buffer.concat(stderr).toString("utf8").slice(0, 1000)}`));
    });
  });
}
