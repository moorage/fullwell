# Food-Delivery History, Household Sharing, and Cart Preparation

## Purpose / Big Picture

Deliver a Fullwell workflow that can learn a household's prior restaurant-delivery orders from user-approved, already-signed-in provider websites; distinguish restaurants with the same name by their actual location; build a private evidence-backed index of restaurant locations and dishes; and prepare an exact or intentionally modified previous order in the correct provider cart through local computer use.

The primary user flow is:

1. The user asks Fullwell to learn food-delivery history.
2. Fullwell asks which browser-accessible delivery services the user uses and which installed signed-in browser it may control.
3. Codex or Claude traverses complete delivered-order details, records private provider/location/dish evidence, and authors a location-aware delivery index.
4. A local guest can search and reuse the index on that computer. Connected household members can contribute their own authorized history, search the shared household index, include selected delivery dishes in meal proposals, and publish selected dishes through the existing curated collection flow.
5. A request such as `Do a reorder from Wanpo in Stanford but swap the coconut boba for a wintermelon boba` resolves provider, historical restaurant location, prior order, requested edit, current menu availability, current cart, and current food subtotal in that order.
6. Fullwell shows or resolves any genuine ambiguity, prepares only the requested cart lines, verifies the resulting cart, reports the restaurant location, lines, and displayed subtotal, and stops.

`Start a new order` is deliberately defined as `prepare the provider cart`. It never authorizes checkout, order placement, payment, tips, delivery-address changes, scheduling, memberships, subscriptions, or accepting another paid service. The user reviews and checks out manually outside Fullwell.

This plan promotes `docs/ideas/backlog/food-delivery-history-and-cart-preparation.md`. Its priority lane is `next`: the feature builds on implemented grocery audit, restocking, collections, household Git, and meal-planning behavior. Provider-neutral implementation proceeds against the deterministic browser fixture; named live-provider release claims remain gated on authorized validation in the account holder's user-directed signed-in browser.

## Progress

- [x] 2026-07-25T03:33Z: Captured and claimed Beads feature `fullwell-zbt` for the planning and review artifact.
- [x] 2026-07-25T03:33Z: Read the architecture, ExecPlan standard, execution guide, client/server product specs, grocery-restocking prior art, meal-planning prior art, current contracts, local runtime, runner, sharing skills, and privacy/safety guidance.
- [x] 2026-07-25T03:33Z: Completed expert-roundtable framing and dependency-aware decomposition; promoted the idea in the backlog.
- [x] 2026-07-25T03:33Z: Applied the feature-critic pass for security, privacy, UX, reliability, and eval coverage; added source-by-source household-visibility consent and explicit regulated/non-food handling. Per user direction, alcohol uses the normal cart-preparation rules because Fullwell stops before checkout.
- [x] 2026-07-25T04:18Z: First adversarial plan-review gate returned three actionable failures. Removed WhatsApp/linked-runner expansion; coupled each contract with its direct consumers; added local-to-cloud delivery promotion, fulfillment-mode checks, cross-provider/location ambiguity, alcohol collection/meal behavior, and explicit contribution-retention semantics; fixed the Milestone 0 fixture-test dependency.
- [x] 2026-07-25T04:39Z: Second adversarial review found a connected-history read gap and three release/privacy gaps. Added bounded authenticated candidate/exact-order reads, promotion persistence/reconciliation consumers, post-cart alcohol E2E/live gates, accurate encrypted-backup retention language, and an explicit no-per-source-erase boundary.
- [x] 2026-07-25T04:54Z: The third adversarial gate passed completeness and scope but found that Milestone 1 widened `JournalItemSchema` before `apps/server/src/http/web-view-model.ts` could narrow `delivery_dish`.
- [x] 2026-07-25T04:57Z: Per user decision, Milestone 1 now owns exhaustive visual-journal narrowing and server/web regression tests. Delivery dishes are explicitly excluded from the existing recipe/grocery pages until their purpose-specific collection and meal-plan presentation lands in Milestones 4 and 5.
- [x] 2026-07-25T05:11Z: Recovery review passed completeness and scope but found two remaining dependency consumers. Milestone 1 now owns exhaustive `JournalItem` narrowing across the household service and journal path mapping as well as the web view; Milestone 2 now updates the MCP reference, required-tool validator, packaging test, and delivery skills together.
- [x] 2026-07-25T05:22Z: The next completeness review found that generic onboarding arrays would inherit the new delivery variants. Milestone 1 now defines explicit onboarding-only evidence, item, and report schemas and tests that delivery data cannot bypass provider-source consent or the dedicated promotion mutation.
- [x] 2026-07-25T05:31Z: Feasibility review found the same widening risk in generic change-set/evidence/profile writes and recipe/snack collection merge, plus a non-atomic server/client tool rollout. Milestone 1 now closes every legacy delivery-write and collection-merge path; Milestone 2 owns the four delivery MCP tools, server registration/recovery, reference, validator, packaging tests, and consuming skills as one work unit.
- [x] 2026-07-25T05:44Z: The prior three-iteration recovery gate exhausted with completeness passing and feasibility still failing on two plan defects. Milestone 2's atomic-tool task named the reorder skill even though that file is created in Milestone 3, and Milestone 4 used an incorrect web-workspace name. Both defects are corrected below; a fresh gate is required before implementation.
- [x] 2026-07-25T06:02Z: Fresh-gate iteration 1 passed scope and exposed three executable-boundary gaps. Milestone 0 now owns Playwright startup for the fake delivery provider; every milestone owns and runs the real delivery security suite without nonexistent filters; and Milestone 3 updates the package validator atomically with the reorder skill.
- [x] 2026-07-25T06:07Z: Fresh-gate iteration 2 passed feasibility and scope but found three authority/eval ambiguities. Connected history promotion is now exactly one provider source and consent per mutation; collection import is an explicit public-provenance-only exception to private delivery-history writes; and Milestone 4 owns its cross-host eval files and cases.
- [x] 2026-07-25T06:11Z: Fresh-gate iteration 3 passed completeness and scope but found stale multi-provider promotion prose and an undefined aggregate-update rule. Promotion is now consistently sequenced one provider per mutation; aggregate profile/report documents retain other providers as unchanged expected content, and tests reject any call that changes more than the one consented provider.
- [x] 2026-07-25T06:14Z: Final fresh approval review passed feasibility, completeness, and scope. The ExecPlan is approved for implementation.
- [x] 2026-07-25T16:45Z: The user clarified the live-provider boundary: Fullwell catalogs the account holder's own purchases through ordinary, user-directed navigation in their signed-in browser. It does not crawl public pages, run unattended scraping, bypass controls, share credentials, or expose provider data as a service. Provider terms remain a release-risk input rather than an implementation blocker; provider-specific claims still require authorized validation.
- [x] 2026-07-25T14:48Z: WU-00 repaired the pre-existing coverage baseline with behavior-only server/web tests. Independent verification passed 355 tests with 90.19% branch coverage, and fresh adversarial review passed.
- [x] 2026-07-25T14:48Z: WU-01 implemented the deterministic DoorDash/Uber Eats fixture, Playwright lifecycle, exact-origin host-policy spike, provider feasibility notes, support matrix, ambiguity behavior, exact multi-line cart preparation, modifier validation, interruption/session-loss recovery, alcohol maximum/age-step behavior, and structural no-checkout controls. The final rendered-history traversal and fresh review are in progress, so Milestone 0 remains open.
- [x] 2026-07-25T15:38Z: User-authorized recovery remediation removed remembered destructive-replacement authority and now revalidates the visible restaurant and complete cart before every retry. Independent verification passed 60/60 focused browser cases, typecheck, lint, policy, docs, ExecPlan, diff, and 90.19% branch coverage; a fresh adversarial reviewer returned PASS.
- [x] 2026-07-25T16:12Z: WU-02 contract validation passed, but three fresh adversarial review attempts exposed progressively deeper direct-cart authority gaps. Exact origins, qualifying order status, opaque locators, structured no-checkout completion, and one complete source-order binding were fixed; the remaining contract lacked an exact source-line-to-authorized-edit mapping and a parsed current-cart baseline bound to replacement confirmation and retry behavior. The review gate stopped at its required human checkpoint.
- [x] 2026-07-25T16:31Z: The user approved the recommended recovery and directed implementation through Milestone 6. WU-02 now retains only the complete delivery evidence/item/profile/report contract slice. Milestone 3 owns the direct-session cart baseline, source-line edit mapping, bound confirmation, retry, and terminal-state contracts atomically with the reorder skill and eval consumers; its review audit restarts fresh.
- [x] 2026-07-25T16:46Z: The restructured WU-02 audit exhausted three fresh attempts. Strict raw-origin canonicality, public merchant-address identity, resumable provider cursors/preferences, immutable group/dish/profile arrays, and actor/source binding were remediated. The remaining two findings are limited to immutable delivery-index report assertions and freezing the omitted `interpretation_preferences` default. Per the execution workflow, WU-02 is paused at a new human checkpoint before another edit.
- [x] 2026-07-25T16:49Z: The user authorized the recommended narrow recovery. WU-02 may freeze the delivery-index report graph and omitted preferences default, then restart its adversarial audit fresh before persistence work begins.
- [x] 2026-07-25T19:11Z: The human-authorized WU-02 recovery froze delivery report assertions/ID arrays and both supplied/default preference arrays. Root build, 362 tests, lint, and diff checks passed; a new-context adversarial reviewer returned PASS. WU-02 is closed with commit withheld by the conservative profile.
- [x] 2026-07-25T19:42Z: WU-03 added strict canonical delivery Git rebuild validation, safe delivery search projection, exhaustive legacy view/total narrowing, readiness schema 8, and reversible migration 0008. Root validation passed full typecheck, 79 focused tests plus retry regressions, security, eight-migration up/down/up, 11 PostgreSQL integrations, and 90.24% branch coverage. A different retry reviewer returned PASS; Milestone 1 is complete with commit withheld.
- [x] 2026-07-25T20:14Z: WU-04 defined and registered the four bounded connected delivery tools, safe history/order/index reads, and the one-provider consented commit with exact aggregate preservation, idempotency, recovery, and private-telemetry tests. Root validation passed 57 focused tests, 11 security tests, full typecheck, scoped lint, and 90.06% branch coverage after the profile-only provider prose regression. A different reviewer returned PASS; the uncommitted Milestone 2 client slice follows.
- [x] 2026-07-26T09:15Z: WU-05 shipped the shared delivery-history audit skill, local canonical delivery validation, provider-scoped promotion receipts, packaging/evals, and a fail-closed structural-key privacy boundary. Human-approved recovery cycles added preservation, lost-response replay, complete report coverage, suffix/plural/collapsed/split/Unicode key defenses, canonical address path scoping, and food-domain collision guards. Root validation passed 47 packaging tests, 14 eval tests, package validation, typecheck, scoped lint, and diff checks; adversarial review returned PASS. Milestone 2 is complete with commit withheld by the conservative profile.
- [x] 2026-07-26T18:24Z: WU-06 added provider/location-aware prior-order resolution and a fail-closed cart-preparation contract, skill, eval matrix, provider fixture, browser flow, and security coverage. Approved recovery cycles separated requested, preserved, and full-cart pricing; bound confirmations to the full visible cart; limited mapped edits to exact authorized decrements with preserved remainders; and removed all old-cart authority before different-location replacement. Root validation passed 38 contract tests, 47 packaging tests, 14 eval tests, 12 security tests, 72 browser cases, typecheck, scoped lint, 91.63% contract-domain branch coverage, and fresh adversarial review. Milestone 3 is complete with checkout structurally excluded and commit withheld by the conservative profile.
- [x] 2026-07-26T19:02Z: WU-07 added strict public delivery-dish collection selection/snapshots, import-only journal authority, deterministic public duplicate planning, exact-kind cumulative merges, canonical Git rebuild/reconciliation, safe search projection, accessible restaurant/location cards, explicit alcohol selection, and cross-host skills/evals. Approved recoveries closed committed-tree import-evidence reconstruction and same-request repeated-destination overwrite gaps. Root validation passed 39 contract, 47 packaging, 45 focused server, 84 web, 13 security, 14 eval, 32 browser, 6 accessibility, and 75 recovery tests plus build/type/lint/coverage gates; fresh adversarial review returned PASS. Neon integration remained unavailable without `TEST_DATABASE_URL`; commit is withheld by the conservative profile.
- [x] 2026-07-26T19:47Z: WU-08 added exact revision/evidence-bound `journal_delivery_dish` proposals across local and cloud runtimes, canonical Git rebuild/recheck, append-only service behavior, safe connected rendering, conservative incomplete compatibility, explicit alcohol handling, and cross-host evals. Approved recoveries added strict local public-import authority and prevented unrelated generic saves from fabricating undefined history keys. Root validation passed 39 contract, 49 packaging, 89 focused server, 84 web, 14 security, 14 eval, and 12 browser cases plus build/type/lint/coverage gates; fresh adversarial review returned PASS. Milestone 5 is complete with commit withheld by the conservative profile.
- [x] 2026-07-26T20:13Z: WU-09 synchronized client/server product contracts, architecture, security, reliability, privacy, quality, release evidence, launch gates, implementation history, and unreleased package guidance with implemented Milestones 1-5. Approved doc-drift recoveries added every delivery path/tool/authority, corrected projection and search-limit claims, removed an unavailable self-service deletion promise, and kept fixture evidence separate from pending provider/host/release proof. Root docs, ExecPlan, and diff gates passed; final doc-drift review returned PASS with only Milestone 6 evidence gaps remaining.
- [x] 2026-07-26T04:35Z: WU-10 completed the local Milestone 6 hardening matrix. Full browser coverage passes 135 checks with 13 intentional project skips; schema `0008` passes eight migrations up/down/up and 11 PostgreSQL integrations through Apple Container; production dependencies audit cleanly; the pinned Node 24 image builds; and a 6.68-second fixture-only H.264 screencast proves provider/location ambiguity, Stanford selection with the prior coconut line, the resulting wintermelon cart, public-collection, meal-plan, and explicit stop-before-checkout states. The Linux X11/PulseAudio helper was unavailable on macOS, so Playwright-native video supplied the verified fallback. No authorized live provider, installed-host, staging, publication, or manual approval evidence exists, so DoorDash, Uber Eats, additional providers, and their alcohol sub-capabilities are explicitly unsupported for release. Fresh adversarial review returned PASS after verifying the exact frames, artifact metadata, tracking, release labels, authority boundaries, and rollout/rollback wording.
- [x] 2026-07-26T05:14Z: Release commit `65aca44` was pushed, schema `0008` was applied after a root-only schema `0007` checkpoint, the checksum-matched Linux/amd64 image was deployed with the prior environment retained, and public readiness/deployment/MCP smokes pass. Immutable `@fullwell/fullwell@1.1.14` is npm `latest`; registry checksums match a clean 33-file download whose isolated Codex and Claude lifecycles pass. This provider-neutral release does not change the unsupported DoorDash, Uber Eats, additional-provider, installed-host live-provider, live alcohol age-step, or manual privacy/accessibility labels.
- [x] Milestone 0 - prove provider order-history, exact-location, cart, host, and no-checkout feasibility and freeze the support matrix.
- [x] Milestone 1 - add additive delivery evidence, item, profile, report, and projection contracts while closing every legacy write/consumer boundary.
- [x] Milestone 2 - implement local and connected delivery-history auditing, location-aware indexing, household contribution, and semantic evals.
- [x] Milestone 3 - implement direct prior-order resolution, multi-line computer-use cart preparation, exact ambiguity prompts, and recovery.
- [x] Milestone 4 - extend curated collection preview/import with public-safe delivery dishes and no reorder-authority leakage.
- [x] Milestone 5 - extend local and cloud meal planning with revisioned delivery-dish proposals and conservative compatibility behavior.
- [x] Milestone 6 - complete local security, privacy, accessibility, provider-classification, cross-host contract, rollout/rollback, screencast, and release evidence; conclude with a no-go for named-provider release because authorized live host/provider, staging, publication, and manual approval evidence is absent.

## Surprises & Discoveries

- 2026-07-25: Current Fullwell first run intentionally has exactly two sections, compatibility `snacks` for all groceries and `recipes`. Delivery setup can remain independently resumable and still satisfy the request without widening every onboarding state, migration, draft, and completion contract.
- 2026-07-25: A restaurant reorder can contain several lines and provider carts may replace another restaurant's cart. Direct computer use must therefore bind a bounded multi-line plan in conversation state and re-read the complete cart before every mutation or recovery attempt.
- 2026-07-25: Existing collection imports intentionally separate public provenance from purchase evidence. That boundary maps directly to delivery: an imported dish may be searchable and plannable, but it must not become a previous-order candidate.
- 2026-07-25: Existing meal planning requires Liked evidence only for journal recipes. Delivery history proves familiarity, not liking. A delivery-dish proposal needs a distinct source contract and conservative `incomplete_evidence` behavior instead of pretending it is a recipe or preference.
- 2026-07-25: The current PostgreSQL `search_items.kind` check in `migrations/0001_operational_core.sql` names only `snack` and `recipe`, while application contracts now include more grocery kinds. The delivery migration must reconcile the live projection constraint with all currently supported item kinds before adding `delivery_dish`; canonical Git remains unaffected because search rows are rebuildable.
- 2026-07-25: The local guest journal validator already preserves bounded generic evidence/items/profile content and isolates purpose-specific meal-planning mutations. Delivery indexing can use the existing revisioned save path, while delivery meal sources require an explicit local meal-proposal contract update.
- 2026-07-25: `apps/server/src/http/web-view-model.ts` currently treats every non-recipe item as grocery and reads grocery-only fields. The shared `delivery_dish` union cannot land safely until that boundary uses an exhaustive kind switch and explicitly omits delivery dishes from the two legacy visual-journal sections.
- 2026-07-25: `apps/server/src/services/household-food-journal.ts` also assumes every non-recipe item exposes grocery fields in search and summary helpers. Every current shared-union consumer must narrow `delivery_dish` in Milestone 1; branches whose upstream contract cannot yet produce delivery must document and test that narrower discriminant.
- 2026-07-25: Provider terms use broad language around automated scraping and systematic retrieval, but the requested product behavior is materially narrower: the account holder delegates the same visible, signed-in order-history navigation they could perform manually. The implementation must preserve that distinction through explicit initiation, bounded windows, exact origins, no bypass, and no background crawler.
- 2026-07-26: The repository screencast helper assumes Linux X11 and PulseAudio inputs. On this macOS host, Playwright-native per-flow recordings provide deterministic, secret-free visible evidence and can be concatenated into the required fixture-only MP4 without widening permanent test configuration.

## Decision Log

- 2026-07-25: Keep delivery setup out of the mandatory grocery-then-recipe first run. The new audit skill asks for provider sites and browser authorization when the user asks to learn or use delivery history; an optional contextual offer may follow successful primary onboarding.
- 2026-07-25: Treat delivery-history collection as bounded user-directed browser assistance over the user's own account, not public-web scraping. The user selects the provider, signed-in browser, and history scope; Fullwell follows visible navigation and stops at sign-in, MFA, CAPTCHA, permission, age/identity, or unsupported UI. No unattended crawl, credential handling, access-control bypass, or provider-data service is in scope.
- 2026-07-25: Support browser-accessible provider sites through exact user-approved HTTPS origins rather than provider SDKs or server adapters. DoorDash and Uber Eats are mandatory manual release-matrix targets; another provider is advertised only after passing the same gate.
- 2026-07-25: Support provider websites on the user's Mac in version 1, not native iOS or Android apps. This matches the implemented local computer-use trust boundary and avoids undocumented mobile control.
- 2026-07-25: Add one `delivery_dish` journal item family whose structured identity always includes provider, restaurant display name, and a human-readable restaurant location label plus private provider merchant locator evidence. Do not add a separate restaurant aggregate unless Milestone 0 proves dish-level repetition cannot safely represent location identity.
- 2026-07-25: Store one immutable delivery-order-line evidence record per exact ordered line, including a private order-group key and declared complete line count. Grouping exact evidence reconstructs a prior order without introducing a second mutable order entity.
- 2026-07-25: Treat same-name restaurant locations as separate unless the agent can justify an exact semantic identity from provider locator/address evidence. Deterministic code may compare exact locators and validate counts; it does not merge locations or dishes.
- 2026-07-25: Interpret unqualified `reorder` at a uniquely resolved location as the most recent complete prior order. Interpret `usual` as a clearly recurring complete order. Ask when material historical ambiguity remains, using only actual location or order distinctions.
- 2026-07-25: Reuse the existing compatibility-profile automatic cart-add maximum and strict under-maximum rule for the complete delivery food subtotal. Do not add a second maximum until user evidence shows different grocery and delivery limits are necessary.
- 2026-07-25: Model delivery cart authority as a discriminated extension of the existing grocery cart contract. Grocery keeps its single-line target; delivery uses a bounded multi-line target with exact modifiers, baselines, quantities, provider origin, restaurant location, and subtotal.
- 2026-07-25: Never replace a different-restaurant provider cart from the initial request alone. Require a second confirmation bound to the visible existing-cart restaurant/line summary and the requested replacement.
- 2026-07-25: Publish only individual delivery dishes through collections, not complete orders. Imported dishes carry public provenance but no order evidence, recurrence, private provider locator, or automatic reorder authority.
- 2026-07-25: Add `journal_delivery_dish` as a meal source. It cites an exact item revision and bounded provenance but does not require or imply Liked evidence. Constraints remain mandatory; absent ingredient evidence remains conservative.
- 2026-07-25: Keep this plan on direct computer use in an interactive Codex or Claude session. WhatsApp-linked runner delivery is a separable future feature and receives no contracts, routing, snapshots, receipts, rollout work, or release claim here.
- 2026-07-25: Keep checkout structurally absent from every prompt, output schema, fake provider action bridge, host permission set, and acceptance test. No confirmation phrase can broaden cart authority into checkout.
- 2026-07-25: Before a connected delivery audit, explain that contributed dishes, restaurant locations, private order dates/groupings, and modifiers are visible to current household members; require explicit confirmation per provider source or keep the data local.
- 2026-07-25: Commit connected delivery history one provider source per mutation. Each provider gets its own visibility confirmation, exact origin, bounded payload, and idempotency key; a mixed-provider payload is invalid before mutation.
- 2026-07-25: Per explicit user direction, prior alcohol lines may be indexed and added under the same ambiguity and automatic cart-add maximum rules as other delivery lines because Fullwell stops before checkout. Fullwell never bypasses provider age/identity checks, handles an ID, asserts eligibility, or proceeds past the cart. Tobacco, cannabis, prescriptions, gift cards, and other non-food/regulated goods remain excluded.
- 2026-07-25: Record `delivery` versus `pickup` on every order group. Pickup history may support familiarity, collections, and meal planning, but version 1 cart preparation requires a prior delivery order and a currently visible delivery-mode cart; pickup or mode drift blocks without mutation.
- 2026-07-25: Allow a user-selected alcohol delivery item in household search, collections, and meal proposals under the same privacy, revision, and compatibility rules as another delivery item. These surfaces never assert age eligibility or product safety.
- 2026-07-25: Provider-origin revocation stops future browser control but does not rewrite canonical household Git. The pre-contribution notice must say that contributed history remains household content after source revocation or member departure. Owner-confirmed household deletion removes active canonical data under existing semantics, while encrypted backups age out under the published retention period. Version 1 promises no per-source erasure from either local or Git authority.
- 2026-07-25: Land the visual-journal narrowing with the core item union in Milestone 1. Keep the existing recipe/grocery response union unchanged and deliberately omit `delivery_dish`; do not add a placeholder delivery card. Milestones 4 and 5 add delivery-specific collection and meal-plan presentation after their full contracts exist.
- 2026-07-25: After the WU-02 adversarial gate exhausted three attempts, move the complete direct-cart session contract from Milestone 1 to Milestone 3. A safe plan needs the actual reorder skill and eval consumers so its exact source-line edits, parsed full-cart baseline, visible replacement summary, confirmation fingerprint, and retry behavior land together. Milestone 1 keeps only the stable delivery history and journal contracts.
- 2026-07-26: Milestone 6 may conclude with a documented no-go release decision. Deterministic implementation, rollback, database, image, security, accessibility, and screencast evidence can complete locally while every named provider and live alcohol sub-capability stays disabled and explicitly `unsupported` until separately authorized proof exists.

## Context and Orientation

Fullwell has two data authorities:

- `packages/agent-client/runtime/local-household.mjs` stores one bounded revisioned guest journal on the current computer.
- Connected households store canonical journal content in household Git. `apps/server/src/services/household-food-journal.ts` is the service use-case boundary, `apps/server/src/services/mutation-runner.ts` owns durable mutation/idempotency transitions, and the central service is the only Git writer.

The server has no LLM and must not automate delivery providers. Codex or Claude owns semantic food/location decisions and local browser control. Programs parse external input, enforce bounds, verify references, count exact order groups, authorize household access, and preserve idempotency; they do not classify dishes, merge same-name locations, choose a preferred restaurant, or author the delivery report.

### Existing prior art

- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md` defines complete order traversal, sign-in preflight, exact evidence, and one-pass collection.
- `packages/agent-client/skills/restock-groceries/SKILL.md` defines history-only preference resolution, genuine ambiguity questions, two-phase cart authority, price-bound confirmation, cart verification, and no checkout.
- `packages/agent-client/references/restocking-and-cart-safety.md` is the normative cart safety reference to generalize without weakening grocery behavior.
- `packages/contracts/src/domain.ts` owns evidence, journal item, report, collection, and meal-source runtime schemas.
- `packages/contracts/src/tools.ts` owns the stable MCP input schemas.
- `apps/server/src/domain/journal-validation.ts` maps item/evidence/report paths and validates meal sources.
- `apps/server/src/domain/repository-projection.ts` rebuilds canonical projections from Git.
- `packages/agent-client/skills/share-food-collection/SKILL.md`, `packages/agent-client/skills/import-food-collection/SKILL.md`, and `apps/server/src/services/household-food-journal.ts` own collection preview/import semantics.
- `packages/agent-client/skills/plan-household-meals/SKILL.md`, `packages/agent-client/references/meal-planning-and-food-constraints.md`, and the meal-planning contracts in `packages/contracts/src/domain.ts` own local/cloud proposal behavior.

### Proposed canonical delivery layout

Connected household Git gains additive paths:

```text
profiles/
  delivery.md
delivery/
  evidence/<year>/<evidence-id>.json
  items/<delivery-dish-id>.md
  reports/delivery-index.md
```

`profiles/delivery.md` is agent-authored Markdown with bounded structured settings for approved provider labels/origins, audit window, completed provider cursors, and user-confirmed interpretation preferences. It never contains credentials, cookies, delivery destinations, account identifiers, or browser state.

A delivery order-line evidence record contains:

- exact provider display label and approved origin;
- private provider order reference and stable order-group key;
- order date, `delivery | pickup` fulfillment mode, and completeness declaration;
- restaurant display name;
- restaurant location label and bounded public address fields visible on the merchant page;
- private provider merchant locator;
- exact ordered dish title, quantity, and ordered modifiers;
- evidence limitations and actor attribution.

The order-group key is private and deterministic from the evidence source; it is not a public order ID and is never exposed through search summaries, collections, logs, metrics, or meal plans. A complete order is reconstructable only when all line records in that group agree on provider, location, date, fulfillment mode, and declared line count. Pickup groups remain familiarity evidence but are not delivery-cart candidates in version 1.

A `delivery_dish` item contains the dish identity and the restaurant-location distinctions needed for safe search:

- display name;
- provider label;
- restaurant display name;
- restaurant location label;
- bounded public address fields when available;
- private provider merchant locator;
- exact menu-item locator when safely observed;
- known ordered modifier sets as evidence-backed occurrences;
- image/page provenance when available;
- evidence IDs and agent-authored identity reasoning.

Package size is not a delivery identity rule. Codex or Claude decides whether a provider menu rename, modifier change, or location alias represents the same dish. The server validates only the submitted structured shape and evidence references.

### User-visible state machine

The direct computer-use request follows these states:

```text
load authority
  -> resolve provider
  -> resolve historical restaurant location
  -> resolve complete prior order
  -> apply requested line edits
  -> inspect current menu and prices
  -> inspect provider cart
  -> needs input | ready to act | blocked | cancelled
  -> revalidate authority and current UI
  -> prepare exact lines
  -> verify every target
  -> completed
```

The most important ambiguity order is location before order:

- the same restaurant/location appears in more than one authorized provider and the request names neither: ask which provider before resolving location or touching a cart;
- one historical Wanpo location: proceed;
- Wanpo at Stanford and Wanpo at Cupertino with no location qualifier: ask which location;
- `Wanpo in Stanford` uniquely matches one recorded location: proceed;
- two complete materially different orders at that location and no clear `most recent`/`usual` interpretation: ask with bounded dish summaries;
- requested replacement names multiple current menu items: ask which exact item;
- provider search shows a location absent from history: it may establish current availability only and cannot silently become the historical selection.
- the selected historical group is pickup, or the current provider cart is pickup/unverifiable: block before mutation rather than silently changing fulfillment mode.

### Household, collections, and meal planning

Owners and editors can add delivery evidence/items through the normal household mutation pipeline. Viewers can read/search. Each member authorizes only their own signed-in provider session, and every evidence record retains the authenticated actor in connected mode.

Before the first connected audit or local-to-cloud promotion of each provider source, Fullwell explains that the resulting dish, restaurant-location, private order date/grouping, fulfillment mode, and modifier evidence becomes readable by current household members. The notice also says that revoking browser access or later leaving the household does not selectively erase contributed Git history, version 1 has no per-source erase, and household-deletion backups expire under the published retention period. The member must explicitly confirm that source. Declining keeps the audit local or skips the source; it never uploads first and asks later.

A ready local journal is promoted as a sequence of delivery-specific, provider-scoped commits. Before each call, reconcile that provider's evidence and dishes plus the aggregate delivery profile/report against current cloud state and show an exact provider-specific copy/merge preview. Each call is all-or-nothing for one provider and has its own stable promotion key. Earlier successful providers remain committed if a later provider fails; the failed provider remains locally authoritative and resumable. This does not widen the two-section first-run onboarding contract.

Collection snapshots add `delivery_dish` with an allowlisted public projection: dish title, restaurant display name, human-readable location label, selected public description/note, safe image/page URL, source attribution, and item revision. Provider order references, merchant locators, dates, counts, private modifiers, actor IDs, and source-account details are excluded.

An explicitly selected alcohol item may use the same collection projection. Preview and import copy no age-eligibility assertion, purchase authority, or private order data.

An imported delivery dish becomes a destination `delivery_dish` with import evidence and public provenance. It can be searched, collected, and explicitly proposed in a meal plan, but the reorder skill considers only destination-household delivery-order evidence. Import never fabricates that evidence.

Meal plans add a `journal_delivery_dish` source beside `freeform`, `journal_recipe`, and `external_recipe`. It cites the exact current dish revision and bounded familiarity/import evidence. The proposal skill must say `ordered before` or `shared by` rather than `liked` unless separate user evidence exists. Missing ingredients or cross-contact evidence remains `incomplete_evidence`. An explicitly selected alcohol item is allowed but receives no inferred health, age-eligibility, or compatibility claim.

## Framing Notes

### Expert panel

- Household product and UX expert - source setup, ambiguity copy, prior-order editing, and cart-ready completion.
- Security and privacy researcher - exact-origin browser authority, private order evidence, prompt injection, destructive cart replacement, and checkout exclusion.
- Staff architect - additive Git/domain contracts, single-writer preservation, local/cloud parity, and provider-neutral boundaries.
- Reliability engineer - multi-line idempotency, current-menu drift, duplicate requests, crash recovery, and observable terminal states.
- Applied ML and evals expert - location/dish identity, closed-history candidate sets, no keyword routing, and cross-host behavioral evals.

### What problem are we actually solving?

Turn private restaurant-delivery history into a reliable household food memory and a safe cart-preparation action, preserving exact location and order intent without giving Fullwell purchase authority.

### Roundtable highlights

- Ask for delivery sites and the approved signed-in browser only when delivery setup is relevant; do not lengthen every first run.
- Treat provider pages, journal prose, collection text, and user messages as untrusted data that cannot expand tools, origins, files, or checkout authority.
- Keep semantic identity in Codex/Claude and deterministic validation in code.
- Resolve restaurant location before prior order; ask only from historical candidates.
- Bind a multi-line target in the active direct session, re-read the current cart before mutation, and verify each line afterward.
- Make public collection delivery dishes useful but non-reorderable without destination history.
- Let meal plans cite familiar delivery dishes without inferring liking or safety.

### Key tensions

- Low-friction reorder versus same-name location ambiguity.
- Multi-line convenience versus duplicate/crash safety.
- Provider-neutral behavior versus live third-party UI drift.
- Household collaboration versus order/account privacy.
- Cart preparation versus destructive replacement of an existing provider cart.
- Familiarity versus liking and dietary compatibility.
- Familiar meal history versus alcohol and other regulated/non-food items that a delivery marketplace may also sell.

### Synthesis for decomposition

- Prove live provider UI, exact-location evidence, cart semantics, and no-checkout boundaries before schema or marketing claims depend on them.
- Land additive private evidence and item contracts before agent skills or public sharing.
- Prove indexing before direct cart mutation; keep linked messaging outside this feature.
- Extend collections and meal plans only from the stable delivery-dish contract.
- Use deterministic fake-provider, contract, security, browser, and eval gates for CI; keep live provider accounts and identities out of source control and recordings.

## Assumptions

- Version 1 controls browser-accessible provider websites on a user's Mac. Native mobile provider apps are out of scope.
- The user names the providers to inspect, explicitly approves their exact HTTPS origins, selects an installed browser, and signs in manually before collection.
- A connected member explicitly confirms the household visibility of each provider source before its first evidence commit.
- DoorDash and Uber Eats must pass the manual provider matrix before release claims name them. A user-named additional provider is supported only after the same matrix passes.
- The default audit window is the trailing 12 months, matching grocery history. The user may choose a different bounded window.
- Only delivered/completed orders with fully exposed line and modifier details can support a complete reorder. Cancelled, refunded-only, hidden, or partial orders remain evidence with limitations and cannot be silently replayed as complete.
- Record pickup orders as familiarity evidence, but require a complete historical delivery group and a visibly current delivery-mode cart for version 1 cart preparation.
- Restaurant location labels use merchant-side public location/address information, never the user's delivery destination.
- A direct local guest can index and prepare carts. Household collaboration and public collection sharing require the explicit delivery promotion commit defined by this plan.
- The existing automatic cart-add maximum remains one household cart-safety setting in the compatibility snacks profile.
- Provider menus and carts may change without notice. Any provider whose UI cannot prove exact lines, quantities, modifiers, and final cart state remains index-only or unsupported for mutation.
- Alcohol is supported from evidence-backed history under the normal cart-maximum rules; provider-enforced age/identity steps remain user-controlled. Other regulated/non-food items are out of scope even when they appear in history or a cart.
- Browser-origin revocation prevents future inspection and cart work but does not remove already contributed household history. Member removal and account removal follow existing household ownership/retention rules. Owner-confirmed household deletion removes active canonical data; encrypted backups retain it only for the period disclosed in `docs/legal/privacy.md`.
- Live provider validation uses only an explicitly authorized account and never records credentials, address, payment, private order IDs, or authentication screens.

## Interfaces and Dependencies

### Shared domain and tools

Modify `packages/contracts/src/domain.ts`, `packages/contracts/src/ids.ts`, `packages/contracts/src/tools.ts`, `packages/contracts/src/http.ts`, `packages/contracts/src/index.ts`, and `packages/contracts/src/contracts.test.ts`.

Add:

- `DeliveryOrderLineEvidenceSchema` as a new `delivery_order_line` evidence kind;
- `DeliveryDishItemSchema` and `delivery_dish` in `JournalItemKindSchema`;
- `delivery_index` in `ReportSchema`;
- collection item/snapshot fields for delivery dish, restaurant, and public location;
- `journal_delivery_dish` cloud/local meal-source variants with authority-matching item revisions;
- provider-origin, `delivery | pickup` fulfillment-mode, restaurant-location, and complete delivery-order-group schemas for history and journal boundary validation;
- one strict connected delivery-history mutation contract with `connected_audit_checkpoint | local_promotion` modes that authorizes exactly one changed provider origin per call, writes history-derived delivery profile/order-line evidence/items/report content, and requires literal source-visibility confirmation for that provider. Complete next profile/report documents may retain other providers only when those sections exactly match their expected current revisions; changing two providers in one call is invalid;
- bounded authenticated `hfj_search_delivery_history`, `hfj_get_delivery_order`, and `hfj_get_delivery_index` inputs/outputs so a connected session can enumerate real provider/location/order candidates, read one exact evidence-backed group, and reconcile the current report without loading an unbounded household journal;
- `delivery` in profile reads and in the dedicated delivery mutation, while generic profile writes remain closed to pre-delivery profiles;
- strict runtime bounds for providers, orders, lines, modifiers, locator lengths, and promotion size. Milestone 3 adds the direct-session cart plan bounds with the reorder consumers.

Do not add an enum that limits providers to current brands. Parse a bounded user-visible label plus an exact approved HTTPS origin. Provider-specific behavior belongs in agent instructions and release evidence, not server domain logic.

### Repository, services, and projections

Modify `apps/server/src/domain/journal-validation.ts`, `apps/server/src/domain/journal-validation.test.ts`, `apps/server/src/domain/repository-projection.ts`, `apps/server/src/domain/repository-projection.test.ts`, `apps/server/src/services/household-food-journal.ts`, and `apps/server/src/services/household-food-journal.test.ts`.

The service must:

- map delivery evidence to `delivery/evidence/`;
- map delivery dishes to `delivery/items/`;
- map the delivery report to `delivery/reports/delivery-index.md`;
- map the delivery profile to `profiles/delivery.md`;
- search delivery dishes by dish, restaurant, location label, provider label, and safe address fields;
- return location distinctions without returning order references or merchant locators in summaries;
- validate delivery report assertions against exact cited evidence and complete order groups;
- rebuild delivery items/evidence/profile/report from Git;
- preserve normal expected-HEAD, evidence, one-commit, audit, projection, and idempotency behavior;
- validate `journal_delivery_dish` meal sources against current revisions and referenced evidence.
- search delivery history from the authorized household evidence projection with deterministic public/provider/location fields, opaque order-group references, completeness, and fulfillment mode;
- return one exact bounded order group only after validating every projected evidence line agrees on provider, location, mode, group, declared count, and current repository HEAD;
- return the one current delivery-index report and Git revision from canonical Git for explicit reconciliation, without projecting report prose into Neon;
- never return another household's group, an unbounded evidence dump, credentials, delivery destinations, or payment/account state.

Delivery reports remain canonical Git documents and are not added to the operational projection merely for cart resolution. The two history reads use the existing rebuildable evidence projection, while the report read resolves its one allowlisted canonical path; promotion reconciliation combines these bounded reads with normal item/profile reads.

Add reversible `migrations/0008_delivery_search_projection.sql` and `migrations/0008_delivery_search_projection.down.sql`. The forward migration replaces the `search_items.kind` constraint with every currently supported journal kind plus `delivery_dish`. Because search rows are rebuildable, rollback deletes delivery projection rows before restoring the prior compatible constraint and never deletes Git content.

### Local guest runtime

Modify `packages/agent-client/runtime/local-household.mjs`, `packages/agent-client/runtime/local-household-mcp.mjs`, `packages/agent-client/tests/packaging/local-household.test.mjs`, and `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`.

The existing revisioned generic save remains the delivery audit write boundary. Extend validation for delivery evidence/items/profile/report and add local `journal_delivery_dish` proposal validation. Do not let generic save rewrite purpose-specific meal-planning state. Preserve older local delivery data byte-for-byte across unrelated supported operations.

Store one stable delivery-promotion idempotency key per provider-specific reconciled local promotion payload. Add a revision-checked operation that records the returned cloud user, household, provider source, and repository HEAD only after that provider's `hfj_commit_delivery_index` call succeeds. An uncertain or rejected promotion retains the exact local authority and key for safe retry without blocking already committed providers.

### Agent skills and references

Create:

- `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`;
- `packages/agent-client/skills/reorder-food-delivery/SKILL.md`;
- `packages/agent-client/references/food-delivery-and-cart-safety.md`.

Modify:

- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`;
- `packages/agent-client/skills/share-food-collection/SKILL.md`;
- `packages/agent-client/skills/import-food-collection/SKILL.md`;
- `packages/agent-client/skills/plan-household-meals/SKILL.md`;
- `packages/agent-client/references/privacy-and-sharing.md`;
- `packages/agent-client/references/semantic-food-rules.md`;
- `packages/agent-client/references/meal-planning-and-food-constraints.md`;
- `packages/agent-client/scripts/validate-package.mjs`;
- `packages/agent-client/evals/cases/v1.json`;
- `packages/agent-client/evals/expected/v1.json`;
- `packages/agent-client/tests/evals/matrix.test.mjs`;
- `packages/agent-client/README.md`;
- `packages/agent-client/CHANGELOG.md`.

The delivery audit and reorder skills share voice, identity, privacy, semantic-food, MCP, and cart-safety references with both hosts. Keep each skill below 500 lines and ship identical content to Codex and Claude.

### Direct computer use

The two delivery skills run only in an interactive Codex or Claude session with the installed browser/computer-use capability. They request each exact HTTPS provider origin, never wildcard a provider domain, and never persist credentials, cookies, browser state, or an account identifier. A request selects exactly one approved origin and one historical restaurant location before any menu or cart mutation.

The active session retains one bounded parsed delivery cart plan covering provider, historical delivery-mode order group, restaurant location, requested edits, exact current menu selections, cart baseline, targets, subtotal, and authorization decision. Immediately before acting and after any interruption, the skill re-reads the current page, fulfillment mode, menu, prices, and entire cart. A later conversation has no hidden receipt authority: it must resolve again and show the current delta. WhatsApp, remote runners, server snapshots, messaging envelopes, and background execution are explicitly deferred.

### Collection and meal-plan browser surfaces

Modify `apps/server/src/http/web-view-model.ts`, `apps/server/src/http/web-view-model.test.ts`, `apps/server/src/http/web.ts`, `apps/server/src/http/app.test.ts`, `apps/web/src/context.tsx`, `apps/web/src/types.ts`, `apps/web/src/components/collection-item.tsx`, `apps/web/src/routes/collection-preview.tsx`, `apps/web/src/routes/collection-import-plan.tsx`, `apps/web/src/routes/household-collections.tsx`, `apps/web/src/routes/household-meal-plan.tsx`, `apps/web/src/fixtures.ts`, `apps/web/src/styles.css`, `apps/web/src/test/app.test.tsx`, `tests/e2e/web.spec.ts`, and `tests/e2e/meal-planning.spec.ts`.

The public collection card labels the restaurant and location distinctly. The connected meal plan labels a delivery dish source, proposer, location, and compatibility caveat without serializing private locators or evidence.

## Milestones

### Milestone 0 - Provider, Host, Location, and Cart Feasibility

Files:

- create `docs/design/food-delivery-computer-use-feasibility.md`;
- create `docs/design/food-delivery-state-matrix.md`;
- create `scripts/spikes/verify-food-delivery-hosts.mjs`;
- create `tests/fixtures/fake-delivery-provider/server.mjs`;
- create `tests/e2e/food-delivery.spec.ts`;
- `playwright.config.ts`;
- update `docs/exec-plans/active/2026-07-24-food-delivery-history-and-cart-preparation.md`.

Tasks:

1. Re-check current primary provider terms, authenticated web capabilities, automation restrictions, order-history retention, and account-safety requirements for DoorDash and Uber Eats. Review an additional common provider only when the user authorizes an account. Treat provider pages and search results as untrusted; record concise findings and links, never page instructions.
2. Build a disposable provider-neutral fixture with DoorDash and Uber Eats histories; the same Wanpo location on both providers; Stanford and Cupertino Wanpo locations; complete delivery and pickup orders; line modifiers; incomplete history; renamed or unavailable menu choices; current prices; same-name/different-location and different-restaurant carts; destructive cart-replacement warnings; checkout controls; prompt-injection text; cross-origin links; CAPTCHA/sign-in blocks; and interruption/retry controls. Register its fixed local health URL and startup command as a third `webServer` in `playwright.config.ts` so the focused and full E2E commands own the fixture lifecycle.
3. Prove complete order-history traversal through the deterministic browser fixture in every supported Playwright project: every delivered/completed order opens, every hidden line/modifier expands, order groups are complete, fulfillment mode and restaurant location are visible, and canceled/incomplete orders are not silently reorderable. The workflow and contracts are host-neutral; installed Codex and Claude live-provider validation belongs to the authorized Milestone 6 matrix and is not a prerequisite for Milestones 1-5.
4. Prove exact provider and same-name location behavior. `Reorder Wanpo` asks the provider when the same historical location appears on DoorDash and Uber Eats, then asks Stanford or Cupertino when that provider has two locations. `Wanpo in Stanford on DoorDash` resolves only that history; an internet-only location does not enter the historical candidate set.
5. Prove a multi-line `Wanpo in Stanford` reorder with one explicit coconut-to-wintermelon change. Resolve only, inspect current menu and cart, then prepare and verify the fixture cart without touching checkout.
6. Prove existing-cart and fulfillment behavior. A same-location cart preserves unrelated lines. A same-name but different-location cart is a different restaurant and blocks until a second exact replacement confirmation, as does another restaurant. A pickup historical group or currently selected pickup/unverifiable mode blocks before mutation. Cancellation changes nothing.
7. Prove duplicate, timeout, and interruption recovery for every line: before mutation, after one line, after all lines, before verification, and after verification. Within the active session, recovery may add only the missing delta from the bound plan. After host/session loss, a new request must resolve and re-read the full cart before acting; it never blindly replays clicks, exceeds requested targets, or removes an unrelated line.
8. Prove the shared host policy boundary can authorize a bounded exact-origin list and reject cross-origin redirects, embedded provider instructions, shell/search/tool broadening, checkout, and payment before a browser action. Deterministic policy adapters prove the invariant without pretending to be installed-host evidence; Milestone 6 exercises actual Codex and Claude hosts.
9. Define the authorized live validation procedure for DoorDash and Uber Eats. Running it requires an account holder's explicit request and signed-in browser, records only redacted capability evidence, and never captures authentication, delivery address, payment, order identifiers, or private dish history. The procedure runs in Milestone 6, not as a gate on provider-neutral implementation.
10. Freeze support labels as `index_and_cart`, `index_only`, or `unsupported`. Do not advertise live cart support for a provider until exact line/modifier verification and no-checkout behavior pass.

Verification:

- `node scripts/spikes/verify-food-delivery-hosts.mjs --fake-provider`
- `npm run test:e2e -- tests/e2e/food-delivery.spec.ts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run verify:docs`
- `npm run verify:execplan`
- authorized live DoorDash and Uber Eats evidence remains a Milestone 6 release gate

Exit criteria:

- DoorDash and Uber Eats each have an explicit support classification, with missing live evidence represented truthfully as `unsupported` rather than an implementation prohibition;
- the deterministic browser matrix traverses fake history, distinguishes same-name locations, prepares the exact multi-line cart, recovers idempotently, and stops before checkout;
- the shared host-policy harness rejects origin and authority broadening without claiming installed-host evidence;
- no unresolved provider/cart behavior can invalidate the proposed evidence shape or action state machine;
- unsupported provider UI fails closed without weakening origin or checkout policy.

If either mandatory provider cannot expose complete history or verifiable cart state, keep it `index_only` or `unsupported` and narrow release copy. If neither mandatory provider supports safe cart preparation, stop after delivery indexing, collections, and meal planning; do not ship a reorder promise.

### Milestone 1 - Contracts, Git Layout, Projection Persistence, and Normative Docs

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/http.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/contracts.test.ts`
- create `migrations/0008_delivery_search_projection.sql`
- create `migrations/0008_delivery_search_projection.down.sql`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/journal-validation.test.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/types.ts`
- `apps/web/src/test/app.test.tsx`
- create `tests/security/food-delivery.test.ts`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/legal/privacy.md`
- `docs/QUALITY_LEDGER.md`
- `CHANGELOG.md`

Tasks:

1. Add strict runtime schemas and semantic types for delivery order-line evidence, complete delivery order groups, delivery dishes, delivery reports, delivery profile selection, provider origins, opaque provider locators, and fulfillment mode. Collection and meal-source variants land with their complete consumers in Milestones 4 and 5; the externally registered delivery tool schemas land atomically with their consumers in Milestone 2; direct-cart session schemas land atomically with their consumers in Milestone 3.
2. Make invalid provider, location, and historical order-group states unrepresentable where practical. Require one exact credential-free HTTPS provider origin, one exact restaurant location, one normalized qualifying-complete status, one `delivery | pickup` mode per complete group, at least one line, declared-count agreement, unique evidence IDs and line keys, complete modifiers, positive quantities, and opaque locators that are never silently normalized.
3. Add path mapping and append-only validation for delivery evidence. Keep items/profile/report mutable with expected revisions and signed Git history.
4. Rebuild delivery evidence/items/profiles from Git into the existing operational projection and leave delivery reports as canonical Git documents. Extend `HouseholdProjection`, its Neon serialization, and reconciliation tests in the same milestone. A malformed line group, conflicting declared line count, duplicate evidence ID, path mismatch, or unsupported schema quarantines/fails closed.
5. Add reversible search-projection migration for all current item kinds plus delivery. Prove up/down/up and projection rebuild; down removes only rebuildable delivery search rows.
6. Update both normative product specs with provider setup, fulfillment mode, source authorization and retention notice, bounded connected-history reads, local promotion, location identity, household contribution, ambiguity, collections, imports, meal plans, direct cart preparation, price maximum, existing-cart replacement, terminal states, and structural no-checkout behavior.
7. Update architecture, security, reliability, legal privacy, quality, and changelog documents for the new private evidence paths, browser origins, prompt-injection boundary, uncertain direct multi-line recovery, public projection, provider compatibility gate, no per-source erasure, and encrypted-backup retention after household deletion.
8. Define a backward-compatible reader/rollback contract: older server images ignore and preserve additive delivery Git paths, older clients do not overwrite unknown local delivery data, and no format bump occurs unless tests disprove that assumption.
9. Replace the visual journal's `non-recipe means grocery` fallback with an exhaustive semantic narrowing in the same change that adds `delivery_dish`. Preserve the existing recipe and grocery response schemas: recipe items render on recipe pages, the four grocery kinds render on grocery pages, and delivery dishes are deliberately omitted from both legacy sections until Milestones 4 and 5 add purpose-specific presentation. Add server and web regression tests proving a projected delivery dish neither crashes nor affects recipe/grocery totals or pagination, never reads grocery-only fields, never serializes private delivery fields, and leaves existing recipe/grocery rendering unchanged.
10. Audit every current `JournalItem` consumer that treats `non-recipe` as grocery, including `searchItems`, `itemTitle`, `itemSummary`, repository path mapping, household counts, and visual-journal filtering/sorting. Replace each with an exhaustive kind switch or a tested upstream discriminant that cannot yet admit delivery. `hfj_search_items` returns a safe delivery title plus provider/restaurant/public-location distinctions without grocery-only field access; existing recipe/grocery summaries remain byte-compatible.
11. Prevent the expanded domain unions from widening legacy write authority. Define explicit non-delivery evidence/item/report schemas for `hfj_append_evidence`, `hfj_commit_change_set`, and `hfj_commit_onboarding`, and keep `hfj_update_profile` limited to its pre-delivery profiles. Connected private delivery history - the delivery profile, `delivery_order_line` evidence, history-backed delivery dishes, and delivery report - may be written only through the dedicated Milestone 2 mutation with literal per-provider source-visibility confirmation. Milestone 4 may later extend only the collection-import mutation to create a public-provenance delivery dish plus `import` evidence, never private delivery history. Add contract/service tests proving other delivery and mixed payloads fail before mutation, create no Git paths/projections, and cannot bypass consent.
12. Keep collection import closed to its current recipe/snack contract until Milestone 4. Require merge destinations to match the selected source kind and reject `delivery_dish` destinations before mutation; test that a recipe/snack import cannot spread onto or mutate a delivery item. Meal-source branches likewise remain guarded by their current source discriminants until Milestone 5 expands them.

Verification:

- `npm run build --workspace @hfj/contracts`
- `npm run test --workspace @hfj/contracts`
- `npm run test:app -- apps/server/src/domain`
- `npm run test:app -- apps/server/src/services/household-food-journal.test.ts`
- `npm run test:app -- apps/server/src/http/web-view-model.test.ts`
- `npm run test --workspace @hfj/web`
- `npm run test:migrations`
- `npm run container:postgres:verify`
- `npm run test:security`
- `npm run verify:docs`
- `npm run verify:execplan`

Exit criteria:

- local client, server, promotion service, and tests compile against one core delivery contract;
- every current shared `JournalItem` consumer exhaustively narrows the expanded union; delivery search is safe, and the existing visual journal preserves recipe/grocery behavior without leaking or misclassifying a delivery dish;
- first-run onboarding remains a closed grocery/recipe boundary and rejects every delivery variant without side effects;
- generic evidence/change-set/profile writes and legacy collection imports cannot create or mutate delivery state;
- canonical paths and public/private fields are explicit;
- migration up/down/up loses no canonical Git data;
- docs describe the same authority, ambiguity, cart, sharing, planning, and no-checkout boundaries.

### Milestone 2 - Delivery Audit, Location-Aware Index, and Household Contribution

Files:

- create `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`
- create `packages/agent-client/references/food-delivery-and-cart-safety.md`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/semantic-food-rules.md`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/http.ts`
- `packages/contracts/src/contracts.test.ts`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`
- `tests/security/food-delivery.test.ts`
- `packages/agent-client/README.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Trigger on requests to learn, index, refresh, search, or compare food-delivery history. Ask which delivery sites the user uses and which installed signed-in browser may be controlled. Offer DoorDash, Uber Eats, Grubhub, or a user-named browser-accessible provider as examples, not an exhaustive enum.
2. Verify every selected provider is signed in before collecting any. A sign-in, MFA, CAPTCHA, permission, or unsupported-origin block returns one user action and stores no partial raw page.
3. Before a connected audit or promotion, explain the exact household visibility and retention behavior for each provider source: version 1 has no per-source erase; contributed order details remain household Git content after browser-origin revocation or member departure; household deletion removes active canonical data while encrypted backups age out under the published period. A decline keeps that provider local or skipped and makes no hosted write.
4. Traverse the bounded time window. Treat listing cards as discovery only; open every qualifying order, expand every item/modifier control, record `delivery | pickup`, and verify a complete line count. Save a cursor and typed evidence after each complete order so a long audit can resume safely.
5. Exclude canceled/failed orders from complete reorder candidates. Preserve refunds, missing modifiers, hidden items, and other limitations without claiming completeness.
6. Preserve alcohol lines as delivery items when the user authorized that provider history. Apply the same evidence, ambiguity, and automatic cart-add maximum rules as other delivery lines. Exclude tobacco, cannabis, prescriptions, gift cards, and other non-food/regulated goods from delivery-dish conclusions and reorder candidates; preserve only a bounded limitation that the complete order contained excluded lines.
7. Let the agent decide restaurant-location and dish identity. Always keep different exact provider merchant locators/addresses separate until evidence justifies a merge. Preserve user-supplied aliases such as `Stanford` with provenance.
8. Author one delivery dish per supported semantic identity and a delivery index grouped by provider and distinct restaurant location. Record exact complete prior-order summaries and fulfillment mode privately and cite all rows. Pickup groups may establish familiarity but are marked non-actionable for a delivery reorder.
9. In local mode, use revision-checked full-journal saves after each order and final index update. In cloud mode, checkpoint each complete order and final index through the dedicated delivery mutation at current HEAD with literal source-visibility confirmation for that provider. A connected member contributes under their authenticated actor; no shared provider credential exists, and generic evidence/change-set/profile tools never write connected private delivery-history state.
10. When a ready local user chooses collaboration, use the bounded connected-history and delivery-index reads plus normal item/profile reads to reconcile each selected provider source against the cloud household. For each provider separately, show the exact copy/merge and retention preview, obtain that provider's visibility confirmation, and call `hfj_commit_delivery_index` with one authorized origin, that provider's new/changed evidence and items, complete expected/next aggregate profile and report revisions, and that source's stable promotion key. The server validates that every other provider section and citation is unchanged; it never authors or semantically merges report prose. A change to more than the authorized provider rejects before mutation. Record that provider's returned cloud linkage locally only after success, then continue to the next approved provider. Retry an unchanged uncertain provider payload with the same key; on conflict, reread, reconcile, and reconfirm only that provider.
11. Search results expose dish, restaurant, location, provider label, and revision but not order/group references, private locators, counts, dates, fulfillment mode, or account fields.
12. Revoking an approved provider origin blocks later audit/cart access but preserves contributed journal evidence. Removing a member preserves already attributed household content. Account removal follows existing ownership/final-owner behavior and never silently deletes shared history; owner-confirmed household deletion removes the active repository and rebuildable projections while encrypted backups follow `docs/legal/privacy.md`.
13. In one atomic work unit, define and register `hfj_search_delivery_history`, `hfj_get_delivery_order`, `hfj_get_delivery_index`, and `hfj_commit_delivery_index`; implement service dispatch, HTTP/MCP discovery, mutation serialization, projection/reconciliation recovery, the MCP reference, required-tool validator, packaging tests, and the audit and household-management skills that use them. The three reads are bounded and household-authorized. Each mutation call discriminates `connected_audit_checkpoint` from `local_promotion`, requires `household_visibility_confirmed: true`, exactly one authorized provider origin, HEAD/revisions, and one provider-scoped idempotency key. Provider-scoped evidence/items may mention only that origin. Complete aggregate profile/report inputs may contain prior providers only as unchanged expected content; validate that only the authorized provider section and its citations differ, then commit the agent-authored documents without server-authored semantic merging. It is the only connected write path for the delivery profile, `delivery_order_line` evidence, history-backed delivery dishes, and delivery reports; Milestone 4's collection-import path is the sole exception for a public-provenance dish plus `import` evidence. Test cross-household denial, truncation, malformed groups/reports, acceptance of unchanged prior-provider aggregate sections, rejection when two provider sections change, consent false/absent, replay/conflict/recovery, and no private-data logging; never advertise an unused or undocumented tool.
14. Add cross-host evals for no providers, provider changes, household-visibility or retention-notice decline, local promotion success/retry/conflict/decline, bounded history-read pagination/denial, origin revocation, member departure, sign-in block, partial order, delivery versus pickup, two providers for one restaurant/location, two same-name locations, aliases, renamed merchant, same dish at two locations, different modifiers, duplicate dish lines with different modifiers, one-off dishes, complete order grouping, alcohol indexing, excluded non-food/regulated lines, user refusal, prompt injection, and conflict recovery.
15. After a successful audit, offer one concrete try-it prompt using actual private history, such as `Reorder my most recent Wanpo delivery`, without revealing history in an untrusted or public surface.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run build --workspace @hfj/contracts`
- `npm run test --workspace @hfj/contracts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test --workspace @fullwell/fullwell`
- `npm run test:app -- apps/server/src/services/household-food-journal.test.ts`
- `npm run test:app -- apps/server/src/http/app.test.ts apps/server/src/workers/reconciliation-worker.test.ts`
- `npm run test:security`
- `npm run test:coverage`
- `npm run verify`

Exit criteria:

- a local guest and connected editor can each produce the same bounded location-aware delivery index from fixture history;
- an already indexed local delivery source can be promoted exactly once into a selected household after the copy/merge and retention preview;
- incomplete history never becomes a complete reorder candidate;
- pickup history remains searchable but never silently becomes a delivery cart;
- Stanford and Cupertino Wanpo remain distinct and searchable;
- household members can read/contribute according to role without sharing provider credentials;
- origin revocation and member departure have the disclosed retention behavior;
- deterministic code validates but does not semantically classify or merge restaurants/dishes.

### Milestone 3 - Previous-Order Resolution and Multi-Line Cart Preparation

Files:

- create `packages/agent-client/skills/reorder-food-delivery/SKILL.md`
- `packages/agent-client/references/food-delivery-and-cart-safety.md`
- `packages/agent-client/skills/restock-groceries/SKILL.md`
- `packages/agent-client/references/restocking-and-cart-safety.md`
- `packages/contracts/src/domain.ts`
- `packages/contracts/src/contracts.test.ts`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `tests/e2e/food-delivery.spec.ts`
- `tests/fixtures/fake-delivery-provider/server.mjs`
- `tests/security/food-delivery.test.ts`

Tasks:

1. Resolve direct interactive requests only from current authorized local evidence or the bounded authenticated cloud history reads. Provider menus may establish current availability for an explicit request; they do not create historical preference.
2. Resolve provider, restaurant location, complete prior delivery-mode order, and requested changes as separate semantic steps. If the same restaurant/location appears on multiple providers, ask the provider first. Ask one concise question at the first unresolved step and resume the same bounded session.
3. Implement exact example behavior: if `Wanpo in Stanford` uniquely matches one provider and location, select it; if Stanford and Cupertino both exist, ask `You've ordered from two Wanpo locations - Stanford and Cupertino. Which one?`; if one location appears on DoorDash and Uber Eats, ask which provider; verify coconut exists in the selected order before offering exact current wintermelon choices.
4. Interpret `reorder` as the most recent complete order and `usual` as a clear recurring complete composition. If multiple plausible compositions remain, show compact line summaries without order numbers, dates beyond a useful relative label, or private locators.
5. Define the strict runtime schemas and semantic types for one bounded active-session multi-line plan in `packages/contracts/src/domain.ts` with exhaustive contract tests. The plan binds one complete historical delivery order; an exact source-line-to-authorized-edit mapping for retain, remove, replace, and quantity change; exact current menu locators/modifiers; a parsed full-cart baseline and visible existing-cart summary; per-line baseline/target quantities; provider origin and merchant/location identity; food subtotal, currency, automatic maximum, and price decision; the current journal authority; and structured resolving, needs-input, action-uncertain, blocked, cancelled, and cart-prepared states. No cart-prepared state can represent checkout, payment, order placement, address, tip, schedule, membership, or subscription activity.
6. Require exact confirmation for a subtotal equal to or above the maximum, a higher changed subtotal, or a different-restaurant cart replacement. Bind confirmation to provider, location, exact lines/modifiers/quantities, amount, and visible cart replacement summary.
7. Immediately before acting and after any interruption, revalidate the current journal revision/HEAD and exact origin authorization, then re-read restaurant locator, visible fulfillment mode, menu lines, modifiers, prices, and the entire cart. Pickup or unverifiable mode blocks.
8. Add only the missing requested quantities from the bound active-session plan. A target already present is verified without mutation. Unexpected quantities, modifiers, extra requested-line variants, provider cart drift, unavailable items, closed restaurant, delivery-area mismatch, sign-in, CAPTCHA, or unknown result blocks.
9. Treat a same-name cart from a different provider merchant locator/location as a different restaurant. Never remove an unrelated same-location line. Never clear that cart or another restaurant's cart without the bound replacement confirmation.
10. Apply the normal subtotal and automatic-maximum decision to alcohol lines. If the provider requests age or identity verification, block for the user to complete it directly and re-resolve afterward; never view, capture, type, store, or relay identity-document data. If the order contains another regulated/non-food line, return `needs_input` offering only `continue without the excluded line` or `cancel`.
11. Never accept checkout, tip, address, schedule, payment, membership, subscription, or promotional upsell controls.
12. Report `completed`, `needs_input`, `blocked`, or `cancelled`. Completion names provider, restaurant location, exact prepared lines, displayed food subtotal, and `I stopped before checkout; please review the cart and place the order yourself.`
13. On a later duplicate request or host/session loss, discard any remembered action authority, resolve from current evidence, re-read the entire cart, and show the proposed delta. An already matching cart completes without mutation; uncertainty blocks rather than replaying clicks.
14. Test provider-page, journal, menu, collection, and product-description prompt injection. None may broaden origins, tools, files, household access, requested lines, alcohol handling, regulated-item authority, or checkout authority.
15. Add fake-provider cross-host evals and E2E cases for an alcohol line below, equal to, and above the automatic maximum; increased replacement price; provider age/identity interstitial; user-completed interstitial followed by full re-resolution; and verification that no identity data or checkout action enters a prompt, plan, log, fixture receipt, or completion result.
16. Add `reorder-food-delivery` to the package validator's required skill set and packaging assertions in the same change that creates the skill. Milestone 2 registers only the audit skill; Milestone 3 must prove the newly discovered skill-directory set, manifest, references, and eval cases are complete before its packaging gate can pass.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:contract`
- `npm run test:security`
- `npm run test:e2e -- tests/e2e/food-delivery.spec.ts`
- `npm run test:coverage`
- `npm run verify`

Exit criteria:

- the Wanpo Stanford edit produces the exact fake-provider target and no Cupertino line;
- unresolved provider or same-name location choices produce the required question and no cart mutation;
- pickup history/current pickup mode cannot prepare a delivery cart;
- every duplicate/interruption point produces at most the bound active-session target, and later sessions resolve from the visible cart rather than replay clicks;
- unrelated cart lines survive, same-name/different-location and different-restaurant replacement require a bound decision, and cancellation changes nothing;
- alcohol cart preparation obeys the ordinary maximum and ambiguity rules, while provider age/identity UI pauses for the user and checkout remains unreachable;
- no path places an order or reaches checkout/payment authority.

### Milestone 4 - Public-Safe Delivery Dishes in Collections

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/journal-validation.test.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/persistence/neon-operational-store.integration.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/types.ts`
- `apps/web/src/components/collection-item.tsx`
- `apps/web/src/routes/collection-preview.tsx`
- `apps/web/src/routes/collection-import-plan.tsx`
- `apps/web/src/routes/household-collections.tsx`
- `apps/web/src/fixtures.ts`
- `apps/web/src/styles.css`
- `apps/web/src/test/app.test.tsx`
- `packages/agent-client/skills/share-food-collection/SKILL.md`
- `packages/agent-client/skills/import-food-collection/SKILL.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `tests/e2e/web.spec.ts`
- `tests/security/food-delivery.test.ts`

Tasks:

1. Add `delivery_dish` to the collection contracts, the web runtime schemas, private selection, and immutable public snapshots in the same milestone. Require the exact item revision and normal field-level preview. Narrow the imported public-provenance variant in canonical journal validation, Git repository rebuild, and the Neon search projection in the same change so the shared union never widens an unchecked consumer.
2. Project only dish title, restaurant display name, public location label, selected description/note, safe image/page URL, attribution, and source revision.
3. Snapshot-test that provider order references, order-group keys, merchant/menu locators, dates, counts, private modifiers, actor IDs, source labels, delivery destinations, and account data can never serialize.
4. Render recipe, grocery, and delivery cards accessibly at desktop, mobile, 320 CSS pixels, keyboard, screen reader, and no-JavaScript paths. Location is visible text, not color-only metadata.
5. Plan exact/possible duplicates from public deterministic fields only. The server may find candidates but never semantically merge two dishes or restaurant locations.
6. Import a selected delivery dish with `import` evidence and source provenance. This collection-import mutation is the sole connected exception to the dedicated private-history mutation: its boundary accepts only the public-safe dish fields and `import` evidence, and rejects delivery profile/report data, `delivery_order_line` evidence, private provider locators, recurrence, liking, and reorder authority. Add contract, service, and security tests proving those rejected fields create no Git or projection changes.
7. Permit an explicitly selected alcohol delivery item under the same field-level preview and import rules. Do not attach an age-eligibility, purchase, health, or safety claim.
8. Update the share/import skills and cross-host eval cases, expected results, and matrix assertions so users can select delivery dishes, include alcohol only when explicitly chosen, and understand that shared dishes are recommendations rather than copied orders. Cover public-field preview, import-only evidence, refusal of private order fields, same-name locations, duplicate resolution, and absence of reorder authority.

Verification:

- `npm run test:app -- apps/server/src/services/household-food-journal.test.ts`
- `npm run test:app -- apps/server/src/http`
- `npm run test --workspace @hfj/web`
- `npm run test:e2e -- tests/e2e/web.spec.ts`
- `npm run test:security`
- `npm run test:accessibility`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run verify`

Exit criteria:

- a user can publish one selected delivery dish with restaurant/location context and no private order/provider fields;
- a user can deliberately include an alcohol delivery item without creating checkout or eligibility authority;
- a recipient imports only selected dishes and resolves duplicates explicitly;
- the destination can search/plan the imported dish but cannot use it as previous-order evidence;
- revocation and expiration retain their existing behavior.

### Milestone 5 - Delivery Dishes in Local and Cloud Meal Plans

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/journal-validation.test.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/types.ts`
- `apps/web/src/routes/household-meal-plan.tsx`
- `packages/agent-client/skills/plan-household-meals/SKILL.md`
- `packages/agent-client/references/meal-planning-and-food-constraints.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `tests/e2e/meal-planning.spec.ts`
- `tests/security/food-delivery.test.ts`

Tasks:

1. Add cloud/local `journal_delivery_dish` source contracts, every strict web/runtime-schema consumer, and authority-matching exact item revisions with bounded familiarity/import evidence IDs in the same milestone.
2. Validate that the cited item is a current delivery dish and evidence belongs to it. A delivery-order citation may support `ordered before`; import evidence may support `shared dish`; neither supports `liked`.
3. Extend local purpose-specific proposal operations without allowing stale full-document meal-plan rewrites. Extend cloud append-only proposal validation and recovery without weakening current concurrency.
4. Require the existing current constraint profile and weekly review before recommending, proposing, or rendering a delivery dish.
5. Default delivery compatibility to `incomplete_evidence`. Allow `appears_compatible` only when separately cited ingredient evidence supports the same bounded wording used for recipes; provider menu titles alone are insufficient.
6. Preserve proposal history and mark `needs_recheck` when the delivery dish revision or constraint revision changes.
7. Render provider, restaurant location, familiarity basis, proposer, and compatibility caveat in the connected week view. Do not serialize order IDs, locators, private modifiers, or raw constraint labels.
8. Allow an explicitly selected alcohol delivery item in a proposal without inferring age eligibility, health suitability, food safety, or ingredient compatibility.
9. Add cross-host evals for explicit dish proposal, imported dish proposal, alcohol item selection, order-is-not-liked language, incomplete ingredients, same-name locations, changed dish revision, concurrent same-slot proposals, withdrawal, public collection provenance, and prompt injection.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:app -- apps/server/src/domain apps/server/src/services/household-food-journal.test.ts`
- `npm run test:e2e -- tests/e2e/meal-planning.spec.ts`
- `npm run test:security`
- `npm run test:coverage`
- `npm run verify`

Exit criteria:

- a local guest and connected editor can explicitly add a revisioned delivery dish to a reviewed week;
- an explicitly selected alcohol item can be proposed without an eligibility or compatibility claim;
- delivery familiarity never becomes Liked or a food-safety promise;
- same-slot household proposals still accumulate and withdrawals remain append-only;
- item/profile changes retain history and produce `needs_recheck`.

### Milestone 6 - Release Hardening, Provider Matrix, Rollout, Rollback, and Visible Evidence

Files:

- `docs/design/food-delivery-computer-use-feasibility.md`
- `docs/design/food-delivery-state-matrix.md`
- `docs/release/manual-matrix.md`
- `docs/release/privacy-review.md`
- `docs/release/verification-evidence.md`
- `docs/release/launch-checklist.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/QUALITY_LEDGER.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`
- create `artifacts/screencasts/food-delivery-cart-preparation.mp4`

Tasks:

1. Run the full deterministic contract, migration, unit, integration, security, eval, browser, accessibility, load, and coverage matrix. Maintain or improve touched-package coverage toward 100% lines and branches.
2. Run authorized live provider matrices for DoorDash and Uber Eats in Codex and Claude. Record provider version/date, index support, exact-location support, modifier support, cart support, existing-cart behavior, CAPTCHA/sign-in behavior, alcohol cart/age-step behavior, and no-checkout result without recording private account/order data. A provider may claim alcohol cart support only after the fake matrix passes and an authorized live non-checkout test verifies its current UI; otherwise label that sub-capability `unverified` and block it without weakening ordinary food support.
3. Validate one additional common browser provider only when an authorized account is available. Advertise only evidence-backed support labels; provider-neutral capability is not a claim that every provider works.
4. Threat-model provider prompt injection, cross-origin redirects, malicious collection content, history/account leakage, cross-provider and same-name location confusion, fulfillment-mode drift, destructive cart replacement, duplicate lines, uncertain side effects, checkout escalation, and origin/membership revocation races.
5. Prove deletion/retention behavior: per-source consent discloses no per-source erasure; origin revocation and member/account removal do not silently erase contributions; a separately authorized operator household-deletion workflow (there is no self-service route or tool in this release) removes active canonical delivery history while encrypted backups expire under the period in `docs/legal/privacy.md`; public shares revoke/expire; logs/metrics contain no food, restaurant, order, provider identity, location, or cart content.
6. Stage with delivery cart mutation disabled. Enable index reads and explicit local promotion first, fake-provider direct mutation second, one internal live provider canary third, and the second mandatory provider fourth.
7. Record a fixture-only screencast showing provider selection, two Wanpo locations, exact ambiguity question, Stanford selection, coconut-to-wintermelon change, multi-line cart verification, public-safe collection preview, meal-plan proposal, and explicit stop-before-checkout state.
8. Exercise rollback from every stage. Disable delivery cart mutation before provider/index reads; preserve additive Git data; rebuild/remove delivery search projections as needed; discard only noncanonical active-session plans; and prove older supported clients/servers do not delete delivery files.
9. Refresh generated knowledge artifacts and update the implementation log, active plan progress, decisions, discoveries, acceptance evidence, outcomes, and remaining provider risks.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:coverage`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:evals`
- `npm run test:load`
- `npm run test:e2e`
- `npm run test:migrations`
- `npm run container:postgres:verify`
- `npm run capture:screencast -- --output artifacts/screencasts/food-delivery-cart-preparation.mp4`
- `npm audit --omit=dev`
- `npm run knowledge:refresh`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

Exit criteria:

- all deterministic gates pass and the provider matrix supports every advertised claim;
- DoorDash and Uber Eats are explicitly labeled `index_and_cart`, `index_only`, or `unsupported`;
- each advertised provider has an explicit alcohol-cart sub-capability label backed by the fake and authorized live no-checkout matrices;
- no live proof checks out, pays, tips, schedules, or changes an address;
- privacy, security, accessibility, screencast, provider, rollout, and rollback evidence is recorded;
- unsupported or changed provider UI blocks truthfully.

## Acceptance / Verification

The feature is accepted only when all of the following are true:

- When delivery history is absent, Fullwell asks which provider sites the user uses and which installed signed-in browser it may control. It never asks for credentials or controls a native mobile app.
- Before committing or promoting a connected provider source, Fullwell explains household visibility, the absence of per-source erasure, retention after origin revocation/member departure, and encrypted-backup expiry after household deletion, then obtains explicit confirmation; declining performs no hosted write.
- A ready local delivery index promotes through one reconciled, previewed, idempotent `hfj_commit_delivery_index` mutation per approved provider source and records each provider's cloud linkage only after that call succeeds.
- An authorized audit expands every qualifying order and exact line/modifier group in the chosen window. Incomplete orders are identified and excluded from complete reorder candidates.
- Every complete group records `delivery | pickup`; pickup remains familiarity evidence and never silently becomes a delivery cart.
- The private index distinguishes same-name restaurant locations. Stanford and Cupertino Wanpo never collapse merely because their display names match.
- A connected owner/editor can contribute attributed delivery evidence from their own authorized provider session; a viewer can read/search but not mutate.
- When the same restaurant/location appears on more than one historical provider, an unqualified request asks which provider before any cart mutation.
- `Reorder Wanpo` with two historical locations asks which location and changes no cart.
- `Do a reorder from Wanpo in Stanford but swap the coconut boba for a wintermelon boba` selects only the uniquely supported Stanford location, reconstructs one complete prior order, verifies the source line and exact current replacement, and shows/resolves the exact line plan.
- A USD food subtotal strictly below the existing maximum may proceed under the initial explicit cart-preparation request. Equal/greater, missing/non-USD, or increased amounts require a bound confirmation or block.
- A different-restaurant or same-name/different-location provider cart is never cleared or replaced without a separate confirmation showing the visible existing-cart summary and requested restaurant.
- A same-location cart retains unrelated lines. Active-session retries never raise a requested line above its bound target; a later session re-resolves from the visible cart and never replays clicks.
- Unavailable items/modifiers, closed restaurants, delivery-area mismatch, sign-in, MFA, CAPTCHA, unapproved origin, menu drift, unexpected cart state, or unverifiable results return `needs_input` or `blocked`, never success.
- Alcohol follows the same evidence, ambiguity, and automatic cart-add maximum rules as other delivery lines; provider age/identity checks remain user-controlled and Fullwell stops at the cart. Tobacco, cannabis, prescriptions, gift cards, and other non-food/regulated goods remain excluded.
- Completion reports provider, exact restaurant location, prepared lines/modifiers/quantities, displayed food subtotal, and that the user must review and check out manually.
- No code, prompt, schema, browser bridge, provider fixture, host permission, or confirmation path can check out, place an order, pay, tip, schedule, change an address, accept a membership, or authorize a subscription.
- A curated collection may include a delivery dish with public restaurant/location context, but snapshot tests prove private order/provider/account fields cannot appear.
- A user may deliberately include an alcohol delivery item in a collection or meal proposal without Fullwell asserting age eligibility, health suitability, or ingredient compatibility.
- Importing a delivery dish creates public provenance only. It cannot become previous-order evidence or automatic reorder authority.
- A reviewed local or cloud meal plan can include a revisioned delivery dish. The proposal distinguishes `ordered before` or `shared dish` from Liked and does not overstate ingredient compatibility.
- Provider pages, journal prose, imported collections, and menu text cannot broaden origins, tools, files, household access, requested lines, or checkout authority.
- DoorDash and Uber Eats receive current evidence-backed general and alcohol-cart support labels before release copy names either capability; until then both are unsupported for release.

Required final command set:

```sh
npm run lint
npm run typecheck
npm run build
npm run test:coverage
npm run test:contract
npm run test:integration
npm run test:security
npm run test:evals
npm run test:load
npm run test:e2e
npm run test:migrations
npm run container:postgres:verify
npm run verify
npm run verify:docs
npm run verify:execplan
```

### Rollout

1. Land docs, schemas, migration, fake provider, evals, and provider support labels with every live delivery cart action disabled.
2. Enable local and connected delivery indexing for internal fixture data. Prove Git/local persistence, search, collections, and meal planning before live provider mutation.
3. Enable fake-provider direct computer-use cart preparation in both hosts. Prove exact origins, fulfillment-mode checks, multi-line idempotency, cart replacement confirmation, revocation, and no checkout.
4. Enable one authorized internal DoorDash or Uber Eats canary only if its Milestone 0 label is `index_and_cart`. Keep the other provider disabled.
5. Review seven days of blocked/uncertain/retry/privacy evidence, then enable the second provider only if it independently passes.
6. Add another provider only through an updated support matrix and release evidence. Exact-origin approval is per provider and never wildcarded.

### Rollback and Recovery

- Disable live delivery cart action first, then provider indexing. Grocery restocking remains independently available.
- Do not delete delivery Git paths during application rollback. Additive delivery evidence/items/reports remain canonical and exportable; older supported readers must ignore/preserve them.
- Rebuildable `search_items` delivery rows may be deleted before restoring the older database constraint. Do not down-migrate until no running image writes delivery projections.
- Revoke an approved provider origin to block future browser use immediately without implying that canonical household contributions were deleted.
- A failed authority refresh blocks mutation until the local revision or cloud HEAD is current. It never uses stale delivery history to act.
- An uncertain direct action reopens and inspects the provider cart before any retry and never replays clicks from memory.
- If provider UI changes invalidate exact menu/cart verification, downgrade that provider to `index_only` or `unsupported`; do not weaken verification or checkout boundaries.
- If collection or meal-plan readers must roll back, retain their Git records and use readers that safely ignore unknown source kinds. Do not rewrite append-only proposal or evidence history.

## Idempotence and Recovery

Delivery audit cursors are provider/account-scope/date-window/order-listing locators stored without credentials. A completed order group is appended once by stable evidence IDs and source order-group key. A retry with identical evidence returns the original IDs; changed content requires new correction evidence rather than mutation of append-only history.

Connected item/profile/report updates use current Git HEAD and expected item/profile revisions. Conflicts reload current evidence and items, explain meaningful location/dish differences, and reconstruct the change. They never blindly retry or merge Markdown.

Local-to-cloud promotion persists one stable idempotency key with each local provider source and binds that authorized provider origin, its evidence/items delta, the complete expected/next aggregate profile and report, selected household, current local revision, and expected cloud HEAD. An exact retry returns the committed result; a changed payload or HEAD requires provider-specific reconciliation and a new preview before mutation.

The active direct session binds provider origin, fulfillment mode, restaurant location/merchant reference, selected complete prior-order group, every edit and target, current menu locators, baselines, existing-cart decision, subtotal, automatic maximum, authorization mode, and current local revision or Git HEAD. Recovery re-reads the provider cart and compares every exact target:

- all targets present and no forbidden mutation: verify and complete without clicking;
- some targets below plan and all other authority unchanged: add only the missing amounts and verify;
- unexpected target quantity, modifier drift, unrelated-line removal, different restaurant, increased confirmed amount, stale HEAD, or unverifiable UI: block;
- quantity above target: never decrement automatically;
- a different-restaurant cart without the exact bound replacement confirmation: cancel or ask.

The direct skill has no durable action-receipt authority. Within one conversation it retains the bounded resolved plan and verifies the cart before every change. On a later duplicate request it must re-resolve authority, re-read the entire cart, and show the proposed delta; an already-matching cart completes without mutation, while an ambiguous existing cart asks. Milestone 0 must prove that this is sufficient for advertised direct providers; otherwise direct cart mutation remains disabled.

Collection publication resolves source revisions before creating an immutable snapshot. Exact retry returns the same snapshot/share. Import uses destination HEAD and one idempotency key; exact repeat provenance skips, and possible duplicates require an explicit decision.

Meal proposals remain immutable append-only records. Exact retries return the same proposal. Another household member's same-slot addition advances HEAD but does not overwrite or block an independent current append after source/profile revalidation.

## Artifacts and Notes

Planning inputs:

- `docs/ideas/backlog/food-delivery-history-and-cart-preparation.md`
- `docs/exec-plans/active/2026-07-20-whatsapp-local-restocking.md`
- `docs/exec-plans/completed/2026-07-23-collaborative-household-meal-planning.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`

Implementation must re-check current primary provider terms and host documentation during Milestone 0 and before release. Do not place provider credentials, order identifiers, delivery addresses, payment data, household data, browser captures, or live account screenshots in this plan, Git, test fixtures, shell history, logs, metrics, or screencasts.

All test fixtures use invented restaurants, locations, dishes, modifiers, order IDs, accounts, and prices. Live evidence records only a sanitized capability result in `docs/design/food-delivery-computer-use-feasibility.md`; private operational detail remains in the approved secret-bearing system.

## Outcomes & Retrospective

Implementation outcome as of 2026-07-25: the independently reviewed ExecPlan is approved on feasibility, completeness, and scope, and WU-00/WU-01 implementation is underway. The deterministic provider harness now exercises provider and location ambiguity, complete and incomplete histories, exact line/modifier identity, pickup blocking, existing-cart conflicts, multi-line recovery, session-loss idempotency, ordinary alcohol maximums, user-controlled age steps, exact-origin policy, and structural no-checkout behavior across the supported Playwright projects.

The user-directed browser boundary is now explicit: cataloging means bounded navigation over purchases visible in the account holder's own signed-in browser, initiated by that user. It is not public-site crawling, unattended scraping, access-control bypass, credential handling, or a provider-data service. This decision unblocks provider-neutral implementation through Milestones 1-5. It does not authorize release claims: current DoorDash/Uber Eats UI capability, actual installed-host behavior, and provider-specific limitations remain Milestone 6 evidence requirements.

Milestones 1-6 are implemented, release-hardened, deployed provider-neutrally on schema `0008`, and published as immutable `@fullwell/fullwell@1.1.14`. Deterministic evidence proves provider-neutral indexing and contribution, public-safe collection/import, delivery-dish meal sources, exact ambiguity handling, full-cart preparation/recovery, ordinary-maximum alcohol selection, user-controlled age UI, structural no-checkout behavior, reversible schema `0008`, PostgreSQL persistence, a checksum-matched staging image, clean public-package host lifecycles, and visible fixture-only evidence. This is deliberately not a named-provider release: DoorDash, Uber Eats, additional providers, installed-host live-provider execution, and live alcohol age steps remain unsupported until authorized current evidence exists; manual privacy/accessibility approval remains a launch blocker for those claims.

Milestone 0 is complete for deterministic implementation. DoorDash, Uber Eats, and additional live providers are classified `unsupported` for release because no authorized run proved complete history or exact cart verification.

Completed local evidence records:

- all supported WebKit projects pass same-name location, modified reorder, duplicate/crash, existing-cart, collection, meal-plan, accessibility, and no-checkout fixtures;
- provider support is fixture-only; DoorDash, Uber Eats, additional providers, and their alcohol sub-capabilities are unsupported for release;
- rollback disables cart mutation first, preserves canonical Git content, discards only active plans, and rebuilds or removes only noncanonical projections;
- `artifacts/screencasts/food-delivery-cart-preparation.mp4` contains invented fixture data and never opens checkout;
- remaining named-provider launch work is an authorized live provider/installed-host matrix and named manual privacy/accessibility approval.
