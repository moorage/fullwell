# Verification Evidence

Date: 2026-07-15

## Passing local evidence

- `npm run lint`, workspace typechecks, and workspace builds pass on the available Node 26.2.0 host; the production Docker build passes on pinned Node 24.1.0.
- Deterministic unit, component, and application coverage passes the enforced repository gate: 184 tests pass at 97.06% statements/lines, 95.07% functions, and 90.14% branches; nine Neon integration tests skip when no database URL is supplied.
- Coverage excludes process composition roots and Neon integration adapters from the deterministic unit denominator. Process roots remain covered by deployment/browser smoke checks; the Neon adapters remain covered by the isolated PostgreSQL integration gate.
- Neon integration passes all nine tests against isolated PostgreSQL 17, including transaction-scoped household lock serialization, passkey public-key/counter persistence, identity ownership, final-owner safety, OAuth token revocation, one-time export claims, and bounded operator-health aggregation.
- All five reversible migrations pass up/down/up against the isolated local database.
- Discoverable passkey registration, sign-in, pending-intent restoration, replay/binding rejection, account listing/removal, unsupported-browser states, and SimpleWebAuthn policy/error handling pass deterministic service, route, provider, React, memory-store, and PostgreSQL tests.
- Browser account lifecycle passes service, route, React, Git-fake, memory-store, and PostgreSQL tests for rename, browser-bound Apple/email linking, method removal, grant revocation, Git-audited leave, final-owner rejection, deletion, and former-member pseudonymization.
- Durable reconciliation passes deterministic and real PostgreSQL tests for post-commit projection failure, one-commit request-trailer replay, per-file projection revisions, membership repair, equal-head content drift, abandoned pre-commit cleanup, unsafe-repository quarantine, deterministic capability recovery, provisioning retry, and transaction-scoped account leave without nested-lock deadlock.
- Readable ZIP and full Git bundle delivery pass service, HTTP, account-route, React, Git, artifact-store, cleanup-worker, concurrency, expiry, and PostgreSQL tests. Downloads are content-hash verified, requester-bound, single-use, capped at 96 MiB, and backed by short-lived private files.
- Fail-closed global/grouped rate limits, trusted-proxy client keys, stable 429 responses, server-generated request IDs, structured redaction, pseudonymous identifiers, OpenMetrics output, dedicated operator authentication, production readiness, degraded health, reconciliation backlog, backup-gap, and volume-capacity reporting pass deterministic and real PostgreSQL tests.
- Backup cryptography and recovery pass deterministic tests for Ed25519 manifest signing, authenticated JWE encryption, object-type/key binding, ciphertext confidentiality, compliance-retention failure, checkpoint integrity, altered-content rejection, and real isolated Git bundle restore with HEAD/object-count/fsck verification. A generated SSH signing identity signs and verifies real commits through the production Git configuration, and the real AWS SDK adapter passes SigV4 PUT/HEAD/GET against a local S3-compatible boundary. PostgreSQL integration covers backup, repository-verification, restore-drill persistence, and schema `0005` aggregation.
- Contract, dual-host packaging, 20-case Codex/Claude eval, security-boundary, and isolated Git bundle restore suites pass.
- WebKit passes twelve end-to-end checks across desktop Safari emulation, iPhone, 320x568, and no-JavaScript projects, including account export layout, disclosure behavior, and horizontal-overflow checks.
- Safari on macOS was exercised through Computer Use: the Codex/Claude install selector updated through native accessibility controls and an invented collection capability displayed a non-enumerating unavailable state with no household fixture data.
- Safari also followed anonymous `/account` access to `/sign-in?returnTo=%2Faccount`, exposed Apple/passkey/email controls through accessibility APIs, preserved the pending-intent message, and accepted local email-field input without overlap.
- A 2026-07-15 Computer Use attempt to navigate native Safari to a temporary export-screen preview was inconclusive because the bridge replaced the typed localhost destination with `about:blank`; no export-screen native Safari claim is made from that attempt. The four WebKit export checks pass, while the manual accessibility review remains blocking.
- The repository screencast helper was attempted for the account export workflow, but the Homebrew macOS ffmpeg build rejected its required Linux `x11grab` input with exit code 234. No screencast artifact was produced; WebKit screenshots and interaction assertions provide the available local visual evidence.
- Local deployment and MCP discovery smoke pass at `http://127.0.0.1:4187`.
- Docker image build, Compose render with credential files, Caddy validation, and OpenTofu validation pass.
- `npm audit --omit=dev` reports zero production vulnerabilities.

## Blocking evidence still required

- Live Backblaze B2 Object Lock upload/download and Neon point-in-time/snapshot recovery require provisioned non-production infrastructure; local implementation, SSH signing, and persisted evidence paths are complete.
- Safari 26.5 WebDriver advertises virtual-authenticator support and accepted a CTAP2 platform authenticator, but credential creation timed out and credential enumeration reports `not implemented`; native passkey compatibility evidence remains required on a provisioned staging origin.
- Real Neon, Apple, Resend, Codex, Claude, DigitalOcean staging volume/failover, backup provider, secret-rotation, and production rollback checks require provisioned non-production credentials and infrastructure.
- The manual compatibility, privacy, accessibility, and launch checklists remain no-go until every blocking row is complete.
