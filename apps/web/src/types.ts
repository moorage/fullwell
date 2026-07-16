export type HouseholdRole = "owner" | "editor" | "viewer";

export type HouseholdSummary = {
  id: string;
  name: string;
  role: HouseholdRole;
  members: number;
  recipes: number;
  snacks: number;
  updatedLabel: string;
};

export type CollectionItem = {
  id: string;
  kind: "recipe" | "snack";
  title: string;
  source: string;
  imageUrl?: string | undefined;
  imageAlt?: string | undefined;
  note?: string | undefined;
  selected: boolean;
};

export type PublicCollection = {
  token: string;
  title: string;
  sharedBy: string;
  expiresLabel: string;
  description: string;
  items: readonly CollectionItem[];
};

export type Member = {
  id: string;
  name: string;
  detail: string;
  role: HouseholdRole;
  isCurrentUser?: boolean | undefined;
};

export type PublishedCollection = {
  id: string;
  title: string;
  itemCount: number;
  status: "private" | "published" | "expired";
  detail: string;
  publicUrl?: string | undefined;
};

export type InviteState = "preview" | "authenticated" | "joined" | "expired" | "revoked";
export type CollectionState = "ready" | "expired" | "revoked" | "unavailable";

export type InstallHost = {
  label: string;
  command: string;
  next: string;
};

export type PasskeySummary = {
  id: string;
  name: string;
  createdLabel: string;
  lastUsedLabel: string | null;
};

export type WebRenderContext = {
  security: { csrfToken: string; idempotencyPrefix: string };
  canonicalUrl: string;
  install: { hosts: Record<"codex" | "claude", InstallHost> };
  auth: { passkeysEnabled: boolean; passkeys: readonly PasskeySummary[] };
  viewer: { displayName: string; email: string };
  households: readonly HouseholdSummary[];
  members: readonly Member[];
  collections: readonly PublishedCollection[];
  publicCollection: PublicCollection;
  invite: {
    state: InviteState;
    householdName: string;
    inviterName: string;
    roleLabel: string;
    expiresLabel: string;
  };
  collectionState: CollectionState;
  emailSent: boolean;
};

export type WebRoute =
  | { page: "install"; host: "codex" | "claude" }
  | { page: "sign-in"; returnTo?: string | undefined }
  | { page: "authorize" }
  | { page: "invite"; token: string }
  | { page: "collection"; token: string }
  | { page: "collection-import-plan"; token: string }
  | { page: "households" }
  | { page: "household"; householdId: string }
  | { page: "members"; householdId: string }
  | { page: "collections"; householdId: string }
  | { page: "account" }
  | { page: "privacy" }
  | { page: "terms" }
  | { page: "not-found" };
