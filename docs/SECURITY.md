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

### Codex and Claude clients

A fresh installation remembers one explicitly confirmed preferred name in a separate bounded local profile before choosing local or cloud household authority. The profile and optional guest household live under the active Codex home with private directory and file modes, atomic replacement, and independent monotonic revisions. Names and household titles are private user data: they must not appear in telemetry, metrics labels, scheduled-task prompts, public collections, or mutation failure fields. This is isolation from accidental household mixing, not encryption from another person who controls the same operating-system account.

A dependency-free plugin-provided `fullwell-local` stdio server exposes stable read-only load, non-destructive revisioned update, fixed-purpose runner stop, and destructive collecting-only deletion tools; it performs no network access, emits no profile or journal content to logs, and delegates every storage invariant to the bounded runtime. Stable server/tool identities let a user retain one narrow host permission across compatible package upgrades without allowing arbitrary Node commands. The package never edits user rules, installs mutable executable code outside its cache, or routes deletion through the ordinary update tool. The bounded household document has a 16 MiB limit and may contain the user's curated grocery and recipe journal, up to 10,000 item records and 10,000 evidence records, but never credentials, authorization material, cookies, browser state, screenshots, raw HTML, or raw page captures. Local journal content is not sent to Fullwell until the user explicitly accepts cloud backup and confirms the reconciled promotion preview.

MCP uses OAuth authorization code with PKCE and exact redirect/resource validation. Dynamic registration accepts a strict bounded public-client metadata allowlist, registration and token responses are non-cacheable, and the server binds the displayed client name back to registered metadata before creating a grant. Token-request resource validation and scope equality checks occur before authorization-code consumption or refresh rotation so a mismatched request cannot burn a valid credential or widen the original grant. Scopes do not override household roles. Tool input, model output, and cited evidence are untrusted until schema, authorization, revision, and invariant validation pass.

The consent page's Content Security Policy permits the validated native-runner redirect only as the exact `http://127.0.0.1:<ephemeral-port>` origin from its bounded `/oauth/callback` request. Other pages do not receive a loopback form destination, and remote, unbound, credentialed, query-bearing, or fragment-bearing callback values do not widen the policy.

Clients never receive Git, Neon, Apple, email-provider, signing, or backup credentials. Prompt-like content in recipes, evidence, collection imports, external pages, and tool results is data, not instruction.

Food-delivery history cataloging is limited to explicit user-directed navigation of order history visible in the user's already signed-in browser at an exact approved HTTPS origin. It does not crawl public pages, run unattended, handle credentials, bypass sign-in/MFA/CAPTCHA, or call undocumented provider interfaces. The delivery journal excludes raw pages, screenshots, delivery destinations, payment data, provider account identifiers, and age/identity documents. Connected contribution requires a provider-specific household visibility and retention preview and one provider per mutation.

Public delivery-dish snapshots allowlist only the selected dish, public restaurant/location context, attribution, classification, and provenance. They contain no private order/group/menu/merchant locator, order date, recurrence, private modifier history, or reorder authority. Cart preparation resolves provider and then exact location, binds a complete prior delivery order, parses the whole current cart, preserves unrelated same-location lines, and proves exact lines after mutation. A different-location cart requires confirmation bound to its visible summary; uncertain effects require a full re-read. Checkout, payment, tipping, address/schedule changes, memberships, and subscriptions are unavailable. Alcohol uses the ordinary maximum, but Fullwell pauses for user-controlled age/identity UI and never views, enters, captures, stores, or relays ID data.

Meal-planning allergy and food-sensitivity labels are explicit household-visible data. They are never inferred from food history, placed in public collections, browser URLs, page titles, logs, metrics, or local recipe-board cards. A general planning request does not authorize internet research, and each search that would disclose constraint terms requires a separate one-search decision. External recipe pages remain untrusted. Liked evidence does not establish safety, and no client or server may promise allergy safety or absence of cross-contact.

The private recipe board accepts only bounded escaped card fields and provenance-bearing HTTPS images, writes beneath the fixed private local directory, and contains no script, forms, remote styles, fonts, analytics, or listener. Source image hosts may still receive ordinary network metadata and existing site state, so the agent discloses that boundary before creation. The personal weekly check-in belongs to the Codex or Claude host; its fixed prompt contains no household identity, recipe, constraint, URL, query, credential, or transcript and grants no search or write authority.

Authenticated onboarding returns only a membership-authorized, lock-consistent snapshot of the stable current user ID, onboarding state, the two onboarding profiles, and at most 200 item identity summaries. Its unconfirmed draft is stored outside the workspace under the Codex home, sharded by validated opaque Fullwell user and household IDs, bound to the snapshot HEAD and revisions, bounded to 16 MiB, written atomically with private local modes, and protected against concurrent local overwrite with a draft revision. Cloud promotion of a guest journal uses the same authenticated boundary: the agent creates or selects one household, reconciles semantic duplicates, shows an exact summary, and performs no mutation until confirmation. Final confirmation authorizes one bounded `hfj_commit_onboarding` request of at most 10,000 evidence records, 10,000 unique items, and 16 MiB; it does not authorize browser inspection, unrelated sources, checkout, or future mutations. An uncertain or failed cloud result leaves the local journal authoritative and unmarked; a successful result records only the returned cloud identity, HEAD, and exact promoted local revision, without deleting the local journal. The larger parser allowance applies only to `POST /mcp`; all other HTTP routes retain the one-megabyte default, and oversized responses remain generic and non-reflecting. Operational onboarding rows and recovery metadata contain only bounded section, state, skip reason, revision, and timestamp values, never refusal text, store names, recipe sources, browser choice, evidence, or report prose. Viewers cannot mutate onboarding. The install-page `codex://new` action contains only the fixed installed-plugin mention and greeting, prefills without sending, and grants no source or browser authorization.

### WhatsApp gateway and local runner

The public webhook verifies HMAC over the exact raw body before parsing and accepts only bounded supported provider events. Sender, message, and delivery identifiers are HMACed; message and destination bodies are authenticated-encrypted; plaintext exists only at the webhook/provider adapter and authenticated runner boundaries. No message body, phone/provider ID, food/store/cart value, or link token is logged or labeled in metrics.

Outbound Graph failures are reduced at the provider boundary to a numeric code and optional numeric subcode. Raw Meta error bodies, trace identifiers, provider text, destinations, and credentials are neither logged nor returned through operator health.

Linking is a two-sided proof bound to a recent browser session, one user/household, and one registered primary runner. Sender proof alone creates only a pending link. Claims and pre-action checks require `runner:messages`, `journal:read`, current membership, a live device, a confirmed link, and the authoritative HEAD. Revocation fails closed and causes local cache/receipt purge.

The server messaging module cannot import journal search/projection, LLM, host, or browser-control code. The snapshot module exposes a fixed read-only path allowlist and no Git credential. That allowlist contains only the format marker, compatibility snack profile/report, snack/ingredient/condiment/other-grocery items, and current or legacy purchase evidence; recipes, membership files, audit files, and repository credentials remain excluded. The runner independently revalidates and serializes only those snapshot files into one trusted restocking prompt. Codex runs from a dedicated trusted project and separate `CODEX_HOME`; before every turn the runner requires exactly the `node_repl` MCP server plus the enabled Browser and Chrome plugins, and disables apps, hooks, shell, search, multi-agent work, remote plugins, and user rules. The local host treats provider/journal/retailer text as untrusted data and is restricted to one retailer origin. Automatic mutation requires a current complete USD incremental item amount strictly below the profile maximum. Confirmation binds one active request's exact item, quantity, currency, and displayed amount and is invalid after a price increase. Missing/non-USD pricing and legacy unpriced non-terminal receipts fail closed. Checkout, payment, subscription, fees, unrelated cart edits, and novel substitution are outside the protocol.

Project configuration isolation is not an operating-system credential boundary. The isolated Codex login uses macOS Keychain and has no file-backed credential. Browser Use persists only the approved exact origin in the isolated home's `browser/config.toml`; capability drift, file-backed credentials exposed to the host process, or missing origin approval blocks claims and cannot be bypassed with `never_ask` or a broad browser policy.

OAuth refresh tokens live in Keychain. Runner config, LaunchAgent, logs, snapshots, and receipts are mode-restricted and secret-free. A chat stop targets only the fixed Fullwell LaunchAgent and removes its definition after confirming the process is absent; it preserves the Keychain token, config, snapshots, receipts, device registration, WhatsApp link, and journal. Full disconnect remains a separate action that purges local state even when remote revocation fails. Encrypted gateway bodies expire within seven days; cleanup and destructive schema rollback are tested.

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

Expected secret classes include Neon runtime and migration URLs, Apple credentials, OAuth signing/encryption keys, cookie keys, HMAC peppers, the dedicated operator bearer token, email-provider credentials, Git signing keys, DigitalOcean deployment credentials, backup encryption credentials, Meta app/access/webhook credentials, and the independent message-encryption key.

The operator token is not an OAuth access token and grants no household or MCP access. It protects `/health/operator` and `/metrics`, is HMAC-compared, is rate limited, and must be rotated as an encrypted systemd credential. Public liveness/readiness never return tenant counts, storage paths, repository identifiers, or provider error bodies.

On the Droplet, systemd decrypts the encrypted credential blobs into a root-only unit directory. Startup copies only the declared application credentials into a private tmpfs-backed runtime directory as `root:10001` with mode `0440`, allowing the unprivileged container process to read its bind-mounted secret files. Credential rotation replaces an encrypted blob and restarts the unit so systemd reacquires the source and Compose force recreates the containers; reload is intentionally unsupported. Staging currently uses systemd's host credential key on an unencrypted root disk; this protects credential files from casual at-rest disclosure but does not protect against host-root compromise. Production remains blocked on encrypted root storage, TPM-backed sealing, or an external runtime secret manager plus a completed rotation/recovery drill.

- `.env*` remains ignored and is for local non-production values only.
- `.dockerignore` excludes local runtime credentials, private key material, repository metadata, test state, and generated artifacts before any OCI build layer is created.
- local and test work use isolated Neon branches/projects, never production credentials.
- no secret may appear in Git, URLs, MCP output, browser bundles/storage, analytics, metrics labels, logs, screenshots, self-improvement traces, or support exports.
- raw self-improvement traces remain ignored under `.codex/self-improvement/` and are redacted before local persistence.

## Required security tests

Application implementation must cover cross-household ID substitution, role/scope mismatch, CSRF, redirect validation, OAuth replay and refresh-token reuse, invitation/share enumeration and replay, final-owner races, idempotency races, concurrent same-slot meal proposals, constraint leakage, unauthorized withdrawal, disabled meal-planning capability paths, private-board traversal and active-content injection, sensitive scheduled prompts, webhook signature and provider retry behavior, two-sided link binding, lease/revocation races, paid-window blocking, idempotent cart recovery, delivery exact-origin and provider/location ambiguity, delivery public-projection privacy, full-cart proof, uncertain-action recovery, age-step isolation, structural no-checkout enforcement, path and Git argument injection, unsafe repository objects, XSS and malicious Markdown, prompt-injection content, oversized input, archive traversal, log redaction, and private-field collection leakage.

The deterministic local matrix exercises those boundaries across domain, auth, OAuth, account, HTTP, Git, export, telemetry, load/race, and cross-surface security suites. Its direct adversarial probes verify bounded malformed/unsupported/oversized-body rejection, non-reflecting 400/413/415 responses, route-template capability redaction, React text escaping, prompt-like content remaining data, HTTP(S)-only browser URLs, recognizable repository-secret absence across tracked and untracked files, and no server environment access from browser source. Production browser source maps are disabled. This evidence does not replace an external staging security review or live provider and secret-rotation exercises.

Security review is required for changes to auth, OAuth/MCP, tenant queries, memberships, public sharing, imports, Git execution, repository schemas, secrets, logging, backups, deployment, React content rendering, or self-improvement hooks.
