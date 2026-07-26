# Household Food-Delivery History and Cart Preparation

## Snapshot

- Status: `promoted`
- Priority lane: `next`
- Impact: `high`
- Confidence: `medium`
- Effort: `large`
- Last reviewed: `2026-07-24`

## Why this matters

Fullwell can already learn familiar grocery products from order history and prepare a retailer cart without checking out. Restaurant delivery has the same underlying user need but a different identity and cart shape: a person remembers a restaurant name, a location, a prior order, or one dish and wants Fullwell to find the right history, apply a small change, and prepare the matching delivery cart.

The valuable memory is not merely `Wanpo`. It is the provider-backed restaurant location, the dishes and modifiers ordered there, the complete prior order grouping, and the evidence that lets Fullwell distinguish Palo Alto, Cupertino, Stanford, and other locations with the same display name. A household should be able to contribute to that index, use delivery dishes in a weekly plan, and share selected dishes without exposing order identifiers, account state, or private source locators.

`Start an order` means prepare a provider cart and stop. It never means place the order, choose or change a delivery address, schedule delivery, add a tip, accept a membership, authorize payment, or check out.

## Current evidence

- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md` already defines complete order-history traversal, signed-in browser preflight, exact line-item evidence, and agent-owned semantic identity decisions.
- `packages/agent-client/skills/restock-groceries/SKILL.md` and `packages/agent-client/references/restocking-and-cart-safety.md` already separate cart resolution from mutation, bind price authority to one request, persist idempotent targets, treat pages as untrusted, and forbid checkout.
- `packages/contracts/src/domain.ts` already models private evidence, journal items, public-safe collection snapshots, and append-only meal proposals, but it has no delivery evidence, dish item, or delivery meal source.
- `packages/contracts/src/tools.ts` limits profiles, item kinds, reports, collections, and imports to the current grocery and recipe families.
- `packages/contracts/src/tools.ts` limits `hfj_commit_onboarding` to the two grocery/recipe sections. A ready local delivery index needs its own atomic, idempotent cloud-promotion boundary rather than distorting first run.
- `packages/agent-client/skills/share-food-collection/SKILL.md` already requires a field-level public preview; delivery dishes can join that flow through an allowlist projection.
- `packages/agent-client/skills/plan-household-meals/SKILL.md` already treats each meal slot as a set of attributed proposals and separates familiarity from food-safety evidence.

## Expert panel

- Household product and UX expert - define a low-friction source audit, clear restaurant-location ambiguity prompts, and honest cart-ready completion language.
- Security and privacy researcher - bound provider origins, signed-in browser authority, order-history retention, prompt injection, cart replacement, payment, and checkout.
- Staff TypeScript and Git architect - extend the journal and projection contracts without creating a second writer or a provider-specific integration layer.
- Reliability engineer - make multi-line cart preparation idempotent across duplicate requests, changed menus, conflicting carts, crashes, and unverifiable UI state.
- Applied ML and evals expert - keep location and dish identity decisions in the agent, ground reorders in cited history, and test ambiguity without keyword classifiers.

## What problem are we actually solving?

Let a person or household turn private delivery history into a useful, location-aware food index and then ask Fullwell to prepare an exact or intentionally modified prior order in an approved signed-in provider website, while stopping before every financially consequential checkout action.

## Roundtable highlights

- Product and UX: ask which delivery sites the user uses and which signed-in browser Fullwell may inspect. Keep delivery setup independently resumable instead of adding a mandatory third section to the existing grocery-then-recipe first run.
- Security and privacy: retain provider, order, restaurant-location, dish, modifier, and completeness evidence privately; never retain credentials, cookies, delivery destinations, payment details, tips, raw pages, screenshots, or checkout state.
- Security and privacy: before a connected audit, explain that contributed dishes, drinks, restaurant locations, private order dates/groupings, and modifiers become visible to current household members; require explicit source-by-source confirmation or keep the audit local.
- Security and privacy: disclose that version 1 has no per-source erase, revoking a browser origin or later leaving a household does not selectively erase contributed Git history, and encrypted backups age out under the published retention period after household deletion.
- Architecture: add one provider-neutral delivery evidence/item family and one delivery index. DoorDash and Uber Eats are required release-matrix targets, but the contract accepts a bounded user-named HTTPS provider origin instead of encoding provider UI details into server code.
- Reliability: represent one cart preparation as a versioned list of exact lines, modifier choices, baseline quantities, targets, provider origin, restaurant location, and current subtotal. Recovery re-reads every target and never repeats a verified line.
- Applied ML and evals: resolve restaurant location before prior order and prior order before requested edits. Ask only about real historical ambiguity, such as `You've ordered from two Wanpo locations - Palo Alto and Cupertino. Which one?`
- Household and sharing: connected members may contribute attributed evidence and use the same index. A shared collection may publish a selected dish and public restaurant location label, but an import creates no private order evidence and cannot silently become reorder authority.
- Meal planning: a delivery dish may be an explicit proposal source, but an order proves familiarity rather than liking or dietary compatibility. Missing ingredients remain `incomplete_evidence`.

## Key tensions

- Familiar restaurant name versus exact location: provider search results are not enough when the household has evidence for more than one location.
- Easy reorder versus destructive cart replacement: many delivery providers allow one restaurant per cart, so an existing different-restaurant cart requires an exact user decision before any replacement.
- Household usefulness versus individual privacy: order history can benefit the household, but only explicitly authorized accounts are audited and raw provider/account details stay private.
- General provider support versus fragile UI adapters: computer use can follow provider-neutral instructions, but each claimed provider still needs an authorized manual compatibility gate.
- Multi-line convenience versus idempotency: a prior order can contain several dishes and modifiers, so one quantity field is insufficient for safe crash recovery.
- Collection usefulness versus reorder authority: a public dish recommendation may be imported and planned, but it is not proof that the destination household ordered it.
- Familiarity versus preference or safety: prior orders do not prove a dish was liked or satisfies current household constraints.
- Delivery versus pickup: provider history often mixes both, so fulfillment mode must be evidence and current-cart state rather than an assumption.

## Proposed direction

1. Add an independently resumable food-delivery audit. Ask which browser-accessible delivery services the user uses, including DoorDash, Uber Eats, Grubhub, or another user-named HTTPS site, and which installed signed-in browser Fullwell may control.
2. Preflight every selected provider before collecting any of them. Never request a password, one-time code, cookie, delivery address, or payment credential.
3. Use a trailing 12-month window by default. Open every qualifying completed order, expand the full item and modifier list, record `delivery | pickup`, and mark an order incomplete when the provider UI cannot expose all lines.
4. Record typed private evidence for provider, provider order reference, order date, fulfillment mode, restaurant display name, restaurant location label/address fields, provider merchant locator, exact dish title, modifiers, quantity, and complete-order grouping.
5. Let Codex or Claude decide whether restaurant locations and dishes are the same. Deterministic code may validate fields, count order groups, and detect exact locators; it must not merge same-name locations, dishes, or modifier variants.
6. Author a delivery dish item for every supported identity and a delivery index grouped by distinct restaurant location. Preserve location aliases such as `Stanford` only when the evidence or user supplies them.
7. Store local delivery history in the existing revisioned guest journal. Before storing or promoting connected history, explain its household visibility and retention and confirm each provider source. Promote a reconciled ready local index with one delivery-specific idempotent commit, then store confirmed contributions in household Git with actor attribution and the server's normal lock, expected revision, evidence, audit, signed commit, and projection behavior. Add bounded authenticated cloud reads for candidate delivery groups, one exact validated order, and the current delivery-index report so connected reorders and promotion never require an unbounded journal dump.
8. Add two shared client skills: one for delivery-history auditing and one for prior-order cart preparation. Extend the existing collection and meal-planning skills instead of creating parallel sharing or planning workflows.
9. Resolve a cart request in this order: provider, historical restaurant location, complete prior delivery order, requested additions/removals/replacements, current menu availability, current delivery-mode provider cart, and current displayed subtotal. If the same restaurant/location appears on multiple providers, ask which provider before touching a cart.
10. Interpret an unqualified `reorder` at a resolved location as the most recent complete prior order. If the user says `usual`, prefer a clearly recurring complete order; if material historical ambiguity remains, ask with compact order summaries.
11. For `Do a reorder from Wanpo in Stanford but swap the coconut boba for a wintermelon boba`, select Stanford only when the private location index resolves it uniquely, verify the source item exists in the selected order, locate an exact current replacement, and show the resulting line plan before mutation.
12. Use current provider menus only for availability and an explicitly requested new choice. A menu result never becomes evidence that the household prefers it.
13. Reuse the existing automatic cart-add maximum from the compatibility grocery profile. Compare the complete requested food subtotal in USD; require exact confirmation at or above the maximum or when the amount increases. Delivery fees, taxes, tips, memberships, and checkout totals remain outside cart-add authority.
14. Bind a versioned multi-line plan in the active direct session before browser mutation. It records provider origin, `delivery` mode, restaurant location, order-plan fingerprint, each exact item/modifier target, baselines, current subtotal, authorization mode, and current journal authority.
15. On retry, re-read the complete cart. Verified target lines are not added again; missing target quantities may be completed only while the same price and authorization remain valid. A later session resolves from current evidence and visible cart state rather than replaying clicks.
16. Never clear or replace a different-restaurant or same-name/different-location provider cart without an explicit decision bound to the visible existing-cart summary and the requested restaurant. Never change an unrelated same-location line.
17. Alcohol may remain in the delivery index and cart plan when supported by prior order evidence, and an explicitly selected alcohol item may appear in a household collection or meal proposal. It follows the same ambiguity, automatic cart-add maximum, privacy, revision, and compatibility rules as other delivery lines because Fullwell stops before checkout. Fullwell never bypasses provider age/identity checks, handles an ID, asserts eligibility, or proceeds past the cart. Tobacco, cannabis, prescriptions, gift cards, and other non-food/regulated goods remain outside audit conclusions and cart authority.
18. Stop after the requested provider cart is visibly prepared. Report provider, restaurant location, requested lines, displayed subtotal, unresolved availability, and that the user must review and check out manually.
19. Extend public-safe collection snapshots with `delivery_dish`. Publish only the dish, restaurant name, human-readable location label, selected public note/image/link, and attribution. Exclude provider/order references, merchant locators, dates, counts, modifiers not explicitly selected, actor IDs, and account details.
20. Importing a delivery dish creates import provenance and a saved/shared dish record, not delivery-order evidence, recurrence, liking, or reorder authority.
21. Extend meal-plan sources with a revisioned delivery dish. An explicit user-selected or accepted dish can become a proposal after the normal constraint review. Familiarity and imported provenance may be cited, but compatibility remains incomplete unless ingredient evidence supports more.
22. Keep the central server free of provider automation and LLM behavior. Computer use runs only in Codex or Claude on the user's machine against exact approved origins.

## Non-goals

- placing an order, checking out, paying, tipping, choosing or changing a delivery address, scheduling delivery, accepting a membership, or redeeming credits
- controlling DoorDash, Uber Eats, or another provider's native iOS or Android application in version 1
- requesting or storing provider passwords, one-time codes, cookies, payment data, delivery destinations, or raw browser captures
- treating provider search ranking, sponsored results, recommendations, or menu text as household preference evidence
- silently merging restaurant locations because they share a display name
- silently replacing unavailable dishes or modifiers
- clearing an existing different-restaurant cart without an exact user confirmation
- auditing into household authority without explaining household visibility and confirming that provider source
- promising selective erasure of contributed Git history after origin revocation or member departure
- claiming that household deletion immediately removes encrypted backups before the published retention period expires
- adding tobacco, cannabis, prescriptions, gift cards, or other non-food/regulated goods
- bypassing an alcohol age/identity check, handling identity documents, asserting eligibility, or taking alcohol past the provider cart
- inferring that a household or member liked a dish solely because it was ordered
- claiming dietary compatibility from an order, menu title, or collection import
- publishing complete orders, private modifiers, order history, provider account data, or merchant locators in shared collections
- making imported collection dishes reorderable without destination-household order evidence
- adding provider SDKs, server-side browser workers, provider credentials, a delivery-order API integration, or a server-side LLM
- adding WhatsApp-linked, background, or remote-runner delivery execution in this feature

## Priority and sequencing

Keep this in `next`. It reuses strong grocery cart-safety, household Git, collection, and meal-planning foundations, but it adds a new private evidence family, a multi-line external mutation, multiple provider origins, destructive-cart conflicts, and live third-party UI compatibility.

Start with an authenticated-browser feasibility and state-matrix milestone. DoorDash and Uber Eats must each pass order-history discovery, exact location identification, full line/modifier expansion, cart resolution, cart mutation, duplicate recovery, and no-checkout tests on an authorized account before being advertised. A provider-neutral fake must cover the deterministic matrix. Additional providers are supported only after the same gate; do not promise a provider merely because its homepage loads.

Land additive schemas, local-to-cloud promotion, and private indexing before enabling live cart mutation. Then extend collections and meal planning from the stable delivery dish contract. Keep WhatsApp-linked runner work in a separate future plan.

## Open questions

- Do current DoorDash and Uber Eats web experiences expose stable merchant/location locators and complete modifier history for the full audit window?
- Which third provider should join the first manual release matrix when an authorized account is available?
- Can the current isolated Codex and Claude browser policies safely hold a bounded set of exact provider origins without granting cross-origin browsing?
- How do each provider's cart semantics behave when switching restaurants, and what exact confirmation copy best explains the destructive replacement?
- Which provider UI states distinguish an unavailable item, unavailable modifier, closed restaurant, delivery-area mismatch, sign-in block, CAPTCHA, and expired session?
- Which provider UI state proves delivery rather than pickup before cart mutation?
- Does a provider preserve an existing same-restaurant cart strongly enough for per-line idempotent recovery, or must some providers remain read/index-only?
- Which restaurant location fields are consistently visible without storing the user's delivery destination?
- What exact public restaurant-location label is useful in a shared collection without exposing a private merchant locator?

## Promotion trigger

Promoted on `2026-07-24` to `docs/exec-plans/active/2026-07-24-food-delivery-history-and-cart-preparation.md`. Milestone 0 owns provider terms/UI feasibility, exact-location evidence, multi-line recovery, and the structural no-checkout gate before implementation can claim live provider support.
