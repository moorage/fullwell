# Provision an Isolated OpenAI Reviewer Demo Account

## Purpose / Big Picture

OpenAI's plugin review requires credentials that work immediately without account creation, email access, setup, or two-factor authentication. Fullwell intentionally supports only Apple, passkeys, and email magic links for ordinary users, so none of those paths can provide a durable reviewer credential without weakening or misrepresenting the normal sign-in contract.

Add one disabled-by-default reviewer-access adapter that authenticates a single configured reviewer identity, issues the same bounded browser session used by normal sign-in, and preserves pending OAuth intent. Add an idempotent operator seed workflow that creates that isolated user and household and writes a small privacy-scrubbed sample derived from the maintainer's read-only local journal snapshot. The cloud sample must use new identifiers and generic provenance and must exclude household/profile data, notes, URLs, original evidence, reports, delivery/order history, and every original identifier.

Success is visible when the supplied reviewer credentials can sign in at `https://fullwell.ai`, complete OAuth consent, and exercise the hosted MCP against only the isolated demo household. Ordinary sign-in remains unchanged when reviewer access is disabled.

## Progress

- [x] 2026-08-01T07:35Z: Created and claimed Beads task `fullwell-zzc.1`; inspected the auth, OAuth, journal, persistence, local snapshot, and submission constraints.
- [x] 2026-08-01T07:42Z: Confirmed the read-only local snapshot contains four non-delivery item categories and no recipe category; no local item content was printed or added to the repository.
- [x] 2026-08-01T07:55Z: Completed the expert-roundtable framing and selected a gated reviewer identity plus allowlist-only, idempotent seeding.
- [x] 2026-08-01T08:14Z: Milestone 1 complete. Implemented and focused-tested the disabled-by-default reviewer identity, reversible migration, encrypted configuration, same-origin credential route, strict rate limit, pending-intent preservation, and normal session issuance.
- [ ] 2026-08-01T08:27Z: Milestone 2 resumed after the user explicitly authorized commit, push, deployment, account provisioning, and continued plugin submission.
- [x] 2026-08-01T08:18Z: Milestone 3 complete. Updated architecture, security, reliability, client/server product specifications, deployment credential wiring, changelog, and implementation history.
- [x] 2026-08-01T08:23Z: Milestone 4 complete. Focused checks and `npm run verify` pass with 430 application tests and 12 expected database-gated skips; the sensitive, docs, and ExecPlan gates pass. A separate disposable Apple Container proves migration up/down/up for all nine migrations without touching the orphaned local volume.
- [ ] 2026-08-01T08:27Z: Milestone 5 resumed with explicit commit/push/deployment authority. The later OAuth grant still requires action-time Computer Use confirmation before the sanitized journal mutation can be exercised through the hosted MCP.
- [x] 2026-08-01T08:48Z: Added the submission-required OpenAI ownership challenge as a fixed uncached route backed by the encrypted credential boundary; the verification value remains outside source control and logs.

## Surprises & Discoveries

- 2026-08-01: The local Codex household file is absent, but the local runner holds a current read-only household snapshot under its private application-support directory.
- 2026-08-01: The current snapshot has `snacks`, `ingredients`, `condiments`, and `groceries`; it has no recipes. The demo must represent every available non-delivery category rather than inventing a recipe from private data.
- 2026-08-01: The OpenAI testing form explicitly rejects reviewer flows that require email access, account creation, setup, or two-factor authentication. A normal magic-link account cannot satisfy that contract.
- 2026-08-01: Delivery data cannot be safely treated as another grocery category because its contracts retain private provider, merchant, menu, and order locators. It is excluded completely.
- 2026-08-01: Focused service, route, renderer, configuration, deployment-credential, type, and lint checks pass. The Apple Container migration rehearsal stopped safely because an existing local PostgreSQL volume no longer has its matching ignored credential file; the harness refused to regenerate mismatched credentials or reuse the volume.

## Decision Log

- 2026-08-01: Treat the reviewer credential as an operator-configured access adapter for exactly one isolated identity, not as a general Fullwell password feature. The adapter is absent unless all required configuration is present.
- 2026-08-01: Store the production reviewer username and password only in the encrypted deployment credential store. Do not put either value, a hash derived from either value, or the review account's private identifiers in Git, Beads, logs, screenshots, or test fixtures.
- 2026-08-01: Resolve the reviewer as a distinct external identity provider and issue the ordinary Fullwell browser session after credential verification. Preserve OAuth pending intent so the MCP authorization flow continues after sign-in.
- 2026-08-01: Rate-limit failed reviewer attempts with the existing typed abuse-control boundary, compare credential digests in constant time, return one generic failure response, and emit only credential-free failure signals.
- 2026-08-01: Seed only a fixed small number of items from each category present in the source snapshot. Selection may be randomized once, but the generated seed key and resulting cloud mutation are idempotent.
- 2026-08-01: Sanitize through a closed allowlist. Retain only the minimal food-facing label and category; replace all IDs, evidence, timestamps, body text, and provenance and set every optional brand, flavor, quantity, URL, recipe, status, and narrative field to a safe empty value. The program must not make semantic privacy classifications.
- 2026-08-01: Reject retained labels containing URL, email, control-character, or line-break shapes and enforce a short length bound. Treat the label itself as user-authorized private input: never log or render it outside the isolated reviewer household.
- 2026-08-01: Produce a permission-checked private manifest outside the repository for the handoff between preview and apply. Dry-run output contains category counts, validation results, and a keyed fingerprint only. Never print sampled names or source identifiers.
- 2026-08-01: Use the central service and repository mutation path for provisioning. Do not write directly to a production database or household repository.
- 2026-08-01: Do not commit, push, deploy, grant OAuth consent, or save external submission credentials without the authority required by the repository and Computer Use action-time confirmation rules.

## Context and Orientation

Browser authentication lives under `apps/server/src/auth/`. `BrowserAuthService` owns external-identity resolution, pending-intent validation, browser-session issuance, and sign-in abuse controls. `AuthStore` has memory and Neon implementations. `migrations/0001_operational_core.sql` currently constrains external identity providers to Apple, magic link, and passkey, so the reviewer identity needs an additive reversible migration rather than an untyped database insert.

The server registers browser routes in `apps/server/src/http/app.ts` and composes production dependencies in `apps/server/src/main.ts`. The sign-in page is rendered from `apps/web/src/routes/sign-in.tsx`; reviewer fields should appear only when the server explicitly advertises that the adapter is enabled. Submitted credentials must never enter a URL, rendered context, telemetry attributes, or logs.

The journal write path is `HouseholdFoodJournalService` in `apps/server/src/services/household-food-journal.ts`. `hfj_create_household` and `hfj_commit_onboarding` already provide idempotent, validated, central-writer mutations for the four available non-delivery categories. The seed workflow should call those typed operations as a reviewer principal rather than duplicate repository mutation logic.

The private local runner snapshot is outside the repository under the user's Fullwell application-support directory. Its generated Git-shaped view contains Markdown item files grouped by category. The seed adapter may read that operator-supplied snapshot path, but tests must use synthetic temporary fixtures and no production path or private identifier may appear in committed code or documentation.

### Framing Notes

#### Expert panel

- Security and identity engineer - preserve the ordinary authentication boundary and make the reviewer exception narrow, revocable, rate-limited, and auditable without secrets.
- Privacy engineer - minimize the sample, define a closed scrub allowlist, and prevent linkability to the maintainer's household.
- Reliability and operations engineer - require dry-run evidence, idempotence, encrypted configuration, rollback, and production smoke checks.
- Staff platform engineer - reuse the central auth/session and journal mutation paths instead of adding direct database or Git writes.
- Reviewer-experience specialist - make credential sign-in and OAuth continuation work immediately with no email, setup, or unexplained redirect.
- Test and eval engineer - prove disabled behavior, abuse controls, redaction, category bounds, idempotence, and OAuth continuation with synthetic fixtures.

#### What problem are we actually solving?

OpenAI needs a safe, repeatable way to inspect a realistic Fullwell account. The task is not to clone a user's household; it is to create a deliberately unlinkable demo account whose small data set exercises the product while retaining no operational evidence or personal context from the source.

#### Roundtable highlights

- Security: a general password feature would expand the attack surface and contradict the current product. A single configured reviewer provider keeps the exception bounded and removable.
- Privacy: copying item files and deleting a few obvious fields is unsafe. New objects must be constructed from a closed allowlist with fresh IDs and generic evidence.
- Reliability: random selection and retries conflict unless the first dry run writes one permission-restricted manifest and all cloud mutations use stable idempotency keys from its random manifest ID.
- Platform: normal browser sessions and normal journal service calls keep authorization, Git authority, projections, locks, and recovery behavior intact.
- UX: the reviewer form must retain the original OAuth pending intent and explain only that review access is restricted; it must not expose configuration or account identifiers.
- Verification: tests should fail if forbidden keys, URL-like text, source IDs, delivery data, profile data, or excess sample counts survive sanitization.

#### Key tensions

- Immediate reviewer access conflicts with Fullwell's passwordless-only ordinary-user policy. Resolve this with a disabled-by-default operator adapter, not a public password enrollment path.
- Realistic examples conflict with unlinkability. Retain only minimal food-facing values and replace every relationship, timestamp, narrative, and provenance field.
- Random sampling conflicts with idempotence. Randomize once into an in-memory manifest, fingerprint it, preview aggregate results, then apply that exact manifest with stable keys.
- Complete automation conflicts with privacy review. The command automates structural scrubbing and validation but requires an explicit apply flag after a clean dry run.

#### Rejected alternatives

- A public password sign-in and password-reset flow: materially broadens product scope and attack surface for one review account.
- A reusable sign-in token in a URL: violates the repository's token-in-URL prohibition and leaks through histories and referrers.
- A magic-link account backed by a shared mailbox: depends on email access and fails OpenAI's immediate-credential requirement.
- Direct Neon or Git inserts: bypass typed authorization, advisory locks, idempotency, projections, and recovery.
- Copying raw item Markdown and deleting selected fields: preserves linkable IDs, prose, evidence, dates, or hidden fields as the schema evolves.
- Including delivery dishes: their required provider and order relationships cannot meet the scrub boundary.

## Milestones

### Milestone 1: Gated reviewer authentication

Add a semantic reviewer provider to the auth boundary and an additive migration with a down migration. Parse reviewer configuration once, require the complete credential set, and keep the adapter disabled when absent. Add a credential POST route and conditionally rendered sign-in form. Verify credentials in constant time, apply abuse controls, resolve the single reviewer identity, and reuse normal browser-session issuance and pending-intent validation.

Acceptance: disabled deployments expose no reviewer form or route behavior; invalid credentials return one generic response and are rate-limited; valid credentials produce an ordinary secure session and continue a validated OAuth pending intent; secrets never appear in responses or telemetry.

### Milestone 2: Privacy-scrubbed idempotent seed workflow

Add typed prepare and apply modes with `--source`, `--items-per-category`, a required private `--manifest` path, and an explicit `--apply` gate. Prepare reads the current snapshot from the supplied private path, rejects symlinks and malformed or excessive inputs, selects at most the requested number from each available non-delivery item category, and writes a mode-`0600` manifest containing only new onboarding evidence and minimal items constructed from a closed allowlist. Reject delivery, profiles, reports, URLs, original IDs, unsafe label shapes, or unsupported categories. Print only aggregate counts, the forbidden-field validation result, and a keyed manifest fingerprint.

Apply refuses a manifest with unsafe ownership or permissions, revalidates the complete contract, resolves or creates the configured reviewer identity, creates one isolated household through `hfj_create_household`, and commits the fixed sanitized manifest through `hfj_commit_onboarding`. Stable idempotency keys derived from its random manifest ID make a retry return the prior result without duplicate items. Delete the private manifest after successful live verification.

Acceptance: synthetic-fixture tests prove the exact retained fields, rejected fields, category caps, fresh identifiers, dry-run output, apply gate, idempotent retry, and failure on malformed or privacy-unsafe input. The production command never prints item names or private identifiers.

### Milestone 3: Contract and operator documentation

Update `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/RELIABILITY.md`, the server and client product specs, the deployment runbook, `CHANGELOG.md`, and `docs/IMPLEMENTATION_LOG.md`. Document the reviewer adapter as a temporary restricted provider, the encrypted credential source, rate limits, scrub allowlist, rollback, revocation, and credential-rotation procedure.

Acceptance: the passwordless ordinary-user contract remains explicit; the reviewer exception and its removal path are precise; docs contain placeholders only and pass the sensitive-content scanner.

### Milestone 4: Verification and rollout readiness

Run focused auth, route, config, migration, scrubber, seed-service, and CLI tests first. Then run lint, typecheck, production build, security tests, `npm run verify`, `npm run verify:sensitive`, `npm run verify:docs`, and `npm run verify:execplan`. Review the diff for unrelated changes and private values.

Acceptance: all gates pass and the source tree contains no reviewer credential, private source path, original identifier, sampled name, or generated seed manifest.

### Milestone 5: Authorized production provisioning and submission verification

After explicit authorization to commit, push, and deploy, create the reviewer credential in the documented encrypted store, deploy the exact reviewed artifact, and run the seed command first without `--apply`. Inspect only its aggregate category counts and clean privacy result, then rerun with `--apply`. Verify immediate browser sign-in, OAuth continuation, MCP read/write behavior, and account isolation. Rotate the credential after review or disable the adapter and revoke its sessions when review completes.

Acceptance: the live reviewer account contains only the bounded sanitized categories, the submitted credentials work without setup or 2FA, the OAuth tool scan completes, and ordinary accounts cannot access the demo household.

## Concrete Steps

1. Add focused auth types, migration, configuration, service logic, route, sign-in view, and tests.
2. Add the closed-allowlist snapshot reader/sanitizer and exhaustive privacy tests using synthetic fixtures.
3. Add the dry-run-first operator command and service-level idempotence tests.
4. Update architecture, security, reliability, product, deployment, changelog, and implementation records.
5. Run the focused and repository-wide quality gates and record results here.
6. Stop before commit, push, deployment, production credential creation, OAuth grant, or external form save unless the required authority and action-time confirmation have been supplied.

## Acceptance / Verification

- Reviewer access is absent by default and cannot be partially configured.
- Invalid and unknown reviewer credentials are indistinguishable and rate-limited.
- Valid reviewer access issues the ordinary secure browser session and preserves a safe pending intent.
- Seed dry-run emits only bounded category counts, validation status, and a fingerprint.
- Sanitized items contain fresh IDs and generic import evidence and contain none of the denylisted private structures or URL-like values.
- Each source category receives at most the configured small sample count; missing categories are reported as zero and never fabricated.
- Applying the same manifest twice is idempotent and does not create a second user, household, or item set.
- Reviewer membership is isolated from the maintainer household and ordinary authorization rules still reject cross-household access.
- Focused tests and all required repository gates pass.
- Live provisioning and external submission verification are complete only after an authorized deployment.

Run the local acceptance gates from the repository root:

    npm exec vitest run apps/server/src/auth/service.test.ts apps/server/src/auth/routes.test.ts apps/server/src/config.test.ts apps/server/src/http/app.test.ts apps/server/src/http/web-view-model.test.ts apps/web/src/test/app.test.tsx
    node --test deploy/scripts/materialize-credentials.test.mjs deploy/caddy.test.mjs
    npm run container:postgres:verify
    npm run verify
    npm run verify:sensitive
    npm run verify:docs
    npm run verify:execplan

## Idempotence and Recovery

Reviewer identity resolution uses the existing unique provider/subject contract. The database subject is a keyed derivation rather than the submitted username. Household creation and onboarding commit use stable keys derived from the manifest's random ID and reviewer identity; rerunning after interruption returns the existing mutation. Prepare performs no cloud mutation, and apply consumes the exact permission-restricted manifest that was previewed.

Rollback disables reviewer configuration, revokes the reviewer user's browser and OAuth sessions, and restores the prior application artifact. The isolated demo household may remain inaccessible for forensic recovery or be deleted through the normal account-deletion workflow after review; do not directly delete Neon or Git records. The additive provider migration is reversible only after all reviewer identities have been removed.

If sanitization fails, stop before mutation, discard the in-memory manifest, and fix the allowlist or source adapter. Never retry by widening accepted fields or bypassing the validator.

## Interfaces and Dependencies

- `ReviewerAccessConfig`: enabled only when a reviewer subject and secret credential are both present; values are runtime secrets.
- `BrowserAuthService.completeReviewerSignIn(input)`: verifies the configured credential, applies abuse controls, resolves the reviewer identity, and returns the normal browser session result.
- `AuthStore.resolveOrCreateUser({ provider: "reviewer", subject })`: reuses the typed external-identity uniqueness boundary.
- `ReviewerDemoSanitizer.buildManifest(source, options)`: returns a validated manifest of aggregate metadata plus fresh onboarding evidence/items; it never returns source identifiers as public output.
- `ReviewerDemoSeeder.preview(input)` and `ReviewerDemoSeeder.apply(input)`: share one validated manifest and use the central household journal service for mutation.
- Existing dependencies: `Clock`, `RandomSource`, `TokenHasher`, telemetry, auth abuse controls, `HouseholdFoodJournalService`, typed tool schemas, and the configured encrypted deployment credential loader.

## Feature-Critic Review

Completed 2026-08-01 before implementation.

- Security: the first draft did not state CSRF/origin handling, cache behavior, or distributed brute-force controls. Reuse the existing same-origin form boundary, require a valid origin and CSRF protection, set `Cache-Control: no-store`, rate-limit by both network key and keyed reviewer subject, and revoke browser plus OAuth sessions during disablement.
- Identity privacy: storing the submitted reviewer username as the external subject would make the credential identifier durable. Store only a keyed subject derivation and keep the username in encrypted runtime configuration.
- Provisioning order: allowing first sign-in to create an empty user would expose an incomplete account. Provision and seed with the adapter disabled, verify the isolated household, then enable reviewer sign-in in a separate restart.
- Data minimization: optional product attributes and semantic redaction created ambiguity and risked violating the invariant against programmatic food classification. Retain only the user-authorized short label and category, reject obvious structured-secret shapes, and reset every other item field.
- Manifest continuity: an in-memory random sample cannot survive the separate dry-run and apply invocations. Use one explicitly located, mode-`0600`, non-repository manifest with a random manifest ID; apply revalidates and consumes that exact artifact.
- Fingerprint privacy: an ordinary hash of low-entropy food labels can be guessed. Print only a keyed fingerprint derived with the server's runtime pepper.
- Source hardening: a snapshot parser is an external-input boundary. Reject symlinks, traversal, excessive files, malformed front matter, unknown categories, multiline labels, URL/email shapes, and schema mismatches before sampling.
- Reviewer UX: preserve the validated pending OAuth intent through the POST and return one generic credential error. Do not disclose whether reviewer access, username, or account exists.
- Operations: keep credentials configured while the adapter is disabled so seeding can resolve the same identity; enable only after seed verification. Rotation replaces the secret and revokes sessions without changing the identity or household.
- Testing: add negative coverage for partial configuration, disabled routes, CSRF/login-CSRF, timing-safe comparison boundaries, both abuse-limit keys, symlinks, traversal, oversized input, unsafe labels, forbidden fields, permissive manifests, apply-before-preview, duplicate apply, and cross-household access.

## Artifacts and Notes

Do not place generated manifests, sampled names, source paths, reviewer credentials, reviewer user IDs, household IDs, or production output in this document or the repository. Record only aggregate counts, pass/fail results, and credential-free command names.

## Outcomes & Retrospective

Pending implementation and authorized rollout.
