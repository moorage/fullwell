# Changelog

## Unreleased

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
