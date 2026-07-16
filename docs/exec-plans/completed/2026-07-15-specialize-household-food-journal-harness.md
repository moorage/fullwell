# Specialize the Household Food Journal Harness

## Purpose / Big Picture
Turn the generic Codex project harness into the implementation control plane for the Household Food Journal described by the client and server specifications currently under `tmp/`. The specialized harness must make the chosen runtime and deployment boundaries explicit before product code is added: a React 19.2 browser frontend, one containerized TypeScript server on a DigitalOcean Droplet, a DigitalOcean Block Storage volume for authoritative household Git repositories, and Neon PostgreSQL for operational state.

The observable outcome is a contributor or coding agent that can start from `AGENTS.md` and discover the product contracts, module boundaries, security and reliability invariants, target layout, and honest verification commands without encountering stale medical, Twilio, voice, or generic-template guidance.

## Progress
- [x] 2026-07-15T23:30Z: Read the repository workflow, current generic harness, self-improvement configuration, and both source specifications.
- [x] 2026-07-15T23:34Z: Completed architecture, security, reliability, UX, and agent-eval framing and critiqued the proposed specialization.
- [x] 2026-07-15T23:39Z: Promoted both specifications and specialized architecture, security, reliability, coding, quality, and contributor guidance for React 19.2, DigitalOcean, and Neon.
- [x] 2026-07-15T23:41Z: Replaced generic harness paths and medical-template heuristics, removed passing application placeholders, and added five knowledge-heuristic tests.
- [x] 2026-07-15T23:44Z: Refreshed self-improvement and repository knowledge, reviewed documentation drift, and passed the complete harness verification gate.

## Surprises & Discoveries
- 2026-07-15: The repository contains no application implementation yet; it is a fully untracked generic harness scaffold. This change should specialize the control plane without pretending unimplemented product checks pass.
- 2026-07-15: DigitalOcean App Platform's ephemeral application filesystem is incompatible with the server specification's authoritative Git store. The initial target must use a Droplet with attached Block Storage and remain single-instance until shared Git filesystem semantics are proven.
- 2026-07-15: The server specification recommends server-rendered pages and says not to add a client framework without need, while the user has now selected React 19.2. The later decision is authoritative, but React remains a presentation boundary served by the single application service rather than a separate backend or authority layer.
- 2026-07-15: Neon's pooled endpoint uses transaction-mode PgBouncer, so session-scoped advisory locks and session state are unsafe. Household serialization must use a transaction-scoped lock on the same checked-out connection and transaction as the durable mutation state transition; migrations use a direct connection.
- 2026-07-15: Initial verification exposed a generic-fallback test assertion and the harness validator's tracked empty-backlog requirement. The assertion remains generic by design, and an empty `.gitkeep` preserves the required directory without inventing an idea.
- 2026-07-15: The repository-map generator included filenames from ignored raw self-improvement runtime storage. The generator now excludes `.codex/self-improvement/`, and a regression test enforces that privacy boundary.
- 2026-07-15: The hook runtime reported some large `sed` and `rg` reads as failed even when they were observational. Candidate distillation now ignores those read-only command families while preserving real verification failures.

## Decision Log
- 2026-07-15: Promote both source specifications into `docs/product-specs/` unchanged except for repository-local companion links and explicit approved stack decisions. Product truth must not remain only under ignored `tmp/`.
- 2026-07-15: Use one TypeScript monorepo with planned surfaces under `apps/server/`, `apps/web/`, `packages/contracts/`, and `packages/agent-client/`. The server will serve the built React frontend so version 1 remains one deployable application service.
- 2026-07-15: Deploy the initial server as one container on one DigitalOcean Droplet with `/data/households` on an attached Block Storage volume. Neon owns only operational PostgreSQL data; Git remains authoritative for journal content.
- 2026-07-15: Keep application quality commands documented as required future contracts, but do not wire success-shaped placeholders into the current `verify` command. Current verification proves the harness only.

## Context and Orientation
`AGENTS.md` is the contributor entry point. `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/RELIABILITY.md`, and `docs/CODING_STANDARDS.md` currently contain mostly empty or stale template guidance. `package.json`, `.codex/local-environment.yaml`, and `.codex/self-improvement.config.json` still identify a generic project and expose unrelated webhook, voice, and patient-agent smoke placeholders. `scripts/knowledge/suggest_doc_updates.py` also contains medical-product path heuristics.

The product contracts are `tmp/household-food-journal-server-spec.md` and `tmp/household-food-journal-client-spec.md`. The server contract makes Git authoritative for household content while PostgreSQL stores operational identity, authorization, OAuth, idempotency, locking, and projections. The client contract defines a shared Codex and Claude skill package that uses only the hosted MCP service for canonical mutations and leaves semantic food decisions to the agent.

Framing notes from the expert roundtable:
- Architecture: keep one deployable service, share runtime contracts, and isolate Git, Neon, identity, mail, and clock behind typed adapters.
- Security: fail closed on projection drift, never expose repository credentials to clients, and keep public collection snapshots separate from household membership.
- Reliability: serialize mutations with Neon advisory locks plus durable mutation records, use persistent DigitalOcean storage, and require backup/restore evidence before launch.
- UX and accessibility: React 19.2 owns browser interaction and presentation, while the server remains authoritative for sessions, authorization, validation, and pending intents.
- Agent and evals: program code must not replace LLM semantic judgments; prompt/skill changes require contract tests and cross-host eval fixtures.

Feature-critic findings folded into this plan:
- Must fix: make the DigitalOcean persistent-volume topology and single-instance constraint explicit.
- Must fix: state that Neon is not a second source of truth for journal content and that authorization fails closed on projection mismatch.
- Must fix: preserve append-only, idempotency, OAuth, public-share privacy, and agent semantic-authority invariants in the top-level harness.
- Should fix: remove stale medical and voice commands so agents do not run irrelevant checks or update the wrong specs.
- Monitor: final React rendering mode and routing library remain implementation decisions; they must not create a second service or weaken accessible server-controlled flows.

## Milestones

### Milestone 1 - Durable Product and Architecture Guidance
Files:
- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/index.md`
- `README.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/CODING_STANDARDS.md`

Tasks:
1. Promote the two source specifications into the durable product-spec directory and record the approved stack choices.
2. Replace generic and stale contributor guidance with the target monorepo, authority boundaries, and product-specific workflows.
3. Document that application modules are planned rather than already implemented.

Verification:
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 2 - Security, Reliability, and Harness Configuration
Files:
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/QUALITY_LEDGER.md`
- `.codex/self-improvement.config.json`
- `.codex/local-environment.yaml`
- `package.json`
- `package-lock.json`
- `.node-version`
- `.nvmrc`
- `scripts/knowledge/suggest_doc_updates.py`
- `scripts/self-improvement/self-improvement.test.mjs`

Tasks:
1. Encode the DigitalOcean, Neon, OAuth, Git storage, tenant-isolation, backup, and reconciliation contracts.
2. Replace generic app paths and stale commands with Household Food Journal paths and harness checks.
3. Keep unimplemented application gates explicit instead of representing placeholder output as successful verification.

Verification:
- `npm run test:unit`
- `npm run knowledge:suggest`
- `npm run self-improve:context`

### Milestone 3 - Generated Knowledge and Final Verification
Files:
- `docs/CONTEXT_LEDGER.md`
- `docs/generated/repo-map.json`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/exec-plans/active/2026-07-15-specialize-household-food-journal-harness.md`

Tasks:
1. Refresh deterministic knowledge artifacts after the tree and configuration change.
2. Record commands, evidence, and remaining implementation risk.
3. Review the final diff for stale guidance, doc drift, and accidental changes.
4. Move this plan to `docs/exec-plans/completed/` after all acceptance checks pass.

Verification:
- `npm run knowledge:refresh`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification
- The durable product specs define the approved DigitalOcean, Neon, and React 19.2 choices without weakening the normative client/server behavior.
- The architecture names one deployable application service, the authoritative Git store, the Neon operational store, the React presentation boundary, and the shared agent-client package.
- No contributor-facing harness command or knowledge heuristic refers to patients, doctors, Twilio, voice, or an internal dashboard.
- Current checks prove harness behavior; no unimplemented product suite reports a false pass.
- Required commands:
  - `npm run test:unit`
  - `npm run knowledge:suggest`
  - `npm run self-improve:context`
  - `npm run knowledge:refresh`
  - `npm run verify`
  - `npm run verify:docs`
  - `npm run verify:execplan`

Recovery:
- Revert this documentation and configuration change as one unit if the deployment decisions change before application work begins.
- Product data migration or database rollback is not required because this plan changes no runtime, database, or deployed infrastructure.

## Outcomes & Retrospective
The generic harness is now specialized for the Household Food Journal. Durable product specs, architecture, coding, security, reliability, quality, contributor, Codex, Node, and knowledge-maintenance surfaces agree on React 19.2, one TypeScript application service on a DigitalOcean Droplet, DigitalOcean Block Storage for authoritative Git repositories, Neon PostgreSQL for operational state, and one shared Codex/Claude client package.

Verification passed through `npm run test:unit`, `npm run verify:ideas`, `npm run verify:docs`, `npm run verify:execplan`, `npm run knowledge:suggest`, `npm run self-improve:distill`, `npm run self-improve:context`, `npm run knowledge:refresh`, and `npm run verify`. The final unit gate includes Git-hook tests, self-improvement tests, and six knowledge-maintenance tests.

No application or infrastructure was provisioned. React dependencies, server code, Neon migrations, DigitalOcean deployment, OAuth/MCP interoperability, persistent-volume failover, backup/restore, and product runtime suites remain future ExecPlan work. The harness pins Node 24 LTS; this session's available runtime was Node 26.2.0.
