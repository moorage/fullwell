# Add Fullwell Character Artwork to the Public Website

## Purpose / Big Picture

Fullwell's public website currently explains the product clearly but uses only a small generic house icon as its own visual mark. The user supplied two transparent PNG illustrations of the Fullwell household-assistant character. This change places the tall full-body illustration in the public homepage hero and uses the square face illustration as the compact Fullwell masthead mark, then publishes and deploys the exact reviewed result.

The artwork is presentation only. It must not change authentication, household data, canonical metadata, provider configuration, or server authority. The public page must remain server rendered, functional without JavaScript, responsive at 320 CSS pixels, accessible, and fast enough to avoid avoidable layout shift. The existing production image and deploy environment remain the rollback unit.

## Progress

- [x] 2026-07-27T20:38Z: Created and claimed Beads feature `fullwell-3i2`; confirmed the repository started clean at pushed commit `6fd8674`.
- [x] 2026-07-27T20:38Z: Inspected both supplied PNGs, the current install/homepage route, shared masthead, responsive CSS, public identity tests, static-asset serving, and the current production release boundary.
- [x] 2026-07-27T20:43Z: Completed Milestone 1. Added the exact artwork bytes, decorative intrinsic image markup, responsive hero and masthead styling, unit coverage, and exact static-asset browser checks. The focused component suite passes 61 tests; web typecheck/build and eight focused WebKit checks pass.
- [x] 2026-07-27T20:48Z: Completed Milestone 2. Accepted desktop, iPhone 13, 320x568, and no-JavaScript renders; the full browser gate passes 142 checks with 22 intentional skips, and the dedicated accessibility gate passes six applicable checks with six intentional skips. The standard screencast helper failed before capture on the known unavailable `x11grab` input with FFmpeg exit 234, so the reviewed Playwright screenshots remain the visible evidence.
- [ ] Milestone 3: Commit, push, build the exact Linux/amd64 image, deploy with preserved rollback, and verify production.

## Surprises & Discoveries

- 2026-07-27: The supplied full-body PNG is `774x1247`, transparent, and 725 KiB; the face PNG is `454x455`, transparent, and 226 KiB. Both can be served directly without format conversion or generated variants.
- 2026-07-27: `/` and `/install` share `InstallRoute`, so one hero placement covers the canonical homepage and install entry without a duplicate component.
- 2026-07-27: `AppShell` owns the masthead across public, focused-auth, and workspace routes. Replacing its generic house stamp with the supplied face gives the compact artwork one consistent, non-authoritative brand role.
- 2026-07-27: The source files have Finder quarantine/tag extended attributes, but their embedded image properties expose only dimensions, alpha, and the standard sRGB profile. `cp -X` prevented those source attributes from carrying into the workspace; macOS subsequently attached its local `com.apple.provenance` attribute. Git does not store extended attributes, and the committed PNG bytes retain the exact source SHA-256 values.
- 2026-07-27: The reviewed desktop, iPhone 13, and 320x568 renders keep the agent chooser in the first desktop viewport and place the capped mobile character between the product explanation and chooser without horizontal overflow.

## Decision Log

- 2026-07-27: Keep the supplied PNG bytes unchanged and check them into `apps/web/public/assets/` under their original descriptive filenames. This preserves the user's artwork and lets Vite include it through the existing static-asset path.
- 2026-07-27: Use the full-body image as a decorative hero illustration with empty alternative text because the adjacent heading and copy already name and explain Fullwell. Use the face image as a decorative image beside the visible `Fullwell` wordmark for the same reason.
- 2026-07-27: Add explicit intrinsic width and height attributes to both images and responsive CSS that preserves aspect ratio. Do not add JavaScript, animation, new data contracts, or a second image-loading abstraction.
- 2026-07-27: Keep the existing social card unchanged. The new face is a compact in-product mark, not a replacement for crawler metadata or a new claim about the character.

## Context and Orientation

`apps/web/src/routes/install.tsx` renders the canonical public homepage and install flow. The current heading, product attribution, agent chooser, installation steps, WhatsApp explanation, and company disclosure are already normative and should remain unchanged. The new hero wrapper must compose with these elements rather than rewrite the page.

`apps/web/src/components/app-shell.tsx` renders the masthead. Its `.wordmark__stamp` currently contains a Lucide house. The face illustration will replace only that icon; the link text, destination, navigation, and accessible name remain `Fullwell`.

`apps/web/src/styles.css` owns the existing responsive design. The hero should use a two-column grid at desktop widths, tighten at tablet widths, and become one column at `600px` and below. The illustration must not create horizontal overflow, obscure focus targets, or remain oversized above the install controls on a phone.

`apps/web/src/test/app.test.tsx`, `tests/e2e/web.spec.ts`, and `tests/e2e/accessibility.spec.ts` already cover public identity, initial server-rendered markup, 320-pixel overflow, screenshots, and automated WCAG checks. Extend those surfaces rather than creating a parallel harness.

The production service is built from `Dockerfile`, served by the existing DigitalOcean systemd/Compose deployment, and currently runs `hfj-staging:canonical-origin-20260727-1-runtime`. This change has no migration. Rollback restores the pre-artwork immutable image while leaving `PUBLIC_DOMAIN=fullwell.ai` and the current Caddyfile unchanged.

### Feature-critic gate

- UX critic: a tall hero can make the install controls feel secondary, especially on a phone. Require the agent chooser to remain in the initial 1440x900 desktop viewport, cap the mobile illustration height, and inspect 320-pixel screenshots before accepting the layout.
- Accessibility critic: two decorative portraits can accidentally add repeated or misleading accessible names. Require empty `alt`, preserve the wordmark link's exact `Fullwell` name, and retain public-route axe coverage.
- Performance critic: the 725 KiB full-body PNG is above the fold. Preserve intrinsic dimensions, request it eagerly with high fetch priority, use asynchronous decoding, add no duplicate preload, and verify the built and deployed assets once rather than adding generated variants.
- Privacy critic: Finder metadata must not enter the release. Copy without extended attributes, keep the exact source byte checksums, and do not add provenance that identifies a local path or user.
- Reliability critic: a successful component test does not prove Vite copied the binaries into the server artifact. Require built-asset HTTP checks and final production content type, checksum, readiness, and rollback verification.

## Milestones

### Milestone 1 - Add artwork and regression coverage

Files:

- `apps/web/public/assets/fullwell-full-body-tall.png`
- `apps/web/public/assets/fullwell-face-square.png`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/test/app.test.tsx`
- `tests/e2e/web.spec.ts`

Tasks:

1. Copy the exact supplied PNG bytes without carrying source extended attributes into the public asset directory and verify their checksums still match the sources. Git and the OCI build include file bytes, not local macOS extended attributes.
2. Replace only the masthead's generic house stamp with the square face while retaining the visible Fullwell wordmark and link behavior.
3. Add the full-body illustration to a new homepage hero grid with explicit intrinsic dimensions, eager/high-priority loading, stable responsive sizing, and decorative alternative text.
4. Add unit and browser assertions for both asset paths, intrinsic attributes, HTTP content type, visibility, exact wordmark name, desktop control placement, and no horizontal overflow.

Verification:

- `npm test --workspace @hfj/web -- --run src/test/app.test.tsx`
- `npm run typecheck --workspace @hfj/web`
- `npm run build --workspace @hfj/web`
- `shasum -a 256 apps/web/public/assets/fullwell-full-body-tall.png apps/web/public/assets/fullwell-face-square.png`
- `npm run test:e2e -- --grep "install experience|company and WhatsApp identity"`

### Milestone 2 - Review the complete public experience and docs

Files:

- `docs/product-specs/household-food-journal-client.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/release/verification-evidence.md`
- `docs/release/manual-matrix.md`
- `docs/exec-plans/active/2026-07-27-fullwell-character-artwork.md`

Tasks:

1. Inspect the actual rendered homepage at desktop, mobile, and 320-pixel widths; verify the character supports the existing hierarchy and does not delay or displace the install action excessively.
2. Run public-route accessibility, no-JavaScript, reduced-motion, and screenshot coverage.
3. Update the client product spec, changelog, implementation log, and release evidence with the exact presentation behavior and verification.
4. Attempt the repository screencast. If the known macOS `x11grab` limitation remains, record the exact failure and retain browser screenshots as visible evidence.

Verification:

- `npm run test:e2e`
- `npm run test:accessibility`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run capture:screencast -- --output artifacts/screencasts/fullwell-character-artwork.mp4`

### Milestone 3 - Publish and deploy

Files:

- `docs/release/verification-evidence.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/exec-plans/active/2026-07-27-fullwell-character-artwork.md`

Tasks:

1. Commit with the required `AI-Model` trailer and push the reviewed source.
2. Build and export the exact Linux/amd64 OCI image, verify its archive checksum and concrete platform manifest, transfer it to the Droplet, normalize its Docker tag, and run a bounded runtime canary before activation.
3. Preserve the current immutable image reference and deploy environment, change only `HFJ_IMAGE`, and restart the systemd service with automatic rollback on restart or readiness failure.
4. Verify the apex, redirects, both image assets, initial HTML, desktop/mobile rendering, Apple sign-in entry, OAuth/MCP discovery, signed WhatsApp delivery, persistence, and operator health.
5. Record final digests, rollback references, checks, and Beads closure in a pushed evidence commit.

Verification:

- `PUBLIC_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- production`
- `PUBLIC_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- production`
- `curl --fail --silent --show-error https://fullwell.ai/assets/fullwell-full-body-tall.png --output /dev/null`
- `curl --fail --silent --show-error https://fullwell.ai/assets/fullwell-face-square.png --output /dev/null`

## Acceptance / Verification

- The public homepage visibly and intentionally presents the supplied full-body Fullwell character without changing the existing product claims or install workflow.
- The masthead uses the supplied square face beside the visible Fullwell wordmark on public, focused-auth, and authenticated routes.
- Both images retain exact supplied bytes, load from same-origin HTTPS assets with `image/png`, have stable intrinsic dimensions, and use correctly decorative alternative text.
- Desktop, tablet, mobile, 320-pixel, no-JavaScript, reduced-motion, and WCAG checks pass with no horizontal overflow or obstructed controls.
- Focused web tests, typecheck, build, E2E, accessibility, full repository verification, docs verification, and ExecPlan verification pass.
- Production runs the exact committed Linux/amd64 image; readiness, redirects, asset checks, Apple entry, OAuth/MCP discovery, messaging, persistence, and rollback evidence pass.
- No database migration, household Git mutation, provider change, secret rotation, or new browser authority occurs.

Run `npm run verify`, `npm run test:e2e`, and `npm run test:accessibility` locally, then run `PUBLIC_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- production` and `PUBLIC_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- production` against the deployed image.

## Idempotence and Recovery

Copying the same source PNGs and rebuilding is deterministic; checksums must continue to match the originals. The source change is ordinary static presentation and can be reverted without data work.

Before deployment, retain the current `HFJ_IMAGE` and `/etc/hfj/deploy.env`. If the new image fails runtime canary, restart, readiness, asset, or visual checks, restore the prior environment and restart the existing systemd unit. Caddy, `PUBLIC_DOMAIN`, Apple, Meta, Neon, and household repositories do not change.

## Artifacts and Notes

- Beads feature: `fullwell-3i2`
- Source full-body SHA-256: `992d1d3a81d36a6d2b1a2e74a55d855557cdab3972fcb5cc1403f6ccc0c31219`
- Source face SHA-256: `c03c30d5d13f7f74f6e4887805ffc659f317c2def2709c090081bd62bdb5fa04`
- Planned screencast: `artifacts/screencasts/fullwell-character-artwork.mp4`

## Outcomes & Retrospective

The exact full-body illustration now anchors the canonical homepage hero, while the square face replaces the generic masthead stamp throughout the shared shell. Both remain decorative, preserve the existing accessible names and product claims, and have intrinsic dimensions plus bounded responsive sizing. Local desktop, iPhone 13, 320x568, and no-JavaScript screenshots are accepted; the agent chooser remains above the fold on desktop. Focused component, typecheck, build, and eight WebKit checks pass. Add broad-gate, release-image, production, rollback, and final risk evidence after deployment.
