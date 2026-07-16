# Architecture

This document is the top-level code and authority map. Product behavior is normative in `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md`.

## System overview

Household Food Journal is one hosted application plus one installable agent-client package.

```text
Codex / Claude ------- MCP over HTTPS + OAuth -------+
                                                       |
Browser ------- React 19.2 web experience ------------+---- TypeScript application service
                                                            |  HTTP, OAuth, MCP, jobs
                                                            |  sole Git writer
                                                            |
                                                            +---- Neon PostgreSQL
                                                            |     operational state and projections
                                                            |
                                                            +---- /data/households
                                                            |     DigitalOcean Block Storage
                                                            |     authoritative household Git repos
                                                            |
                                                            `---- encrypted off-site backup
```

Version 1 deploys one containerized application process on one DigitalOcean Droplet. The React build is served by that service; it is not a separately deployed backend or authority boundary. Household repositories live on an attached DigitalOcean Block Storage volume mounted at `/data/households`.

Neon PostgreSQL stores accounts, sessions, OAuth grants, membership authorization projections, mutation records, idempotency responses, token hashes, jobs, search projections, and reconciliation checkpoints. It is not authoritative for journal content. Git owns exportable household content and audit history.

## Implemented modules

### Application server

Purpose: expose HTTPS, OAuth, MCP, browser APIs, background jobs, and the only path that mutates household Git repositories.

Path: `apps/server/`

Internal modules should follow the server product domains: auth, households, profiles, journal content, collections, imports, Git, persistence, MCP, web, and workers. HTTP, MCP, Neon, Git, mail, clock, randomness, and filesystem access remain typed adapters at module edges.

### Browser frontend

Purpose: implement accessible React 19.2 flows for sign-in, passkeys, pending invitations, collection preview, selective import, account management, and install handoff.

Path: `apps/web/`

The frontend consumes explicit server contracts from `packages/contracts/`. It does not authorize requests, hold provider secrets, write Git, interpret repository paths, or make semantic food decisions. Public collection data must come from the server's allowlisted snapshot projection, never from a private household object serialized in the browser.

Passkey ceremonies use SimpleWebAuthn at the browser and server provider boundaries. Neon stores credential identifiers, public keys, counters, transport hints, device metadata, and revocation timestamps; private keys remain in the user's authenticator. Registration is authenticated and CSRF-protected, while discoverable authentication uses a short-lived single-use challenge bound to an HttpOnly browser transaction cookie.

Account mutations remain server-owned. Apple and email linking complete their provider proof in the same signed-in browser; method removal preserves at least one sign-in path; grant revocation and deletion require recent authentication. Household leave and account deletion commit the former-member document and audit event through the single Git writer under the household lock before Neon membership projection changes. Deletion then revokes OAuth tokens, sessions, passkeys, and external identities while retaining the stable actor ID and a pseudonymous display label.

### Shared contracts

Purpose: define semantic TypeScript boundary types and runtime schemas for HTTP, MCP tools, Git documents, projections, errors, and mutation state transitions.

Path: `packages/contracts/`

External input is parsed once at the owning boundary. Compile-time types alone do not validate HTTP, MCP, database, environment, Git-file, or provider input.

### Agent client

Purpose: package shared Codex and Claude skills, host manifests, remote MCP configuration, references, deterministic packaging checks, contract tests, and agent evals.

Path: `packages/agent-client/`, with repository discovery catalogs at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude.

The agent client never contains canonical household data, account state, credentials, a Git synchronization engine, or a programmatic semantic classifier. Codex and Claude use the same skill source files and the same remote MCP endpoint.

### Operational persistence

Purpose: keep private operational state and rebuildable query projections in Neon PostgreSQL.

Planned paths: `migrations/` and `apps/server/src/persistence/`.

Runtime traffic may use Neon's pooled connection endpoint. Migrations, backup utilities, and operations requiring session semantics use a direct connection. Household write serialization uses a transaction-scoped advisory lock held on the same checked-out connection and transaction as the durable mutation state transition; never rely on session-scoped locks through PgBouncer.

`npm run migrate` is the only release schema writer. It requires an exact expected direct host and an explicit staging/production target, rejects pooled or non-TLS endpoints, requires a second production confirmation, serializes through a PostgreSQL advisory transaction lock, and atomically records each migration filename and SHA-256 content hash in `hfj_schema_migrations`. Application startup never applies schema changes.

Post-commit recovery uses the request ID in the Git commit trailer and audit document as its replay anchor. Each in-flight idempotency key is bound to a hashed canonical request. Mutation handlers derive generated IDs, timestamps, and capability material from the durable request identity so a matching retry can reproduce the original projection and response without another commit, while changed input fails before projection. The scheduled maintenance CLI snapshots Git main with each file's last revision, rebuilds journal and membership projections under the same household lock, advances recoverable mutations to `projections_applied`, marks abandoned pre-commit requests failed, and quarantines repositories or identity mappings that cannot be projected safely.

Household exports are generated from the locked Git `main` revision as either a readable ZIP of the current tree or a full Git bundle. The application stores private artifacts under `EXPORT_ROOT`, while Neon stores only the requesting user, HMAC token digest, content hash, source HEAD, object path, expiry, and claim state. Download authorization is rechecked against the authenticated requester, content is verified before the one-time token is atomically claimed, and maintenance reclaims downloaded or expired artifacts.

Daily backup maintenance verifies fsck and every commit signature, signs a canonical HEAD/object-count/bundle-hash manifest with Ed25519, encrypts bundle and signed manifest independently as authenticated compact JWE, and uploads them through `BackupPort`. The production adapter targets a private Backblaze B2 S3-compatible bucket in a separate account and requires compliance Object Lock confirmation before Neon records a checkpoint. Monthly restore maintenance downloads and decrypts the checkpoint into a temporary isolated repository, verifies manifest/hash/HEAD/object count, runs full fsck, and re-verifies commit signatures before persisting bounded drill evidence.

### Household Git store

Purpose: keep one signed bare repository per household under `/data/households/<household-uuid>.git`.

Planned path: `apps/server/src/git/` for code; runtime data is never committed to this repository.

Repository paths derive only from validated internal UUIDs. Git executes with fixed subcommands, argument arrays, `shell: false`, a fixed environment, and resource bounds. Append-only paths and expected revisions are validated before every commit.

### Self-improvement hooks

Purpose: capture redacted repo-local agent-work signals and keep the harness context current without expanding primary instruction files.

Current files:
- `.codex/hooks.json`
- `.codex/self-improvement.config.json`
- `.codex/hooks/`
- `scripts/self-improvement/`
- `docs/CONTEXT_LEDGER.md`
- `docs/self-improvement/`

Raw traces live under ignored `.codex/self-improvement/`. Tracked documents contain sanitized deterministic summaries only.

## Authority rules

1. Git is authoritative for journal content, exportable household settings, collection snapshots, import provenance, and audit history.
2. Neon is authoritative for private identity, sessions, OAuth, authorization projections, idempotency, token revocation, jobs, and reconciliation state.
3. The server is the only Git writer. Agent clients and browsers mutate through authenticated server contracts.
4. Authorization uses the Neon projection and fails closed when projection state disagrees with Git.
5. A successful mutation means one durable signed Git commit, one append-only audit event, and a completed idempotency record.
6. Agents decide semantic food identity, classification, recipe status, merge choices, and report prose. Programs validate the submitted conclusion and its cited evidence.
7. Family invitations grant household membership only after authenticated explicit acceptance. Collection shares expose only immutable public-safe snapshots and never grant membership.

## Dependency direction

- Domain and contract code may depend only on pure types and validators.
- Server use cases may depend on domain contracts and typed ports.
- Provider adapters depend inward on those ports; domain code never imports provider SDKs.
- React code may depend on shared public contracts, not server persistence or Git modules.
- Agent-client skills may depend on the published MCP contract, not server internals.
- Neon projections may be rebuilt from Git; Git journal content may not be rebuilt from Neon projections.

## Deployment boundary

DigitalOcean App Platform is not the version 1 target because its application filesystem is ephemeral. The production container runs on a Droplet with an attached Block Storage volume. Keep a single active writer instance until advisory-lock behavior, shared filesystem semantics, failover, and split-brain prevention are proven for a different topology.

The production health path distinguishes process readiness, Neon reachability/schema compatibility, mounted-volume identity and writability, Git availability, signing readiness, and single-writer leadership without exposing secrets or tenant data. A separately authenticated operator route adds bounded reconciliation, backup-gap/age, fsck/signature failure, restore-drill, and capacity state; `/metrics` exposes the same operational gauges plus low-cardinality HTTP/runtime metrics in OpenMetrics format.

Fastify applies a global and route-specific `@fastify/rate-limit` policy keyed by the client IP after one trusted Caddy hop. `ServiceObservability` is the sole production telemetry adapter for request, MCP, mutation, reconciliation, and maintenance events; it allowlists attribute keys, pseudonymizes entity IDs, and never records request bodies or capability material.

## Current release limitations

The application foundation, durable Git-to-Neon reconciliation, portable exports, production rate limits/telemetry, operator health, encrypted immutable backup/restore, WebAuthn passkeys, browser account lifecycle, 22-tool MCP surface, React SSR shell, Neon operational store, Git mutation path, OAuth server, Apple and Resend adapters, agent package, and DigitalOcean deployment assets are implemented. Version 1 is not production-ready while live B2/Neon recovery evidence, full security/accessibility/load validation, external staging compatibility, and native passkey compatibility evidence remain open in the active ExecPlan.

## Maintenance rules

Update this file when:
- an application module or shared package becomes real;
- an authority, trust, deployment, storage, or import direction changes;
- horizontal scaling or a second deployable service is proposed;
- the React delivery model changes materially;
- a temporary version 1 limitation is removed.
