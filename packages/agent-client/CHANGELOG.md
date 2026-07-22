# Changelog

## Unreleased

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
