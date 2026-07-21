# Conversational Fullwell Onboarding

## Purpose / Big Picture

After installing Fullwell, a user should be able to start a conversation with `@Fullwell hi` or `Set up Fullwell` and immediately receive the first concrete onboarding question. Fullwell proceeds through snack purchase history and then recipe history without first asking which setup the user wants. Natural declines skip only the current section and advance to the next one; an explicit stop ends the conversation without inventing completion. Progress survives host and session changes, while the server derives completed reports from canonical Git rather than trusting an agent-authored completion flag.

The observable result is a typed, resumable first-run flow that can safely lead a new household to `snacks/reports/recurring-snacks.md` and `recipes/reports/recipe-index.md`, with no automatic browser inspection and no keyword classifier.

## Progress

- [x] 2026-07-21T20:01Z: Created and claimed Bead `fullwell-5w0`; confirmed no existing onboarding issue or implementation owns this scope.
- [x] 2026-07-21T20:12Z: Completed product, UX, security, reliability, and eval framing; promoted the idea into this independent ExecPlan.
- [x] 2026-07-21T20:18Z: Passed the feature-critic gate after adding atomic operational mutation, selected-household authorization, backward-compatible rollout, and cross-member/resume requirements.
- [x] 2026-07-21T20:10Z: Completed Milestone 1 with typed contracts, migration `0007`, memory/Neon compare-and-set persistence, and focused contract/adapter tests.
- [x] 2026-07-21T20:16Z: Completed Milestone 2 with membership-authorized derived context, one idempotent transition tool, atomic operational state/response persistence, and service/domain tests.
- [x] 2026-07-21T20:23Z: Completed Milestone 3 with shared sequential skills, same-run skip termination, Fullwell starter/mention metadata, unsent Codex handoff, Claude fallback, five onboarding evals, and install component/WebKit tests.
- [x] 2026-07-21T20:31Z: Completed Milestone 4 with synchronized product, architecture, security, reliability, rollback, changelog, quality, and evidence docs; refreshed knowledge artifacts and passed the complete local gate set.

## Surprises & Discoveries

- 2026-07-21: `hfj_create_household` returns `onboarding_state: ready`, but `hfj_get_context` does not return onboarding state and no persistent onboarding model exists. The legacy response is not sufficient for resumption.
- 2026-07-21: Report documents are canonical in Git but not represented in `HouseholdProjection`. Completion can be derived without enlarging the rebuildable projection by reading the two fixed report paths through `HouseholdRepositoryPort.read`.
- 2026-07-21: Codex plugin deep links prefill a composer and do not send automatically. This is the desired consent boundary; an install or `SessionStart` hook would be broader and require separate trust.
- 2026-07-21: The working tree already contains the active WhatsApp implementation. Onboarding must preserve those changes and use migration `0007` after its untracked `0006` migration.
- 2026-07-21: The Neon household lock wraps one database transaction and routes store calls through its checked-out connection. The onboarding compare-and-set and completed idempotency response must both execute inside that callback so a crash cannot persist only one side.
- 2026-07-21: The Codex `codex://new` deep-link parser represents `new` as the URL host rather than the pathname. Packaging and browser boundary checks now validate that exact shape.
- 2026-07-21: An accidental broad workspace test invocation passed 267 assertions but exited after the local-runner timeout fixture emitted an asynchronous `EPIPE`. The focused projects stayed green, and the later aggregate gate passed 273 tests without the asynchronous failure.
- 2026-07-21: The first coverage run reported 89.95% global branches, 0.05 points below the enforced gate. Tests for invalid onboarding transitions, prompt-copy failure, and hostile setup URL parsing raised branch coverage to 90.07% without weakening policy.
- 2026-07-21: The screencast helper cannot run on this host because X display `:99` and PulseAudio are unavailable. The feature retains desktop, mobile, narrow, and no-JavaScript Playwright screenshots and interaction evidence instead of an MP4.

## Decision Log

- 2026-07-21: Use one `hfj_update_onboarding` tool with a discriminated action rather than per-transition tools. This keeps tool choice reliable and lets the server enforce one state machine.
- 2026-07-21: Store `in_progress` and `skipped` per user and household in Neon. A family member's decline must not suppress onboarding for another member.
- 2026-07-21: Derive `complete` at read time from the household's canonical report file. The agent cannot submit or persist a success-shaped completion state.
- 2026-07-21: Treat `start`, `skip`, and `resume` as operational transitions with optimistic revision and idempotency. Keep confirmed stores, browser, source scope, and meaning in the existing Git-backed profiles.
- 2026-07-21: Preserve the stable `household-food-journal` plugin and MCP identifiers. Change only the Codex display name and starter UX to make `@Fullwell` discoverable.
- 2026-07-21: Do not ask a setup-choice question. Begin snacks, advance to recipes after a natural decline, and end only after recipes are complete/skipped or the user explicitly stops.
- 2026-07-21: Authorize the selected household before reading either fixed report path. A caller-supplied non-member household ID must fail rather than reveal report presence or repository HEAD.
- 2026-07-21: Roll out migration `0007` first, then the compatible server exposing the 23-tool surface, then the client package and install metadata. The old client remains compatible with the new server; the new client must not precede the new tool.

## Context and Orientation

`packages/contracts/src/tools.ts` owns MCP input schemas and the stable tool-name union. `apps/server/src/services/household-food-journal.ts` dispatches tools, authorizes users, and coordinates the operational store and canonical household repository. `apps/server/src/core/ports.ts`, `apps/server/src/adapters/memory.ts`, and `apps/server/src/persistence/neon-operational-store.ts` define and implement operational persistence. Reversible migrations live under `migrations/`.

The shared agent behavior lives in `packages/agent-client/skills/`. `manage-household-food-journal` owns first use and will coordinate `audit-grocery-purchases` and `track-recipe-history`; those skills remain authoritative for evidence collection. `packages/agent-client/.codex-plugin/plugin.json`, `packages/agent-client/install-metadata.json`, and `apps/web/src/routes/install.tsx` own discovery and install handoff. Agent behavior is covered by `packages/agent-client/evals/` and deterministic package validators.

Hard constraints:

- Never inspect private sources before the user names and authorizes them.
- Do not store free-text decline messages; store only bounded transition reasons.
- Do not implement decline detection with keyword matching; the host model interprets the conversation and calls the typed tool.
- `complete` is household-wide and derived from Git. `skipped` is per user and household.
- A changed idempotency payload or stale onboarding revision fails closed.
- Editors and owners may advance onboarding because the audits write journal data; viewers may read completion but cannot mutate onboarding.
- Preserve all existing WhatsApp changes and do not reuse its ExecPlan.

## Framing Notes

### Expert panel

- UX expert - minimize first-run decision load and make declines recoverable.
- Security and privacy researcher - preserve explicit authorization before source inspection and avoid storing sensitive prose.
- Staff architect - separate operational resumption from canonical journal completion and minimize tool count.
- Reliability and eval engineer - make transitions idempotent, race-safe, resumable, and covered by host evals.

### What problem are we actually solving?

Convert a technically successful plugin installation into a safe path to useful journal reports without making the user understand Fullwell's internal feature taxonomy.

### Roundtable highlights

- UX: ask the first snack question immediately; skipping advances locally instead of restarting or ending the whole flow.
- Security: installation is not browser authorization, and no hook should turn it into authorization.
- Architecture: keep per-user workflow state operational but derive household completion from Git.
- Reliability/evals: represent transitions explicitly, reject stale revisions, and test paraphrased declines rather than programming phrase lists.

### Key tensions

- Low-friction onboarding versus explicit consent for private browser sources.
- Cross-host natural language versus deterministic, server-validated state transitions.
- Per-user deferral versus household-wide completion.

### Synthesis for decomposition

Build the typed persistence boundary first, integrate it with context/report truth second, then teach the shared skills and install surfaces to use it. Validation must cover concurrency, idempotency, authorization, no premature browsing, natural declines, cross-member isolation, and host packaging.

## Milestones

### Milestone 1 - Contracts and operational persistence

Files:

- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/core/ports.ts`
- `apps/server/src/adapters/memory.ts`
- `apps/server/src/adapters/memory.test.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/persistence/neon-operational-store.integration.test.ts`
- `migrations/0007_conversational_onboarding.sql`
- `migrations/0007_conversational_onboarding.down.sql`

Tasks:

1. Define semantic section, state, skip-reason, action, and record schemas.
2. Add `hfj_update_onboarding` with `household_id`, section action, expected nonnegative revision, and idempotency key.
3. Add a per-user/per-household/section table with bounded checks and a reversible rollback.
4. Add typed read and compare-and-set transition methods to memory and Neon adapters.
5. Test first transition, stale revision, cross-user isolation, and rollback-compatible schema behavior.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- adapters/memory.test.ts`
- `npm run typecheck --workspace @hfj/server`

### Milestone 2 - Context derivation and transition service

Files:

- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/http/app.test.ts`

Tasks:

1. Add selected-household onboarding state to `hfj_get_context` after membership authorization.
2. Derive each `complete` state from the fixed canonical report path; otherwise return the caller's operational state or `not_started`.
3. Implement idempotent `start`, `skip`, and `resume` transitions under the household lock with optimistic revision, editor authorization, and bounded telemetry.
4. Commit the onboarding compare-and-set and completed mutation response in the same Neon transaction. Return failures only after the transaction records `failed_before_commit`; never leave a persisted state transition with an ambiguous response.
5. Reject mutations of a completed section, changed idempotency payloads, stale revisions, invalid transitions, viewer attempts, and selected-household substitution.
6. Prove a report committed by one member appears complete to every member while one user's skip remains private to that user.

Verification:

- `npm run test --workspace @hfj/server -- services/household-food-journal.test.ts`
- `npm run test:contract`
- `npm run test:security`

### Milestone 3 - Agent and install experience

Files:

- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/web/src/types.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/test/app.test.tsx`
- `tests/e2e/web.spec.ts`

Tasks:

1. Make Fullwell greetings and setup prompts enter/resume sequential snacks-then-recipes onboarding without a setup menu.
2. Specify conversational skip-versus-stop behavior and call the typed transition tool; never add a keyword classifier.
3. Reuse the existing audit skills after sources and browser access are confirmed.
4. Brand the Codex display as Fullwell, add a compliant starter prompt, and expose a prefilled, unsent Codex setup deep link plus a natural-language Claude fallback.
5. Add evals for start, snack skip, recipe skip, explicit stop, resume, existing completion, and no premature source inspection.
6. Treat a new `@Fullwell hi` as intent to resume the earliest per-user skipped section only after all not-started/in-progress sections have been handled; never mutate a completed section.

Verification:

- `npm run test:packaging`
- `npm run test:evals`
- `npm run test --workspace @hfj/web`
- `npm run test:e2e`

### Milestone 4 - Documentation, evidence, and release safety

Files:

- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/generated/repo-map.json`
- `docs/QUALITY_LEDGER.md`

Tasks:

1. Document the first-run conversation, typed tool, operational authority, privacy boundary, recovery, and report-derived completion.
2. Record migration rollback and staged package compatibility requirements.
3. Capture a redacted screencast of install handoff, snack skip, recipe questions, interruption, and resume when the local UI is runnable.
4. Refresh generated knowledge, review doc drift, and run the repository gates.

Verification:

- `npm run knowledge:refresh`
- `npm run verify`
- `npm run test:e2e`
- `npm run test:integration`
- `npm run test:security`
- `npm run verify:docs`
- `npm run verify:execplan`

## Interfaces and Dependencies

The new public input is conceptually:

```ts
type OnboardingSection = "snacks" | "recipes";
type OnboardingAction =
  | { action: "start" }
  | { action: "skip"; reason: "not_now" | "no_sources" | "user_declined" }
  | { action: "resume" };
```

`hfj_get_context` returns `onboarding` for the selected household with one status per section. `hfj_update_onboarding` is the only new tool. It uses `journal:write`, requires editor membership, is idempotent, and does not accept report-completion input.

## Idempotence and Recovery

- The tool binds its idempotency key to a canonical request fingerprint. Reuse with different input fails with `REVISION_CONFLICT`.
- Each state row has a monotonically increasing revision. Compare-and-set prevents concurrent hosts from overwriting one another.
- A successful operational transition records a completed mutation against the current household HEAD without creating an empty Git commit.
- The onboarding row compare-and-set and completed mutation response execute inside the same household-scoped Neon transaction. A crash rolls both back; a lost response replays the completed record. The initial `received` row may exist before the lock and is safely resumable.
- Rollback removes the onboarding table and reverts clients to report/profile inference. It does not modify canonical journal content.

## Acceptance / Verification

- `@Fullwell hi` or `Set up Fullwell` begins with the first necessary snack question, not a feature-selection menu.
- Natural declines skip the active section through `hfj_update_onboarding` and immediately advance snacks to recipes or recipes to completion.
- Explicit stop language ends the conversation without silently skipping another section.
- No store, browser, recipe source, or private history is inspected before the user names and authorizes it.
- State resumes across Codex/Claude sessions and does not leak one member's skip decision to another.
- A committed recurring-snacks or recipe-index report produces `complete` for every current member without an agent completion call.
- Stale revision, invalid transition, changed idempotency payload, viewer mutation, and cross-household substitution fail closed.
- An interrupted request cannot persist onboarding state without its replayable completed response, and a replay cannot apply the transition twice.
- Migration up/down/up, contract, unit, integration, security, eval, packaging, web, accessibility/e2e, docs, and aggregate verification pass.
- Rollback is `migrations/0007_conversational_onboarding.down.sql` plus the prior compatible server/client package; canonical reports and evidence remain intact.
- Rollout order is migration, server, then client package/install metadata; rollback reverses the client before the server and database.
- Screencast command when capture is available: `npm run capture:screencast -- --output artifacts/screencasts/conversational-fullwell-onboarding.mp4`.

## Outcomes & Retrospective

Delivered one typed `hfj_update_onboarding` MCP tool and a per-user operational state machine for snack and recipe onboarding. `hfj_get_context` now reports membership-authorized, report-derived section status; owners/editors can start, skip, or resume with optimistic revision and idempotency, while viewers, stale sessions, changed replays, invalid transitions, completed sections, and cross-household substitution fail closed. The Neon compare-and-set and replayable completed response share one household transaction.

The shared Codex/Claude skills begin with grocery stores, advance to recipe sources without a feature menu, interpret declines conversationally, end after a same-run recipe skip, and revisit skipped work only on a later greeting. Codex exposes the Fullwell mention and an unsent `codex://new` handoff with `@Fullwell hi`; Claude uses `Set up Fullwell.`. The server, client package, install page, product specs, architecture, security, reliability, rollback, changelogs, and release evidence are synchronized.

Passing evidence includes 273 deterministic tests, 96.61% statements/lines, 94.88% functions, 90.07% branches, 30 cross-host eval cases, real isolated Codex/Claude plugin lifecycles, 11 isolated PostgreSQL tests, seven-migration up/down/up, security, lint, all workspace typechecks/builds, 29 WebKit checks with seven intentional project skips, and aggregate `npm run verify`. Schema `0007` and the corresponding server image are deployed to staging with public deployment/MCP, signed webhook, readiness, and operator checks passing; `@fullwell/fullwell@1.1.0` is prepared and awaits npm web authentication for publication. The MP4 is blocked by the local capture environment; responsive screenshots exist under `artifacts/playwright/`.
