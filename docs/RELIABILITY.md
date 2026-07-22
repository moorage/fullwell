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

The DigitalOcean Cloud Firewall permits outbound PostgreSQL TCP `5432` in addition to DNS, NTP, HTTP, and HTTPS. Removing that rule leaves liveness healthy but makes readiness fail because the Neon pool cannot connect. Runtime credential rotation likewise requires a unit restart with forced Compose recreation; an existing container retains its original bind-mounted secret files even when the encrypted host blobs change.

OpenTofu stores DigitalOcean state in a dedicated Neon database through the direct endpoint. Its PostgreSQL backend uses session advisory locks and separate per-environment schemas; it must never use PgBouncer or share application roles. Backblaze is excluded from state storage because its S3-compatible endpoint does not implement the conditional write required by OpenTofu lockfiles.

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

The live and readiness routes are public and contain no counts or paths. Production readiness checks Neon, schema `0007`, Git, volume identity/writability, application/manifest signing configuration, and single-writer leadership. `/health/operator` uses a dedicated HMAC-compared bearer credential and adds incomplete/reconciliation-required mutation counts and age, quarantine count, backup gaps/age, volume capacity, fsck/signature failure counts, restore-drill freshness, messaging queue age/depth, and runner-online state. Missing, stale, or failed evidence degrades operator health.

## Backups and recovery

- create authenticated JWE Git bundle backups and an Ed25519-signed manifest containing household ID, HEAD, object count, backup hash, checkpoint time, and retention deadline;
- keep compliance-object-locked Git backups in a separate Backblaze account outside the Droplet and Block Storage failure domain;
- recover a hidden Backblaze object from its compliance-retained upload version by file ID rather than treating an S3 hide marker as erased data;
- use Neon managed backup/PITR capabilities appropriate to the production plan and separately export required operational metadata;
- persist repository fsck and signature verification with each daily backup attempt;
- rehearse isolated download, decryption, manifest/hash, bundle, fsck, HEAD/object-count, and commit-signature restore at least monthly and before destructive migrations;
- document single-instance failover, volume reattachment/mount verification, Neon recovery, signing-key recovery, DNS cutover, and rollback.

Snapshots alone are insufficient because storage corruption or operator error can be captured in a snapshot. A restore is successful only when Git, operational metadata, authorization projections, signatures, and current HEAD manifests reconcile.

## Telemetry

Use one request ID across HTTP/MCP, Neon mutation rows, Git commit trailers, jobs, and operator logs. Record safe event types, state transitions, durations, retry counts, error codes, and hashed/internal correlation IDs.

The server generates request IDs and returns `X-Request-ID`; caller-supplied values are ignored. Structured JSON logs allowlist safe attributes and pseudonymize household/export IDs. The operator-authenticated `/metrics` endpoint exposes OpenMetrics counters, histograms, runtime metrics, rate-limit rejections, reconciliation backlog, backup gaps/age, fsck/signature failures, restore-drill state, quarantines, and volume usage. Authentication, OAuth, MCP tools, mutation replay/conflict/outcome, lock wait, reconciliation, backup, and cleanup use bounded categories only.

Guided onboarding reads a lock-consistent snapshot and checkpoints progress locally against the stable user ID, household ID, HEAD, onboarding revisions, and monotonic draft revision. Atomic local replacement prevents partial JSON from becoming resumable; stale, expired, malformed, mismatched, or concurrently superseded drafts fail closed. The exact checkpoint and final idempotency key remain available after an uncertain remote result and are deleted only after confirmed success or explicit cancellation. Finalization accepts at most 10,000 evidence records and 10,000 unique items inside a 16 MiB MCP envelope and commits the confirmed draft with one idempotency record. All other HTTP routes retain the one-megabyte parser default. Before Git, the writer checks the prospective tree against the 50,000-file reconciliation ceiling and stages the isolated worktree without enumerating every changed path in the process argument vector. When its Git commit succeeds before an operational skip outcome can be applied, the mutation stores only bounded non-content recovery metadata and enters reconciliation. The worker rebuilds canonical projections, compare-and-sets those skip outcomes, and leaves the request exactly replayable to completion. Skip-only finalization verifies the unchanged Git and projection HEADs and never emits an empty Git commit.

Do not log or label metrics with access/refresh/share/invitation tokens, emails, household titles, food or recipe names, order IDs, source URLs, evidence bodies, user-authored notes, Git signing material, or raw provider responses.

WhatsApp operator health reports only aggregate open/queued/leased/follow-up/response counts, oldest open age, active runners, runners seen within five minutes, and whether the free channel gate is available. Open work with no online runner degrades operator health. Alert on increasing oldest-open age, lease churn, response-ready accumulation, cleanup failure, provider failure classes, and any blocked paid-send event; never attach message, sender, household, food, store, or cart labels.

Meta redelivery is deduplicated transactionally before capacity checks. One primary runner owns one exclusive renewable lease; an expired lease preserves the same request identity. Cart idempotency remains local: write baseline/target before mutation, re-observe on recovery, do not increment when equal, and block when above target. A stale HEAD, revoked grant/link/device/membership, invalid snapshot, CAPTCHA, or uncertain cart blocks instead of replaying a click.

An encrypted `response_ready` result is retried before the linked device's next authenticated claim returns work. This lets an operator open the service-reply gate after a controlled host proof without requiring another user message or creating a second envelope. Failed provider sends leave the response encrypted and retryable; only a provider-accepted response records a hashed delivery receipt and advances the envelope.

The Codex runner verifies its dedicated project before every resolution or action turn. Any configured MCP other than `node_repl`, a missing Browser or Chrome plugin, an unavailable exact-origin approval, or isolated-login drift blocks the task before cart mutation. The keyring-backed noninteractive host passed the fake-retailer quantity-one and duplicate-replay proof on 2026-07-21. Claims are enabled for the linked staging runner; service replies are disabled while Meta business/display-name review blocks outbound acceptance.

The gateway retains encrypted bodies no longer than seven days and removes expired envelopes, receipts, challenges, and unconfirmed links through scheduled maintenance. Late results are not sent outside an open pre-cutoff service window. The compiled zero-cost cutoff prevents intake, linking, claims, and replies on or after `2026-10-01T00:00:00-07:00`.

## Load and concurrency gates

`npm run test:load` exercises the real Fastify, MCP, service, memory-store, and repository boundaries without external credentials. Its local budgets require 100 concurrent authenticated MCP discovery requests to settle within five seconds with unique server request IDs; public preview bursts may return only non-enumerating misses or bounded `RATE_LIMITED` responses; 32 identical writes must produce one response and one commit; competing writes from one HEAD must produce one commit and explicit conflicts; cross-household reads must reveal no private content; and 100 same-household lock operations must serialize while another household remains able to progress.

This deterministic gate validates invariants, not production capacity. Staging still requires networked latency, sustained/soak, Neon pool and advisory-lock wait, OAuth token, collection import, maintenance overlap, and resource-saturation measurements on the selected Droplet size.

## Database releases

Run schema changes only through `npm run migrate` with a direct Neon URL, an exact expected host, and an explicit staging or production target. The runner rejects pooled/non-TLS endpoints and changed applied migrations, requires an additional production confirmation, holds a transaction-scoped advisory lock, and commits each migration with its content-hash ledger row. Rehearse reversibility against a disposable local database and prove forward application plus idempotent re-entry on an isolated Neon branch before production.

## Required verification

As implementation lands, add real commands for unit, contract, Neon integration, Git integration, OAuth/MCP interoperability, security, agent eval, browser e2e, backup/restore, and deployed persistence smoke tests. The deployed smoke must prove that a canary repository survives a container restart and a controlled Droplet failover procedure without using production household data.

OAuth/MCP interoperability evidence must exercise each supported host's actual dynamic registration payload, authorization and token requests, initialize request, no-ID initialized notification, tool discovery, revocation, and reconnect. Protocol fixtures remain required, but they do not substitute for a current host handshake because hosts may add standards-compatible registration fields or token parameters and may require notification-specific HTTP semantics.

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
