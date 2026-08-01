import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod";
import type { WebRenderContext } from "./types.js";

const WebContext = createContext<WebRenderContext | null>(null);
const safeHttpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only http and https URLs are accepted");
const gitObjectIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);

export function WebContextProvider({ context, children }: { context: WebRenderContext; children: ReactNode }) {
  return <WebContext.Provider value={context}>{children}</WebContext.Provider>;
}

export function useWebContext(): WebRenderContext {
  const context = useContext(WebContext);
  if (context === null) throw new Error("Web render context is missing");
  return context;
}

export function parseWebRenderContext(input: unknown): WebRenderContext {
  return webRenderContextSchema.parse(input);
}

export function parseVisualJournalPage(input: unknown): WebRenderContext["visualJournal"] {
  return visualJournalPageSchema.parse(input);
}

const householdRoleSchema = z.enum(["owner", "editor", "viewer"]);
const collectionItemBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string(),
  imageUrl: safeHttpUrlSchema.optional(),
  imageAlt: z.string().optional(),
  note: z.string().optional(),
  selected: z.boolean(),
});
const collectionItemSchema = z.discriminatedUnion("kind", [
  collectionItemBaseSchema.extend({ kind: z.literal("recipe") }),
  collectionItemBaseSchema.extend({ kind: z.literal("snack") }),
  collectionItemBaseSchema.extend({
    kind: z.literal("delivery_dish"),
    restaurantName: z.string().min(1),
    locationLabel: z.string().min(1),
    locationAddress: z.string().min(1).optional(),
    classification: z.literal("alcohol").optional(),
  }),
]);

const codexSetupUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "codex:" && url.host === "new";
}, "Only Codex new-conversation URLs are accepted");
const installHostSchema = z.object({
  label: z.string().min(1), command: z.string().min(1), next: z.string().min(1),
  setupPrompt: z.string().min(1), setupHref: codexSetupUrlSchema.nullable(),
});
const messagingStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("disabled"), availableThroughLabel: z.string().min(1) }),
  z.object({ kind: z.literal("not_configured"), availableThroughLabel: z.string().min(1) }),
  z.object({
    kind: z.literal("setup"), availableThroughLabel: z.string().min(1), deviceId: z.string().min(1),
    householdId: z.string().min(1), deviceName: z.string().min(1),
  }),
  z.object({
    kind: z.literal("pending_confirmation"), availableThroughLabel: z.string().min(1), linkId: z.string().min(1),
    deviceId: z.string().min(1), householdId: z.string().min(1), deviceName: z.string().min(1), confirmationExpiresLabel: z.string().min(1),
  }),
  z.object({
    kind: z.literal("expired"), availableThroughLabel: z.string().min(1), linkId: z.string().min(1),
    deviceId: z.string().min(1), householdId: z.string().min(1), deviceName: z.string().min(1), confirmationExpiresLabel: z.string().min(1),
  }),
  z.object({
    kind: z.literal("linked"), availableThroughLabel: z.string().min(1), deviceId: z.string().min(1),
    householdId: z.string().min(1), deviceName: z.string().min(1), lastSeenLabel: z.string().min(1).nullable(),
  }),
]);

const mealPlanSchema = z.object({
  householdId: z.string().min(1),
  weekStart: z.iso.date(),
  weekLabel: z.string().min(1),
  previousWeek: z.iso.date(),
  nextWeek: z.iso.date(),
  timeZoneLabel: z.string().min(1),
  role: householdRoleSchema,
  canEdit: z.boolean(),
  canReview: z.boolean(),
  constraintState: z.enum(["missing", "needs_review", "reviewed"]),
  constraintRevision: z.string().min(1).nullable(),
  constraintReviewEventId: z.string().min(1).nullable(),
  proposalCount: z.number().int().nonnegative(),
  statusMessage: z.string().min(1).nullable(),
  days: z.array(z.object({
    date: z.iso.date(),
    label: z.string().min(1),
    shortLabel: z.string().min(1),
    slots: z.array(z.object({
      id: z.string().min(1),
      key: z.string().min(1),
      label: z.string().min(1),
      proposals: z.array(z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        sourceKind: z.enum(["freeform", "journal_recipe", "journal_delivery_dish", "external_recipe"]),
        sourceDetail: z.string().min(1),
        deliveryContext: z.object({
          authority: z.enum(["history", "public_import"]),
          providerLabel: z.string().min(1).nullable(),
          restaurantName: z.string().min(1),
          locationLabel: z.string().min(1),
          familiarityBasis: z.enum(["Ordered before", "Shared dish"]),
        }).nullable().optional(),
        sourceHref: safeHttpUrlSchema.optional(),
        proposedBy: z.string().min(1),
        servings: z.number().int().positive().nullable(),
        notes: z.string().nullable(),
        compatibilityLabel: z.string().min(1),
        compatibilityCaveat: z.string().min(1),
        needsRecheck: z.boolean(),
        canWithdraw: z.boolean(),
      })),
    })),
  })).length(7),
});

const visualJournalItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("recipe"),
    id: z.string().min(1),
    title: z.string().min(1),
    source: z.string().nullable(),
    imageUrl: safeHttpUrlSchema.nullable(),
    imagePageUrl: safeHttpUrlSchema.nullable(),
    canonicalUrl: safeHttpUrlSchema.nullable(),
    saved: z.enum(["yes", "no", "unknown"]),
    cooked: z.enum(["yes", "no", "unknown"]),
    liked: z.enum(["yes", "no", "unknown"]),
    lastCookedLabel: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("grocery"),
    journalKind: z.enum(["snack", "ingredient", "condiment", "other_grocery"]),
    id: z.string().min(1),
    title: z.string().min(1),
    brand: z.string().nullable(),
    detail: z.string(),
    imageUrl: safeHttpUrlSchema.nullable(),
    imagePageUrl: safeHttpUrlSchema.nullable(),
  }),
  z.object({
    kind: z.literal("takeout"),
    id: z.string().min(1),
    title: z.string().min(1),
    restaurantName: z.string().min(1),
    locationLabel: z.string().min(1),
    locationAddress: z.string().min(1).nullable(),
    providerLabel: z.string().min(1).nullable(),
    provenance: z.enum(["ordered_before", "shared_dish"]),
    classification: z.enum(["food", "alcohol"]),
    occurrenceCount: z.number().int().nonnegative(),
    lastOrderedLabel: z.string().min(1).nullable(),
    fulfillmentModes: z.array(z.enum(["delivery", "pickup"])),
    modifierSummary: z.string().min(1).nullable(),
    imageUrl: safeHttpUrlSchema.nullable(),
    imagePageUrl: safeHttpUrlSchema.nullable(),
  }),
]);

const visualJournalPageSchema = z.object({
  householdId: z.string().min(1),
  section: z.enum(["recipes", "groceries", "takeout"]),
  snapshotRevision: gitObjectIdSchema,
  total: z.number().int().nonnegative(),
  items: z.array(visualJournalItemSchema),
  nextCursor: z.string().max(16).regex(/^v1_\d+$/).nullable(),
});

const webRenderContextSchema: z.ZodType<WebRenderContext> = z.object({
  security: z.object({ csrfToken: z.string().min(16), idempotencyPrefix: z.string().min(8) }),
  capabilities: z.object({ mealPlanning: z.boolean() }),
  canonicalUrl: safeHttpUrlSchema,
  install: z.object({ hosts: z.object({ codex: installHostSchema, claude: installHostSchema }) }),
  auth: z.object({
    passkeysEnabled: z.boolean(),
    reviewerAccessEnabled: z.boolean(),
    passkeys: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      createdLabel: z.string().min(1),
      lastUsedLabel: z.string().min(1).nullable(),
    })),
    methods: z.array(z.object({ provider: z.enum(["apple", "magic_link"]), label: z.string().min(1) })),
    grants: z.array(z.object({ id: z.string().min(1), clientName: z.string().min(1), scopes: z.array(z.string().min(1)) })),
  }),
  messaging: messagingStatusSchema,
  viewer: z.object({ displayName: z.string(), email: z.string() }),
  households: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), repositoryHead: gitObjectIdSchema, role: householdRoleSchema, members: z.number().int().nonnegative(),
    recipes: z.number().int().nonnegative(), groceries: z.number().int().nonnegative(),
    takeout: z.number().int().nonnegative(), updatedLabel: z.string(),
  })),
  members: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), detail: z.string(), role: householdRoleSchema, isCurrentUser: z.boolean().optional(),
  })),
  collections: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), itemCount: z.number().int().nonnegative(),
    status: z.enum(["private", "published", "expired"]), detail: z.string(), publicUrl: safeHttpUrlSchema.optional(),
  })),
  mealPlan: mealPlanSchema.nullable(),
  visualJournal: visualJournalPageSchema.nullable(),
  publicCollection: z.object({
    token: z.string().min(1), title: z.string().min(1), sharedBy: z.string().min(1), expiresLabel: z.string(),
    description: z.string(), items: z.array(collectionItemSchema),
  }),
  invite: z.object({
    state: z.enum(["preview", "authenticated", "joined", "expired", "revoked"]), householdName: z.string().min(1),
    inviterName: z.string().min(1), roleLabel: z.string().min(1), expiresLabel: z.string(),
  }),
  collectionState: z.enum(["ready", "expired", "revoked", "unavailable"]),
  emailSent: z.boolean(),
  reviewerError: z.boolean(),
});
