import { Buffer } from "node:buffer";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import {
  LocalHouseholdError,
  acquireLocalLock,
  ensurePrivateDirectory,
  hasForbiddenAscii,
  releaseLocalLock,
  writePrivateFile,
} from "./local-household.mjs";

const SCHEMA_VERSION = 1;
const MAX_PROFILE_BYTES = 4 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 108;

function fail(code, message) {
  throw new LocalHouseholdError(code, message);
}

function displayName(value, errorCode = "VALIDATION_FAILED") {
  if (typeof value !== "string" || !value.isWellFormed() || hasForbiddenAscii(value)) {
    fail(errorCode, `display_name must be trimmed text of at most ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 1
    || trimmed.length > MAX_DISPLAY_NAME_LENGTH
    || (errorCode === "CORRUPT_LOCAL_PROFILE" && trimmed !== value)) {
    fail(errorCode, `display_name must be trimmed text of at most ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function revision(value, errorCode = "VALIDATION_FAILED") {
  if (!Number.isSafeInteger(value) || value < 0) fail(errorCode, "expected_revision must be a non-negative integer");
  return value;
}

function timestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    fail("CORRUPT_LOCAL_PROFILE", `${label} is invalid`);
  }
  return value;
}

function parseProfile(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("CORRUPT_LOCAL_PROFILE", "local profile must be an object");
  }
  const allowed = new Set(["schema_version", "revision", "display_name", "created_at", "updated_at"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("CORRUPT_LOCAL_PROFILE", `local profile contains unsupported field ${key}`);
  }
  if (value.schema_version !== SCHEMA_VERSION) fail("CORRUPT_LOCAL_PROFILE", "local profile schema version is unsupported");
  const parsedRevision = revision(value.revision, "CORRUPT_LOCAL_PROFILE");
  if (parsedRevision === 0) fail("CORRUPT_LOCAL_PROFILE", "local profile revision must be positive");
  return {
    schema_version: SCHEMA_VERSION,
    revision: parsedRevision,
    display_name: displayName(value.display_name, "CORRUPT_LOCAL_PROFILE"),
    created_at: timestamp(value.created_at, "created_at"),
    updated_at: timestamp(value.updated_at, "updated_at"),
  };
}

function publicProfile(profile) {
  return {
    revision: profile.revision,
    display_name: profile.display_name,
    default_household_name: defaultHouseholdName(profile.display_name),
  };
}

async function readProfile(filePath) {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_PROFILE_BYTES) {
      fail("CORRUPT_LOCAL_PROFILE", "local profile file is not a bounded regular file");
    }
    const content = await readFile(filePath);
    if (content.length > MAX_PROFILE_BYTES) fail("CORRUPT_LOCAL_PROFILE", "local profile exceeds its size limit");
    try {
      return parseProfile(JSON.parse(content.toString("utf8")));
    } catch (error) {
      if (error instanceof LocalHouseholdError) throw error;
      fail("CORRUPT_LOCAL_PROFILE", "local profile is not valid JSON");
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeProfile(root, profile) {
  const serialized = `${JSON.stringify(profile, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > MAX_PROFILE_BYTES) fail("LOCAL_PROFILE_TOO_LARGE", "local profile exceeds its size limit");
  await writePrivateFile(root, localProfilePath(root), serialized, MAX_PROFILE_BYTES, "local profile");
}

export function localProfilePath(root) {
  return path.join(path.resolve(root), "fullwell", "local", "profile.json");
}

export function defaultHouseholdName(name) {
  const validated = displayName(name);
  return `${validated}${/[sS]$/.test(validated) ? "'" : "'s"} Household`;
}

export async function loadLocalProfile(root) {
  const profile = await readProfile(localProfilePath(root));
  return profile === null ? { status: "missing" } : { status: "found", ...publicProfile(profile) };
}

export async function updateLocalProfile(root, input, now = new Date()) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail("VALIDATION_FAILED", "profile update must be an object");
  const allowed = new Set(["expected_revision", "display_name"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail("VALIDATION_FAILED", `profile update contains unsupported field ${key}`);
  }
  const expectedRevision = revision(input.expected_revision);
  const nextDisplayName = displayName(input.display_name);
  const filePath = localProfilePath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now, { lockName: ".profile.lock" });
  try {
    const current = await readProfile(filePath);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) {
      fail("LOCAL_PROFILE_CONFLICT", `local profile revision is ${currentRevision}, not ${expectedRevision}`);
    }
    const updatedAt = now.toISOString();
    const profile = {
      schema_version: SCHEMA_VERSION,
      revision: currentRevision + 1,
      display_name: nextDisplayName,
      created_at: current?.created_at ?? updatedAt,
      updated_at: updatedAt,
    };
    await writeProfile(root, profile);
    return { status: current === null ? "created" : "updated", ...publicProfile(profile) };
  } finally {
    await releaseLocalLock(lock);
  }
}
