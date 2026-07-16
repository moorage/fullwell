# Quality Ledger

Purpose: make structural quality and implementation debt explicit without awarding aspirational architecture credit before code exists.

Scoring scale:
- 5 = strong, exercised, and evidenced
- 4 = solid with minor gaps
- 3 = acceptable with notable debt
- 2 = fragile or mostly unproven
- 1 = absent or high risk

Last refreshed: 2026-07-15
Refresh owner: knowledge automation plus reviewer of affected changes

## Scorecard

- Architecture legibility: 4 - product, authority, adapter, and deployment boundaries are explicit and represented in the implementation; external staging proof remains incomplete.
- Boundary parsing and type discipline: 4 - strict TypeScript contracts and runtime schemas cover HTTP, MCP, Git, provider, and persistence boundaries; provisioned-provider verification remains incomplete.
- Test strength: 4 - the enforced deterministic coverage gate, contracts, dual-host evals, PostgreSQL integration, migrations, security fixtures, WebKit e2e, Git restore, and deployment smokes pass; full accessibility, load, and external compatibility suites remain open.
- Reliability and observability: 3 - health, mutation-state, reconciliation, backup, restore, and deployment primitives exist, but durable reconciliation, production telemetry, off-site backup, and failover drills remain release blockers.
- Security hardening: 3 - trust boundaries, typed authorization, redaction, capability projection, OAuth controls, and security fixtures exist; passkeys, production rate limits, and the complete adversarial suite remain open.
- Documentation freshness: 4 - product, architecture, operations, release evidence, and the active ExecPlan reflect the implemented foundation and known blockers.
- Operational simplicity: 3 - one service and one writer are simple and locally deployable, but Droplet failover and durable off-site recovery remain unproven.

## Evidence

- `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md` define normative acceptance behavior.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/RELIABILITY.md` define the target authorities and failure boundaries.
- Deterministic unit/component coverage passes with 111 tests at 96.93% statements/lines, 94.42% functions, and 90.04% branches; Neon integration adapters and process roots retain dedicated environment gates.
- Contract, 20-case Codex/Claude eval, PostgreSQL integration, reversible migration, security-boundary, WebKit e2e, Git restore, local deployment, MCP discovery, Docker, Caddy, Compose, and OpenTofu checks pass.
- `apps/`, `packages/`, `migrations/`, `infra/`, and `deploy/` contain the coordinated React 19.2, Fastify, Neon, Git, agent-package, and DigitalOcean foundation.

## Structural debt register

- Passkey enrollment/sign-in, the complete browser account lifecycle, readable ZIP delivery, durable post-commit reconciliation, and production rate limiting/telemetry remain incomplete.
- DigitalOcean Block Storage failover fencing, immutable off-site backup, external restore drills, and provisioned staging rollback remain unproven.
- Real Neon, Apple, email, Codex, and Claude interoperability still needs non-production credentials and external compatibility evidence.
- Full accessibility, load/race, privacy, secret-rotation, and manual release reviews remain no-go gates.

## Maintenance rule

Do not increase a score because a plan or document exists. Change scores only when implementation and verification evidence materially justify it.
