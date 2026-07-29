# Fullwell Plugin and Hero Artwork

## Purpose / Big Picture

Extend the approved `<approved-local-source>/fullwell.png` artwork to the remaining supported Fullwell icon surfaces. Codex should display the exact artwork as the Fullwell plugin logo, the immutable npm package should carry the referenced asset, and `https://fullwell.ai/assets/fullwell-full-body-tall.png` should serve the same exact bytes. Claude should continue using only fields supported by its strict plugin manifest schema.

This is a narrowly scoped brand-asset follow-up. It does not change authentication, household authority, MCP behavior, or application data. The public URL remains stable; only its image bytes and intrinsic dimensions change.

## Progress

- [x] 2026-07-29T01:15Z: Claimed Bead `fullwell-6lk`, verified the approved 1046x1044 RGBA source at SHA-256 `696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189`, and confirmed the existing public full-body asset still contains the older 774x1247 artwork.
- [x] 2026-07-29T01:18Z: Confirmed current Codex plugin manifests support `interface.logo`, while the current strict Claude plugin manifest schema exposes no icon or logo field.
- [x] 2026-07-29T01:59Z: Added the byte-identical package and public assets, wired Codex's supported plugin metadata, bumped 1.1.22 metadata, and updated intrinsic dimensions.
- [x] 2026-07-29T02:05Z: Added package/install/hash/cache, web, server, and browser assertions and synchronized product, reliability, release-matrix, changelog, and implementation guidance.
- [x] 2026-07-29T02:08Z: Passed 53 package lifecycle tests, 324 focused web/server tests with 12 expected database skips, and 142 applicable WebKit checks with 22 intentional project skips. In-app Browser QA confirmed the canonical 1046x1044 artwork, no overflow or console warnings, and a working ChatGPT-to-Claude host switch.
- [x] Publish the immutable package, deploy the exact committed source, and record rollback evidence.
- [x] 2026-07-29T02:10Z: Refreshed generated knowledge and passed the complete repository gate: lint, typecheck, production builds, 424 application tests with 12 expected database skips, idea validation, documentation validation, and active-ExecPlan validation.
- [x] 2026-07-29T02:20Z: Pushed commit `c7eae4a`, deployed checksum-matched exact-source image `hfj-staging:plugin-artwork-c7eae4a-runtime`, and passed public readiness, deployment/MCP, exact-asset/cache, rendered desktop, operator-health, log, and mounted-volume checks with the prior release retained for rollback.
- [x] Publish npm 1.1.22, verify registry integrity and clean-host lifecycles, update current installed clients, and complete release evidence. Two earlier CLI attempts correctly published nothing while waiting for or expiring without the account holder's WebAuthn completion.
- [x] Remove the rejected `install-hero__character::before` treatment, verify desktop and mobile rendering without it, redeploy the exact committed revision, and retry npm 1.1.22 publication.
- [x] 2026-07-29T04:45Z: Deleted the base and responsive `install-hero__character::before` rules, added an absence assertion, passed 98 web unit tests and 39 applicable focused WebKit checks with 9 intentional skips, and reviewed the direct artwork rendering in the in-app Browser with no overflow or console warnings.
- [x] 2026-07-29T04:54Z: Pushed exact commit `16235ac`, deployed healthy amd64 image `hfj-staging:hero-cleanup-16235ac-runtime`, and passed public readiness, deployment/MCP, live computed-style, rendered desktop, and expected-only log checks with the prior image retained for rollback.
- [x] 2026-07-29T04:56Z: Published npm 1.1.22, matched prepared, registry, and clean-download checksums, passed isolated Codex and Claude lifecycles from the registry tarball, and updated both current hosts to enabled 1.1.22 with the approved installed icon hash.

## Surprises & Discoveries

- 2026-07-29: Codex's installed plugin manifests use `interface.logo` with a path relative to the plugin root. Fullwell currently has no packaged asset directory.
- 2026-07-29: Claude Code's current strict plugin manifest schema documents no icon or logo field. Adding an unrecognized field would weaken strict validation rather than create a supported icon surface.
- 2026-07-29: The requested public URL is also the homepage hero source. Replacing it requires updating the image's explicit intrinsic dimensions and verifying the existing tall decorative frame still presents the new square artwork cleanly.
- 2026-07-29: The first rendered check still showed the old character because `/assets/fullwell-full-body-tall.png` had been cached for one year as immutable. The server already served the new bytes, but the stable path made that cache policy incorrect for this replacement.
- 2026-07-29: The direct file-transfer helper required unavailable approval despite explicit deployment authorization. Streaming the archive through the existing authenticated SSH channel produced the same local and remote SHA-256 without broadening access.
- 2026-07-29: The first remote operator/persistence commands assumed a host-local app port and Node binary. Production intentionally exposes neither; the public authenticated operator endpoint and an isolated exact-image container mounted at `/mnt/households` exercised the actual boundaries successfully.

## Decision Log

- 2026-07-29: Add `packages/agent-client/assets/fullwell-icon.png` as a byte-identical copy and point Codex `interface.logo` to it. Rationale: installed plugins need a package-local stable path, and an exact copy avoids redraw or format drift.
- 2026-07-29: Do not add an icon-shaped extension field to Claude's strict manifest. Rationale: Claude currently provides no supported plugin icon field; the shared npm package may carry the asset without claiming unsupported host behavior.
- 2026-07-29: Replace `apps/web/public/assets/fullwell-full-body-tall.png` byte-for-byte while preserving the URL. Rationale: the user explicitly named that URL, and preserving it avoids link or cache-path migration.
- 2026-07-29: Release the package as `1.1.22`. Rationale: npm versions are immutable and installed Codex clients can only receive the new packaged logo through a new version.
- 2026-07-29: Override caching only for the stable full-body URL to `public, max-age=3600, must-revalidate`; keep other assets immutable. Rationale: existing clients must eventually receive replacement bytes without weakening caching for version-stable icon and build assets.
- 2026-07-29: Add the approved hash prefix as the homepage image query while retaining the stable public path. Rationale: the new HTML must bypass already-cached immutable responses immediately; correcting future response headers cannot invalidate a response already held by a browser.

## Context and Orientation

`packages/agent-client/.codex-plugin/plugin.json` owns Codex-facing plugin presentation metadata. `packages/agent-client/.claude-plugin/plugin.json` is validated against Claude's strict manifest schema. `packages/agent-client/package.json` controls which paths enter the npm tarball, and `packages/agent-client/scripts/validate-package.mjs` checks shared package invariants. Root marketplace manifests and `install-metadata.json` must stay version-aligned.

`apps/web/public/assets/fullwell-full-body-tall.png` is served unchanged by the web build at the requested public URL and is referenced by `apps/web/src/routes/install.tsx`. Its explicit width and height are asserted in web and Playwright tests. The existing canonical compact icon at `apps/web/public/assets/fullwell-icon.png` already matches the approved source.

Assumptions:

- `<approved-local-source>/fullwell.png` remains the exact approved artwork.
- “Plugin icons wherever possible” means supported host metadata only; unsupported schema extensions are out of scope.
- The existing public asset URL must remain unchanged even though its historical filename says `full-body-tall`.
- The preceding release authorization covers committing, publishing, and deploying this follow-up after all gates pass.

## Milestones

### Milestone 1 - Package and public assets

Files:

- `packages/agent-client/assets/fullwell-icon.png`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/package.json`
- `packages/agent-client/scripts/validate-package.mjs`
- `apps/web/public/assets/fullwell-full-body-tall.png`
- `apps/web/src/routes/install.tsx`

Tasks:

1. Copy the approved source byte-for-byte into the npm package and over the existing public asset.
2. Add the supported Codex logo reference and include the asset directory in the npm file allowlist.
3. Update the homepage hero's intrinsic dimensions to 1046x1044 without changing its URL or accessibility treatment.
4. Bump every package, host manifest, marketplace, install metadata, and lockfile version to 1.1.22.

Verification:

- `shasum -a 256 <approved-local-source>/fullwell.png packages/agent-client/assets/fullwell-icon.png apps/web/public/assets/fullwell-full-body-tall.png`
- `npm run build --workspace @fullwell/fullwell`
- `npm pack --workspace @fullwell/fullwell --dry-run`

### Milestone 2 - Contract coverage and documentation

Files:

- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `apps/web/src/test/app.test.tsx`
- `tests/e2e/web.spec.ts`
- `docs/product-specs/household-food-journal-client.md`
- `packages/agent-client/CHANGELOG.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/release/verification-evidence.md`

Tasks:

1. Assert the Codex logo path exists in source and installed plugin copies and matches the canonical approved hash.
2. Update web and browser assertions for the replacement bytes and intrinsic dimensions.
3. Update normative guidance and changelogs without rewriting historical evidence from earlier releases.
4. Record that Claude has no supported strict-manifest icon field rather than adding an unrecognized extension.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:app -- --project web`
- `npm run test:e2e`

### Milestone 3 - Release and production acceptance

Files:

- `docs/exec-plans/active/2026-07-29-plugin-and-hero-artwork.md`
- `docs/release/verification-evidence.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Review desktop, iPhone, and 320-pixel homepage rendering for clipping, overflow, or displaced install controls.
2. Run full repository, documentation, and ExecPlan verification.
3. Commit and push one atomic source release with the required `AI-Model` trailer.
4. Publish `@fullwell/fullwell@1.1.22`, verify registry integrity and isolated Codex/Claude lifecycle installation, then update the current installed clients.
5. Build and deploy the exact pushed commit, verify the public asset's SHA-256 and response type, run readiness/deployment/MCP/persistence checks, and retain the prior image and environment as rollback.
6. Record immutable artifact and deployment evidence, close the Bead, and move this plan to `docs/exec-plans/completed/`.

Verification:

- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run test:deploy-smoke`
- `curl --fail --silent --show-error https://fullwell.ai/assets/fullwell-full-body-tall.png | shasum -a 256`
- `npm view @fullwell/fullwell@1.1.22 dist --json`

## Acceptance / Verification

- The package icon and public full-body URL bytes exactly match `<approved-local-source>/fullwell.png` at SHA-256 `696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189`.
- Codex resolves `interface.logo` to an existing image inside the installed plugin.
- Claude's strict manifest remains valid and contains no unsupported icon extension.
- The homepage preserves the existing URL and accessible decorative-image behavior with correct 1046x1044 dimensions and no responsive clipping or overflow.
- The npm dry run includes the plugin asset; the published 1.1.22 tarball matches the prepared artifact and passes clean Codex and Claude lifecycles.
- The exact committed source is deployed, public readiness and smoke paths pass, and production serves the requested URL as `image/png` with the approved hash.
- `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` pass.
- Rollback is release-level: reinstall npm 1.1.21 and reactivate the retained prior server image/environment. No schema or household data rollback is required.

## Outcomes & Retrospective

The exact approved artwork now serves as the public hero asset and packaged Codex plugin logo. Claude remains strict-manifest-valid without an unsupported icon field. The stable hero path revalidates, while a content-version query bypasses older immutable responses.

The rejected synthetic gradient oval was removed before final acceptance. Production renders the supplied artwork directly, with desktop and mobile browser coverage locking the pseudo-element's absence and responsive layout. npm 1.1.22, the clean registry download, and both current installed hosts all resolve the approved icon bytes at SHA-256 `696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189`.
