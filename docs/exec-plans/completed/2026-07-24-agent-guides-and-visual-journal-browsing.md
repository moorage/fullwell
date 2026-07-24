# Agent Guides and Visual Journal Browsing

Status: completed and deployed on 2026-07-24.

## Purpose / Big Picture

Make the Fullwell website a useful continuation of chat. Public entry actions should visually identify ChatGPT, Claude, and Apple; task-specific guide pages should explain the four requested agent workflows; and signed-in household members should be able to browse existing recipe and grocery records as image-forward, progressively loaded collections. The browser remains presentation-only for journal content, Git remains authoritative, and the server remains responsible for household authorization and safe projection.

## Progress

- [x] 2026-07-24T05:40Z: Framed the feature, inspected existing web/server projection patterns, created `fullwell-t5q`, and generated coordinated internal UI concepts.
- [x] 2026-07-24T06:10Z: Completed expert synthesis and the pre-implementation feature critique; incorporated authorization, image privacy, non-JavaScript, and load-failure requirements below.
- [x] 2026-07-24T07:15Z: Completed Milestone 1 with branded ChatGPT/Claude install actions, Apple sign-in treatment, the public guide hub and detail routes, contextual deep links, and passing web tests.
- [x] 2026-07-24T08:30Z: Completed Milestone 2 with authenticated server-projected recipe/grocery routes, bounded continuation JSON, `?page=N` fallback prefixes, responsive image cards, client deduplication/retry/end states, and passing web/server/type checks.
- [x] 2026-07-24T16:12Z: Completed Milestone 3 with the WebKit matrix, direct screenshot review, synchronized docs, release-image safeguards, live DigitalOcean deployment, and deployed HTTP/MCP smokes.

## Surprises & Discoveries

- 2026-07-24: The journal projection already contains every display field needed for both browsers, so no Git schema or mutation change is required.
- 2026-07-24: `hfj_search_items` accepts a cursor but currently always returns `next_cursor: null`; the website needs a separate read-only presentation paginator rather than changing the agent search contract.
- 2026-07-24: External recipe and grocery image URLs already pass the shared HTTP(S) boundary. The web card still needs `referrerPolicy="no-referrer"`, fixed dimensions, lazy loading, and a local fallback.
- 2026-07-24: The current Apple sign-in control uses a placeholder dot and agent links route unrelated tasks back to `/install`, which makes the logo and guide work one coherent information-architecture change.
- 2026-07-24: The in-app browser was unavailable, so visual review used the repository's deterministic desktop, mobile, narrow, and no-JavaScript WebKit screenshots plus direct image comparison.
- 2026-07-24: The OCI build had no `.dockerignore`; deployment required excluding local credentials, test state, repository metadata, artifacts, and key material before the first build layer.
- 2026-07-24: Docker loaded the Apple-exported OCI index but Compose tried to pull until the verified index digest was explicitly retagged. The first start failed before a new container ran, and the existing rollback tag plus deploy-env backup remained intact.

## Decision Log

- 2026-07-24: Present the Codex-hosted public option as ChatGPT while preserving `codex` in commands, setup URLs, route query values, manifests, OAuth clients, and internal types. Public wording changes must not break installed host contracts.
- 2026-07-24: Use local inline vector components for the three small brand marks. Visible names remain the accessible label and marks are decorative.
- 2026-07-24: Use `/guides`, `/guides/whatsapp`, `/guides/household-invitations`, `/guides/collections/create`, and `/guides/collections/share` as stable public routes. Contextual links point to the narrowest relevant page.
- 2026-07-24: Use a typed, same-origin JSON endpoint for hydrated cursor loading and a normal `?page=N` document link for the no-JavaScript path. Both use the same server projection helper and deterministic order.
- 2026-07-24: Recipe and grocery pages show recorded fields only. They do not add browser mutations, product purchasing, semantic grouping, or safety claims.
- 2026-07-24: Keep the visual browsers deliberately simpler than the concepts: omit speculative search, filters, and derived state totals until a server-owned contract and demonstrated user need exist.
- 2026-07-24: Deploy the current site and server image only; do not publish or upgrade the Fullwell agent package as part of this browser release.

## Context and Orientation

`apps/web/src/route.ts` and `apps/web/src/app.tsx` own route resolution and React route dispatch. `apps/web/src/components/app-shell.tsx` owns global and household navigation. `apps/web/src/types.ts`, `apps/web/src/context.tsx`, and `apps/web/src/fixtures.ts` own the typed server-rendered payload and test fixture.

`apps/server/src/http/web.ts` owns Fastify web routes, response privacy headers, and production React rendering. `apps/server/src/http/web-view-model.ts` resolves the browser principal, membership, Git-synchronized projection, and safe view model. `HouseholdProjection.items` in `apps/server/src/core/types.ts` contains validated `JournalItem` values and Git revisions.

The new JSON boundary is a read-only browser projection, not an agent tool and not a new authority. Every call resolves the browser principal, confirms current household membership, checks projection/Git consistency through existing store state, returns `private, no-store`, and never accepts filesystem paths or mutation input.

## Framing Notes

The expert panel covered product information architecture, accessible frontend behavior, privacy/security, reliability, and semantic integrity. The feature critic found the following must-fix items before implementation:

- journal batches must fail closed for anonymous, removed, stale, or cross-household membership;
- external images must not send a referrer and must have a non-image fallback;
- automatic loading must have a keyboard and no-JavaScript equivalent;
- client fetch failures must be visible and retryable, and duplicate records must not render;
- brand marks may support but never replace the action name;
- guide examples must keep credentials, access codes, and sharing confirmation out of chat.

Low-cost should-fix items are a stable end-of-list announcement, responsive one-column behavior, `content-visibility` for long grids, and direct contextual links from install, account WhatsApp, members, collections, public collection handoff, and household summaries.

## Milestones

### Milestone 1 - Branded entry actions and public task guides

Files:

- `apps/web/src/components/brand-mark.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/routes/sign-in.tsx`
- `apps/web/src/routes/guides.tsx`
- `apps/web/src/routes/account.tsx`
- `apps/web/src/routes/household-members.tsx`
- `apps/web/src/routes/household-collections.tsx`
- `apps/web/src/routes/household-overview.tsx`
- `apps/web/src/routes/collection-preview.tsx`
- `apps/web/src/route.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/test/route.test.ts`
- `apps/web/src/test/app.test.tsx`

Tasks:

1. Add decorative ChatGPT, Claude, and Apple vector marks with visible adjacent labels and current-color rendering.
2. Rename only the public Codex option and associated prose to ChatGPT; preserve technical commands and internal route values.
3. Add the guide hub and four stable detail routes with concrete copyable chat examples, browser-confirmation boundaries, previous/next navigation, and relevant install handoffs.
4. Link each existing contextual action to its specific guide and add Guides to public and workspace navigation.
5. Add component and routing tests for all guide destinations, labels, marks, examples, and contextual links.

Verification:

- `npm run test:unit --workspace @hfj/web`
- `npm run typecheck --workspace @hfj/web`

### Milestone 2 - Authorized visual recipe and grocery browsers

Files:

- `apps/web/src/types.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/fixtures.ts`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/visual-journal-feed.tsx`
- `apps/web/src/routes/household-recipes.tsx`
- `apps/web/src/routes/household-groceries.tsx`
- `apps/web/src/route.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/test/route.test.ts`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/web.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/main.ts`
- `tests/e2e/accessibility.spec.ts`

Tasks:

1. Define a discriminated, display-only visual journal item contract and strict client parser.
2. Project deterministic recipe or grocery pages from the authorized household with bounded cursor input, a total count, and one next cursor.
3. Add the authenticated no-store JSON batch endpoint and server-rendered `?page=N` prefix fallback; redirect unauthenticated document requests to sign-in and keep all private routes `noindex`.
4. Render responsive visual cards with no-referrer lazy images, fixed intrinsic dimensions, intentional missing/error fallbacks, recorded-only metadata, and independent recipe states.
5. Append batches through `IntersectionObserver`, deduplicate by item ID, expose an explicit Load more control, announce completion, and show a retryable error without discarding loaded cards.
6. Link recipe and grocery summary counts and household navigation to the new routes.
7. Test authorization, pagination bounds, deterministic ordering, no private leakage, interaction fallback, loading errors, and end-of-list behavior.

Verification:

- `npm run test:unit --workspace @hfj/web`
- `npx vitest run apps/server/src/http/web-view-model.test.ts apps/server/src/http/app.test.ts`
- `npm run typecheck`
- `npm run build`

### Milestone 3 - End-to-end verification, visual review, documentation, and screencast evidence

Files:

- `.dockerignore`
- `.gitignore`
- `deploy/scripts/materialize-credentials.test.mjs`
- `docs/product-specs/household-food-journal-server.md`
- `docs/product-specs/household-food-journal-client.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `packages/local-runner/src/host/process.ts`
- `packages/local-runner/src/host/process.test.ts`
- `tests/security/boundaries.test.ts`
- `artifacts/screencasts/agent-guides-and-visual-journals.mp4` when capture is supported

Tasks:

1. Update product IA, browser projection, privacy, host-label, and acceptance requirements.
2. Run desktop, mobile, keyboard, reduced-motion, no-JavaScript, and cross-tenant browser checks.
3. Compare rendered screenshots with the three internal concepts and record intentional differences.
4. Attempt the deterministic screencast helper and record the exact unsupported-environment reason if capture cannot run.
5. Run the doc-drift review, refresh generated knowledge only if required by the changed tree, and close the Beads issue when all gates pass.

Verification:

- `npm run test:e2e`
- `npm run capture:screencast -- --output artifacts/screencasts/agent-guides-and-visual-journals.mp4`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification

- Install and sign-in surfaces show recognizable ChatGPT, Claude, and Apple marks while keeping visible accessible labels.
- `/guides` and all four detail URLs render directly, and install/account/member/collection/household links target the relevant guide.
- An authorized household member sees recorded recipe and grocery cards and can load every bounded page through automatic scroll or the explicit control.
- A no-JavaScript browser can follow `?page=N` links to the equivalent larger prefix.
- Anonymous, removed, stale, and cross-household callers receive no private item data.
- Image requests use `no-referrer`; missing and failed images retain usable cards; fetch failures remain visible and retryable.
- `npm run test:e2e`, `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` pass.

Rollback is additive: remove the two household routes, JSON batch route, guide routes, contextual links, and view-model fields. No migration, Git document, journal mutation, or durable data conversion is involved.

## Outcomes & Retrospective

The release delivers branded ChatGPT, Claude, and Apple actions; five stable public guide URLs; contextual task links; and authenticated recipe and grocery browsers with deterministic 12-item continuation pages, automatic and explicit loading, strict parsing, deduplication, retry, end-state announcements, and non-JavaScript prefixes. Every continuation rechecks current membership and Git projection consistency. No migration, journal mutation, browser editor, semantic classifier, or agent-package release was added.

The WebKit matrix passed 47 applicable checks with 13 intentional project skips across desktop Safari, iPhone, 320-pixel, reduced-motion, and no-JavaScript projects. Focused and complete application runs passed 347 tests with 11 database-gated skips after fixing two harness failures found by the full gate: the repository scanner now ignores directory entries, and the local-runner process boundary consumes and rejects child-stdin `EPIPE` races. Direct screenshot comparison found the implemented hierarchy, editorial typography, responsive collapse, host marks, and image-card rhythm aligned with the concepts. Search, filters, derived count breakdowns, and decorative artwork were intentionally omitted; cards show recorded fields only, and offscreen cards use `content-visibility` until approached.

The screencast helper was attempted exactly as required. Homebrew FFmpeg 8.0.1 rejected its Linux-only `x11grab` input with exit code 234, so no MP4 exists and none is claimed. The static screenshots under `artifacts/playwright/` remain the visible evidence.

The release added `.dockerignore` before image creation, built and verified a `linux/amd64` OCI index at `sha256:12438a11fd79d455fd72222157cf0e0c76a9a0d701c0095712dca06abdb0b51b`, and transferred an archive with SHA-256 `8eb51ad0cb1782c43c0b6e21a65903e31a799a7ca9f07ef429c82181faebfaa3`. DigitalOcean staging now runs `hfj-staging:agent-guides-20260724-1-runtime`; live/readiness, schema `0007`, volume, signing, single-writer leadership, deployment smoke, MCP discovery, all guide detail routes, install markup, anonymous document redirect, and unauthenticated JSON denial pass. The rollback tag remains `hfj-staging:whole-grocery-20260722-1-runtime`, and `/etc/hfj/deploy.env.pre-agent-guides-20260724-1` preserves the prior non-secret deployment configuration.

Remaining risk is limited to authenticated live-household visual inspection with real journal image hosts; deterministic authorization, projection drift, cross-tenant, missing-image, external-image privacy, interaction, and browser tests cover the release boundary without using production household data.
