#!/usr/bin/env node

import { constants } from "node:fs";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 250_000;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_STALE_MS = 5 * 60 * 1000;
const ID_PATTERN = /^(?:usr|hsh)_[0-9a-z]{16,64}$/;
const HEAD_PATTERN = /^[0-9a-f]{40,64}$/;
const FORBIDDEN_DRAFT_KEYS = new Set([
  "access_token",
  "authorization",
  "browser_state",
  "client_secret",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "one_time_code",
  "password",
  "raw_html",
  "refresh_token",
  "screenshot",
  "session_cookie",
]);

export class DraftError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DraftError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new DraftError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("VALIDATION_FAILED", `${label} contains an unsupported field: ${key}`);
  }
}

function assertId(value, prefix, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value) || !value.startsWith(`${prefix}_`)) {
    fail("VALIDATION_FAILED", `${label} is invalid`);
  }
  return value;
}

function assertHead(value) {
  if (typeof value !== "string" || !HEAD_PATTERN.test(value)) fail("VALIDATION_FAILED", "expected_head is invalid");
  return value;
}

function assertRevision(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail("VALIDATION_FAILED", `${label} must be a non-negative integer`);
  return value;
}

function assertRevisions(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "onboarding_revisions must be an object");
  assertExactKeys(value, new Set(["snacks", "recipes"]), "onboarding_revisions");
  return {
    snacks: assertRevision(value.snacks, "onboarding_revisions.snacks"),
    recipes: assertRevision(value.recipes, "onboarding_revisions.recipes"),
  };
}

function assertJsonDraft(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "draft must be an object");
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    nodes += 1;
    if (nodes > MAX_JSON_NODES) fail("DRAFT_TOO_LARGE", "draft contains too many JSON values");
    if (current.depth > MAX_JSON_DEPTH) fail("VALIDATION_FAILED", "draft exceeds the maximum JSON depth");
    if (current.value === null || typeof current.value === "string" || typeof current.value === "boolean") continue;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) fail("VALIDATION_FAILED", "draft contains a non-finite number");
      continue;
    }
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
      continue;
    }
    if (!isPlainObject(current.value)) fail("VALIDATION_FAILED", "draft contains a non-JSON value");
    for (const [key, child] of Object.entries(current.value)) {
      const normalizedKey = key.toLowerCase().replaceAll("-", "_");
      if (FORBIDDEN_DRAFT_KEYS.has(normalizedKey)) {
        fail("PROHIBITED_DRAFT_DATA", `draft field ${key} must not be stored locally`);
      }
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return value;
}

function assertDate(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail("CORRUPT_DRAFT", `${label} is invalid`);
  return value;
}

function parseRequest(input) {
  if (!isPlainObject(input) || typeof input.operation !== "string") fail("VALIDATION_FAILED", "request must include an operation");
  const common = {
    user_id: assertId(input.user_id, "usr", "user_id"),
    household_id: assertId(input.household_id, "hsh", "household_id"),
  };
  if (input.operation === "load") {
    assertExactKeys(input, new Set(["operation", "user_id", "household_id", "expected_head", "onboarding_revisions"]), "load request");
    return {
      operation: "load",
      ...common,
      expected_head: assertHead(input.expected_head),
      onboarding_revisions: assertRevisions(input.onboarding_revisions),
    };
  }
  if (input.operation === "save") {
    assertExactKeys(input, new Set(["operation", "user_id", "household_id", "expected_head", "onboarding_revisions", "expected_draft_revision", "draft"]), "save request");
    return {
      operation: "save",
      ...common,
      expected_head: assertHead(input.expected_head),
      onboarding_revisions: assertRevisions(input.onboarding_revisions),
      expected_draft_revision: assertRevision(input.expected_draft_revision, "expected_draft_revision"),
      draft: assertJsonDraft(input.draft),
    };
  }
  if (input.operation === "delete") {
    assertExactKeys(input, new Set(["operation", "user_id", "household_id", "expected_draft_revision"]), "delete request");
    return {
      operation: "delete",
      ...common,
      expected_draft_revision: input.expected_draft_revision === null
        ? null
        : assertRevision(input.expected_draft_revision, "expected_draft_revision"),
    };
  }
  fail("VALIDATION_FAILED", `unsupported operation: ${input.operation}`);
}

function parseDocument(input) {
  if (!isPlainObject(input)) fail("CORRUPT_DRAFT", "draft document must be an object");
  assertExactKeys(input, new Set([
    "schema_version",
    "user_id",
    "household_id",
    "expected_head",
    "onboarding_revisions",
    "draft_revision",
    "updated_at",
    "expires_at",
    "draft",
  ]), "draft document");
  if (input.schema_version !== SCHEMA_VERSION) fail("CORRUPT_DRAFT", "draft schema version is unsupported");
  return {
    schema_version: SCHEMA_VERSION,
    user_id: assertId(input.user_id, "usr", "user_id"),
    household_id: assertId(input.household_id, "hsh", "household_id"),
    expected_head: assertHead(input.expected_head),
    onboarding_revisions: assertRevisions(input.onboarding_revisions),
    draft_revision: assertRevision(input.draft_revision, "draft_revision"),
    updated_at: assertDate(input.updated_at, "updated_at"),
    expires_at: assertDate(input.expires_at, "expires_at"),
    draft: assertJsonDraft(input.draft),
  };
}

function codexHome() {
  const configured = process.env.CODEX_HOME?.trim();
  return path.resolve(configured || path.join(homedir(), ".codex"));
}

export function onboardingDraftPath(root, userId, householdId) {
  assertId(userId, "usr", "user_id");
  assertId(householdId, "hsh", "household_id");
  return path.join(path.resolve(root), "fullwell", "drafts", userId, householdId, "onboarding.json");
}

async function readDocument(filePath) {
  let handle;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > MAX_DOCUMENT_BYTES) fail("CORRUPT_DRAFT", "draft file is not a bounded regular file");
    handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const content = await handle.readFile("utf8");
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      fail("CORRUPT_DRAFT", "draft file is not valid JSON");
    }
    return parseDocument(parsed);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

async function ensurePrivateDirectory(root, directory) {
  const relative = path.relative(path.resolve(root), directory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("VALIDATION_FAILED", "draft directory escapes the Codex home");
  let current = path.resolve(root);
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    await mkdir(current, { recursive: true, mode: 0o700 });
    await chmod(current, 0o700);
  }
}

async function acquireLock(directory, now) {
  const lockPath = path.join(directory, ".onboarding.lock");
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
        fail("DRAFT_BUSY", "the local onboarding draft is locked");
      }
      const createdAt = typeof existing?.created_at === "string" ? Date.parse(existing.created_at) : Number.NaN;
      if (!Number.isFinite(createdAt) || now.getTime() - createdAt <= LOCK_STALE_MS) {
        fail("DRAFT_BUSY", "the local onboarding draft is being updated elsewhere");
      }
      await unlink(lockPath);
    }
  }
  fail("DRAFT_BUSY", "the local onboarding draft could not be locked");
}

async function releaseLock(lock) {
  try {
    const current = JSON.parse(await readFile(lock.lockPath, "utf8"));
    if (current?.token === lock.token) await unlink(lock.lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function unlinkIfPresent(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function removeIfEmpty(directory) {
  try {
    await rmdir(directory);
  } catch (error) {
    if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
  }
}

function sameRevisions(left, right) {
  return left.snacks === right.snacks && left.recipes === right.recipes;
}

export async function loadOnboardingDraft(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "load" });
  const filePath = onboardingDraftPath(root, request.user_id, request.household_id);
  const document = await readDocument(filePath);
  if (document === null) return { status: "missing" };
  if (document.user_id !== request.user_id || document.household_id !== request.household_id) {
    return { status: "unusable", reason: "identity_mismatch", draft_revision: document.draft_revision };
  }
  if (Date.parse(document.expires_at) <= now.getTime()) return { status: "unusable", reason: "expired", draft_revision: document.draft_revision };
  if (document.expected_head !== request.expected_head) return { status: "unusable", reason: "repository_changed", draft_revision: document.draft_revision };
  if (!sameRevisions(document.onboarding_revisions, request.onboarding_revisions)) {
    return { status: "unusable", reason: "onboarding_changed", draft_revision: document.draft_revision };
  }
  return { status: "found", draft_revision: document.draft_revision, draft: document.draft };
}

export async function saveOnboardingDraft(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "save" });
  const filePath = onboardingDraftPath(root, request.user_id, request.household_id);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLock(directory, now);
  let temporaryPath;
  try {
    const existing = await readDocument(filePath);
    const currentRevision = existing?.draft_revision ?? 0;
    if (currentRevision !== request.expected_draft_revision) {
      fail("DRAFT_CONFLICT", `local draft revision is ${currentRevision}, not ${request.expected_draft_revision}`);
    }
    if (existing !== null && (existing.user_id !== request.user_id || existing.household_id !== request.household_id)) {
      fail("DRAFT_CONFLICT", "the existing local draft belongs to a different identity");
    }
    const document = {
      schema_version: SCHEMA_VERSION,
      user_id: request.user_id,
      household_id: request.household_id,
      expected_head: request.expected_head,
      onboarding_revisions: request.onboarding_revisions,
      draft_revision: currentRevision + 1,
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
      draft: request.draft,
    };
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_DOCUMENT_BYTES) fail("DRAFT_TOO_LARGE", "local onboarding draft exceeds 16 MiB");
    temporaryPath = path.join(directory, `.onboarding.${process.pid}.${randomUUID()}.tmp`);
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(serialized);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, filePath);
    temporaryPath = undefined;
    await chmod(filePath, 0o600);
    return { status: "saved", draft_revision: document.draft_revision, expires_at: document.expires_at };
  } finally {
    try {
      if (temporaryPath !== undefined) await unlinkIfPresent(temporaryPath);
    } finally {
      await releaseLock(lock);
    }
  }
}

export async function deleteOnboardingDraft(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "delete" });
  const filePath = onboardingDraftPath(root, request.user_id, request.household_id);
  const directory = path.dirname(filePath);
  try {
    await ensurePrivateDirectory(root, directory);
    const lock = await acquireLock(directory, now);
    try {
      let existing;
      try {
        existing = await readDocument(filePath);
      } catch (error) {
        if (request.expected_draft_revision !== null || !(error instanceof DraftError)) throw error;
        await unlink(filePath);
        return { status: "deleted_invalid" };
      }
      if (existing === null) return { status: "missing" };
      if (request.expected_draft_revision === null) {
        fail("DRAFT_CONFLICT", "a valid local draft requires its current revision before deletion");
      }
      if (existing.user_id !== request.user_id || existing.household_id !== request.household_id) {
        fail("DRAFT_CONFLICT", "the existing local draft belongs to a different identity");
      }
      if (existing.draft_revision !== request.expected_draft_revision) {
        fail("DRAFT_CONFLICT", `local draft revision is ${existing.draft_revision}, not ${request.expected_draft_revision}`);
      }
      await unlink(filePath);
      return { status: "deleted" };
    } finally {
      await releaseLock(lock);
    }
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    throw error;
  } finally {
    for (const candidate of [directory, path.dirname(directory)]) {
      await removeIfEmpty(candidate);
    }
  }
}

async function readRequest() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_DOCUMENT_BYTES) fail("DRAFT_TOO_LARGE", "request exceeds 16 MiB");
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
  if (request.operation === "load") return await loadOnboardingDraft(root, request, now);
  if (request.operation === "save") return await saveOnboardingDraft(root, request, now);
  return await deleteOnboardingDraft(root, request, now);
}

async function main() {
  try {
    const result = await runRequest(codexHome(), await readRequest());
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } catch (error) {
    const code = error instanceof DraftError ? error.code : "LOCAL_DRAFT_FAILED";
    const message = error instanceof Error ? error.message : "Local draft operation failed";
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
