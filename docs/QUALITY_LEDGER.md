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

- Architecture legibility: 4 - product and deployment boundaries are explicit; implementation has not tested them.
- Boundary parsing and type discipline: 1 - required by the harness, not implemented.
- Test strength: 2 - harness tests exist; application, contract, eval, integration, security, and e2e suites do not.
- Reliability and observability: 1 - requirements exist; service health, mutation recovery, backups, and telemetry do not.
- Security hardening: 1 - trust boundaries are documented; application controls are not implemented.
- Documentation freshness: 4 - harness guidance is specialized to the accepted specs and stack.
- Operational simplicity: 3 - one service and one writer are simple, but Droplet failover and durable Git operations remain unproven.

## Evidence

- `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md` define normative acceptance behavior.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/RELIABILITY.md` define the target authorities and failure boundaries.
- `scripts/git-hooks/` and `scripts/self-improvement/` have deterministic harness tests.
- No `apps/`, `packages/`, `migrations/`, application tests, or deployment definitions exist yet.

## Structural debt register

- Foundation implementation is absent: React 19.2, TypeScript server, contracts, Neon migrations, Git adapter, and deployment artifacts remain to be built.
- DigitalOcean Block Storage mount validation, single-writer failover fencing, off-site backup, and restore drills are unproven.
- Neon transaction-scoped advisory-lock behavior and migration strategy need integration tests against isolated branches.
- OAuth/MCP interoperability across Codex and Claude and the dual-host agent package need contract tests and evals.
- Public collection privacy, import prompt-injection handling, and cross-household authorization need security fixtures before release.

## Maintenance rule

Do not increase a score because a plan or document exists. Change scores only when implementation and verification evidence materially justify it.
