import { createContext, useContext, type ReactNode } from "react";
import { z } from "zod";
import type { WebRenderContext } from "./types.js";

const WebContext = createContext<WebRenderContext | null>(null);
const safeHttpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only http and https URLs are accepted");

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

const householdRoleSchema = z.enum(["owner", "editor", "viewer"]);
const collectionItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["recipe", "snack"]),
  title: z.string().min(1),
  source: z.string(),
  imageUrl: safeHttpUrlSchema.optional(),
  imageAlt: z.string().optional(),
  note: z.string().optional(),
  selected: z.boolean(),
});

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

const webRenderContextSchema: z.ZodType<WebRenderContext> = z.object({
  security: z.object({ csrfToken: z.string().min(16), idempotencyPrefix: z.string().min(8) }),
  canonicalUrl: safeHttpUrlSchema,
  install: z.object({ hosts: z.object({ codex: installHostSchema, claude: installHostSchema }) }),
  auth: z.object({
    passkeysEnabled: z.boolean(),
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
    id: z.string().min(1), name: z.string().min(1), role: householdRoleSchema, members: z.number().int().nonnegative(),
    recipes: z.number().int().nonnegative(), groceries: z.number().int().nonnegative(), updatedLabel: z.string(),
  })),
  members: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), detail: z.string(), role: householdRoleSchema, isCurrentUser: z.boolean().optional(),
  })),
  collections: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), itemCount: z.number().int().nonnegative(),
    status: z.enum(["private", "published", "expired"]), detail: z.string(), publicUrl: safeHttpUrlSchema.optional(),
  })),
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
});
