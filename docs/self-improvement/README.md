# Self-Improvement Loop

This harness uses Codex lifecycle hooks to capture local work signals, distill them into candidate lessons, and keep durable guidance small.

## Flow

1. Capture hook events into ignored runtime traces under `.codex/self-improvement/`.
2. Distill traces with `npm run self-improve:distill`.
3. Gate lessons with deterministic evidence: repeat occurrence or real failure.
4. Materialize safe summaries into `docs/self-improvement/candidate-lessons.md` and `docs/CONTEXT_LEDGER.md`.
5. Verify the contracts with `npm run test:self-improvement`.

## Hook surfaces

- `.codex/hooks.json` registers repo-local hooks.
- `.codex/hooks/capture_event.mjs` records prompt, tool, compaction, and subagent signals.
- `.codex/hooks/stop_verify.mjs` asks Codex to continue when changed files exist without configured verification commands.
- `.codex/hooks/session_context.mjs` injects the generated context ledger at session start.
- `.codex/hooks/session_wrapup.mjs` writes an ignored runtime summary from recent traces.

## App adaptation

Tune `.codex/self-improvement.config.json` when copying this harness to another app:

- `appType` names the app family, such as `node-web`, `python-api`, `swift-ios`, or `docs-only`.
- `pathGroups` maps repository paths to docs, ExecPlans, evals, and app code.
- `stopVerification` lists commands expected after generic, docs, ExecPlan, and eval changes.
- `gate.minOccurrences` controls when repeated non-failure signals become promotable.

Keep raw traces ignored. If a lesson should become permanent, promote it manually to the smallest durable surface: `AGENTS.md`, `docs/CONTEXT_LEDGER.md`, an eval fixture, or a reusable skill.

## Example app profiles

For a Python API, set `appType` to `python-api`, include `pyproject.toml`, `src/`, and `tests/` in `pathGroups.app`, and use commands such as `pytest` and `python -m ruff check .`.

For a Swift app, set `appType` to `swift-app`, include `Package.swift`, `Sources/`, and `Tests/`, and use commands such as `swift test` or the relevant Xcode build command.

For a docs-only harness, set `appType` to `docs-only`, keep `pathGroups.app` empty, and make `changedFileCommands` point at docs and link checks only.
