#!/usr/bin/env node

import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 250_000;
const LOCK_STALE_MS = 5 * 60 * 1000;
const LOCAL_ID_PATTERN = /^lcl_[0-9a-f]{32}$/;
const FULLWELL_ID_PATTERN = /^(?:usr|hsh)_[0-9a-z]{16,64}$/;
const HEAD_PATTERN = /^[0-9a-f]{40,64}$/;
const FORBIDDEN_JOURNAL_KEYS = new Set([
  "access_token",
  "authorization",
  "authorization_code",
  "browser_state",
  "client_secret",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "one_time_code",
  "password",
  "raw_html",
  "raw_page",
  "raw_pages",
  "refresh_token",
  "screenshot",
  "screenshots",
  "session_cookie",
  "token",
]);

export class LocalHouseholdError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LocalHouseholdError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new LocalHouseholdError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("VALIDATION_FAILED", `${label} contains an unsupported field: ${key}`);
  }
}

function assertRevision(value, label = "expected_revision") {
  if (!Number.isSafeInteger(value) || value < 1) fail("VALIDATION_FAILED", `${label} must be a positive integer`);
  return value;
}

function assertFullwellId(value, prefix, label) {
  if (typeof value !== "string" || !FULLWELL_ID_PATTERN.test(value) || !value.startsWith(`${prefix}_`)) {
    fail("VALIDATION_FAILED", `${label} is invalid`);
  }
  return value;
}

function assertHead(value) {
  if (typeof value !== "string" || !HEAD_PATTERN.test(value)) fail("VALIDATION_FAILED", "repository_head is invalid");
  return value;
}

function assertDate(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail("CORRUPT_LOCAL_HOUSEHOLD", `${label} is invalid`);
  return value;
}

function assertJournal(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "journal must be an object");
  if (Array.isArray(value.evidence) && value.evidence.length > 10_000) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "journal exceeds 10,000 evidence records");
  }
  if (Array.isArray(value.items) && value.items.length > 10_000) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "journal exceeds 10,000 items");
  }
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    nodes += 1;
    if (nodes > MAX_JSON_NODES) fail("LOCAL_HOUSEHOLD_TOO_LARGE", "journal contains too many JSON values");
    if (current.depth > MAX_JSON_DEPTH) fail("VALIDATION_FAILED", "journal exceeds the maximum JSON depth");
    if (current.value === null || typeof current.value === "string" || typeof current.value === "boolean") continue;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) fail("VALIDATION_FAILED", "journal contains a non-finite number");
      continue;
    }
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
      continue;
    }
    if (!isPlainObject(current.value)) fail("VALIDATION_FAILED", "journal contains a non-JSON value");
    for (const [key, child] of Object.entries(current.value)) {
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replaceAll("-", "_");
      if (FORBIDDEN_JOURNAL_KEYS.has(normalizedKey)) {
        fail("PROHIBITED_LOCAL_DATA", `journal field ${key} must not be stored locally`);
      }
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return value;
}

function parseCloudBackup(value) {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("CORRUPT_LOCAL_HOUSEHOLD", "cloud_backup must be null or an object");
  assertExactKeys(value, new Set([
    "user_id",
    "household_id",
    "repository_head",
    "local_revision",
    "backed_up_at",
  ]), "cloud_backup");
  return {
    user_id: assertFullwellId(value.user_id, "usr", "cloud_backup.user_id"),
    household_id: assertFullwellId(value.household_id, "hsh", "cloud_backup.household_id"),
    repository_head: assertHead(value.repository_head),
    local_revision: assertRevision(value.local_revision, "cloud_backup.local_revision"),
    backed_up_at: assertDate(value.backed_up_at, "cloud_backup.backed_up_at"),
  };
}

function parseDocument(value) {
  if (!isPlainObject(value)) fail("CORRUPT_LOCAL_HOUSEHOLD", "local household document must be an object");
  assertExactKeys(value, new Set([
    "schema_version",
    "local_household_id",
    "promotion_idempotency_key",
    "state",
    "revision",
    "created_at",
    "updated_at",
    "journal",
    "cloud_backup",
  ]), "local household document");
  if (value.schema_version !== SCHEMA_VERSION) fail("CORRUPT_LOCAL_HOUSEHOLD", "local household schema version is unsupported");
  if (typeof value.local_household_id !== "string" || !LOCAL_ID_PATTERN.test(value.local_household_id)) {
    fail("CORRUPT_LOCAL_HOUSEHOLD", "local_household_id is invalid");
  }
  if (typeof value.promotion_idempotency_key !== "string" || !/^local-backup-[0-9a-f]{32}$/.test(value.promotion_idempotency_key)) {
    fail("CORRUPT_LOCAL_HOUSEHOLD", "promotion_idempotency_key is invalid");
  }
  if (!["collecting", "ready"].includes(value.state)) fail("CORRUPT_LOCAL_HOUSEHOLD", "state is invalid");
  return {
    schema_version: SCHEMA_VERSION,
    local_household_id: value.local_household_id,
    promotion_idempotency_key: value.promotion_idempotency_key,
    state: value.state,
    revision: assertRevision(value.revision, "revision"),
    created_at: assertDate(value.created_at, "created_at"),
    updated_at: assertDate(value.updated_at, "updated_at"),
    journal: assertJournal(value.journal),
    cloud_backup: parseCloudBackup(value.cloud_backup),
  };
}

function parseRequest(input) {
  if (!isPlainObject(input) || typeof input.operation !== "string") fail("VALIDATION_FAILED", "request must include an operation");
  if (["initialize", "load"].includes(input.operation)) {
    assertExactKeys(input, new Set(["operation"]), `${input.operation} request`);
    return { operation: input.operation };
  }
  if (input.operation === "save") {
    assertExactKeys(input, new Set(["operation", "expected_revision", "journal"]), "save request");
    return {
      operation: "save",
      expected_revision: assertRevision(input.expected_revision),
      journal: assertJournal(input.journal),
    };
  }
  if (["finalize", "delete_collecting"].includes(input.operation)) {
    assertExactKeys(input, new Set(["operation", "expected_revision"]), `${input.operation} request`);
    return { operation: input.operation, expected_revision: assertRevision(input.expected_revision) };
  }
  if (input.operation === "record_cloud_backup") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "user_id",
      "household_id",
      "repository_head",
    ]), "record_cloud_backup request");
    return {
      operation: "record_cloud_backup",
      expected_revision: assertRevision(input.expected_revision),
      user_id: assertFullwellId(input.user_id, "usr", "user_id"),
      household_id: assertFullwellId(input.household_id, "hsh", "household_id"),
      repository_head: assertHead(input.repository_head),
    };
  }
  fail("VALIDATION_FAILED", `unsupported operation: ${input.operation}`);
}

/** Resolves the single Codex-home authority used by local Fullwell state. */
export function activeCodexHome() {
  const configured = process.env.CODEX_HOME?.trim();
  return path.resolve(configured || path.join(homedir(), ".codex"));
}

export function localHouseholdPath(root) {
  return path.join(path.resolve(root), "fullwell", "local", "household.json");
}

async function readDocument(filePath) {
  let handle;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > MAX_DOCUMENT_BYTES) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", "local household file is not a bounded regular file");
    }
    handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const content = await handle.readFile("utf8");
    try {
      return parseDocument(JSON.parse(content));
    } catch (error) {
      if (error instanceof LocalHouseholdError) throw error;
      fail("CORRUPT_LOCAL_HOUSEHOLD", "local household file is not valid JSON");
    }
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

async function ensurePrivateDirectory(root, directory) {
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, directory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("VALIDATION_FAILED", "local household directory escapes the Codex home");
  let current = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const currentStat = await lstat(current);
      if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) {
        fail("UNSAFE_LOCAL_PATH", "local household path contains a non-directory or symbolic link");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
    }
    await chmod(current, 0o700);
  }
}

async function acquireLock(directory, now) {
  const lockPath = path.join(directory, ".household.lock");
  const token = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ token, created_at: now.toISOString() }));
      await handle.sync();
      await handle.close();
      return { lockPath, token };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let existing;
      try {
        existing = JSON.parse(await readFile(lockPath, "utf8"));
      } catch {
        fail("LOCAL_HOUSEHOLD_BUSY", "the local household is locked");
      }
      const createdAt = typeof existing?.created_at === "string" ? Date.parse(existing.created_at) : Number.NaN;
      if (!Number.isFinite(createdAt) || now.getTime() - createdAt <= LOCK_STALE_MS) {
        fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
      }
      await unlink(lockPath);
    }
  }
  fail("LOCAL_HOUSEHOLD_BUSY", "the local household could not be locked");
}

async function releaseLock(lock) {
  try {
    const current = JSON.parse(await readFile(lock.lockPath, "utf8"));
    if (current?.token === lock.token) await unlink(lock.lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function syncDirectory(directory) {
  const handle = await open(directory, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeDocument(root, document) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > MAX_DOCUMENT_BYTES) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "local household exceeds 16 MiB");
  }
  const temporaryPath = path.join(directory, `.household.${process.pid}.${randomUUID()}.tmp`);
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(serialized);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, filePath);
    await chmod(filePath, 0o600);
    await syncDirectory(directory);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

function publicDocument(document) {
  return {
    local_household_id: document.local_household_id,
    promotion_idempotency_key: document.promotion_idempotency_key,
    state: document.state,
    revision: document.revision,
    journal: document.journal,
    cloud_backup: document.cloud_backup,
    cloud_backup_current: document.cloud_backup?.local_revision === document.revision,
  };
}

async function mutate(root, expectedRevision, now, apply) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLock(directory, now);
  try {
    const current = await readDocument(filePath);
    if (current === null) fail("LOCAL_HOUSEHOLD_MISSING", "no local household exists");
    if (current.revision !== expectedRevision) {
      fail("LOCAL_HOUSEHOLD_CONFLICT", `local household revision is ${current.revision}, not ${expectedRevision}`);
    }
    const updated = apply(current);
    if (updated !== current) await writeDocument(root, updated);
    return updated;
  } finally {
    await releaseLock(lock);
  }
}

export async function initializeLocalHousehold(root, now = new Date()) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLock(directory, now);
  try {
    const existing = await readDocument(filePath);
    if (existing !== null) return { status: "existing", ...publicDocument(existing) };
    const document = {
      schema_version: SCHEMA_VERSION,
      local_household_id: `lcl_${randomUUID().replaceAll("-", "")}`,
      promotion_idempotency_key: `local-backup-${randomUUID().replaceAll("-", "")}`,
      state: "collecting",
      revision: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      journal: {},
      cloud_backup: null,
    };
    await writeDocument(root, document);
    return { status: "initialized", ...publicDocument(document) };
  } finally {
    await releaseLock(lock);
  }
}

export async function loadLocalHousehold(root) {
  const document = await readDocument(localHouseholdPath(root));
  return document === null ? { status: "missing" } : { status: "found", ...publicDocument(document) };
}

export async function saveLocalHousehold(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "save" });
  const document = await mutate(root, request.expected_revision, now, (current) => ({
    ...current,
    revision: current.revision + 1,
    updated_at: now.toISOString(),
    journal: request.journal,
  }));
  return { status: "saved", ...publicDocument(document) };
}

export async function finalizeLocalHousehold(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "finalize" });
  const document = await mutate(root, request.expected_revision, now, (current) => current.state === "ready"
    ? current
    : {
        ...current,
        state: "ready",
        revision: current.revision + 1,
        updated_at: now.toISOString(),
      });
  return { status: "ready", ...publicDocument(document) };
}

export async function recordCloudBackup(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "record_cloud_backup" });
  const document = await mutate(root, request.expected_revision, now, (current) => {
    if (current.state !== "ready") fail("LOCAL_HOUSEHOLD_NOT_READY", "finish the local household before recording a cloud backup");
    const nextRevision = current.revision + 1;
    return {
      ...current,
      revision: nextRevision,
      updated_at: now.toISOString(),
      cloud_backup: {
        user_id: request.user_id,
        household_id: request.household_id,
        repository_head: request.repository_head,
        local_revision: nextRevision,
        backed_up_at: now.toISOString(),
      },
    };
  });
  return { status: "backed_up", ...publicDocument(document) };
}

export async function deleteCollectingLocalHousehold(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "delete_collecting" });
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLock(directory, now);
  let result;
  try {
    const current = await readDocument(filePath);
    if (current === null) {
      result = { status: "missing" };
    } else {
      if (current.revision !== request.expected_revision) {
        fail("LOCAL_HOUSEHOLD_CONFLICT", `local household revision is ${current.revision}, not ${request.expected_revision}`);
      }
      if (current.state !== "collecting") fail("LOCAL_HOUSEHOLD_READY", "a finalized local household requires an explicit data-deletion workflow");
      await unlink(filePath);
      await syncDirectory(directory);
      result = { status: "deleted" };
    }
  } finally {
    await releaseLock(lock);
  }
  try {
    await rmdir(directory);
  } catch (error) {
    if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
  }
  return result;
}

async function readRequest() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_DOCUMENT_BYTES) fail("LOCAL_HOUSEHOLD_TOO_LARGE", "request exceeds 16 MiB");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("VALIDATION_FAILED", "request is not valid JSON");
  }
}

export async function runRequest(root, input, now = new Date()) {
  const request = parseRequest(input);
  if (request.operation === "initialize") return await initializeLocalHousehold(root, now);
  if (request.operation === "load") return await loadLocalHousehold(root);
  if (request.operation === "save") return await saveLocalHousehold(root, request, now);
  if (request.operation === "finalize") return await finalizeLocalHousehold(root, request, now);
  if (request.operation === "record_cloud_backup") return await recordCloudBackup(root, request, now);
  return await deleteCollectingLocalHousehold(root, request, now);
}

async function main() {
  try {
    const result = await runRequest(activeCodexHome(), await readRequest());
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } catch (error) {
    const code = error instanceof LocalHouseholdError ? error.code : "LOCAL_HOUSEHOLD_FAILED";
    const message = error instanceof Error ? error.message : "Local household operation failed";
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
