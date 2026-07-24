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
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 250_000;
const LOCK_STALE_MS = 5 * 60 * 1000;
const LOCK_WAIT_MS = 1_000;
const LOCK_RETRY_MS = 20;
const MAX_MEAL_PROPOSALS = 2_000;
const MAX_MEAL_REVIEW_EVENTS = 2_000;
const MAX_MEAL_WITHDRAWAL_EVENTS = MAX_MEAL_PROPOSALS;
const MAX_MEAL_EVENTS = MAX_MEAL_REVIEW_EVENTS + MAX_MEAL_WITHDRAWAL_EVENTS;
const MAX_MEAL_IDEMPOTENCY_RECEIPTS = 6_000;
const MAX_MEAL_PROPOSALS_PER_SLOT = 48;
const MAX_MEAL_PROPOSALS_PER_WEEK = 500;
const MAX_MEAL_REVIEW_EVENTS_PER_WEEK = 500;
const MAX_MEAL_WITHDRAWAL_EVENTS_PER_WEEK = MAX_MEAL_PROPOSALS_PER_WEEK;
const MAX_MEAL_WEEKS = 520;
const IANA_TIME_ZONES = new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]);
const LOCAL_ID_PATTERN = /^lcl_[0-9a-f]{32}$/;
const FULLWELL_ID_PATTERN = /^(?:usr|hsh)_[0-9a-z]{16,64}$/;
const HEAD_PATTERN = /^[0-9a-f]{40,64}$/;
const ITEM_ID_PATTERN = /^itm_[0-9a-z]{16,64}$/;
const EVIDENCE_ID_PATTERN = /^evd_[0-9a-z]{16,64}$/;
const MEAL_PROPOSAL_ID_PATTERN = /^mlp_[0-9a-z]{16,64}$/;
const MEAL_EVENT_ID_PATTERN = /^mle_[0-9a-z]{16,64}$/;
const MEAL_PROFILE_RECEIPT_ID_PATTERN = /^mlr_[0-9a-f]{32}$/;
const LOCAL_RECIPE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalJson(child)]),
  );
}

function stableJson(value) {
  return JSON.stringify(canonicalJson(value));
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

/** Detects ASCII control bytes, with optional space rejection for URL inputs. */
export function hasForbiddenAscii(value, forbidSpace = false) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= 31 || code === 127 || (forbidSpace && code === 32)) return true;
  }
  return false;
}

function assertBoundedText(value, label, maximum, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string"
    || value.length < 1
    || value.length > maximum
    || !value.isWellFormed()
    || value.trim() !== value
    || hasForbiddenAscii(value)) {
    fail("VALIDATION_FAILED", `${label} must be trimmed text of at most ${maximum} characters`);
  }
  return value;
}

function assertHouseholdName(value) {
  if (typeof value !== "string" || !value.isWellFormed() || hasForbiddenAscii(value)) {
    fail("VALIDATION_FAILED", "household_name must be trimmed text of at most 120 characters");
  }
  return assertBoundedText(value.trim(), "household_name", 120);
}

function assertIsoDateTime(value, label) {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) {
    fail("VALIDATION_FAILED", `${label} must be an ISO date-time`);
  }
  return value;
}

function assertIsoDate(value, label) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) fail("VALIDATION_FAILED", `${label} must be an ISO date`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("VALIDATION_FAILED", `${label} is invalid`);
  return value;
}

function assertMonday(value, label = "week_start") {
  const date = assertIsoDate(value, label);
  if (new Date(`${date}T00:00:00.000Z`).getUTCDay() !== 1) fail("VALIDATION_FAILED", `${label} must be a Monday`);
  return date;
}

function assertMealDate(weekStart, value) {
  const mealDate = assertIsoDate(value, "meal_date");
  const start = Date.parse(`${weekStart}T00:00:00.000Z`);
  const offset = (Date.parse(`${mealDate}T00:00:00.000Z`) - start) / 86_400_000;
  if (!Number.isInteger(offset) || offset < 0 || offset > 6) fail("VALIDATION_FAILED", "meal_date must fall within week_start");
  return mealDate;
}

function assertIanaTimeZone(value) {
  if (typeof value !== "string" || value.length > 100 || !IANA_TIME_ZONES.has(value)) {
    fail("VALIDATION_FAILED", "time_zone is invalid");
  }
  return value;
}

function assertIdempotencyKey(value) {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value)) fail("VALIDATION_FAILED", "idempotency_key is invalid");
  return value;
}

function assertLocalActor(label) {
  return { kind: "local", label: assertBoundedText(label, "actor_label", 80) };
}

function assertHttpsUrl(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 2_048 || hasForbiddenAscii(value, true)) {
    fail("VALIDATION_FAILED", `${label} must be a bounded HTTPS URL`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("VALIDATION_FAILED", `${label} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    fail("VALIDATION_FAILED", `${label} must be a credential-free HTTPS URL`);
  }
  return parsed.toString();
}

function assertUniqueTextList(value, label, maximumItems, maximumText) {
  if (!Array.isArray(value) || value.length > maximumItems) fail("VALIDATION_FAILED", `${label} has too many values`);
  const parsed = value.map((entry, index) => assertBoundedText(entry, `${label}[${index}]`, maximumText));
  const normalized = parsed.map((entry) => entry.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) fail("VALIDATION_FAILED", `${label} values must be unique`);
  return parsed;
}

function assertMealConstraints(value) {
  if (!isPlainObject(value) || typeof value.status !== "string") fail("VALIDATION_FAILED", "constraints must be an object");
  if (value.status === "unresolved") {
    assertExactKeys(value, new Set(["status"]), "constraints");
    return { status: "unresolved" };
  }
  if (value.status === "confirmed_none") {
    assertExactKeys(value, new Set(["status", "time_zone", "reviewed_at"]), "constraints");
    return {
      status: "confirmed_none",
      time_zone: assertIanaTimeZone(value.time_zone),
      reviewed_at: assertIsoDateTime(value.reviewed_at, "constraints.reviewed_at"),
    };
  }
  if (value.status === "recorded") {
    assertExactKeys(value, new Set([
      "status",
      "time_zone",
      "allergy_labels",
      "sensitivity_labels",
      "reviewed_at",
    ]), "constraints");
    const allergyLabels = assertUniqueTextList(value.allergy_labels, "allergy_labels", 30, 120);
    const sensitivityLabels = assertUniqueTextList(value.sensitivity_labels, "sensitivity_labels", 30, 120);
    const combined = [...allergyLabels, ...sensitivityLabels].map((entry) => entry.toLocaleLowerCase());
    if (combined.length === 0 || new Set(combined).size !== combined.length) {
      fail("VALIDATION_FAILED", "recorded constraints require unique allergy or sensitivity labels");
    }
    return {
      status: "recorded",
      time_zone: assertIanaTimeZone(value.time_zone),
      allergy_labels: allergyLabels,
      sensitivity_labels: sensitivityLabels,
      reviewed_at: assertIsoDateTime(value.reviewed_at, "constraints.reviewed_at"),
    };
  }
  fail("VALIDATION_FAILED", "constraints status is unsupported");
}

function assertMealSlot(value) {
  if (!isPlainObject(value) || typeof value.kind !== "string") fail("VALIDATION_FAILED", "slot must be an object");
  if (["breakfast", "lunch", "dinner", "snack"].includes(value.kind)) {
    assertExactKeys(value, new Set(["kind"]), "slot");
    return { kind: value.kind };
  }
  if (value.kind === "custom") {
    assertExactKeys(value, new Set(["kind", "label"]), "slot");
    return { kind: "custom", label: assertBoundedText(value.label, "slot.label", 80) };
  }
  fail("VALIDATION_FAILED", "slot kind is unsupported");
}

function mealSlotKey(slot) {
  return slot.kind === "custom" ? `custom:${slot.label}` : slot.kind;
}

function assertOpaqueId(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) fail("VALIDATION_FAILED", `${label} is invalid`);
  return value;
}

function assertLocalMealSource(value) {
  if (!isPlainObject(value) || typeof value.kind !== "string") fail("VALIDATION_FAILED", "source must be an object");
  if (value.kind === "freeform") {
    assertExactKeys(value, new Set(["kind", "title"]), "source");
    return { kind: "freeform", title: assertBoundedText(value.title, "source.title", 300) };
  }
  if (value.kind === "journal_recipe") {
    assertExactKeys(value, new Set(["kind", "item_id", "item_revision", "liked_evidence_ids"]), "source");
    if (!Array.isArray(value.liked_evidence_ids) || value.liked_evidence_ids.length < 1 || value.liked_evidence_ids.length > 100) {
      fail("VALIDATION_FAILED", "source.liked_evidence_ids must contain between 1 and 100 IDs");
    }
    const evidenceIds = value.liked_evidence_ids.map((entry) => assertOpaqueId(entry, EVIDENCE_ID_PATTERN, "liked evidence ID"));
    if (new Set(evidenceIds).size !== evidenceIds.length) fail("VALIDATION_FAILED", "source.liked_evidence_ids must be unique");
    return {
      kind: "journal_recipe",
      item_id: assertOpaqueId(value.item_id, ITEM_ID_PATTERN, "source.item_id"),
      item_revision: assertOpaqueId(value.item_revision, LOCAL_RECIPE_DIGEST_PATTERN, "source.item_revision"),
      liked_evidence_ids: evidenceIds,
    };
  }
  if (value.kind === "external_recipe") {
    assertExactKeys(value, new Set(["kind", "title", "canonical_url", "site_name", "discovered_at"]), "source");
    return {
      kind: "external_recipe",
      title: assertBoundedText(value.title, "source.title", 300),
      canonical_url: assertHttpsUrl(value.canonical_url, "source.canonical_url"),
      site_name: assertBoundedText(value.site_name, "source.site_name", 200),
      discovered_at: assertIsoDateTime(value.discovered_at, "source.discovered_at"),
    };
  }
  fail("VALIDATION_FAILED", "source kind is unsupported");
}

function localRecipeContentDigest(item) {
  return `sha256:${createHash("sha256").update(stableJson(item)).digest("hex")}`;
}

function validateLocalMealProposalSource(source, journal) {
  if (source.kind !== "journal_recipe") return;
  const item = Array.isArray(journal.items)
    ? journal.items.find((candidate) => isPlainObject(candidate) && candidate.id === source.item_id)
    : undefined;
  if (item === undefined || item.kind !== "recipe") {
    fail("VALIDATION_FAILED", "a journal recipe proposal must cite an existing recipe");
  }
  if (localRecipeContentDigest(item) !== source.item_revision) {
    fail("LOCAL_RECIPE_REVISION_CONFLICT", "the cited recipe revision is no longer current");
  }
  if (item.liked !== "yes" || !Array.isArray(item.evidence_ids)) {
    fail("VALIDATION_FAILED", "a liked-recipe proposal requires current Liked evidence");
  }
  const itemEvidenceIds = new Set(item.evidence_ids);
  const evidence = Array.isArray(journal.evidence) ? journal.evidence : [];
  const invalidEvidence = source.liked_evidence_ids.some((id) => {
    const cited = evidence.find((candidate) => isPlainObject(candidate) && candidate.id === id);
    return !itemEvidenceIds.has(id)
      || cited?.kind !== "user_confirmation"
      || cited.confirmation?.subject !== "recipe_preference"
      || cited.confirmation.recipe_item_id !== item.id
      || cited.confirmation.preference !== "liked";
  });
  if (invalidEvidence) fail("VALIDATION_FAILED", "Liked evidence must be a cited user confirmation");
}

function assertMealPlanningState(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "journal.meal_planning must be an object");
  assertExactKeys(value, new Set(["schema_version", "profile", "proposals", "events", "idempotency"]), "journal.meal_planning");
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", "journal.meal_planning schema version is unsupported");
  if (!isPlainObject(value.profile)) fail("VALIDATION_FAILED", "journal.meal_planning.profile must be an object");
  assertExactKeys(value.profile, new Set([
    "schema_version",
    "revision",
    "constraints",
    "updated_at",
    "updated_by",
  ]), "journal.meal_planning.profile");
  if (value.profile.schema_version !== 1) fail("VALIDATION_FAILED", "meal-planning profile schema version is unsupported");
  assertRevision(value.profile.revision, "meal-planning profile revision");
  assertMealConstraints(value.profile.constraints);
  assertIsoDateTime(value.profile.updated_at, "meal-planning profile updated_at");
  if (!isPlainObject(value.profile.updated_by)) fail("VALIDATION_FAILED", "meal-planning profile updated_by must be an object");
  assertExactKeys(value.profile.updated_by, new Set(["kind", "label"]), "meal-planning profile updated_by");
  if (value.profile.updated_by.kind !== "local") fail("VALIDATION_FAILED", "meal-planning profile actor must be local");
  assertBoundedText(value.profile.updated_by.label, "meal-planning profile actor label", 80);

  if (!Array.isArray(value.proposals) || value.proposals.length > MAX_MEAL_PROPOSALS) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposals");
  }
  if (!Array.isArray(value.events) || value.events.length > MAX_MEAL_EVENTS) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many events");
  }
  if (!Array.isArray(value.idempotency) || value.idempotency.length > MAX_MEAL_IDEMPOTENCY_RECEIPTS) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many idempotency receipts");
  }

  const proposalIds = new Set();
  const proposalsByWeek = new Map();
  const proposalsBySlot = new Map();
  for (const proposal of value.proposals) {
    assertStoredMealProposal(proposal);
    if (proposalIds.has(proposal.id)) fail("VALIDATION_FAILED", "meal-planning proposal IDs must be unique");
    proposalIds.add(proposal.id);
    proposalsByWeek.set(proposal.week_start, (proposalsByWeek.get(proposal.week_start) ?? 0) + 1);
    const slotKey = `${proposal.week_start}:${proposal.meal_date}:${mealSlotKey(proposal.slot)}`;
    proposalsBySlot.set(slotKey, (proposalsBySlot.get(slotKey) ?? 0) + 1);
  }
  if ([...proposalsByWeek.values()].some((count) => count > MAX_MEAL_PROPOSALS_PER_WEEK)) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposals for one week");
  }
  if ([...proposalsBySlot.values()].some((count) => count > MAX_MEAL_PROPOSALS_PER_SLOT)) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposals for one meal slot");
  }

  const eventIds = new Set();
  const reviewEventsByWeek = new Map();
  const withdrawalEventsByWeek = new Map();
  let reviewEventCount = 0;
  let withdrawalEventCount = 0;
  for (const event of value.events) {
    assertStoredMealEvent(event);
    if (eventIds.has(event.id)) fail("VALIDATION_FAILED", "meal-planning event IDs must be unique");
    eventIds.add(event.id);
    const byWeek = event.kind === "constraints_reviewed" ? reviewEventsByWeek : withdrawalEventsByWeek;
    byWeek.set(event.week_start, (byWeek.get(event.week_start) ?? 0) + 1);
    if (event.kind === "constraints_reviewed") reviewEventCount += 1;
    else withdrawalEventCount += 1;
  }
  if (reviewEventCount > MAX_MEAL_REVIEW_EVENTS || withdrawalEventCount > MAX_MEAL_WITHDRAWAL_EVENTS) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many events");
  }
  if ([...reviewEventsByWeek.values()].some((count) => count > MAX_MEAL_REVIEW_EVENTS_PER_WEEK)
    || [...withdrawalEventsByWeek.values()].some((count) => count > MAX_MEAL_WITHDRAWAL_EVENTS_PER_WEEK)) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many events of one kind for one week");
  }
  const weeks = new Set([...proposalsByWeek.keys(), ...reviewEventsByWeek.keys(), ...withdrawalEventsByWeek.keys()]);
  if (weeks.size > MAX_MEAL_WEEKS) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many weeks");
  }
  for (const proposal of value.proposals) {
    const review = value.events.find(({ id }) => id === proposal.constraint_review_event_id);
    if (review?.kind !== "constraints_reviewed"
      || review.week_start !== proposal.week_start
      || review.constraint_revision !== proposal.constraint_revision) {
      fail("VALIDATION_FAILED", "meal proposal does not reference its matching weekly constraint review");
    }
    if (proposal.constraint_revision > value.profile.revision) {
      fail("VALIDATION_FAILED", "meal proposal references a future constraint revision");
    }
  }
  for (const event of value.events) {
    if (event.kind === "constraints_reviewed" && event.constraint_revision > value.profile.revision) {
      fail("VALIDATION_FAILED", "meal-plan event references a future constraint revision");
    }
    if (event.kind === "proposal_withdrawn"
      && !value.proposals.some(({ id, week_start: weekStart }) => id === event.proposal_id && weekStart === event.week_start)) {
      fail("VALIDATION_FAILED", "withdrawal event does not reference a proposal in its week");
    }
  }
  const receiptKeys = new Set();
  for (const receipt of value.idempotency) {
    if (!isPlainObject(receipt)) fail("VALIDATION_FAILED", "meal-planning idempotency receipt must be an object");
    assertExactKeys(receipt, new Set(["key", "kind", "fingerprint", "entity_id"]), "meal-planning idempotency receipt");
    assertIdempotencyKey(receipt.key);
    if (!["meal_planning_profile", "constraints_reviewed", "meal_proposal", "meal_plan_event"].includes(receipt.kind)) {
      fail("VALIDATION_FAILED", "meal-planning idempotency receipt kind is unsupported");
    }
    if (typeof receipt.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(receipt.fingerprint)) {
      fail("VALIDATION_FAILED", "meal-planning idempotency fingerprint is invalid");
    }
    const expectedPattern = receipt.kind === "meal_planning_profile"
      ? MEAL_PROFILE_RECEIPT_ID_PATTERN
      : receipt.kind === "meal_proposal"
        ? MEAL_PROPOSAL_ID_PATTERN
        : MEAL_EVENT_ID_PATTERN;
    assertOpaqueId(receipt.entity_id, expectedPattern, "meal-planning idempotency entity_id");
    if (receipt.kind !== "meal_planning_profile") {
      const entity = receipt.kind === "meal_proposal"
        ? value.proposals.find(({ id }) => id === receipt.entity_id)
        : value.events.find(({ id }) => id === receipt.entity_id);
      if (entity === undefined
        || (receipt.kind === "constraints_reviewed" && entity.kind !== "constraints_reviewed")
        || (receipt.kind === "meal_plan_event" && entity.kind !== "proposal_withdrawn")) {
        fail("VALIDATION_FAILED", "meal-planning idempotency receipt has no matching entity");
      }
    }
    if (receiptKeys.has(receipt.key)) fail("VALIDATION_FAILED", "meal-planning idempotency keys must be unique");
    receiptKeys.add(receipt.key);
  }
  return value;
}

function assertStoredMealProposal(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "meal proposal must be an object");
  assertExactKeys(value, new Set([
    "id",
    "week_start",
    "meal_date",
    "slot",
    "proposed_by",
    "source",
    "servings",
    "notes",
    "constraint_revision",
    "constraint_review_event_id",
    "compatibility",
    "compatibility_caveat",
    "created_at",
    "schema_version",
  ]), "meal proposal");
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", "meal proposal schema version is unsupported");
  assertOpaqueId(value.id, MEAL_PROPOSAL_ID_PATTERN, "meal proposal ID");
  const weekStart = assertMonday(value.week_start);
  assertMealDate(weekStart, value.meal_date);
  assertMealSlot(value.slot);
  if (!isPlainObject(value.proposed_by) || value.proposed_by.kind !== "local") fail("VALIDATION_FAILED", "local meal proposal actor is invalid");
  assertExactKeys(value.proposed_by, new Set(["kind", "label"]), "meal proposal actor");
  assertBoundedText(value.proposed_by.label, "meal proposal actor label", 80);
  assertLocalMealSource(value.source);
  if (value.servings !== null && (!Number.isSafeInteger(value.servings) || value.servings < 1 || value.servings > 100)) {
    fail("VALIDATION_FAILED", "servings must be null or an integer from 1 to 100");
  }
  assertBoundedText(value.notes, "notes", 1_000, { nullable: true });
  assertRevision(value.constraint_revision, "constraint_revision");
  assertOpaqueId(value.constraint_review_event_id, MEAL_EVENT_ID_PATTERN, "constraint_review_event_id");
  if (!["appears_compatible", "incomplete_evidence", "needs_recheck"].includes(value.compatibility)) {
    fail("VALIDATION_FAILED", "compatibility is unsupported");
  }
  assertBoundedText(value.compatibility_caveat, "compatibility_caveat", 1_000);
  assertIsoDateTime(value.created_at, "meal proposal created_at");
}

function assertStoredMealEvent(value) {
  if (!isPlainObject(value) || typeof value.kind !== "string") fail("VALIDATION_FAILED", "meal-plan event must be an object");
  const common = ["id", "kind", "week_start", "actor", "occurred_at", "schema_version"];
  const specific = value.kind === "constraints_reviewed"
    ? ["constraint_revision"]
    : value.kind === "proposal_withdrawn"
      ? ["proposal_id", "reason"]
      : [];
  if (specific.length === 0) fail("VALIDATION_FAILED", "meal-plan event kind is unsupported");
  assertExactKeys(value, new Set([...common, ...specific]), "meal-plan event");
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", "meal-plan event schema version is unsupported");
  assertOpaqueId(value.id, MEAL_EVENT_ID_PATTERN, "meal-plan event ID");
  assertMonday(value.week_start);
  if (!isPlainObject(value.actor) || value.actor.kind !== "local") fail("VALIDATION_FAILED", "meal-plan event actor is invalid");
  assertExactKeys(value.actor, new Set(["kind", "label"]), "meal-plan event actor");
  assertBoundedText(value.actor.label, "meal-plan event actor label", 80);
  assertIsoDateTime(value.occurred_at, "meal-plan event occurred_at");
  if (value.kind === "constraints_reviewed") assertRevision(value.constraint_revision, "constraint_revision");
  if (value.kind === "proposal_withdrawn") {
    assertOpaqueId(value.proposal_id, MEAL_PROPOSAL_ID_PATTERN, "proposal_id");
    assertBoundedText(value.reason, "reason", 500, { nullable: true });
  }
}

function assertJournal(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "journal must be an object");
  if (value.household !== undefined) {
    if (!isPlainObject(value.household)) fail("VALIDATION_FAILED", "journal household must be an object");
    assertExactKeys(value.household, new Set(["display_name"]), "journal household");
    assertBoundedText(value.household.display_name, "household display name", 120);
  }
  if (Array.isArray(value.evidence) && value.evidence.length > 10_000) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "journal exceeds 10,000 evidence records");
  }
  if (Array.isArray(value.items) && value.items.length > 10_000) {
    fail("LOCAL_HOUSEHOLD_TOO_LARGE", "journal exceeds 10,000 items");
  }
  if (value.meal_planning !== undefined) assertMealPlanningState(value.meal_planning);
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
  if (input.operation === "initialize") {
    assertExactKeys(input, new Set(["operation", "household_name"]), "initialize request");
    return {
      operation: "initialize",
      household_name: input.household_name === undefined
        ? undefined
        : assertHouseholdName(input.household_name),
    };
  }
  if (input.operation === "load") {
    assertExactKeys(input, new Set(["operation"]), "load request");
    return { operation: "load" };
  }
  if (input.operation === "save") {
    assertExactKeys(input, new Set(["operation", "expected_revision", "journal"]), "save request");
    return {
      operation: "save",
      expected_revision: assertRevision(input.expected_revision),
      journal: assertJournal(input.journal),
    };
  }
  if (input.operation === "rename_household") {
    assertExactKeys(input, new Set(["operation", "expected_revision", "household_name"]), "rename_household request");
    return {
      operation: "rename_household",
      expected_revision: assertRevision(input.expected_revision),
      household_name: assertHouseholdName(input.household_name),
    };
  }
  if (input.operation === "save_meal_planning_profile") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "idempotency_key",
      "actor_label",
      "constraints",
    ]), "save_meal_planning_profile request");
    const constraints = assertMealConstraints(input.constraints);
    if (constraints.status === "unresolved") fail("VALIDATION_FAILED", "meal-planning constraints must record an explicit answer");
    return {
      operation: "save_meal_planning_profile",
      expected_revision: assertRevision(input.expected_revision),
      idempotency_key: assertIdempotencyKey(input.idempotency_key),
      actor: assertLocalActor(input.actor_label),
      constraints,
    };
  }
  if (input.operation === "review_meal_constraints") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "idempotency_key",
      "actor_label",
      "week_start",
      "constraint_revision",
    ]), "review_meal_constraints request");
    return {
      operation: "review_meal_constraints",
      expected_revision: assertRevision(input.expected_revision),
      idempotency_key: assertIdempotencyKey(input.idempotency_key),
      actor: assertLocalActor(input.actor_label),
      week_start: assertMonday(input.week_start),
      constraint_revision: assertRevision(input.constraint_revision, "constraint_revision"),
    };
  }
  if (input.operation === "append_meal_proposal") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "idempotency_key",
      "actor_label",
      "week_start",
      "meal_date",
      "slot",
      "source",
      "servings",
      "notes",
      "constraint_revision",
      "constraint_review_event_id",
      "compatibility",
      "compatibility_caveat",
    ]), "append_meal_proposal request");
    const weekStart = assertMonday(input.week_start);
    if (input.servings !== null && (!Number.isSafeInteger(input.servings) || input.servings < 1 || input.servings > 100)) {
      fail("VALIDATION_FAILED", "servings must be null or an integer from 1 to 100");
    }
    if (!["appears_compatible", "incomplete_evidence", "needs_recheck"].includes(input.compatibility)) {
      fail("VALIDATION_FAILED", "compatibility is unsupported");
    }
    return {
      operation: "append_meal_proposal",
      expected_revision: assertRevision(input.expected_revision),
      idempotency_key: assertIdempotencyKey(input.idempotency_key),
      actor: assertLocalActor(input.actor_label),
      week_start: weekStart,
      meal_date: assertMealDate(weekStart, input.meal_date),
      slot: assertMealSlot(input.slot),
      source: assertLocalMealSource(input.source),
      servings: input.servings,
      notes: assertBoundedText(input.notes, "notes", 1_000, { nullable: true }),
      constraint_revision: assertRevision(input.constraint_revision, "constraint_revision"),
      constraint_review_event_id: assertOpaqueId(input.constraint_review_event_id, MEAL_EVENT_ID_PATTERN, "constraint_review_event_id"),
      compatibility: input.compatibility,
      compatibility_caveat: assertBoundedText(input.compatibility_caveat, "compatibility_caveat", 1_000),
    };
  }
  if (input.operation === "record_meal_plan_event") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "idempotency_key",
      "actor_label",
      "week_start",
      "event",
    ]), "record_meal_plan_event request");
    if (!isPlainObject(input.event) || input.event.kind !== "proposal_withdrawn") {
      fail("VALIDATION_FAILED", "record_meal_plan_event supports only proposal_withdrawn");
    }
    assertExactKeys(input.event, new Set(["kind", "proposal_id", "reason"]), "record_meal_plan_event event");
    return {
      operation: "record_meal_plan_event",
      expected_revision: assertRevision(input.expected_revision),
      idempotency_key: assertIdempotencyKey(input.idempotency_key),
      actor: assertLocalActor(input.actor_label),
      week_start: assertMonday(input.week_start),
      event: {
        kind: "proposal_withdrawn",
        proposal_id: assertOpaqueId(input.event.proposal_id, MEAL_PROPOSAL_ID_PATTERN, "proposal_id"),
        reason: assertBoundedText(input.event.reason, "reason", 500, { nullable: true }),
      },
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

export async function ensurePrivateDirectory(root, directory) {
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
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") throw mkdirError;
        const concurrentStat = await lstat(current);
        if (!concurrentStat.isDirectory() || concurrentStat.isSymbolicLink()) {
          fail("UNSAFE_LOCAL_PATH", "local household path contains a non-directory or symbolic link");
        }
      }
    }
    await chmod(current, 0o700);
  }
}

/**
 * Acquires a private local-state lock.
 *
 * Purpose-specific fan-in operations may opt into a bounded wait so concurrent
 * appends serialize. A short-lived guard serializes lease replacement so stale
 * recovery cannot unlink a newly acquired lock through a pathname ABA race.
 */
async function writeLockLease(lockPath, token, now) {
  const handle = await open(lockPath, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify({
      token,
      pid: process.pid,
      created_at: now.toISOString(),
    }));
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function acquireLocalLock(
  directory,
  now,
  { lockName = ".household.lock", waitForLiveWriter = false } = {},
) {
  if (!/^\.[a-z0-9-]+\.lock$/.test(lockName)) fail("VALIDATION_FAILED", "local lock name is invalid");
  const lockPath = path.join(directory, lockName);
  const token = randomUUID();
  const waitDeadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    const acquired = await withLockGuard(lockPath, waitForLiveWriter, async () => {
      try {
        await writeLockLease(lockPath, token, now);
        return true;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
      let existing;
      try {
        existing = JSON.parse(await readFile(lockPath, "utf8"));
      } catch (error) {
        let lockStat;
        try {
          lockStat = await lstat(lockPath);
        } catch (statError) {
          if (statError?.code !== "ENOENT") throw statError;
          await writeLockLease(lockPath, token, now);
          return true;
        }
        if (!lockStat.isFile() || lockStat.isSymbolicLink()) {
          fail("UNSAFE_LOCAL_PATH", "local lock is not a private regular file");
        }
        if (now.getTime() - lockStat.mtimeMs > LOCK_STALE_MS) {
          await unlink(lockPath);
          await writeLockLease(lockPath, token, now);
          return true;
        }
        if (!(error instanceof SyntaxError)) throw error;
        fail("LOCAL_HOUSEHOLD_BUSY", "the local household is locked");
      }
      const createdAt = typeof existing?.created_at === "string" ? Date.parse(existing.created_at) : Number.NaN;
      if (!Number.isFinite(createdAt)) {
        fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
      }
      const ownerIsAlive = Number.isSafeInteger(existing.pid) && processIsAlive(existing.pid);
      if (now.getTime() - createdAt > LOCK_STALE_MS && !ownerIsAlive) {
        await unlink(lockPath);
        await writeLockLease(lockPath, token, now);
        return true;
      }
      return false;
    });
    if (acquired) return { lockPath, token };
    if (!waitForLiveWriter) fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
    if (Date.now() >= waitDeadline) fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
    await new Promise((resolveWait) => setTimeout(resolveWait, LOCK_RETRY_MS));
  }
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readGuardOwner(guardPath) {
  const guardStat = await lstat(guardPath);
  if (!guardStat.isDirectory() || guardStat.isSymbolicLink()) {
    fail("UNSAFE_LOCAL_PATH", "local lock guard is not a private directory");
  }
  let handle;
  try {
    handle = await open(path.join(guardPath, "owner.json"), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const owner = JSON.parse(await handle.readFile("utf8"));
    if (typeof owner?.token !== "string"
      || !/^[0-9a-f-]{36}$/.test(owner.token)
      || !Number.isSafeInteger(owner.pid)
      || typeof owner.created_at !== "string"
      || !Number.isFinite(Date.parse(owner.created_at))) {
      fail("LOCAL_HOUSEHOLD_BUSY", "the local lock guard is invalid");
    }
    return owner;
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    return {
      token: `orphan-${guardStat.ino}-${Math.trunc(guardStat.mtimeMs)}`,
      pid: null,
      created_at: guardStat.mtime.toISOString(),
    };
  } finally {
    await handle?.close();
  }
}

async function withLockGuard(lockPath, waitForLiveWriter, apply) {
  const guardPath = `${lockPath}.guard`;
  const waitDeadline = Date.now() + LOCK_WAIT_MS;
  const token = randomUUID();
  while (true) {
    try {
      await mkdir(guardPath, { mode: 0o700 });
      const handle = await open(path.join(guardPath, "owner.json"), "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify({
          token,
          pid: process.pid,
          created_at: new Date().toISOString(),
        }));
        await handle.sync();
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = await readGuardOwner(guardPath);
      } catch (readError) {
        if (readError?.code === "ENOENT") continue;
        throw readError;
      }
      const createdAt = Date.parse(owner.created_at);
      if (Date.now() - createdAt > LOCK_STALE_MS
        && (owner.pid === null || !processIsAlive(owner.pid))) {
        const retiredPath = `${guardPath}.retired-${owner.token}`;
        try {
          await rename(guardPath, retiredPath);
          continue;
        } catch (renameError) {
          if (!["EEXIST", "ENOTEMPTY", "ENOENT"].includes(renameError?.code)) throw renameError;
        }
      }
      if (!waitForLiveWriter) fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
      if (Date.now() >= waitDeadline) fail("LOCAL_HOUSEHOLD_BUSY", "the local household is being updated elsewhere");
      await new Promise((resolveWait) => setTimeout(resolveWait, LOCK_RETRY_MS));
    }
  }
  try {
    return await apply();
  } finally {
    const owner = await readGuardOwner(guardPath);
    if (owner.token === token) {
      await unlink(path.join(guardPath, "owner.json"));
      await rmdir(guardPath);
    }
  }
}

export async function releaseLocalLock(lock) {
  await withLockGuard(lock.lockPath, true, async () => {
    try {
      const current = JSON.parse(await readFile(lock.lockPath, "utf8"));
      if (current?.token === lock.token) await unlink(lock.lockPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  });
}

export async function syncDirectory(directory) {
  const handle = await open(directory, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Atomically replaces one bounded private file below the active local root.
 *
 * Callers retain authority over the fixed destination; this helper enforces
 * confinement, private modes, durability, and no-symlink directories.
 */
export async function writePrivateFile(root, filePath, content, maximumBytes, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("UNSAFE_LOCAL_PATH", `${label} path escapes the local root`);
  const directory = path.dirname(resolvedFile);
  await ensurePrivateDirectory(root, directory);
  if (typeof content !== "string" || Buffer.byteLength(content) > maximumBytes) fail("LOCAL_HOUSEHOLD_TOO_LARGE", `${label} exceeds its size limit`);
  const temporaryPath = path.join(directory, `.${path.basename(resolvedFile)}.${process.pid}.${randomUUID()}.tmp`);
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, resolvedFile);
    await chmod(resolvedFile, 0o600);
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

async function writeDocument(root, document) {
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  await writePrivateFile(root, localHouseholdPath(root), serialized, MAX_DOCUMENT_BYTES, "local household");
}

function publicDocument(document) {
  const items = Array.isArray(document.journal.items) ? document.journal.items : [];
  const recipeContentRevisions = items.flatMap((item) =>
    isPlainObject(item) && item.kind === "recipe" && typeof item.id === "string" && ITEM_ID_PATTERN.test(item.id)
      ? [{ item_id: item.id, item_revision: localRecipeContentDigest(item) }]
      : []);
  const planning = document.journal.meal_planning;
  const withdrawals = new Set(planning?.events.flatMap((event) =>
    event.kind === "proposal_withdrawn" ? [event.proposal_id] : []) ?? []);
  const mealProposalStatuses = planning?.proposals.map((proposal) => {
    const currentItemRevision = proposal.source.kind === "journal_recipe"
      ? recipeContentRevisions.find(({ item_id: itemId }) => itemId === proposal.source.item_id)?.item_revision ?? null
      : null;
    const needsRecheck = proposal.constraint_revision !== planning.profile.revision
      || (proposal.source.kind === "journal_recipe" && currentItemRevision !== proposal.source.item_revision);
    return {
      proposal_id: proposal.id,
      active: !withdrawals.has(proposal.id),
      effective_compatibility: needsRecheck ? "needs_recheck" : proposal.compatibility,
    };
  }) ?? [];
  return {
    local_household_id: document.local_household_id,
    promotion_idempotency_key: document.promotion_idempotency_key,
    state: document.state,
    revision: document.revision,
    journal: document.journal,
    recipe_content_revisions: recipeContentRevisions,
    meal_proposal_statuses: mealProposalStatuses,
    cloud_backup: document.cloud_backup,
    cloud_backup_current: document.cloud_backup?.local_revision === document.revision,
  };
}

async function mutate(root, expectedRevision, now, apply) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now);
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
    await releaseLocalLock(lock);
  }
}

function requestFingerprint(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableLocalEntityId(prefix, kind, idempotencyKey) {
  return `${prefix}_${createHash("sha256").update(`${kind}:${idempotencyKey}`).digest("hex").slice(0, 32)}`;
}

function mealPlanningState(document) {
  const state = document.journal.meal_planning;
  if (state === undefined) fail("MEAL_PLANNING_PROFILE_REQUIRED", "record allergies and food sensitivities before planning meals");
  return state;
}

function replayedMealEntity(state, receipt) {
  const entities = receipt.kind === "meal_proposal" ? state.proposals : state.events;
  const entity = entities.find(({ id }) => id === receipt.entity_id);
  if (entity === undefined) fail("CORRUPT_LOCAL_HOUSEHOLD", "meal-planning idempotency receipt has no matching entity");
  return entity;
}

/**
 * Serializes an append-only meal mutation against current nested state.
 *
 * The outer revision is an observation, not a last-writer-wins precondition:
 * after locking, current profile/review references are revalidated so two
 * independent proposals from the same starting revision can both commit.
 */
async function appendMealPlanningMutation(root, request, now, descriptor, apply) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now, { waitForLiveWriter: true });
  try {
    const current = await readDocument(filePath);
    if (current === null) fail("LOCAL_HOUSEHOLD_MISSING", "no local household exists");
    const state = mealPlanningState(current);
    const existingReceipt = state.idempotency.find(({ key }) => key === request.idempotency_key);
    if (existingReceipt !== undefined) {
      if (existingReceipt.kind !== descriptor.receiptKind || existingReceipt.fingerprint !== descriptor.fingerprint) {
        fail("IDEMPOTENCY_CONFLICT", "idempotency_key was already used for different meal-planning input");
      }
      return {
        status: "replayed",
        document: current,
        entity: replayedMealEntity(state, existingReceipt),
      };
    }
    if (current.revision < request.expected_revision) {
      fail("LOCAL_HOUSEHOLD_CONFLICT", `local household revision is ${current.revision}, before ${request.expected_revision}`);
    }
    if (state.idempotency.length >= MAX_MEAL_IDEMPOTENCY_RECEIPTS) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many idempotency receipts");
    }
    const entity = apply(state, current.journal);
    const nextState = {
      ...state,
      proposals: descriptor.receiptKind === "meal_proposal" ? [...state.proposals, entity] : state.proposals,
      events: descriptor.receiptKind === "meal_proposal" ? state.events : [...state.events, entity],
      idempotency: [...state.idempotency, {
        key: request.idempotency_key,
        kind: descriptor.receiptKind,
        fingerprint: descriptor.fingerprint,
        entity_id: entity.id,
      }],
    };
    const updated = {
      ...current,
      revision: current.revision + 1,
      updated_at: now.toISOString(),
      journal: { ...current.journal, meal_planning: nextState },
    };
    assertJournal(updated.journal);
    await writeDocument(root, updated);
    return { status: descriptor.createdStatus, document: updated, entity };
  } finally {
    await releaseLocalLock(lock);
  }
}

export async function initializeLocalHousehold(root, now = new Date(), householdName = undefined) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now);
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
      journal: householdName === undefined ? {} : { household: { display_name: householdName } },
      cloud_backup: null,
    };
    await writeDocument(root, document);
    return { status: "initialized", ...publicDocument(document) };
  } finally {
    await releaseLocalLock(lock);
  }
}

export async function loadLocalHousehold(root) {
  const document = await readDocument(localHouseholdPath(root));
  return document === null ? { status: "missing" } : { status: "found", ...publicDocument(document) };
}

export async function saveLocalHousehold(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "save" });
  const document = await mutate(root, request.expected_revision, now, (current) => {
    const currentHousehold = current.journal.household;
    const requestedHousehold = request.journal.household;
    if (requestedHousehold !== undefined
      && stableJson(requestedHousehold) !== stableJson(currentHousehold)) {
      fail("VALIDATION_FAILED", "use rename_household to change the local household name");
    }
    const currentMealPlanning = current.journal.meal_planning;
    const requestedMealPlanning = request.journal.meal_planning;
    if (currentMealPlanning === undefined && requestedMealPlanning !== undefined) {
      fail("VALIDATION_FAILED", "use the purpose-specific meal-planning operations");
    }
    if (currentMealPlanning !== undefined
      && requestedMealPlanning !== undefined
      && stableJson(currentMealPlanning) !== stableJson(requestedMealPlanning)) {
      fail("VALIDATION_FAILED", "use the purpose-specific meal-planning operations");
    }
    const journalWithMealPlanning = currentMealPlanning === undefined
      ? request.journal
      : { ...request.journal, meal_planning: currentMealPlanning };
    const journal = currentHousehold === undefined
      ? journalWithMealPlanning
      : { ...journalWithMealPlanning, household: currentHousehold };
    return {
      ...current,
      revision: current.revision + 1,
      updated_at: now.toISOString(),
      journal,
    };
  });
  return { status: "saved", ...publicDocument(document) };
}

export async function renameLocalHousehold(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "rename_household" });
  const document = await mutate(root, request.expected_revision, now, (current) => ({
    ...current,
    revision: current.revision + 1,
    updated_at: now.toISOString(),
    journal: {
      ...current.journal,
      household: { display_name: request.household_name },
    },
  }));
  return { status: "renamed", ...publicDocument(document) };
}

export async function saveLocalMealPlanningProfile(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "save_meal_planning_profile" });
  const fingerprint = requestFingerprint({
    operation: request.operation,
    actor: request.actor,
    constraints: request.constraints,
  });
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now, { waitForLiveWriter: true });
  try {
    const current = await readDocument(filePath);
    if (current === null) fail("LOCAL_HOUSEHOLD_MISSING", "no local household exists");
    const previous = current.journal.meal_planning;
    const existingReceipt = previous?.idempotency.find(({ key }) => key === request.idempotency_key);
    if (existingReceipt !== undefined) {
      if (existingReceipt.kind !== "meal_planning_profile" || existingReceipt.fingerprint !== fingerprint) {
        fail("IDEMPOTENCY_CONFLICT", "idempotency_key was already used for different meal-planning input");
      }
      return { status: "replayed", ...publicDocument(current) };
    }
    if (current.revision !== request.expected_revision) {
      fail("LOCAL_HOUSEHOLD_CONFLICT", `local household revision is ${current.revision}, not ${request.expected_revision}`);
    }
    if ((previous?.idempotency.length ?? 0) >= MAX_MEAL_IDEMPOTENCY_RECEIPTS) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many idempotency receipts");
    }
    const profile = {
      schema_version: 1,
      revision: (previous?.profile.revision ?? 0) + 1,
      constraints: request.constraints,
      updated_at: now.toISOString(),
      updated_by: request.actor,
    };
    const receipt = {
      key: request.idempotency_key,
      kind: "meal_planning_profile",
      fingerprint,
      entity_id: stableLocalEntityId("mlr", request.operation, request.idempotency_key),
    };
    const mealPlanning = previous === undefined
      ? { schema_version: 1, profile, proposals: [], events: [], idempotency: [receipt] }
      : { ...previous, profile, idempotency: [...previous.idempotency, receipt] };
    const journal = { ...current.journal, meal_planning: mealPlanning };
    assertJournal(journal);
    const document = {
      ...current,
      revision: current.revision + 1,
      updated_at: now.toISOString(),
      journal,
    };
    await writeDocument(root, document);
    return { status: "meal_planning_profile_saved", ...publicDocument(document) };
  } finally {
    await releaseLocalLock(lock);
  }
}

export async function reviewLocalMealConstraints(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "review_meal_constraints" });
  const fingerprint = requestFingerprint({
    operation: request.operation,
    actor: request.actor,
    week_start: request.week_start,
    constraint_revision: request.constraint_revision,
  });
  const result = await appendMealPlanningMutation(root, request, now, {
    receiptKind: "constraints_reviewed",
    fingerprint,
    createdStatus: "constraints_reviewed",
  }, (state) => {
    if (state.profile.constraints.status === "unresolved" || state.profile.revision !== request.constraint_revision) {
      fail("MEAL_PLANNING_PROFILE_CONFLICT", "constraint_revision is not the current confirmed meal-planning profile");
    }
    const reviewEvents = state.events.filter(({ kind }) => kind === "constraints_reviewed");
    if (reviewEvents.length >= MAX_MEAL_REVIEW_EVENTS
      || reviewEvents.filter(({ week_start: weekStart }) => weekStart === request.week_start).length >= MAX_MEAL_REVIEW_EVENTS_PER_WEEK) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many constraint reviews");
    }
    return {
      id: stableLocalEntityId("mle", request.operation, request.idempotency_key),
      kind: "constraints_reviewed",
      week_start: request.week_start,
      actor: request.actor,
      constraint_revision: request.constraint_revision,
      occurred_at: now.toISOString(),
      schema_version: 1,
    };
  });
  return { status: result.status, ...publicDocument(result.document), event: result.entity };
}

export async function appendLocalMealProposal(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "append_meal_proposal" });
  const fingerprint = requestFingerprint({
    operation: request.operation,
    actor: request.actor,
    week_start: request.week_start,
    meal_date: request.meal_date,
    slot: request.slot,
    source: request.source,
    servings: request.servings,
    notes: request.notes,
    constraint_revision: request.constraint_revision,
    constraint_review_event_id: request.constraint_review_event_id,
    compatibility: request.compatibility,
    compatibility_caveat: request.compatibility_caveat,
  });
  const result = await appendMealPlanningMutation(root, request, now, {
    receiptKind: "meal_proposal",
    fingerprint,
    createdStatus: "meal_proposal_appended",
  }, (state, journal) => {
    if (state.profile.constraints.status === "unresolved" || state.profile.revision !== request.constraint_revision) {
      fail("MEAL_PLANNING_PROFILE_CONFLICT", "constraint_revision is not the current confirmed meal-planning profile");
    }
    const review = state.events.find(({ id }) => id === request.constraint_review_event_id);
    if (review?.kind !== "constraints_reviewed"
      || review.week_start !== request.week_start
      || review.constraint_revision !== request.constraint_revision) {
      fail("MEAL_CONSTRAINT_REVIEW_REQUIRED", "the current constraints must be reviewed for this week before adding a proposal");
    }
    validateLocalMealProposalSource(request.source, journal);
    if (state.proposals.filter(({ week_start: weekStart }) => weekStart === request.week_start).length >= MAX_MEAL_PROPOSALS_PER_WEEK) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposals for one week");
    }
    const slotKey = mealSlotKey(request.slot);
    if (state.proposals.filter((proposal) =>
      proposal.week_start === request.week_start
      && proposal.meal_date === request.meal_date
      && mealSlotKey(proposal.slot) === slotKey).length >= MAX_MEAL_PROPOSALS_PER_SLOT) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposals for one meal slot");
    }
    return {
      id: stableLocalEntityId("mlp", request.operation, request.idempotency_key),
      week_start: request.week_start,
      meal_date: request.meal_date,
      slot: request.slot,
      proposed_by: request.actor,
      source: request.source,
      servings: request.servings,
      notes: request.notes,
      constraint_revision: request.constraint_revision,
      constraint_review_event_id: request.constraint_review_event_id,
      compatibility: request.compatibility,
      compatibility_caveat: request.compatibility_caveat,
      created_at: now.toISOString(),
      schema_version: 1,
    };
  });
  return { status: result.status, ...publicDocument(result.document), proposal: result.entity };
}

export async function recordLocalMealPlanEvent(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "record_meal_plan_event" });
  const fingerprint = requestFingerprint({
    operation: request.operation,
    actor: request.actor,
    week_start: request.week_start,
    event: request.event,
  });
  const result = await appendMealPlanningMutation(root, request, now, {
    receiptKind: "meal_plan_event",
    fingerprint,
    createdStatus: "meal_plan_event_recorded",
  }, (state) => {
    const proposal = state.proposals.find(({ id }) => id === request.event.proposal_id);
    if (proposal === undefined || proposal.week_start !== request.week_start) fail("MEAL_PROPOSAL_NOT_FOUND", "proposal was not found in the requested week");
    if (state.events.some(({ kind, proposal_id: proposalId }) => kind === "proposal_withdrawn" && proposalId === proposal.id)) {
      fail("MEAL_PROPOSAL_WITHDRAWN", "proposal is already withdrawn");
    }
    const withdrawalEvents = state.events.filter(({ kind }) => kind === "proposal_withdrawn");
    if (withdrawalEvents.length >= MAX_MEAL_WITHDRAWAL_EVENTS
      || withdrawalEvents.filter(({ week_start: weekStart }) => weekStart === request.week_start).length >= MAX_MEAL_WITHDRAWAL_EVENTS_PER_WEEK) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "meal planning contains too many proposal withdrawals");
    }
    return {
      id: stableLocalEntityId("mle", request.operation, request.idempotency_key),
      kind: "proposal_withdrawn",
      week_start: request.week_start,
      actor: request.actor,
      proposal_id: request.event.proposal_id,
      reason: request.event.reason,
      occurred_at: now.toISOString(),
      schema_version: 1,
    };
  });
  return { status: result.status, ...publicDocument(result.document), event: result.entity };
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
  const lock = await acquireLocalLock(directory, now);
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
    await releaseLocalLock(lock);
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
  if (request.operation === "initialize") return await initializeLocalHousehold(root, now, request.household_name);
  if (request.operation === "load") return await loadLocalHousehold(root);
  if (request.operation === "save") return await saveLocalHousehold(root, request, now);
  if (request.operation === "rename_household") return await renameLocalHousehold(root, request, now);
  if (request.operation === "save_meal_planning_profile") return await saveLocalMealPlanningProfile(root, input, now);
  if (request.operation === "review_meal_constraints") return await reviewLocalMealConstraints(root, input, now);
  if (request.operation === "append_meal_proposal") return await appendLocalMealProposal(root, input, now);
  if (request.operation === "record_meal_plan_event") return await recordLocalMealPlanEvent(root, input, now);
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
