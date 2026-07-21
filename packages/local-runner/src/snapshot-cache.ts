import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { unzipSync } from "fflate";
import {
  GitObjectIdSchema,
  HouseholdIdSchema,
  HouseholdSnapshotResponseSchema,
  type GitObjectId,
  type HouseholdId,
  type HouseholdSnapshotResponse,
} from "@hfj/contracts";

const MAX_TOTAL_BYTES = 5 * 1_048_576;

export class SnapshotCache {
  constructor(private readonly root: string) {}

  async current(householdIdInput: HouseholdId): Promise<{ readonly head: GitObjectId; readonly directory: string } | null> {
    const householdId = HouseholdIdSchema.parse(householdIdInput);
    try {
      const head = GitObjectIdSchema.parse((await readFile(this.currentPath(householdId), "utf8")).trim());
      const directory = this.revisionPath(householdId, head);
      await readFile(join(directory, "FORMAT_VERSION"));
      return { head, directory };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async install(householdIdInput: HouseholdId, input: HouseholdSnapshotResponse): Promise<{ readonly head: GitObjectId; readonly directory: string }> {
    const householdId = HouseholdIdSchema.parse(householdIdInput);
    const response = HouseholdSnapshotResponseSchema.parse(input);
    if (response.manifest.household_id !== householdId) throw new Error("Snapshot household did not match the requested household");
    const previous = await this.current(householdId);
    const archiveBytes = Buffer.from(response.archive_base64, "base64");
    let expandedBytes = 0;
    const archive = unzipSync(archiveBytes, {
      filter: (file) => {
        expandedBytes += file.originalSize;
        if (file.originalSize > 1_048_576 || expandedBytes > MAX_TOTAL_BYTES) throw new Error("Snapshot archive exceeds its expanded size limit");
        return true;
      },
    });
    validateArchive(response, archive);
    const householdRoot = this.householdRoot(householdId);
    await mkdir(householdRoot, { recursive: true, mode: 0o700 });
    const target = this.revisionPath(householdId, response.manifest.head);
    const stage = join(householdRoot, `.stage-${response.manifest.head}-${process.pid}`);
    await rm(stage, { recursive: true, force: true });
    await mkdir(stage, { recursive: true, mode: 0o700 });
    try {
      for (const file of response.manifest.files) {
        const destination = safeChild(stage, file.path);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await writeFile(destination, archive[file.path] ?? new Uint8Array(), { mode: 0o600 });
      }
      try {
        await rename(stage, target);
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        await rm(stage, { recursive: true, force: true });
      }
      const nextCurrent = join(householdRoot, `.current-${process.pid}`);
      await writeFile(nextCurrent, `${response.manifest.head}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(nextCurrent, this.currentPath(householdId));
      await this.prune(householdId, new Set([response.manifest.head, ...(previous === null ? [] : [previous.head])]));
      return { head: response.manifest.head, directory: target };
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }

  async purge(householdIdInput: HouseholdId): Promise<void> {
    await rm(this.householdRoot(HouseholdIdSchema.parse(householdIdInput)), { recursive: true, force: true });
  }

  private async prune(householdId: HouseholdId, retain: ReadonlySet<GitObjectId>): Promise<void> {
    for (const entry of await readdir(this.householdRoot(householdId), { withFileTypes: true })) {
      const parsed = GitObjectIdSchema.safeParse(entry.name);
      if (entry.isDirectory() && parsed.success && !retain.has(parsed.data)) {
        await rm(this.revisionPath(householdId, parsed.data), { recursive: true, force: true });
      }
    }
  }

  private householdRoot(householdId: HouseholdId): string {
    return resolve(this.root, "households", householdId);
  }

  private revisionPath(householdId: HouseholdId, head: GitObjectId): string {
    return resolve(this.householdRoot(householdId), head);
  }

  private currentPath(householdId: HouseholdId): string {
    return resolve(this.householdRoot(householdId), "current");
  }
}

export async function restockingSnapshotPrompt(directory: string): Promise<string> {
  const paths = await restockingFilePaths(directory);
  let totalBytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files: Array<{ readonly path: string; readonly content: string }> = [];
  for (const path of paths.sort()) {
    const content = await readFile(safeChild(directory, path));
    totalBytes += content.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Snapshot prompt exceeds its size limit");
    const text = decoder.decode(content);
    if (text.includes("\r")) throw new Error("Snapshot prompt files must use LF line endings");
    files.push({ path, content: text });
  }
  return JSON.stringify(files);
}

function validateArchive(response: HouseholdSnapshotResponse, archive: Record<string, Uint8Array>): void {
  const archivePaths = Object.keys(archive).sort();
  const manifestPaths = response.manifest.files.map((file) => file.path).sort();
  if (archivePaths.join("\0") !== manifestPaths.join("\0")) throw new Error("Snapshot archive paths did not match the manifest");
  const textDecoder = new TextDecoder("utf-8", { fatal: true });
  const hash = createHash("sha256");
  for (const file of [...response.manifest.files].sort((left, right) => left.path.localeCompare(right.path))) {
    if (!isRestockingPath(file.path)) throw new Error("Snapshot manifest contained a path outside the restocking allowlist");
    const content = archive[file.path];
    if (content === undefined || content.byteLength !== file.bytes) throw new Error("Snapshot file size did not match the manifest");
    if (createHash("sha256").update(content).digest("hex") !== file.sha256) throw new Error("Snapshot file hash did not match the manifest");
    const text = textDecoder.decode(content);
    if (text.includes("\r")) throw new Error("Snapshot files must use LF line endings");
    hash.update(file.path, "utf8");
    hash.update("\0");
    hash.update(String(content.byteLength), "ascii");
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  if (hash.digest("hex") !== response.manifest.content_sha256) throw new Error("Snapshot content hash did not match the manifest");
}

export function isRestockingPath(path: string): boolean {
  return path === "FORMAT_VERSION" || path === "profiles/snacks.md" || path === "snacks/reports/recurring-snacks.md" ||
    /^snacks\/items\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.md$/.test(path) ||
    /^snacks\/evidence\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.json$/.test(path);
}

async function restockingFilePaths(root: string, directory = ""): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = directory === "" ? entry.name : `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error("Snapshot prompt cannot contain symbolic links");
    if (entry.isDirectory()) {
      if (!isRestockingDirectory(path)) throw new Error("Snapshot prompt contained a directory outside the restocking allowlist");
      paths.push(...await restockingFilePaths(root, path));
    } else if (entry.isFile() && isRestockingPath(path)) {
      paths.push(path);
    } else {
      throw new Error("Snapshot prompt contained a path outside the restocking allowlist");
    }
  }
  return paths;
}

function isRestockingDirectory(path: string): boolean {
  return path === "profiles" || path === "snacks" || path === "snacks/items" || path.startsWith("snacks/items/") ||
    path === "snacks/evidence" || path.startsWith("snacks/evidence/") || path === "snacks/reports";
}

function safeChild(root: string, path: string): string {
  const child = resolve(root, path);
  if (!child.startsWith(`${resolve(root)}${sep}`)) throw new Error("Snapshot archive path escaped its target directory");
  return child;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "EEXIST" || error.code === "ENOTEMPTY");
}
