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

## Startup and health

- `GET /health/live` proves the process event loop is alive without touching dependencies.
- `GET /health/ready` proves config parsing, Neon connectivity, schema compatibility, Git availability, mounted-volume identity and writability, signing readiness, and required worker leadership.
- authenticated operator health exposes reconciliation backlog, oldest incomplete mutation, backup age, last fsck result, signature status, volume capacity, Neon migration state, and last restore drill.
- public health responses reveal no tenant counts, paths, credentials, repository identifiers, or provider error bodies.

These routes and their smoke commands are planned contracts and must be implemented with the server foundation; they do not exist in the current harness-only tree.

## Backups and recovery

- create encrypted Git bundle backups and a signed manifest containing household ID, HEAD, object count, and backup hash;
- keep Git backups outside the Droplet and Block Storage failure domain;
- use Neon managed backup/PITR capabilities appropriate to the production plan and separately export required operational metadata;
- run repository fsck and signature verification as scheduled jobs;
- rehearse isolated restore monthly and before destructive migrations;
- document single-instance failover, volume reattachment/mount verification, Neon recovery, signing-key recovery, DNS cutover, and rollback.

Snapshots alone are insufficient because storage corruption or operator error can be captured in a snapshot. A restore is successful only when Git, operational metadata, authorization projections, signatures, and current HEAD manifests reconcile.

## Telemetry

Use one request ID across HTTP/MCP, Neon mutation rows, Git commit trailers, jobs, and operator logs. Record safe event types, state transitions, durations, retry counts, error codes, and hashed/internal correlation IDs.

Do not log or label metrics with access/refresh/share/invitation tokens, emails, household titles, food or recipe names, order IDs, source URLs, evidence bodies, user-authored notes, Git signing material, or raw provider responses.

## Required verification

As implementation lands, add real commands for unit, contract, Neon integration, Git integration, OAuth/MCP interoperability, security, agent eval, browser e2e, backup/restore, and deployed persistence smoke tests. The deployed smoke must prove that a canary repository survives a container restart and a controlled Droplet failover procedure without using production household data.

The current harness-only verification remains:

- `npm run test:unit`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Incident learning

After a material incident, add a regression test or eval, update the applicable product and reliability/security guidance, record structural debt in `docs/QUALITY_LEDGER.md`, and run `npm run self-improve:distill` when repeated agent correction or missed verification contributed.
