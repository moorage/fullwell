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

MCP uses OAuth authorization code with PKCE and exact redirect/resource validation. Dynamic registration accepts a strict bounded public-client metadata allowlist, registration and token responses are non-cacheable, and the server binds the displayed client name back to registered metadata before creating a grant. Token-request resource validation occurs before authorization-code consumption or refresh rotation so a mismatched resource cannot burn a valid credential. Scopes do not override household roles. Tool input, model output, and cited evidence are untrusted until schema, authorization, revision, and invariant validation pass.

Clients never receive Git, Neon, Apple, email-provider, signing, or backup credentials. Prompt-like content in recipes, evidence, collection imports, external pages, and tool results is data, not instruction.

### Neon PostgreSQL

Use separate Neon credentials and branches/projects per environment with least-privilege roles. Runtime uses encrypted connections. Migration and production credentials are injected by the deployment secret mechanism and never committed, printed, sent to the browser, or stored in agent configuration.

OpenTofu state uses a separate Neon database and role through a direct TLS endpoint. The infrastructure role is unavailable to the application, and the application runtime and migration roles cannot read the state database. Backend credentials remain operator-only environment values and never enter `.tfvars`, saved plans, images, or application credential delivery.

Authorization uses the membership projection and fails closed if it disagrees with Git. Every tenant query includes the authorized household boundary. Token and capability secrets are stored hashed or HMACed as specified; encryption keys remain separate from ciphertext.

### Git and DigitalOcean storage

The application service is the only Git writer. Bare repositories live under `/data/households/<validated-uuid>.git` on the mounted Block Storage volume. Git commands use argument arrays with `shell: false`, fixed configuration and environment, timeouts, size limits, and no user-derived paths.

Reject hooks, symlinks, submodules, alternates, path traversal, unsafe refs, and append-only rewrites. Signing keys are injected at runtime and are not stored on the repository volume. A Block Storage snapshot is recovery input, not the sole backup.

### Off-site backup

Backup plaintext is encrypted locally with compact JWE `dir`/`A256GCM` before it leaves the process. Canonical manifests are signed with a separate Ed25519 key before encryption. Backblaze credentials are restricted to the private backup bucket without the `deleteFiles` capability; every object requires compliance retention confirmation before a checkpoint is committed. Backblaze maps S3 deletion by name to a reversible hide marker under `writeFiles`, so recovery tooling must list versions and download the retained upload by file ID when the current name is hidden. Compliance Object Lock prevents deletion of the retained version. Encryption and signing keys never enter object metadata, the repository volume, logs, or application responses.

### Public capabilities

Family invitation and collection share tokens are distinct, random capabilities with hashed/HMACed server-side storage, expiry, one-time or revocation semantics, rate limits, and redacted logs. Opening a family invitation never accepts it. Opening a collection never grants household visibility.

Export links are separate requester-bound capabilities. Neon stores only their HMAC digest, source HEAD, content hash, private artifact path, expiry, and claim state. The server buffers and verifies the artifact before atomically claiming the token, never includes household IDs in download filenames, and returns the same not-found response for wrong requester, expired, used, or invented tokens. Readable archives reject non-regular Git entries and unsafe paths before creation; both formats are capped at 96 MiB and stored outside the public asset tree with mode `0600`.

Application abuse controls use `@fastify/rate-limit` with a global per-client-IP ceiling and stricter grouped limits for authentication, OAuth, MCP, public capabilities, imports, exports, and destructive account actions. Fastify trusts exactly one proxy hop because Caddy is the only public ingress and the app container is not published. Rate-limit labels use route templates only, never raw URLs or tokens.

## Secrets and credentials

Expected secret classes include Neon runtime and migration URLs, Apple credentials, OAuth signing/encryption keys, cookie keys, HMAC peppers, the dedicated operator bearer token, email-provider credentials, Git signing keys, DigitalOcean deployment credentials, and backup encryption credentials.

The operator token is not an OAuth access token and grants no household or MCP access. It protects `/health/operator` and `/metrics`, is HMAC-compared, is rate limited, and must be rotated as an encrypted systemd credential. Public liveness/readiness never return tenant counts, storage paths, repository identifiers, or provider error bodies.

On the Droplet, systemd decrypts the encrypted credential blobs into a root-only unit directory. Startup copies only the declared application credentials into a private tmpfs-backed runtime directory as `root:10001` with mode `0440`, allowing the unprivileged container process to read its bind-mounted secret files. Credential rotation replaces an encrypted blob and restarts the unit so systemd reacquires the source and Compose force recreates the containers; reload is intentionally unsupported. Staging currently uses systemd's host credential key on an unencrypted root disk; this protects credential files from casual at-rest disclosure but does not protect against host-root compromise. Production remains blocked on encrypted root storage, TPM-backed sealing, or an external runtime secret manager plus a completed rotation/recovery drill.

- `.env*` remains ignored and is for local non-production values only.
- local and test work use isolated Neon branches/projects, never production credentials.
- no secret may appear in Git, URLs, MCP output, browser bundles/storage, analytics, metrics labels, logs, screenshots, self-improvement traces, or support exports.
- raw self-improvement traces remain ignored under `.codex/self-improvement/` and are redacted before local persistence.

## Required security tests

Application implementation must cover cross-household ID substitution, role/scope mismatch, CSRF, redirect validation, OAuth replay and refresh-token reuse, invitation/share enumeration and replay, final-owner races, idempotency races, path and Git argument injection, unsafe repository objects, XSS and malicious Markdown, prompt-injection content, oversized input, archive traversal, log redaction, and private-field collection leakage.

The deterministic local matrix exercises those boundaries across domain, auth, OAuth, account, HTTP, Git, export, telemetry, load/race, and cross-surface security suites. Its direct adversarial probes verify bounded malformed/unsupported/oversized-body rejection, non-reflecting 400/413/415 responses, route-template capability redaction, React text escaping, prompt-like content remaining data, HTTP(S)-only browser URLs, recognizable repository-secret absence across tracked and untracked files, and no server environment access from browser source. Production browser source maps are disabled. This evidence does not replace an external staging security review or live provider and secret-rotation exercises.

Security review is required for changes to auth, OAuth/MCP, tenant queries, memberships, public sharing, imports, Git execution, repository schemas, secrets, logging, backups, deployment, React content rendering, or self-improvement hooks.
