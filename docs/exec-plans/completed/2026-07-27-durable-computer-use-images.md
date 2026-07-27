# Durable Images from Computer-Use Collection

## Purpose / Big Picture

When Fullwell learns groceries, recipes, or delivery dishes by navigating a user-authorized browser, it should retain any exact public image shown for the learned item and commit that image provenance with the journal record. After this change, newly audited and deliberately refreshed items can appear with pictures in the local journal, cloud household, authenticated visual journal, meal-planning references, and selected shared collections. Sources without a safe exact image remain useful text records with an honest fallback.

This closes a concrete contract gap: recipe and grocery items can carry image URLs but their collection instructions are inconsistent, while history-backed delivery dishes cannot carry image URLs and the Takeout projection forces them to null. Fullwell will store HTTPS references plus the exact source page, not image files, screenshots, raw pages, cookies, or browser state.

## Progress

- [x] 2026-07-27T14:35Z: Diagnosed the missing delivery pictures and expanded Bead `fullwell-dt7` to cover every journal-authoring computer-use collection flow.
- [x] 2026-07-27T14:48Z: Framed the feature with security, UX, architecture, reliability, and eval lenses and promoted the idea brief.
- [x] 2026-07-27T14:57Z: Completed the failure-oriented feature critique and tightened URL safety, old-record normalization, exact-page capture, and round-trip test requirements.
- [x] 2026-07-27T15:06Z: Milestone 1 added nullable, credential-free HTTPS image provenance to history-backed delivery dishes and preserved old local and Git records through null defaults.
- [x] 2026-07-27T15:12Z: Milestone 2 proved local and hosted commit round trips, Git projection, Takeout rendering, public-safe collection selection, and import retention.
- [x] 2026-07-27T15:17Z: Milestone 3 aligned grocery, recipe, and delivery browser-audit skills and added cross-host eval invariants for exact visible provenance and truthful fallback.
- [x] 2026-07-27T15:25Z: Milestone 4 completed documentation, security, coverage, browser, accessibility, build, and fixture-only H.264 visual evidence without accessing a live provider or household.

## Surprises & Discoveries

- 2026-07-27: The delivery cloud mutation uses the strict `HistoryBackedDeliveryDishItemSchema`, which has no image fields; an agent could not send delivery images even if a provider page exposed them.
- 2026-07-27: Imported shared delivery dishes already support image and page URLs, but history-backed Takeout cards explicitly return both as null. The public-import behavior is useful prior art, not a separate storage design.
- 2026-07-27: The local journal validates exact keys independently of the TypeScript contracts, so the additive delivery fields must land in the local runtime in the same milestone as the shared schema.
- 2026-07-27: The existing generic `SafeHttpUrlSchema` accepts HTTP and does not impose the credential-free image rule. Newly captured delivery images need the stricter existing `SafeHttpsUrlSchema`, while agent instructions must emit only credential-free HTTPS image and page URLs for every item type.
- 2026-07-27: Delivery commits are implemented by the general household service and exercised by the delivery-history test suite; there is no separate delivery-history service implementation.

## Decision Log

- 2026-07-27: Store references, not bytes. Continue the existing external-image architecture: safe URL, exact source page, no referrer in the browser, lazy loading, fixed dimensions, and local fallback.
- 2026-07-27: Apply the requirement to journal-authoring computer-use traversals: grocery purchase audits, recipe source audits, and delivery order audits, including explicit refresh/backfill. Restock and reorder cart preparation remain action-only and do not gain an unrelated journal mutation or widen the read-only WhatsApp runner.
- 2026-07-27: Make image capture best effort. The exact item/detail page must expose the image; unavailable or unsafe images remain null and do not make complete textual evidence incomplete.
- 2026-07-27: Add nullable defaults to history-backed delivery items rather than changing `FORMAT_VERSION`. Existing local JSON and Git Markdown remain readable and are rewritten only by an authorized revision-checked refresh.
- 2026-07-27: Never derive semantic identity from an image and never use listing thumbnails as purchase/order completeness evidence.
- 2026-07-27: A computer-use agent may follow the exact visible item/menu/detail link needed to capture an associated image, but it may not inspect hidden network traffic, scrape raw HTML, or broaden into unrelated image search. Image capture remains non-blocking.

## Context and Orientation

`packages/contracts/src/domain.ts` is the shared runtime contract for recipes, groceries, delivery evidence, and delivery dishes. `packages/contracts/src/tools.ts` makes `hfj_commit_delivery_index` accept strict history-backed delivery dishes, so extending that item schema carries the fields through the MCP boundary.

`packages/agent-client/runtime/local-household.mjs` independently validates the local guest household and exact item keys. `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, `packages/agent-client/skills/track-recipe-history/SKILL.md`, and `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md` govern authorized computer-use collection. Their eval matrix is `packages/agent-client/evals/cases/v1.json`, with deterministic assertions in `packages/agent-client/tests/evals/matrix.test.mjs`.

The central server commits delivery item Markdown through `apps/server/src/services/household-food-journal.ts`, with delivery-specific behavior exercised in `apps/server/src/services/delivery-history.test.ts`. It reconstructs Git state in `apps/server/src/domain/repository-projection.ts` and validates delivery evidence in `apps/server/src/domain/journal-validation.ts`. `apps/server/src/http/web-view-model.ts` produces authenticated Takeout cards. Collection projection and import also live in the general household service.

The authoritative behavior documents are `docs/product-specs/household-food-journal-client.md` and `docs/product-specs/household-food-journal-server.md`. The architecture already requires the browser to fetch external images directly with no referrer and forbids server-side semantic enrichment.

Assumptions:

- "All types of computer use searches" means every browser/computer-use traversal that learns or refreshes a Fullwell journal item. Pure cart preparation does not silently mutate the journal.
- The exact audited item/detail page is valid image-page provenance even when the image URL is hosted on a separate CDN origin.
- Existing safe HTTP URL parsing, browser CSP, no-referrer loading, and fallback behavior remain the security boundary.
- Newly captured image and image-page values must be credential-free HTTPS URLs; data/blob URLs and embedded credentials fail validation.
- No server or provider API fetch is introduced.

## Framing Notes

### Expert panel

- Security and privacy researcher - prevent private-page scraping, raw capture retention, credential leakage, and tracking expansion.
- Product and accessibility UX expert - make images appear from the normal audit while preserving useful fallbacks and source attribution.
- Staff architect - keep one additive Git-authoritative contract across local, MCP, repository, web, and sharing surfaces.
- Reliability engineer - protect old strict records, revision conflicts, retries, rollback, and partial image availability.
- Applied-ML and eval engineer - require agents to capture exact visible provenance without inventing URLs or treating images as semantic evidence.

### Synthesis for decomposition

The contract and compatibility change must precede agent instructions because a stricter skill cannot safely emit fields that local or cloud validators reject. Server round-trip and old-record tests belong in the first milestone so the shared union never narrows before its consumers. Agent behavior and evals follow only after both local and hosted paths accept the data. Visual and sharing verification completes the end-to-end proof.

### Feature critique

- Security/privacy - fragile assumption: a generic URL field is safe enough. Required change: parse new delivery image fields as credential-free HTTPS, require exact visible page association, and test rejection of HTTP, data/blob, credentials, screenshots, and hidden/raw capture.
- Reliability/compatibility - fragile assumption: TypeScript defaults alone repair old local records. Required change: normalize absent fields to null in the independent local validator and prove old JSON and Git Markdown round trips without a format bump.
- Architecture - fragile assumption: adding schema fields automatically reaches every consumer. Required change: prove the exact MCP commit, Git projection, collection allowlist, import, and Takeout view model round trip.
- UX/accessibility - fragile assumption: every provider exposes a usable image. Required change: make capture non-blocking, retain the established fallback, and report aggregate captured/preserved/skipped counts.
- Applied-ML/evals - fragile assumption: skill prose prevents invention. Required change: add explicit eval invariants for exact-page provenance, no image search broadening, no semantic inference, safe preservation, and cloud payload inclusion.

## Milestones

### Milestone 1 - Shared contract and compatibility foundation

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/contracts.test.ts`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`

Tasks:

1. Add nullable `image_url` and `image_page_url` to history-backed delivery dishes, with defaults that parse old local and Git records as null.
2. Require a credential-free HTTPS source-page URL whenever a non-null image URL is authored, without making either field mandatory when the provider exposes no usable image.
3. Extend the local exact-key validator and MCP schemas so local save, promotion staging, and hosted delivery payloads agree.
4. Prove 10,000-item delivery payload limits and the 16 MiB request boundary remain unchanged.

Verification:

- `npm run build --workspace @hfj/contracts`
- `npm run test:app -- --project contracts`
- `npm run test:packaging`

### Milestone 2 - Hosted round trip and visible consumers

Files:

- `apps/server/src/services/delivery-history.test.ts`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/journal-validation.test.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/web/src/components/visual-journal-feed.tsx`
- `apps/web/src/test/route.test.ts`

Tasks:

1. Prove connected audit and local promotion commits retain exact delivery image/page fields through Git serialization and repository reconstruction.
2. Render recorded history-backed delivery images in Takeout instead of forcing null.
3. Allow a deliberately selected history-backed delivery dish to carry its recorded public image and source page into a shared collection; retain the existing private-field allowlist.
4. Prove image provenance never exposes provider order, group, merchant, menu, actor, account, destination, cookie, screenshot, or raw-page data.

Verification:

- `npm run test:app -- --project server --project web`
- `npm run typecheck`

### Milestone 3 - Computer-use capture, refresh, and eval behavior

Files:

- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. During each exact grocery, recipe, or delivery item/detail traversal, inspect the visibly associated item image and record its credential-free HTTPS URL with the exact audited page URL.
2. Treat listing thumbnails as discovery only, never evidence or sufficient provenance. Reject HTTP, data/blob, credential-bearing, unrelated decorative, tracking-only, and unprovable URLs; do not inspect hidden network traffic or raw HTML.
3. On refresh/backfill, preserve a current valid image when the page exposes no better evidence, replace it only from newly audited exact provenance, and use ordinary expected revisions and idempotency.
4. Report aggregate captured, preserved, and skipped-image counts without printing private item names or URLs.
5. Add cross-host evals for available images, missing images, unsafe URLs, refresh/backfill, cloud commit, and no semantic inference.

Verification:

- `npm run test:evals`
- `npm run test:packaging`

### Milestone 4 - Product truth, end-to-end evidence, and completion

Files:

- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/release/verification-evidence.md`
- `artifacts/screencasts/durable-computer-use-images.mp4`

Tasks:

1. Document the common capture/provenance/fallback contract, delivery commit fields, privacy boundary, and refresh behavior.
2. Exercise logged-out protection and authenticated visual journal rendering on desktop and 320-pixel mobile fixtures with image success and failure.
3. Record a fixture-only screencast showing a recorded delivery image in Takeout and a truthful fallback card.
4. Review doc drift, refresh generated knowledge if the repository map changes, close Bead `fullwell-dt7`, and move this plan to `docs/exec-plans/completed/`.

Verification:

- `npx playwright test tests/e2e/web.spec.ts tests/e2e/accessibility.spec.ts --reporter=line`
- `npm run test:coverage`
- `npm run build`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification

- Every grocery, recipe, and delivery journal item learned or refreshed through authorized computer use includes a safe exact image URL and page provenance when the exact audited page exposes one.
- No-image and rejected-image sources still produce complete truthful text records and visible fallbacks.
- A local delivery record with images can be promoted through `hfj_commit_delivery_index`, reconstructed from Git, displayed in authenticated Takeout, selected into a public-safe collection, and imported without losing its image provenance.
- Existing delivery records without the new fields parse as null locally and centrally without a format bump or manual repair.
- Refresh and backfill use existing browser authorization, expected revisions, provider consent for hosted delivery history, and idempotency semantics.
- The server never fetches provider pages or image bytes. Journal data contains no screenshots, raw HTML, cookies, browser state, credentials, or hidden provider/account locators beyond the existing private delivery evidence contract.
- Exact commands:
  - `npm run build --workspace @hfj/contracts`
  - `npm run typecheck`
  - `npm run test:app -- --project contracts --project server --project web`
  - `npm run test:packaging`
  - `npm run test:evals`
  - `npx playwright test tests/e2e/web.spec.ts tests/e2e/accessibility.spec.ts --reporter=line`
  - `npm run test:coverage`
  - `npm run build`
  - `npm run verify`
  - `npm run verify:docs`
  - `npm run verify:execplan`

Rollback is application-compatible: revert the server/client behavior while leaving the additive image fields in Git. Older readers ignore or default missing fields, and no image bytes or external assets require deletion. Do not down-convert household repositories during rollback.

## Idempotence and Recovery

Image refresh is part of the existing revision-checked item write. Exact retries reuse the same idempotency key and payload. A changed image or page URL produces a new payload and must reread the current local revision or cloud HEAD/item revision before retry. A delivery promotion that becomes uncertain retains its existing provider key and target digest; it must not mark linkage complete until the server confirms the exact image-bearing payload. An image failure never rolls back already complete textual evidence.

## Outcomes & Retrospective

Fullwell now gives all three journal-authoring computer-use paths one image contract: capture a visibly associated, credential-free HTTPS image together with the exact audited page when available; otherwise retain truthful text and the established fallback. History-backed delivery dishes accept the same provenance locally and through `hfj_commit_delivery_index`, reconstruct from Git, render in Takeout, and survive deliberate public-safe collection selection and import. Old delivery records normalize the additive fields to null without a format bump or manual repair.

The standard screencast helper was attempted and failed with the known macOS `x11grab` limitation (FFmpeg exit 234). A deterministic Playwright-native fallback produced `artifacts/screencasts/durable-computer-use-images.mp4`, a 4.12-second, 1440x900 H.264 fixture recording that shows a recorded Wintermelon boba image beside truthful no-image fallbacks.

Release commit `13f82ca` is pushed. Public immutable `@fullwell/fullwell@1.1.17` is npm `latest`; its registry checksums byte-match the prepared 33-file artifact, and a clean registry download passes isolated Codex and Claude lifecycles.

DigitalOcean staging runs zero-production-vulnerability Linux/amd64 image `hfj-staging:durable-images-20260727-1-runtime` at OCI index digest `sha256:e2593a7145c71a64c0ae59135ef4c4b33d3d6b736da8f00a80fe5ad58b5dc287` and concrete amd64 manifest `sha256:6ae850bfd126ffcfb0282157ed4b365759f83c8a263729496203ba70c3762caa`, transferred as archive SHA-256 `97b45643255204c0bafc0a4e247fd89df45911a5ddd9c6b0dc3171302b09c991`. The first activation automatically restored the prior deployment after Docker 29 treated Apple's imported unqualified index tag as unavailable to Compose. Retagging through a Docker-normalized base reference made platform inspection and a bounded runtime canary pass before the successful retry.

Public readiness reports schema `0008`; deployment, MCP discovery, mounted-volume persistence, deployed release `1.1.17`, and permanent alias redirect checks pass. `/etc/hfj/deploy.env.pre-durable-images-20260727-1` and `hfj-staging:public-brand-20260727-1-runtime` retain rollback, and the transferred archive was removed after activation. Authenticated operator readiness, Git, volume, signing, schema, single-writer, backup, repository, and restore checks pass; aggregate operator status remains degraded by one incomplete mutation that predates the first restart and the previously known response-ready WhatsApp record with no online runner.

No live provider or private household was opened, and no existing record was backfilled or synced. Existing grocery, recipe, and delivery records gain images only when the user authorizes the corresponding browser audit or refresh; the server never crawls provider pages or downloads image bytes.
