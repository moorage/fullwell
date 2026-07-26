import type {
  HouseholdSummary,
  Member,
  PublicCollection,
  PublishedCollection,
  VisualJournalPage,
  WebRenderContext,
} from "./types.js";

export const households: readonly HouseholdSummary[] = [
  {
    id: "alvarez-home",
    name: "Alvarez home",
    role: "owner",
    members: 4,
    recipes: 38,
    groceries: 22,
    updatedLabel: "Updated yesterday",
  },
  {
    id: "lake-cabin",
    name: "Lake cabin",
    role: "viewer",
    members: 6,
    recipes: 14,
    groceries: 9,
    updatedLabel: "Updated 5 days ago",
  },
];

export const publicCollection: PublicCollection = {
  token: "summer-table-7Qc9",
  title: "Summer table",
  sharedBy: "Maya Alvarez",
  expiresLabel: "Available through August 14, 2026",
  description: "Bright weeknight recipes and the snacks we keep reaching for.",
  items: [
    {
      id: "recipe-tomato-tart",
      kind: "recipe",
      title: "Tomato, mustard & thyme tart",
      source: "David Lebovitz",
      imageUrl:
        "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Tomato tart with herbs on a white plate",
      note: "We use whole-grain mustard and bake it until the edges are deeply browned.",
      selected: true,
    },
    {
      id: "recipe-sesame-noodles",
      kind: "recipe",
      title: "Cold sesame noodles",
      source: "Woks of Life",
      imageUrl:
        "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Sesame noodles with sliced vegetables",
      selected: true,
    },
    {
      id: "recipe-peach-salad",
      kind: "recipe",
      title: "Peach and burrata salad",
      source: "Smitten Kitchen",
      imageUrl:
        "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Peach and leafy salad on a serving plate",
      selected: false,
    },
    {
      id: "snack-salt-vinegar-almonds",
      kind: "snack",
      title: "Salt & vinegar almonds",
      source: "Blue Diamond",
      selected: false,
    },
    {
      id: "snack-sesame-buns",
      kind: "snack",
      title: "Black sesame buns",
      source: "Wei-Chuan",
      note: "Freezer aisle. Steam from frozen for the softest texture.",
      selected: false,
    },
    {
      id: "delivery-wintermelon-boba",
      kind: "delivery_dish",
      title: "Wintermelon boba",
      source: "Shared collection",
      restaurantName: "Wanpo",
      locationLabel: "Stanford",
      locationAddress: "Palo Alto, CA",
      note: "A familiar tea to consider for a future meal.",
      selected: true,
    },
    {
      id: "delivery-canned-spritz",
      kind: "delivery_dish",
      title: "Canned citrus spritz",
      source: "Shared collection",
      restaurantName: "Corner Table",
      locationLabel: "University Avenue",
      locationAddress: "Palo Alto, CA",
      classification: "alcohol",
      selected: false,
    },
  ],
};

export const members: readonly Member[] = [
  {
    id: "member-maya",
    name: "Maya Alvarez",
    detail: "maya@example.test",
    role: "owner",
    isCurrentUser: true,
  },
  { id: "member-jules", name: "Jules Alvarez", detail: "Joined May 4", role: "editor" },
  { id: "member-ren", name: "Ren Alvarez", detail: "Joined June 18", role: "viewer" },
];

export const collections: readonly PublishedCollection[] = [
  {
    id: "collection-summer-table",
    title: "Summer table",
    itemCount: 5,
    status: "published",
    detail: "Link expires August 14, 2026",
  },
  {
    id: "collection-school-snacks",
    title: "School snack shortlist",
    itemCount: 8,
    status: "private",
    detail: "Draft updated yesterday",
  },
  {
    id: "collection-holiday-cookies",
    title: "Holiday cookies",
    itemCount: 12,
    status: "expired",
    detail: "Link expired January 8, 2026",
  },
];

export const csrfToken = "fixture-csrf-token";

const fixtureWeekDays = [
  ["2026-07-20", "Monday, July 20", "Mon 20"],
  ["2026-07-21", "Tuesday, July 21", "Tue 21"],
  ["2026-07-22", "Wednesday, July 22", "Wed 22"],
  ["2026-07-23", "Thursday, July 23", "Thu 23"],
  ["2026-07-24", "Friday, July 24", "Fri 24"],
  ["2026-07-25", "Saturday, July 25", "Sat 25"],
  ["2026-07-26", "Sunday, July 26", "Sun 26"],
] as const;

const fixtureSlots = ["breakfast", "lunch", "dinner", "snack"] as const;

const recipeTitles = [
  "Tomato, mustard & thyme tart",
  "Cold sesame noodles",
  "Peach and burrata salad",
  "Lemony lentil soup",
  "Lemon herb roast chicken",
  "Olive oil lemon cake",
  "Mushroom barley risotto",
  "Crispy tofu rice bowls",
  "Sheet-pan salmon",
  "Braised chickpeas",
  "Ricotta gnocchi",
  "Roasted squash tacos",
  "Green garlic pasta",
  "Strawberry cornmeal cake",
] as const;

const recipeImages = [
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=82",
] as const;

export const recipeVisualJournalFixture: VisualJournalPage = {
  householdId: "alvarez-home",
  section: "recipes",
  total: recipeTitles.length,
  items: recipeTitles.map((title, index) => ({
    kind: "recipe" as const,
    id: `recipe-visual-${index + 1}`,
    title,
    source: index % 2 === 0 ? "Household recipe journal" : "Saved recipe source",
    imageUrl: index % 5 === 4 ? null : recipeImages[index % recipeImages.length] ?? null,
    imagePageUrl: index % 5 === 4 ? null : "https://unsplash.com",
    canonicalUrl: index % 3 === 0 ? `https://recipes.example.test/${index + 1}` : null,
    saved: index % 3 === 0 ? "yes" as const : "unknown" as const,
    cooked: index % 2 === 0 ? "yes" as const : "no" as const,
    liked: index % 4 === 0 ? "yes" as const : "unknown" as const,
    lastCookedLabel: index % 2 === 0 ? "Jul 12, 2026" : null,
  })),
  nextCursor: null,
};

const groceryTitles = [
  "Salt & vinegar almonds",
  "Black sesame buns",
  "Meyer lemons",
  "Tahini",
  "Cherry tomatoes",
  "Rolled oats",
  "Rye bread",
  "Extra virgin olive oil",
  "Dried oregano",
  "Sea salt",
  "Bay leaves",
  "Chili crisp",
  "Plain yogurt",
  "Frozen peas",
] as const;

export const groceryVisualJournalFixture: VisualJournalPage = {
  householdId: "alvarez-home",
  section: "groceries",
  total: groceryTitles.length,
  items: groceryTitles.map((title, index) => ({
    kind: "grocery" as const,
    journalKind: (["snack", "other_grocery", "ingredient", "condiment"] as const)[index % 4] ?? "other_grocery",
    id: `grocery-visual-${index + 1}`,
    title,
    brand: index % 3 === 0 ? "Household favorite" : null,
    detail: index % 2 === 0 ? "Recorded from purchase history" : "Usual pantry item",
    imageUrl: index % 4 === 1 ? null : recipeImages[index % recipeImages.length] ?? null,
    imagePageUrl: index % 4 === 1 ? null : "https://unsplash.com",
  })),
  nextCursor: null,
};

export const demoWebContext: WebRenderContext = {
  security: { csrfToken, idempotencyPrefix: "demo-request" },
  capabilities: { mealPlanning: true },
  canonicalUrl: "http://127.0.0.1:4173",
  install: {
    hosts: {
      codex: {
        label: "ChatGPT",
        command: "codex plugin marketplace add moorage/fullwell && codex plugin add fullwell@fullwell && codex",
        next: "After installation, start Fullwell with the prompt below.",
        setupPrompt: "@Fullwell hi",
        setupHref: "codex://new?prompt=%5B%40Fullwell%5D(plugin%3A%2F%2Ffullwell%40fullwell)%20hi",
      },
      claude: {
        label: "Claude",
        command: "claude plugin marketplace add moorage/fullwell && claude plugin install fullwell@fullwell",
        next: "After installation, start Fullwell with the prompt below.",
        setupPrompt: "Hi Fullwell.",
        setupHref: null,
      },
    },
  },
  auth: {
    passkeysEnabled: false,
    passkeys: [],
    methods: [{ provider: "magic_link", label: "Email magic link" }],
    grants: [{ id: "grant-codex", clientName: "Codex", scopes: ["Read journal", "Update journal"] }],
  },
  messaging: { kind: "not_configured", availableThroughLabel: "Sep 30, 2026" },
  viewer: { displayName: "Maya Alvarez", email: "ren@example.test" },
  households,
  members,
  collections,
  mealPlan: {
    householdId: "alvarez-home",
    weekStart: "2026-07-20",
    weekLabel: "July 20–26",
    previousWeek: "2026-07-13",
    nextWeek: "2026-07-27",
    timeZoneLabel: "Pacific Time",
    role: "owner",
    canEdit: true,
    canReview: true,
    constraintState: "reviewed",
    constraintRevision: "a".repeat(40),
    constraintReviewEventId: "meal-event-review",
    proposalCount: 2,
    statusMessage: null,
    days: fixtureWeekDays.map(([date, label, shortLabel]) => ({
      date,
      label,
      shortLabel,
      slots: fixtureSlots.map((slot) => ({
        id: `slot-${date}-${slot}`,
        key: slot,
        label: slot[0].toUpperCase() + slot.slice(1),
        proposals: date !== "2026-07-20" || slot !== "lunch" ? [] : [
          {
            id: "proposal-egg-salad",
            title: "Egg salad sandwich",
            sourceKind: "journal_recipe" as const,
            sourceDetail: "Liked recipe from your journal",
            proposedBy: "Maya Alvarez",
            servings: 4,
            notes: "Use the rye bread.",
            compatibilityLabel: "Compatible when prepared as recorded",
            compatibilityCaveat: "Check package labels before serving.",
            needsRecheck: false,
            canWithdraw: true,
          },
          {
            id: "proposal-pizza",
            title: "Pizza",
            sourceKind: "freeform" as const,
            sourceDetail: "Household idea",
            proposedBy: "Household member 2",
            servings: null,
            notes: null,
            compatibilityLabel: "Compatibility evidence is incomplete",
            compatibilityCaveat: "Confirm ingredients and cross-contact risks before serving.",
            needsRecheck: true,
            canWithdraw: true,
          },
        ],
      })),
    })),
  },
  visualJournal: null,
  publicCollection,
  invite: {
    state: "preview",
    householdName: "Alvarez home",
    inviterName: "Maya Alvarez",
    roleLabel: "Editor",
    expiresLabel: "July 22, 2026",
  },
  collectionState: "ready",
  emailSent: false,
};
