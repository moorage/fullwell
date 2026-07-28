# Architecture

This document is the top-level code and authority map. Product behavior is normative in `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md`.

## System overview

Household Food Journal is one hosted application plus one installable agent-client package.

```text
Codex / Claude -- local guest household -- current computer
      |
      `------------- MCP over HTTPS + OAuth ----------+
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

WhatsApp user ---- Meta Cloud API webhook ---- gateway queue
                                                   |
                                                   `---- authenticated long-poll ---- local macOS runner
                                                                                           |
                                                                                           +---- read-only grocery snapshot
                                                                                           `---- Codex/Claude + approved retailer
```

Version 1 deploys one containerized application process on one DigitalOcean Droplet. The React build is served by that service; it is not a separately deployed backend or authority boundary. Household repositories live on an attached DigitalOcean Block Storage volume mounted at `/data/households`.

`Dockerfile` is the portable OCI build recipe. Apple silicon macOS development uses Apple's `container` CLI for local image builds and an isolated PostgreSQL 17 verification database. The DigitalOcean Ubuntu host uses Docker Compose under systemd for the production process and mounted-volume contract; Apple Container is not a production dependency. This separation keeps the local harness native to the development host without changing the Linux deployment boundary.

Neon PostgreSQL stores accounts, sessions, OAuth grants, membership authorization projections, mutation records, idempotency responses, per-user onboarding progress, token hashes, jobs, rebuildable full-journal and search projections, rebuildable meal-plan projections, and reconciliation checkpoints. It is not authoritative for journal content, meal plans, or onboarding completion. Git owns exportable household content, audit history, meal-planning constraints and append-only proposal/events, and the canonical reports from which completion is derived.

## Implemented modules

### Application server

Purpose: expose HTTPS, OAuth, MCP, browser APIs, background jobs, and the only path that mutates household Git repositories.

Path: `apps/server/`

Internal modules should follow the server product domains: auth, households, profiles, journal content, collections, imports, Git, persistence, MCP, web, and workers. HTTP, MCP, Neon, Git, mail, clock, randomness, and filesystem access remain typed adapters at module edges.

The OAuth boundary advertises protected-resource and authorization-server metadata, including dynamic client registration and public-client token authentication. Registration accepts only a bounded native-client metadata allowlist. The authorization endpoint validates the registered redirect, client name, requested scopes, PKCE challenge, and exact MCP resource across both the redirect to the React consent screen and the submitted decision; the token endpoint accepts the standards-compatible optional `resource` parameter without consuming a code when that resource is invalid. The MCP transport supports initialize, the no-ID `notifications/initialized` lifecycle notification with an empty `202` response, tool discovery with truthful read-only/destructive/idempotent/open-world annotations, and authenticated tool calls.

### Browser frontend

Purpose: implement accessible React 19.2 flows for sign-in, passkeys, pending invitations, public advanced-agent guides, collection preview, selective import, account management, owner household renaming, visual recipe and grocery browsing, connected weekly meal planning, and install-to-conversation handoff.

Path: `apps/web/`

The frontend consumes explicit server contracts from `packages/contracts/`. It does not authorize requests, hold provider secrets, write Git, interpret repository paths, or make semantic food decisions. Public collection data must come from the server's allowlisted snapshot projection, never from a private household object serialized in the browser.

The server-rendered household creation form posts to a typed Fastify boundary that resolves the browser principal, verifies CSRF, and delegates to `hfj_create_household`. Browser and MCP creation therefore share the same idempotency record, repository provisioning, signed Git commit, ownership projection, and default-household update instead of implementing a second mutation path.

The household overview's rename dialog delegates to the existing `hfj_update_household_name` use case. Its private view model carries the Git HEAD that rendered the title, and the strict browser form adds CSRF plus idempotency before the service rechecks current owner membership and mutation scope. The desktop hover reveal has keyboard-focus and touch equivalents, while a no-JavaScript form preserves the server-authoritative action. Public `/guides/household-name` copy describes chat and web entry points but has no mutation authority or private context.

Recipe, grocery, and Takeout browsers are read-only server projections over the authorized Git-backed household journal. Document and cursor-continuation requests independently resolve the principal, current membership, and projection HEAD; stale or unauthorized requests fail closed. React appends strictly parsed, bounded batches, while ordinary document links retain a non-JavaScript path. Authorized computer-use collection records only credential-free HTTPS images visibly associated with exact item/detail pages plus their exact page provenance. External image URLs remain browser-fetched with no referrer, fixed dimensions, lazy loading, and a local fallback; the service never searches for, fetches, proxies, or semantically enriches them.

The connected weekly meal-plan route is also a server-owned projection and mutation boundary. It resolves household membership before reading, renders every active same-slot proposal without selecting a winner, excludes constraint labels from the browser contract, and posts constraint review, simple free-form additions, and attributed withdrawals through the same CSRF-protected, idempotent service use cases used by MCP. The React page remains functional without JavaScript and never performs recipe search or food-safety classification.

Passkey ceremonies use SimpleWebAuthn at the browser and server provider boundaries. Neon stores credential identifiers, public keys, counters, transport hints, device metadata, and revocation timestamps; private keys remain in the user's authenticator. Registration is authenticated and CSRF-protected, while discoverable authentication uses a short-lived single-use challenge bound to an HttpOnly browser transaction cookie.

Account mutations remain server-owned. Apple and email linking complete their provider proof in the same signed-in browser; method removal preserves at least one sign-in path; grant revocation and deletion require recent authentication. Household leave and account deletion commit the former-member document and audit event through the single Git writer under the household lock before Neon membership projection changes. Deletion then revokes OAuth tokens, sessions, passkeys, and external identities while retaining the stable actor ID and a pseudonymous display label.

### Shared contracts

Purpose: define semantic TypeScript boundary types and runtime schemas for HTTP, MCP tools, Git documents, projections, errors, and mutation state transitions.

Path: `packages/contracts/`

External input is parsed once at the owning boundary. Compile-time types alone do not validate HTTP, MCP, database, environment, Git-file, or provider input.

### Agent client

Purpose: package shared Codex and Claude skills, host manifests, remote MCP configuration, references, deterministic packaging checks, contract tests, and agent evals.

Path: `packages/agent-client/`, with repository discovery catalogs at `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude.

The agent client contains no bundled household data, hosted account state, credentials, Git synchronization engine, or programmatic semantic classifier. Codex and Claude use the same skill source files, one dependency-free plugin-provided `fullwell-local` stdio MCP server, equivalent host-specific path adapters for that installed server, and the same optional remote MCP endpoint. A small private revisioned local profile remembers the member name before authority selection. Before cloud connection, one bounded revisioned JSON guest household under the active Codex home is authoritative on the current computer. Neither file is Git or synchronized in the background, and neither contains browser or authentication material.

The local read tool remains non-mutating. When a dry transform proves that a recognized older delivery-journal format can become completely valid without guessing, it returns a dedicated compatibility-required code. The agent automatically invokes the existing non-destructive update tool's bounded repair operation, which locks the file; deterministically updates legacy item IDs and exact references; partitions a mixed restaurant-name item only from its own exact order evidence; normalizes legacy delivery-report summaries; removes obsolete browser-label fields; validates the complete result; and atomically records one new local revision. Unknown corruption never enters this path, and the repair performs no cloud call.

The immutable npm package is the plugin payload, not a public marketplace catalog. Until a repository or catalog is intentionally published, host release checks may install that payload through the repository-local catalogs, but public catalog discovery remains a separate release blocker. The Codex and Claude adapters expose the branded `fullwell@fullwell` selector, Codex exposes the `Fullwell` mention, the local server retains the stable `fullwell-local` identity, and the hosted MCP service retains the stable `household-food-journal` identifier. Shared skills ask and remember the preferred name before the account question or any hosted call. Existing users follow the membership-authorized snapshot path and copy that name to the cloud display identity. Everyone else uses stable local profile and household tool identities backed by the bounded local runtime, completes grocery-then-recipe onboarding locally, and can use direct restocking and recipe recall without OAuth. The host may persist permission for non-destructive local updates across compatible package versions; destructive unfinished-journal deletion and fixed runner shutdown remain separate, and the package never edits user command rules or runs a version-specific cache command. Optional promotion authenticates, reconciles against one selected cloud household, commits through the existing typed onboarding boundary, and records linkage only after success. Authenticated unconfirmed drafts remain separately sharded by Fullwell user and household IDs.

### Messaging gateway and local runner

Purpose: route one fixed-purpose WhatsApp restocking workflow to a user's Mac without moving household semantic reasoning or retailer credentials onto the server.

Paths: `apps/server/src/messaging/`, `apps/server/src/runner/`, and `packages/local-runner/`.

The messaging gateway verifies the exact raw webhook body, parses bounded provider events, links one sender to one recently authenticated browser and primary runner, encrypts message bodies, deduplicates provider retries, leases work, relays bounded terminal text, records hashed delivery receipts, and expires operational state. It has no import path to journal projection/search code, agent hosts, or browser control. Neon owns this operational queue; Git remains authoritative for journal content.

The runner snapshot boundary is separate from messaging. After an authenticated claim, it rechecks current membership, device/link state, and authoritative Git HEAD, then returns only `FORMAT_VERSION`, `profiles/snacks.md`, the compatibility `snacks/reports/recurring-snacks.md`, grocery items under `snacks/`, `ingredients/`, `condiments/`, and `groceries/`, plus purchase evidence under current `groceries/evidence/` and legacy `snacks/evidence/`. The runner validates and caches those files under the user's Application Support directory. It never receives repository credentials and never writes Git.

The runner revalidates the allowlisted snapshot files and serializes them into the fixed trusted Codex or Claude Code prompt; the child receives no host-exposed file, shell, or search tool. Codex runs from a dedicated trusted project and separate keyring-backed `CODEX_HOME`; every turn preflights a backend-specific exact capability set while disabling apps, hooks, multi-agent work, remote plugins, and user rules. Chrome uses only the `node_repl` MCP bridge plus Browser/Chrome plugins and carries `BROWSER_USE_AVAILABLE_BACKENDS=chrome`; Safari requires the plugin-owned `computer-use` MCP entry alongside `node_repl`, uses only the official Computer Use plugin, omits that Chrome-only environment, and targets `com.apple.Safari`. Connection requires a separate explicit background-browser choice and persists it in strict local config; a foreground grocery-audit browser choice is neither persisted as household data nor treated as background consent. Legacy configs fail closed until the user runs the explicit browser migration, which preserves the existing runner device/link. Browser Use persists only the configured exact retailer origin in the isolated home. Safari Computer Use has broader macOS accessibility and screenshot authority without an equivalent mechanical origin boundary, so the fixed prompt confines it to Safari and the configured retailer origin; Claude Code remains Chrome-only. The host has no general MCP, checkout, payment, subscription, or substitution authority. The existing snacks profile owns the configurable USD automatic cart-add maximum; direct local or cloud agent conversations mutate it through existing revision-checked profile authority, while the runner remains read-only. Versioned local action receipts bind idempotency to the item, requested quantity, currency, incremental amount, effective maximum, authorization mode, and bounded terminal message. OAuth refresh credentials live in macOS Keychain; the LaunchAgent and local config contain no secret.

### Collaborative meal planning

Local-only meal planning remains inside the revisioned guest journal and uses purpose-specific append operations so concurrent proposals do not replace one another. Connected households store one shared constraint profile plus immutable weekly reviews, proposals, and withdrawals in Git; Neon holds only rebuildable projections and durable mutation state. `append_to_current_head` is restricted to one validated server-derived append-only path under the household transaction lock. Profile changes retain strict expected revisions.

Codex or Claude owns recipe interpretation, separately approved internet research, and the personal weekly scheduled task. The server performs no recipe search or safety classification and stores no scheduler receipt. The optional image-forward board is a private static local file with no login, script, listener, or mutation authority. The authenticated React week view is presentation only; the server owns membership, CSRF, idempotency, validation, and role-aware mutations. Connected meal-planning tools, routes, and navigation are part of the normal server surface, while local planning remains independently available without an account.

### Food-delivery history and cart preparation

The agent client, not the central server, performs bounded user-directed navigation in an installed browser already signed in to a user-selected delivery provider. This is ordinary account-holder order review, not public crawling, unattended scraping, credential handling, or provider API integration. Exact approved HTTPS origins and the current browser session bound the interaction; sign-in, MFA, CAPTCHA, unsupported UI, and user-controlled age/identity steps stop Fullwell.

The local journal or household Git stores provider-neutral complete order-line evidence and `delivery_dish` items. Provider, exact restaurant location, fulfillment mode, dish, modifiers, quantities, and private provider/order locators remain distinct typed fields. A connected contribution is one consented provider source per idempotent mutation. Git remains authoritative; Neon stores the rebuildable full household journal projection, the `search_items` delivery projection, and durable mutation state.

Collections serialize a public allowlist for individual delivery dishes only. Imported dishes gain public import provenance but no history, recurrence, or reorder authority. Local and cloud meal proposals cite an exact dish revision plus ordered-before or shared-dish evidence and default to incomplete ingredient compatibility.

The authenticated React household experience exposes delivery dishes through a server-owned `Takeout` visual projection and dashboard count. The view model resolves history summaries from canonical cited evidence, emits only public restaurant/location and bounded display metadata, keeps public imports explicitly separate, and never serializes private provider/order/group/merchant/menu locators or complete orders. The shared visual-journal continuation is membership-authorized, private/no-store, cursor-bounded, and bound to the initial Git HEAD so infinite scrolling cannot mix repository snapshots; server-rendered page prefixes remain the no-JavaScript fallback.

Direct computer use resolves a complete prior delivery order by provider and then restaurant location. Its ephemeral session binds source lines, current menu mappings, quantities, modifiers, fulfillment, full-cart baseline and target, replacement confirmation, subtotal, maximum, and current local revision or cloud HEAD. It can prepare and verify a cart only. Checkout, order placement, payment, tips, address or schedule changes, memberships, and subscriptions are absent from contracts and tools. Alcohol may be selected under the ordinary maximum, but age/identity UI is user-controlled and no ID data enters Fullwell.

### Operational persistence

Purpose: keep private operational state and rebuildable query projections in Neon PostgreSQL.

Planned paths: `migrations/` and `apps/server/src/persistence/`.

Runtime traffic may use Neon's pooled connection endpoint. Migrations, backup utilities, and operations requiring session semantics use a direct connection. Household write serialization uses a transaction-scoped advisory lock held on the same checked-out connection and transaction as the durable mutation state transition; never rely on session-scoped locks through PgBouncer.

`npm run migrate` is the only release schema writer. It requires an exact expected direct host and an explicit staging/production target, rejects pooled or non-TLS endpoints, requires a second production confirmation, serializes through a PostgreSQL advisory transaction lock, and atomically records each migration filename and SHA-256 content hash in `hfj_schema_migrations`. Application startup never applies schema changes.

Post-commit recovery uses the request ID in the Git commit trailer and audit document as its replay anchor. Each in-flight idempotency key is bound to a hashed canonical request. Mutation handlers derive generated IDs, timestamps, and capability material from the durable request identity so a matching retry can reproduce the original projection and response without another commit, while changed input fails before projection. The scheduled maintenance CLI snapshots Git main with each file's last revision, rebuilds the household name, journal, and membership projections under the same household lock, advances recoverable mutations to `projections_applied`, marks abandoned pre-commit requests failed, and quarantines repositories or identity mappings that cannot be projected safely.

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

1. Git is authoritative for cloud household journal content, exportable settings, collection snapshots, import provenance, and audit history. Before cloud promotion, the single local guest document is authoritative only for that computer.
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

`fullwell.ai` is the sole application origin for browser sessions, passkeys, Apple callbacks, OAuth, MCP, and absolute email links. The Caddy gateway also terminates TLS for `www.fullwell.ai` and the legacy `fullwell.souschefstudio.com` host, but both aliases only return a permanent path-and-query-preserving redirect to the apex and never reverse proxy application traffic. `PUBLIC_ORIGIN` remains the single authority for every origin-bound application contract; request host headers never select an issuer, callback, relying-party ID, resource, or canonical URL.

OpenTofu state is operational infrastructure data, not application data. It lives in a dedicated Neon PostgreSQL database and role through the direct TLS endpoint; the backend uses database advisory locks and a distinct schema per environment. Backblaze is reserved for compliance-locked application backups because its S3-compatible API does not implement OpenTofu's conditional lock write.

The production health path distinguishes process readiness, Neon reachability/schema compatibility, mounted-volume identity and writability, Git availability, signing readiness, and single-writer leadership without exposing secrets or tenant data. A separately authenticated operator route adds bounded reconciliation, backup-gap/age, fsck/signature failure, restore-drill, messaging queue/age, runner-online, and capacity state; `/metrics` exposes the same operational gauges plus low-cardinality HTTP/runtime metrics in OpenMetrics format.

Fastify applies a global and route-specific `@fastify/rate-limit` policy keyed by the client IP after one trusted Caddy hop. `ServiceObservability` is the sole production telemetry adapter for request, MCP, mutation, reconciliation, and maintenance events; it allowlists attribute keys, pseudonymizes entity IDs, and never records request bodies or capability material.

## Current release limitations

The application foundation, durable Git-to-Neon reconciliation, portable exports, production rate limits/telemetry, operator health, encrypted immutable backup/restore, WebAuthn passkeys, browser account lifecycle, 31-tool MCP surface, React SSR shell and connected weekly meal-plan view, Neon operational store, Git mutation path, OAuth server, Apple and Resend adapters, public immutable npm agent package, and DigitalOcean deployment assets are implemented. The MCP and browser surfaces include shared meal-planning constraints, weekly reviews, commutative same-slot proposals, and attributed withdrawals; local planning and host scheduling behavior are governed by the completed collaborative meal-planning ExecPlan. Native Safari enrollment, passkey-only sign-in, household creation, the deployed encrypted Backblaze restore drill, and public-package Codex/Claude lifecycle verification pass. Version 1 is not production-ready while production Neon retention/snapshot and combined recovery evidence, DigitalOcean failover, and external staging compatibility remain open in the active household-journal ExecPlan.

## Maintenance rules

Update this file when:
- an application module or shared package becomes real;
- an authority, trust, deployment, storage, or import direction changes;
- horizontal scaling or a second deployable service is proposed;
- the React delivery model changes materially;
- a temporary version 1 limitation is removed.
