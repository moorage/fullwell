export type HouseholdRole = "owner" | "editor" | "viewer";

export type HouseholdSummary = {
  id: string;
  name: string;
  role: HouseholdRole;
  members: number;
  recipes: number;
  groceries: number;
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

export type MealPlanProposalSummary = {
  id: string;
  title: string;
  sourceKind: "freeform" | "journal_recipe" | "external_recipe";
  sourceDetail: string;
  sourceHref?: string | undefined;
  proposedBy: string;
  servings: number | null;
  notes: string | null;
  compatibilityLabel: string;
  compatibilityCaveat: string;
  needsRecheck: boolean;
  canWithdraw: boolean;
};

export type MealPlanSlotSummary = {
  id: string;
  key: string;
  label: string;
  proposals: readonly MealPlanProposalSummary[];
};

export type MealPlanDaySummary = {
  date: string;
  label: string;
  shortLabel: string;
  slots: readonly MealPlanSlotSummary[];
};

export type HouseholdMealPlan = {
  householdId: string;
  weekStart: string;
  weekLabel: string;
  previousWeek: string;
  nextWeek: string;
  timeZoneLabel: string;
  role: HouseholdRole;
  canEdit: boolean;
  canReview: boolean;
  constraintState: "missing" | "needs_review" | "reviewed";
  constraintRevision: string | null;
  constraintReviewEventId: string | null;
  proposalCount: number;
  statusMessage: string | null;
  days: readonly MealPlanDaySummary[];
};

export type RecipeVisualItem = {
  kind: "recipe";
  id: string;
  title: string;
  source: string | null;
  imageUrl: string | null;
  imagePageUrl: string | null;
  canonicalUrl: string | null;
  saved: "yes" | "no" | "unknown";
  cooked: "yes" | "no" | "unknown";
  liked: "yes" | "no" | "unknown";
  lastCookedLabel: string | null;
};

export type GroceryVisualItem = {
  kind: "grocery";
  journalKind: "snack" | "ingredient" | "condiment" | "other_grocery";
  id: string;
  title: string;
  brand: string | null;
  detail: string;
  imageUrl: string | null;
  imagePageUrl: string | null;
};

export type VisualJournalItem = RecipeVisualItem | GroceryVisualItem;

export type VisualJournalPage = {
  householdId: string;
  section: "recipes" | "groceries";
  total: number;
  items: readonly VisualJournalItem[];
  nextCursor: string | null;
};

export type InviteState = "preview" | "authenticated" | "joined" | "expired" | "revoked";
export type CollectionState = "ready" | "expired" | "revoked" | "unavailable";

export type InstallHost = {
  label: string;
  command: string;
  next: string;
  setupPrompt: string;
  setupHref: string | null;
};

export type PasskeySummary = {
  id: string;
  name: string;
  createdLabel: string;
  lastUsedLabel: string | null;
};

export type SignInMethodSummary = { provider: "apple" | "magic_link"; label: string };
export type ConnectedGrantSummary = { id: string; clientName: string; scopes: readonly string[] };
export type MessagingStatus =
  | { kind: "disabled"; availableThroughLabel: string }
  | { kind: "not_configured"; availableThroughLabel: string }
  | { kind: "setup"; availableThroughLabel: string; deviceId: string; householdId: string; deviceName: string }
  | { kind: "pending_confirmation"; availableThroughLabel: string; linkId: string; deviceId: string; householdId: string; deviceName: string; confirmationExpiresLabel: string }
  | { kind: "expired"; availableThroughLabel: string; linkId: string; deviceId: string; householdId: string; deviceName: string; confirmationExpiresLabel: string }
  | { kind: "linked"; availableThroughLabel: string; deviceId: string; householdId: string; deviceName: string; lastSeenLabel: string | null };

export type WebRenderContext = {
  security: { csrfToken: string; idempotencyPrefix: string };
  capabilities: { mealPlanning: boolean };
  canonicalUrl: string;
  install: { hosts: Record<"codex" | "claude", InstallHost> };
  auth: {
    passkeysEnabled: boolean;
    passkeys: readonly PasskeySummary[];
    methods: readonly SignInMethodSummary[];
    grants: readonly ConnectedGrantSummary[];
  };
  messaging: MessagingStatus;
  viewer: { displayName: string; email: string };
  households: readonly HouseholdSummary[];
  members: readonly Member[];
  collections: readonly PublishedCollection[];
  mealPlan: HouseholdMealPlan | null;
  visualJournal: VisualJournalPage | null;
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

export type OAuthAuthorizationRequest = {
  readonly clientName: string;
  readonly responseType: "code";
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly resource: string;
};

export type WebRoute =
  | { page: "install"; host: "codex" | "claude" }
  | { page: "guides" }
  | { page: "guide-detail"; slug: "whatsapp" | "household-invitations" | "collections-create" | "collections-share" }
  | { page: "sign-in"; returnTo?: string | undefined }
  | { page: "authorize"; authorization?: OAuthAuthorizationRequest | undefined }
  | { page: "invite"; token: string }
  | { page: "collection"; token: string }
  | { page: "collection-import-plan"; token: string }
  | { page: "households" }
  | { page: "household"; householdId: string }
  | { page: "meal-plan"; householdId: string }
  | { page: "recipes"; householdId: string; pageNumber: number }
  | { page: "groceries"; householdId: string; pageNumber: number }
  | { page: "members"; householdId: string }
  | { page: "collections"; householdId: string }
  | { page: "account" }
  | { page: "privacy" }
  | { page: "terms" }
  | { page: "not-found" };
