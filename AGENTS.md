# AGENTS.md

Purpose: this repository is optimized for safe, autonomous Codex work.
Start here. Use this file as the map of what is real today and how to extend it safely.

## Repository shape

Current control-plane surfaces:
- `docs/product-specs/` - normative client and server behavior
- `docs/exec-plans/` - living implementation plans and completed delivery history
- `.agents/skills/` - repository-local agent workflows
- `.codex/` - Codex configuration, hooks, and self-improvement settings
- `scripts/` - harness verification and knowledge maintenance

Planned application surfaces:
- `apps/server/` - TypeScript HTTP, MCP, OAuth, Git mutation, and worker runtime
- `apps/web/` - React 19.2 browser experience, built into the server artifact
- `packages/contracts/` - shared semantic types and runtime schemas
- `packages/agent-client/` - shared Codex and Claude skills, manifests, tests, and evals
- `migrations/` - reversible Neon PostgreSQL migrations
- `tests/` - cross-package contract, integration, security, and browser tests

## First reads
Before non-trivial work, read in this order:

1. `docs/ARCHITECTURE.md`
2. `docs/PLANS.md`
3. `docs/CONTEXT_LEDGER.md` when the task is broad, resumed, or touches harness workflow
4. `docs/ideas/README.md` when the work is exploratory or you are promoting an existing idea
5. `docs/EXECUTION_GUIDE.md`
6. the relevant file under `docs/product-specs/`
7. the relevant file under `docs/ideas/backlog/` if one exists
8. the nearest nested `AGENTS.md`

## Required workflow
- For exploratory or pre-implementation work:
  - capture or update the idea in `docs/ideas/index.md`
  - create or update a fuller brief under `docs/ideas/backlog/` before the work turns into an execution plan
- For any task likely to span more than ~30 minutes, more than one module, or any architectural choice:
  - create or update an ExecPlan in `docs/exec-plans/active/`
  - do not use `docs/ideas/` as a substitute for an ExecPlan once implementation starts
- Search before adding:
  - do not assume functionality is missing
  - search for existing types, route helpers, provider adapters, smoke scripts, and docs guidance
- Prefer one meaningful change per loop
- Keep changed guidance in sync:
  - user-visible behavior change -> update the relevant product spec
  - boundary or module change -> update `docs/ARCHITECTURE.md`
  - reliability/security posture change -> update the matching doc
  - agent skill or eval workflow change -> update `packages/agent-client/`, `packages/contracts/`, and both product specs as applicable
- repeated correction -> update the nearest `AGENTS.md` or create a skill
- repeated correction or failed verification -> run `npm run self-improve:distill` and promote only lessons that repeated or caused a real failure
- After code changes:
  - run the narrowest relevant tests first
  - if the change is a major feature implementation or changes an end-to-end setup, invitation, journal, collection, import, export, or account workflow, run `npm run test:e2e`
  - then run `npm run verify`
  - then run `npm run verify:docs`
  - then run `npm run verify:execplan` when an active ExecPlan changed
- Before finishing:
  - review diffs for doc drift
  - refresh generated knowledge artifacts when the tree or quality ledger changed
  - update `docs/IMPLEMENTATION_LOG.md` when work followed an active ExecPlan

## Invariants
- parse all external input at the boundary
- no raw HTTP, OAuth, MCP, email-provider, or Git-process payloads in domain logic
- no direct external SDK, Neon driver, Git process, mail, clock, or randomness use outside typed adapters
- parse env/config once and pass typed config around
- do not log access or refresh tokens, invitation/share tokens, emails, household titles, food names, order IDs, source URLs, or full inbound bodies
- user-visible behavior changes require tests and spec updates
- public interfaces require logs, failure signals, and a smoke path
- Git is authoritative for household journal content; Neon owns operational state and rebuildable projections only
- the central service is the only Git writer; browsers and agent clients never receive repository credentials
- React is a presentation boundary; authorization, pending intents, validation, and mutations remain server-authoritative
- use transaction-scoped PostgreSQL advisory locks for household mutations; pooled Neon connections must never rely on session state
- repositories must live on the mounted DigitalOcean Block Storage volume, never the Droplet root disk or ephemeral container filesystem
- program code must not classify foods, merge semantic identities, infer recipe status, or author journal reports

## Where truth lives
- architecture map: `docs/ARCHITECTURE.md`
- execution-plan standard: `docs/PLANS.md`
- ideation backlog and prioritization rules: `docs/ideas/`
- security rules: `docs/SECURITY.md`
- reliability rules: `docs/RELIABILITY.md`
- quality ledger and debt register: `docs/QUALITY_LEDGER.md`
- current generated context: `docs/CONTEXT_LEDGER.md`
- self-improvement loop: `docs/self-improvement/`
- product requirements: `docs/product-specs/`
- execution guide: `docs/EXECUTION_GUIDE.md`
- implementation log: `docs/IMPLEMENTATION_LOG.md`

## Automatic maintenance
- knowledge-base CI validates required docs and the generated repo map
- quality-gc refreshes the quality timestamp and repo map on a schedule
- the ideation backlog can be validated directly with `npm run verify:ideas`
- active ExecPlans can be validated directly with `npm run verify:execplan`
- if a workflow repeats twice, convert it into a skill under `.agents/skills/`

## Codex surfaces
- CLI-native surfaces:
  - `AGENTS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PLANS.md`
  - `docs/ideas/`
  - `.codex/config.toml`
  - `npm run verify`
  - `npm run verify:ideas`
  - `npm run verify:docs`
  - `npm run verify:execplan`
  - `npm run knowledge:refresh`
- Codex app-only convenience surfaces:
  - `.codex/local-environment.yaml` setup and actions
  - these actions must only mirror real commands that still work from the terminal
  - the default first-run path is: `npm install`, `npm run hooks:install`, then use the local-environment actions for routine verify and knowledge tasks when running inside the Codex app
- Optional capture surface:
  - `npm run capture:screencast`
  - `npm run capture:screencast:run`
  - these are convenience helpers for visible workflow evidence only and are not part of the required verify gate

## Commands
- install: `npm install`
- harness unit tests: `npm run test:unit`
- git hook tests: `npm run test:git-hooks`
- self-improvement tests: `npm run test:self-improvement`
- knowledge heuristic tests: `npm run test:knowledge`
- repo verify: `npm run verify`
- idea backlog verify: `npm run verify:ideas`
- docs verify: `npm run verify:docs`
- ExecPlan verify: `npm run verify:execplan`
- regenerate knowledge artifacts: `npm run knowledge:refresh`
- install git hooks: `npm run hooks:install`
- record screencast: `npm run capture:screencast -- --output artifacts/screencasts/<feature-name>.mp4`

Application commands required as their owning modules land:
- lint: `npm run lint`
- typecheck: `npm run typecheck`
- unit tests: `npm run test:unit`
- contract tests: `npm run test:contract`
- integration tests: `npm run test:integration`
- security tests: `npm run test:security`
- agent evals: `npm run test:evals`
- browser e2e: `npm run test:e2e`
- production build: `npm run build`
- local server: `npm run dev`
- deployed health and persistence smoke: `npm run test:deploy-smoke`

Do not add a success-shaped placeholder for an application command. Add the command and its real implementation in the same change.

## PR expectations
- include acceptance evidence
- include changed docs where applicable
- include exact commands run
- include screencast evidence for new or materially changed visible workflows when capture is possible
- include remaining risks and follow-ups

## Commit messages

- Every commit message must include exactly one Git trailer named `AI-Model`.
- Use `AI-Model: <model-version>` when an AI model was used, for example `AI-Model: gpt-5.5`.
- Use `AI-Model: none` when no AI model was used.
- The `.githooks/commit-msg` hook enforces this policy after `scripts/install-git-hooks.mjs` configures `core.hooksPath`.

## Code comments

- When adding or reviewing TypeScript/JavaScript comments, use the `high-quality-code-comments` skill.
- Comments should explain contracts, invariants, edge cases, tradeoffs, failure modes, and external coupling. Do not add comments that restate obvious code. Prefer better names, types, or structure over comments when possible.
- Prioritize contract-first comments near public APIs, hardware/control boundaries, retries/timeouts, auth/privacy boundaries, state machines, concurrency, schema transformations, vendor/API assumptions, and code that looks weird but is intentional.
