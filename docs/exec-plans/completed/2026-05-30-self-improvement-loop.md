# Self-Improvement Loop

## Purpose / Big Picture
Build a generic, repo-local self-improvement loop for Codex project harnesses. The loop captures agent work signals through lifecycle hooks, distills them into candidate lessons, gates promotion on repetition or real failure, materializes safe summaries into repo docs, and verifies the loop with deterministic tests.

This should work for different app types by using configurable path groups and verification commands instead of assuming a specific framework.

## Progress
- [x] 2026-05-30T00:26Z: Drafted the implementation plan and scoped the loop around local hooks, redacted traces, deterministic distillation, generated context, and tests.
- [x] 2026-05-30T00:31Z: Implemented generic hook entrypoints, shared self-improvement library, and app-specific config.
- [x] 2026-05-30T00:33Z: Added generated context ledger, candidate lesson docs, README guidance, architecture/security/reliability updates, and runtime trace ignores.
- [x] 2026-05-30T00:33Z: Added self-improvement unit tests and wired them into `test:unit` and `verify`.
- [x] 2026-05-30T00:34Z: Ran `npm run self-improve:distill`, `npm run self-improve:context`, `npm run knowledge:refresh`, and `npm run verify` successfully.
- [x] 2026-05-30T00:36Z: Enabled Codex hooks explicitly in `.codex/config.toml`, regenerated context, and reran `npm run verify` successfully.

## Surprises & Discoveries
- 2026-05-30: Codex supports `Stop`, `SessionStart`, `UserPromptSubmit`, tool-use, compaction, and subagent hooks, but not a documented `SessionEnd` hook. The implementation will use `Stop` plus explicit scheduled scripts for wrap-up and materialization.
- 2026-05-30: Hook handlers for the same event may run concurrently, so the verification hook and wrap-up hook must not depend on each other's side effects.

## Decision Log
- 2026-05-30: Store raw traces under ignored `.codex/self-improvement/` and materialize only sanitized summaries into tracked docs. This preserves learning value without committing prompt or command-output details.
- 2026-05-30: Use deterministic gates first: promote candidates only when a signal repeats or a tool/test failure is observed. This avoids unbounded memory growth and avoids trusting LLM-generated lessons without evidence.
- 2026-05-30: Keep app-specific behavior in `.codex/self-improvement.config.json`. The hook code should support Node, Python, Swift, docs-only, and other app shapes through config and defaults.
- 2026-05-30: Add a one-continuation guard and a documented skip token for stop verification. This keeps the hook useful without trapping sessions in repeated verification prompts.

## Context and Orientation
Relevant current files:
- `AGENTS.md` defines the repo's autonomous workflow, required verification, and documentation maintenance rules.
- `.codex/config.toml` enables Codex multi-agent/app features but currently has no checked-in hooks.
- `package.json` contains verification scripts, including `verify`, `verify:docs`, and `verify:execplan`.
- `docs/ARCHITECTURE.md`, `docs/RELIABILITY.md`, `docs/SECURITY.md`, and `docs/QUALITY_LEDGER.md` are the long-lived guidance surfaces that should not absorb every transient lesson.
- `docs/IMPLEMENTATION_LOG.md` records meaningful implementation outcomes.

Framing notes from the expert roundtable:
- Security lens: raw prompts and command output may contain secrets; traces must be redacted and ignored by Git.
- Reliability lens: stop hooks should guide completion, not create infinite continuation loops.
- Staff engineering lens: the feature needs a small stable core and app-specific config rather than framework-specific assumptions.
- Evals lens: self-improvement must have tests that prove repeated corrections and failures become candidates.
- UX lens: agent guidance should be short and current; the context ledger should summarize what matters now instead of bloating `AGENTS.md`.

Feature-critic findings before implementation:
- Must fix: stop verification needs an explicit bypass for intentional documentation-only or investigation-only turns.
- Must fix: generated candidate docs cannot include raw prompt excerpts or full command output.
- Should fix: scripts should work when the repository is not inside Git, so this harness can be copied into early scaffolds.
- Monitor: the first version does not call an LLM to distill nuanced lessons; this is intentional until deterministic trace capture is proven.

## Milestones

### Milestone 1 - Hook Runtime
Files:
- `.codex/hooks.json`
- `.codex/hooks/capture_event.mjs`
- `.codex/hooks/session_context.mjs`
- `.codex/hooks/session_wrapup.mjs`
- `.codex/hooks/stop_verify.mjs`
- `scripts/self-improvement/lib.mjs`
- `.codex/self-improvement.config.json`

Tasks:
1. Add lifecycle hook configuration for session start, prompt capture, post-tool capture, compaction, stop verification, and stop wrap-up.
2. Implement a shared library for safe JSON input, redaction, trace append, config loading, candidate distillation, stop verification decisions, and context generation.
3. Ensure hooks are safe when stdin is missing, Git is unavailable, or runtime directories are absent.

Verification:
- `npm run test:self-improvement`

### Milestone 2 - Materialized Context and Docs
Files:
- `docs/CONTEXT_LEDGER.md`
- `docs/self-improvement/README.md`
- `docs/self-improvement/candidate-lessons.md`
- `.gitignore`
- `README.md`

Tasks:
1. Add scripts that distill raw traces into sanitized candidate lessons.
2. Generate a context ledger from config, active plans, candidate lessons, and repository state.
3. Document how app-specific projects tune path groups and verification commands.
4. Ignore raw runtime traces.

Verification:
- `npm run self-improve:distill`
- `npm run self-improve:context`

### Milestone 3 - Test and Verification Integration
Files:
- `scripts/self-improvement/self-improvement.test.mjs`
- `package.json`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/exec-plans/active/2026-05-30-self-improvement-loop.md`

Tasks:
1. Add unit coverage for redaction, candidate gating, stop verification, and context rendering.
2. Wire the self-improvement test into `test:unit` and repo verification.
3. Update implementation documentation and plan progress.

Verification:
- `npm run test:self-improvement`
- `npm run test:unit`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification
- `.codex/hooks.json` defines repo-local Codex hooks using git-root-stable script paths.
- Raw traces are written only under ignored `.codex/self-improvement/`.
- Candidate lessons are promoted only when repeated or backed by a failure signal.
- `docs/CONTEXT_LEDGER.md` can be regenerated and gives a concise current-state summary.
- App-specific behavior is controlled by `.codex/self-improvement.config.json`.
- Tests prove the redaction, gating, stop verification, and ledger rendering contracts.
- Required commands:
  - `npm run test:self-improvement`
  - `npm run test:unit`
  - `npm run verify`
  - `npm run verify:docs`
  - `npm run verify:execplan`

Recovery:
- Hooks can be disabled by removing `.codex/hooks.json` or setting `[features].hooks = false` in Codex config.
- Runtime traces can be deleted from `.codex/self-improvement/` without breaking tracked docs.

## Outcomes & Retrospective
Implemented a repo-local self-improvement loop with Codex hook entrypoints, redacted trace capture, deterministic candidate distillation, stop-time verification guidance, generated context, and tests.

Remaining risk: hooks must be reviewed/trusted in Codex before they run, and the first version intentionally uses deterministic candidate rules instead of nuanced LLM distillation.
