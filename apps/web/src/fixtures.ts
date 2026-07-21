import type {
  HouseholdSummary,
  Member,
  PublicCollection,
  PublishedCollection,
  WebRenderContext,
} from "./types.js";

export const households: readonly HouseholdSummary[] = [
  {
    id: "alvarez-home",
    name: "Alvarez home",
    role: "owner",
    members: 4,
    recipes: 38,
    snacks: 22,
    updatedLabel: "Updated yesterday",
  },
  {
    id: "lake-cabin",
    name: "Lake cabin",
    role: "viewer",
    members: 6,
    recipes: 14,
    snacks: 9,
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

export const demoWebContext: WebRenderContext = {
  security: { csrfToken, idempotencyPrefix: "demo-request" },
  canonicalUrl: "http://127.0.0.1:4173",
  install: {
    hosts: {
      codex: {
        label: "Codex",
        command: "codex plugins install fullwell/household-food-journal",
        next: "After installation, start Fullwell with the prompt below.",
        setupPrompt: "@Fullwell hi",
        setupHref: "codex://new?prompt=%5B%40Fullwell%5D(plugin%3A%2F%2Fhousehold-food-journal%40fullwell-plugins)%20hi",
      },
      claude: {
        label: "Claude",
        command: "claude plugin install fullwell-household-food-journal",
        next: "After installation, start Fullwell with the prompt below.",
        setupPrompt: "Set up Fullwell.",
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
