# Privacy Release Review

## Data map

- Confirm every external input is parsed at HTTP, OAuth, MCP, email, Git, backup, and browser boundaries.
- Trace account identity, memberships, evidence, public snapshots, capability hashes, logs, metrics, exports, and backups through collection, use, storage, retention, deletion, and recovery.
- Verify subprocessors, regions, retention, contact addresses, and user choices match `docs/legal/privacy.md` and the deployed configuration.

## Required proofs

- Snapshot tests prove public collections cannot contain household/member IDs, order data, counts, evidence/audit IDs, source locators, message/note excerpts, private source scopes, or unselected notes.
- Security tests prove invitation/share/magic/download tokens do not enter logs, metrics, analytics, client storage, referrers, screenshots, Git, or errors.
- Cross-household permutations return non-enumerating responses; collection capability access never becomes membership.
- Import copies only selected public snapshot fields and provenance; prompt-like content remains data; recipe and snack status rules are preserved.
- Account deletion immediately revokes sessions and grants, final-owner protection works, retained household audit identity is pseudonymized, and backup expiry is documented.
- Export contains readable data and pseudonymous audit history without private identity mappings or credentials.
- Logs contain request IDs and safe categories but no email, household title, food name, order ID, source URL, body, or token.

## Local automated evidence

- `npm run test:security` passes direct public-snapshot, unsafe-path/archive, malformed/unsupported/oversized-body, capability-log, hostile-rendering, prompt-content, URL-scheme, and tracked-secret probes.
- The broader deterministic suite covers cross-household substitution, role/scope enforcement, CSRF, redirect validation, OAuth/passkey replay, refresh reuse, invitation/share non-enumeration, final-owner/idempotency races, Git object rejection, export claims, and central telemetry redaction.
- This evidence is implementation proof only. Reviewer identity, build digest, staging configuration, external probing, and approval remain unrecorded and release-blocking.

Record reviewers, date, build digest, schema and format versions, test evidence, findings, owners, and closure. Security/privacy severity high or critical blocks release. Any policy/runtime mismatch blocks publication.
