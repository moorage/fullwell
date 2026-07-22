import type { Evidence, JournalItem, Report } from "@hfj/contracts";
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
    if (item.liked === "yes" && !cited.some((entry) => entry?.kind === "user_confirmation")) {
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
