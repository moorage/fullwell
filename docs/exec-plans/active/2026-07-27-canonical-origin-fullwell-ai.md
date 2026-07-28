# Migrate the Canonical Application Origin to fullwell.ai

## Purpose / Big Picture

Fullwell currently presents `fullwell.ai` as its primary brand domain but redirects every request to `fullwell.souschefstudio.com`, which remains the sole application origin for browser sessions, passkeys, Sign in with Apple, OAuth, MCP, local runners, install metadata, and canonical page metadata. The goal is to make `https://fullwell.ai` the sole application origin that directly serves the product. `www.fullwell.ai` and the legacy `fullwell.souschefstudio.com` host must become permanent path-and-query-preserving redirects to the new origin.

This is an origin migration rather than a branding string replacement. Existing browser cookies cannot move between hosts. Existing WebAuthn credentials are scoped to the old relying-party ID and must be re-enrolled after sign-in on the new host. Existing MCP and local-runner grants use the old resource URL and must reconnect against the new endpoint. The rollout must make those consequences explicit, configure Apple's exact web domain and callback, preserve a tested rollback, and never expose or replace existing credentials unnecessarily.

## Progress

- [x] 2026-07-27T19:05Z: Created and claimed Beads feature `fullwell-jfo`; confirmed the worktree was clean before Beads exported the new issue.
- [x] 2026-07-27T19:05Z: Inspected repository architecture, auth/provider boundaries, Caddy and deployment configuration, package metadata, current docs, and the previous public-brand delivery.
- [x] 2026-07-27T19:05Z: Verified live DNS and TLS: the apex, `www`, and legacy host resolve to the same reserved IPv4 address; both `fullwell.ai` aliases currently return path-and-query-preserving HTTPS `301` redirects to the legacy canonical host.
- [x] 2026-07-27T19:05Z: Inspected the authorized Sous Chef Studio Apple developer account read-only through Computer Use. A dedicated Fullwell Services ID and Sign in with Apple key already exist, but the Services ID has zero website URLs registered.
- [x] 2026-07-27T19:10Z: Completed the feature-critic gate; added the pinned Meta webhook, in-flight callback, pre-cutover canary, client-release, and rollback requirements to the plan.
- [x] 2026-07-27T19:17Z: Milestone 1 complete. Added final-origin Caddy assertions, a tested exact-path WhatsApp transition gateway, configured-origin OAuth/resource metadata coverage, canonical public-identity coverage, and exact apex package validation.
- [x] 2026-07-27T19:17Z: Milestone 2 complete. Moved gateway, deployment example, public identity, package `1.1.18`, local-runner guidance, architecture, specs, runbooks, active verification commands, changelogs, and release tracking to the apex contract.
- [x] 2026-07-27T19:40Z: Milestone 3 complete. Focused tests, lint, typecheck, production build, coverage, security, WebKit E2E, accessibility, complete verification, docs verification, and active-ExecPlan verification pass. The standard screencast attempt failed before capture because Homebrew FFmpeg 8.0.1 lacks `x11grab`; it exited 234 and created no artifact.
- [x] 2026-07-27T20:03Z: Milestone 4 complete. Apple retains the apex and legacy domains/callbacks; Meta saved and reloaded the direct apex webhook with mTLS off and only `messages` subscribed at Graph API v25.0; the bounded signed-delivery smoke passes.
- [x] 2026-07-27T20:05Z: Milestone 5 complete. Release commit `48048ba` is pushed, public `@fullwell/fullwell@1.1.18` is checksum-matched, and the recoverable DigitalOcean rollout activated the exact reviewed Linux/amd64 image without a database migration.
- [x] 2026-07-28: Created and claimed Beads bug `fullwell-09f` after the merged ChatGPT desktop client's live reconnect exposed a blocked consent submission. Completed the feature-critic gate for the callback compatibility and remote MCP display-name change.
- [x] 2026-07-28: Implemented the bounded merged-desktop callback compatibility and `fullwell-cloud` identity, prepared package `1.1.19`, and passed focused server, package, eval, full repository, security, browser E2E, docs, and ExecPlan gates. Publication, deployment, and a live merged-desktop reconnect remain outside this local change.
- [x] 2026-07-28: Published checksum-matched `@fullwell/fullwell@1.1.19`, upgraded current Codex and Claude installations, deployed the exact pushed Linux/amd64 release to `fullwell.ai`, and completed the merged-desktop loopback redirect, Codex token exchange, authenticated `fullwell-cloud` read, readiness, deployment, and MCP discovery checks with the prior image and root-only environment backup retained.
- [x] 2026-07-28: Added the exact `http://localhost:<explicit-port>/callback` consent-only CSP compatibility required by Claude while retaining the narrower `127.0.0.1` path shapes for Codex and the local runner; focused server checks and full repository verification with 423 passing application tests and 11 expected database skips pass.
- [x] 2026-07-28: Reproduced Claude's post-authorization catalog rejection, identified `hfj_commit_delivery_index` as the sole generated schema without an explicit object root, and added a catalog-wide object-root compatibility contract without changing runtime validation.
- [x] 2026-07-28: Pushed `3348399`, deployed its checksum-matched exact-source Linux/amd64 image, passed production readiness and MCP smokes, and confirmed Claude reports `plugin:fullwell:fullwell-cloud` connected with the complete catalog and no journal mutation.
- [x] 2026-07-28: The follow-on atomic recovery release published checksum-matched package `1.1.20`, upgraded both current hosts without changing MCP identities, and retained connected `fullwell-local` and `fullwell-cloud` services at the apex.
- [x] 2026-07-28: Pushed `660dc60` and deployed its checksum-matched Linux/amd64 image to fix Safari Apple sign-in-method linking across the apex `form_post` callback. Public readiness, deployment/MCP smokes, PostgreSQL integration, rollback retention, and warning-log review pass; the same signed-in native browser can now retry the provider ceremony.
- [ ] Milestone 6: Automated production readiness, redirects, canonical metadata, OAuth metadata, MCP discovery, and messaging pass. A real Apple passkey authorization returns to a reload-persistent authenticated apex session; complete any required Fullwell passkey and installed-client reconnect evidence.

## Surprises & Discoveries

- 2026-07-27: The three public hostnames already resolve to the same DigitalOcean reserved address and Caddy already has valid public TLS for the apex and `www`; no DNS record change is required for the origin switch.
- 2026-07-27: Live OAuth metadata advertises the old issuer, authorization, token, revocation, registration, and MCP resource URLs. Changing only Caddy would leave every OAuth and MCP contract stale.
- 2026-07-27: Native Safari passkey enrollment has already been proven on the legacy host. WebAuthn does not permit silently moving that credential to the `fullwell.ai` relying-party ID, so migration acceptance must use Apple or email for the first new-host sign-in and then enroll a new passkey.
- 2026-07-27: The dedicated Fullwell Apple Services ID is enabled and associated with an existing primary App ID, and a dedicated Sign in with Apple key exists. The Services ID currently lists zero web domains/return URLs, so no working Apple callback needs to be removed or overwritten.
- 2026-07-27: The published `@fullwell/fullwell@1.1.17` package embeds the old MCP and install URLs. A server-only deployment would strand clean installs and reconnects on the legacy resource.
- 2026-07-27: Meta's verified WhatsApp webhook and `messages` subscription use the legacy host. General-purpose redirects are not a safe transport for signed provider POST requests, so the Meta callback must move through a bounded pre-cutover route before the old host becomes redirect-only.
- 2026-07-27: The installed `bd` version does not support the `bd prime --keywords` or `--work-type` flags suggested by the optional metaswarm guidance. The ordinary injected `bd prime` context remains authoritative.
- 2026-07-27: OAuth issuer and authorization-server metadata preserve the URL serializer's trailing `/`, while endpoint and MCP resource URLs do not. The configured-origin test records this exact standards-facing output.
- 2026-07-27: The existing 10,000-record delivery contract test exceeded Vitest's generic five-second limit only under whole-repository coverage instrumentation. A test-local 15-second timeout preserves the same boundary and lets the deterministic case complete; it runs in about 1.4 seconds alone and 5.7 seconds under coverage.
- 2026-07-27: After explicit action-time confirmation, Apple saved and then reloaded all four Fullwell website URLs: the apex and legacy domains plus their exact `/auth/apple/callback` return URLs. The existing Services ID, primary App ID association, and key remain unchanged.
- 2026-07-27: Meta accepted and reloaded the apex callback only after the exact webhook path was serving directly. The final provider state keeps mTLS off and only `messages` subscribed at Graph API v25.0; verification, invalid-token rejection, unsigned rejection, and signed empty delivery pass before and after the final origin switch.
- 2026-07-27: The authorized provider UI exposed the masked verification-token field value through its accessibility representation. No value entered Git or release evidence; Beads bug `fullwell-z0t` tracks a coordinated post-migration rotation.
- 2026-07-27: Apple's OCI export loaded as an index, so the reviewed Linux/amd64 manifest was normalized through a Docker-local tag before activation. Platform inspection and a Node runtime canary passed before Compose used the image.
- 2026-07-27: The repository screencast helper assumes the Linux `x11grab` input. Homebrew FFmpeg 8.0.1 on macOS rejected that input with exit 234 before capture and left no partial artifact, so browser automation, live redirect checks, and authenticated callback evidence remain the visible acceptance record.
- 2026-07-28: The merged ChatGPT desktop client registers native callbacks as `/callback/<nonce>`, while the consent CSP recognized only `/oauth/callback`. The OAuth request itself validated, but the missing exact loopback origin in `form-action` blocked the POST redirect before the client could receive its code.
- 2026-07-28: A clean release archive exposed that the production Dockerfile invoked the unordered workspace build before `@hfj/contracts` emitted its compiled boundary. Building contracts first preserves the existing workspace build while making exact-source OCI builds reproducible; `scripts/local/apple-container.test.mjs` now locks that order.
- 2026-07-28: Apple Container applies the repository's `tmp/` ignore rule to a build context located beneath `/tmp`, reducing the transferred context and omitting required TypeScript configuration. A detached exact-commit sibling worktree transfers the complete bounded context and builds successfully; existing Beads bug `fullwell-60h` tracks making the standard release path deterministic.
- 2026-07-28: Claude Code 2.1.215 dynamically registers `http://localhost:3118/callback`. OAuth validation already accepted that exact loopback URI, but the consent CSP intentionally recognized only the `127.0.0.1` client shapes, so Claude's POST returned to the unchanged consent page while its listener waited.
- 2026-07-28: Claude completed OAuth but rejected tool 29 because the refined discriminated union for `hfj_commit_delivery_index` generated a root `oneOf` without an explicit root `type`. Codex accepted the valid schema, while Claude requires every MCP input schema root to say `type: "object"`.

## Decision Log

- 2026-07-27: Make `https://fullwell.ai` the only application origin. `https://www.fullwell.ai` and `https://fullwell.souschefstudio.com` remain TLS-terminated redirect-only compatibility hosts.
- 2026-07-27: Treat old browser sessions, passkeys, OAuth grants, and runner tokens as non-transferable. Do not weaken cookie, WebAuthn, issuer, audience, resource, or redirect validation to simulate continuity.
- 2026-07-27: Use the existing Apple Services ID, primary App ID association, Sign in with Apple key, and encrypted production private key. Do not create a replacement key or download credential material.
- 2026-07-27: Register both the new `fullwell.ai` callback and the legacy callback in Apple during the transition so an application-origin rollback remains possible. The deployed application will advertise and use only the callback derived from its configured `PUBLIC_ORIGIN`.
- 2026-07-27: Remove the legacy host from public product identity instead of presenting two service domains. Public pages may describe the old host only as a temporary redirect when that is operationally useful.
- 2026-07-27: Update and validate the shared agent-client package in the same change. Publishing a new immutable npm version and changing current host installations are rollout actions, not hidden implementation steps.
- 2026-07-27: Use a two-phase gateway cutover for WhatsApp. First expose only the exact webhook path at the apex while all other apex traffic still redirects to the old canonical host, move and prove Meta's callback, then activate the final apex application origin. Do not temporarily serve the complete browser application from two origins.
- 2026-07-27: Keep Meta configuration pending until the exact apex webhook route is live. The available Chrome profile reaches Meta's login page rather than an authenticated app dashboard, so the user may need to complete Meta login before the action-time callback confirmation.
- 2026-07-27: Change no database schema or household Git content. Rollback restores the prior image, Caddy routing, `PUBLIC_DOMAIN`, and client package; Apple may retain both exact callbacks because that is additive and supports recovery.
- 2026-07-27: Keep the canonical-origin rollout and the WhatsApp verification-token rotation as separate recoverable changes. The origin switch retains the existing encrypted credential; `fullwell-z0t` will coordinate provider and server rotation after the new origin is stable.
- 2026-07-28: Accept both the existing exact `/oauth/callback` path and the merged desktop client's bounded `/callback/<nonce>` shape when deriving the consent-only CSP exception. Continue to require uncredentialed HTTP on exact IPv4 loopback, an explicit port, and no query or fragment.
- 2026-07-28: Rename only the hosted MCP's host-facing identity to `fullwell-cloud`. Preserve the `fullwell-local` MCP identity and all unrelated repository, package, deployment, service, and source-file names.
- 2026-07-28: Permit Claude's exact `http://localhost:<explicit-port>/callback` origin only on the consent page. Do not extend `localhost` to the local-runner or nonce-bearing paths, and continue rejecting missing ports, credentials, queries, fragments, and extra segments.
- 2026-07-28: Normalize each hosted tool's generated input schema with an explicit top-level object type. All shared tool inputs are object contracts, so this preserves Zod runtime validation and the generated union branches while satisfying strict Claude discovery.

## Context and Orientation

`PUBLIC_ORIGIN` is parsed once in `apps/server/src/config.ts` and constructed from `PUBLIC_DOMAIN` by `deploy/compose.yaml`. `apps/server/src/main.ts` derives the passkey relying-party ID and origin, Apple callback, OAuth issuer/resource, MCP metadata, absolute mail links, and browser render context from that single URL. Preserving this derivation is the core security property; request host headers must not become an authority source.

`deploy/Caddyfile` currently reverse proxies only `{$PUBLIC_DOMAIN}` and redirects `fullwell.ai` plus `www.fullwell.ai` to it. The migration changes the directly served host to `fullwell.ai`, redirects `www.fullwell.ai` and `fullwell.souschefstudio.com` to the apex, and keeps the old host out of the application proxy block. `deploy/caddy.test.mjs` is the deterministic topology contract.

`apps/web/src/brand.ts` currently distinguishes the preferred product domain from a legacy service URL, and `apps/web/src/routes/install.tsx` plus `apps/web/src/routes/company.tsx` render both. Once the apex directly serves the application, one public product/service URL should remain. `apps/web/src/server.tsx` and the Fastify web boundary already derive canonical and Open Graph URLs from the configured render context.

`packages/agent-client/codex-mcp.json`, the corresponding Claude MCP manifest, `packages/agent-client/install-metadata.json`, repository marketplace catalogs, package docs, and packaging tests form one immutable release surface. They must all advertise `https://fullwell.ai/mcp` and `https://fullwell.ai/install`. `packages/local-runner/README.md` must use the new origin. Existing installed runners store the old origin in local config and must disconnect/reconnect rather than silently rewriting a credential-bearing OAuth relationship.

`docs/ARCHITECTURE.md`, both files under `docs/product-specs/`, deployment and rollback runbooks, release evidence, the root changelog, the implementation log, and still-active ExecPlans describe the old canonical host. Historical completed ExecPlans remain immutable delivery history and should not be rewritten.

The Apple developer account is accessed through the user-authorized `matt@souschefstudio.com` Chrome profile via Computer Use. The dedicated Fullwell Services ID is already enabled and associated with a primary App ID. The Meta developer dashboard holds the verified WhatsApp callback and subscription. Adding Apple website URLs and changing Meta's webhook destination both change persistent external access, so Computer Use must pause for one explicit action-time confirmation immediately before the final provider saves.

### Framing Notes

#### Expert panel

- Security and identity engineer - protect origin, callback, issuer, audience, cookie, and WebAuthn boundaries during the cutover.
- Reliability and operations engineer - sequence Caddy, application configuration, Apple, package publication, deployment, and rollback without an unrecoverable split origin.
- Staff web/platform engineer - keep one configured-origin source of truth and update every generated or packaged consumer.
- UX and support specialist - make forced re-sign-in, passkey re-enrollment, and MCP/runner reconnects understandable rather than appearing as data loss.
- Privacy reviewer - prevent credentials, provider identifiers, email addresses, or private household data from entering Git, screenshots, logs, or verification artifacts.

#### What problem are we actually solving?

The brand URL and application URL disagree. The migration makes the memorable Fullwell domain the real security origin while retaining exact, explicit recovery for clients and credentials that cannot cross an origin boundary.

#### Roundtable highlights

- Security: do not accept old-origin tokens at the new resource or widen WebAuthn/cookie domains; require fresh authentication and grants.
- Reliability: configure additive external dependencies first, deploy one exact-origin image/config pair, and retain a one-command route/config rollback.
- Platform: treat Caddy, `PUBLIC_ORIGIN`, metadata, package manifests, local-runner docs, and smoke commands as one contract.
- UX: preserve account and household data while clearly separating lost local authentication state from durable server data.
- Privacy: inspect provider settings without recording secrets and keep live verification credential-free.

#### Key tensions

- Seamless continuity conflicts with WebAuthn and OAuth origin binding; correctness requires visible reauthentication and reconnects.
- Apple configuration should precede traffic cutover, while server verification requires the new origin to serve the callback. Additive callback registration resolves the sequencing tension.
- Meta webhook verification must reach the new URL before the general origin cutover, while the new browser origin must not become live with old canonical metadata. A temporary exact-path gateway route resolves this without creating two browser origins.
- Publishing the new client before the server cutover gives new installs an unavailable endpoint; publishing after cutover leaves old clients pinned to the legacy resource. The release window must keep the redirect and install page available while the package and server move together.
- A redirect preserves public navigation but cannot preserve exact OAuth resource identity or existing grants.

#### Synthesis for decomposition

- Freeze redirect, metadata, manifest, and recovery expectations in tests before implementation.
- Keep `PUBLIC_ORIGIN` as the only application-origin authority and make Caddy route exactly one host to the app.
- Update all client and documentation consumers in one coherent release.
- Prove local behavior before changing Apple or production state.
- Require action-time confirmation for Apple's final persistent-access Save and separate authority for commit, package publication, and production deployment under the repository's conservative profile.

#### Feature-critic gate

- Must fix before implementation: include the Meta webhook callback and signed POST behavior; define a two-phase exact-path gateway transition; prove old-origin sessions, passkeys, OAuth grants, and runner tokens fail safely; retain Apple and Meta rollback paths; and test initial HTML plus OAuth metadata instead of relying on redirects alone.
- Must fix before the desktop reconnect follow-up: bound the new callback nonce syntax and length; prove credentialed, remote, query-bearing, fragment-bearing, missing-nonce, and unrelated loopback paths do not widen CSP; and update both host manifests plus MCP initialize metadata to the same `fullwell-cloud` identity.
- Should fix during implementation: account for an Apple authorization or magic-link transaction already in flight, preserve token-bearing invitation/share/email paths through the legacy redirect, verify the social image and all absolute mail links, and make reconnect guidance visible in package/runner documentation.
- Should fix during the desktop reconnect follow-up: retain the old MCP name only in historical delivery records and add a changelog entry that makes the installed-name transition discoverable.
- Monitor during rollout: provider dashboard propagation, OAuth error rate, old-host traffic, failed webhook deliveries, zero online runners, and support demand from passkey re-enrollment or client reconnects.
- Monitor during the desktop reconnect follow-up: whether installed hosts retain duplicate old/new remote registrations after package update; remove or reconnect the obsolete registration explicitly rather than translating credentials.

## Milestones

### Milestone 1 - Freeze origin-transition contracts and tests

Files:

- `deploy/Caddyfile`
- `deploy/Caddyfile.whatsapp-cutover`
- `deploy/caddy.test.mjs`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/app.test.ts`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `tests/e2e/web.spec.ts`

Tasks:

1. Change the Caddy test contract so only `fullwell.ai` reverse proxies the application and both `www.fullwell.ai` and `fullwell.souschefstudio.com` permanently preserve path/query while redirecting to it.
2. Add or update server assertions proving configured-origin derivation for canonical metadata, Apple callback, OAuth issuer/endpoints, protected-resource metadata, MCP resource, and absolute sign-in links.
3. Update package assertions so both host manifests, install metadata, website URLs, and package validation require the apex endpoints.
4. Preserve the generic localhost E2E canonical test while adding production-oriented assertions only where the test harness has an explicit configured origin.
5. Record the intended migration behavior: old sessions sign in again, old passkeys re-enroll, and old MCP/runners reconnect; no test may make an old-origin credential valid at the new resource.
6. Add gateway assertions for the temporary exact-path WhatsApp pre-cutover route and final redirect-only legacy host. Signed provider POST traffic must never depend on following a redirect.

Verification:

- `node --test deploy/caddy.test.mjs`
- `npm test --workspace @hfj/server -- --run src/http/app.test.ts`
- `npm test --workspace @hfj/web -- --run src/test/app.test.tsx`
- `npm run test:packaging --workspace @fullwell/fullwell`

### Milestone 2 - Move application, public brand, clients, and docs to fullwell.ai

Files:

- `deploy/Caddyfile`
- `deploy/caddy.test.mjs`
- `deploy/deploy.env.example`
- `apps/web/src/brand.ts`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/routes/company.tsx`
- `apps/web/src/test/app.test.tsx`
- `packages/agent-client/package.json`
- `packages/agent-client/CHANGELOG.md`
- `packages/agent-client/README.md`
- `packages/agent-client/codex-mcp.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/tests/packaging/package.test.mjs`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `package-lock.json`
- `packages/local-runner/README.md`
- `docs/ARCHITECTURE.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/runbooks/deploy.md`
- `docs/runbooks/rollback.md`
- `docs/release/verification-evidence.md`
- `docs/exec-plans/active/2026-07-15-household-food-journal-v1.md`
- `docs/exec-plans/active/2026-07-20-whatsapp-local-restocking.md`
- `docs/exec-plans/active/2026-07-21-approval-efficient-onboarding.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Make the Caddy application block explicit for `fullwell.ai`; redirect `www` and the legacy host to the apex without proxying either alias.
2. Make the deployment example and runbook use `PUBLIC_DOMAIN=fullwell.ai`.
3. Collapse public brand identity to one product/service URL and update Company and install copy so the legacy host is no longer presented as a second official application origin.
4. Update every shipped Codex/Claude endpoint, install URL, catalog version, package assertion, and README to the apex. Increment the immutable client release once and update the lockfile mechanically through npm.
5. Update local-runner setup guidance and document that an installed old-origin runner must disconnect and reconnect.
6. Update architecture, normative specs, runbooks, active-plan verification commands, release evidence, changelogs, and implementation history. Do not rewrite completed ExecPlans.
7. Search hidden and non-hidden production-facing files for stale legacy URLs. Allow the old host only in redirect/rollback/migration history.
8. Document the temporary exact webhook-path gateway configuration used only to validate Meta before the final Caddyfile is activated. It must expose no browser, OAuth, MCP, account, invitation, collection, or household route at the apex.

Verification:

- `node --test deploy/caddy.test.mjs`
- `npm run build --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm test --workspace @hfj/web -- --run src/test/app.test.tsx`
- `npm test --workspace @hfj/server -- --run src/http/app.test.ts`
- `rg -n --hidden 'fullwell\.souschefstudio\.com' deploy apps packages docs/ARCHITECTURE.md docs/product-specs docs/runbooks docs/exec-plans/active CHANGELOG.md`

### Milestone 3 - Complete local verification and migration evidence

Files:

- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `packages/agent-client/codex-mcp.json`
- `packages/agent-client/.mcp.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `packages/agent-client/package.json`
- `packages/agent-client/install-metadata.json`
- `packages/agent-client/README.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/CHANGELOG.md`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/release/manual-matrix.md`
- `docs/release/verification-evidence.md`
- `docs/QUALITY_LEDGER.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/exec-plans/active/2026-07-27-canonical-origin-fullwell-ai.md`

Tasks:

1. Run focused Caddy, web, server, agent-package, and runner verification before broad gates.
2. Run WebKit E2E and accessibility checks for public metadata, sign-in, consent, account, install, About, and Company routes on the configured local origin.
3. Run lint, typecheck, build, coverage, security, and complete repository verification.
4. Run docs and active-ExecPlan verification after every normative reference uses the new origin.
5. Attempt the repository screencast for the visible apex, sign-in, OAuth metadata, and legacy redirect flow. If the known FFmpeg limitation remains, record the exact failure and retain desktop/mobile screenshots plus automated evidence.
6. Record expected credential transitions without private account data: new-host Apple/email sign-in, passkey enrollment, MCP reconnect, and local-runner reconnect.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:coverage`
- `npm run test:security`
- `npm run test:e2e`
- `npm run test:accessibility`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run capture:screencast -- --output artifacts/screencasts/fullwell-ai-origin-migration.mp4`

### Milestone 4 - Configure Apple and Meta callbacks

Files:

- `docs/release/manual-matrix.md`
- `docs/release/verification-evidence.md`
- `docs/exec-plans/active/2026-07-27-canonical-origin-fullwell-ai.md`

Tasks:

1. In the existing Sous Chef Studio Fullwell Services ID, use Computer Use to add the apex domain and exact `https://fullwell.ai/auth/apple/callback` return URL.
2. Also retain or add the exact legacy domain and callback as rollback-only Apple configuration during the migration window.
3. Do not create a new key, reveal or download the private key, copy the team/key identifiers into Git, or change the primary App ID association.
4. Activate a reviewed temporary gateway configuration that reverse proxies only `GET` and signed `POST` requests for `/api/messaging/whatsapp/webhook` at `fullwell.ai`; every other apex request continues to redirect to the old canonical host.
5. In the existing Meta app, change the WhatsApp callback to `https://fullwell.ai/api/messaging/whatsapp/webhook`, complete verification, retain only the `messages` subscription, and prove one signed empty/test delivery reaches the same configured WABA boundary.
6. Pause immediately before the Apple and Meta final saves because these actions add or move persistent external callback authority. Batch both exact destinations into one action-time confirmation.
7. After Save, re-open both provider configurations read-only and record only that the expected domains, callbacks, and `messages` subscription are present.
8. Confirm the deployed non-secret `APPLE_CLIENT_ID` still matches the existing Fullwell Services ID; validate the encrypted key indirectly through a real authorization-code exchange rather than reading it.

Verification:

- Apple Services ID shows the apex and legacy transition entries without exposing credentials.
- Meta shows the exact apex webhook with only the required subscription, and a signed webhook request reaches the service without a redirect.
- A new-host Apple authorization request advertises the existing client ID and exact apex callback.
- One user-controlled real Apple sign-in returns to `https://fullwell.ai/` with a secure session and no credential copied into chat, terminal output, Git, screenshots, or logs.

### Milestone 5 - Prepare and execute the recoverable production rollout

Files:

- `Dockerfile`
- `deploy/Caddyfile`
- `deploy/compose.yaml`
- `docs/runbooks/deploy.md`
- `docs/runbooks/rollback.md`
- `docs/release/verification-evidence.md`
- `docs/exec-plans/active/2026-07-27-canonical-origin-fullwell-ai.md`

Tasks:

1. Review the final diff and record the exact source commit only after explicit commit authority under the conservative Beads profile.
2. Build and verify a Linux/amd64 OCI image from that exact source. Retain the prior digest and a backup of the current remote deploy environment and Caddyfile.
3. Validate the new Caddyfile with the pinned running Caddy image before activation.
4. Drain or allow the ten-minute Apple and fifteen-minute magic-link challenge windows before the final switch when practical. Token-bearing GET links remain recoverable through the path-and-query-preserving legacy redirect; do not claim an in-flight Apple `form_post` can survive an origin cutover.
5. In one bounded release window after the Meta apex callback is proven, set remote `PUBLIC_DOMAIN=fullwell.ai`, deploy the new image/final Caddyfile, and restart the existing systemd/Compose service. No migration runs because schema and household Git formats are unchanged.
6. Publish the matching immutable agent-client package and update installed Codex/Claude clients only with explicit publication authority. Keep the legacy host redirect live throughout reconnect.
7. If readiness, Apple, Meta, OAuth metadata, MCP discovery, or persistence fails, restore the previous image, `PUBLIC_DOMAIN`, and Caddyfile and restart. Apple may retain both callbacks. Restore Meta's legacy callback only after the legacy webhook path is serving directly again.

Verification:

- `npm run container:build`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:messaging-smoke`
- `curl -fsSI https://fullwell.ai/`
- `curl -fsSI 'https://www.fullwell.ai/about?origin=migration'`
- `curl -fsSI 'https://fullwell.souschefstudio.com/about?origin=migration'`

### Milestone 6 - Verify live auth/discovery and reconnect affected clients

Files:

- `docs/release/manual-matrix.md`
- `docs/release/verification-evidence.md`
- `docs/QUALITY_LEDGER.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `docs/exec-plans/active/2026-07-27-canonical-origin-fullwell-ai.md`

Tasks:

1. Prove `fullwell.ai` returns application HTML directly, while `www` and the legacy host permanently preserve a non-root path and query to the apex.
2. Prove initial HTML canonical, Open Graph, JSON-LD application URL, install links, and public navigation all use the apex.
3. Prove authorization-server and protected-resource metadata advertise only the apex; exercise dynamic registration, authorization, token exchange, initialize, initialized notification, and tool discovery through the exact new resource.
4. Add the exact merged-desktop `/callback/<nonce>` loopback callback shape to the consent-only CSP derivation without accepting arbitrary localhost paths or widening any other response.
5. Rename the hosted MCP configuration and initialize metadata to `fullwell-cloud` across Codex, Claude, package validation, lifecycle tests, evals, normative docs, and changelogs. Do not rename the local MCP or unrelated infrastructure/package identities.
6. Complete a real Apple sign-in on the new host, enroll and use a new passkey, and verify the old passkey is not represented as transferable.
7. Upgrade a clean Codex and Claude install to the new immutable client package and complete OAuth reconnect with no pasted token.
8. Disconnect/reconnect the local runner to the apex, verify its Keychain-backed grant and fixed-purpose preflight, and keep live cart mutation and paid-message boundaries unchanged.
9. Observe readiness/operator health, logs, backups, signing, mounted volume, single-writer leadership, OAuth failures, and messaging gates through the decision window.
10. Complete doc-drift review, refresh knowledge artifacts, close Beads only after acceptance, and move this plan to `docs/exec-plans/completed/`.

Verification:

- `PUBLIC_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- production`
- `PUBLIC_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- production`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run knowledge:refresh`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification

- `https://fullwell.ai/` directly returns Fullwell application HTML over valid TLS without a cross-host redirect.
- `https://www.fullwell.ai/<path>?<query>` and `https://fullwell.souschefstudio.com/<path>?<query>` permanently redirect to the exact apex path and query and never reverse proxy application traffic.
- `PUBLIC_ORIGIN`, canonical metadata, Apple callback, passkey RP ID/origin, magic-link URLs, OAuth issuer/endpoints, MCP resource, install metadata, Codex/Claude manifests, and runner guidance all use `https://fullwell.ai`.
- The existing Fullwell Apple Services ID and key are reused. Apple accepts the exact apex callback, and the transition retains the legacy callback for rollback without exposing credential material.
- Meta's WhatsApp callback uses the apex directly, keeps only the required subscription, and receives signed webhook traffic without a cross-host redirect.
- The consent page permits only the exact registered loopback origin for `/oauth/callback` or a bounded `/callback/<nonce>` path; invalid, remote, credentialed, query-bearing, fragment-bearing, missing-nonce, and unrelated loopback callback values do not widen `form-action`.
- Codex and Claude expose the hosted MCP as `fullwell-cloud`, the remote server initializes with that name, and `fullwell-local` remains unchanged.
- Every advertised hosted tool input schema has an explicit top-level object type, and Claude loads the complete tool catalog after OAuth without a schema-validation error.
- One real Apple sign-in, one email fallback sign-in, one new passkey enrollment/sign-in, one Codex OAuth reconnect, one Claude OAuth reconnect, and one local-runner reconnect pass on the apex.
- Existing old-host sessions, passkeys, OAuth grants, and runner tokens are not silently accepted at the new origin. Durable accounts, memberships, household Git repositories, and Neon operational data remain intact.
- Caddy, focused tests, packaging, E2E, accessibility, lint, typecheck, build, coverage, security, complete verification, docs, and ExecPlan gates pass.
- The exact previous application image, deploy environment, Caddyfile, package version, and commands needed to restore `fullwell.souschefstudio.com` as canonical are recorded before activation.
- No database migration, household Git mutation, credential generation, credential disclosure, or widened browser/provider permission occurs.

Local verification commands:

```sh
node --test deploy/caddy.test.mjs
npm test --workspace @hfj/server -- --run src/http/app.test.ts
npm test --workspace @hfj/web -- --run src/test/app.test.tsx
npm run test:packaging --workspace @fullwell/fullwell
npm run test:coverage
npm run test:security
npm run test:e2e
npm run test:accessibility
npm run verify
npm run verify:docs
npm run verify:execplan
```

## Idempotence and Recovery

The code and documentation edits are ordinary deterministic file changes. Re-running local verification creates no server or provider state.

Apple website URL registration is additive. Reopening and saving the same exact domain/callback pairs must not create duplicates. If Apple configuration fails before Save, cancel the modal and leave the Services ID unchanged. If it fails after Save, inspect the saved list and correct only the mismatched entry; do not rotate the working key.

Meta callback recovery preserves a direct webhook path at one host at all times. Before moving Meta, expose and validate only the apex webhook path while the browser application remains canonical on the legacy host. On rollback, restore the legacy webhook path before changing Meta back. Do not rely on provider redirect behavior, replay a real message, or widen the temporary apex route.

The production switch is recovered as one origin/configuration unit. Before activation, preserve the old immutable image reference, `/etc/hfj/deploy.env`, and deployed Caddyfile. Rollback restores those three artifacts and restarts the existing unit, proves the legacy webhook direct path, and then restores Meta's legacy callback. Because no schema or Git format changes, rollback does not touch Neon or household repositories. Apple keeps both callbacks during the recovery window.

Client recovery is explicit reconnect, not token translation. Codex, Claude, and the local runner register or authorize against the new resource and receive new grants. Old grants can be revoked after the observation window. Passkeys are re-enrolled at the apex after Apple or email authentication. Browser sessions simply sign in again.

The hosted MCP rename changes a host configuration key, not the OAuth resource URL or token contract. If a host retains both names after package update, remove the obsolete `household-food-journal` registration and authorize `fullwell-cloud`; do not copy or translate tokens. Rollback may restore the previous package/configuration key while the server continues to use the same MCP URL and protocol.

## Artifacts and Notes

- Beads feature: `fullwell-jfo`
- Desktop OAuth/MCP follow-up: `fullwell-09f`
- Existing Fullwell Apple Services ID: `com.souschefstudio.fullwell.web`
- Planned screencast: `artifacts/screencasts/fullwell-ai-origin-migration.mp4`
- Historical prior art: `docs/exec-plans/completed/2026-07-27-public-brand-company-identity.md`
- No secret, Apple key, provider token, user email, household title, food name, or full browser body belongs in this plan or its verification artifacts.

## Outcomes & Retrospective

Release commit `48048ba3ce3d82175a6abed1bd54a87867dda24e` is pushed to `origin/main`. Public immutable `@fullwell/fullwell@1.1.18` has registry SHA-1 `9a571b41655d20ccbf24e544a69016dfb8b1cf18`, matches the prepared artifact, and passes clean Codex and Claude host lifecycles.

DigitalOcean runs healthy Linux/amd64 image `hfj-staging:canonical-origin-20260727-1-runtime`. The transferred OCI archive has SHA-256 `8c8d6d4231d289de4ad5ed4051a30c591b1d82dfccb7f66e607d9588e4cf32d6`, index digest `sha256:8f60ab4ef2ca8fe3bd20bbbf2798f2604c6ed4d46cc565942d6a887affa3c8e1`, and concrete amd64 manifest `sha256:1441e7c2ede5cd4ecaa7ffe129ff31eb06faf02498d03eb141e7372a33256a47`. The deployed environment has `PUBLIC_DOMAIN=fullwell.ai`; the reviewed Caddyfile has SHA-256 `8a8dc22e1dc727fd42f1146312aa44a426161a6a93dc3b1ac9b9e513e95bd1eb`. The preserved legacy environment, Caddyfile, and prior immutable image remain the rollback unit.

The apex directly returns application HTML and health checks. `www` and the legacy host return path-and-query-preserving `301` redirects to the apex. Canonical and Open Graph metadata, OAuth authorization-server and protected-resource metadata, MCP discovery, deployment smoke, and the bounded signed WhatsApp smoke all use the apex and pass. A real Apple passkey authorization used the exact apex callback, returned to the authenticated apex households page, and remained authenticated after reload. Apple retains both transition callbacks; Meta persists the exact apex webhook with only `messages` at v25.0.

No schema migration, household Git mutation, key creation, or credential download occurred. The remaining user-controlled transition evidence is any needed Fullwell passkey, email, Codex, Claude, and local-runner reconnect. Beads bug `fullwell-z0t` tracks post-migration WhatsApp verification-token rotation without recording its value.

The desktop OAuth/MCP follow-up is live through commits `350b520ee7bd8820d0079841363ea35382bc1fba` and `fee55967711b6a58b8183343e74d6df297d8ff83`. Public `@fullwell/fullwell@1.1.19` matched its prepared artifact and established the hosted `fullwell-cloud` identity. Follow-on release `1.1.20` now runs on both current hosts, preserves `fullwell-local` and `fullwell-cloud`, and matches its prepared and cleanly downloaded registry artifact at SHA-1 `f0491629ffd078a734093b3f7b8556272d4bea76`.

DigitalOcean runs healthy Linux/amd64 image `hfj-staging:oauth-cloud-fee5596-runtime` from OCI index `sha256:7bd9954da2d0c1a36559891521d1a96b95f432aea0c93bfddc89670c8a07bd7a` and amd64 manifest `sha256:d1a3c2ffcbb09d83a4205bf04d7bf7fe3c821221992b08fbb6e1110a0081fe7e`. The transferred 81,012,224-byte archive matched SHA-256 `6270baf204dad3f5b7dbd10d6359bf03aef5c26fd743a35d44a83fc7ab5a81cf` and was removed after activation; the prior Safari image and `/etc/hfj/deploy.env.pre-oauth-cloud-20260728-1` remain rollback.

Production readiness at schema `0008`, Git/signing/volume/single-writer checks, deployment smoke, MCP discovery, and warning-log review pass. A live Codex authorization used the merged desktop client's exact `http://127.0.0.1:<port>/callback/<nonce>` shape, reached the callback with zero CSP errors, completed token exchange, and performed one authenticated read-only `hfj_get_context` call through `fullwell-cloud` without exposing journal content.

Claude Code 2.1.215 separately completed authorization through its exact `http://localhost:<port>/callback` shape. Its first authenticated discovery exposed a stricter catalog validator: the refined `hfj_commit_delivery_index` union generated a valid root `oneOf` but no explicit root `type`. Commit `3348399e3ca4d42fb258156002ae9fcfcde49a31` normalizes every hosted input schema to the shared object-input contract without changing runtime validation.

DigitalOcean now runs healthy Linux/amd64 image `hfj-staging:claude-tools-3348399-runtime` at OCI index `sha256:cf19dc2097eb6d9280b81c585775678d60b2fecf55af03ca27d26aa1e91f5325` and concrete manifest `sha256:768d2e47b0abdd645c6785f4e27793a9b9cc28d6c3baf42428ecdf364e8fab8e`. The 81,012,224-byte archive matched locally and remotely at SHA-256 `49e8982d4fa7fc2bfd77c42d5b3f815835cab573c6760af411c6c0b1e84ab47b`. Production readiness, deployment and MCP discovery smokes, warning-log review, `claude mcp list`, and `claude mcp get plugin:fullwell:fullwell-cloud` pass; Claude reports the hosted MCP connected and loads the complete catalog without invoking a household journal tool. The prior `hfj-staging:claude-oauth-2e12ca4-runtime` image and root-only `/etc/hfj/deploy.env.pre-claude-tools-20260728-1` retain rollback.
