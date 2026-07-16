# Quality Ledger

Purpose: make structural quality and implementation debt explicit without awarding aspirational architecture credit before code exists.

Scoring scale:
- 5 = strong, exercised, and evidenced
- 4 = solid with minor gaps
- 3 = acceptable with notable debt
- 2 = fragile or mostly unproven
- 1 = absent or high risk

Last refreshed: 2026-07-16
Refresh owner: knowledge automation plus reviewer of affected changes

## Scorecard

- Architecture legibility: 4 - product, authority, adapter, and deployment boundaries are explicit and represented in the implementation; external staging proof remains incomplete.
- Boundary parsing and type discipline: 4 - strict TypeScript contracts and runtime schemas cover HTTP, MCP, Git, provider, persistence, and migration boundaries; provisioned-provider verification remains incomplete.
- Test strength: 4 - the enforced deterministic coverage gate, contracts, dual-host evals, isolated Codex/Claude lifecycle tests, PostgreSQL integration, migrations, security fixtures, deterministic load/race, axe/WebKit accessibility, Git restore, and deployment smokes pass; provisioned load, manual accessibility, and external compatibility suites remain open.
- Reliability and observability: 4 - durable reconciliation, fail-closed readiness, operator health, redacted structured events, protected OpenMetrics, encrypted/object-locked backup, persisted verification/drill state, and deployment controls exist; live provider and failover drills remain release blockers.
- Security hardening: 4 - trust boundaries, typed authorization, central telemetry redaction, capability projection, OAuth/passkey controls, per-route rate limits, final-owner enforcement, and the deterministic adversarial matrix pass; external staging and manual security review remain open.
- Documentation freshness: 4 - product, architecture, operations, release evidence, and the active ExecPlan reflect the implemented foundation and known blockers.
- Operational simplicity: 3 - one service, one writer, daily backup, and automatic monthly drill are locally deployable, but Droplet failover and provisioned off-site recovery remain unproven.

## Evidence

- `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md` define normative acceptance behavior.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/RELIABILITY.md` define the target authorities and failure boundaries.
- Deterministic unit/component/load/security coverage passes with 191 tests at 97.07% statements/lines, 95.07% functions, and 90.46% branches; Neon integration adapters and process roots retain dedicated environment gates.
- Contract, 20-case Codex/Claude eval, isolated Codex CLI 0.144.4 and Claude Code 2.1.123 plugin lifecycle, nine-test local PostgreSQL and managed Neon integration, reversible local migration, idempotent managed-Neon forward migration, one-day managed-Neon PITR, account lifecycle, security-boundary, WebKit e2e, Git restore, local deployment, MCP discovery, Docker, Caddy, Compose, and OpenTofu checks pass.
- `apps/`, `packages/`, `migrations/`, `infra/`, and `deploy/` contain the coordinated React 19.2, Fastify, Neon, Git, agent-package, and DigitalOcean foundation.

## Structural debt register

- Native passkey compatibility still requires staging-origin evidence because Safari 26.5's advertised WebDriver virtual authenticator timed out during credential creation.
- DigitalOcean Block Storage failover fencing, live Backblaze Object Lock behavior, production Neon 30-day history/scheduled snapshots, combined Git-plus-Neon RPO/RTO recovery, external restore drills, and provisioned staging rollback remain unproven.
- The immutable npm agent package is not yet published; real Apple, email, Codex, and Claude interoperability still need non-production credentials and external compatibility evidence.
- Manual VoiceOver, authenticated keyboard/zoom accessibility, iPhone hardware and non-Apple screen-reader coverage, provisioned load/soak and OAuth/import/Neon race coverage, privacy, secret-rotation, and manual release reviews remain no-go gates.

## Maintenance rule

Do not increase a score because a plan or document exists. Change scores only when implementation and verification evidence materially justify it.
