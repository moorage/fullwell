import { z } from "zod";
import {
  ActorIdSchema,
  CollectionIdSchema,
  DeliveryOrderGroupLocatorSchema,
  DeliveryOrderLineKeySchema,
  EvidenceIdSchema,
  GitObjectIdSchema,
  HouseholdIdSchema,
  ImportIdSchema,
  ItemIdSchema,
  LocalRecipeContentDigestSchema,
  MealPlanEventIdSchema,
  MealProposalIdSchema,
  ProviderMenuItemLocatorSchema,
  ProviderMerchantLocatorSchema,
  ProviderOrderLocatorSchema,
  SessionIdSchema,
  SnapshotIdSchema,
} from "./ids.js";
import {
  DatePrecisionSchema,
  DateSchema,
  DateTimeSchema,
  IanaTimeZoneSchema,
  SafeHttpUrlSchema,
  SafeHttpsUrlSchema,
  SchemaVersionSchema,
} from "./common.js";

export const TriStateSchema = z.enum(["yes", "no", "unknown"]);
export const EvidenceKindSchema = z.enum([
  "purchase",
  "delivery_order_line",
  "recipe_discovery",
  "cooking",
  "user_confirmation",
  "import",
  "correction",
]);

const EvidenceCommonSchema = z.object({
  id: EvidenceIdSchema,
  observed_at: DateTimeSchema,
  evidence_date: DateSchema.nullable(),
  date_precision: DatePrecisionSchema,
  source_type: z.string().min(1).max(80),
  source_label: z.string().min(1).max(200),
  stable_locator: z.string().min(1).max(1000),
  summary: z.string().min(1).max(2000),
  actor_id: ActorIdSchema,
  limitations: z.array(z.string().min(1).max(500)).max(30),
  supersedes_evidence_id: EvidenceIdSchema.optional(),
  schema_version: SchemaVersionSchema,
});

export const PurchaseEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("purchase"),
  purchase: z.object({
    store: z.string().min(1).max(200),
    order_reference: z.string().min(1).max(300),
    line_item_title: z.string().min(1).max(500),
    order_date: DateSchema,
  }).strict(),
}).strict();

export const RecipeDiscoveryEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("recipe_discovery"),
  recipe_discovery: z.object({
    canonical_recipe_url: SafeHttpUrlSchema.optional(),
    audited_page_url: SafeHttpUrlSchema,
    displayed_image_url: SafeHttpUrlSchema.optional(),
    author_or_publisher: z.string().max(300).optional(),
    source_scope: z.enum(["discoverable", "saved", "cooked", "liked", "custom"]),
  }).strict(),
}).strict();

export const CookingEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("cooking"),
  cooking: z.object({
    recipe_item_id: ItemIdSchema.optional(),
    recipe_candidate: z.string().min(1).max(500).optional(),
    cooked_on: DateSchema,
    result: z.string().min(1).max(1000),
    changes: z.array(z.object({
      description: z.string().min(1).max(500),
      typical: z.boolean(),
    }).strict()).max(50),
  }).strict().refine((value) => value.recipe_item_id !== undefined || value.recipe_candidate !== undefined, {
    message: "A recipe item or candidate is required",
  }),
}).strict();

export const UserConfirmationEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("user_confirmation"),
  confirmation: z.object({
    subject: z.literal("recipe_preference"),
    recipe_item_id: ItemIdSchema,
    preference: z.literal("liked"),
  }).strict().optional(),
}).strict();

export const GenericEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.enum(["import", "correction"]),
}).strict();

const hasAsciiControlCharacter = (value: string) => [...value].some((character) => {
  const code = character.codePointAt(0);
  return code !== undefined && (code <= 31 || code === 127);
});

/**
 * Canonicalizes a user-approved provider site to one credential-free HTTPS origin.
 *
 * Paths, queries, and fragments are rejected so approval for one provider cannot
 * silently expand to a different browser scope.
 */
export const ProviderOriginSchema = z.string().max(2048).superRefine((value, context) => {
  if (hasAsciiControlCharacter(value)) {
    context.addIssue({ code: "custom", message: "Provider origins cannot contain ASCII control characters" });
  }
  if (!/^https:\/\/[^/?#]+\/?$/.test(value)) {
    context.addIssue({ code: "custom", message: "Provider origins must contain only an HTTPS authority" });
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "A valid provider origin is required" });
    return;
  }
  if (url.protocol !== "https:") {
    context.addIssue({ code: "custom", message: "Provider origins require HTTPS" });
  }
  if (url.username !== "" || url.password !== "") {
    context.addIssue({ code: "custom", message: "Provider origins cannot contain credentials" });
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    context.addIssue({ code: "custom", message: "Provider origins cannot contain a path, query, or fragment" });
  }
  const rawOrigin = value.endsWith("/") ? value.slice(0, -1) : value;
  if (rawOrigin.toLowerCase() !== url.origin.toLowerCase()) {
    context.addIssue({ code: "custom", message: "Provider origins cannot rely on URL parser normalization" });
  }
}).transform((value) => `${new URL(value).origin}/`).brand<"ProviderOrigin">();

export const DeliveryProviderLabelSchema = z.string().trim().min(1).max(120);
export const DeliveryFulfillmentModeSchema = z.enum(["delivery", "pickup"]);

const boundedAddressLabel = (maximumLength: number) => z.string()
  .max(maximumLength)
  .refine((value) => !hasAsciiControlCharacter(value), "Public merchant address labels cannot contain control characters")
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(maximumLength));

/**
 * Preserves only address labels displayed for the merchant location.
 *
 * Delivery destinations and account addresses have no field in this contract.
 */
export const RestaurantPublicAddressSchema = z.object({
  address_lines: z.array(boundedAddressLabel(200)).min(1).max(3).readonly().optional(),
  locality: boundedAddressLabel(120).optional(),
  region: boundedAddressLabel(120).optional(),
  postal_code: boundedAddressLabel(32).optional(),
  country: boundedAddressLabel(120).optional(),
}).strict().refine((value) => (
  value.address_lines !== undefined
  || value.locality !== undefined
  || value.region !== undefined
  || value.postal_code !== undefined
  || value.country !== undefined
), {
  message: "A public merchant address must contain at least one visible label",
}).readonly();

export const RestaurantLocationSchema = z.object({
  restaurant_name: z.string().trim().min(1).max(300),
  public_location_label: z.string().trim().min(1).max(500),
  public_merchant_address: RestaurantPublicAddressSchema.nullable().default(null),
  merchant_locator: ProviderMerchantLocatorSchema,
}).strict().readonly();

export const DeliveryModifierSelectionSchema = z.object({
  group_name: z.string().trim().min(1).max(200),
  option_name: z.string().trim().min(1).max(300),
}).strict().readonly();

export const DeliveryItemClassificationSchema = z.object({
  kind: z.enum(["food", "alcohol"]),
  authored_by: z.literal("agent"),
}).strict().readonly();

const DeliveryOrderLineSchema = z.object({
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  provider_order_locator: ProviderOrderLocatorSchema,
  order_group_locator: DeliveryOrderGroupLocatorSchema,
  order_date: DateSchema,
  completion_status: z.literal("completed"),
  fulfillment_mode: DeliveryFulfillmentModeSchema,
  group_complete: z.literal(true),
  declared_line_count: z.number().int().min(1).max(100),
  line_key: DeliveryOrderLineKeySchema,
  restaurant: RestaurantLocationSchema,
  dish_name: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(99),
  modifiers_complete: z.literal(true),
  modifiers: z.array(DeliveryModifierSelectionSchema).max(50).readonly(),
  historical_menu_item_locator: ProviderMenuItemLocatorSchema.nullable(),
  classification: DeliveryItemClassificationSchema,
}).strict().readonly();

export const DeliveryOrderLineEvidenceSchema = EvidenceCommonSchema.extend({
  kind: z.literal("delivery_order_line"),
  source_type: z.literal("delivery_provider"),
  source_label: DeliveryProviderLabelSchema,
  delivery_order_line: DeliveryOrderLineSchema,
}).strict().superRefine((value, context) => {
  if (value.source_label !== value.delivery_order_line.provider_label) {
    context.addIssue({
      code: "custom",
      path: ["source_label"],
      message: "Delivery evidence source label must match its provider label",
    });
  }
}).readonly();

export const NonDeliveryEvidenceSchema = z.discriminatedUnion("kind", [
  PurchaseEvidenceSchema,
  RecipeDiscoveryEvidenceSchema,
  CookingEvidenceSchema,
  UserConfirmationEvidenceSchema,
  GenericEvidenceSchema,
]);

export const EvidenceSchema = z.discriminatedUnion("kind", [
  PurchaseEvidenceSchema,
  DeliveryOrderLineEvidenceSchema,
  RecipeDiscoveryEvidenceSchema,
  CookingEvidenceSchema,
  UserConfirmationEvidenceSchema,
  GenericEvidenceSchema,
]);

/**
 * Validates the cross-line invariants that cannot be proven by one append-only
 * evidence record in isolation.
 */
export const DeliveryOrderGroupSchema = z.object({
  lines: z.array(DeliveryOrderLineEvidenceSchema).min(1).max(100).readonly(),
}).strict().superRefine(({ lines }, context) => {
  const first = lines[0];
  if (first === undefined) return;
  const uniqueEvidenceIds = new Set(lines.map(({ id }) => id));
  if (uniqueEvidenceIds.size !== lines.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Delivery order evidence IDs must be unique" });
  }
  const uniqueLineKeys = new Set(lines.map(({ delivery_order_line }) => delivery_order_line.line_key));
  if (uniqueLineKeys.size !== lines.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Delivery order line keys must be unique" });
  }
  const expected = first.delivery_order_line;
  if (expected.declared_line_count !== lines.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Declared line count must match the complete group" });
  }
  for (const [index, lineEvidence] of lines.entries()) {
    const line = lineEvidence.delivery_order_line;
    const sameGroup = lineEvidence.actor_id === first.actor_id
      && lineEvidence.source_type === first.source_type
      && lineEvidence.source_label === first.source_label
      && line.provider_origin === expected.provider_origin
      && line.provider_order_locator === expected.provider_order_locator
      && line.order_group_locator === expected.order_group_locator
      && line.order_date === expected.order_date
      && line.completion_status === expected.completion_status
      && line.fulfillment_mode === expected.fulfillment_mode
      && line.declared_line_count === expected.declared_line_count
      && line.provider_label === expected.provider_label
      && line.restaurant.restaurant_name === expected.restaurant.restaurant_name
      && line.restaurant.public_location_label === expected.restaurant.public_location_label
      && restaurantPublicAddressesMatch(
        line.restaurant.public_merchant_address,
        expected.restaurant.public_merchant_address,
      )
      && line.restaurant.merchant_locator === expected.restaurant.merchant_locator;
    if (!sameGroup) {
      context.addIssue({ code: "custom", path: ["lines", index], message: "Every line must describe the same complete provider order group" });
    }
  }
}).readonly();

function restaurantPublicAddressesMatch(
  left: z.infer<typeof RestaurantPublicAddressSchema> | null,
  right: z.infer<typeof RestaurantPublicAddressSchema> | null,
): boolean {
  if (left === null || right === null) return left === right;
  const sameAddressLines = left.address_lines?.length === right.address_lines?.length
    && (left.address_lines?.every((line, index) => line === right.address_lines?.[index]) ?? true);
  return sameAddressLines
    && left.locality === right.locality
    && left.region === right.region
    && left.postal_code === right.postal_code
    && left.country === right.country;
}

const ItemBaseSchema = z.object({
  id: ItemIdSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(1000),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
  body_markdown: z.string().max(100_000),
});

const GroceryItemFieldsSchema = ItemBaseSchema.extend({
  display_name: z.string().min(1).max(300),
  brand: z.string().max(200).nullable(),
  product_line: z.string().max(200).nullable(),
  flavor: z.string().max(200).nullable(),
  formulation: z.string().max(200).nullable(),
  format: z.string().max(200).nullable(),
  category: z.string().min(1).max(200),
  produce_variety: z.string().max(200).nullable(),
  known_size_variants: z.array(z.string().min(1).max(100)).max(50),
  image_page_url: SafeHttpUrlSchema.nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
});

export const GroceryItemKindSchema = z.enum(["snack", "ingredient", "condiment", "other_grocery"]);
export const JournalItemKindSchema = z.enum(["snack", "ingredient", "condiment", "other_grocery", "recipe", "delivery_dish"]);
export const SnackItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("snack") }).strict();
export const IngredientItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("ingredient") }).strict();
export const CondimentItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("condiment") }).strict();
export const OtherGroceryItemSchema = GroceryItemFieldsSchema.extend({ kind: z.literal("other_grocery") }).strict();

export const RecipeItemSchema = ItemBaseSchema.extend({
  kind: z.literal("recipe"),
  title: z.string().min(1).max(300),
  canonical_url: SafeHttpUrlSchema.nullable(),
  audited_page_url: SafeHttpUrlSchema.nullable(),
  author_or_publisher: z.string().max(300).nullable(),
  saved: TriStateSchema,
  cooked: TriStateSchema,
  liked: TriStateSchema,
  last_cooked: DateSchema.nullable(),
  date_precision: DatePrecisionSchema,
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
}).strict();

export const DeliveryModifierOccurrenceSchema = z.object({
  evidence_id: EvidenceIdSchema,
  modifiers_complete: z.literal(true),
  modifiers: z.array(DeliveryModifierSelectionSchema).max(50).readonly(),
}).strict().readonly();

export const HistoryBackedDeliveryDishItemSchema = ItemBaseSchema.extend({
  kind: z.literal("delivery_dish"),
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(1000).readonly(),
  dish_name: z.string().trim().min(1).max(500),
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  restaurant_name: z.string().trim().min(1).max(300),
  public_location_label: z.string().trim().min(1).max(500),
  public_merchant_address: RestaurantPublicAddressSchema.nullable().default(null),
  image_url: SafeHttpsUrlSchema.nullable().default(null),
  image_page_url: SafeHttpsUrlSchema.nullable().default(null),
  merchant_locator: ProviderMerchantLocatorSchema,
  known_menu_item_locators: z.array(ProviderMenuItemLocatorSchema).max(20).readonly(),
  known_modifier_occurrences: z.array(DeliveryModifierOccurrenceSchema).min(1).max(100).readonly(),
  classification: DeliveryItemClassificationSchema,
}).strict().superRefine((value, context) => {
  const citedEvidenceIds = new Set(value.evidence_ids);
  const occurrenceEvidenceIds = value.known_modifier_occurrences.map(({ evidence_id }) => evidence_id);
  if (new Set(occurrenceEvidenceIds).size !== occurrenceEvidenceIds.length) {
    context.addIssue({ code: "custom", path: ["known_modifier_occurrences"], message: "Modifier occurrences must cite unique evidence" });
  }
  if (new Set(value.known_menu_item_locators).size !== value.known_menu_item_locators.length) {
    context.addIssue({ code: "custom", path: ["known_menu_item_locators"], message: "Known menu item locators must be unique" });
  }
  for (const [index, evidenceId] of occurrenceEvidenceIds.entries()) {
    if (!citedEvidenceIds.has(evidenceId)) {
      context.addIssue({ code: "custom", path: ["known_modifier_occurrences", index, "evidence_id"], message: "Modifier occurrences must cite item evidence" });
    }
  }
  if (value.image_url !== null && value.image_page_url === null) {
    context.addIssue({ code: "custom", path: ["image_page_url"], message: "Delivery dish images require exact page provenance" });
  }
}).readonly();

export const DeliveryDishPublicImportProvenanceSchema = z.object({
  source_collection_id: CollectionIdSchema,
  source_snapshot_id: SnapshotIdSchema,
  source_collection_item_id: z.string().min(8).max(128),
  published_revision: GitObjectIdSchema,
  source_display_attribution: z.string().max(300).nullable(),
  imported_at: DateTimeSchema,
}).strict().readonly();

export const ImportedDeliveryDishItemSchema = ItemBaseSchema.extend({
  kind: z.literal("delivery_dish"),
  delivery_authority: z.literal("public_import"),
  dish_name: z.string().trim().min(1).max(500),
  restaurant_name: z.string().trim().min(1).max(300),
  public_location_label: z.string().trim().min(1).max(500),
  public_merchant_address: RestaurantPublicAddressSchema.nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
  source_display_attribution: z.string().max(300).nullable(),
  classification: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("food"), authored_by: z.literal("agent") }).strict(),
    z.object({ kind: z.literal("alcohol"), authored_by: z.literal("agent") }).strict(),
  ]),
  import_provenance: DeliveryDishPublicImportProvenanceSchema,
}).strict().readonly();

export const DeliveryDishItemSchema = z.union([
  HistoryBackedDeliveryDishItemSchema,
  ImportedDeliveryDishItemSchema,
]).readonly();

export const NonDeliveryJournalItemSchema = z.discriminatedUnion("kind", [
  SnackItemSchema,
  IngredientItemSchema,
  CondimentItemSchema,
  OtherGroceryItemSchema,
  RecipeItemSchema,
]);

export const JournalItemSchema = z.union([
  SnackItemSchema,
  IngredientItemSchema,
  CondimentItemSchema,
  OtherGroceryItemSchema,
  RecipeItemSchema,
  DeliveryDishItemSchema,
]);

export const ReportAssertionSchema = z.object({
  row_id: z.string().min(1).max(200),
  item_ids: z.array(ItemIdSchema).min(1).max(1000),
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(5000),
  distinct_order_count: z.number().int().nonnegative().optional(),
  last_date: DateSchema.optional(),
}).strict();

export const NonDeliveryReportSchema = z.object({
  report_type: z.enum(["recurring_snacks", "recipe_index"]),
  markdown: z.string().max(200_000),
  assertions: z.array(ReportAssertionSchema).max(5000),
  schema_version: SchemaVersionSchema,
}).strict();

const DeliveryReportAssertionSchema = ReportAssertionSchema.extend({
  item_ids: z.array(ItemIdSchema).min(1).max(1000).readonly(),
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(5000).readonly(),
}).readonly();

export const DeliveryIndexReportSchema = z.object({
  report_type: z.literal("delivery_index"),
  markdown: z.string().max(200_000),
  assertions: z.array(DeliveryReportAssertionSchema).max(5000).readonly(),
  schema_version: SchemaVersionSchema,
}).strict().readonly();

export const ReportSchema = z.union([
  NonDeliveryReportSchema,
  DeliveryIndexReportSchema,
]);

export const DeliveryCompletedHistoryCursorSchema = z.object({
  completed_order_date: DateSchema,
  provider_order_locator: ProviderOrderLocatorSchema,
}).strict().readonly();

export const DeliveryInterpretationPreferenceSchema = z.object({
  scope: z.enum(["provider", "restaurant_location", "dish", "order"]),
  instruction: z.string()
    .max(500)
    .refine((value) => !hasAsciiControlCharacter(value), "Interpretation preferences cannot contain control characters")
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(500)),
  confirmation: z.literal("user_confirmed"),
}).strict().readonly();

export const DeliveryProviderSelectionSchema = z.object({
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  history_start: DateSchema,
  history_end: DateSchema,
  completed_history_cursor: DeliveryCompletedHistoryCursorSchema.nullable().default(null),
}).strict().superRefine((value, context) => {
  if (value.history_start > value.history_end) {
    context.addIssue({ code: "custom", path: ["history_start"], message: "Delivery history start must not follow its end" });
  }
  const cursorDate = value.completed_history_cursor?.completed_order_date;
  if (cursorDate !== undefined && (cursorDate < value.history_start || cursorDate > value.history_end)) {
    context.addIssue({
      code: "custom",
      path: ["completed_history_cursor", "completed_order_date"],
      message: "The completed-history cursor must fall within the provider audit window",
    });
  }
}).readonly();

export const DeliveryProfileSchema = z.object({
  providers: z.array(DeliveryProviderSelectionSchema).max(20).readonly(),
  interpretation_preferences: z.array(DeliveryInterpretationPreferenceSchema).max(50).default([]).readonly(),
  schema_version: SchemaVersionSchema,
}).strict().superRefine(({ providers }, context) => {
  const origins = providers.map(({ provider_origin }) => provider_origin);
  if (new Set(origins).size !== origins.length) {
    context.addIssue({ code: "custom", path: ["providers"], message: "Each provider origin may appear once" });
  }
}).readonly();

const DeliveryCartFingerprintSchema = z.string()
  .regex(/^sha256:[0-9a-f]{64}$/)
  .brand<"DeliveryCartFingerprint">();
const DeliveryCartLineKeySchema = z.string().trim().min(1).max(512);
const DeliveryCartAmountMinorSchema = z.number().int().nonnegative().max(1_000_000);
const DeliveryCartRequestedSubtotalMinorSchema = DeliveryCartAmountMinorSchema
  .brand<"DeliveryCartRequestedSubtotalMinor">();
const DeliveryCartPreservedSubtotalMinorSchema = DeliveryCartAmountMinorSchema
  .brand<"DeliveryCartPreservedSubtotalMinor">();
const DeliveryCartDisplayedSubtotalMinorSchema = DeliveryCartAmountMinorSchema
  .brand<"DeliveryCartDisplayedSubtotalMinor">();

export const DeliveryCartJournalAuthoritySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("local"),
    journal_revision: z.number().int().positive(),
  }).strict(),
  z.object({
    kind: z.literal("cloud"),
    repository_head: GitObjectIdSchema,
  }).strict(),
]).readonly();

const DeliveryCartVisibleLineObjectSchema = z.object({
  line_key: DeliveryCartLineKeySchema,
  current_menu_item_locator: ProviderMenuItemLocatorSchema,
  dish_name: z.string().trim().min(1).max(500),
  modifiers: z.array(DeliveryModifierSelectionSchema).max(50).readonly(),
  quantity: z.number().int().min(1).max(99),
  unit_price_minor: DeliveryCartAmountMinorSchema,
}).strict();

export const DeliveryCartVisibleLineSchema = DeliveryCartVisibleLineObjectSchema.readonly();

export const DeliveryCartTargetLineSchema = DeliveryCartVisibleLineObjectSchema.extend({
  classification: DeliveryItemClassificationSchema,
}).strict().readonly();

const DeliveryCartSourceLineCommon = {
  source_line_key: DeliveryOrderLineKeySchema,
  baseline_cart_line_key: DeliveryCartLineKeySchema.nullable(),
  baseline_quantity: z.number().int().min(0).max(99),
};

export const DeliveryCartSourceLinePlanSchema = z.discriminatedUnion("operation", [
  z.object({
    ...DeliveryCartSourceLineCommon,
    operation: z.literal("retain"),
    target: DeliveryCartTargetLineSchema,
  }).strict(),
  z.object({
    ...DeliveryCartSourceLineCommon,
    operation: z.literal("remove"),
    authorized_decrement_quantity: z.number().int().min(0).max(99),
    baseline_remainder_quantity: z.number().int().min(0).max(99),
    target: z.null(),
  }).strict(),
  z.object({
    ...DeliveryCartSourceLineCommon,
    operation: z.literal("replace"),
    authorized_decrement_quantity: z.number().int().min(0).max(99),
    baseline_remainder_quantity: z.number().int().min(0).max(99),
    target: DeliveryCartTargetLineSchema,
  }).strict(),
  z.object({
    ...DeliveryCartSourceLineCommon,
    operation: z.literal("quantity"),
    target: DeliveryCartTargetLineSchema,
  }).strict(),
]).readonly();

/**
 * Captures the complete visible provider cart before any delivery mutation.
 *
 * The fingerprint and parsed line set bind recovery and destructive replacement
 * decisions to what the user actually saw, rather than remembered session state.
 */
export const DeliveryCartBaselineSchema = z.object({
  parsed_entire_cart: z.literal(true),
  fulfillment_mode: z.literal("delivery"),
  restaurant: RestaurantLocationSchema.nullable(),
  visible_summary: z.string().trim().min(1).max(4000),
  fingerprint: DeliveryCartFingerprintSchema,
  lines: z.array(DeliveryCartVisibleLineSchema).max(100).readonly(),
}).strict().superRefine(({ lines }, context) => {
  const keys = lines.map(({ line_key: lineKey }) => lineKey);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Visible cart line keys must be unique" });
  }
}).readonly();

/**
 * Proves terminal cart state from a new, complete provider observation.
 *
 * Unlike the action plan, this shape contains only what was visible after all
 * mutations, so terminal validation cannot succeed from intended targets alone.
 */
export const DeliveryCartFinalObservationSchema = z.object({
  parsed_entire_cart: z.literal(true),
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  fulfillment_mode: z.literal("delivery"),
  restaurant: RestaurantLocationSchema,
  visible_summary: z.string().trim().min(1).max(4000),
  fingerprint: DeliveryCartFingerprintSchema,
  lines: z.array(DeliveryCartVisibleLineSchema).max(100).readonly(),
  currency: z.literal("USD"),
  displayed_cart_food_subtotal_minor: DeliveryCartDisplayedSubtotalMinorSchema,
}).strict().superRefine(({ lines }, context) => {
  const keys = lines.map(({ line_key: lineKey }) => lineKey);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Final cart line keys must be unique" });
  }
}).readonly();

export const DeliveryCartPricingSchema = z.object({
  currency: z.literal("USD"),
  requested_food_subtotal_minor: DeliveryCartRequestedSubtotalMinorSchema,
  preserved_food_subtotal_minor: DeliveryCartPreservedSubtotalMinorSchema,
  displayed_cart_food_subtotal_minor: DeliveryCartDisplayedSubtotalMinorSchema,
  automatic_add_maximum_minor: DeliveryCartAmountMinorSchema,
  previous_requested_food_subtotal_minor: DeliveryCartRequestedSubtotalMinorSchema.nullable(),
  comparison: z.enum(["not_applicable", "same_or_lower", "increased"]),
  decision: z.enum(["automatic", "confirmation_required", "user_confirmed"]),
}).strict().superRefine((value, context) => {
  if (value.requested_food_subtotal_minor + value.preserved_food_subtotal_minor
    !== value.displayed_cart_food_subtotal_minor) {
    context.addIssue({ code: "custom", path: ["displayed_cart_food_subtotal_minor"], message: "Displayed cart subtotal must equal requested and preserved food subtotals" });
  }
  if ((value.previous_requested_food_subtotal_minor === null) !== (value.comparison === "not_applicable")) {
    context.addIssue({ code: "custom", path: ["comparison"], message: "Price comparison requires one prior food subtotal" });
  }
  if (value.previous_requested_food_subtotal_minor !== null) {
    const expected = value.requested_food_subtotal_minor > value.previous_requested_food_subtotal_minor
      ? "increased"
      : "same_or_lower";
    if (value.comparison !== expected) {
      context.addIssue({ code: "custom", path: ["comparison"], message: "Price comparison must match the observed food subtotal" });
    }
  }
}).readonly();

export const DeliveryCartReplacementSchema = z.object({
  required: z.boolean(),
  reason: z.literal("different_restaurant_or_location").nullable(),
}).strict().superRefine((value, context) => {
  if (value.required !== (value.reason !== null)) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Cart replacement reason must match its requirement" });
  }
}).readonly();

export const DeliveryCartConfirmationSchema = z.object({
  session_id: SessionIdSchema,
  provider_origin: ProviderOriginSchema,
  merchant_locator: ProviderMerchantLocatorSchema,
  public_location_label: z.string().trim().min(1).max(500),
  lines: z.array(DeliveryCartTargetLineSchema).min(1).max(100).readonly(),
  currency: z.literal("USD"),
  requested_food_subtotal_minor: DeliveryCartRequestedSubtotalMinorSchema,
  preserved_food_subtotal_minor: DeliveryCartPreservedSubtotalMinorSchema,
  displayed_cart_food_subtotal_minor: DeliveryCartDisplayedSubtotalMinorSchema,
  automatic_add_maximum_minor: DeliveryCartAmountMinorSchema,
  cart_replacement_required: z.boolean(),
  visible_cart_summary: z.string().trim().min(1).max(4000),
  visible_cart_fingerprint: DeliveryCartFingerprintSchema,
  confirmation_fingerprint: DeliveryCartFingerprintSchema,
}).strict().readonly();

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Encodes the only authority Fullwell may use to prepare a prior delivery cart.
 *
 * Every historical line is mapped once, every current target is price-bound,
 * and any price or cart-replacement confirmation is tied to this host session.
 */
export const DeliveryCartPlanSchema = z.object({
  session_id: SessionIdSchema,
  authority: DeliveryCartJournalAuthoritySchema,
  observed_at: DateTimeSchema,
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  restaurant: RestaurantLocationSchema,
  fulfillment_mode: z.literal("delivery"),
  source_order: DeliveryOrderGroupSchema,
  source_lines: z.array(DeliveryCartSourceLinePlanSchema).min(1).max(100).readonly(),
  cart_baseline: DeliveryCartBaselineSchema,
  preserved_cart_line_keys: z.array(DeliveryCartLineKeySchema).max(100).readonly(),
  cart_replacement: DeliveryCartReplacementSchema,
  pricing: DeliveryCartPricingSchema,
  confirmation: DeliveryCartConfirmationSchema.nullable(),
}).strict().superRefine((value, context) => {
  const historicalLines = value.source_order.lines.map(({ delivery_order_line: line }) => line);
  const firstHistoricalLine = historicalLines[0];
  if (firstHistoricalLine === undefined) return;
  if (firstHistoricalLine.fulfillment_mode !== "delivery") {
    context.addIssue({ code: "custom", path: ["source_order"], message: "Cart preparation requires a complete delivery-mode source order" });
  }
  const sameSelectedLocation = firstHistoricalLine.provider_label === value.provider_label
    && firstHistoricalLine.provider_origin === value.provider_origin
    && firstHistoricalLine.restaurant.restaurant_name === value.restaurant.restaurant_name
    && firstHistoricalLine.restaurant.public_location_label === value.restaurant.public_location_label
    && firstHistoricalLine.restaurant.merchant_locator === value.restaurant.merchant_locator
    && restaurantPublicAddressesMatch(
      firstHistoricalLine.restaurant.public_merchant_address,
      value.restaurant.public_merchant_address,
    );
  if (!sameSelectedLocation) {
    context.addIssue({ code: "custom", path: ["source_order"], message: "Source order must match the selected provider and exact restaurant location" });
  }

  const historicalByKey = new Map(historicalLines.map((line) => [line.line_key, line]));
  const baselineByKey = new Map(value.cart_baseline.lines.map((line) => [line.line_key, line]));
  const baselineRestaurant = value.cart_baseline.restaurant;
  const expectedReplacement = baselineRestaurant !== null
    && (
      baselineRestaurant.merchant_locator !== value.restaurant.merchant_locator
      || baselineRestaurant.restaurant_name !== value.restaurant.restaurant_name
      || baselineRestaurant.public_location_label !== value.restaurant.public_location_label
      || !restaurantPublicAddressesMatch(
        baselineRestaurant.public_merchant_address,
        value.restaurant.public_merchant_address,
      )
    );
  if (value.cart_replacement.required !== expectedReplacement) {
    context.addIssue({ code: "custom", path: ["cart_replacement"], message: "Cart replacement must match the parsed existing restaurant location" });
  }
  const mappedKeys = value.source_lines.map(({ source_line_key: sourceLineKey }) => sourceLineKey);
  if (new Set(mappedKeys).size !== mappedKeys.length
    || mappedKeys.length !== historicalByKey.size
    || mappedKeys.some((lineKey) => !historicalByKey.has(lineKey))) {
    context.addIssue({ code: "custom", path: ["source_lines"], message: "Every historical source line must be mapped exactly once" });
  }

  const mappedBaselineKeys = value.source_lines.flatMap(({ baseline_cart_line_key: lineKey }) =>
    lineKey === null ? [] : [lineKey]);
  if (new Set(mappedBaselineKeys).size !== mappedBaselineKeys.length) {
    context.addIssue({ code: "custom", path: ["source_lines"], message: "Each existing source cart line may be authorized once" });
  }
  for (const [index, linePlan] of value.source_lines.entries()) {
    const source = historicalByKey.get(linePlan.source_line_key);
    if (source === undefined) continue;
    const matchingBaselineLines = expectedReplacement
      ? []
      : value.cart_baseline.lines.filter((line) =>
        line.dish_name === source.dish_name && sameJson(line.modifiers, source.modifiers));
    if (matchingBaselineLines.length > 1) {
      context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_cart_line_key"], message: "Multiple existing cart lines match this historical source line" });
    }
    if (expectedReplacement && linePlan.baseline_cart_line_key !== null) {
      context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_cart_line_key"], message: "A different-location cart is replaced as a whole and cannot authorize source-line decrements" });
    }
    const baseline = linePlan.baseline_cart_line_key === null
      ? null
      : baselineByKey.get(linePlan.baseline_cart_line_key);
    if (linePlan.baseline_cart_line_key === null) {
      if (linePlan.baseline_quantity !== 0) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_quantity"], message: "An absent source cart line must have zero baseline quantity" });
      }
      if (matchingBaselineLines.length !== 0) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_cart_line_key"], message: "An exact existing source cart line must be mapped" });
      }
    } else if (baseline === undefined || baseline === null) {
      context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_cart_line_key"], message: "Mapped source cart line must exist in the parsed cart" });
    } else {
      if (baseline.quantity !== linePlan.baseline_quantity) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_quantity"], message: "Source-line baseline quantity must match the parsed cart" });
      }
      if (baseline.dish_name !== source.dish_name || !sameJson(baseline.modifiers, source.modifiers)) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_cart_line_key"], message: "Mapped source cart line must match the historical dish and modifiers" });
      }
    }
    if (linePlan.operation === "remove" || linePlan.operation === "replace") {
      const expectedDecrement = expectedReplacement
        ? 0
        : Math.min(source.quantity, linePlan.baseline_quantity);
      const expectedRemainder = expectedReplacement
        ? 0
        : linePlan.baseline_quantity - expectedDecrement;
      if (linePlan.authorized_decrement_quantity !== expectedDecrement) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "authorized_decrement_quantity"], message: "Remove or replace may decrement only the source-order quantity" });
      }
      if (linePlan.baseline_remainder_quantity !== expectedRemainder) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_remainder_quantity"], message: "Mapped source-line remainder must preserve excess cart quantity" });
      }
    }
    if (linePlan.target === null) continue;
    const sourceIdentityRetained = linePlan.target.dish_name === source.dish_name
      && sameJson(linePlan.target.modifiers, source.modifiers);
    if (linePlan.operation === "retain"
      && (!sourceIdentityRetained || linePlan.target.quantity !== source.quantity)) {
      context.addIssue({ code: "custom", path: ["source_lines", index], message: "Retained lines must preserve exact historical identity and quantity" });
    }
    if (linePlan.operation === "quantity"
      && (!sourceIdentityRetained || linePlan.target.quantity === source.quantity)) {
      context.addIssue({ code: "custom", path: ["source_lines", index], message: "Quantity edits must preserve identity and change quantity" });
    }
    if (linePlan.operation === "replace"
      && sourceIdentityRetained
      && linePlan.target.current_menu_item_locator === source.historical_menu_item_locator) {
      context.addIssue({ code: "custom", path: ["source_lines", index], message: "Replacement lines must select a different current menu item or identity" });
    }
    if ((linePlan.operation === "retain" || linePlan.operation === "quantity") && baseline !== null && baseline !== undefined) {
      if (linePlan.target.line_key !== baseline.line_key
        || linePlan.target.current_menu_item_locator !== baseline.current_menu_item_locator
        || linePlan.target.dish_name !== baseline.dish_name
        || !sameJson(linePlan.target.modifiers, baseline.modifiers)) {
        context.addIssue({ code: "custom", path: ["source_lines", index, "target"], message: "Retain and quantity edits must target the exact mapped source cart line" });
      }
    }
    if (linePlan.operation === "retain" && linePlan.baseline_quantity > linePlan.target.quantity) {
      context.addIssue({ code: "custom", path: ["source_lines", index, "baseline_quantity"], message: "Retain cannot silently reduce an existing cart quantity" });
    }
  }

  const targets = value.source_lines.flatMap(({ target }) => target === null ? [] : [target]);
  const targetKeys = targets.map(({ line_key: lineKey }) => lineKey);
  if (new Set(targetKeys).size !== targetKeys.length) {
    context.addIssue({ code: "custom", path: ["source_lines"], message: "Target cart line keys must be unique" });
  }
  const baselineRemainderLines = expectedReplacement
    ? []
    : value.source_lines.flatMap((linePlan) => {
      if ((linePlan.operation !== "remove" && linePlan.operation !== "replace")
      || linePlan.baseline_remainder_quantity === 0
      || linePlan.baseline_cart_line_key === null) {
        return [];
      }
      const baseline = baselineByKey.get(linePlan.baseline_cart_line_key);
      return baseline === undefined
        ? []
        : [{ ...baseline, quantity: linePlan.baseline_remainder_quantity }];
    });
  const remainderKeys = baselineRemainderLines.map(({ line_key: lineKey }) => lineKey);
  if (remainderKeys.some((lineKey) => targetKeys.includes(lineKey))) {
    context.addIssue({ code: "custom", path: ["source_lines"], message: "A preserved source remainder and replacement target require distinct cart line keys" });
  }
  const expectedRequestedSubtotal = targets.reduce(
    (subtotal, target) => subtotal + target.unit_price_minor * target.quantity,
    0,
  );
  if (expectedRequestedSubtotal !== value.pricing.requested_food_subtotal_minor) {
    context.addIssue({ code: "custom", path: ["pricing", "requested_food_subtotal_minor"], message: "Requested food subtotal must equal the exact target lines" });
  }

  const expectedPreservedKeys = expectedReplacement
    ? []
    : value.cart_baseline.lines
      .filter(({ line_key: lineKey }) =>
        !mappedBaselineKeys.includes(lineKey) && !targetKeys.includes(lineKey))
      .map(({ line_key: lineKey }) => lineKey)
      .sort();
  const actualPreservedKeys = [...value.preserved_cart_line_keys].sort();
  if (!sameJson(actualPreservedKeys, expectedPreservedKeys)) {
    context.addIssue({ code: "custom", path: ["preserved_cart_line_keys"], message: "Every unrelated same-location cart line must be preserved" });
  }
  const preservedCartLines = expectedReplacement
    ? []
    : value.cart_baseline.lines.filter(({ line_key: lineKey }) =>
      expectedPreservedKeys.includes(lineKey));
  const expectedPreservedSubtotal = [...preservedCartLines, ...baselineRemainderLines].reduce(
    (subtotal, line) => subtotal + line.unit_price_minor * line.quantity,
    0,
  );
  if (expectedPreservedSubtotal !== value.pricing.preserved_food_subtotal_minor) {
    context.addIssue({ code: "custom", path: ["pricing", "preserved_food_subtotal_minor"], message: "Preserved food subtotal must equal unrelated lines and source remainders" });
  }
  const expectedDisplayedSubtotal = expectedRequestedSubtotal + expectedPreservedSubtotal;
  if (expectedDisplayedSubtotal !== value.pricing.displayed_cart_food_subtotal_minor) {
    context.addIssue({ code: "custom", path: ["pricing", "displayed_cart_food_subtotal_minor"], message: "Displayed cart subtotal must equal the exact final food lines" });
  }

  const confirmationRequired = value.pricing.requested_food_subtotal_minor >= value.pricing.automatic_add_maximum_minor
    || value.pricing.comparison === "increased"
    || value.cart_replacement.required;
  if (value.pricing.decision === "automatic" && confirmationRequired) {
    context.addIssue({ code: "custom", path: ["pricing", "decision"], message: "Automatic cart preparation requires a lower unchanged price and no replacement" });
  }
  if (value.pricing.decision !== "automatic" && !confirmationRequired) {
    context.addIssue({ code: "custom", path: ["pricing", "decision"], message: "User confirmation requires a price or cart-replacement reason" });
  }
  if ((value.pricing.decision === "user_confirmed") !== (value.confirmation !== null)) {
    context.addIssue({ code: "custom", path: ["confirmation"], message: "Only a user-confirmed decision carries confirmation authority" });
  }
  if (value.confirmation !== null) {
    const expectedConfirmation = {
      session_id: value.session_id,
      provider_origin: value.provider_origin,
      merchant_locator: value.restaurant.merchant_locator,
      public_location_label: value.restaurant.public_location_label,
      lines: targets,
      currency: value.pricing.currency,
      requested_food_subtotal_minor: value.pricing.requested_food_subtotal_minor,
      preserved_food_subtotal_minor: value.pricing.preserved_food_subtotal_minor,
      displayed_cart_food_subtotal_minor: value.pricing.displayed_cart_food_subtotal_minor,
      automatic_add_maximum_minor: value.pricing.automatic_add_maximum_minor,
      cart_replacement_required: value.cart_replacement.required,
      visible_cart_summary: value.cart_baseline.visible_summary,
      visible_cart_fingerprint: value.cart_baseline.fingerprint,
    };
    const actualConfirmation = {
      session_id: value.confirmation.session_id,
      provider_origin: value.confirmation.provider_origin,
      merchant_locator: value.confirmation.merchant_locator,
      public_location_label: value.confirmation.public_location_label,
      lines: value.confirmation.lines,
      currency: value.confirmation.currency,
      requested_food_subtotal_minor: value.confirmation.requested_food_subtotal_minor,
      preserved_food_subtotal_minor: value.confirmation.preserved_food_subtotal_minor,
      displayed_cart_food_subtotal_minor: value.confirmation.displayed_cart_food_subtotal_minor,
      automatic_add_maximum_minor: value.confirmation.automatic_add_maximum_minor,
      cart_replacement_required: value.confirmation.cart_replacement_required,
      visible_cart_summary: value.confirmation.visible_cart_summary,
      visible_cart_fingerprint: value.confirmation.visible_cart_fingerprint,
    };
    if (!sameJson(actualConfirmation, expectedConfirmation)) {
      context.addIssue({ code: "custom", path: ["confirmation"], message: "Confirmation must match the exact active plan" });
    }
  }
}).readonly();

const DeliveryCartSessionCommon = {
  session_id: SessionIdSchema,
  authority: DeliveryCartJournalAuthoritySchema,
  updated_at: DateTimeSchema,
};
const DeliveryCartInputKindSchema = z.enum([
  "provider",
  "restaurant_location",
  "source_order",
  "requested_edit",
  "current_menu_item",
  "price_confirmation",
  "cart_replacement",
  "regulated_line",
]);
const DeliveryCartBlockReasonSchema = z.enum([
  "history_not_complete",
  "historical_fulfillment_not_delivery",
  "current_fulfillment_not_delivery",
  "journal_authority_changed",
  "origin_not_authorized",
  "restaurant_closed",
  "delivery_area_mismatch",
  "menu_item_unavailable",
  "menu_or_price_drift",
  "cart_drift",
  "sign_in_required",
  "captcha_required",
  "age_or_identity_user_action_required",
  "provider_result_unverifiable",
]);
const DeliveryCartPreparedResultSchema = z.object({
  status: z.literal("completed"),
  provider_label: DeliveryProviderLabelSchema,
  provider_origin: ProviderOriginSchema,
  restaurant_name: z.string().trim().min(1).max(300),
  public_location_label: z.string().trim().min(1).max(500),
  lines: z.array(DeliveryCartTargetLineSchema).min(1).max(100).readonly(),
  currency: z.literal("USD"),
  requested_food_subtotal_minor: DeliveryCartRequestedSubtotalMinorSchema,
  displayed_cart_food_subtotal_minor: DeliveryCartDisplayedSubtotalMinorSchema,
  final_cart: DeliveryCartFinalObservationSchema,
  manual_checkout_statement: z.literal("I stopped before checkout; please review the cart and place the order yourself."),
}).strict().readonly();

/**
 * Makes every direct delivery-cart outcome explicit and non-purchasing.
 *
 * Terminal success can describe only a verified cart; checkout, payment,
 * address, tip, scheduling, membership, and subscription concepts are absent.
 */
export const DeliveryCartSessionSchema = z.discriminatedUnion("state", [
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("resolving"),
    unresolved_step: z.enum(["provider", "restaurant_location", "source_order", "requested_edit", "current_menu", "cart"]),
    plan: z.null(),
  }).strict(),
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("needs_input"),
    input_kind: DeliveryCartInputKindSchema,
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(1).max(20).readonly(),
    plan: DeliveryCartPlanSchema.nullable(),
  }).strict(),
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("action_uncertain"),
    reason: z.literal("provider_result_unverifiable"),
    plan: DeliveryCartPlanSchema,
  }).strict(),
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("blocked"),
    reason: DeliveryCartBlockReasonSchema,
    plan: DeliveryCartPlanSchema.nullable(),
  }).strict(),
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("cancelled"),
    reason: z.string().trim().min(1).max(500),
    plan: DeliveryCartPlanSchema.nullable(),
  }).strict(),
  z.object({
    ...DeliveryCartSessionCommon,
    state: z.literal("cart_prepared"),
    plan: DeliveryCartPlanSchema,
    result: DeliveryCartPreparedResultSchema,
  }).strict(),
]).superRefine((value, context) => {
  if (value.plan !== null) {
    if (value.plan.session_id !== value.session_id || !sameJson(value.plan.authority, value.authority)) {
      context.addIssue({ code: "custom", path: ["plan"], message: "Plan authority must belong to the active session" });
    }
  }
  if (value.state === "cart_prepared") {
    if (value.plan.pricing.decision === "confirmation_required") {
      context.addIssue({ code: "custom", path: ["plan", "pricing", "decision"], message: "A prepared cart cannot retain unresolved confirmation authority" });
    }
    const targets = value.plan.source_lines.flatMap(({ target }) => target === null ? [] : [target]);
    const targetVisibleLines = targets.map((target) => ({
      line_key: target.line_key,
      current_menu_item_locator: target.current_menu_item_locator,
      dish_name: target.dish_name,
      modifiers: target.modifiers,
      quantity: target.quantity,
      unit_price_minor: target.unit_price_minor,
    }));
    const baselineByKey = new Map(
      value.plan.cart_baseline.lines.map((line) => [line.line_key, line]),
    );
    const preservedLines = value.plan.preserved_cart_line_keys.flatMap((lineKey) => {
      const line = baselineByKey.get(lineKey);
      return line === undefined ? [] : [line];
    });
    const baselineRemainderLines = value.plan.cart_replacement.required
      ? []
      : value.plan.source_lines.flatMap((linePlan) => {
        if ((linePlan.operation !== "remove" && linePlan.operation !== "replace")
        || linePlan.baseline_remainder_quantity === 0
        || linePlan.baseline_cart_line_key === null) {
          return [];
        }
        const baseline = baselineByKey.get(linePlan.baseline_cart_line_key);
        return baseline === undefined
          ? []
          : [{ ...baseline, quantity: linePlan.baseline_remainder_quantity }];
      });
    const expectedFinalLines = [...targetVisibleLines, ...preservedLines, ...baselineRemainderLines]
      .sort(({ line_key: left }, { line_key: right }) => left.localeCompare(right));
    const actualFinalLines = [...value.result.final_cart.lines]
      .sort(({ line_key: left }, { line_key: right }) => left.localeCompare(right));
    const finalCartMatchesPlan = value.result.final_cart.provider_label === value.plan.provider_label
      && value.result.final_cart.provider_origin === value.plan.provider_origin
      && value.result.final_cart.fulfillment_mode === "delivery"
      && value.result.final_cart.restaurant.restaurant_name === value.plan.restaurant.restaurant_name
      && value.result.final_cart.restaurant.public_location_label === value.plan.restaurant.public_location_label
      && value.result.final_cart.restaurant.merchant_locator === value.plan.restaurant.merchant_locator
      && restaurantPublicAddressesMatch(
        value.result.final_cart.restaurant.public_merchant_address,
        value.plan.restaurant.public_merchant_address,
      )
      && value.result.final_cart.currency === value.plan.pricing.currency
      && value.result.final_cart.displayed_cart_food_subtotal_minor
        === value.plan.pricing.displayed_cart_food_subtotal_minor
      && sameJson(actualFinalLines, expectedFinalLines);
    if (!finalCartMatchesPlan) {
      context.addIssue({ code: "custom", path: ["result", "final_cart"], message: "Final parsed cart must exactly prove every target and preserved line" });
    }
    const expectedResult = {
      status: "completed",
      provider_label: value.plan.provider_label,
      provider_origin: value.plan.provider_origin,
      restaurant_name: value.plan.restaurant.restaurant_name,
      public_location_label: value.plan.restaurant.public_location_label,
      lines: targets,
      currency: value.plan.pricing.currency,
      requested_food_subtotal_minor: value.plan.pricing.requested_food_subtotal_minor,
      displayed_cart_food_subtotal_minor: value.plan.pricing.displayed_cart_food_subtotal_minor,
      final_cart: value.result.final_cart,
      manual_checkout_statement: "I stopped before checkout; please review the cart and place the order yourself.",
    };
    if (!sameJson(value.result, expectedResult)) {
      context.addIssue({ code: "custom", path: ["result"], message: "Prepared result must match the exact verified plan" });
    }
  }
  if (value.state === "action_uncertain" && value.plan.pricing.decision === "confirmation_required") {
    context.addIssue({ code: "custom", path: ["plan", "pricing", "decision"], message: "No cart action may begin before required confirmation" });
  }
}).readonly();

const ExistingCollectionItemFields = {
  collection_item_id: z.string().min(8).max(128),
  source_item_id: ItemIdSchema,
  title: z.string().min(1).max(300),
  public_description: z.string().max(2000).nullable(),
  brand: z.string().max(200).nullable(),
  flavor: z.string().max(200).nullable(),
  formulation: z.string().max(200).nullable(),
  format: z.string().max(200).nullable(),
  author_or_publisher: z.string().max(300).nullable(),
  canonical_recipe_url: SafeHttpUrlSchema.nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
  preparation_notes: z.string().max(3000).nullable(),
  source_display_attribution: z.string().max(300).nullable(),
  source_item_revision: GitObjectIdSchema,
};

export const RecipeCollectionItemSchema = z.object({
  ...ExistingCollectionItemFields,
  kind: z.literal("recipe"),
}).strict();

export const SnackCollectionItemSchema = z.object({
  ...ExistingCollectionItemFields,
  kind: z.literal("snack"),
}).strict();

export const DeliveryDishCollectionItemSchema = z.object({
  collection_item_id: z.string().min(8).max(128),
  kind: z.literal("delivery_dish"),
  title: z.string().min(1).max(500),
  restaurant_name: z.string().min(1).max(300),
  public_location_label: z.string().min(1).max(500),
  public_merchant_address: RestaurantPublicAddressSchema.nullable(),
  public_description: z.string().max(2000).nullable(),
  public_note: z.string().max(3000).nullable(),
  image_url: SafeHttpUrlSchema.nullable(),
  image_page_url: SafeHttpUrlSchema.nullable(),
  source_display_attribution: z.string().max(300).nullable(),
  source_item_revision: GitObjectIdSchema,
  classification: z.literal("alcohol").optional(),
}).strict();

export const CollectionItemSchema = z.union([
  RecipeCollectionItemSchema,
  SnackCollectionItemSchema,
  DeliveryDishCollectionItemSchema,
]);

export const DeliveryDishCollectionSelectionSchema = DeliveryDishCollectionItemSchema.extend({
  source_item_id: ItemIdSchema,
}).strict();

export const CollectionSelectionItemSchema = z.union([
  RecipeCollectionItemSchema,
  SnackCollectionItemSchema,
  DeliveryDishCollectionSelectionSchema,
]);

export const CollectionSnapshotSchema = z.object({
  id: SnapshotIdSchema,
  collection_id: CollectionIdSchema,
  title: z.string().min(1).max(300),
  sharer_display_name: z.string().max(200).nullable(),
  items: z.array(CollectionItemSchema).min(1).max(200),
  created_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict();

export const ImportProvenanceSchema = z.object({
  import_id: ImportIdSchema,
  source_collection_id: CollectionIdSchema,
  source_snapshot_id: SnapshotIdSchema,
  source_item_id: ItemIdSchema,
  published_revision: GitObjectIdSchema,
  source_display_attribution: z.string().max(300).nullable(),
  imported_at: DateTimeSchema,
  destination_household_id: HouseholdIdSchema,
}).strict();

export const MutationStateSchema = z.enum([
  "received",
  "locked",
  "git_committed",
  "projections_applied",
  "completed",
  "failed_before_commit",
  "reconciliation_required",
  "quarantined",
]);

export const MondayDateSchema = DateSchema.refine((value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1, {
  message: "The week start must be a Monday",
}).brand<"MondayDate">();

export const MealSlotSchema = z.union([
  z.object({ kind: z.enum(["breakfast", "lunch", "dinner", "snack"]) }).strict(),
  z.object({ kind: z.literal("custom"), label: z.string().trim().min(1).max(80) }).strict(),
]).readonly();

export const MEAL_PLAN_MAX_PROPOSALS_PER_SLOT = 48;
export const MEAL_PLAN_MAX_PROPOSALS_PER_WEEK = 500;
export const MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK = 500;
export const MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK = MEAL_PLAN_MAX_PROPOSALS_PER_WEEK;
export const MEAL_PLAN_MAX_EVENTS_PER_WEEK =
  MEAL_PLAN_MAX_REVIEW_EVENTS_PER_WEEK + MEAL_PLAN_MAX_WITHDRAWAL_EVENTS_PER_WEEK;

const ConfirmedNoneConstraintsSchema = z.object({
  status: z.literal("confirmed_none"),
  time_zone: IanaTimeZoneSchema,
  reviewed_at: DateTimeSchema,
}).strict();

const RecordedConstraintsSchema = z.object({
  status: z.literal("recorded"),
  time_zone: IanaTimeZoneSchema,
  allergy_labels: z.array(z.string().trim().min(1).max(120)).max(30),
  sensitivity_labels: z.array(z.string().trim().min(1).max(120)).max(30),
  reviewed_at: DateTimeSchema,
}).strict();

function requireRecordedConstraint(value: { allergy_labels: string[]; sensitivity_labels: string[] }, context: z.RefinementCtx): void {
  if (value.allergy_labels.length + value.sensitivity_labels.length === 0) {
    context.addIssue({ code: "custom", message: "Recorded constraints require at least one allergy or sensitivity label" });
  }
  const labels = [...value.allergy_labels, ...value.sensitivity_labels].map((label) => label.toLocaleLowerCase());
  if (new Set(labels).size !== labels.length) {
    context.addIssue({ code: "custom", message: "Constraint labels must be unique" });
  }
}

export const MealPlanningConstraintsSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unresolved") }).strict(),
  ConfirmedNoneConstraintsSchema,
  RecordedConstraintsSchema,
]).superRefine((value, context) => {
  if (value.status === "recorded") requireRecordedConstraint(value, context);
});

export const ConfirmedMealPlanningConstraintsSchema = z.discriminatedUnion("status", [
  ConfirmedNoneConstraintsSchema,
  RecordedConstraintsSchema,
]).superRefine((value, context) => {
  if (value.status === "recorded") requireRecordedConstraint(value, context);
});

export const LocalActorSchema = z.object({
  kind: z.literal("local"),
  label: z.string().trim().min(1).max(80),
}).strict().readonly();

export const MealPlanActorSchema = z.union([ActorIdSchema, LocalActorSchema]);

const FreeformMealSourceSchema = z.object({
  kind: z.literal("freeform"),
  title: z.string().trim().min(1).max(300),
}).strict();
const ExternalMealSourceSchema = z.object({
  kind: z.literal("external_recipe"),
  title: z.string().trim().min(1).max(300),
  canonical_url: SafeHttpsUrlSchema,
  site_name: z.string().trim().min(1).max(200),
  discovered_at: DateTimeSchema,
}).strict();
const JournalMealSourceCommon = {
  kind: z.literal("journal_recipe"),
  item_id: ItemIdSchema,
  liked_evidence_ids: z.array(EvidenceIdSchema).min(1).max(100).readonly(),
};
const CloudJournalMealSourceSchema = z.object({
  ...JournalMealSourceCommon,
  item_revision: GitObjectIdSchema,
}).strict();
const LocalJournalMealSourceSchema = z.object({
  ...JournalMealSourceCommon,
  item_revision: LocalRecipeContentDigestSchema,
}).strict();
const JournalDeliveryDishMealSourceCommon = {
  kind: z.literal("journal_delivery_dish"),
  item_id: ItemIdSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(1).max(100).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Delivery familiarity evidence IDs must be unique" });
    }
  }).readonly(),
};
const CloudJournalDeliveryDishMealSourceSchema = z.object({
  ...JournalDeliveryDishMealSourceCommon,
  item_revision: GitObjectIdSchema,
}).strict();
const LocalJournalDeliveryDishMealSourceSchema = z.object({
  ...JournalDeliveryDishMealSourceCommon,
  item_revision: LocalRecipeContentDigestSchema,
}).strict();

export const CloudMealSourceSchema = z.discriminatedUnion("kind", [
  FreeformMealSourceSchema,
  CloudJournalMealSourceSchema,
  CloudJournalDeliveryDishMealSourceSchema,
  ExternalMealSourceSchema,
]).readonly();

export const LocalMealSourceSchema = z.discriminatedUnion("kind", [
  FreeformMealSourceSchema,
  LocalJournalMealSourceSchema,
  LocalJournalDeliveryDishMealSourceSchema,
  ExternalMealSourceSchema,
]).readonly();

export const MealSourceSchema = z.union([CloudMealSourceSchema, LocalMealSourceSchema]);

export const MealCompatibilitySchema = z.enum(["appears_compatible", "incomplete_evidence", "needs_recheck"]);
export const MealConstraintRevisionSchema = z.union([GitObjectIdSchema, z.number().int().nonnegative()]);

export function mealDateFallsWithinWeek(weekStart: string, mealDate: string): boolean {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`);
  const meal = Date.parse(`${mealDate}T00:00:00.000Z`);
  const offsetDays = (meal - start) / 86_400_000;
  return Number.isInteger(offsetDays) && offsetDays >= 0 && offsetDays <= 6;
}

export const MealProposalSchema = z.object({
  id: MealProposalIdSchema,
  week_start: MondayDateSchema,
  meal_date: DateSchema,
  slot: MealSlotSchema,
  proposed_by: MealPlanActorSchema,
  source: MealSourceSchema,
  servings: z.number().int().min(1).max(100).nullable(),
  notes: z.string().trim().min(1).max(1000).nullable(),
  constraint_revision: MealConstraintRevisionSchema,
  constraint_review_event_id: MealPlanEventIdSchema,
  compatibility: MealCompatibilitySchema,
  compatibility_caveat: z.string().trim().min(1).max(1000),
  created_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict().superRefine((value, context) => {
  if (!mealDateFallsWithinWeek(value.week_start, value.meal_date)) {
    context.addIssue({ code: "custom", path: ["meal_date"], message: "The meal date must fall within the proposal week" });
  }
  const local = typeof value.proposed_by !== "string";
  if (local !== (typeof value.constraint_revision === "number")) {
    context.addIssue({ code: "custom", path: ["constraint_revision"], message: "The constraint revision must match the proposal authority" });
  }
  if (value.source.kind === "journal_recipe" || value.source.kind === "journal_delivery_dish") {
    const localRevision = LocalRecipeContentDigestSchema.safeParse(value.source.item_revision).success;
    if (local !== localRevision) {
      context.addIssue({ code: "custom", path: ["source", "item_revision"], message: "The journal item revision must match the proposal authority" });
    }
  }
  if (value.source.kind === "journal_delivery_dish" && value.compatibility !== "incomplete_evidence") {
    context.addIssue({ code: "custom", path: ["compatibility"], message: "Delivery dishes require incomplete ingredient evidence" });
  }
}).readonly();

const MealPlanEventCommonSchema = z.object({
  id: MealPlanEventIdSchema,
  week_start: MondayDateSchema,
  actor: MealPlanActorSchema,
  occurred_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
});

export const ConstraintsReviewedEventSchema = MealPlanEventCommonSchema.extend({
  kind: z.literal("constraints_reviewed"),
  constraint_revision: MealConstraintRevisionSchema,
}).strict();

export const MealProposalWithdrawnEventSchema = MealPlanEventCommonSchema.extend({
  kind: z.literal("proposal_withdrawn"),
  proposal_id: MealProposalIdSchema,
  reason: z.string().trim().min(1).max(500).nullable(),
}).strict();

export const MealPlanEventSchema = z.discriminatedUnion("kind", [
  ConstraintsReviewedEventSchema,
  MealProposalWithdrawnEventSchema,
]).superRefine((value, context) => {
  if (value.kind === "constraints_reviewed") {
    const local = typeof value.actor !== "string";
    if (local !== (typeof value.constraint_revision === "number")) {
      context.addIssue({ code: "custom", path: ["constraint_revision"], message: "The constraint revision must match the event authority" });
    }
  }
}).readonly();

export const MealPlanningProfileSchema = z.object({
  constraints: MealPlanningConstraintsSchema,
  revision: MealConstraintRevisionSchema,
  updated_at: DateTimeSchema,
  schema_version: SchemaVersionSchema,
}).strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type NonDeliveryEvidence = z.infer<typeof NonDeliveryEvidenceSchema>;
export type DeliveryOrderLineEvidence = z.infer<typeof DeliveryOrderLineEvidenceSchema>;
export type DeliveryOrderGroup = z.infer<typeof DeliveryOrderGroupSchema>;
export type JournalItem = z.infer<typeof JournalItemSchema>;
export type NonDeliveryJournalItem = z.infer<typeof NonDeliveryJournalItemSchema>;
export type GroceryItemKind = z.infer<typeof GroceryItemKindSchema>;
export type SnackItem = z.infer<typeof SnackItemSchema>;
export type IngredientItem = z.infer<typeof IngredientItemSchema>;
export type CondimentItem = z.infer<typeof CondimentItemSchema>;
export type OtherGroceryItem = z.infer<typeof OtherGroceryItemSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type DeliveryDishItem = z.infer<typeof DeliveryDishItemSchema>;
export type ImportedDeliveryDishItem = z.infer<typeof ImportedDeliveryDishItemSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type NonDeliveryReport = z.infer<typeof NonDeliveryReportSchema>;
export type DeliveryIndexReport = z.infer<typeof DeliveryIndexReportSchema>;
export type ProviderOrigin = z.infer<typeof ProviderOriginSchema>;
export type DeliveryProviderLabel = z.infer<typeof DeliveryProviderLabelSchema>;
export type DeliveryFulfillmentMode = z.infer<typeof DeliveryFulfillmentModeSchema>;
export type RestaurantPublicAddress = z.infer<typeof RestaurantPublicAddressSchema>;
export type RestaurantLocation = z.infer<typeof RestaurantLocationSchema>;
export type DeliveryCompletedHistoryCursor = z.infer<typeof DeliveryCompletedHistoryCursorSchema>;
export type DeliveryInterpretationPreference = z.infer<typeof DeliveryInterpretationPreferenceSchema>;
export type DeliveryProviderSelection = z.infer<typeof DeliveryProviderSelectionSchema>;
export type DeliveryProfile = z.infer<typeof DeliveryProfileSchema>;
export type DeliveryCartJournalAuthority = z.infer<typeof DeliveryCartJournalAuthoritySchema>;
export type DeliveryCartVisibleLine = z.infer<typeof DeliveryCartVisibleLineSchema>;
export type DeliveryCartTargetLine = z.infer<typeof DeliveryCartTargetLineSchema>;
export type DeliveryCartSourceLinePlan = z.infer<typeof DeliveryCartSourceLinePlanSchema>;
export type DeliveryCartBaseline = z.infer<typeof DeliveryCartBaselineSchema>;
export type DeliveryCartFinalObservation = z.infer<typeof DeliveryCartFinalObservationSchema>;
export type DeliveryCartPricing = z.infer<typeof DeliveryCartPricingSchema>;
export type DeliveryCartReplacement = z.infer<typeof DeliveryCartReplacementSchema>;
export type DeliveryCartConfirmation = z.infer<typeof DeliveryCartConfirmationSchema>;
export type DeliveryCartPlan = z.infer<typeof DeliveryCartPlanSchema>;
export type DeliveryCartSession = z.infer<typeof DeliveryCartSessionSchema>;
export type CollectionSnapshot = z.infer<typeof CollectionSnapshotSchema>;
export type CollectionItem = z.infer<typeof CollectionItemSchema>;
export type CollectionSelectionItem = z.infer<typeof CollectionSelectionItemSchema>;
export type MutationState = z.infer<typeof MutationStateSchema>;
export type MondayDate = z.infer<typeof MondayDateSchema>;
export type MealSlot = z.infer<typeof MealSlotSchema>;
export type MealPlanningConstraints = z.infer<typeof MealPlanningConstraintsSchema>;
export type ConfirmedMealPlanningConstraints = z.infer<typeof ConfirmedMealPlanningConstraintsSchema>;
export type LocalActor = z.infer<typeof LocalActorSchema>;
export type MealSource = z.infer<typeof MealSourceSchema>;
export type CloudMealSource = z.infer<typeof CloudMealSourceSchema>;
export type LocalMealSource = z.infer<typeof LocalMealSourceSchema>;
export type MealCompatibility = z.infer<typeof MealCompatibilitySchema>;
export type MealConstraintRevision = z.infer<typeof MealConstraintRevisionSchema>;
export type MealProposal = z.infer<typeof MealProposalSchema>;
export type MealPlanEvent = z.infer<typeof MealPlanEventSchema>;
export type MealPlanningProfile = z.infer<typeof MealPlanningProfileSchema>;
