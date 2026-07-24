# Agent Guides and Visual Journal Browsing

## Snapshot

- Status: `promoted`
- Priority lane: `now`
- Impact: `high`
- Confidence: `high`
- Effort: `medium`
- Last reviewed: `2026-07-24`

## Why this matters

Fullwell starts and changes journal content in chat, but the website currently sends every agent-related next step back to the generic installation screen. A person who wants to connect WhatsApp, invite a household member, create a collection, or share one needs a direct, stable example for that exact task. The website also summarizes recipe and grocery counts without letting a signed-in household visually browse the records behind those counts.

## Current evidence

- The install screen offers Codex and Claude, while current user-facing language should present the Codex-hosted experience as ChatGPT without changing the internal plugin, OAuth client, or command identifiers.
- Continue with Apple uses a placeholder dot even though the action is visually important.
- The household overview links recipe and grocery counts as plain summary values and exposes no visual journal route.
- Journal projections already retain recipe and grocery image URLs, source-page provenance, independent recipe Saved/Cooked/Liked states, and grocery distinguishing fields.
- The server already authorizes household projections and sends typed React view models, so visual browsing does not need a browser editing boundary or a new source of truth.
- The user explicitly requested individual advanced examples for WhatsApp connection, household invitations, collection setup, and collection sharing, plus visual recipe and grocery pages with infinite scroll.

## Proposed direction

Add a public `/guides` hub with stable detail routes for the four requested workflows. Keep each example conversational, host-neutral where possible, and explicit about browser confirmations. Add accessible native vector marks beside ChatGPT, Claude, and Apple labels while retaining visible text.

Add authenticated `/households/:householdId/recipes` and `/households/:householdId/groceries` routes. The server projects only display-safe summaries for the authorized household. React renders image-forward cards and progressively appends bounded cursor pages through a same-origin, authenticated JSON boundary. A normal `Load more` link must render an equivalent larger prefix without JavaScript. External images use HTTP(S)-validated URLs, lazy decoding, `no-referrer`, fixed dimensions, and a visible fallback.

## Non-goals

- Browser-side journal creation or editing.
- Food classification, recipe equivalence, or product inference.
- Changing stable Codex/Claude package, plugin, OAuth, or MCP identifiers.
- Turning groceries into an ecommerce surface or adding prices and cart actions.
- Making private journal images public or proxying external images through Fullwell.

## Expert synthesis

- Product and information architecture: link each contextual action directly to one guide instead of using the install screen as a catch-all.
- Frontend and accessibility: keep visible brand names beside marks, provide a keyboard-operable explicit load control, and preserve server-rendered navigation.
- Security and privacy: authenticate every journal batch, send `no-store` and `noindex`, keep cross-tenant reads indistinguishable from missing records, and never serialize private records for another household.
- Reliability: use deterministic ordering, opaque bounded cursors, client deduplication, a retryable load failure, and an end-of-list state.
- Semantic integrity: display recorded fields only; do not infer grocery categories beyond the stored kind or collapse independent recipe states.

## Success criteria

- ChatGPT, Claude, and Apple actions have recognizable marks plus accessible visible labels.
- Every requested workflow has its own stable guide URL and all contextual links resolve to the relevant guide.
- Authorized members can visually browse recipe and grocery cards, load multiple bounded pages automatically, and use an explicit fallback control.
- Anonymous and cross-household requests cannot receive private journal summaries.
- Component, server, browser, accessibility, docs, and repository verification pass.

## Priority and sequencing

Keep this in `now` because it closes explicit website handoff and journal-browsing gaps without changing journal storage or mutation authority. Implement the public marks and stable guide routes first, then add the authorized visual projection and progressive-loading browser, and finish with cross-browser, privacy, documentation, and deployment evidence through the active ExecPlan.

## Open questions

- Should a later iteration add server-owned search and recorded-state filters after real household use shows that browsing alone is insufficient?
- Should missing external images gain curated local artwork, or should the current explicit neutral fallback remain the privacy-preserving default?
- When the journal regularly exceeds the current no-JavaScript prefix bound, should the ordinary fallback change from cumulative prefixes to cursor-addressed result pages?

## Promotion trigger

Promoted on `2026-07-24` when the user requested branded host actions, four task-specific public guides, and infinite visual recipe and grocery browsing, and repository inspection confirmed that the existing authorized journal projection contained the required display fields without a schema migration.
