import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import {
  GitObjectIdSchema,
  HouseholdIdSchema,
  HouseholdSnapshotResponseSchema,
  RunnerDeviceIdSchema,
  type GitObjectId,
  type HouseholdId,
  type HouseholdSnapshotResponse,
  type RunnerDeviceId,
} from "@hfj/contracts";
import type { Clock, HouseholdRepositoryPort } from "../core/ports.js";
import type { Principal } from "../core/types.js";
import { AppError } from "../core/errors.js";
import { isRestockingSnapshotPath } from "../core/restocking-snapshot.js";

const MAX_FILES = 2_000;
const MAX_FILE_BYTES = 1_048_576;
const MAX_TOTAL_BYTES = 5 * 1_048_576;

export interface RunnerSnapshotAuthorizationPort {
  withHouseholdLock<T>(householdId: HouseholdId, operation: () => Promise<T>): Promise<T>;
  authorize(principal: Principal, deviceId: RunnerDeviceId, householdId: HouseholdId): Promise<void>;
}

export type SnapshotResult =
  | { readonly kind: "not_modified"; readonly head: GitObjectId }
  | { readonly kind: "snapshot"; readonly response: HouseholdSnapshotResponse };

export class RunnerSnapshotService {
  constructor(
    private readonly repository: HouseholdRepositoryPort,
    private readonly authorization: RunnerSnapshotAuthorizationPort,
    private readonly clock: Clock,
  ) {}

  async read(principal: Principal, householdIdInput: string, deviceIdInput: string, ifNoneMatch: string | undefined): Promise<SnapshotResult> {
    const householdId = HouseholdIdSchema.parse(householdIdInput);
    const deviceId = RunnerDeviceIdSchema.parse(deviceIdInput);
    return await this.authorization.withHouseholdLock(householdId, async () => {
      await this.authorization.authorize(principal, deviceId, householdId);
      const snapshot = await this.repository.restockingSnapshot(householdId);
      if (matchesEtag(ifNoneMatch, snapshot.head)) return { kind: "not_modified", head: snapshot.head };
      const selected = snapshot.files
        .filter((file) => isRestockingSnapshotPath(file.path))
        .sort((left, right) => left.path.localeCompare(right.path));
      validateSelectedFiles(selected);
      const archive = zipSync(Object.fromEntries(selected.map((file) => [file.path, strToU8(file.content)])), { level: 6 });
      const response = HouseholdSnapshotResponseSchema.parse({
        manifest: {
          household_id: householdId,
          head: snapshot.head,
          content_sha256: contentDigest(selected),
          created_at: this.clock.now().toISOString(),
          files: selected.map((file) => ({
            path: file.path,
            sha256: createHash("sha256").update(file.content, "utf8").digest("hex"),
            bytes: Buffer.byteLength(file.content, "utf8"),
            mode: 0o600,
          })),
        },
        archive_base64: Buffer.from(archive).toString("base64"),
      });
      return { kind: "snapshot", response };
    });
  }

  async authorizeAction(principal: Principal, householdIdInput: string, deviceIdInput: string, expectedHeadInput: string) {
    const householdId = HouseholdIdSchema.parse(householdIdInput);
    const deviceId = RunnerDeviceIdSchema.parse(deviceIdInput);
    const expectedHead = GitObjectIdSchema.parse(expectedHeadInput);
    return await this.authorization.withHouseholdLock(householdId, async () => {
      await this.authorization.authorize(principal, deviceId, householdId);
      const head = await this.repository.head(householdId);
      if (head !== expectedHead) throw new AppError("REVISION_CONFLICT", "The household journal changed after product resolution");
      return { authorized: true as const, head, authorized_at: this.clock.now().toISOString() };
    });
  }
}

function validateSelectedFiles(files: ReadonlyArray<{ readonly path: string; readonly content: string }>): void {
  if (!files.some((file) => file.path === "FORMAT_VERSION")) throw new AppError("PROJECTION_DRIFT", "The household snapshot has no format marker");
  if (files.length > MAX_FILES) throw new AppError("PROJECTION_DRIFT", "The restocking snapshot contains too many files");
  let totalBytes = 0;
  for (const file of files) {
    if (file.content.includes("\r")) throw new AppError("PROJECTION_DRIFT", "The restocking snapshot contains non-LF text");
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > MAX_FILE_BYTES) throw new AppError("PROJECTION_DRIFT", "A restocking snapshot file exceeds the size limit");
    totalBytes += bytes;
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new AppError("PROJECTION_DRIFT", "The restocking snapshot exceeds the total size limit");
}

function contentDigest(files: ReadonlyArray<{ readonly path: string; readonly content: string }>): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path, "utf8");
    hash.update("\0");
    hash.update(String(Buffer.byteLength(file.content, "utf8")), "ascii");
    hash.update("\0");
    hash.update(file.content, "utf8");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function matchesEtag(value: string | undefined, head: GitObjectId): boolean {
  if (value === undefined) return false;
  return value.split(",").map((candidate) => candidate.trim()).includes(`"${head}"`);
}
