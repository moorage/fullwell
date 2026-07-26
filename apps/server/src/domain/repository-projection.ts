import { z } from "zod";
import {
  ActorIdSchema,
  CloudMealSourceSchema,
  CollectionIdSchema,
  CollectionSnapshotSchema,
  ConfirmedMealPlanningConstraintsSchema,
  DeliveryIndexReportSchema,
  DeliveryProfileSchema,
  EvidenceSchema,
  JournalItemSchema,
  MealPlanEventSchema,
  MealPlanningProfileSchema,
  MealProposalSchema,
  RequestIdSchema,
  RoleSchema,
  SnapshotIdSchema,
  UserIdSchema,
  type RequestId,
  type UserId,
} from "@hfj/contracts";
import { AppError } from "../core/errors.js";
import {
  deliveryIndexReportPath,
  deliveryProfilePath,
  journalEvidencePath,
  journalItemPath,
  mealPlanEventPath,
  mealProposalPath,
  validateDeliveryEvidenceGroups,
  validateDeliveryImportEvidenceScope,
  validateDeliveryIndexReport,
  validateItemEvidence,
  validateMealProposalReview,
  validateMealProposalSource,
} from "./journal-validation.js";
import type { RepositorySnapshot } from "../core/ports.js";
import type { HouseholdProjection, RepositoryMembershipState } from "../core/types.js";

const AuditSchema = z.object({ actor_id: ActorIdSchema, request_id: RequestIdSchema }).passthrough();
const MemberDocumentSchema = z.object({
  actor_id: ActorIdSchema.optional(),
  role: RoleSchema.optional(),
  former_member: z.literal(true).optional(),
  removed_at: z.iso.datetime({ offset: true }).optional(),
}).passthrough();
const CollectionDocumentSchema = z.object({
  id: CollectionIdSchema,
  current_snapshot_id: SnapshotIdSchema.optional(),
}).passthrough();
const MealPlanningProfileDocumentSchema = z.object({
  constraints: ConfirmedMealPlanningConstraintsSchema,
  updated_at: z.iso.datetime({ offset: true }),
  schema_version: z.literal(1),
}).strict();
const HouseholdDocumentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  schema_version: z.literal(1),
}).strict();

export interface RebuiltRepositoryState {
  readonly householdName: string | null;
  readonly projection: HouseholdProjection;
  readonly memberships: ReadonlyArray<RepositoryMembershipState>;
}

/**
 * Rebuilds disposable PostgreSQL state from a validated snapshot of Git main.
 * Unknown repository documents remain ignored, while malformed authoritative
 * journal or membership documents fail closed so callers can quarantine safely.
 */
export function rebuildRepositoryState(
  snapshot: RepositorySnapshot,
  mutationUsers: ReadonlyMap<RequestId, UserId>,
): RebuiltRepositoryState {
  const userByActor = new Map<string, UserId>();
  for (const file of snapshot.files) {
    if (!/^audit\/\d{4}\/req_[0-9a-z]{16,64}\.json$/.test(file.path)) continue;
    const audit = parseJson(AuditSchema, file.content, file.path);
    const userId = mutationUsers.get(audit.request_id);
    if (userId !== undefined) userByActor.set(audit.actor_id, UserIdSchema.parse(userId));
  }

  const evidence = new Map<string, z.infer<typeof EvidenceSchema>>();
  const deliveryImportEvidenceIds = new Set<string>();
  const items = new Map<string, { item: z.infer<typeof JournalItemSchema>; revision: typeof snapshot.head }>();
  const profiles = new Map<string, { markdown: string; revision: typeof snapshot.head }>();
  const snapshots = new Map<string, { snapshot: z.infer<typeof CollectionSnapshotSchema>; revision: typeof snapshot.head }>();
  let mealPlanningProfile: z.infer<typeof MealPlanningProfileSchema> | null = null;
  const mealProposals = new Map<string, { proposal: z.infer<typeof MealProposalSchema>; revision: typeof snapshot.head }>();
  const mealPlanEvents = new Map<string, { event: z.infer<typeof MealPlanEventSchema>; revision: typeof snapshot.head }>();
  const collectionDocuments: Array<{ collectionId: string; snapshotId?: string }> = [];
  const memberships: RepositoryMembershipState[] = [];
  let deliveryReport: z.infer<typeof DeliveryIndexReportSchema> | null = null;
  let householdName: string | null = null;

  for (const file of snapshot.files) {
    if (file.path === "household.md") {
      if (householdName !== null) throw projectionError(file.path);
      householdName = parseValue(
        HouseholdDocumentSchema,
        parseMarkdownDocument(file.content, file.path).frontmatter,
        file.path,
      ).name;
      continue;
    }
    if (/^(snacks|groceries|recipes|delivery)\/evidence\/\d{4}\/evd_[0-9a-z]{16,64}\.json$/.test(file.path)) {
      const parsed = parseJson(EvidenceSchema, file.content, file.path);
      const deliveryEvidencePath = file.path.startsWith("delivery/evidence/");
      const historyEvidence = parsed.kind === "delivery_order_line";
      const importEvidence = parsed.kind === "import";
      const expectedDeliveryPath = `delivery/evidence/${parsed.observed_at.slice(0, 4)}/${parsed.id}.json`;
      if ((deliveryEvidencePath && (!historyEvidence && !importEvidence))
        || (!deliveryEvidencePath && historyEvidence)
        || (deliveryEvidencePath && expectedDeliveryPath !== file.path)
        || (historyEvidence && journalEvidencePath(parsed) !== file.path)
        || evidence.has(parsed.id)) {
        throw projectionError(file.path);
      }
      if (deliveryEvidencePath && importEvidence) deliveryImportEvidenceIds.add(parsed.id);
      evidence.set(parsed.id, parsed);
      continue;
    }
    if (/^(snacks|ingredients|condiments|groceries|recipes|delivery)\/items\/itm_[0-9a-z]{16,64}\.md$/.test(file.path)) {
      const document = parseMarkdownDocument(file.content, file.path);
      const item = parseValue(JournalItemSchema, { ...document.frontmatter, body_markdown: document.body }, file.path);
      if (journalItemPath(item) !== file.path || items.has(item.id)) throw projectionError(file.path);
      items.set(item.id, { item, revision: file.revision });
      continue;
    }
    if (file.path === deliveryIndexReportPath()) {
      if (deliveryReport !== null) throw projectionError(file.path);
      const document = parseMarkdownDocument(file.content, file.path);
      deliveryReport = parseValue(DeliveryIndexReportSchema, {
        ...document.frontmatter,
        markdown: document.body,
      }, file.path);
      continue;
    }
    if (file.path === "profiles/meal-planning.md") {
      const document = parseValue(MealPlanningProfileDocumentSchema, parseMarkdownDocument(file.content, file.path).frontmatter, file.path);
      mealPlanningProfile = parseValue(MealPlanningProfileSchema, {
        ...document,
        revision: file.revision,
      }, file.path);
      continue;
    }
    if (file.path === deliveryProfilePath()) {
      const document = parseMarkdownDocument(file.content, file.path);
      parseValue(DeliveryProfileSchema, document.frontmatter, file.path);
      profiles.set("delivery", {
        markdown: removeDocumentTerminator(file.content),
        revision: file.revision,
      });
      continue;
    }
    const profile = /^profiles\/([a-zA-Z0-9._-]+)\.md$/.exec(file.path);
    if (profile?.[1] !== undefined) {
      profiles.set(profile[1], { markdown: removeDocumentTerminator(file.content), revision: file.revision });
      continue;
    }
    if (/^meal-plans\/weeks\/\d{4}-\d{2}-\d{2}\/proposals\/mlp_[0-9a-z]{16,64}\.json$/.test(file.path)) {
      const proposal = parseJson(MealProposalSchema, file.content, file.path);
      if (typeof proposal.proposed_by !== "string"
        || typeof proposal.constraint_revision !== "string"
        || !CloudMealSourceSchema.safeParse(proposal.source).success
        || mealProposalPath(proposal) !== file.path
        || mealProposals.has(proposal.id)) {
        throw projectionError(file.path);
      }
      mealProposals.set(proposal.id, { proposal, revision: file.revision });
      continue;
    }
    if (/^meal-plans\/weeks\/\d{4}-\d{2}-\d{2}\/events\/mle_[0-9a-z]{16,64}\.json$/.test(file.path)) {
      const event = parseJson(MealPlanEventSchema, file.content, file.path);
      if (typeof event.actor !== "string"
        || (event.kind === "constraints_reviewed" && typeof event.constraint_revision !== "string")
        || mealPlanEventPath(event) !== file.path
        || mealPlanEvents.has(event.id)) {
        throw projectionError(file.path);
      }
      mealPlanEvents.set(event.id, { event, revision: file.revision });
      continue;
    }
    if (/^collections\/col_[0-9a-z]{16,64}\/snapshots\/snp_[0-9a-z]{16,64}\.json$/.test(file.path)) {
      const parsed = parseJson(CollectionSnapshotSchema, file.content, file.path);
      snapshots.set(parsed.id, { snapshot: parsed, revision: file.revision });
      continue;
    }
    const collection = /^collections\/(col_[0-9a-z]{16,64})\/collection\.md$/.exec(file.path);
    if (collection?.[1] !== undefined) {
      const document = parseValue(CollectionDocumentSchema, parseMarkdownDocument(file.content, file.path).frontmatter, file.path);
      if (document.id !== collection[1]) throw projectionError(file.path);
      collectionDocuments.push({ collectionId: document.id, ...(document.current_snapshot_id === undefined ? {} : { snapshotId: document.current_snapshot_id }) });
      continue;
    }
    const member = /^members\/(act_[0-9a-z]{16,64})\.md$/.exec(file.path);
    if (member?.[1] !== undefined) {
      const actorId = ActorIdSchema.parse(member[1]);
      const document = parseValue(MemberDocumentSchema, parseMarkdownDocument(file.content, file.path).frontmatter, file.path);
      if (document.actor_id !== undefined && document.actor_id !== actorId) throw projectionError(file.path);
      if (document.former_member === true) {
        if (document.removed_at === undefined) throw projectionError(file.path);
        memberships.push({ actorId, role: null, removedAt: document.removed_at, userId: userByActor.get(actorId) ?? null });
      } else {
        if (document.role === undefined) throw projectionError(file.path);
        memberships.push({ actorId, role: document.role, removedAt: null, userId: userByActor.get(actorId) ?? null });
      }
      continue;
    }
    if (file.path.startsWith("delivery/")) throw projectionError(file.path);
  }

  const collections = new Map<string, { snapshot: z.infer<typeof CollectionSnapshotSchema>; revision: typeof snapshot.head }>();
  for (const document of collectionDocuments) {
    const candidates = [...snapshots.values()].filter((entry) => entry.snapshot.collection_id === document.collectionId);
    const selected = document.snapshotId === undefined
      ? candidates.sort((left, right) => right.snapshot.created_at.localeCompare(left.snapshot.created_at))[0]
      : snapshots.get(document.snapshotId);
    if (selected === undefined || selected.snapshot.collection_id !== document.collectionId) throw projectionError(`collections/${document.collectionId}/collection.md`);
    collections.set(document.collectionId, selected);
  }

  const events = new Map([...mealPlanEvents].map(([id, entry]) => [id, entry.event]));
  const itemValues = new Map([...items].map(([id, entry]) => [id, entry.item]));
  const itemRevisions = new Map([...items].map(([id, entry]) => [id, entry.revision]));
  for (const { item } of items.values()) validateItemEvidence(item, evidence);
  validateDeliveryImportEvidenceScope(itemValues, evidence, deliveryImportEvidenceIds);
  validateDeliveryEvidenceGroups(evidence);
  if (deliveryReport !== null) validateDeliveryIndexReport(deliveryReport, evidence, itemValues);
  for (const { proposal } of mealProposals.values()) {
    validateMealProposalReview(proposal, events);
    if ((proposal.source.kind === "journal_recipe" || proposal.source.kind === "journal_delivery_dish")
      && itemRevisions.get(proposal.source.item_id) === proposal.source.item_revision) {
      validateMealProposalSource(proposal, itemValues, evidence, itemRevisions);
    }
  }
  for (const { event } of mealPlanEvents.values()) {
    if (event.kind !== "proposal_withdrawn") continue;
    const proposal = mealProposals.get(event.proposal_id)?.proposal;
    if (proposal === undefined || proposal.week_start !== event.week_start) throw projectionError(mealPlanEventPath(event));
  }

  return {
    householdName,
    projection: {
      evidence,
      items,
      profiles,
      collections,
      mealPlanningProfile,
      mealProposals,
      mealPlanEvents,
    },
    memberships,
  };
}

export function parseMarkdownDocument(content: string, path: string): { frontmatter: Record<string, unknown>; body: string } {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") throw projectionError(path);
  const end = lines.indexOf("---", 1);
  if (end < 0) throw projectionError(path);
  const frontmatter: Record<string, unknown> = {};
  for (const line of lines.slice(1, end)) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw projectionError(path);
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1).trim();
    try { frontmatter[key] = JSON.parse(value) as unknown; } catch {
      if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw projectionError(path);
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: removeDocumentTerminator(lines.slice(end + 1).join("\n")) };
}

function removeDocumentTerminator(content: string): string { return content.endsWith("\n") ? content.slice(0, -1) : content; }

function parseJson<T>(schema: z.ZodType<T>, content: string, path: string): T {
  try { return parseValue(schema, JSON.parse(content) as unknown, path); } catch (error) { if (error instanceof AppError) throw error; throw projectionError(path); }
}

function parseValue<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw projectionError(path);
  return parsed.data;
}

function projectionError(path: string): AppError { return new AppError("PROJECTION_DRIFT", `Repository document cannot be projected: ${path}`, false); }
