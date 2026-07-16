# Security

This document summarizes the required security posture. Normative behavior and threat-specific tests live in the product specs.

## Security goals

- isolate every household across HTTP, MCP, Neon queries, Git paths, jobs, exports, logs, and backups;
- keep identity, OAuth, provider, database, signing, and repository credentials server-side;
- prevent public collection links from granting membership or exposing private household data;
- make every accepted mutation attributable, idempotent, signed, and auditable;
- treat all user-authored, imported, linked, Markdown, and agent-provided content as untrusted data.

## Trust boundaries

### Browser and React

React 19.2 is an untrusted presentation client. The server validates the session, CSRF protection, pending intent, household role, OAuth scope, revision, and request schema for every operation. UI visibility is not authorization.

Public collection pages receive only an allowlisted immutable snapshot projection. They must not receive private source objects and then hide fields client-side. External links use safe protocols and referrer controls; Markdown and user text are sanitized against stored and reflected XSS.

Passkeys require discoverable credentials and user verification. Registration requires an authenticated session and CSRF token. Registration and authentication challenges are short-lived, single-use, and bound to the initiating browser or session; provider payloads are schema-validated before cryptographic verification. Neon stores public credential material only, and atomic signature-counter updates reject replay, regression, and concurrent reuse.

### Codex and Claude MCP clients

MCP uses OAuth authorization code with PKCE and exact redirect/resource validation. Scopes do not override household roles. Tool input, model output, and cited evidence are untrusted until schema, authorization, revision, and invariant validation pass.

Clients never receive Git, Neon, Apple, email-provider, signing, or backup credentials. Prompt-like content in recipes, evidence, collection imports, external pages, and tool results is data, not instruction.

### Neon PostgreSQL

Use separate Neon credentials and branches/projects per environment with least-privilege roles. Runtime uses encrypted connections. Migration and production credentials are injected by the deployment secret mechanism and never committed, printed, sent to the browser, or stored in agent configuration.

Authorization uses the membership projection and fails closed if it disagrees with Git. Every tenant query includes the authorized household boundary. Token and capability secrets are stored hashed or HMACed as specified; encryption keys remain separate from ciphertext.

### Git and DigitalOcean storage

The application service is the only Git writer. Bare repositories live under `/data/households/<validated-uuid>.git` on the mounted Block Storage volume. Git commands use argument arrays with `shell: false`, fixed configuration and environment, timeouts, size limits, and no user-derived paths.

Reject hooks, symlinks, submodules, alternates, path traversal, unsafe refs, and append-only rewrites. Signing keys are injected at runtime and are not stored on the repository volume. A Block Storage snapshot is recovery input, not the sole backup.

### Public capabilities

Family invitation and collection share tokens are distinct, random capabilities with hashed/HMACed server-side storage, expiry, one-time or revocation semantics, rate limits, and redacted logs. Opening a family invitation never accepts it. Opening a collection never grants household visibility.

Export links are separate requester-bound capabilities. Neon stores only their HMAC digest, source HEAD, content hash, private artifact path, expiry, and claim state. The server buffers and verifies the artifact before atomically claiming the token, never includes household IDs in download filenames, and returns the same not-found response for wrong requester, expired, used, or invented tokens. Readable archives reject non-regular Git entries and unsafe paths before creation; both formats are capped at 96 MiB and stored outside the public asset tree with mode `0600`.

## Secrets and credentials

Expected secret classes include Neon runtime and migration URLs, Apple credentials, OAuth signing/encryption keys, cookie keys, HMAC peppers, email-provider credentials, Git signing keys, DigitalOcean deployment credentials, and backup encryption credentials.

- `.env*` remains ignored and is for local non-production values only.
- local and test work use isolated Neon branches/projects, never production credentials.
- no secret may appear in Git, URLs, MCP output, browser bundles/storage, analytics, metrics labels, logs, screenshots, self-improvement traces, or support exports.
- raw self-improvement traces remain ignored under `.codex/self-improvement/` and are redacted before local persistence.

## Required security tests

Application implementation must cover cross-household ID substitution, role/scope mismatch, CSRF, redirect validation, OAuth replay and refresh-token reuse, invitation/share enumeration and replay, final-owner races, idempotency races, path and Git argument injection, unsafe repository objects, XSS and malicious Markdown, prompt-injection content, oversized input, archive traversal, log redaction, and private-field collection leakage.

Security review is required for changes to auth, OAuth/MCP, tenant queries, memberships, public sharing, imports, Git execution, repository schemas, secrets, logging, backups, deployment, React content rendering, or self-improvement hooks.
