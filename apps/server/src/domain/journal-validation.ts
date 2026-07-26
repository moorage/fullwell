import type {
  DeliveryDishItem,
  DeliveryIndexReport,
  DeliveryOrderLineEvidence,
  Evidence,
  MealConstraintRevision,
  MealPlanEvent,
  MealProposal,
  JournalItem,
} from "@hfj/contracts";
import { DeliveryOrderGroupSchema } from "@hfj/contracts";
import { AppError } from "../core/errors.js";

export function validateItemEvidence(item: JournalItem, evidence: ReadonlyMap<string, Evidence>): void {
  const cited = item.evidence_ids.map((id) => evidence.get(id));
  if (cited.some((entry) => entry === undefined)) throw new AppError("VALIDATION_FAILED", "An item cites evidence that does not exist");
  if (item.kind === "delivery_dish") {
    if ("delivery_authority" in item) {
      if (cited.some((entry) => entry?.kind !== "import")) {
        throw new AppError("VALIDATION_FAILED", "An imported delivery dish must cite only import evidence");
      }
      return;
    }
    validateDeliveryDishEvidence(item, cited);
    return;
  }
  if (item.kind === "recipe") {
    if (item.saved === "yes" && !cited.some((entry) => entry?.kind === "recipe_discovery" || entry?.kind === "import" || entry?.kind === "user_confirmation")) {
      throw new AppError("VALIDATION_FAILED", "Saved status requires discovery, import, or confirmation evidence");
    }
    if (item.cooked === "yes" && !cited.some((entry) => entry?.kind === "cooking")) {
      throw new AppError("VALIDATION_FAILED", "Cooked status requires cooking evidence");
    }
    if (item.liked === "yes" && !cited.some((entry) => entry?.kind === "user_confirmation"
      && (entry.confirmation === undefined
        || (entry.confirmation.subject === "recipe_preference"
          && entry.confirmation.recipe_item_id === item.id
          && entry.confirmation.preference === "liked")))) {
      throw new AppError("VALIDATION_FAILED", "Liked status requires explicit confirmation evidence");
    }
  }
}

export function validateDeliveryImportEvidenceScope(
  items: ReadonlyMap<string, JournalItem>,
  evidence: ReadonlyMap<string, Evidence>,
  deliveryImportEvidenceIds: ReadonlySet<string>,
): void {
  const citations = new Map<string, JournalItem[]>();
  for (const item of items.values()) {
    for (const evidenceId of item.evidence_ids) {
      const citedBy = citations.get(evidenceId) ?? [];
      citedBy.push(item);
      citations.set(evidenceId, citedBy);
    }
  }

  for (const evidenceId of deliveryImportEvidenceIds) {
    const citedBy = citations.get(evidenceId) ?? [];
    const item = citedBy[0];
    if (evidence.get(evidenceId)?.kind !== "import"
      || citedBy.length !== 1
      || item?.kind !== "delivery_dish"
      || !("delivery_authority" in item)) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Delivery import evidence must be cited by exactly one public-import delivery dish",
      );
    }
  }

  for (const item of items.values()) {
    if (item.kind !== "delivery_dish" || !("delivery_authority" in item)) continue;
    if (item.evidence_ids.some((evidenceId) => !deliveryImportEvidenceIds.has(evidenceId))) {
      throw new AppError(
        "VALIDATION_FAILED",
        "A public-import delivery dish must cite canonical delivery import evidence",
      );
    }
  }
}

interface ReportValidationInput {
  readonly report_type?: "recurring_snacks" | "recipe_index" | "delivery_index";
  readonly assertions: ReadonlyArray<{
    readonly row_id: string;
    readonly item_ids: readonly string[];
    readonly evidence_ids: readonly string[];
    readonly distinct_order_count?: number | undefined;
    readonly last_date?: string | undefined;
  }>;
}

export function validateReport(report: ReportValidationInput, evidence: ReadonlyMap<string, Evidence>, itemIds: ReadonlySet<string>): void {
  for (const assertion of report.assertions) {
    if (assertion.item_ids.some((id) => !itemIds.has(id))) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} cites a missing item`);
    const cited = assertion.evidence_ids.map((id) => evidence.get(id));
    if (cited.some((entry) => entry === undefined)) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} cites missing evidence`);
    if (report.report_type !== "delivery_index" && assertion.distinct_order_count !== undefined) {
      const keys = new Set(cited.flatMap((entry) => entry?.kind === "purchase" ? [`${entry.purchase.store}\0${entry.purchase.order_reference}`] : []));
      if (keys.size !== assertion.distinct_order_count) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} has an incorrect distinct-order count`);
    }
    if (report.report_type !== "delivery_index" && assertion.last_date !== undefined) {
      const dates = cited.flatMap((entry) => entry?.evidence_date === null || entry?.evidence_date === undefined ? [] : [entry.evidence_date]).sort();
      if (dates.at(-1) !== assertion.last_date) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} has an incorrect last date`);
    }
  }
}

export function validateDeliveryEvidenceGroups(evidence: ReadonlyMap<string, Evidence>): void {
  const groups = new Map<string, DeliveryOrderLineEvidence[]>();
  for (const entry of evidence.values()) {
    if (entry.kind !== "delivery_order_line") continue;
    const line = entry.delivery_order_line;
    const key = JSON.stringify([
      line.provider_origin,
      line.provider_order_locator,
      line.order_group_locator,
    ]);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  for (const lines of groups.values()) {
    if (!DeliveryOrderGroupSchema.safeParse({ lines }).success) {
      throw new AppError("VALIDATION_FAILED", "Delivery order evidence does not form a complete order group");
    }
  }
}

export function validateDeliveryIndexReport(
  report: DeliveryIndexReport,
  evidence: ReadonlyMap<string, Evidence>,
  items: ReadonlyMap<string, JournalItem>,
): void {
  validateReport(report, evidence, new Set(items.keys()));
  for (const assertion of report.assertions) {
    const citedItems = assertion.item_ids.map((id) => items.get(id));
    if (citedItems.some((item) =>
      item?.kind !== "delivery_dish" || "delivery_authority" in item)) {
      throw new AppError("VALIDATION_FAILED", `Delivery report row ${assertion.row_id} must cite only delivery dishes backed by private history`);
    }
    const expectedEvidenceIds = new Set(citedItems.flatMap((item) =>
      item?.kind === "delivery_dish" ? item.evidence_ids : []));
    const assertedEvidenceIds = new Set(assertion.evidence_ids);
    if (expectedEvidenceIds.size !== assertedEvidenceIds.size
      || [...expectedEvidenceIds].some((id) => !assertedEvidenceIds.has(id))) {
      throw new AppError("VALIDATION_FAILED", `Delivery report row ${assertion.row_id} must cite the exact item evidence`);
    }
    const citedEvidence = assertion.evidence_ids.map((id) => evidence.get(id));
    if (citedEvidence.some((entry) => entry?.kind !== "delivery_order_line")) {
      throw new AppError("VALIDATION_FAILED", `Delivery report row ${assertion.row_id} must cite only delivery order evidence`);
    }
    const deliveryEvidence = citedEvidence.filter((entry): entry is DeliveryOrderLineEvidence =>
      entry?.kind === "delivery_order_line");
    if (assertion.distinct_order_count !== undefined) {
      const groups = new Set(deliveryEvidence.map(({ delivery_order_line: line }) => JSON.stringify([
        line.provider_origin,
        line.provider_order_locator,
        line.order_group_locator,
      ])));
      if (groups.size !== assertion.distinct_order_count) {
        throw new AppError("VALIDATION_FAILED", `Delivery report row ${assertion.row_id} has an incorrect distinct-order count`);
      }
    }
    if (assertion.last_date !== undefined) {
      const latest = deliveryEvidence.map(({ delivery_order_line }) => delivery_order_line.order_date).sort().at(-1);
      if (latest !== assertion.last_date) {
        throw new AppError("VALIDATION_FAILED", `Delivery report row ${assertion.row_id} has an incorrect last date`);
      }
    }
  }
}

function validateDeliveryDishEvidence(
  item: DeliveryDishItem,
  cited: ReadonlyArray<Evidence | undefined>,
): void {
  if ("delivery_authority" in item) {
    throw new AppError("VALIDATION_FAILED", "Imported delivery dishes have no private delivery-history authority");
  }
  const deliveryEvidence = cited.filter((entry): entry is DeliveryOrderLineEvidence =>
    entry?.kind === "delivery_order_line");
  if (deliveryEvidence.length !== cited.length) {
    throw new AppError("VALIDATION_FAILED", "A delivery dish must cite only delivery order evidence");
  }
  const occurrences = new Map(item.known_modifier_occurrences.map((occurrence) => [
    occurrence.evidence_id,
    occurrence,
  ]));
  if (occurrences.size !== deliveryEvidence.length) {
    throw new AppError("VALIDATION_FAILED", "A delivery dish must preserve modifiers for every cited order line");
  }
  const supportedMenuLocators = new Set<string>();
  for (const entry of deliveryEvidence) {
    const line = entry.delivery_order_line;
    if (line.provider_label !== item.provider_label
      || line.provider_origin !== item.provider_origin
      || line.restaurant.restaurant_name !== item.restaurant_name
      || line.restaurant.public_location_label !== item.public_location_label
      || JSON.stringify(line.restaurant.public_merchant_address) !== JSON.stringify(item.public_merchant_address)
      || line.restaurant.merchant_locator !== item.merchant_locator
      || line.dish_name !== item.dish_name
      || line.classification.kind !== item.classification.kind
      || line.classification.authored_by !== item.classification.authored_by) {
      throw new AppError("VALIDATION_FAILED", "A delivery dish conflicts with its cited order evidence");
    }
    const occurrence = occurrences.get(entry.id);
    if (occurrence === undefined || JSON.stringify(occurrence.modifiers) !== JSON.stringify(line.modifiers)) {
      throw new AppError("VALIDATION_FAILED", "A delivery dish modifier occurrence conflicts with its cited order line");
    }
    if (line.historical_menu_item_locator !== null) {
      supportedMenuLocators.add(line.historical_menu_item_locator);
    }
  }
  if (supportedMenuLocators.size !== item.known_menu_item_locators.length
    || item.known_menu_item_locators.some((locator) => !supportedMenuLocators.has(locator))) {
    throw new AppError("VALIDATION_FAILED", "A delivery dish menu locators must match its cited order evidence");
  }
}

export function markdownDocument(frontmatter: object, body: string): string {
  const lines = Object.entries(frontmatter).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n${body.replaceAll("\r\n", "\n")}\n`;
}

export function journalItemArea(kind: JournalItem["kind"]): "snacks" | "ingredients" | "condiments" | "groceries" | "recipes" | "delivery" {
  switch (kind) {
    case "snack": return "snacks";
    case "ingredient": return "ingredients";
    case "condiment": return "condiments";
    case "other_grocery": return "groceries";
    case "recipe": return "recipes";
    case "delivery_dish": return "delivery";
  }
}

export function journalItemPath(item: JournalItem): string {
  return `${journalItemArea(item.kind)}/items/${item.id}.md`;
}

export function journalEvidencePath(evidence: Evidence): string {
  const area = evidence.kind === "delivery_order_line"
    ? "delivery"
    : evidence.kind === "purchase" ? "groceries" : "recipes";
  return `${area}/evidence/${evidence.observed_at.slice(0, 4)}/${evidence.id}.json`;
}

export function deliveryIndexReportPath(): "delivery/reports/delivery-index.md" {
  return "delivery/reports/delivery-index.md";
}

export function deliveryProfilePath(): "profiles/delivery.md" {
  return "profiles/delivery.md";
}

export function validateMealProposalReview(proposal: MealProposal, events: ReadonlyMap<string, MealPlanEvent>): void {
  const event = events.get(proposal.constraint_review_event_id);
  if (event === undefined || event.kind !== "constraints_reviewed") {
    throw new AppError("VALIDATION_FAILED", "A proposal requires a constraints-reviewed event");
  }
  if (event.id !== proposal.constraint_review_event_id
    || event.week_start !== proposal.week_start
    || event.constraint_revision !== proposal.constraint_revision) {
    throw new AppError("VALIDATION_FAILED", "The constraint review must match the proposal week and constraint revision");
  }
}

export function validateMealProposalSource(
  proposal: MealProposal,
  items: ReadonlyMap<string, JournalItem>,
  evidence: ReadonlyMap<string, Evidence>,
  itemRevisions: ReadonlyMap<string, string>,
): void {
  if (proposal.source.kind === "journal_delivery_dish") {
    const item = items.get(proposal.source.item_id);
    if (item === undefined || item.kind !== "delivery_dish") {
      throw new AppError("VALIDATION_FAILED", "A delivery-dish proposal must cite an existing delivery dish");
    }
    if (itemRevisions.get(item.id) !== proposal.source.item_revision) {
      throw new AppError("REVISION_CONFLICT", "The cited delivery dish revision is no longer current");
    }
    const itemEvidenceIds = new Set(item.evidence_ids);
    const expectedKind = "delivery_authority" in item ? "import" : "delivery_order_line";
    if (proposal.source.evidence_ids.some((id) =>
      !itemEvidenceIds.has(id) || evidence.get(id)?.kind !== expectedKind)) {
      throw new AppError(
        "VALIDATION_FAILED",
        expectedKind === "import"
          ? "A shared-dish proposal requires cited import evidence"
          : "An ordered-before proposal requires cited delivery-order evidence",
      );
    }
    if (proposal.compatibility !== "incomplete_evidence") {
      throw new AppError("VALIDATION_FAILED", "Delivery dishes require incomplete ingredient evidence");
    }
    return;
  }
  if (proposal.source.kind !== "journal_recipe") return;
  const item = items.get(proposal.source.item_id);
  if (item === undefined || item.id !== proposal.source.item_id || item.kind !== "recipe") {
    throw new AppError("VALIDATION_FAILED", "A journal recipe proposal must cite an existing recipe");
  }
  if (itemRevisions.get(item.id) !== proposal.source.item_revision) {
    throw new AppError("REVISION_CONFLICT", "The cited recipe revision is no longer current");
  }
  if (item.liked !== "yes") {
    throw new AppError("VALIDATION_FAILED", "A liked-recipe proposal requires current Liked evidence");
  }
  const itemEvidenceIds = new Set(item.evidence_ids);
  const hasInvalidLikedEvidence = proposal.source.liked_evidence_ids.some((id) => {
    const cited = evidence.get(id);
    return !itemEvidenceIds.has(id)
      || cited?.id !== id
      || cited?.kind !== "user_confirmation"
      || cited.confirmation?.subject !== "recipe_preference"
      || cited.confirmation.recipe_item_id !== item.id
      || cited.confirmation.preference !== "liked";
  });
  if (hasInvalidLikedEvidence) {
    throw new AppError("VALIDATION_FAILED", "Liked evidence must be a cited user confirmation");
  }
}

export function mealProposalNeedsRecheck(
  proposal: MealProposal,
  currentConstraintRevision: MealConstraintRevision,
  currentItemRevision: string | null,
): boolean {
  if (proposal.constraint_revision !== currentConstraintRevision) return true;
  return (proposal.source.kind === "journal_recipe" || proposal.source.kind === "journal_delivery_dish")
    && currentItemRevision !== proposal.source.item_revision;
}

export function mealProposalPath(proposal: MealProposal): string {
  return `meal-plans/weeks/${proposal.week_start}/proposals/${proposal.id}.json`;
}

export function mealPlanEventPath(event: MealPlanEvent): string {
  return `meal-plans/weeks/${event.week_start}/events/${event.id}.json`;
}
