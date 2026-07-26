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
const MAX_DELIVERY_PROMOTIONS = 1_000;
const IANA_TIME_ZONES = new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]);
const LOCAL_ID_PATTERN = /^lcl_[0-9a-f]{32}$/;
const FULLWELL_ID_PATTERN = /^(?:usr|hsh)_[0-9a-z]{16,64}$/;
const HEAD_PATTERN = /^[0-9a-f]{40,64}$/;
const ACTOR_ID_PATTERN = /^act_[0-9a-z]{16,64}$/;
const COLLECTION_ID_PATTERN = /^col_[0-9a-z]{16,64}$/;
const ITEM_ID_PATTERN = /^itm_[0-9a-z]{16,64}$/;
const EVIDENCE_ID_PATTERN = /^evd_[0-9a-z]{16,64}$/;
const SNAPSHOT_ID_PATTERN = /^snp_[0-9a-z]{16,64}$/;
const MEAL_PROPOSAL_ID_PATTERN = /^mlp_[0-9a-z]{16,64}$/;
const MEAL_EVENT_ID_PATTERN = /^mle_[0-9a-z]{16,64}$/;
const MEAL_PROFILE_RECEIPT_ID_PATTERN = /^mlr_[0-9a-f]{32}$/;
const LOCAL_RECIPE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PAYLOAD_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_DELIVERY_JOURNAL_KEYS = new Set([
  "provider_label",
  "provider_origin",
  "provider_order_locator",
  "order_group_locator",
  "historical_menu_item_locator",
  "known_menu_item_locators",
  "merchant_locator",
  "public_location_label",
]);
const SAFE_GENERIC_JOURNAL_KEYS = new Set([
  "discard",
  "discard_status",
  "discarded",
  "discarded_items",
  "menu_card",
  "menucard",
  "postcard",
  "recipe_card",
  "recipecard",
  "scorecard",
]);
const FORBIDDEN_JOURNAL_TOKEN_ROOTS = [
  "account",
  "accounts",
  "address",
  "addresses",
  "authorization",
  "authorizations",
  "billing",
  "browser",
  "browsers",
  "card",
  "cards",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "destination",
  "destinations",
  "dropoff",
  "dropoffs",
  "password",
  "passwords",
  "payment",
  "payments",
  "screenshot",
  "screenshots",
  "secret",
  "secrets",
  "session",
  "sessions",
  "token",
  "tokens",
];
const FORBIDDEN_JOURNAL_COMPOUND_ROOTS = [
  "provideraccount",
  "provideraccounts",
  "providercustomer",
  "providercustomers",
  "provideruser",
  "providerusers",
  "deliveryaddress",
  "deliveryaddresses",
  "deliverydestination",
  "deliverydestinations",
  "deliverydropoff",
  "deliverydropoffs",
  "deliveryinstruction",
  "deliveryinstructions",
  "deliverylocation",
  "deliverylocations",
  "onetimecode",
  "onetimecodes",
  "rawhtml",
  "rawpage",
  "rawpages",
  "clouduser",
  "cloudhousehold",
];
const BENIGN_JOURNAL_TOKEN_LEXEMES = [
  "accountability",
  "accounting",
  "cardinality",
  "cardamom",
  "cardboard",
  "cardinal",
  "tokenized",
  "tokenize",
  "browserify",
  "sessional",
  "passwordless",
  "secretariat",
  "addressable",
].sort((left, right) => right.length - left.length);

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

function normalizeJournalKey(value) {
  const compatibilityNormalized = value.normalize("NFKC");
  if ([...compatibilityNormalized].some((character) => character.codePointAt(0) > 0x7f)) {
    fail("PROHIBITED_LOCAL_DATA", "journal structural keys must use ASCII characters");
  }
  return compatibilityNormalized
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isForbiddenJournalKey(value) {
  const normalized = normalizeJournalKey(value);
  if (SAFE_DELIVERY_JOURNAL_KEYS.has(normalized) || SAFE_GENERIC_JOURNAL_KEYS.has(normalized)) return false;
  const residualTokens = normalized.split("_").filter(Boolean).map((token) => {
    let residual = token;
    while (true) {
      const reduced = BENIGN_JOURNAL_TOKEN_LEXEMES.reduce(
        (current, lexeme) => current.replaceAll(lexeme, ""),
        residual,
      );
      if (reduced === residual) return residual;
      residual = reduced;
    }
  }).filter(Boolean);
  if (residualTokens.some((token) =>
    FORBIDDEN_JOURNAL_TOKEN_ROOTS.some((root) => token.includes(root)))) return true;
  const collapsedResidual = residualTokens.join("");
  return FORBIDDEN_JOURNAL_TOKEN_ROOTS.some((root) => collapsedResidual.includes(root))
    || FORBIDDEN_JOURNAL_COMPOUND_ROOTS.some((root) => collapsedResidual.includes(root));
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

function assertStringRange(value, label, minimum, maximum) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    fail("VALIDATION_FAILED", `${label} must contain between ${minimum} and ${maximum} characters`);
  }
  return value;
}

function assertArrayBounds(value, label, minimum, maximum) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail("VALIDATION_FAILED", `${label} must contain between ${minimum} and ${maximum} values`);
  }
  return value;
}

function assertProviderOrigin(value, label = "provider_origin") {
  if (typeof value !== "string" || value.length > 2_048 || hasForbiddenAscii(value)) {
    fail("VALIDATION_FAILED", `${label} must be one canonical HTTPS origin`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("VALIDATION_FAILED", `${label} must be one canonical HTTPS origin`);
  }
  if (parsed.protocol !== "https:"
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || value !== `${parsed.origin}/`) {
    fail("VALIDATION_FAILED", `${label} must be one canonical credential-free HTTPS origin`);
  }
  return value;
}

function assertPrivateProviderLocator(value, label, maximum) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > maximum
    || value.trim() !== value
    || hasForbiddenAscii(value)) {
    fail("VALIDATION_FAILED", `${label} is invalid`);
  }
  return value;
}

function assertDeliveryClassification(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set(["kind", "authored_by"]), label);
  if (!["food", "alcohol"].includes(value.kind) || value.authored_by !== "agent") {
    fail("VALIDATION_FAILED", `${label} must be an agent-authored food or alcohol classification`);
  }
  return value;
}

function assertDeliveryModifier(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set(["group_name", "option_name"]), label);
  assertBoundedText(value.group_name, `${label}.group_name`, 200);
  assertBoundedText(value.option_name, `${label}.option_name`, 300);
  return value;
}

function assertRestaurantPublicAddress(value, label) {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be null or an object`);
  assertExactKeys(value, new Set(["address_lines", "locality", "region", "postal_code", "country"]), label);
  if (value.address_lines !== undefined) {
    assertArrayBounds(value.address_lines, `${label}.address_lines`, 1, 3)
      .forEach((entry, index) => assertBoundedText(entry, `${label}.address_lines[${index}]`, 200));
  }
  for (const [key, maximum] of [["locality", 120], ["region", 120], ["postal_code", 32], ["country", 120]]) {
    if (value[key] !== undefined) assertBoundedText(value[key], `${label}.${key}`, maximum);
  }
  if (Object.values(value).every((entry) => entry === undefined)) {
    fail("VALIDATION_FAILED", `${label} must contain at least one public merchant address label`);
  }
  return value;
}

function assertRestaurantLocation(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set([
    "restaurant_name",
    "public_location_label",
    "public_merchant_address",
    "merchant_locator",
  ]), label);
  assertBoundedText(value.restaurant_name, `${label}.restaurant_name`, 300);
  assertBoundedText(value.public_location_label, `${label}.public_location_label`, 500);
  assertRestaurantPublicAddress(value.public_merchant_address, `${label}.public_merchant_address`);
  assertPrivateProviderLocator(value.merchant_locator, `${label}.merchant_locator`, 512);
  return value;
}

function assertDeliveryEvidence(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  const commonKeys = [
    "id",
    "kind",
    "observed_at",
    "evidence_date",
    "date_precision",
    "source_type",
    "source_label",
    "stable_locator",
    "summary",
    "actor_id",
    "limitations",
    "schema_version",
    "delivery_order_line",
  ];
  if (value.supersedes_evidence_id !== undefined) commonKeys.push("supersedes_evidence_id");
  assertExactKeys(value, new Set(commonKeys), label);
  assertOpaqueId(value.id, EVIDENCE_ID_PATTERN, `${label}.id`);
  if (value.kind !== "delivery_order_line" || value.source_type !== "delivery_provider") {
    fail("VALIDATION_FAILED", `${label} must be delivery-provider order-line evidence`);
  }
  assertIsoDateTime(value.observed_at, `${label}.observed_at`);
  if (value.evidence_date !== null) assertIsoDate(value.evidence_date, `${label}.evidence_date`);
  if (!["day", "month", "year", "unknown"].includes(value.date_precision)) {
    fail("VALIDATION_FAILED", `${label}.date_precision is unsupported`);
  }
  assertStringRange(value.source_label, `${label}.source_label`, 1, 200);
  assertStringRange(value.stable_locator, `${label}.stable_locator`, 1, 1_000);
  assertStringRange(value.summary, `${label}.summary`, 1, 2_000);
  assertOpaqueId(value.actor_id, ACTOR_ID_PATTERN, `${label}.actor_id`);
  assertArrayBounds(value.limitations, `${label}.limitations`, 0, 30)
    .forEach((entry, index) => assertStringRange(entry, `${label}.limitations[${index}]`, 1, 500));
  if (value.supersedes_evidence_id !== undefined) {
    assertOpaqueId(value.supersedes_evidence_id, EVIDENCE_ID_PATTERN, `${label}.supersedes_evidence_id`);
  }
  if (value.schema_version !== 1 || !isPlainObject(value.delivery_order_line)) {
    fail("VALIDATION_FAILED", `${label} schema is invalid`);
  }
  const line = value.delivery_order_line;
  assertExactKeys(line, new Set([
    "provider_label",
    "provider_origin",
    "provider_order_locator",
    "order_group_locator",
    "order_date",
    "completion_status",
    "fulfillment_mode",
    "group_complete",
    "declared_line_count",
    "line_key",
    "restaurant",
    "dish_name",
    "quantity",
    "modifiers_complete",
    "modifiers",
    "historical_menu_item_locator",
    "classification",
  ]), `${label}.delivery_order_line`);
  assertBoundedText(line.provider_label, `${label}.delivery_order_line.provider_label`, 120);
  assertProviderOrigin(line.provider_origin, `${label}.delivery_order_line.provider_origin`);
  assertPrivateProviderLocator(line.provider_order_locator, `${label}.delivery_order_line.provider_order_locator`, 512);
  assertPrivateProviderLocator(line.order_group_locator, `${label}.delivery_order_line.order_group_locator`, 512);
  assertIsoDate(line.order_date, `${label}.delivery_order_line.order_date`);
  if (line.completion_status !== "completed"
    || !["delivery", "pickup"].includes(line.fulfillment_mode)
    || line.group_complete !== true
    || !Number.isSafeInteger(line.declared_line_count)
    || line.declared_line_count < 1
    || line.declared_line_count > 100) {
    fail("VALIDATION_FAILED", `${label} must describe one bounded complete delivery or pickup group`);
  }
  assertPrivateProviderLocator(line.line_key, `${label}.delivery_order_line.line_key`, 256);
  assertRestaurantLocation(line.restaurant, `${label}.delivery_order_line.restaurant`);
  assertBoundedText(line.dish_name, `${label}.delivery_order_line.dish_name`, 500);
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
    fail("VALIDATION_FAILED", `${label}.delivery_order_line.quantity is invalid`);
  }
  if (line.modifiers_complete !== true) fail("VALIDATION_FAILED", `${label} must include complete modifiers`);
  assertArrayBounds(line.modifiers, `${label}.delivery_order_line.modifiers`, 0, 50)
    .forEach((entry, index) => assertDeliveryModifier(entry, `${label}.delivery_order_line.modifiers[${index}]`));
  if (line.historical_menu_item_locator !== null) {
    assertPrivateProviderLocator(
      line.historical_menu_item_locator,
      `${label}.delivery_order_line.historical_menu_item_locator`,
      512,
    );
  }
  assertDeliveryClassification(line.classification, `${label}.delivery_order_line.classification`);
  if (value.source_label !== line.provider_label) {
    fail("VALIDATION_FAILED", `${label}.source_label must match its provider label`);
  }
  return value;
}

function assertDeliveryEvidenceGroups(evidence) {
  const groups = new Map();
  for (const entry of evidence) {
    const line = entry.delivery_order_line;
    const key = stableJson([
      line.provider_origin,
      line.provider_order_locator,
      line.order_group_locator,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const lines of groups.values()) {
    const first = lines[0];
    const expected = first.delivery_order_line;
    if (new Set(lines.map(({ id }) => id)).size !== lines.length
      || new Set(lines.map(({ delivery_order_line }) => delivery_order_line.line_key)).size !== lines.length
      || expected.declared_line_count !== lines.length) {
      fail("VALIDATION_FAILED", "delivery evidence must form complete groups with unique lines");
    }
    for (const entry of lines) {
      const line = entry.delivery_order_line;
      if (entry.actor_id !== first.actor_id
        || entry.source_type !== first.source_type
        || entry.source_label !== first.source_label
        || line.provider_origin !== expected.provider_origin
        || line.provider_order_locator !== expected.provider_order_locator
        || line.order_group_locator !== expected.order_group_locator
        || line.order_date !== expected.order_date
        || line.completion_status !== expected.completion_status
        || line.fulfillment_mode !== expected.fulfillment_mode
        || line.declared_line_count !== expected.declared_line_count
        || line.provider_label !== expected.provider_label
        || line.restaurant.restaurant_name !== expected.restaurant.restaurant_name
        || line.restaurant.public_location_label !== expected.restaurant.public_location_label
        || stableJson(line.restaurant.public_merchant_address) !== stableJson(expected.restaurant.public_merchant_address)
        || line.restaurant.merchant_locator !== expected.restaurant.merchant_locator) {
        fail("VALIDATION_FAILED", "every delivery evidence line must describe the same complete order group");
      }
    }
  }
}

function assertHistoryBackedDeliveryDish(value, label, evidenceById) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set([
    "id",
    "kind",
    "evidence_ids",
    "created_at",
    "updated_at",
    "schema_version",
    "body_markdown",
    "dish_name",
    "provider_label",
    "provider_origin",
    "restaurant_name",
    "public_location_label",
    "public_merchant_address",
    "merchant_locator",
    "known_menu_item_locators",
    "known_modifier_occurrences",
    "classification",
  ]), label);
  assertOpaqueId(value.id, ITEM_ID_PATTERN, `${label}.id`);
  if (value.kind !== "delivery_dish") fail("VALIDATION_FAILED", `${label}.kind is invalid`);
  const evidenceIds = assertArrayBounds(value.evidence_ids, `${label}.evidence_ids`, 1, 1_000)
    .map((id, index) => assertOpaqueId(id, EVIDENCE_ID_PATTERN, `${label}.evidence_ids[${index}]`));
  assertIsoDateTime(value.created_at, `${label}.created_at`);
  assertIsoDateTime(value.updated_at, `${label}.updated_at`);
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", `${label}.schema_version is unsupported`);
  assertStringRange(value.body_markdown, `${label}.body_markdown`, 0, 100_000);
  assertBoundedText(value.dish_name, `${label}.dish_name`, 500);
  assertBoundedText(value.provider_label, `${label}.provider_label`, 120);
  assertProviderOrigin(value.provider_origin, `${label}.provider_origin`);
  assertBoundedText(value.restaurant_name, `${label}.restaurant_name`, 300);
  assertBoundedText(value.public_location_label, `${label}.public_location_label`, 500);
  assertRestaurantPublicAddress(value.public_merchant_address, `${label}.public_merchant_address`);
  assertPrivateProviderLocator(value.merchant_locator, `${label}.merchant_locator`, 512);
  const menuLocators = assertArrayBounds(value.known_menu_item_locators, `${label}.known_menu_item_locators`, 0, 20)
    .map((entry, index) => assertPrivateProviderLocator(entry, `${label}.known_menu_item_locators[${index}]`, 512));
  if (new Set(menuLocators).size !== menuLocators.length) {
    fail("VALIDATION_FAILED", `${label}.known_menu_item_locators must be unique`);
  }
  const occurrences = assertArrayBounds(
    value.known_modifier_occurrences,
    `${label}.known_modifier_occurrences`,
    1,
    100,
  );
  const occurrencesByEvidence = new Map();
  for (const [index, occurrence] of occurrences.entries()) {
    const occurrenceLabel = `${label}.known_modifier_occurrences[${index}]`;
    if (!isPlainObject(occurrence)) fail("VALIDATION_FAILED", `${occurrenceLabel} must be an object`);
    assertExactKeys(occurrence, new Set(["evidence_id", "modifiers_complete", "modifiers"]), occurrenceLabel);
    const evidenceId = assertOpaqueId(occurrence.evidence_id, EVIDENCE_ID_PATTERN, `${occurrenceLabel}.evidence_id`);
    if (occurrence.modifiers_complete !== true) fail("VALIDATION_FAILED", `${occurrenceLabel} must be complete`);
    assertArrayBounds(occurrence.modifiers, `${occurrenceLabel}.modifiers`, 0, 50)
      .forEach((entry, modifierIndex) => assertDeliveryModifier(entry, `${occurrenceLabel}.modifiers[${modifierIndex}]`));
    if (occurrencesByEvidence.has(evidenceId) || !evidenceIds.includes(evidenceId)) {
      fail("VALIDATION_FAILED", `${label} modifier occurrences must cite unique item evidence`);
    }
    occurrencesByEvidence.set(evidenceId, occurrence);
  }
  assertDeliveryClassification(value.classification, `${label}.classification`);
  const supportedMenuLocators = new Set();
  for (const evidenceId of evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    if (evidence?.kind !== "delivery_order_line") {
      fail("VALIDATION_FAILED", `${label} must cite only existing delivery order evidence`);
    }
    const line = evidence.delivery_order_line;
    if (line.provider_label !== value.provider_label
      || line.provider_origin !== value.provider_origin
      || line.restaurant.restaurant_name !== value.restaurant_name
      || line.restaurant.public_location_label !== value.public_location_label
      || stableJson(line.restaurant.public_merchant_address) !== stableJson(value.public_merchant_address)
      || line.restaurant.merchant_locator !== value.merchant_locator
      || line.dish_name !== value.dish_name
      || stableJson(line.classification) !== stableJson(value.classification)
      || stableJson(occurrencesByEvidence.get(evidenceId)?.modifiers) !== stableJson(line.modifiers)) {
      fail("VALIDATION_FAILED", `${label} conflicts with its cited delivery evidence`);
    }
    if (line.historical_menu_item_locator !== null) supportedMenuLocators.add(line.historical_menu_item_locator);
  }
  if (occurrencesByEvidence.size !== evidenceIds.length
    || supportedMenuLocators.size !== menuLocators.length
    || menuLocators.some((locator) => !supportedMenuLocators.has(locator))) {
    fail("VALIDATION_FAILED", `${label} must preserve exact modifiers and menu locators from cited evidence`);
  }
  return value;
}

function assertImportEvidence(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  const keys = [
    "id",
    "kind",
    "observed_at",
    "evidence_date",
    "date_precision",
    "source_type",
    "source_label",
    "stable_locator",
    "summary",
    "actor_id",
    "limitations",
    "schema_version",
  ];
  if (value.supersedes_evidence_id !== undefined) keys.push("supersedes_evidence_id");
  assertExactKeys(value, new Set(keys), label);
  assertOpaqueId(value.id, EVIDENCE_ID_PATTERN, `${label}.id`);
  if (value.kind !== "import" || value.source_type !== "shared_collection") {
    fail("VALIDATION_FAILED", `${label} must be shared-collection import evidence`);
  }
  assertIsoDateTime(value.observed_at, `${label}.observed_at`);
  if (value.evidence_date !== null) assertIsoDate(value.evidence_date, `${label}.evidence_date`);
  if (!["day", "month", "year", "unknown"].includes(value.date_precision)) {
    fail("VALIDATION_FAILED", `${label}.date_precision is unsupported`);
  }
  assertStringRange(value.source_label, `${label}.source_label`, 1, 200);
  assertStringRange(value.stable_locator, `${label}.stable_locator`, 1, 1_000);
  assertStringRange(value.summary, `${label}.summary`, 1, 2_000);
  assertOpaqueId(value.actor_id, ACTOR_ID_PATTERN, `${label}.actor_id`);
  assertArrayBounds(value.limitations, `${label}.limitations`, 0, 30)
    .forEach((entry, index) => assertStringRange(entry, `${label}.limitations[${index}]`, 1, 500));
  if (value.supersedes_evidence_id !== undefined) {
    assertOpaqueId(value.supersedes_evidence_id, EVIDENCE_ID_PATTERN, `${label}.supersedes_evidence_id`);
  }
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", `${label}.schema_version is unsupported`);
  return value;
}

function assertDeliveryImportProvenance(value, label) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set([
    "source_collection_id",
    "source_snapshot_id",
    "source_collection_item_id",
    "published_revision",
    "source_display_attribution",
    "imported_at",
  ]), label);
  assertOpaqueId(value.source_collection_id, COLLECTION_ID_PATTERN, `${label}.source_collection_id`);
  assertOpaqueId(value.source_snapshot_id, SNAPSHOT_ID_PATTERN, `${label}.source_snapshot_id`);
  assertStringRange(value.source_collection_item_id, `${label}.source_collection_item_id`, 8, 128);
  assertOpaqueId(value.published_revision, HEAD_PATTERN, `${label}.published_revision`);
  assertBoundedText(
    value.source_display_attribution,
    `${label}.source_display_attribution`,
    300,
    { nullable: true },
  );
  assertIsoDateTime(value.imported_at, `${label}.imported_at`);
  return value;
}

function assertImportedDeliveryDish(value, label, evidenceById) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  assertExactKeys(value, new Set([
    "id",
    "kind",
    "delivery_authority",
    "evidence_ids",
    "created_at",
    "updated_at",
    "schema_version",
    "body_markdown",
    "dish_name",
    "restaurant_name",
    "public_location_label",
    "public_merchant_address",
    "image_url",
    "image_page_url",
    "source_display_attribution",
    "classification",
    "import_provenance",
  ]), label);
  assertOpaqueId(value.id, ITEM_ID_PATTERN, `${label}.id`);
  if (value.kind !== "delivery_dish" || value.delivery_authority !== "public_import") {
    fail("VALIDATION_FAILED", `${label} must be a public-import delivery dish`);
  }
  const evidenceIds = assertArrayBounds(value.evidence_ids, `${label}.evidence_ids`, 1, 1_000)
    .map((id, index) => assertOpaqueId(id, EVIDENCE_ID_PATTERN, `${label}.evidence_ids[${index}]`));
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    fail("VALIDATION_FAILED", `${label}.evidence_ids must be unique`);
  }
  assertIsoDateTime(value.created_at, `${label}.created_at`);
  assertIsoDateTime(value.updated_at, `${label}.updated_at`);
  if (value.schema_version !== 1) fail("VALIDATION_FAILED", `${label}.schema_version is unsupported`);
  assertStringRange(value.body_markdown, `${label}.body_markdown`, 0, 100_000);
  assertBoundedText(value.dish_name, `${label}.dish_name`, 500);
  assertBoundedText(value.restaurant_name, `${label}.restaurant_name`, 300);
  assertBoundedText(value.public_location_label, `${label}.public_location_label`, 500);
  assertRestaurantPublicAddress(value.public_merchant_address, `${label}.public_merchant_address`);
  assertHttpsUrl(value.image_url, `${label}.image_url`, { nullable: true });
  assertHttpsUrl(value.image_page_url, `${label}.image_page_url`, { nullable: true });
  assertBoundedText(value.source_display_attribution, `${label}.source_display_attribution`, 300, { nullable: true });
  assertDeliveryClassification(value.classification, `${label}.classification`);
  const provenance = assertDeliveryImportProvenance(value.import_provenance, `${label}.import_provenance`);
  for (const evidenceId of evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    assertImportEvidence(evidence, `${label}.evidence[${evidenceId}]`);
    const expectedLocator = `${provenance.source_snapshot_id}/${provenance.source_collection_item_id}`;
    if (evidence.stable_locator !== expectedLocator) {
      fail("VALIDATION_FAILED", `${label} import evidence must match its collection provenance`);
    }
  }
  return value;
}

function assertDeliveryProfileDocument(value) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "journal.delivery_profile must be an object");
  assertExactKeys(value, new Set(["profile", "markdown"]), "journal.delivery_profile");
  assertStringRange(value.markdown, "journal.delivery_profile.markdown", 0, 100_000);
  if (!isPlainObject(value.profile)) fail("VALIDATION_FAILED", "journal.delivery_profile.profile must be an object");
  assertExactKeys(value.profile, new Set(["providers", "interpretation_preferences", "schema_version"]), "journal.delivery_profile.profile");
  if (value.profile.schema_version !== 1) fail("VALIDATION_FAILED", "delivery profile schema version is unsupported");
  const providers = assertArrayBounds(value.profile.providers, "journal.delivery_profile.profile.providers", 0, 20);
  const origins = new Set();
  for (const [index, provider] of providers.entries()) {
    const label = `journal.delivery_profile.profile.providers[${index}]`;
    if (!isPlainObject(provider)) fail("VALIDATION_FAILED", `${label} must be an object`);
    assertExactKeys(provider, new Set([
      "provider_label",
      "provider_origin",
      "history_start",
      "history_end",
      "completed_history_cursor",
    ]), label);
    assertBoundedText(provider.provider_label, `${label}.provider_label`, 120);
    const origin = assertProviderOrigin(provider.provider_origin, `${label}.provider_origin`);
    if (origins.has(origin)) fail("VALIDATION_FAILED", "delivery profile provider origins must be unique");
    origins.add(origin);
    const historyStart = assertIsoDate(provider.history_start, `${label}.history_start`);
    const historyEnd = assertIsoDate(provider.history_end, `${label}.history_end`);
    if (historyStart > historyEnd) fail("VALIDATION_FAILED", `${label} history window is invalid`);
    if (provider.completed_history_cursor !== null) {
      if (!isPlainObject(provider.completed_history_cursor)) {
        fail("VALIDATION_FAILED", `${label}.completed_history_cursor must be null or an object`);
      }
      assertExactKeys(
        provider.completed_history_cursor,
        new Set(["completed_order_date", "provider_order_locator"]),
        `${label}.completed_history_cursor`,
      );
      const cursorDate = assertIsoDate(
        provider.completed_history_cursor.completed_order_date,
        `${label}.completed_history_cursor.completed_order_date`,
      );
      assertPrivateProviderLocator(
        provider.completed_history_cursor.provider_order_locator,
        `${label}.completed_history_cursor.provider_order_locator`,
        512,
      );
      if (cursorDate < historyStart || cursorDate > historyEnd) {
        fail("VALIDATION_FAILED", `${label}.completed_history_cursor falls outside the history window`);
      }
    }
  }
  const preferences = assertArrayBounds(
    value.profile.interpretation_preferences,
    "journal.delivery_profile.profile.interpretation_preferences",
    0,
    50,
  );
  for (const [index, preference] of preferences.entries()) {
    const label = `journal.delivery_profile.profile.interpretation_preferences[${index}]`;
    if (!isPlainObject(preference)) fail("VALIDATION_FAILED", `${label} must be an object`);
    assertExactKeys(preference, new Set(["scope", "instruction", "confirmation"]), label);
    if (!["provider", "restaurant_location", "dish", "order"].includes(preference.scope)
      || preference.confirmation !== "user_confirmed") {
      fail("VALIDATION_FAILED", `${label} is invalid`);
    }
    assertBoundedText(preference.instruction, `${label}.instruction`, 500);
  }
  return value;
}

function assertDeliveryReport(value, deliveryItemsById, deliveryEvidenceById) {
  if (!isPlainObject(value)) fail("VALIDATION_FAILED", "journal.delivery_report must be an object");
  assertExactKeys(value, new Set(["report_type", "markdown", "assertions", "schema_version"]), "journal.delivery_report");
  if (value.report_type !== "delivery_index" || value.schema_version !== 1) {
    fail("VALIDATION_FAILED", "journal.delivery_report schema is unsupported");
  }
  assertStringRange(value.markdown, "journal.delivery_report.markdown", 0, 200_000);
  const assertions = assertArrayBounds(value.assertions, "journal.delivery_report.assertions", 0, 5_000);
  const rowIds = new Set();
  const coveredItemIds = new Set();
  const coveredEvidenceIds = new Set();
  for (const [index, assertion] of assertions.entries()) {
    const label = `journal.delivery_report.assertions[${index}]`;
    if (!isPlainObject(assertion)) fail("VALIDATION_FAILED", `${label} must be an object`);
    const allowed = ["row_id", "item_ids", "evidence_ids"];
    if (assertion.distinct_order_count !== undefined) allowed.push("distinct_order_count");
    if (assertion.last_date !== undefined) allowed.push("last_date");
    assertExactKeys(assertion, new Set(allowed), label);
    const rowId = assertStringRange(assertion.row_id, `${label}.row_id`, 1, 200);
    if (rowIds.has(rowId)) fail("VALIDATION_FAILED", "delivery report row IDs must be unique");
    rowIds.add(rowId);
    const itemIds = assertArrayBounds(assertion.item_ids, `${label}.item_ids`, 1, 1_000)
      .map((id, itemIndex) => assertOpaqueId(id, ITEM_ID_PATTERN, `${label}.item_ids[${itemIndex}]`));
    const evidenceIds = assertArrayBounds(assertion.evidence_ids, `${label}.evidence_ids`, 1, 5_000)
      .map((id, evidenceIndex) => assertOpaqueId(id, EVIDENCE_ID_PATTERN, `${label}.evidence_ids[${evidenceIndex}]`));
    if (new Set(itemIds).size !== itemIds.length || new Set(evidenceIds).size !== evidenceIds.length) {
      fail("VALIDATION_FAILED", `${label} citations must be unique`);
    }
    const items = itemIds.map((id) => deliveryItemsById.get(id));
    if (items.some((item) => item === undefined)) fail("VALIDATION_FAILED", `${label} cites a missing delivery dish`);
    const locationIdentities = new Set(items.map((item) => stableJson([
      item.provider_origin,
      item.restaurant_name,
      item.public_location_label,
      item.public_merchant_address,
      item.merchant_locator,
    ])));
    if (locationIdentities.size !== 1) {
      fail("VALIDATION_FAILED", `${label} must describe one exact provider and restaurant location`);
    }
    const expectedEvidence = new Set(items.flatMap((item) => item.evidence_ids));
    if (expectedEvidence.size !== new Set(evidenceIds).size
      || [...expectedEvidence].some((id) => !evidenceIds.includes(id))
      || evidenceIds.some((id) => !deliveryEvidenceById.has(id))) {
      fail("VALIDATION_FAILED", `${label} must cite the exact delivery-dish evidence`);
    }
    for (const itemId of itemIds) {
      if (coveredItemIds.has(itemId)) fail("VALIDATION_FAILED", "delivery dishes must appear in exactly one report row");
      coveredItemIds.add(itemId);
    }
    for (const evidenceId of evidenceIds) {
      if (coveredEvidenceIds.has(evidenceId)) {
        fail("VALIDATION_FAILED", "delivery evidence must appear in exactly one report row");
      }
      coveredEvidenceIds.add(evidenceId);
    }
    if (assertion.distinct_order_count !== undefined) {
      if (!Number.isSafeInteger(assertion.distinct_order_count) || assertion.distinct_order_count < 0) {
        fail("VALIDATION_FAILED", `${label}.distinct_order_count is invalid`);
      }
      const groups = new Set(evidenceIds.map((id) => {
        const line = deliveryEvidenceById.get(id).delivery_order_line;
        return stableJson([line.provider_origin, line.provider_order_locator, line.order_group_locator]);
      }));
      if (groups.size !== assertion.distinct_order_count) {
        fail("VALIDATION_FAILED", `${label}.distinct_order_count is incorrect`);
      }
    }
    if (assertion.last_date !== undefined) {
      const lastDate = assertIsoDate(assertion.last_date, `${label}.last_date`);
      const latest = evidenceIds.map((id) => deliveryEvidenceById.get(id).delivery_order_line.order_date).sort().at(-1);
      if (lastDate !== latest) fail("VALIDATION_FAILED", `${label}.last_date is incorrect`);
    }
  }
  if (coveredItemIds.size !== deliveryItemsById.size
    || [...deliveryItemsById.keys()].some((id) => !coveredItemIds.has(id))
    || coveredEvidenceIds.size !== deliveryEvidenceById.size
    || [...deliveryEvidenceById.keys()].some((id) => !coveredEvidenceIds.has(id))) {
    fail("VALIDATION_FAILED", "delivery report must cover every delivery dish and evidence record exactly once");
  }
  return value;
}

function assertCanonicalDeliveryJournal(value) {
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  const deliveryEvidence = evidence.filter((entry) => isPlainObject(entry) && entry.kind === "delivery_order_line");
  const deliveryItems = Array.isArray(value.items)
    ? value.items.filter((item) => isPlainObject(item) && item.kind === "delivery_dish")
    : [];
  const importedItems = deliveryItems.filter((item) => item.delivery_authority === "public_import");
  const historyItems = deliveryItems.filter((item) => item.delivery_authority !== "public_import");
  const hasHistory = deliveryEvidence.length > 0 || historyItems.length > 0;
  const hasHistoryDocuments = value.delivery_profile !== undefined || value.delivery_report !== undefined;
  if (!hasHistory && hasHistoryDocuments) {
    fail("VALIDATION_FAILED", "public-import delivery dishes cannot carry delivery history profile or report data");
  }
  if (!hasHistory && importedItems.length === 0) return;
  if (hasHistory && (value.delivery_profile === undefined || value.delivery_report === undefined)) {
    fail("VALIDATION_FAILED", "delivery journal saves require canonical evidence, items, profile, and report together");
  }
  const evidenceById = new Map();
  for (const [index, entry] of deliveryEvidence.entries()) {
    assertDeliveryEvidence(entry, `journal.evidence[delivery:${index}]`);
    if (evidenceById.has(entry.id)) fail("VALIDATION_FAILED", "delivery evidence IDs must be unique");
    evidenceById.set(entry.id, entry);
  }
  assertDeliveryEvidenceGroups(deliveryEvidence);
  const itemsById = new Map();
  const representedEvidenceIds = new Set();
  for (const [index, item] of historyItems.entries()) {
    assertHistoryBackedDeliveryDish(item, `journal.items[delivery:${index}]`, evidenceById);
    if (itemsById.has(item.id)) fail("VALIDATION_FAILED", "delivery dish IDs must be unique");
    for (const evidenceId of item.evidence_ids) {
      if (representedEvidenceIds.has(evidenceId)) {
        fail("VALIDATION_FAILED", "delivery evidence must support exactly one delivery dish");
      }
      representedEvidenceIds.add(evidenceId);
    }
    itemsById.set(item.id, item);
  }
  if (representedEvidenceIds.size !== evidenceById.size
    || [...evidenceById.keys()].some((id) => !representedEvidenceIds.has(id))) {
    fail("VALIDATION_FAILED", "every delivery evidence record must support one delivery dish");
  }
  if (hasHistory) {
    const profile = assertDeliveryProfileDocument(value.delivery_profile);
    assertDeliveryReport(value.delivery_report, itemsById, evidenceById);
    const profileOrigins = new Set(profile.profile.providers.map(({ provider_origin }) => provider_origin));
    if (deliveryEvidence.some(({ delivery_order_line }) => !profileOrigins.has(delivery_order_line.provider_origin))
      || historyItems.some(({ provider_origin }) => !profileOrigins.has(provider_origin))) {
      fail("VALIDATION_FAILED", "delivery evidence and dishes require a matching provider profile");
    }
  }

  const evidenceEntries = evidence.filter(isPlainObject);
  const allEvidenceById = new Map(evidenceEntries.map((entry) => [entry.id, entry]));
  const evidenceCounts = new Map();
  for (const entry of evidenceEntries) {
    evidenceCounts.set(entry.id, (evidenceCounts.get(entry.id) ?? 0) + 1);
  }
  const citationsByEvidenceId = new Map();
  for (const item of Array.isArray(value.items) ? value.items.filter(isPlainObject) : []) {
    if (!Array.isArray(item.evidence_ids)) continue;
    for (const evidenceId of item.evidence_ids) {
      citationsByEvidenceId.set(evidenceId, [...(citationsByEvidenceId.get(evidenceId) ?? []), item]);
    }
  }
  const importEvidenceCitations = new Set();
  const itemIds = new Set(itemsById.keys());
  for (const [index, item] of importedItems.entries()) {
    assertImportedDeliveryDish(item, `journal.items[delivery-import:${index}]`, allEvidenceById);
    if (itemIds.has(item.id)) fail("VALIDATION_FAILED", "delivery dish IDs must be unique");
    itemIds.add(item.id);
    for (const evidenceId of item.evidence_ids) {
      const citedBy = citationsByEvidenceId.get(evidenceId) ?? [];
      if (evidenceCounts.get(evidenceId) !== 1
        || citedBy.length !== 1
        || citedBy[0] !== item
        || importEvidenceCitations.has(evidenceId)) {
        fail("VALIDATION_FAILED", "delivery import evidence must support exactly one delivery dish");
      }
      importEvidenceCitations.add(evidenceId);
    }
  }
}

function isDeliveryEvidenceEntry(value) {
  return isPlainObject(value) && value.kind === "delivery_order_line";
}

function isDeliveryItemEntry(value) {
  return isPlainObject(value) && value.kind === "delivery_dish";
}

function isHistoryDeliveryItemEntry(value) {
  return isDeliveryItemEntry(value) && value.delivery_authority !== "public_import";
}

function deliveryImportEvidenceEntries(journal) {
  const evidenceIds = new Set(deliveryEntries(journal.items, isDeliveryItemEntry)
    .filter(({ delivery_authority: authority }) => authority === "public_import")
    .flatMap(({ evidence_ids: evidenceIds }) => Array.isArray(evidenceIds) ? evidenceIds : []));
  return deliveryEntries(journal.evidence, (entry) =>
    isPlainObject(entry) && entry.kind === "import" && evidenceIds.has(entry.id));
}

function deliveryEntries(value, predicate) {
  return Array.isArray(value) ? value.filter(predicate) : [];
}

function hasDeliveryPayload(journal) {
  return journal.delivery_profile !== undefined
    || journal.delivery_report !== undefined
    || deliveryEntries(journal.evidence, isDeliveryEvidenceEntry).length > 0
    || deliveryEntries(journal.items, isDeliveryItemEntry).length > 0;
}

function preserveDeliveryArray(requested, currentEntries, predicate, label) {
  if (currentEntries.length === 0) return requested;
  if (requested === undefined) return currentEntries;
  if (!Array.isArray(requested)) {
    fail("VALIDATION_FAILED", `${label} must be an array while delivery history exists`);
  }
  return [...requested.filter((entry) => !predicate(entry)), ...currentEntries];
}

function assertAppendOnlyDeliveryEntries(currentEntries, requestedEntries, label) {
  const requestedById = new Map(requestedEntries.map((entry) => [entry.id, entry]));
  for (const current of currentEntries) {
    const requested = requestedById.get(current.id);
    if (requested === undefined || stableJson(requested) !== stableJson(current)) {
      fail("VALIDATION_FAILED", `${label} is append-only and existing entries must remain exact`);
    }
  }
}

function assertRetainedDeliveryItems(currentItems, requestedItems) {
  const requestedIds = new Set(requestedItems.map(({ id }) => id));
  if (currentItems.some(({ id }) => !requestedIds.has(id))) {
    fail("VALIDATION_FAILED", "existing delivery dishes must not be removed");
  }
}

function reconcileDeliveryJournal(current, requested) {
  const currentEvidence = [
    ...deliveryEntries(current.evidence, isDeliveryEvidenceEntry),
    ...deliveryImportEvidenceEntries(current),
  ];
  const currentItems = deliveryEntries(current.items, isDeliveryItemEntry);
  const currentHasDelivery = hasDeliveryPayload(current);
  if (!currentHasDelivery) return requested;

  if (!hasDeliveryPayload(requested)) {
    return assertJournal({
      ...requested,
      evidence: preserveDeliveryArray(
        requested.evidence,
        currentEvidence,
        (entry) => currentEvidence.some(({ id }) => id === entry?.id),
        "journal.evidence",
      ),
      items: preserveDeliveryArray(requested.items, currentItems, isDeliveryItemEntry, "journal.items"),
      ...(current.delivery_profile === undefined ? {} : { delivery_profile: current.delivery_profile }),
      ...(current.delivery_report === undefined ? {} : { delivery_report: current.delivery_report }),
    });
  }

  const requestedEvidence = [
    ...deliveryEntries(requested.evidence, isDeliveryEvidenceEntry),
    ...deliveryImportEvidenceEntries(requested),
  ];
  const requestedItems = deliveryEntries(requested.items, isDeliveryItemEntry);
  assertAppendOnlyDeliveryEntries(currentEvidence, requestedEvidence, "delivery evidence");
  assertRetainedDeliveryItems(currentItems, requestedItems);

  const currentHistoryEvidence = deliveryEntries(current.evidence, isDeliveryEvidenceEntry);
  const currentHistoryItems = deliveryEntries(current.items, isHistoryDeliveryItemEntry);
  if (currentHistoryEvidence.length === 0 && currentHistoryItems.length === 0) return requested;
  const requestedHistoryEvidence = deliveryEntries(requested.evidence, isDeliveryEvidenceEntry);
  const requestedHistoryItems = deliveryEntries(requested.items, isHistoryDeliveryItemEntry);
  const currentEvidenceIds = new Set(currentHistoryEvidence.map(({ id }) => id));
  const currentItemIds = new Set(currentHistoryItems.map(({ id }) => id));
  const currentItemsById = new Map(currentHistoryItems.map((item) => [item.id, item]));
  const changedProviderOrigins = new Set([
    ...requestedHistoryEvidence
      .filter(({ id }) => !currentEvidenceIds.has(id))
      .map(({ delivery_order_line }) => delivery_order_line.provider_origin),
    ...requestedHistoryItems
      .filter((item) =>
        !currentItemIds.has(item.id) || stableJson(currentItemsById.get(item.id)) !== stableJson(item))
      .map(({ provider_origin }) => provider_origin),
  ]);
  if (changedProviderOrigins.size > 1) {
    fail("VALIDATION_FAILED", "one delivery save may update only one provider");
  }
  const requestedProviders = new Map(
    requested.delivery_profile.profile.providers.map((provider) => [provider.provider_origin, provider]),
  );
  for (const provider of current.delivery_profile.profile.providers) {
    if (!changedProviderOrigins.has(provider.provider_origin)
      && stableJson(requestedProviders.get(provider.provider_origin)) !== stableJson(provider)) {
      fail("VALIDATION_FAILED", "delivery updates must preserve every unchanged provider profile");
    }
  }

  const requestedRows = new Map(
    requested.delivery_report.assertions.map((assertion) => [assertion.row_id, assertion]),
  );
  for (const assertion of current.delivery_report.assertions) {
    const providerOrigin = currentItemsById.get(assertion.item_ids[0]).provider_origin;
    if (!changedProviderOrigins.has(providerOrigin)
      && stableJson(requestedRows.get(assertion.row_id)) !== stableJson(assertion)) {
      fail("VALIDATION_FAILED", "delivery updates must preserve every unchanged provider report row");
    }
  }
  return requested;
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
  if (value.kind === "journal_delivery_dish") {
    assertExactKeys(value, new Set(["kind", "item_id", "item_revision", "evidence_ids"]), "source");
    if (!Array.isArray(value.evidence_ids) || value.evidence_ids.length < 1 || value.evidence_ids.length > 100) {
      fail("VALIDATION_FAILED", "source.evidence_ids must contain between 1 and 100 IDs");
    }
    const evidenceIds = value.evidence_ids.map((entry) => assertOpaqueId(entry, EVIDENCE_ID_PATTERN, "delivery familiarity evidence ID"));
    if (new Set(evidenceIds).size !== evidenceIds.length) fail("VALIDATION_FAILED", "source.evidence_ids must be unique");
    return {
      kind: "journal_delivery_dish",
      item_id: assertOpaqueId(value.item_id, ITEM_ID_PATTERN, "source.item_id"),
      item_revision: assertOpaqueId(value.item_revision, LOCAL_RECIPE_DIGEST_PATTERN, "source.item_revision"),
      evidence_ids: evidenceIds,
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
  if (source.kind === "journal_delivery_dish") {
    const item = Array.isArray(journal.items)
      ? journal.items.find((candidate) => isPlainObject(candidate) && candidate.id === source.item_id)
      : undefined;
    if (item === undefined || item.kind !== "delivery_dish") {
      fail("VALIDATION_FAILED", "a delivery-dish proposal must cite an existing delivery dish");
    }
    if (localRecipeContentDigest(item) !== source.item_revision) {
      fail("LOCAL_RECIPE_REVISION_CONFLICT", "the cited delivery dish revision is no longer current");
    }
    const itemEvidenceIds = new Set(item.evidence_ids);
    const evidence = Array.isArray(journal.evidence) ? journal.evidence : [];
    const expectedKind = item.delivery_authority === "public_import" ? "import" : "delivery_order_line";
    const invalidEvidence = source.evidence_ids.some((id) => {
      const cited = evidence.find((candidate) => isPlainObject(candidate) && candidate.id === id);
      return !itemEvidenceIds.has(id) || cited?.kind !== expectedKind;
    });
    if (invalidEvidence) {
      fail(
        "VALIDATION_FAILED",
        expectedKind === "import"
          ? "a shared-dish proposal requires cited import evidence"
          : "an ordered-before proposal requires cited delivery-order evidence",
      );
    }
    return;
  }
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
  assertCanonicalDeliveryJournal(value);
  if (value.meal_planning !== undefined) assertMealPlanningState(value.meal_planning);
  const canonicalPublicAddressParents = new Set([
    ...(Array.isArray(value.evidence)
      ? value.evidence
        .filter(isDeliveryEvidenceEntry)
        .map(({ delivery_order_line }) => delivery_order_line.restaurant)
      : []),
    ...(Array.isArray(value.items) ? value.items.filter(isDeliveryItemEntry) : []),
  ]);
  const pending = [{ value, depth: 0, allowAddressLines: false }];
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
      for (const child of current.value) {
        pending.push({ value: child, depth: current.depth + 1, allowAddressLines: false });
      }
      continue;
    }
    if (!isPlainObject(current.value)) fail("VALIDATION_FAILED", "journal contains a non-JSON value");
    for (const [key, child] of Object.entries(current.value)) {
      const normalizedKey = normalizeJournalKey(key);
      const isCanonicalPublicAddress = normalizedKey === "public_merchant_address"
        && canonicalPublicAddressParents.has(current.value);
      const isContextSafe = isCanonicalPublicAddress
        || (normalizedKey === "address_lines" && current.allowAddressLines);
      if (!isContextSafe && isForbiddenJournalKey(key)) {
        fail("PROHIBITED_LOCAL_DATA", `journal field ${key} must not be stored locally`);
      }
      pending.push({
        value: child,
        depth: current.depth + 1,
        allowAddressLines: isCanonicalPublicAddress,
      });
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

function parseDeliveryPromotions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_DELIVERY_PROMOTIONS) {
    fail("CORRUPT_LOCAL_HOUSEHOLD", "delivery_promotions is invalid");
  }
  const keys = new Set();
  return value.map((promotion, index) => {
    const label = `delivery_promotions[${index}]`;
    if (!isPlainObject(promotion)) fail("CORRUPT_LOCAL_HOUSEHOLD", `${label} must be an object`);
    assertExactKeys(promotion, new Set([
      "provider_origin",
      "payload_fingerprint",
      "cloud_target_fingerprint",
      "cloud_user_id",
      "cloud_household_id",
      "source_revision",
      "expected_repository_head",
      "idempotency_key",
      "status",
      "repository_head",
      "committed_at",
    ]), label);
    const idempotencyKey = assertIdempotencyKey(promotion.idempotency_key);
    if (keys.has(idempotencyKey)) fail("CORRUPT_LOCAL_HOUSEHOLD", "delivery promotion keys must be unique");
    keys.add(idempotencyKey);
    if (typeof promotion.payload_fingerprint !== "string"
      || !PAYLOAD_FINGERPRINT_PATTERN.test(promotion.payload_fingerprint)) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", `${label}.payload_fingerprint is invalid`);
    }
    if (typeof promotion.cloud_target_fingerprint !== "string"
      || !PAYLOAD_FINGERPRINT_PATTERN.test(promotion.cloud_target_fingerprint)) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", `${label}.cloud_target_fingerprint is invalid`);
    }
    if (!["pending", "committed"].includes(promotion.status)) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", `${label}.status is invalid`);
    }
    if ((promotion.status === "pending"
        && (promotion.cloud_user_id !== null
          || promotion.cloud_household_id !== null
          || promotion.repository_head !== null
          || promotion.committed_at !== null))
      || (promotion.status === "committed"
        && (promotion.cloud_user_id === null
          || promotion.cloud_household_id === null
          || promotion.repository_head === null
          || promotion.committed_at === null))) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", `${label} linkage fields do not match its status`);
    }
    const cloudUserId = promotion.status === "pending"
      ? null
      : assertFullwellId(promotion.cloud_user_id, "usr", `${label}.cloud_user_id`);
    const cloudHouseholdId = promotion.status === "pending"
      ? null
      : assertFullwellId(promotion.cloud_household_id, "hsh", `${label}.cloud_household_id`);
    if (promotion.status === "committed"
      && deliveryTargetFingerprint(cloudUserId, cloudHouseholdId) !== promotion.cloud_target_fingerprint) {
      fail("CORRUPT_LOCAL_HOUSEHOLD", `${label}.cloud_target_fingerprint does not match its linkage`);
    }
    return {
      provider_origin: assertProviderOrigin(promotion.provider_origin, `${label}.provider_origin`),
      payload_fingerprint: promotion.payload_fingerprint,
      cloud_target_fingerprint: promotion.cloud_target_fingerprint,
      cloud_user_id: cloudUserId,
      cloud_household_id: cloudHouseholdId,
      source_revision: assertRevision(promotion.source_revision, `${label}.source_revision`),
      expected_repository_head: assertHead(promotion.expected_repository_head),
      idempotency_key: idempotencyKey,
      status: promotion.status,
      repository_head: promotion.repository_head === null ? null : assertHead(promotion.repository_head),
      committed_at: promotion.committed_at === null
        ? null
        : assertIsoDateTime(promotion.committed_at, `${label}.committed_at`),
    };
  });
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
    "delivery_promotions",
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
    delivery_promotions: parseDeliveryPromotions(value.delivery_promotions),
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
    const source = assertLocalMealSource(input.source);
    if (source.kind === "journal_delivery_dish" && input.compatibility !== "incomplete_evidence") {
      fail("VALIDATION_FAILED", "delivery dishes require incomplete ingredient evidence");
    }
    return {
      operation: "append_meal_proposal",
      expected_revision: assertRevision(input.expected_revision),
      idempotency_key: assertIdempotencyKey(input.idempotency_key),
      actor: assertLocalActor(input.actor_label),
      week_start: weekStart,
      meal_date: assertMealDate(weekStart, input.meal_date),
      slot: assertMealSlot(input.slot),
      source,
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
  if (input.operation === "stage_delivery_promotion") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "provider_origin",
      "payload_fingerprint",
      "cloud_user_id",
      "cloud_household_id",
      "expected_repository_head",
    ]), "stage_delivery_promotion request");
    if (typeof input.payload_fingerprint !== "string"
      || !PAYLOAD_FINGERPRINT_PATTERN.test(input.payload_fingerprint)) {
      fail("VALIDATION_FAILED", "payload_fingerprint must be a sha256 digest");
    }
    return {
      operation: "stage_delivery_promotion",
      expected_revision: assertRevision(input.expected_revision),
      provider_origin: assertProviderOrigin(input.provider_origin),
      payload_fingerprint: input.payload_fingerprint,
      cloud_user_id: assertFullwellId(input.cloud_user_id, "usr", "cloud_user_id"),
      cloud_household_id: assertFullwellId(input.cloud_household_id, "hsh", "cloud_household_id"),
      expected_repository_head: assertHead(input.expected_repository_head),
    };
  }
  if (input.operation === "record_delivery_promotion") {
    assertExactKeys(input, new Set([
      "operation",
      "expected_revision",
      "provider_origin",
      "promotion_idempotency_key",
      "user_id",
      "household_id",
      "repository_head",
    ]), "record_delivery_promotion request");
    return {
      operation: "record_delivery_promotion",
      expected_revision: assertRevision(input.expected_revision),
      provider_origin: assertProviderOrigin(input.provider_origin),
      promotion_idempotency_key: assertIdempotencyKey(input.promotion_idempotency_key),
      user_id: assertFullwellId(input.user_id, "usr", "user_id"),
      household_id: assertFullwellId(input.household_id, "hsh", "household_id"),
      repository_head: assertHead(input.repository_head),
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
  const deliveryContentRevisions = items.flatMap((item) =>
    isPlainObject(item) && item.kind === "delivery_dish" && typeof item.id === "string" && ITEM_ID_PATTERN.test(item.id)
      ? [{
          item_id: item.id,
          item_revision: localRecipeContentDigest(item),
          familiarity: item.delivery_authority === "public_import" ? "shared_dish" : "ordered_before",
          evidence_ids: Array.isArray(item.evidence_ids) ? [...item.evidence_ids] : [],
        }]
      : []);
  const planning = document.journal.meal_planning;
  const withdrawals = new Set(planning?.events.flatMap((event) =>
    event.kind === "proposal_withdrawn" ? [event.proposal_id] : []) ?? []);
  const mealProposalStatuses = planning?.proposals.map((proposal) => {
    const currentItemRevision = proposal.source.kind === "journal_recipe"
      ? recipeContentRevisions.find(({ item_id: itemId }) => itemId === proposal.source.item_id)?.item_revision ?? null
      : proposal.source.kind === "journal_delivery_dish"
        ? deliveryContentRevisions.find(({ item_id: itemId }) => itemId === proposal.source.item_id)?.item_revision ?? null
        : null;
    const needsRecheck = proposal.constraint_revision !== planning.profile.revision
      || ((proposal.source.kind === "journal_recipe" || proposal.source.kind === "journal_delivery_dish")
        && currentItemRevision !== proposal.source.item_revision);
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
    delivery_content_revisions: deliveryContentRevisions,
    meal_proposal_statuses: mealProposalStatuses,
    cloud_backup: document.cloud_backup,
    cloud_backup_current: document.cloud_backup?.local_revision === document.revision,
    delivery_promotions: document.delivery_promotions,
  };
}

async function mutate(root, expectedRevision, now, apply, beforeRevision) {
  const filePath = localHouseholdPath(root);
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(root, directory);
  const lock = await acquireLocalLock(directory, now);
  try {
    const current = await readDocument(filePath);
    if (current === null) fail("LOCAL_HOUSEHOLD_MISSING", "no local household exists");
    if (beforeRevision?.(current) === true) return current;
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

function deliveryTargetFingerprint(userId, householdId) {
  return `sha256:${createHash("sha256").update(stableJson({
    user_id: userId,
    household_id: householdId,
  })).digest("hex")}`;
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
      delivery_promotions: [],
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
    const journalWithDelivery = reconcileDeliveryJournal(current.journal, request.journal);
    const journalWithMealPlanning = currentMealPlanning === undefined
      ? journalWithDelivery
      : { ...journalWithDelivery, meal_planning: currentMealPlanning };
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

export async function stageLocalDeliveryPromotion(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "stage_delivery_promotion" });
  const cloudTargetFingerprint = deliveryTargetFingerprint(
    request.cloud_user_id,
    request.cloud_household_id,
  );
  const matchesRequest = (promotion) =>
    promotion.provider_origin === request.provider_origin
    && promotion.payload_fingerprint === request.payload_fingerprint
    && promotion.cloud_target_fingerprint === cloudTargetFingerprint
    && promotion.expected_repository_head === request.expected_repository_head;
  let replayed = false;
  const document = await mutate(root, request.expected_revision, now, (current) => {
    const profileOrigins = new Set(
      current.journal.delivery_profile?.profile.providers.map(({ provider_origin }) => provider_origin) ?? [],
    );
    if (!profileOrigins.has(request.provider_origin)) {
      fail("VALIDATION_FAILED", "the staged provider must exist in the canonical local delivery profile");
    }
    if (current.delivery_promotions.length >= MAX_DELIVERY_PROMOTIONS) {
      fail("LOCAL_HOUSEHOLD_TOO_LARGE", "local delivery promotions exceed the bounded history");
    }
    const idempotencyKey = `delivery-promotion-${createHash("sha256").update(stableJson({
      seed: current.promotion_idempotency_key,
      provider_origin: request.provider_origin,
      payload_fingerprint: request.payload_fingerprint,
      cloud_target_fingerprint: cloudTargetFingerprint,
      expected_repository_head: request.expected_repository_head,
    })).digest("hex").slice(0, 32)}`;
    return {
      ...current,
      revision: current.revision + 1,
      updated_at: now.toISOString(),
      delivery_promotions: [...current.delivery_promotions, {
        provider_origin: request.provider_origin,
        payload_fingerprint: request.payload_fingerprint,
        cloud_target_fingerprint: cloudTargetFingerprint,
        cloud_user_id: null,
        cloud_household_id: null,
        source_revision: current.revision,
        expected_repository_head: request.expected_repository_head,
        idempotency_key: idempotencyKey,
        status: "pending",
        repository_head: null,
        committed_at: null,
      }],
    };
  }, (current) => {
    if (current.delivery_promotions.some(matchesRequest)) {
      replayed = true;
      return true;
    }
    return false;
  });
  const promotion = document.delivery_promotions.find(matchesRequest);
  if (promotion === undefined) fail("CORRUPT_LOCAL_HOUSEHOLD", "staged delivery promotion is missing");
  return {
    status: replayed ? "delivery_promotion_replayed" : "delivery_promotion_staged",
    ...publicDocument(document),
    promotion,
  };
}

export async function recordLocalDeliveryPromotion(root, input, now = new Date()) {
  const request = parseRequest({ ...input, operation: "record_delivery_promotion" });
  const cloudTargetFingerprint = deliveryTargetFingerprint(request.user_id, request.household_id);
  const matchingPromotion = (current) => {
    const index = current.delivery_promotions.findIndex(({ idempotency_key }) =>
      idempotency_key === request.promotion_idempotency_key);
    if (index < 0) fail("VALIDATION_FAILED", "delivery promotion authority was not staged locally");
    const promotion = current.delivery_promotions[index];
    if (promotion.provider_origin !== request.provider_origin
      || promotion.cloud_target_fingerprint !== cloudTargetFingerprint) {
      fail("VALIDATION_FAILED", "delivery promotion result does not match its staged authority");
    }
    return { index, promotion };
  };
  let replayed = false;
  const document = await mutate(root, request.expected_revision, now, (current) => {
    const { index, promotion } = matchingPromotion(current);
    const promotions = [...current.delivery_promotions];
    promotions[index] = {
      ...promotion,
      cloud_user_id: request.user_id,
      cloud_household_id: request.household_id,
      status: "committed",
      repository_head: request.repository_head,
      committed_at: now.toISOString(),
    };
    return {
      ...current,
      revision: current.revision + 1,
      updated_at: now.toISOString(),
      delivery_promotions: promotions,
    };
  }, (current) => {
    const { promotion } = matchingPromotion(current);
    if (promotion.status !== "committed") return false;
    if (promotion.cloud_user_id !== request.user_id
      || promotion.cloud_household_id !== request.household_id
      || promotion.repository_head !== request.repository_head) {
      fail("IDEMPOTENCY_CONFLICT", "delivery promotion was already recorded with another repository head");
    }
    replayed = true;
    return true;
  });
  const promotion = document.delivery_promotions.find(({ idempotency_key }) =>
    idempotency_key === request.promotion_idempotency_key);
  if (promotion === undefined) fail("CORRUPT_LOCAL_HOUSEHOLD", "recorded delivery promotion is missing");
  return {
    status: replayed ? "delivery_promotion_replayed" : "delivery_promotion_recorded",
    ...publicDocument(document),
    promotion,
  };
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
  if (request.operation === "stage_delivery_promotion") return await stageLocalDeliveryPromotion(root, input, now);
  if (request.operation === "record_delivery_promotion") return await recordLocalDeliveryPromotion(root, input, now);
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
