# Changelog

## Unreleased

## 1.1.28 - 2026-07-30

- When Safari recipe, grocery, and takeout audits lack DOM access, recover an exact visible image through the image context menu and a temporary image tab instead of treating an accessibility-tree omission or page image control as proof that no image exists.

## 1.1.27 - 2026-07-30

- License the published package under `AGPL-3.0-only` and include the complete
  license text in every npm artifact.

## 1.1.26 - 2026-07-29

- Keep an explicitly active Codex grocery-order audit running across automatic compaction and premature stops until it records a truthful terminal outcome.
- Bind continuation to the exact session and turn with private aggregate-only metadata, so later restocking, delivery reordering, meal planning, and unrelated conversation remain unaffected.
- Leave Claude's existing tool surface and durable checkpoint behavior unchanged; Codex users must review and trust the packaged hook definition before it can run.

## 1.1.25 - 2026-07-29

- Remove the redundant `Fullwell` text from Codex starter prompt bodies because Codex Desktop already renders the plugin identity before each starter.

## 1.1.24 - 2026-07-29

- Let an explicitly authorized Fullwell chat recover a deliberately logged-out Codex cloud connection through Codex's fixed MCP login command, then prove the refreshed connection with `hfj_get_context` on the next turn without handling tokens or asking the person to use a terminal.
- Preserve the Codex MCP authorization request through Fullwell web sign-in when the selected browser profile is not already authenticated.

## 1.1.23 - 2026-07-29

- Replace the Codex and ChatGPT desktop plugin recommendations with three direct Fullwell starters for greeting, grocery restocking, and Wanpo delivery reordering.

## 1.1.22 - 2026-07-29

- Package the approved Fullwell artwork and expose it through Codex's supported plugin logo metadata while keeping Claude's strict manifest free of unsupported extension fields.

## 1.1.21 - 2026-07-28

- Address a newly named person with `Hey <name>, nice to be acquainted` before asking about a Fullwell cloud account, reuse remembered names naturally after conversational gaps without repetition, and distinguish cloud accounts from account-free local use throughout onboarding.

## 1.1.20 - 2026-07-28

- Resume an existing cloud household when local Fullwell state is missing, use the authenticated actor ID returned by context, and save bounded ordinary recipe or grocery updates through one atomic evidence-plus-item change set.

## 1.1.19 - 2026-07-28

- Rename the hosted MCP identity to `fullwell-cloud` so installed hosts distinguish it from the local Fullwell service.

## 1.1.18 - 2026-07-27

- Move hosted MCP, OAuth handoff, install, privacy, and terms metadata to the canonical `https://fullwell.ai` origin and require existing old-origin installations to reconnect.

## 1.1.17 - 2026-07-27

- Document the 10,000-record and 10,000-dish cloud delivery commit boundary, still bounded by the hosted 16 MiB MCP request limit.
- Capture provenance-backed grocery, recipe, and delivery image URLs during authorized computer-use collection and carry history-backed delivery images through local and cloud journal commits.

## 1.1.16 - 2026-07-26

- Automatically repair recognized older local delivery-journal formats through the stable local update tool, including deterministic ID/reference updates, evidence-backed restaurant-name partitions, report-summary normalization, and obsolete browser-label removal; reload and resume the interrupted delivery sync without direct file edits, cloud writes, internal jargon, or a user-coordinated product fix.

## 1.1.15 - 2026-07-26

- Offer cloud sync after every successful local-only delivery audit, accept clear contextual responses such as `yes` or `sync it` without scripted confirmation text, and keep connection, household selection, and provider-specific visibility/retention approval separate from the offer while making ambiguity, decline, or silence a no-op.

## 1.1.14 - 2026-07-25

- Add a local and connected food-delivery history audit for user-selected signed-in providers with complete order/modifier capture, delivery-versus-pickup evidence, exact restaurant locations, alcohol indexing, regulated-line exclusions, and no raw-page or credential storage.
- Add strict revisioned local delivery evidence, dish, profile, and report validation plus provider-scoped promotion staging, stable retry keys, post-success cloud linkage, and independent provider recovery.
- Add the four bounded delivery-history MCP tools, provider-specific household visibility and retention guidance, shared Codex/Claude metadata, and cross-host semantic eval coverage.
- Add public-safe delivery dishes to shared collections and selective import without copying order history, private provider locators, recurrence, or reorder authority.
- Add revision- and evidence-bound delivery-dish sources to local and collaborative meal plans with ordered-before/shared-dish provenance, conservative ingredient compatibility, and explicit alcohol selection.
- Add provider-then-location previous-order resolution and direct computer-use cart preparation with complete-cart proof, exact quantities and modifier swaps, preservation/replacement controls, uncertain-action recovery, and no checkout, payment, tip, address, schedule, membership, or subscription authority.
- Treat DoorDash, Uber Eats, and other provider names as examples until current authorized installed-host validation records an evidence-backed support label.

## 1.1.13 - 2026-07-24

- Add the required top-level object type to the local household-update tool schema so Claude can fetch every Fullwell local tool after connecting.
- Replace Claude's system-like setup instruction with the conversational `Hi Fullwell.` greeting and route that exact greeting through name-first onboarding.

## 1.1.12 - 2026-07-24

- Ask and remember the member name before account routing; derive the first local or cloud household name, synchronize the cloud display name on connection, support local/cloud renames and chat-driven runner/reminder shutdown, and suggest eligible invitations or collections with concrete examples.
- Add local and connected collaborative weekly meal planning with explicit household food-constraint reviews, Liked-recipe evidence, separately approved web research, multi-proposal slots, attributed withdrawals, and deterministic recheck state.
- Add a private login-free static recipe board with bounded cards, image provenance, CSP, strict escaping, integrity-checked replay, and browser-open fallbacks.
- Offer one optional host-native Codex or Claude weekly planning check-in after setup, defaulting to Sunday at 9:00 AM in the confirmed time zone, with duplicate reconciliation and conversational schedule lifecycle controls.

## 1.1.11 - 2026-07-23

- Resume the optional Fullwell cloud handoff after a guest's first successful direct-local restock by adding the cloud-capabilities P.S. and asking whether to connect; omit the reminder for linked WhatsApp and already-connected households.
- Add complete USD restocking requests automatically only when they are strictly below a configurable `USD 50.00` default maximum; let direct conversations change the canonical profile setting, require exact confirmation at or above it, and report every verified add with item, quantity, amount, and a maximum-change reminder.
- Make every user-facing skill speak as the user's Fullwell assistant in a natural first-person voice, including explicit first-person onboarding and completion examples, while reserving the Fullwell name for real account, cloud, website, plugin, and brand distinctions.

## 1.1.10 - 2026-07-22

- Resolve the packaged local MCP entrypoint through host-specific path adapters so Codex and Claude start the same installed server regardless of their working directory.
- Require the isolated Claude lifecycle test to prove the local server connects successfully instead of accepting discovery alone.
- Canonicalize the stdio entrypoint before its main-module check so plugin caches reached through macOS `/tmp` or `/var` aliases still start.

## 1.1.9 - 2026-07-22

- Replace version-specific local-household shell commands with stable `fullwell-local` read, update, and collecting-only deletion tools so one host permission can survive package upgrades without a broad Node allow rule.
- Keep local loads read-only, ordinary revisioned updates non-destructive, cancellation deletion separately destructive, and fail closed with reload guidance when the local tool server is unavailable.

## 1.1.8 - 2026-07-22

- Ask whether a fresh user already has an account before any Fullwell call; otherwise create a private revisioned local guest household, complete grocery and recipe onboarding without OAuth, and offer optional cloud backup only for WhatsApp, sharing, or family access.
- Keep local journals usable for direct restocking and recipe recall, retain them after promotion, and record cloud linkage only after a confirmed hosted commit succeeds.
- After successful onboarding learns at least one grocery item, invite the user to try an out-of-stock restocking request and explain that Fullwell will use the usual product and store before asking to add it to the cart.

## 1.1.7 - 2026-07-22

- Learn snacks, ingredients, condiments, and other groceries in one onboarding pass; retain below-threshold items and honor evidence-backed exclusions such as standard rather than Japanese-style mayonnaise during restocking.

## 1.1.6 - 2026-07-22

- Commit confirmed guided onboarding drafts with up to 10,000 evidence records and 10,000 items in one request of at most 16 MiB; never split a within-limit draft into intermediate Fullwell writes.

## 1.1.5 - 2026-07-21

- Require the authorized browser audit to open every qualifying grocery order detail, expand complete item lists, and report hidden-item limitations instead of trusting order-history summaries.
- Checkpoint unconfirmed onboarding under the Codex home by stable Fullwell user and household IDs, with exact snapshot binding, atomic private local writes, safe resume, conflict detection, prohibited browser/auth data, and cleanup after confirmed finalization or cancellation.

## 1.1.4 - 2026-07-21

- Explain how snack purchase history powers familiar-product restocking and how recipe history helps recall family favorites before asking onboarding source questions, including when resuming a section.

## 1.1.3 - 2026-07-21

- Read onboarding state, profiles, and the bounded item index once, keep the unconfirmed snack-and-recipe draft in the active conversation, and write it with one final `hfj_commit_onboarding` call after explicit confirmation.
- Avoid intermediate Fullwell mutations for declines and audits during guided first run while retaining the existing standalone audit tools and conflict fallbacks.

## 1.1.2 - 2026-07-21

- Route a bare `@Fullwell hi` through unresolved onboarding before general help, starting snacks and then recipes with only the missing source, authorization, and preference questions each audit needs.
- Add an exact bare-greeting regression eval and forbid generic greetings while onboarding remains open.

## 1.1.1 - 2026-07-21

- Renamed the public Codex and Claude plugin selectors to `fullwell@fullwell` while retaining the `@fullwell/fullwell` npm package and `household-food-journal` MCP service identifier.
- Corrected the install handoff to add the real `moorage/fullwell` marketplace before installing the plugin.

## 1.1.0 - 2026-07-21

- Added `Fullwell` mention branding, a setup starter and install handoff, shared snack-then-recipe onboarding guidance, typed start/skip/resume tool coverage, and cross-host decline/resume evals.
- Added a shared Codex and Claude grocery-restocking skill with closed historical candidates, evidence-only ambiguity questions, two-phase cart authorization, idempotent quantity targets, and no-checkout rules.
- Added cross-host restocking evals for clear leaders, real historical ambiguity, catalog-only alternatives, crash recovery, and payment boundaries.

## 1.0.0 - 2026-07-15

- Publish the package as `@fullwell/fullwell` while retaining `household-food-journal` as the host plugin and MCP service identifier.
- Add shared household, grocery audit, recipe history, collection sharing, and collection import skills.
- Add Codex and Claude manifests, marketplace metadata, and one remote OAuth-enabled MCP endpoint.
- Add deterministic packaging, privacy, contract-coverage, and cross-host eval validation.
- Point every packaged service and policy URL at the deployed Fullwell origin.
