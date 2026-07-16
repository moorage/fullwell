# Verification Evidence

Date: 2026-07-15

## Passing local evidence

- `npm run lint`, workspace typechecks, and workspace builds pass on the available Node 26.2.0 host; the production Docker build passes on pinned Node 24.1.0.
- Deterministic unit, component, and application coverage passes the enforced repository gate: 111 tests pass, four Neon integration tests skip when no database URL is supplied, and coverage is 96.93% statements/lines, 94.42% functions, and 90.04% branches.
- Coverage excludes process composition roots and Neon integration adapters from the deterministic unit denominator. Process roots remain covered by deployment/browser smoke checks; the Neon adapters remain covered by the isolated PostgreSQL integration gate.
- Neon integration passes all four tests against isolated PostgreSQL 17, including transaction-scoped household lock serialization.
- Both reversible migrations pass up/down/up against the isolated local database.
- Contract, dual-host packaging, 20-case Codex/Claude eval, security-boundary, and isolated Git bundle restore suites pass.
- WebKit passes eight end-to-end checks across desktop Safari emulation, iPhone, 320x568, and no-JavaScript projects.
- Safari on macOS was exercised through Computer Use: the Codex/Claude install selector updated through native accessibility controls and an invented collection capability displayed a non-enumerating unavailable state with no household fixture data.
- Local deployment and MCP discovery smoke pass at `http://127.0.0.1:4187`.
- Docker image build, Compose render with credential files, Caddy validation, and OpenTofu validation pass.
- `npm audit --omit=dev` reports zero production vulnerabilities.

## Blocking evidence still required

- WebAuthn passkey enrollment/sign-in, complete browser account lifecycle, durable post-commit reconciliation, encrypted off-site backup, readable ZIP delivery, production rate limiting/telemetry, and full accessibility/security/load suites are incomplete.
- Real Neon, Apple, Resend, Codex, Claude, DigitalOcean staging volume/failover, backup provider, secret-rotation, and production rollback checks require provisioned non-production credentials and infrastructure.
- The manual compatibility, privacy, accessibility, and launch checklists remain no-go until every blocking row is complete.
