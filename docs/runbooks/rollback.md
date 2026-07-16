# Roll Back a Release

## Trigger

Roll back for elevated mutation failure, incorrect authorization, public-field disclosure, reconciliation growth, invalid signatures, failed persistence, schema incompatibility, or an unrecoverable regression. Fence writes immediately for possible privacy, integrity, mount, or split-brain failures.

## Application rollback

1. Record the request IDs and safe health evidence. Do not copy private request bodies or credentials.
2. Set the service to read-only or stop `household-food-journal.service` when write integrity is uncertain.
3. Confirm the previous image digest and its required schema range from the release record.
4. If the current database schema is backward compatible, replace only `HFJ_IMAGE` in `/etc/hfj/deploy.env` with the previous digest and reload the service.
5. Wait for readiness and run auth metadata, read-only MCP, policy, canary read, and operator-health checks before reopening writes.

## Database rollback

Run a down migration only when its release notes explicitly mark it reversible, its destructive implications were reviewed, and it passed isolated up/down/up rehearsal. Stop the writer first. Use the direct Neon connection and create a protected Neon branch or recovery point before the down migration.

If data written by the new release cannot be represented by the old schema, keep the service fenced and deploy a forward repair. Never force an old binary to interpret a newer incompatible Git `FORMAT_VERSION`.

## Invariants

- Never reset, force-push, or delete household `main` refs.
- Never replace `/data/households` with root-disk or container data.
- Never restore Git without the matching signed manifest and operational metadata checkpoint.
- Keep share/invitation revocation and token-reuse protections effective during rollback.
- Record the release digest, schema version, Git format range, start/end time, operator, validation evidence, and remaining risk.
