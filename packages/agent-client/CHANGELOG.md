# Changelog

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
