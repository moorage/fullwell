# Fullwell Icon Across Public Surfaces

## Purpose / Big Picture

Use the user-supplied `<approved-local-source>/fullwell.png` as Fullwell's canonical compact brand icon everywhere the public web surface can express an application image. A visitor should see the same exact artwork in the shared masthead, browser tab, Apple touch icon, web-app metadata, Open Graph and Twitter previews, and Schema.org application identity. The existing full-body character remains the homepage hero because it serves a different illustrative role.

The source artwork is user-provided and must not be redrawn or semantically altered. Derived raster files may only resize or fit that exact source for platform requirements. The change does not alter authentication, household authority, canonical origins, or application behavior.

## Progress

- [x] 2026-07-28T22:47Z: Confirmed Bead `fullwell-ce5`, inspected the current brand/metadata/static-asset path, and identified `<approved-local-source>/fullwell.png` as a 1046x1044 RGBA PNG with SHA-256 `696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189`.
- [x] 2026-07-28T22:51Z: Added the byte-identical canonical icon, deterministic square PNG/ICO variants, manifest, and updated social-card rendering.
- [x] 2026-07-28T22:54Z: Wired the masthead, browser head, Twitter metadata, and homepage structured data with focused web/server coverage.
- [x] 2026-07-28T22:58Z: Passed responsive visual review, 142 browser checks, 73 focused tests, and the full repository gate with 424 application tests.

## Surprises & Discoveries

- 2026-07-28: The repository already has a full-body hero illustration, a prior square face mark, and an SVG-authored 1200x630 social card. The new icon should replace the compact mark and social-card glyph, not the distinct full-body hero.
- 2026-07-28: The supplied source is two pixels wider than tall. Platform-square variants therefore need a deterministic fit to square rather than an AI redraw.
- 2026-07-28: Public SSR currently emits Open Graph metadata but no favicon links, web manifest, Twitter card metadata, or structured-data image/logo fields.
- 2026-07-28: The standard screencast helper cannot capture on this macOS host because Homebrew FFmpeg does not support the configured `x11grab` input; it exited 234 without creating the requested artifact. Reviewed Playwright desktop and iPhone screenshots provide the visual evidence instead.
- 2026-07-28: The prior square face PNG is no longer referenced by source or tests. The environment denied its explicit removal, so it remains as an inert legacy asset rather than prompting a broader or destructive workaround.

## Decision Log

- 2026-07-28: Preserve the exact supplied PNG as `apps/web/public/assets/fullwell-icon.png`; generate favicon and touch/app sizes deterministically from that file with Pillow. Rationale: browsers require several sizes and formats, while the user explicitly chose this artwork.
- 2026-07-28: Keep `apps/web/public/assets/fullwell-full-body-tall.png` in the homepage hero. Rationale: it is an illustration, not the compact icon surface the user asked to standardize.
- 2026-07-28: Keep `apps/web/public/assets/fullwell-social-card.svg` as the editable card source, replace its old house glyph with the supplied icon, and render the checked-in 1200x630 PNG from it. Rationale: social previews need a landscape composition while still using the canonical icon.
- 2026-07-28: Add a minimal `site.webmanifest` but no service worker or offline behavior. Rationale: manifest icons are a standard brand surface; install/offline capability is outside scope.

## Context and Orientation

`apps/web/public/assets/` is copied into the Vite build and served by `apps/server/src/http/web.ts`. `apps/web/src/components/app-shell.tsx` owns the Fullwell masthead across public, focused-auth, and authenticated routes. `apps/web/src/routes/install.tsx` owns the separate full-body homepage hero. `apps/web/src/brand.ts` centralizes public brand asset paths. `apps/web/src/server.tsx` builds route-specific public metadata and homepage Schema.org JSON-LD. `apps/server/src/http/web.ts` serializes metadata into the server-rendered document head.

The current social card is authored in `apps/web/public/assets/fullwell-social-card.svg` and published as `apps/web/public/assets/fullwell-social-card.png`. Browser and server assertions live in `apps/web/src/test/app.test.tsx`, `apps/server/src/http/app.test.ts`, and `tests/e2e/web.spec.ts`.

Assumptions:

- `<approved-local-source>/fullwell.png` is the exact approved source.
- The icon is decorative beside the visible `Fullwell` name, so its masthead `alt` remains empty.
- Social previews retain the existing Fullwell/Sous Chef Studio text and 1200x630 aspect ratio.
- Existing uncommitted onboarding changes belong to the immediately preceding user request and must remain intact.

## Milestones

### Milestone 1 - Canonical and derived assets

Files:

- `apps/web/public/assets/fullwell-icon.png`
- `apps/web/public/assets/fullwell-icon-16.png`
- `apps/web/public/assets/fullwell-icon-32.png`
- `apps/web/public/assets/fullwell-icon-180.png`
- `apps/web/public/assets/fullwell-icon-192.png`
- `apps/web/public/assets/fullwell-icon-512.png`
- `apps/web/public/favicon.ico`
- `apps/web/public/site.webmanifest`
- `apps/web/public/assets/fullwell-social-card.svg`
- `apps/web/public/assets/fullwell-social-card.png`

Tasks:

1. Copy the source PNG byte-for-byte into the public asset directory.
2. Generate square fit variants and a multi-size ICO from the canonical file without redrawing it.
3. Replace the social card's generic house glyph with the canonical icon and render the updated PNG.
4. Record exact dimensions and SHA-256 values in browser coverage.

Verification:

- `file apps/web/public/assets/fullwell-icon*.png apps/web/public/favicon.ico apps/web/public/assets/fullwell-social-card.png`
- `shasum -a 256 <approved-local-source>/fullwell.png apps/web/public/assets/fullwell-icon.png`

### Milestone 2 - Public consumers and metadata

Files:

- `apps/web/src/brand.ts`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/server.tsx`
- `apps/web/index.html`
- `apps/server/src/http/web.ts`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/app.test.ts`
- `tests/e2e/web.spec.ts`
- `docs/product-specs/household-food-journal-client.md`

Tasks:

1. Replace the masthead's prior face asset with the canonical icon and its true intrinsic dimensions.
2. Add favicon, Apple touch icon, and manifest links to both the Vite development shell and server-rendered shell.
3. Add Twitter large-card metadata alongside existing Open Graph metadata.
4. Add the canonical application image and brand logo to homepage Schema.org data without misrepresenting it as the Sous Chef Studio corporate logo.
5. Update deterministic tests and normative product guidance.

Verification:

- `npm run test:app -- --project web`
- `npm run test:app -- --project server`
- `npm run build`

### Milestone 3 - Visual and repository acceptance

Files:

- `docs/IMPLEMENTATION_LOG.md`
- `docs/exec-plans/active/2026-07-28-fullwell-icon-surfaces.md`

Tasks:

1. Run the public homepage in the local server and capture desktop and mobile screenshots.
2. Inspect the masthead icon, hero relationship, favicon/metadata responses, overflow, and responsive layout.
3. Attempt `npm run capture:screencast -- --output artifacts/screencasts/fullwell-icon-surfaces.mp4`; record the exact result without claiming an artifact if capture is unsupported.
4. Run full repository, documentation, and ExecPlan verification.
5. Move this plan to `docs/exec-plans/completed/` only after all local acceptance work passes.

Verification:

- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification

- The SHA-256 of `apps/web/public/assets/fullwell-icon.png` exactly matches `<approved-local-source>/fullwell.png`.
- The visible masthead uses the new icon across public and authenticated shells without replacing the accessible `Fullwell` text.
- Server-rendered pages include favicon, Apple touch icon, and manifest links.
- Every indexable public page emits Open Graph and Twitter image metadata using the updated 1200x630 social card.
- Homepage JSON-LD identifies the supplied icon as the Fullwell application/brand image, not the Sous Chef Studio organization logo.
- `/favicon.ico`, `/site.webmanifest`, every PNG icon variant, and the social card return correct content types.
- Desktop and mobile screenshots show no overlap, clipping, or horizontal overflow.
- `npm run test:e2e`, `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` pass.
- Rollback is file-level: restore the prior masthead path, metadata serialization, social card, and static assets. No database or operational rollback is needed.

## Outcomes & Retrospective

The user-supplied source is now the canonical compact Fullwell icon. The checked-in canonical PNG is byte-identical to `<approved-local-source>/fullwell.png` at SHA-256 `696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189`; deterministic 16, 32, 180, 192, and 512 pixel PNGs plus a multi-size ICO serve platform requirements. The masthead, Vite and SSR heads, web manifest, Open Graph/Twitter card, and Fullwell application/brand Schema.org fields use the artwork without treating it as the Sous Chef Studio corporate logo.

Focused web/server coverage passed 73 tests. The full WebKit matrix passed 142 tests with 22 intentional project skips across desktop, iPhone 13, 320-pixel, and no-JavaScript configurations. Reviewed desktop and iPhone screenshots show a crisp proportional masthead icon, no clipping or horizontal overflow, and the full-body hero remains visually distinct. The 1200x630 social card was also inspected directly. `npm run verify` passed lint, typecheck, builds, 424 application tests with 12 expected database-gated skips, idea checks, documentation checks, and ExecPlan checks.

The standard screencast command exited 234 because this macOS FFmpeg build has no `x11grab` input, so no screencast artifact is claimed. The work remains local and uncommitted; deployment and release are separate user-authorized steps. Rollback remains file-level with no database or operational migration.
