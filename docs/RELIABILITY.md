# Reliability

## Service objectives

- never report a journal mutation as successful before its signed Git commit and durable mutation record are complete;
- never silently overwrite a concurrent household change;
- make retries idempotent across HTTP, MCP, invitations, evidence batches, imports, exports, and background jobs;
- keep household repositories restorable independently from Neon projections;
- fail closed when authorization, repository, projection, signing, mount, or backup state is unsafe.

## Initial deployment

Version 1 runs one containerized TypeScript process on one DigitalOcean Droplet. `/data/households` must be a mounted DigitalOcean Block Storage filesystem; startup fails if the path is absent, unexpectedly empty after prior provisioning, not writable, or on the wrong filesystem identity.

DigitalOcean App Platform is not supported for the authoritative Git store because its application filesystem is ephemeral. Do not horizontally scale the writer until shared-storage Git semantics, transaction-scoped advisory locking, failover fencing, and split-brain prevention have been exercised.

Neon PostgreSQL is the managed operational database. Ordinary runtime work may use its pooled endpoint. Migrations and session-dependent operations use a direct endpoint. Household mutations use transaction-scoped advisory locks on one checked-out connection; session-scoped locks are prohibited through the pooler.

## Mutation and retry policy

Each mutating request must:

1. authenticate and authorize against the current projection;
2. validate its schema, idempotency key, expected revision, and evidence references;
3. open one database transaction and acquire the household transaction-scoped advisory lock;
4. create or resume a durable mutation record;
5. verify Git and projection consistency, apply the change in a temporary worktree, validate the repository, and create one signed commit;
6. update projections and complete the stored idempotent response;
7. release the transaction and return success.

Retries resume or return the recorded result. Ambiguous states enter reconciliation; they do not produce a second commit. Conflicts return the latest safe revision and structured comparison data for explicit client or agent resolution.

Errors are propagated only after the transaction containing `git_committed`, `reconciliation_required`, or `failed_before_commit` has committed. A retry must match the hashed canonical request bound to the idempotency key and searches Git main for the request trailer before considering a new commit. The scheduled reconciler validates the repository, rebuilds evidence, item, profile, collection, and membership projections with per-file revisions, repairs recoverable private identity links, and advances replayable mutations to `projections_applied`. Missing authoritative documents, unverifiable commits, or Git members without a private identity mapping quarantine the household and keep authorization closed.

WebAuthn challenges are consumed exactly once and expire after five minutes. Authentication issues a session only after cryptographic verification and an atomic credential-counter update; a stale or regressing counter fails the ceremony rather than producing a success-shaped fallback. Counterless authenticators may remain at zero but cannot reset a nonzero stored counter.

Browser household leave and account deletion use the same transaction-scoped household lock and Git membership document as MCP membership changes. The account is not deleted while it solely owns a household. Once eligible, deletion revokes connected OAuth access and browser credentials; any post-commit projection failure surfaces reconciliation-required rather than reporting success.

## Startup and health

- `GET /health/live` proves the process event loop is alive without touching dependencies.
- `GET /health/ready` proves config parsing, Neon connectivity, schema compatibility, Git availability, mounted-volume identity and writability, signing readiness, and required worker leadership.
- authenticated operator health exposes reconciliation backlog, oldest incomplete mutation, backup age, last fsck result, signature status, volume capacity, Neon migration state, and last restore drill.
- public health responses reveal no tenant counts, paths, credentials, repository identifiers, or provider error bodies.

The live and readiness routes are public and contain no counts or paths. Production readiness checks Neon, schema `0005`, Git, volume identity/writability, application/manifest signing configuration, and single-writer leadership. `/health/operator` uses a dedicated HMAC-compared bearer credential and adds incomplete/reconciliation-required mutation counts and age, quarantine count, backup gaps/age, volume capacity, fsck/signature failure counts, and restore-drill freshness. Missing, stale, or failed evidence degrades operator health.

## Backups and recovery

- create authenticated JWE Git bundle backups and an Ed25519-signed manifest containing household ID, HEAD, object count, backup hash, checkpoint time, and retention deadline;
- keep compliance-object-locked Git backups in a separate Backblaze account outside the Droplet and Block Storage failure domain;
- use Neon managed backup/PITR capabilities appropriate to the production plan and separately export required operational metadata;
- persist repository fsck and signature verification with each daily backup attempt;
- rehearse isolated download, decryption, manifest/hash, bundle, fsck, HEAD/object-count, and commit-signature restore at least monthly and before destructive migrations;
- document single-instance failover, volume reattachment/mount verification, Neon recovery, signing-key recovery, DNS cutover, and rollback.

Snapshots alone are insufficient because storage corruption or operator error can be captured in a snapshot. A restore is successful only when Git, operational metadata, authorization projections, signatures, and current HEAD manifests reconcile.

## Telemetry

Use one request ID across HTTP/MCP, Neon mutation rows, Git commit trailers, jobs, and operator logs. Record safe event types, state transitions, durations, retry counts, error codes, and hashed/internal correlation IDs.

The server generates request IDs and returns `X-Request-ID`; caller-supplied values are ignored. Structured JSON logs allowlist safe attributes and pseudonymize household/export IDs. The operator-authenticated `/metrics` endpoint exposes OpenMetrics counters, histograms, runtime metrics, rate-limit rejections, reconciliation backlog, backup gaps/age, fsck/signature failures, restore-drill state, quarantines, and volume usage. Authentication, OAuth, MCP tools, mutation replay/conflict/outcome, lock wait, reconciliation, backup, and cleanup use bounded categories only.

Do not log or label metrics with access/refresh/share/invitation tokens, emails, household titles, food or recipe names, order IDs, source URLs, evidence bodies, user-authored notes, Git signing material, or raw provider responses.

## Load and concurrency gates

`npm run test:load` exercises the real Fastify, MCP, service, memory-store, and repository boundaries without external credentials. Its local budgets require 100 concurrent authenticated MCP discovery requests to settle within five seconds with unique server request IDs; public preview bursts may return only non-enumerating misses or bounded `RATE_LIMITED` responses; 32 identical writes must produce one response and one commit; competing writes from one HEAD must produce one commit and explicit conflicts; cross-household reads must reveal no private content; and 100 same-household lock operations must serialize while another household remains able to progress.

This deterministic gate validates invariants, not production capacity. Staging still requires networked latency, sustained/soak, Neon pool and advisory-lock wait, OAuth token, collection import, maintenance overlap, and resource-saturation measurements on the selected Droplet size.

## Required verification

As implementation lands, add real commands for unit, contract, Neon integration, Git integration, OAuth/MCP interoperability, security, agent eval, browser e2e, backup/restore, and deployed persistence smoke tests. The deployed smoke must prove that a canary repository survives a container restart and a controlled Droplet failover procedure without using production household data.

The repository verification entry points include:

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:load`
- `npm run test:e2e`
- `npm run test:restore`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Incident learning

After a material incident, add a regression test or eval, update the applicable product and reliability/security guidance, record structural debt in `docs/QUALITY_LEDGER.md`, and run `npm run self-improve:distill` when repeated agent correction or missed verification contributed.
