# Verification Evidence

Date: 2026-07-15

## Passing local evidence

- `npm run lint`, workspace typechecks, and workspace builds pass on the available Node 26.2.0 host; the production Docker build passes on pinned Node 24.1.0.
- Deterministic unit, component, and application coverage passes the enforced repository gate: 125 tests pass, five Neon integration tests skip when no database URL is supplied, and coverage is 97.38% statements/lines, 94.80% functions, and 90.21% branches.
- Coverage excludes process composition roots and Neon integration adapters from the deterministic unit denominator. Process roots remain covered by deployment/browser smoke checks; the Neon adapters remain covered by the isolated PostgreSQL integration gate.
- Neon integration passes all five tests against isolated PostgreSQL 17, including transaction-scoped household lock serialization and passkey public-key/counter persistence.
- All three reversible migrations pass up/down/up against the isolated local database.
- Discoverable passkey registration, sign-in, pending-intent restoration, replay/binding rejection, account listing/removal, unsupported-browser states, and SimpleWebAuthn policy/error handling pass deterministic service, route, provider, React, memory-store, and PostgreSQL tests.
- Contract, dual-host packaging, 20-case Codex/Claude eval, security-boundary, and isolated Git bundle restore suites pass.
- WebKit passes eight end-to-end checks across desktop Safari emulation, iPhone, 320x568, and no-JavaScript projects.
- Safari on macOS was exercised through Computer Use: the Codex/Claude install selector updated through native accessibility controls and an invented collection capability displayed a non-enumerating unavailable state with no household fixture data.
- Local deployment and MCP discovery smoke pass at `http://127.0.0.1:4187`.
- Docker image build, Compose render with credential files, Caddy validation, and OpenTofu validation pass.
- `npm audit --omit=dev` reports zero production vulnerabilities.

## Blocking evidence still required

- Complete browser account lifecycle, durable post-commit reconciliation, encrypted off-site backup, readable ZIP delivery, production rate limiting/telemetry, and full accessibility/security/load suites are incomplete.
- Safari 26.5 WebDriver advertises virtual-authenticator support and accepted a CTAP2 platform authenticator, but credential creation timed out and credential enumeration reports `not implemented`; native passkey compatibility evidence remains required on a provisioned staging origin.
- Real Neon, Apple, Resend, Codex, Claude, DigitalOcean staging volume/failover, backup provider, secret-rotation, and production rollback checks require provisioned non-production credentials and infrastructure.
- The manual compatibility, privacy, accessibility, and launch checklists remain no-go until every blocking row is complete.
