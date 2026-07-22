# Privacy Release Review

## Data map

- Confirm every external input is parsed at HTTP, OAuth, MCP, email, Git, backup, WhatsApp webhook, local archive/host, and browser boundaries.
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
- Meta/WhatsApp is disclosed as the optional direct messaging processor; no BSP/middleware vendor is present. Prove plaintext exists only at the signed webhook/provider adapter and authenticated local-runner boundaries.
- Searchable gateway state contains only HMACed provider identifiers and bounded status/timestamps; message and destination bodies are authenticated-encrypted and deleted within seven days.
- The restocking snapshot contains only the fixed snack, ingredient, condiment, other-grocery, purchase-evidence, profile, report, and format path allowlist; it remains on the Mac and is purged with local receipts/tokens/config on revocation or disconnect. The gateway never receives selected product, store, cart quantity, retailer browser state, or action receipts.

## Local automated evidence

- `npm run test:security` passes direct public-snapshot, unsafe-path/archive, malformed/unsupported/oversized-body, capability-log, hostile-rendering, prompt-content, URL-scheme, and tracked/untracked repository-secret probes.
- The broader deterministic suite covers cross-household substitution, role/scope enforcement, CSRF, redirect validation, OAuth/passkey replay, refresh reuse, invitation/share non-enumeration, final-owner/idempotency races, signed webhook parsing, two-sided linking, encrypted queue retention, runner revocation, fixed snapshot extraction, Git object rejection, export claims, and central telemetry redaction.
- This evidence is implementation proof only. Reviewer identity, build digest, staging configuration, external probing, and approval remain unrecorded and release-blocking.

Record reviewers, date, build digest, schema and format versions, test evidence, findings, owners, and closure. Security/privacy severity high or critical blocks release. Any policy/runtime mismatch blocks publication.
