import type {
  Evidence,
  MealConstraintRevision,
  MealPlanEvent,
  MealProposal,
  JournalItem,
  Report,
} from "@hfj/contracts";
import { AppError } from "../core/errors.js";

export function validateItemEvidence(item: JournalItem, evidence: ReadonlyMap<string, Evidence>): void {
  const cited = item.evidence_ids.map((id) => evidence.get(id));
  if (cited.some((entry) => entry === undefined)) throw new AppError("VALIDATION_FAILED", "An item cites evidence that does not exist");
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

export function validateReport(report: Report, evidence: ReadonlyMap<string, Evidence>, itemIds: ReadonlySet<string>): void {
  for (const assertion of report.assertions) {
    if (assertion.item_ids.some((id) => !itemIds.has(id))) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} cites a missing item`);
    const cited = assertion.evidence_ids.map((id) => evidence.get(id));
    if (cited.some((entry) => entry === undefined)) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} cites missing evidence`);
    if (assertion.distinct_order_count !== undefined) {
      const keys = new Set(cited.flatMap((entry) => entry?.kind === "purchase" ? [`${entry.purchase.store}\0${entry.purchase.order_reference}`] : []));
      if (keys.size !== assertion.distinct_order_count) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} has an incorrect distinct-order count`);
    }
    if (assertion.last_date !== undefined) {
      const dates = cited.flatMap((entry) => entry?.evidence_date === null || entry?.evidence_date === undefined ? [] : [entry.evidence_date]).sort();
      if (dates.at(-1) !== assertion.last_date) throw new AppError("VALIDATION_FAILED", `Report row ${assertion.row_id} has an incorrect last date`);
    }
  }
}

export function markdownDocument(frontmatter: object, body: string): string {
  const lines = Object.entries(frontmatter).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n${body.replaceAll("\r\n", "\n")}\n`;
}

export function journalItemArea(kind: JournalItem["kind"]): "snacks" | "ingredients" | "condiments" | "groceries" | "recipes" {
  switch (kind) {
    case "snack": return "snacks";
    case "ingredient": return "ingredients";
    case "condiment": return "condiments";
    case "other_grocery": return "groceries";
    case "recipe": return "recipes";
  }
}

export function journalItemPath(item: JournalItem): string {
  return `${journalItemArea(item.kind)}/items/${item.id}.md`;
}

export function journalEvidencePath(evidence: Evidence): string {
  const area = evidence.kind === "purchase" ? "groceries" : "recipes";
  return `${area}/evidence/${evidence.observed_at.slice(0, 4)}/${evidence.id}.json`;
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
  return proposal.source.kind === "journal_recipe" && currentItemRevision !== proposal.source.item_revision;
}

export function mealProposalPath(proposal: MealProposal): string {
  return `meal-plans/weeks/${proposal.week_start}/proposals/${proposal.id}.json`;
}

export function mealPlanEventPath(event: MealPlanEvent): string {
  return `meal-plans/weeks/${event.week_start}/events/${event.id}.json`;
}
