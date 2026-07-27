# Implement Household Food Journal Version 1

## Purpose / Big Picture

Implement the complete Household Food Journal described by `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md`. The finished product consists of three coordinated surfaces:

1. a React 19.2 web experience for installation, sign-in, pending intents, household and account administration, family invitations, public collection previews, selective imports, exports, and destructive account actions;
2. one TypeScript application service that exposes HTTP, OAuth, MCP, scheduled jobs, and the only mutation path into one authoritative Git repository per household; and
3. one shared Codex and Claude agent-client package that performs conversational journal workflows through the hosted MCP service without storing secrets or synchronizing Git.

Use the ChatGPT interface as the collaborative design surface for information architecture, user flows, screen states, content design, and high-fidelity UI iteration. Persist every approved design decision under `docs/design/`; no implementation-critical decision may live only in chat history. The result must be usable at 320 CSS pixels, meet WCAG 2.2 AA, preserve pending user intent through authentication and recoverable errors, and use household and food language rather than Git, OAuth, MCP, token, or commit terminology.

Version 1 deploys one containerized service on one DigitalOcean Droplet. `/data/households` is an attached DigitalOcean Block Storage filesystem. Neon PostgreSQL owns operational identity, OAuth, authorization projection, idempotency, job, and search state; Git owns household journal content and audit history. The server remains the single Git writer and does not call an LLM. Codex and Claude make semantic food decisions and author journal prose.

## Progress

- [x] 2026-07-15T23:50Z: Read the architecture, execution guidance, both complete product specifications, and security/reliability standards; synthesized product, UX, operations, and agent-eval requirements.
- [x] 2026-07-16T00:06Z: Decomposed the work into dependency-ordered milestones, drafted the full-stack plan, ran failure-oriented critique, and folded packaging, legal/privacy, secret-lifecycle, and repository-format findings into blocking acceptance gates.
- [x] 2026-07-16T00:07Z: Passed ExecPlan, documentation, ideation, Git-hook, self-improvement, and knowledge tests; refreshed the context ledger, repository map, and quality-ledger timestamp.
- [x] 2026-07-16T01:35Z: Implemented the npm workspace, React 19.2 SSR/hydration frontend, typed contracts, Fastify MCP/OAuth service, Git mutation adapter, Neon operational/auth/OAuth stores, reversible migrations, Apple/Resend adapters, and server-owned web view models.
- [x] 2026-07-16T01:35Z: Implemented and validated the shared five-skill Codex/Claude package, 22-tool catalog, 20-case dual-host eval matrix, DigitalOcean/OpenTofu topology, Node 24 Docker image, Compose/Caddy/systemd deployment, legal drafts, and operator runbooks.
- [x] 2026-07-16T01:35Z: Passed unit, contract, packaging, eval, security-boundary, isolated Git restore, PostgreSQL 17 integration, migration up/down/up, WebKit e2e, Docker build, Compose render, Caddy, OpenTofu, local deploy, MCP discovery, and production dependency audit checks.
- [x] 2026-07-16T01:35Z: Exercised the live install and invalid collection-capability states in macOS Safari through Computer Use; verified native accessible controls, Codex/Claude selection, and non-enumerating private-data behavior.
- [x] 2026-07-16T02:50Z: Closed the enforced coverage gate with 111 passing tests and 96.93% statements/lines, 94.42% functions, and 90.04% branches. Process roots and Neon adapters remain assigned to their deployment/browser and isolated PostgreSQL integration gates.
- [x] 2026-07-16T03:35Z: Implemented discoverable WebAuthn registration/sign-in and account management with SimpleWebAuthn, five-minute browser/session-bound challenges, Neon public credential storage, atomic counter replay protection, and deterministic provider/route/service/React/PostgreSQL verification.
- [x] 2026-07-16T04:05Z: Completed the browser account lifecycle with provider-proven identity linking, last-method safety, recent-auth grant/deletion gates, Git-audited leave, final-owner enforcement, immediate credential revocation, former-member pseudonyms, and PostgreSQL/coverage evidence.
- [x] 2026-07-16T04:38Z: Implemented durable request-trailer reconciliation, deterministic retry plans, Git-authoritative journal/member projection rebuild, abandoned-request cleanup, repository quarantine, scheduled CLI execution, provisioning recovery, and real PostgreSQL recovery evidence.
- [x] 2026-07-16T05:58Z: Implemented locked readable ZIP and Git bundle generation, hashed one-time requester-bound downloads, content/HEAD verification, 15-minute expiry, 96 MiB bounds, account forms, scheduled cleanup, and PostgreSQL migration/integration evidence; 163 deterministic tests pass at 96.79% statements/lines, 94.64% functions, and 90.02% branches, with all 12 WebKit checks passing.
- [x] 2026-07-16T05:48Z: Implemented grouped production rate limits, stable 429s, server-generated request correlation, centrally redacted structured events, protected OpenMetrics, schema/mount/signing readiness, dedicated operator authentication, and Neon-backed reconciliation/backup/capacity health; 169 deterministic tests and nine PostgreSQL integration tests pass.
- [x] 2026-07-16T06:14Z: Implemented Ed25519-signed/JWE-encrypted backups through a Backblaze-compatible S3 adapter, compliance Object Lock verification, daily durable checkpoints, fsck/signature evidence, and automatic isolated restore drills with migration `0005`; 184 deterministic tests and nine PostgreSQL integration tests pass.
- [x] 2026-07-16T15:59Z: Added Deque axe WCAG A/AA scans across 14 public, pending-intent, and authenticated screens, desktop/iPhone/320-pixel WebKit coverage, reduced-motion and overflow checks, a transient animation-contrast fix, and native macOS Safari accessibility-tree evidence; manual assistive-technology review remains open.
- [x] 2026-07-16T16:06Z: Added deterministic load/race validation for concurrent MCP discovery, preview rate-limit shedding, unique correlation IDs, idempotent write fan-in, stale-head competitors, cross-tenant non-disclosure, and serialized same-household maintenance queues; provisioned soak/resource and OAuth/import/Neon load remain open.
- [x] 2026-07-16T16:20Z: Completed the deterministic adversarial security matrix across authorization, CSRF/redirect/replay, Git/archive, request parsing, capability redaction, hostile/prompt-like rendering, URL schemes, repository secrets, and browser/server configuration separation; external staging review and live rotation/provider exercises remain open.
- [x] 2026-07-16T16:29Z: Verified native 200 percent zoom and keyboard focus on representative public, sign-in, long legal, and error states in macOS 26.5.1 / Safari 26.5; authenticated journeys, VoiceOver, iPhone hardware, and non-Apple assistive-technology evidence remain open.
- [x] 2026-07-16T16:37Z: Moved host catalogs to native repository discovery paths and passed isolated marketplace discovery and lifecycle tests on Codex CLI 0.144.4 and Claude Code 2.1.123; immutable npm publication and real staging workflows remain blocked.
- [x] 2026-07-16T18:23Z: Added a fail-closed direct-Neon migration runner, applied schema `0005` with idempotent re-entry on a one-day schema-only Neon branch, and passed all nine managed-Neon adapter tests.
- [x] 2026-07-16T18:45Z: Restored the disposable branch to its verified 11:28 PDT history point in 0.26 seconds, verified the complete operational schema and migration ledger versions `0001` through `0005`, retained an undo branch, and scheduled both branches for one-day expiration; production retention/snapshots and combined Git-plus-Neon RPO/RTO evidence remain open.
- [x] 2026-07-17T02:52Z: Made Apple Container the macOS harness default, added an isolated labeled PostgreSQL 17 container and persistent volume with ignored generated credentials, and passed migration up/down/up, all nine adapter integration tests, the Node 24 OCI build, image boot, public-route checks, fail-closed readiness, and MCP discovery on Apple Container 1.1.0; production Ubuntu remains Docker Compose under systemd.
- [x] 2026-07-17T20:10Z: Provisioned encrypted private Backblaze state and backup buckets, enabled 35-day default compliance Object Lock on the backup bucket, created bucket/prefix-scoped credentials, and passed live S3 PUT/HEAD/GET plus native retained-version recovery with a backup key that lacks `deleteFiles` and governance bypass.
- [x] 2026-07-17T20:18Z: Proved Backblaze returns `501 NotImplemented` for OpenTofu's `If-None-Match: *` lock primitive and replaced the unsafe S3 backend assumption with OpenTofu's Neon PostgreSQL backend and database advisory locking; live Neon backend initialization remains part of the current DigitalOcean staging step.
- [x] 2026-07-17T17:35Z: Initialized and exercised the dedicated Neon OpenTofu backend schema and advisory locking, then reduced the reviewed staging baseline from a 4 GiB Droplet plus 100 GiB volume to a 1 GiB Droplet plus 50 GiB volume with weekly backups, a $12.20 monthly estimate, and 2 GiB low-swappiness host swap.
- [x] 2026-07-17T17:39Z: Passed the infrastructure regression test, OpenTofu validation, documentation and ExecPlan checks, and the complete repository verification gate with the lean staging baseline pinned in the ignored staging input; no paid DigitalOcean resource has been created.
- [x] 2026-07-17T19:54Z: Provisioned the $12.20 monthly DigitalOcean staging baseline, verified the dedicated weekly backup policy, completed clean cloud-init on the replacement host, mounted and initialized the retained 50 GiB volume, and reached a clean OpenTofu plan after encoding every live bootstrap correction.
- [x] 2026-07-17T19:54Z: Created a dedicated 0.25 CU autosuspending Neon staging branch and application database, applied all five migrations, built and transferred the amd64 release image with Apple Container, installed public service configuration and systemd units, and passed the remote volume/runtime preflight; encrypted runtime credential installation and service start remain next.
- [x] 2026-07-17T21:04Z: Installed encrypted runtime credentials, fixed root-only systemd credential mounts for the UID/GID `10001` container, forced recreation for credential rotation, added Neon TCP `5432` egress, and started healthy app/Caddy containers with valid HTTPS liveness and schema `0005` readiness.
- [x] 2026-07-17T21:04Z: Passed deployed HTTP and MCP discovery smokes, live Neon-backed systemd maintenance with zero failed checks, and native Safari review of the HTTPS install selector, help disclosure, and sign-in layout; real Apple/Resend ceremonies and a non-empty deployed backup/restore remain blocked.
- [x] 2026-07-19T17:01Z: Activated `fullwell.souschefstudio.com`, installed dedicated Apple Services ID and domain-restricted Resend credentials through encrypted systemd sources, and passed real Apple account creation, email-identity linking, and independent email magic-link sign-in in native Safari through Computer Use.
- [x] 2026-07-19T17:01Z: Fixed Safari's live Apple handoff by narrowing CSP `form-action` to self plus Apple's authorization origin, setting the cross-site callback binding cookie to `Secure; SameSite=None`, and accepting Apple's bounded first-authorization `user` field; route/header regression tests and deployed HTTP/MCP smokes pass.
- [x] 2026-07-19T23:42Z: Fixed the strict React registration boundary to preserve SimpleWebAuthn's optional `hints` and `extensions.credProps`, deployed the amd64 image, and completed native Safari Touch ID enrollment plus passkey-only sign-in against DigitalOcean/Neon staging through Computer Use.
- [x] 2026-07-20T00:01Z: Added the missing authenticated, CSRF-protected, idempotent browser household-creation boundary, deployed it with rollback, created a signed staging canary in Safari, and passed the non-empty Backblaze upload plus explicit isolated restore with green Neon checkpoints and operator health.
- [x] 2026-07-20T00:08Z: Replaced the unpublished agent package's placeholder service URLs with the deployed Fullwell origin, added same-origin validation across MCP/install/policy metadata, and passed dry-run packing plus isolated Codex and Claude lifecycle gates; the local npm CLI remains unauthenticated.
- [x] 2026-07-20T01:56Z: Created the free public `@fullwell` npm scope, enabled passkey-backed publishing authorization, and published immutable @fullwell/household-food-journal-agent@1.0.0; the registry checksum matches the prepared tarball, clean Node 24 installation passes in Apple Container, and the downloaded artifact passes isolated Codex and Claude lifecycle tests.
- [x] 2026-07-20T05:31Z: Completed real Codex CLI 0.144.4 and Claude Code 2.1.215 OAuth against staging by adding advertised dynamic registration, bounded native-client metadata, React consent, token-request resource support, and the no-ID MCP initialized notification; both hosts completed token exchange and Claude reported the deployed MCP server connected.
- [x] 2026-07-20T05:31Z: Exercised deployed access revocation and reconnect in native Safari: recent passkey authentication authorized grant cleanup, ten duplicate retry grants were removed, both hosts observed lost authorization, and one clean Codex plus one clean Claude grant reconnected successfully.
- [x] 2026-07-20T05:48Z: Bound the submitted consent client label back to registered metadata so a tampered `/authorize` URL cannot create a misleading grant, deployed `hfj-staging:oauth-20260720-6-runtime` with rollback, and repeated clean Codex and Claude OAuth plus Claude MCP health against the hardened build.
- [x] 2026-07-20T06:13Z: Renamed and published the public agent payload as `@fullwell/fullwell@1.0.0` while preserving the `household-food-journal` host plugin and MCP service identifiers; the 15-file registry artifact matches SHA-1 `ab265c4b264fe25248e2aff7c2a0a2a1f004f2cc`, installs on Node 24 in Apple Container, and passes downloaded Codex and Claude lifecycle tests. The prior package version is deprecated with `Renamed to @fullwell/fullwell` after passkey-backed registry authorization.
- [x] 2026-07-22T03:15Z: Accepted bounded MCP-standard `params._meta` on strict tool calls, added positive and malformed-metadata boundary coverage, passed security and complete repository verification, deployed commit `34d6c20` as `hfj-staging:mcp-meta-20260721-1-runtime`, and completed a read-only real Codex `hfj_get_context` call without `VALIDATION_FAILED` or data mutation.
- [x] 2026-07-24T18:31Z: Replaced the Account page's visible `LEAVE`, `DELETE`, and `REVOKE` fields with action-specific native dialogs that support Cancel, Escape, backdrop dismissal, and focus restoration while preserving server-side literals and a typed no-JavaScript fallback; desktop, mobile, 320-pixel, no-JavaScript, WCAG, full repository, deployment, and MCP smokes pass on `hfj-staging:account-confirm-modal-20260724-1-runtime`.
- [x] 2026-07-24T22:57Z: Replaced Namecheap's HTTP-only forwarding for `fullwell.ai` and `www.fullwell.ai` with A records to `the application gateway address`, obtained valid Caddy-managed certificates, and proved HTTP plus HTTPS permanent redirects preserve path and query. The canonical deployment smoke, `/account` sign-in handoff, and OAuth metadata still use only `https://fullwell.souschefstudio.com`.
- [x] 2026-07-27T20:10Z: Superseded the legacy canonical-origin decision through `docs/exec-plans/active/2026-07-27-canonical-origin-fullwell-ai.md`; the apex now directly serves the healthy application, both aliases redirect path-and-query-preservingly to it, and real Apple sign-in plus OAuth, MCP, messaging, persistence, and rollback checks pass.
- [ ] 2026-07-16T06:14Z: Production Neon retention/snapshot and combined recovery evidence, DigitalOcean failover, full validation, and external/manual review remain blocking; see `docs/release/verification-evidence.md`.
- [ ] Milestone 0 - validate platform assumptions and approve ChatGPT-assisted information architecture and UI design.
- [ ] Milestone 1 - establish the monorepo, shared contracts, generated schemas, fakes, and real quality gates.
- [ ] Milestone 2 - implement Neon persistence, household Git repositories, the mutation state machine, reconciliation, export, and local recovery proof.
- [ ] Milestone 3 - implement browser identity, sessions, MCP OAuth, and the authenticated MCP transport.
- [ ] Milestone 4 - implement household, membership, invitation, and account-lifecycle workflows across server, web, and agent client.
- [ ] Milestone 5 - implement profiles, evidence, snacks, recipes, reports, search, migration, exports, shared skills, and semantic evals.
- [ ] Milestone 6 - implement private collections, public sharing, revocation, selective import, provenance, and installation handoff.
- [ ] Milestone 7 - implement DigitalOcean deployment, maintenance jobs, encrypted off-site backup, observability, and restore/failover runbooks.
- [ ] Milestone 8 - complete security, accessibility, race, load, cross-host, release, and rollback validation and launch version 1.

## Surprises & Discoveries

- 2026-07-15: The repository contains the specialized harness and product specifications but no application packages, migrations, dependencies, or deployment files. Milestone 1 must replace harness-only verification with real package gates before feature work starts.
- 2026-07-15: The user selected React 19.2, while public collection and invitation flows must work without client-side JavaScript. The web architecture therefore needs React server rendering plus ordinary HTML form posts, with hydration used only for enhancement.
- 2026-07-15: "Frontend and backend" is insufficient shorthand for the full request. The companion client spec also requires a released dual-host Codex/Claude package, contract tests, skills, evals, and a manual compatibility matrix.
- 2026-07-15: The browser is intentionally not a second journal-authoring product. Version 1 browser scope is installation, authentication, pending intents, household/account administration, collection preview/import, exports, and sharing support; evidence collection and semantic journal authorship remain agent workflows.
- 2026-07-15: DigitalOcean App Platform cannot hold the authoritative Git filesystem. The initial production topology must remain a fenced single writer on a Droplet with attached Block Storage.
- 2026-07-17: The initial 4 GiB Droplet and 100 GiB volume were conservative production-headroom defaults, not provider requirements. Staging can begin at 1 GiB RAM and 50 GiB persistent storage when images are built off-host, 2 GiB low-swappiness swap absorbs transient pressure, and provisioned load evidence gates any production sizing decision.
- 2026-07-15: Neon transaction-mode pooling cannot safely hold session-scoped advisory locks. Every household mutation must use a transaction-scoped lock on one checked-out connection and transaction; migrations and session-dependent administration use a direct connection.
- 2026-07-15: Failure-oriented critique found three release gaps in the first draft: dual Codex/Claude manifests and catalogs were not named as deliverables, public privacy/legal surfaces were only implicit, and the Droplet secret lifecycle lacked a selected delivery and rotation mechanism. The milestones below now make all three blocking work.
- 2026-07-16: A real coverage run exposed that broad application composition and provider branches are not sufficiently tested: 67.55% lines versus the 90% configured threshold. The gate remains enabled and failing rather than being lowered.
- 2026-07-16: Focused domain, service, adapter, worker, HTTP, and React tests raised deterministic coverage to 96.93% statements/lines, 94.42% functions, and 90.04% branches. The same work exposed and fixed an in-memory lock-tail retention defect.
- 2026-07-16: Native Safari review found no layout or privacy defect in the tested install and invalid-capability states. Automated WebKit also passed at desktop, iPhone, 320x568, and with JavaScript disabled.
- 2026-07-16: Safari 26.5 WebDriver advertised virtual-authenticator support and accepted a CTAP2 platform authenticator, but credential creation timed out and credential enumeration returned `not implemented`. Deterministic cryptographic/provider policy and browser-action tests close the implementation gate; native compatibility remains a staging evidence gate.
- 2026-07-16: Local deployment smoke initially returned Fastify's default 500 for unauthenticated MCP requests after the static plugin registered. Moving the application error boundary before route/plugin registration restored the required 401 challenge and added a regression assertion with the web plugin enabled.
- 2026-07-16: The first account-leave implementation updated only Neon membership rows. Diff review caught the authority violation; the final path commits the former-member document and audit event under the household lock before advancing the Neon projection.
- 2026-07-16: Throwing `RECONCILIATION_REQUIRED` from inside Neon's household transaction rolled back the mutation marker even though Git had already committed. Recovery outcomes now commit their database state before errors cross the transaction boundary.
- 2026-07-16: Real PostgreSQL verification found account leave opening a nested transaction and waiting on its own advisory lock. The operational store now reuses the active household transaction, and the integration suite covers the calling context.
- 2026-07-17: Apple named volumes contain an ext4 `lost+found` entry, so the PostgreSQL image cannot initialize with the mount root as `PGDATA`. The harness uses `/var/lib/postgresql/data/pgdata` while preserving the parent named volume.
- 2026-07-17: Apple Container 0.11.0 repeatedly failed before Dockerfile execution with its known `unable to write data to the archive, code 0` defect. Version 0.12.0 fixed that upstream archiver path, so the local image-build action rejects older clients with an upgrade instruction.
- 2026-07-17: Apple Container 1.1.0 changed JSON resource output from top-level string state/name fields to structured `status.state` and `configuration.name` fields. The harness accepts and tests both shapes so supported upgrades do not orphan the persistent local database.
- 2026-07-17: Backblaze B2's S3-compatible API returns `501 NotImplemented` for conditional `If-None-Match: *` writes, so it cannot safely back OpenTofu's native S3 lockfile. OpenTofu's PostgreSQL backend provides locking through Neon advisory locks without another paid state service.
- 2026-07-17: A Backblaze key without `deleteFiles` can still create a hide marker through S3 `DeleteObject` because `writeFiles` includes `b2_hide_file`. Compliance Object Lock retained the upload version, and the restricted key could list and download it by native file ID; runbooks now distinguish hiding from permanent version deletion.
- 2026-07-17: The first DigitalOcean boot could not reach Ubuntu's HTTP package mirrors because the firewall allowed only HTTPS. The declared runtime egress now includes TCP 80, and a clean replacement completed cloud-init with Docker and swap active.
- 2026-07-17: DigitalOcean's provider read reports `backups = false` while the dedicated endpoint confirms the declared weekly policy. OpenTofu ignores that stale field, and deployment evidence must query the dedicated policy endpoint after apply.
- 2026-07-17: The generated systemd device unit name escaped the label separator but not the hyphen inside `hfj-households`, so the mount waited on a nonexistent device. The mount unit now relies on systemd's automatic dependency from `/dev/disk/by-label/hfj-households`.
- 2026-07-17: A newly formatted ext4 volume contains root-owned `lost+found`. Initialization now permits only that exact safe entry and still rejects symlinks, unexpected ownership, and every other preexisting root entry.
- 2026-07-17: The remote migration runner's `PGDATABASE=<connection URL>` assumption made libpq use the local socket. It now parses the validated URL into libpq host, port, user, password, database, TLS, and channel-binding environment fields while keeping credentials out of process arguments.
- 2026-07-17: Docker Compose bind-backed secrets preserved systemd's root-only credential permissions, so the unprivileged application could not read them. Startup now copies the declared credentials into a private runtime directory as `root:10001` mode `0440`; rotation requires a unit restart with forced recreation because Compose does not detect secret-content changes and systemd reload does not reacquire encrypted sources.
- 2026-07-17: Public liveness passed while readiness raised a Neon connection `AggregateError`; the Cloud Firewall allowed HTTPS but not PostgreSQL. Declared TCP `5432` egress restored pooled Neon connectivity without broadening inbound access.
- 2026-07-17: `systemd-creds` warned that the staging host credential key is stored on unencrypted root media. Encrypted credential blobs are useful staging hygiene but do not satisfy the production secret-management gate without encrypted/TPM-backed storage or an external manager.
- 2026-07-19: Safari applies CSP `form-action` across the POST redirect chain, so a self-only policy silently prevented the Apple authorization page from opening. Allowing only `https://appleid.apple.com` restored the handoff without broadening other form destinations.
- 2026-07-19: Apple's `response_mode=form_post` returns through a cross-site POST. The browser-binding cookie therefore requires `Secure; SameSite=None`, and the callback must tolerate Apple's optional first-authorization `user` form field while preserving strict bounds.
- 2026-07-19: SimpleWebAuthn 13.3 registration options include `hints: []` and `extensions: { credProps: true }`; a strict browser schema that omitted those optional protocol fields rejected valid options before calling `navigator.credentials.create()`. Native ceremonies also require completing the five-minute one-time challenge without pausing across a manual handoff.
- 2026-07-20: The server-rendered household list exposed a creation form before its POST boundary was registered. Native Safari caught the live 404; the route now shares the authenticated, CSRF-checked, idempotent application service used by MCP, and route coverage prevents another presentation-only mutation control.
- 2026-07-20: npm requires passkey-backed two-factor authorization for direct publishing from a new account. The first publish failed closed with `E403`; after 2FA enrollment, the one-time web authorization published the exact prepared tarball.
- 2026-07-20: The host lifecycle copy filter treated a public package's ancestor `node_modules` path as a nested dependency and skipped the entire package. The filter now evaluates paths relative to the selected package root, so the same tests exercise either the workspace or a clean registry install.
- 2026-07-20: Current Codex and Claude hosts use more of the standards surface than the protocol fixture originally covered. Codex repeats `resource` during code exchange; Claude registers additional bounded native-client metadata and sends `notifications/initialized` without an ID, expecting an empty successful response before tool discovery.
- 2026-07-22: Current Codex/RMCP includes MCP-standard `params._meta` on a tool call even when the visible tool arguments are `{}`. A strict envelope that omitted this extension rejected the request before service logic, so host-level read-only verification is required in addition to direct service tests.
- 2026-07-20: Safari accessibility `AXPress` clicks on the server-rendered consent and revoke form buttons did not consistently submit, while focusing the same native control and sending Return did. Host callback listeners must remain active throughout browser automation, and every action must be verified from the callback or server state rather than inferred from the click.
- 2026-07-20: A public npm package is only the immutable plugin payload. Neither host can discover it from a public marketplace until an intentional repository/catalog source exists; local catalog installation is valid release evidence for the payload but does not close public discovery.
- 2026-07-24: Namecheap URL forwarding resolves `fullwell.ai` and `www.fullwell.ai` to `the forwarding service address`, redirects plain HTTP, and times out on HTTPS. The canonical origin already resolves to the DigitalOcean gateway at `the application gateway address`, so valid alias TLS must terminate at Caddy instead of the forwarding service.
- 2026-07-24: Namecheap's authoritative nameservers reflected the new A records immediately, while recursive resolvers briefly mixed the former forwarding address and the gateway address. Direct authoritative checks and Caddy's successful distributed ACME HTTP-01 validations provided cutover evidence without waiting for every pre-existing recursive cache to expire.

## Decision Log

- 2026-07-27: Supersede the 2026-07-24 alias-only decision. `https://fullwell.ai` is now the sole application, cookie, passkey, Apple callback, OAuth issuer, and MCP origin; `www` and `fullwell.souschefstudio.com` are redirect-only compatibility hosts. The dedicated canonical-origin ExecPlan owns migration and reconnect evidence.
- 2026-07-24: Keep `https://fullwell.souschefstudio.com` as the sole application, cookie, passkey, Apple callback, OAuth issuer, and MCP origin. Point `fullwell.ai` and `www.fullwell.ai` at the same gateway only so Caddy can return a path-and-query-preserving permanent redirect; the alias hosts never reverse proxy the application.
- 2026-07-15: Use npm workspaces with `apps/server`, `apps/web`, `packages/contracts`, and `packages/agent-client`. One root lockfile and one verification command keep contract changes atomic.
- 2026-07-15: Use Fastify for the TypeScript application service and React 19.2 with Vite for shared server/client builds. Public and pending-intent routes server-render React and post to normal Fastify form handlers; React hydration adds selection, sharing, and inline state enhancements without becoming a security boundary.
- 2026-07-15: Use explicit SQL migrations and the standard PostgreSQL protocol rather than making an ORM authoritative. Runtime code accesses Neon through typed persistence ports; pooled and direct URLs are distinct parsed configuration values.
- 2026-07-15: Keep one runtime schema source in `packages/contracts`. Generate and verify the published MCP schema artifact from it; do not maintain separate handwritten server, web, and client schemas.
- 2026-07-15: Model durable mutations with explicit states: `received`, `locked`, `git_committed`, `projections_applied`, `completed`, `failed_before_commit`, `reconciliation_required`, and `quarantined`. Only `completed` returns success. A retry after `git_committed` finds the existing request trailer and finishes projections rather than committing again.
- 2026-07-15: Implement provider ports for Apple identity, email delivery, WebAuthn, token signing/encryption, object backup, clock, randomness, and telemetry. Milestone 0 selects maintained libraries and production providers after current primary-documentation and interoperability spikes; tests use deterministic fakes.
- 2026-07-15: Use an S3-compatible encrypted-backup adapter but require the production bucket to live outside the DigitalOcean Droplet and Block Storage failure domain. Provider and retention choices are a release-blocking Milestone 0 decision.
- 2026-07-15: Select Backblaze B2 in a separate account for version 1 object backup. Its S3-compatible API, compliance Object Lock, and lower published storage price fit the backup workload; keep `BackupPort` provider-neutral and require a live staging retention drill before launch.
- 2026-07-15: Select and document the production secret delivery mechanism in Milestone 0. Secrets must be delivered at runtime with least privilege, remain outside images and the Git volume, support independent revocation, and pass rotation and recovery drills before launch.
- 2026-07-15: Do not add browser-side snack or recipe editing in version 1. The authenticated household UI exposes role/member/invitation/collection/export administration and links users to the agent installation flow.
- 2026-07-15: Release backend, web, contracts, and agent client as one coordinated version until backward-compatible schema evolution and an explicit client compatibility window are proven.
- 2026-07-15: Publish accessible `/privacy` and `/terms` pages and link them from install, sign-in, OAuth consent, public collection, account, and deletion flows. Their claims must match implemented collection, retention, export, deletion, support, and subprocessors behavior.
- 2026-07-16: Keep the enforced deterministic coverage threshold at 90%. Exclude only process composition roots and Neon integration adapters from that unit denominator because they require process, browser, deployment, or PostgreSQL execution; keep those dedicated gates mandatory and separately evidenced.
- 2026-07-16: Use SimpleWebAuthn 13 for WebAuthn protocol and cryptographic handling. Require discoverable credentials and user verification, store only public credential material in Neon, bind enrollment to the authenticated session and CSRF token, bind sign-in to an HttpOnly browser transaction, and update counters atomically.
- 2026-07-16: Browser account changes reuse provider proof and the single Git-writer boundary. Apple/email links remain bound to the signed-in browser, destructive global access changes require recent authentication, and household exit writes the same former-member Git document used by MCP membership removal before account credentials are revoked.
- 2026-07-16: Recovery uses Git request trailers plus deterministic HMAC-derived per-request IDs and 32-byte capability material. Git snapshots retain each file's last commit revision; unsafe documents or missing private identity mappings quarantine the household rather than weakening authorization.
- 2026-07-16: Export download capability material and artifact IDs are derived from the durable request identity. Artifact metadata and mutation completion commit in the same Neon household transaction; exact retries reproduce one URL, while changed input conflicts. Download bytes are verified before the atomic single-use claim to avoid consuming corrupt artifacts.
- 2026-07-17: Use Apple's `container` CLI for local OCI builds and PostgreSQL verification on Apple silicon macOS. Keep the portable `Dockerfile` and the DigitalOcean Ubuntu Docker Compose/systemd runtime unchanged because Apple Container is a local host tool, not a Linux production orchestrator.
- 2026-07-17: Store DigitalOcean OpenTofu state in a dedicated Neon PostgreSQL database and role through the direct TLS endpoint, with one schema per environment. Do not use Backblaze for state because its conditional-write semantics cannot provide the required lock; keep Backblaze scoped to compliance-locked application backups.
- 2026-07-17: Use `s-1vcpu-1gb`, a 50 GiB Block Storage volume, and weekly backups as the reviewed staging baseline, estimated at $12.20 per month before tax using current DigitalOcean prices. Build images off-host, monitor memory/swap and maintenance duration, and require an explicit production size backed by staging load evidence.
- 2026-07-17: Treat cloud-init as a first-boot contract. Ignore post-creation `user_data` drift during ordinary plans and require an explicit reviewed Droplet replacement for bootstrap changes, with the volume and reserved IP proven preserved before apply.
- 2026-07-17: Bridge systemd credentials to the unprivileged container only through the unit-owned tmpfs runtime directory, keep the maintenance unit dependent on that directory, and rotate only through a unit restart that reacquires encrypted sources and recreates containers.
- 2026-07-20: Treat Codex and Claude as first-class OAuth/MCP contract fixtures. Advertise DCR and public-client authentication, allowlist the common native-client registration fields, validate optional token-request resource indicators before credential consumption, and implement notification-specific empty success responses.
- 2026-07-22: Parse MCP `params._meta` as bounded JSON at the transport boundary and ignore it in domain logic. Keep the request envelope strict for every other field and preserve independent tool-input validation.
- 2026-07-20: Keep public package publication and public host-catalog publication as separate release gates. Do not upload the repository merely to make the package discoverable; record the missing public catalog as a blocker until a reviewed publication destination exists.
- 2026-07-20: Treat the npm package name as independent from host-facing identifiers. Publish the concise `@fullwell/fullwell` package name while retaining `household-food-journal` for installed plugin identity, MCP registration, OAuth clients, and server compatibility.

## Context and Orientation

The repository now contains the coordinated application foundation. The long-lived sources of truth are:

- `AGENTS.md` for workflow and invariants;
- `docs/ARCHITECTURE.md` for authority and dependency boundaries;
- `docs/CODING_STANDARDS.md` for TypeScript, React, Neon, Git, and agent rules;
- `docs/SECURITY.md` and `docs/RELIABILITY.md` for trust and failure behavior;
- `docs/product-specs/household-food-journal-server.md` for server, web, persistence, deployment, and acceptance requirements;
- `docs/product-specs/household-food-journal-client.md` for shared skills, MCP use, semantic rules, packaging, evals, and host compatibility.

Planned code ownership:

- `packages/contracts/` owns branded identifiers, roles/scopes, runtime schemas, HTTP and MCP envelopes, Git document schemas, error codes, and generated contract artifacts.
- `apps/server/` owns configuration, HTTP, React SSR integration, sessions, identity, OAuth, MCP, household use cases, Git mutation, Neon persistence, mail, jobs, export, backup, reconciliation, and observability.
- `apps/web/` owns React components, route layouts, accessible form behavior, hydration, content presentation, client enhancement, and browser tests. It imports only public contracts.
- `packages/agent-client/` owns shared skills, Codex and Claude manifests, MCP endpoint metadata, privacy/semantic references, packaging tests, contract fixtures, and agent eval cases.
- `migrations/` owns reversible Neon PostgreSQL schema changes and rollback instructions.
- `tests/` owns cross-package contract, integration, security, end-to-end, restore, and deployment smoke fixtures that do not belong to one package.
- `infra/`, `deploy/`, and `docs/runbooks/` own DigitalOcean provisioning, service definitions, maintenance schedules, and operator recovery procedures.

No provider SDK may enter domain modules. The server maps typed entity operations to repository paths; callers never supply filesystem paths, Git arguments, commit authors, refs, or messages. Public collection serialization is a server-side allowlist projection, not a private object with fields hidden in React.

## Framing Notes

### Expert panel

- Product and information-architecture lead - keeps install, invite, import, household, and account intentions distinct and avoids inventing a browser journal editor.
- Accessibility-focused frontend architect - reconciles React with no-JavaScript forms, 320-pixel support, screen-reader semantics, focus recovery, and mobile sharing.
- Security and privacy engineer - covers OAuth, WebAuthn, capability URLs, CSRF, tenant isolation, Markdown, secret handling, and public-field leakage.
- Distributed-systems and Git architect - owns the single-writer mutation state machine, idempotency, projection drift, conflict behavior, and recovery.
- Reliability and operations engineer - covers DigitalOcean volume identity, Neon pooling, backups, restore drills, observability, and failover fencing.
- Agent UX and eval specialist - preserves evidence-first workflows, semantic decision ownership, prompt-injection boundaries, and Codex/Claude compatibility.

### What problem are we actually solving?

Build a private family journal that feels conversational while retaining individual identity, explicit sharing, auditable history, concurrency safety, portable ownership, and a browser experience that never asks ordinary users to understand infrastructure. The hard problem is not rendering screens; it is keeping browser, agent, Git, and Neon authorities consistent through authentication, retries, conflicts, public capabilities, and partial failures.

### Roundtable highlights

- Product/IA: treat `Join household` and `Import selected` as separate top-level intents before, during, and after sign-in. Never route a pending recipient into unrelated household creation.
- Frontend/accessibility: server-render every public or pending-intent entry state and use normal forms as the baseline. Hydration may improve selection and sharing but cannot be required to accept an invitation or import selected items.
- Security/privacy: never put share, invitation, magic-link, or OAuth tokens in analytics, client storage, logs, referrers, screenshots, or error reporting. The server must generate public projections by allowlist.
- Git/consistency: prove one commit per idempotency key, expected-HEAD conflicts, crash recovery, append-only enforcement, and signed restore before layering product features over the pipeline.
- Reliability/operations: implement backup and restore primitives with the mutation foundation; do not defer all recoverability to launch hardening.
- Agent/evals: deterministic code may find exact candidates and validate evidence, but Codex or Claude must decide food identity, recipe equivalence, statuses, merges, and report prose.

### Key tensions

- React richness versus public no-JavaScript and accessibility requirements.
- Git authority versus Neon authorization and search performance.
- Fast first-run OAuth versus strict redirect, token, pending-intent, and separate-user guarantees.
- Helpful duplicate suggestions versus prohibited programmatic semantic merging.
- Public link convenience versus capability-token leakage and private-field disclosure.
- One-process simplicity versus maintenance jobs, failover, and durable recovery.

### Synthesis for decomposition

- Freeze contracts and design state matrices before parallel frontend/client implementation.
- Prove Git, Neon, idempotency, signing, and reconciliation as a vertical foundation before product mutations.
- Add identity and OAuth before exposing protected MCP tools or authenticated browser administration.
- Deliver household/account, journal, and collection journeys in dependency order with their web states, skills, tests, evals, and telemetry in the same milestone.
- Treat staging deployment, persistence smoke, backup restore, security, accessibility, and cross-host evidence as blocking work, not post-launch cleanup.

## Information Architecture and UI Contract

Milestone 0 uses the ChatGPT interface to propose, compare, and revise the following artifacts. The user approves them before component implementation. Approved content is written to `docs/design/`.

### Public and pending-intent routes

- `GET /install` - literal product/install screen with a `Use with Codex` / `Use with Claude` segmented choice and one current action at a time.
- `GET /sign-in` - Continue with Apple first, an existing passkey when available, and email magic link fallback; no service password.
- `GET /invite/family/:token` - safe household, inviter, role, and expiration preview followed by sign-in and explicit `Join household`.
- `GET /c/:token` - public-safe collection snapshot with independent recipe/snack selection, scoped select-all controls, sharing, privacy, expiration, install handoff, and `Import selected`.
- `POST /c/:token/import/plan` and `POST /c/:token/import` - ordinary HTML form baselines enhanced by React for duplicate resolution and progress.
- `GET /privacy` and `GET /terms` - versioned, accessible public policies covering data use, retention, exports, deletion, subprocessors, capability links, and support contact.
- OAuth authorization and consent routes - browser-controlled sign-in, scoped consent, and return to Codex or Claude without showing tokens.

### Authenticated routes

- `GET /households` - create or choose a household, or resume a pending invitation/import.
- `GET /households/:id` - quiet operational overview of role, members, pending invitations, private collections, exports, and agent install/use actions.
- `GET /households/:id/members` - owner member/role/invitation management with final-owner protection.
- `GET /households/:id/collections` - private collection shares, expiration, copy/share actions, and revocation; journal content selection remains conversational through the agent.
- `GET /account` - profile, Apple/email/passkey methods, active MCP grants, household membership, exports, leave/delete actions, and reauthentication gates.

### Required screen-state matrix

For every route, `docs/design/screen-state-matrix.md` must specify loading or server-waiting, empty, populated, validation error, authorization denial, expired/revoked capability, rate limit, stale revision, retryable failure, non-retryable failure, success, partial success, cancellation, keyboard focus destination, and no-JavaScript behavior. It must cross these states with owner/editor/viewer/link-visitor roles, signed-in/signed-out identity, zero/one/multiple households, and pending invite/import/MCP intents.

### Visual and interaction direction

- Authenticated administration is compact, calm, work-focused, and optimized for repeated household actions; avoid marketing composition and decorative card grids.
- Public collections may be more food-forward, but actual shared items and their provenance are the primary visuals. Do not use atmospheric stock imagery where users need to inspect the selected food or recipe.
- Use semantic HTML, familiar Lucide icons, tooltips for unfamiliar icon-only actions, swatches for any color choice, segmented controls for platform choice, checkboxes for item selection, and native confirm language for destructive commands.
- Use a restrained multi-hue token system with strong text contrast, clear focus, and non-color state cues. Avoid a one-note purple, beige, dark-blue, or orange/brown palette.
- Keep cards at 8px radius or less, do not nest cards, do not put page sections in floating cards, and use stable responsive dimensions so dynamic states do not shift controls.
- Include reduced-motion behavior. Motion is limited to purposeful route/state transitions and must not block reading or input.
- Validate high-fidelity designs at 1440x900, 1024x768, 390x844, and 320x568 in the ChatGPT design review and again against implemented Playwright screenshots.

## Milestones

### Milestone 0 - Feasibility, ChatGPT design, and contract decisions

Files:

- `docs/design/information-architecture.md`
- `docs/design/user-flows.md`
- `docs/design/screen-state-matrix.md`
- `docs/design/content-style.md`
- `docs/design/visual-system.md`
- `docs/design/component-inventory.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/exec-plans/active/2026-07-15-household-food-journal-v1.md`

Tasks:

1. Use the ChatGPT interface to walk through first-time setup, returning sign-in, invite acceptance, MCP authorization, household selection, public preview, selective import, duplicate resolution, sharing, revocation, export, leave, and deletion. Record questions, decisions, user language, and all edge states in the design docs.
2. Produce route maps, low-fidelity flow diagrams, responsive high-fidelity screens, a component inventory, content/error copy, and role/pending-intent state matrices. Require explicit user approval before Milestone 1 UI implementation.
3. Build disposable spikes outside production modules to validate React 19.2 server rendering and hydration through Fastify/Vite, ordinary no-JavaScript form posts, WebAuthn virtual-authenticator tests, the current official MCP SDK and OAuth discovery/registration requirements for Codex and Claude, Neon transaction-scoped advisory locks, signed Git commits in the target container, and DigitalOcean volume mount detection.
4. Select and record maintained libraries for runtime schemas, OAuth authorization-server behavior, Apple OIDC, WebAuthn, sanitization, rate limiting, SQL migrations, logging/telemetry, encryption, and S3-compatible backup. Prefer proven libraries over hand-rolled protocol, crypto, parser, or auth engines.
5. Choose the production email provider and an off-site object provider/account. Record data-processing, retention, object-lock, region, cost, and recovery constraints without adding credentials.
6. Select the production secret-delivery mechanism for the Droplet and document bootstrap, least-privilege access, audit, revocation, independent rotation, emergency recovery, and operator access. Cover Apple, OAuth/cookie/HMAC, email, Git signing, backup encryption/object storage, Neon, and DigitalOcean credentials; no secret may be baked into an image or stored on the household Git volume.
7. Define performance budgets, supported browser/agent versions, accessibility test tooling, feature/configuration gates, and the staging test-identity strategy.

Verification:

- `npm run verify:docs`
- `npm run verify:execplan`
- manually review every design route and screen state against both product specs
- attach ChatGPT design snapshots or links in `docs/design/information-architecture.md` and preserve final decisions as text

Exit criteria:

- the user approves the IA, user flows, visual direction, and all required screen states;
- each protocol/storage spike has a written pass/fail result and selected approach;
- no unresolved choice can invalidate the monorepo, SSR, auth, Git signing, Neon locking, backup, or deployment topology.

### Milestone 1 - Monorepo, contracts, fakes, and quality gates

Files:

- `package.json`
- `package-lock.json`
- `tsconfig.base.json`
- `eslint.config.js`
- `.coverage-thresholds.json`
- `playwright.config.ts`
- `vitest.workspace.ts`
- `apps/server/package.json`
- `apps/server/tsconfig.json`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/errors.ts`
- `packages/contracts/src/git-documents.ts`
- `packages/contracts/src/http.ts`
- `packages/contracts/src/mcp.ts`
- `packages/contracts/src/mutations.ts`
- `packages/contracts/generated/mcp-tools.schema.json`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `packages/agent-client/.mcp.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/tests/packaging/`
- `tests/contract/`

Tasks:

1. Configure npm workspaces, strict TypeScript, ESLint, formatting, Vitest, coverage enforcement, React Testing Library, Playwright, and deterministic schema generation. Pin React and React DOM to the 19.2 release line and Node to 24 LTS.
2. Define branded IDs, UTC timestamp/revision types, role/scope unions, error envelopes, pagination, evidence/snack/recipe/report/collection/import schemas, public-safe projections, all MCP inputs/outputs, HTTP view/form schemas, Git frontmatter/documents, and the durable mutation state machine.
3. Generate one machine-readable MCP schema artifact and fail verification when generated output differs from source. Build a fake MCP server and typed HTTP fake consumed by web, agent-client, and contract tests.
4. Add deterministic clock, UUIDv7/randomness, crypto, mail, Git, Neon, storage, and telemetry ports with fakes. Keep external SDK imports out of domain and contract modules.
5. Create host-specific Codex and Claude manifests, marketplace catalogs, MCP endpoint metadata, and immutable install metadata that point to one shared skill/reference implementation. Validate each host's required structure and frontmatter, keep skill frontmatter limited to discovery metadata, and reject embedded credentials, local paths, or divergent tool schemas.
6. Replace harness-only package commands with real `lint`, `typecheck`, `build`, unit, contract, integration, security, eval, e2e, and aggregate verification commands as their real runners land. No command may pass solely because a suite is absent.
7. Add nested `AGENTS.md` files only where server, web, contracts, or agent-client rules materially differ from the root guidance.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit --workspace @hfj/contracts`
- `npm run test:contract`
- `npm run test:packaging --workspace @hfj/agent-client`
- `npm run build`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

Exit criteria:

- web, server, and agent client compile against the same runtime schemas;
- generated schema drift fails CI;
- deterministic contract and adapter code has 100% line and branch coverage;
- frontend and client work can proceed against typed fakes without waiting for a deployed server.

### Milestone 2 - Neon, Git authority, mutation, export, and recovery foundation

Files:

- `migrations/0001_operational_core.sql`
- `migrations/0001_operational_core.down.sql`
- `apps/server/src/config.ts`
- `apps/server/src/persistence/`
- `apps/server/src/git/`
- `apps/server/src/domain/authorization.ts`
- `apps/server/src/domain/repository-schema.ts`
- `apps/server/src/domain/mutations.ts`
- `apps/server/src/services/household-provisioning.ts`
- `apps/server/src/services/mutation-runner.ts`
- `apps/server/src/services/reconciler.ts`
- `apps/server/src/services/exporter.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `tests/integration/git/`
- `tests/integration/neon/`
- `tests/integration/recovery/`

Tasks:

1. Parse all configuration once. Require separate pooled runtime and direct migration Neon URLs, a validated repository root, temporary-worktree root, signing configuration, token peppers, and explicit non-production test configuration.
2. Add reversible migrations for all minimum operational tables, constraints, unique idempotency keys, expiry indexes, token/grant state, projections, backup checkpoints, and reconciliation jobs. Run migration up/down/up against an isolated Neon branch.
3. Implement the sole Git adapter with fixed argument arrays, `shell: false`, fixed environment, timeouts/output limits, disabled hooks, and no caller-controlled refs/paths/messages/authors. Reject symlinks, submodules, executable files, unsafe refs, alternates, oversized changes, and append-only rewrites.
4. Provision one signed bare repository per household with `main`, `FORMAT_VERSION`, the required directory layout, deterministic UTF-8/LF JSON and Markdown serialization, a pseudonymous actor projection, and no private identity data.
5. Implement transaction-scoped household locking and mutation states. Authenticate/authorize through an injected principal, create/read the idempotency row, lock, verify projections and expected revisions, apply typed path changes in a clean worktree, validate, append one audit event, create one signed commit, atomically advance `main`, update projections, store the response, and clean up.
6. Implement expected-HEAD and expected-blob conflicts with bounded semantic-neutral diffs. Never auto-merge Markdown.
7. Implement reconciliation for crash-after-commit, projection rebuild, request-trailer replay, failed provisioning, share-revocation audit completion, and repository quarantine.
8. Implement readable ZIP and verifiable Git bundle generation with short-lived download records and archive traversal protection.
9. Implement local encrypted bundle/manifest creation and an isolated restore test now; production off-site scheduling lands in Milestone 7.

Verification:

- `npm run test:unit --workspace @hfj/server -- mutations authorization repository-schema`
- `npm run test:integration -- git`
- `npm run test:integration -- neon`
- `npm run test:integration -- recovery`
- `npm run test:security -- git tenant-isolation archive`
- `npm run test:migrations -- up-down-up`
- `npm run verify`

Exit criteria:

- one accepted mutation produces exactly one signed commit and audit event;
- concurrent household writes serialize without silent overwrite;
- retrying any crash point cannot create a second commit;
- append-only, path, tenant, and size violations fail before commit;
- an exported bundle restores and reconciles in an isolated test environment.

### Milestone 3 - Identity, sessions, OAuth, and authenticated MCP

Files:

- `apps/server/src/auth/`
- `apps/server/src/oauth/`
- `apps/server/src/mcp/`
- `apps/server/src/http/auth-routes.ts`
- `apps/server/src/http/oauth-routes.ts`
- `apps/server/src/http/mcp-route.ts`
- `apps/server/src/http/security.ts`
- `apps/web/src/entry-server.tsx`
- `apps/web/src/entry-client.tsx`
- `apps/web/src/routes/sign-in.tsx`
- `apps/web/src/routes/oauth-consent.tsx`
- `apps/web/src/components/auth/`
- `tests/contract/oauth/`
- `tests/contract/mcp/`
- `tests/e2e/auth/`
- `tests/security/auth/`

Tasks:

1. Implement Continue with Apple using server-side code/token validation and stable subject mapping; capture first-returned name/email only for allowed uses.
2. Implement email magic-link challenges with generic account discovery, 15-minute expiry, one-time hashed tokens, initiating-browser binding when practical, and pending-intent resume.
3. Implement passkey enrollment and sign-in with discoverable WebAuthn credentials and required user verification where supported. Enforce at least one remaining sign-in method.
4. Implement secure web sessions, rotation, CSRF protection, SameSite/HttpOnly/Secure cookies, reauthentication markers, pending-intent cookies, rate limits, HSTS/CSP/referrer headers, and redacted structured errors.
5. Implement OAuth protected-resource and authorization-server metadata, authorization code with PKCE S256, exact redirect validation, state/nonce validation, resource/audience validation, scopes, scoped consent, short access tokens, rotated refresh tokens with reuse detection, revocation, and the currently required Codex/Claude registration/discovery mechanisms.
6. Expose one Streamable HTTP MCP endpoint at `/mcp`. Authenticate every call, parse every tool input, return the common envelope, paginate bounded output, and publish current schemas.
7. Server-render and hydrate sign-in and consent routes. Authentication always occurs in the service browser page; no tool or skill asks for credentials, codes, or tokens.
8. Prove current Codex and Claude can complete a read-only authorization and call `hfj_get_context` against staging before enabling mutations.

Verification:

- `npm run test:unit --workspace @hfj/server -- auth oauth mcp`
- `npm run test:contract -- oauth mcp`
- `npm run test:security -- auth oauth csrf redirects replay rate-limits redaction`
- `npm run test:e2e -- auth`
- `npm run test:mcp-smoke -- codex`
- `npm run test:mcp-smoke -- claude`
- `npm run verify`

Exit criteria:

- Apple, passkey, and magic-link paths create separate auditable user identities without a service password;
- token rotation/reuse, revocation, scope/role, redirects, pending intents, and CSRF are covered by negative tests;
- no secret appears in browser bundles, URLs, Git, logs, MCP output, screenshots, or analytics;
- both agent hosts authorize without copied bearer tokens.

### Milestone 4 - Household, invitation, membership, and account workflows

Files:

- `apps/server/src/households/`
- `apps/server/src/accounts/`
- `apps/server/src/mcp/tools/context.ts`
- `apps/server/src/mcp/tools/households.ts`
- `apps/server/src/http/household-routes.ts`
- `apps/server/src/http/account-routes.ts`
- `apps/server/src/http/invitation-routes.ts`
- `apps/web/src/routes/households.tsx`
- `apps/web/src/routes/household-overview.tsx`
- `apps/web/src/routes/household-members.tsx`
- `apps/web/src/routes/account.tsx`
- `apps/web/src/routes/family-invite.tsx`
- `apps/web/src/components/households/`
- `apps/web/src/components/account/`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/evals/cases/households/`
- `tests/e2e/households/`

Tasks:

1. Implement `hfj_get_context`, `hfj_create_household`, `hfj_select_household`, all family-invitation/member tools, and account lifecycle with explicit household IDs, roles, scopes, expected revisions, and idempotency keys.
2. Create household provisioning as one recoverable workflow: operational row, signed repository, owner projection, membership projection, and onboarding state. A partial failure is safe to retry.
3. Implement owner/editor/viewer authorization, final-owner protection, invitation create/revoke/accept races, role changes, member removal/departure, and projection-drift fail-closed behavior.
4. Implement pending family-invite preview before sign-in and explicit post-auth acceptance. Opening a URL never joins a household.
5. Implement account display name, sign-in methods, passkeys, active MCP grants/revocation, household leave, export, deletion, reauthentication, and former-member pseudonymization while preserving audit integrity.
6. Implement the approved SSR/hydrated React household, member, invite, and account screens with full empty/error/success/partial/cancelled states and role-correct controls. Hidden controls are not authorization.
7. Implement the shared management skill and evals so first-run setup resumes pending intent, asks for a household name only when appropriate, never asks for a token, and explains permission denials in plain language.
8. Add safe telemetry for auth, invitation, membership, conflict, and account actions using request IDs and no private labels.

Verification:

- `npm run test:unit --workspace @hfj/server -- households accounts invitations`
- `npm run test:contract -- households accounts`
- `npm run test:integration -- household-provisioning membership-projection`
- `npm run test:security -- household-isolation invitation-races final-owner account-deletion`
- `npm run test:e2e -- households account invite-pending-intent`
- `npm run test:evals -- households --hosts codex,claude`
- `npm run capture:screencast -- --output artifacts/screencasts/household-account-flows.mp4`
- `npm run verify`

Exit criteria:

- new and invited users finish the correct flow without configuration or token handling;
- two people retain separate identities and role-correct access in one household;
- final-owner, projection-drift, invitation replay, and deletion races fail safely;
- keyboard, screen-reader, 320-pixel, no-JavaScript, and role-state checks pass.

### Milestone 5 - Journal storage, migration, exports, skills, and semantic evals

Files:

- `apps/server/src/journal/`
- `apps/server/src/search/`
- `apps/server/src/mcp/tools/profiles.ts`
- `apps/server/src/mcp/tools/items.ts`
- `apps/server/src/mcp/tools/evidence.ts`
- `apps/server/src/mcp/tools/change-set.ts`
- `apps/server/src/mcp/tools/export.ts`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/references/semantic-food-rules.md`
- `packages/agent-client/evals/cases/journal/`
- `packages/agent-client/evals/expected/journal/`
- `tests/integration/journal/`
- `tests/contract/journal/`

Tasks:

1. Implement typed profile, evidence, snack, recipe, report/index, correction, search, and export domain rules and deterministic Git serialization.
2. Implement `hfj_get_profile`, `hfj_update_profile`, `hfj_search_items`, `hfj_get_item`, `hfj_append_evidence`, `hfj_commit_change_set`, and `hfj_export_household` with authorization, bounds, evidence integrity, expected revisions, one commit per request, and concise pagination.
3. Enforce evidence-before-conclusion, independent Saved/Cooked/Liked states, exact recurrence arithmetic, allowed report assertions, correction links, append-only evidence, URL scheme restrictions, private locators, and rejection of credentials/cookies/raw bodies.
4. Build search projections that return structured distinguishing fields without deciding identity and can be rebuilt entirely from Git.
5. Implement bounded idempotent local-journal migration with stable migration IDs, preflight counts/failures, credential/cookie exclusion, batch upload, server reconciliation, and post-migration count/record checks. Leave local source data unchanged.
6. Author shared grocery and recipe skills from the durable specs. Preserve shop/source selection, browser authorization, sign-in preflight, complete order/item expansion, exact evidence, source scopes, independent statuses, image provenance, semantic identity rules, and end-of-run source-change questions.
7. Add deterministic packaging tests and Codex/Claude evals for every required identity, status, evidence, privacy, conflict, and prompt-injection case. Programs may normalize exact fields but never make semantic decisions.
8. Add journal mutation, search, migration, export, conflict, redaction, and oversized-input telemetry/tests.

Verification:

- `npm run test:unit --workspace @hfj/server -- journal search reports imports`
- `npm run test:contract -- journal export`
- `npm run test:integration -- journal migration export search-rebuild`
- `npm run test:security -- evidence markdown urls export redaction oversized-input`
- `npm run test:packaging --workspace @hfj/agent-client`
- `npm run test:evals -- journal --hosts codex,claude`
- `npm run verify`

Exit criteria:

- every journal mutation is evidence-backed, signed, revision-safe, idempotent, and projection-consistent;
- exact deterministic assertions are validated while semantic authorship remains with the agent;
- migration and both export formats reconcile against Git;
- all required grocery/recipe identity and status evals pass in both hosts.

### Milestone 6 - Collections, public sharing, selective import, and install handoff

Files:

- `apps/server/src/collections/`
- `apps/server/src/imports/`
- `apps/server/src/mcp/tools/collections.ts`
- `apps/server/src/mcp/tools/imports.ts`
- `apps/server/src/http/collection-routes.ts`
- `apps/server/src/http/install-route.ts`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/routes/collection-preview.tsx`
- `apps/web/src/routes/collection-import-plan.tsx`
- `apps/web/src/routes/household-collections.tsx`
- `apps/web/src/components/collections/`
- `packages/agent-client/skills/share-food-collection/SKILL.md`
- `packages/agent-client/skills/import-food-collection/SKILL.md`
- `packages/agent-client/evals/cases/collections/`
- `tests/e2e/collections/`
- `tests/security/collections/`

Tasks:

1. Implement private collection creation from explicit item IDs and revisions, per-field sharing choices, public-safe allowlist projection, immutable snapshots, default-private preparation notes, and conflict on changed source items.
2. Implement share creation/revocation with 32 random bytes, unpadded base64url tokens, HMAC/pepper storage, constant-time comparison, 1/7/30/90-day expiry, immediate database revocation, audit reconciliation, strict rate limits, and no token logs/analytics/referrers.
3. Implement every collection/import MCP tool and one-commit import semantics from published snapshots only. Exact provenance repeats default to skip; deterministic possible candidates require explicit user/agent choice; no semantic merge is automatic.
4. Enforce import status effects: selected recipe import may establish Saved evidence but not Cooked/Liked; snack import creates no purchase, recurrence, pantry, or liked evidence; merges preserve newer destination facts.
5. Implement SSR/no-JavaScript collection preview and form submissions, React-enhanced item selection, scoped select-all, duplicate resolution, preserved selection across sign-in/errors, destination-household choice, partial/completed reporting, revocation/expiration states, external image safety, and `no-store`, `no-referrer`, and `noindex` headers.
6. Implement Web Share when available plus Copy link and user-controlled email/text drafts. Never read contacts or send without confirmation.
7. Implement `/install` with one visible current platform action at a time, troubleshooting behind a secondary path, and versioned metadata from the agent package rather than snapshots.
8. Implement share/import skills with explicit pre-publish preview, exact public fields, selected-item import, duplicate resolution, provenance, conflict behavior, and prompt-like imported text treated only as data.
9. Add privacy snapshot tests proving every forbidden field is absent and public token tests covering enumeration, leakage, replay, rate limiting, revocation, and open-page revocation.

Verification:

- `npm run test:unit --workspace @hfj/server -- collections imports public-projection`
- `npm run test:contract -- collections imports install-metadata`
- `npm run test:integration -- collection-lifecycle selective-import import-idempotency`
- `npm run test:security -- collection-privacy share-tokens xss prompt-injection referrers rate-limits`
- `npm run test:e2e -- collections --viewports 1440x900,390x844,320x568`
- `npm run test:evals -- collections --hosts codex,claude`
- `npm run capture:screencast -- --output artifacts/screencasts/collection-share-import.mp4`
- `npm run verify`

Exit criteria:

- a visitor previews without an account and imports only selected items after sign-in;
- no share grants membership or reveals unselected/private data;
- selection survives authentication, duplicate planning, rate limits, and recoverable conflicts;
- share, copy, email, text, Codex, and Claude handoffs work at mobile and desktop widths.

### Milestone 7 - DigitalOcean deployment, jobs, observability, backup, and recovery

Files:

- `Dockerfile`
- `Dockerfile.dockerignore`
- `deploy/compose.yaml`
- `deploy/systemd/household-food-journal.service`
- `deploy/systemd/household-food-journal-maintenance.timer`
- `deploy/systemd/household-food-journal-maintenance.service`
- `infra/opentofu/`
- `apps/server/src/health/`
- `apps/server/src/telemetry/`
- `apps/server/src/backup/`
- `apps/server/src/workers/`
- `apps/server/src/cli/maintenance.ts`
- `docs/runbooks/deploy.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/backup-restore.md`
- `docs/runbooks/droplet-failover.md`
- `docs/runbooks/secret-rotation.md`
- `docs/runbooks/signing-key-recovery.md`
- `tests/deployment/`
- `tests/restore/`

Tasks:

1. Build a reproducible non-root Node 24 container containing the server, React build, Git executable, signing/verification support, health checks, and maintenance CLI. Keep signing and encryption keys outside the image and repository volume.
2. Provision a staging and production DigitalOcean Droplet, firewall, reserved address/DNS inputs, and attached Block Storage with OpenTofu. Mount the expected filesystem at `/data/households`; startup fails closed on missing/wrong/read-only/unexpectedly empty mounts.
3. Run exactly one active writer through systemd/Compose with restart policy and deployment fencing. Do not enable horizontal scaling. Make migration a separate explicit release step using the direct Neon URL.
4. Implement `/health/live`, `/health/ready`, and authenticated operator health for Neon/schema, Git, mount identity/capacity, signing, incomplete mutations, reconciliation, backup age, fsck, signatures, and restore drills without tenant/private data.
5. Implement structured redacted logs, metrics, and traces using request IDs across HTTP/MCP, Neon rows, Git trailers, jobs, and operator events. Alert on auth abuse, mutation failures, lock waits, conflicts, reconciliation lag, projection mismatch, invalid repositories, backup age, fsck/signature failure, volume capacity, and failed restore drills.
6. Schedule expiry cleanup, reconciliation, projection checks, fsck, signature verification, backup, and signed manifests through idempotent maintenance commands.
7. Deliver production secrets through the selected mechanism with per-purpose access and audit. Exercise rotation, revocation, loss, and recovery for Apple, OAuth/cookie/HMAC, email, Git signing, backup encryption/object storage, Neon, and DigitalOcean credentials without placing secrets in images, logs, client artifacts, or the household Git volume.
8. Encrypt and upload Git bundles/manifests to the selected off-site object provider with object-lock/immutable retention. Configure Neon production recovery/PITR and export required operational metadata. Never use a production credential in tests.
9. Exercise isolated full restore, projection rebuild, signing verification, canary persistence across container restart, Block Storage reattachment, and the documented single-instance Droplet failover. Prove RPO at most 24 hours and RTO at most 8 hours.
10. Implement staged deployment, previous-image rollback, migration rollback/recovery, configuration validation, and repository-format compatibility rules. Test forward `FORMAT_VERSION` upgrade, rejection by an incompatible prior image, and restore/read compatibility without rewriting household history. Never roll back Git content by force-pushing or deleting `main`.

Verification:

- `npm run build`
- `npm run test:integration -- jobs health telemetry backup`
- `npm run test:restore`
- `npm run test:deploy-smoke -- staging`
- `npm run test:persistence-smoke -- staging`
- `npm run test:security -- deployment secrets logs backups`
- `npm run verify`

Exit criteria:

- staging survives container restart and documented Droplet/volume failover without losing the canary repository;
- an isolated restore reconstructs Git, operational metadata, projections, signatures, and manifests within RTO/RPO;
- readiness fails closed for unsafe mount, schema, Git, signing, or projection state;
- operators can diagnose and recover every documented partial mutation without reading private content.

### Milestone 8 - Hardening, compatibility, release, and launch

Files:

- `tests/security/`
- `tests/load/`
- `tests/e2e/`
- `packages/agent-client/evals/`
- `packages/agent-client/CHANGELOG.md`
- `CHANGELOG.md`
- `apps/web/src/routes/privacy.tsx`
- `apps/web/src/routes/terms.tsx`
- `docs/legal/privacy.md`
- `docs/legal/terms.md`
- `docs/release/manual-matrix.md`
- `docs/release/accessibility.md`
- `docs/release/privacy-review.md`
- `docs/release/launch-checklist.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/QUALITY_LEDGER.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Run the complete unit, branch, contract, Git, Neon, OAuth/MCP, browser, security, accessibility, eval, packaging, restore, and deployment suites with enforced coverage thresholds.
2. Complete adversarial tests for cross-tenant substitution, role/scope mismatch, final-owner races, invitation/share replay, CSRF/open redirect, refresh reuse, XSS/Markdown/prompt injection, Git/path/archive injection, oversized input, log redaction, capability leakage, idempotency races, crash points, and concurrent edits.
3. Run axe plus manual keyboard, VoiceOver, reduced-motion, zoom, contrast, focus, error-summary, no-JavaScript, 320-pixel, and long-content tests. Compare implemented Playwright screenshots to the approved ChatGPT designs and fix overlap, clipping, hierarchy, and state drift.
4. Run load/race tests for MCP requests, advisory-lock waits, previews, imports, token endpoints, and maintenance overlap while verifying no duplicate commit, tenant leak, or unbounded queue.
5. Execute the client release matrix on Codex CLI, Codex desktop where available, Claude Code, Claude Cowork/Desktop where available, Safari on macOS/iPhone, and one non-Apple browser. Record exact versions, results, screenshots, capability differences, install/upgrade/disable/uninstall, and canonical-data preservation.
6. Publish and review accessible privacy and terms pages. Verify that policy text, install/consent links, retention, export, deletion, capability-link behavior, support contact, and subprocessors match the shipped system and do not overstate guarantees.
7. Conduct privacy, security, accessibility, backup/restore, secret rotation/recovery, deployment/rollback, email deliverability, Apple configuration, and operational readiness reviews. Resolve every release-blocking finding.
8. Publish signed/versioned Codex and Claude manifests/catalogs plus immutable install metadata from the same release, deploy the coordinated staging release, run packaging checks, smoke/evals, deploy production, and run non-destructive production smoke with no real household data.
9. Update specs from Ready for implementation to the truthful released state only after all definition-of-done evidence passes. Refresh architecture, security, reliability, quality, implementation log, changelogs, knowledge artifacts, and complete this ExecPlan.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- --coverage`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:evals -- --hosts codex,claude`
- `npm run test:e2e`
- `npm run test:restore`
- `npm run test:deploy-smoke -- staging`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run knowledge:refresh`

Exit criteria:

- every server and client definition-of-done item has linked evidence;
- deterministic code meets 100% line and branch coverage or has a documented, guarded, approved external-unreachable exception;
- all high/critical security, privacy, accessibility, data-loss, and compatibility findings are closed;
- backup/restore and staging rollback have been exercised, and production health/backup status is green;
- installation, upgrade, disable, and uninstall leave canonical server data intact;
- Codex and Claude manifests, catalogs, frontmatter, install metadata, and schema compatibility pass packaging validation and a secret scan;
- public privacy and terms pages are reachable without JavaScript, linked from every collection/consent/account boundary, and match verified runtime behavior;
- production secret rotation and signing-key recovery complete without exposing credentials, losing canonical data, or accepting unverifiable writes.

## Interfaces and Dependencies

Milestone 0 records exact versions after primary-documentation checks. The intended dependency categories are:

- React 19.2, React DOM server/client rendering, and Vite for the single web build;
- Fastify and the official stable MCP TypeScript SDK;
- one runtime schema library capable of generating JSON Schema from shared semantic types;
- the standard PostgreSQL protocol plus an explicit reversible SQL migration runner for Neon;
- maintained Apple OIDC/JOSE and WebAuthn libraries rather than custom protocol or crypto;
- structured logging and OpenTelemetry-compatible metrics/traces with central redaction;
- a strict Markdown parser/sanitizer with a tiny allowlist and no raw HTML;
- Vitest, React Testing Library, Playwright, axe, and deterministic provider fakes;
- an S3-compatible client plus authenticated encryption for off-site bundles/manifests;
- OpenTofu with the DigitalOcean provider for repeatable infrastructure.

Required public contracts include:

- the common MCP success/error envelope and every tool listed in client spec section 8/server spec section 12;
- HTTP form/view schemas for install, sign-in, invite, collection preview/import, household, and account routes;
- branded IDs and revisions that cannot be mixed across household, actor, item, collection, snapshot, share, invite, import, request, and Git object boundaries;
- explicit OAuth scopes plus independent household roles;
- immutable evidence/audit/import/snapshot schemas and mutable profile/item/report schemas;
- a public collection projection type that has no private fields available to serialize;
- explicit completion states: completed, partially completed, blocked with one action, and cancelled with no mutation.

## Idempotence and Recovery

- Every mutating HTTP/MCP operation carries a scoped idempotency key and returns a stored response on replay.
- A household mutation never holds a Neon session-scoped lock. One transaction-scoped advisory lock covers durable request-state changes and the serialized Git operation.
- Before Git commit, a failure records `failed_before_commit` and is safe to retry after cleanup.
- After Git commit but before projection completion, the request enters `reconciliation_required`; the commit request trailer is the replay anchor.
- Projection or search data may be rebuilt from signed Git. Private identity mappings, OAuth/session state, token revocation, and idempotency responses require operational backup recovery.
- Invitation acceptance, member role changes, final-owner operations, share revocation, and imports have race tests and fail closed on stale state.
- Collection tokens never authorize source-repository access. Import retries use the immutable published snapshot and destination request record.
- Deployment rollback uses the prior compatible image and migration recovery plan. It never rewrites household `main` or downgrades an incompatible repository format.
- Restore drills run in isolated infrastructure with non-production credentials and verify manifest hash, object count, HEAD, signatures, schemas, projections, and authorization before declaring success.

## Acceptance / Verification

### Product acceptance

- A first-time Codex or Claude user installs with one host-specific action, completes browser auth without copying secrets, creates or joins the correct household, and performs a useful journal action.
- Two separately authenticated people collaborate in one household with owner/editor/viewer permissions, explicit invitations, final-owner protection, audit identity, and conflict-safe writes.
- Grocery and recipe workflows preserve exact evidence, source scope, semantic identity, independent status, image provenance, arithmetic, and end-of-run source-change requirements.
- A publisher reviews exact fields, creates an immutable collection snapshot, shares/revokes a capability URL, and never exposes forbidden private data.
- A recipient previews without an account, selects two of five, signs in, chooses a household, resolves every possible duplicate, imports exactly the selection with correct provenance/status effects, and receives Codex/Claude install handoff.
- Readable ZIP and Git bundle exports verify; account deletion, sign-in methods, passkeys, grants, leave/transfer, and pseudonymized audit preservation work.
- No browser or agent client receives repository/database/provider credentials or writes Git. No server program performs semantic classification, merge, status inference, or report authorship.

### Engineering acceptance

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- --coverage`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:security`
- `npm run test:evals -- --hosts codex,claude`
- `npm run test:e2e`
- `npm run test:restore`
- `npm run test:deploy-smoke -- staging`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run knowledge:refresh`

### Evidence required before launch

- approved ChatGPT IA, user-flow, screen-state, content, component, and visual-system artifacts under `docs/design/`;
- coverage reports, generated-schema drift proof, security report, accessibility report, load/race results, and redaction/private-field snapshots;
- Codex/Claude eval results and manual platform/version matrix;
- validated Codex/Claude manifests, marketplace catalogs, install metadata, package secret-scan output, and schema compatibility matrix;
- desktop/mobile/320-pixel screenshots and screencasts for setup/invite and collection share/import;
- signed Git mutation/replay/conflict evidence and isolated export/backup restore results;
- privacy/terms review approval plus secret-rotation and signing-key recovery drill records;
- DigitalOcean staging persistence/failover smoke and Neon migration up/down/up evidence;
- exact commands, timestamps, artifacts, remaining risks, and rollout/rollback result in `docs/IMPLEMENTATION_LOG.md`.

### Rollout and rollback

1. Develop only against local fakes, temporary Git repositories, and isolated Neon branches.
2. Deploy to staging with test Apple/email identities, test signing/encryption keys, a staging volume, and an off-site staging bucket.
3. Gate production provisioning on security, privacy, accessibility, backup/restore, and OAuth/MCP interoperability approval.
4. Deploy one fenced production writer, run non-destructive health/install/auth/MCP/public-preview canaries, and monitor mutation/reconciliation/backup signals.
5. On application regression, stop the writer, deploy the previous compatible image, follow migration recovery, and reconcile incomplete requests before reopening writes.
6. On mount, repository, signature, or projection uncertainty, fail readiness, fence writes, quarantine affected repositories, and execute the recovery runbook. Never return a success-shaped fallback.

## Outcomes & Retrospective

The coordinated version 1 foundation, durable reconciliation, authenticated portable exports, production rate limits/telemetry/operator health, encrypted immutable Backblaze backup/restore, real Apple, Resend, and native Safari passkey authentication, browser account lifecycle and household creation, deterministic adversarial security matrix, public immutable npm publication with downloaded-artifact Codex/Claude plugin lifecycles, real Codex/Claude OAuth revocation and reconnect, and a healthy DigitalOcean/Neon staging runtime are implemented and exercised across web, MCP/OAuth, Git, PostgreSQL, agent packaging, deployment, and native Safari. The enforced deterministic coverage gate and non-empty deployed recovery drill pass. The plan remains active because the product specifications' release definition is not yet met: public marketplace catalog discovery, full agent setup/invite/share/import workflows, production Neon retention/snapshot and combined recovery evidence, DigitalOcean failover, external staging/security review, provisioned load and manual accessibility validation, and manual privacy/operations approvals remain blocking. Evidence and exact results live in `docs/release/verification-evidence.md`. Move this plan to `docs/exec-plans/completed/` only after those gates pass.
