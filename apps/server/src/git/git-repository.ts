import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { GitObjectId, HouseholdId, RequestId } from "@hfj/contracts";
import { GitObjectIdSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import type { CommitMetadata, HouseholdRepositoryPort, RepositoryChange, RepositorySnapshot, RestockingRepositorySnapshot } from "../core/ports.js";
import { isRestockingSnapshotPath } from "../core/restocking-snapshot.js";
import { stableJson, validateRepositoryPath } from "../adapters/memory.js";
import { assertExportSize } from "../exports/policy.js";

export const MAX_RECONCILABLE_REPOSITORY_FILES = 50_000;

interface GitRepositoryOptions {
  readonly repositoryRoot: string;
  readonly worktreeRoot: string;
  readonly signingKey?: string;
  readonly allowedSignersFile?: string;
  readonly requireSigning: boolean;
}

export class GitHouseholdRepository implements HouseholdRepositoryPort {
  private readonly repositoryRoot: string;
  private readonly worktreeRoot: string;
  constructor(private readonly options: GitRepositoryOptions) {
    this.repositoryRoot = resolve(options.repositoryRoot);
    this.worktreeRoot = resolve(options.worktreeRoot);
  }

  async provision(householdId: HouseholdId, name: string, actorId: string, occurredAt: string): Promise<GitObjectId> {
    await mkdir(this.repositoryRoot, { recursive: true, mode: 0o700 });
    await mkdir(this.worktreeRoot, { recursive: true, mode: 0o700 });
    const bare = this.repositoryPath(householdId);
    try { await stat(bare); return await this.head(householdId); } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    const worktree = await mkdtemp(join(this.worktreeRoot, "provision-"));
    try {
      await git(["init", "--quiet", "--initial-branch=main", worktree]);
      await this.write(worktree, "FORMAT_VERSION", "1\n");
      await this.write(worktree, "household.md", `---\nname: ${JSON.stringify(name)}\nschema_version: 1\n---\n`);
      await this.write(worktree, `members/${actorId}.md`, "---\nrole: owner\nschema_version: 1\n---\n");
      await git(["-C", worktree, "add", "--", "FORMAT_VERSION", "household.md", `members/${actorId}.md`]);
      await git(["-C", worktree, ...this.commitArgs("households: initialize journal", occurredAt)]);
      await git(["clone", "--quiet", "--bare", worktree, bare]);
      return await this.head(householdId);
    } finally { await rm(worktree, { recursive: true, force: true }); }
  }

  async head(householdId: HouseholdId): Promise<GitObjectId> {
    return GitObjectIdSchema.parse((await git(["--git-dir", this.repositoryPath(householdId), "rev-parse", "refs/heads/main"])).trim());
  }

  async findCommitByRequestId(householdId: HouseholdId, requestId: RequestId): Promise<GitObjectId | null> {
    const output = (await git([
      "--git-dir", this.repositoryPath(householdId), "log", "refs/heads/main", "--format=%H",
      `--grep=^Request-ID: ${requestId}$`, "--max-count=1",
    ])).trim();
    return output === "" ? null : GitObjectIdSchema.parse(output);
  }

  async snapshot(householdId: HouseholdId): Promise<RepositorySnapshot> {
    const repository = this.repositoryPath(householdId);
    const head = await this.head(householdId);
    const paths = (await git(["--git-dir", repository, "ls-tree", "-r", "--name-only", "refs/heads/main"])).trim().split("\n").filter(Boolean);
    if (paths.length > MAX_RECONCILABLE_REPOSITORY_FILES) throw new AppError("PROJECTION_DRIFT", "Household repository contains too many files to reconcile");
    const files = [];
    for (const path of paths) {
      validateRepositoryPath(path);
      const [content, revisionOutput] = await Promise.all([
        git(["--git-dir", repository, "show", `refs/heads/main:${path}`]),
        git(["--git-dir", repository, "log", "-1", "--format=%H", "refs/heads/main", "--", path]),
      ]);
      files.push({ path, content, revision: GitObjectIdSchema.parse(revisionOutput.trim()) });
    }
    return { head, files };
  }

  async restockingSnapshot(householdId: HouseholdId): Promise<RestockingRepositorySnapshot> {
    const repository = this.repositoryPath(householdId);
    const head = await this.head(householdId);
    const tree = await git([
      "--git-dir", repository, "ls-tree", "-rz", "--format=%(objectmode)%x09%(objecttype)%x09%(path)", head,
    ]);
    const paths = restockingPathsFromTree(tree);
    if (paths.length > 2_000) throw new AppError("PROJECTION_DRIFT", "Household repository contains too many restocking files");
    const files = await Promise.all(paths.map(async (path) => ({ path, content: await git(["--git-dir", repository, "show", `${head}:${path}`]) })));
    return { head, files };
  }

  async commit(householdId: HouseholdId, expectedHead: GitObjectId, changes: ReadonlyArray<RepositoryChange>, metadata: CommitMetadata): Promise<GitObjectId> {
    for (const change of changes) validateRepositoryPath(change.path);
    const worktree = await mkdtemp(join(this.worktreeRoot, "mutation-"));
    try {
      await git(["clone", "--quiet", this.repositoryPath(householdId), worktree]);
      const current = GitObjectIdSchema.parse((await git(["-C", worktree, "rev-parse", "HEAD"])).trim());
      if (current !== expectedHead) throw new AppError("REVISION_CONFLICT", "The household changed while this request was being prepared");
      const auditPath = `audit/${metadata.occurredAt.slice(0, 4)}/${metadata.requestId}.json`;
      const currentPaths = (await git(["-C", worktree, "ls-files", "-z"])).split("\0").filter(Boolean);
      assertRepositoryCapacity(currentPaths, changes, auditPath);
      for (const change of changes) {
        if (change.appendOnly && await exists(join(worktree, change.path))) {
          throw new AppError("REVISION_CONFLICT", `Append-only document already exists: ${change.path}`);
        }
        await this.write(worktree, change.path, change.content);
      }
      await this.write(worktree, auditPath, stableJson({
        actor_id: metadata.actorId,
        affected_paths: changes.map((change) => change.path),
        occurred_at: metadata.occurredAt,
        operation: metadata.tool,
        parent_head: expectedHead,
        request_id: metadata.requestId,
        schema_version: 1,
      }));
      await git(["-C", worktree, "add", "--all"]);
      const message = `${metadata.summary}\n\nActor-ID: ${metadata.actorId}\nHousehold-ID: ${metadata.householdId}\nRequest-ID: ${metadata.requestId}\nTool: ${metadata.tool}\nClient: ${metadata.client}\nSchema-Version: 1`;
      await git(["-C", worktree, ...this.commitArgs(message, metadata.occurredAt)]);
      const committed = GitObjectIdSchema.parse((await git(["-C", worktree, "rev-parse", "HEAD"])).trim());
      await git(["-C", worktree, "push", "--quiet", "origin", "HEAD:refs/heads/main"]);
      return committed;
    } finally { await rm(worktree, { recursive: true, force: true }); }
  }

  async read(householdId: HouseholdId, path: string): Promise<string | null> {
    validateRepositoryPath(path);
    try { return await git(["--git-dir", this.repositoryPath(householdId), "show", `refs/heads/main:${path}`]); }
    catch (error) {
      if (error instanceof GitProcessError && error.stderr.includes("does not exist")) return null;
      throw error;
    }
  }

  async bundle(householdId: HouseholdId): Promise<Uint8Array> {
    const directory = await mkdtemp(join(tmpdir(), "hfj-bundle-"));
    const output = join(directory, `${householdId}.bundle`);
    try {
      await git(["--git-dir", this.repositoryPath(householdId), "bundle", "create", output, "--all"]);
      assertExportSize((await stat(output)).size);
      return await readFile(output);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  async readableArchive(householdId: HouseholdId): Promise<Uint8Array> {
    const directory = await mkdtemp(join(tmpdir(), "hfj-archive-"));
    const output = join(directory, `${householdId}.zip`);
    try {
      validateExportTree(await git([
        "--git-dir", this.repositoryPath(householdId), "ls-tree", "-rz",
        "--format=%(objectmode)%x09%(objecttype)%x09%(path)", "refs/heads/main",
      ]));
      await git(["--git-dir", this.repositoryPath(householdId), "archive", "--format=zip", `--output=${output}`, "refs/heads/main"]);
      assertExportSize((await stat(output)).size);
      return await readFile(output);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  async verify(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }> {
    try {
      await git(["--git-dir", this.repositoryPath(householdId), "fsck", "--no-dangling"]);
      return { valid: true, detail: await this.head(householdId) };
    } catch (error) {
      return { valid: false, detail: error instanceof Error ? error.name : "verification failed" };
    }
  }

  async verifySignatures(householdId: HouseholdId): Promise<{ valid: boolean; detail: string }> {
    try {
      const repository = this.repositoryPath(householdId);
      const commits = (await git(["--git-dir", repository, "rev-list", "--all"])).trim().split("\n").filter(Boolean);
      if (commits.length === 0) return { valid: false, detail: "no_commits" };
      if (this.options.allowedSignersFile === undefined) return { valid: false, detail: "allowed_signers_not_configured" };
      for (const commit of commits) await git([
        "-c", "gpg.format=ssh", "-c", `gpg.ssh.allowedSignersFile=${this.options.allowedSignersFile}`,
        "--git-dir", repository, "verify-commit", commit,
      ]);
      return { valid: true, detail: await this.head(householdId) };
    } catch (error) {
      return { valid: false, detail: error instanceof Error ? error.name : "signature_verification_failed" };
    }
  }

  async objectCount(householdId: HouseholdId): Promise<number> {
    const output = (await git(["--git-dir", this.repositoryPath(householdId), "rev-list", "--objects", "--all"])).trim();
    return output === "" ? 0 : output.split("\n").length;
  }

  private repositoryPath(householdId: HouseholdId): string {
    const path = resolve(this.repositoryRoot, `${householdId}.git`);
    if (dirname(path) !== this.repositoryRoot) throw new AppError("VALIDATION_FAILED", "Household repository path escaped its root");
    return path;
  }

  private async write(worktree: string, path: string, content: string): Promise<void> {
    validateRepositoryPath(path);
    const destination = resolve(worktree, path);
    if (!destination.startsWith(`${worktree}/`)) throw new AppError("VALIDATION_FAILED", "Repository path escaped its worktree");
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, content.replaceAll("\r\n", "\n"), { encoding: "utf8", mode: 0o600 });
  }

  private commitArgs(message: string, occurredAt: string): string[] {
    const signing = this.options.signingKey === undefined ? [] : ["-c", "gpg.format=ssh", "-c", `user.signingKey=${this.options.signingKey}`];
    if (this.options.requireSigning && signing.length === 0) throw new AppError("PROVIDER_UNAVAILABLE", "Git signing is required but not configured");
    return [
      "-c", "core.hooksPath=/dev/null",
      "-c", "user.name=Household Food Journal",
      "-c", "user.email=service@invalid.local",
      ...signing, "commit", "--quiet", ...(signing.length === 0 ? [] : ["-S"]), "--date", occurredAt, "-m", message,
    ];
  }
}

export function validateExportTree(tree: string): void {
  for (const entry of tree.split("\0").filter(Boolean)) {
    const match = /^100644\tblob\t(.+)$/.exec(entry);
    if (match?.[1] === undefined) throw new AppError("PROJECTION_DRIFT", "Household repository contains an unsafe export entry");
    validateRepositoryPath(match[1]);
  }
}

function restockingPathsFromTree(tree: string): string[] {
  const entries = tree.split("\0").filter(Boolean);
  if (entries.length > MAX_RECONCILABLE_REPOSITORY_FILES) throw new AppError("PROJECTION_DRIFT", "Household repository contains too many files");
  const paths: string[] = [];
  for (const entry of entries) {
    const match = /^(\d{6})\t([^\t]+)\t(.+)$/.exec(entry);
    if (match?.[3] === undefined) throw new AppError("PROJECTION_DRIFT", "Household repository contains an invalid tree entry");
    const path = match[3];
    validateRepositoryPath(path);
    if (!isRestockingSnapshotPath(path)) continue;
    if (match[1] !== "100644" || match[2] !== "blob") {
      throw new AppError("PROJECTION_DRIFT", "Household repository contains an unsafe restocking entry");
    }
    paths.push(path);
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

export function assertRepositoryCapacity(
  currentPaths: ReadonlyArray<string>,
  changes: ReadonlyArray<RepositoryChange>,
  auditPath: string,
): void {
  const changePaths = changes.map(({ path }) => path);
  if (new Set(changePaths).size !== changePaths.length) throw new AppError("VALIDATION_FAILED", "A repository path may change only once per mutation");
  for (const path of currentPaths) validateRepositoryPath(path);
  const nextPaths = new Set(currentPaths);
  for (const path of [...changePaths, auditPath]) {
    validateRepositoryPath(path);
    nextPaths.add(path);
  }
  if (nextPaths.size > MAX_RECONCILABLE_REPOSITORY_FILES) {
    throw new AppError("VALIDATION_FAILED", "The mutation would exceed the household repository capacity");
  }
}

class GitProcessError extends Error {
  constructor(readonly stderr: string) { super("Git operation failed"); this.name = "GitProcessError"; }
}

async function git(args: ReadonlyArray<string>): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const process = spawn("git", args, {
      shell: false,
      env: { PATH: processEnvPath(), HOME: "/nonexistent", LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => process.kill("SIGKILL"), 30_000);
    process.stdout.on("data", (chunk: Buffer) => { if (total(stdout) < 10_000_000) stdout.push(chunk); });
    process.stderr.on("data", (chunk: Buffer) => { if (total(stderr) < 1_000_000) stderr.push(chunk); });
    process.on("error", reject);
    process.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(Buffer.concat(stdout).toString("utf8"));
      else reject(new GitProcessError(Buffer.concat(stderr).toString("utf8").slice(0, 4000)));
    });
  });
}

function total(chunks: ReadonlyArray<Buffer>): number { return chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0); }
function processEnvPath(): string { return process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"; }
async function exists(path: string): Promise<boolean> { try { await stat(path); return true; } catch (error) { if (isNotFound(error)) return false; throw error; } }
function isNotFound(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "ENOENT"; }
