# Safari Image Source Fallback

## Purpose / Big Picture

Fullwell recipe, grocery, and takeout audits must retain a safe image when an authorized Safari page visibly shows one even though macOS Computer Use exposes only accessibility text and screenshots, not DOM `img.src` attributes. After this fix, every journal-authoring audit will prefer an exact image URL exposed by a DOM-capable browser, then use Safari's ordinary context menu to open the same visible image in a temporary tab and read the address bar when DOM access is unavailable. Ambiguous, unsafe, or unavailable results remain truthful nulls and never block textual evidence.

This closes the concrete failure recorded in Bead `fullwell-3ou` and the scope correction in Bead `fullwell-ulg`: a Safari audit inspected recipe pages and committed 69 null image fields even though visible recipe images had credential-free HTTPS sources, and the same fallback must govern grocery and takeout image collection rather than remaining recipe-only.

## Progress

- [x] 2026-07-31T03:25Z: Reproduced the failure from the saved session and verified that Safari Computer Use returns an accessibility tree rather than DOM image attributes.
- [x] 2026-07-31T03:32Z: Added the bounded Safari context-menu fallback to the recipe-history skill, shared privacy reference, and normative client behavior.
- [x] 2026-07-31T03:34Z: Added deterministic eval coverage plus changelog and implementation-log entries.
- [x] 2026-07-31T03:36Z: Passed focused eval/package validation, full repository verification, documentation-drift review, and completion checks.
- [x] 2026-07-31T04:50Z: Extended the explicit fallback from recipes to grocery and takeout audit skills and normative product behavior.
- [x] 2026-07-31T04:51Z: Added grocery and takeout Safari eval cases and generalized the false-null prohibition across journal items.
- [x] 2026-07-31T04:52Z: Passed focused package/eval checks, documentation-drift review, and full repository verification.
- [x] 2026-07-31T05:24Z: Prepared immutable package version `1.1.28` across npm and both host catalogs for publication.

## Surprises & Discoveries

- 2026-07-30: The failed audit's extractor assigned `image_url: null` unconditionally and treated a missing accessibility-tree image node as proof that no image existed.
- 2026-07-30: The `Add image` label is an icon button's accessibility label and remains present when recipe images already exist; it is not an empty-gallery signal.
- 2026-07-30: Safari Computer Use has no DOM, HTML, network, or clipboard-read API. It can still expose an exact visible image URL through ordinary UI by opening that image in a temporary tab and reading the Safari address field.
- 2026-07-31: The focused eval caught that the revised skill shortened the established phrase `hidden network traffic`; restoring the exact stronger wording kept the cross-skill privacy assertion intact.

## Decision Log

- 2026-07-30: Keep DOM-capable exact-page inspection as the preferred path because it can read the visible image element's URL directly.
- 2026-07-30: When DOM access is unavailable, use only an ordinary context-menu action on the exact visible image, open the image in a temporary tab, read the credential-free HTTPS address, return to the exact audited page, and close the temporary tab.
- 2026-07-30: Fail closed when the image is not individually targetable, Safari does not expose an open-image action, the resulting address is not credential-free HTTPS, the action leaves the authorized page context ambiguously, or exact page association cannot be proven.
- 2026-07-30: Do not use screenshots, raw HTML, hidden network traffic, source guessing, clipboard contents, unrelated image search, or a listing thumbnail as a substitute.
- 2026-07-30: This is a narrow agent-instruction correction, so feature critique and a UI screencast are unnecessary; deterministic skill/eval evidence is the acceptance artifact and no private household page will be recorded.

## Context and Orientation

`packages/agent-client/skills/track-recipe-history/SKILL.md`, `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, and `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md` govern image provenance for Codex and Claude. The recipe skill now carries the explicit Safari fallback; the grocery and takeout skills still rely only on the shared reference and need the same workflow at their point of use.

`docs/product-specs/household-food-journal-client.md` is the normative client behavior. Section 5.4 defines recipe tracking, while the acceptance matrix near the end records stable user-visible expectations.

`packages/agent-client/evals/cases/v1.json`, `packages/agent-client/evals/expected/v1.json`, and `packages/agent-client/tests/evals/matrix.test.mjs` are the deterministic cross-host behavior contract. `packages/agent-client/CHANGELOG.md` and `docs/IMPLEMENTATION_LOG.md` record the shipped behavior change.

Assumptions:

- The exact visible recipe, product, or dish image is already within the user's authorized item/detail-page traversal.
- Opening the image itself in a temporary Safari tab is a read-only inspection of that exact visible element, not a new source scope or unrelated search.
- Safari may label the menu item differently by version. The agent must select only a currently exposed action whose visible meaning is to open that exact image in a new tab; it must not guess an unavailable action label.
- The image address may use a CDN origin different from the recipe page. That is valid only when the context-menu action proves the exact association and both URLs are credential-free HTTPS.
- Existing image/page pairs remain subject to the established preserve-on-refresh rule.

## Milestones

### Milestone 1 - Instruction and product contract

Files:

- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/audit-food-delivery-orders/SKILL.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `docs/product-specs/household-food-journal-client.md`

Tasks:

1. Specify DOM-capable image URL extraction as the preferred path in recipes, groceries, and takeout.
2. Specify the bounded Safari context-menu, temporary-tab, address-bar, return, and cleanup sequence when DOM access is unavailable in each owning skill.
3. Preserve exact recipe/product/dish page provenance, reject listing thumbnails, and keep the existing URL-safety, privacy, and non-blocking fallback rules in the shared reference.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`

### Milestone 2 - Evals and delivery records

Files:

- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`

Tasks:

1. Add Safari-without-DOM recipe, grocery, and takeout image cases that require the context-menu fallback and temporary-tab cleanup.
2. Forbid treating an accessibility-only omission or a page image control as proof that any journal item has no image.
3. Record the user-visible fix and exact validation evidence.

Verification:

- `npm run test:evals`
- `npm run build --workspace @fullwell/fullwell`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

## Acceptance / Verification

- A Safari recipe, grocery, or takeout audit with no DOM access attempts the exact visible-image context-menu fallback before recording a missing image.
- The fallback opens only the exact visible image in a temporary tab, reads a credential-free HTTPS address, retains the original recipe/product/dish page as `image_page_url`, returns to that exact page, and closes the temporary image tab.
- DOM-capable browser inspection remains preferred and does not invoke the Safari fallback unnecessarily.
- Unsafe, ambiguous, missing, or non-targetable images remain null without blocking complete textual evidence.
- Accessibility-tree omission and the `Add image` icon are never treated as proof that the page lacks images.
- No screenshot, raw HTML, hidden network traffic, clipboard content, unrelated search, or guessed URL enters the journal.
- Exact commands:
  - `npm run test:evals`
  - `npm run build --workspace @fullwell/fullwell`
  - `npm run verify`
  - `npm run verify:docs`
  - `npm run verify:execplan`

Rollback is documentation-only: revert the skill, spec, eval, and changelog changes. Existing journal records and image fields remain compatible because this change introduces no schema or stored-data migration.

## Outcomes & Retrospective

Recipe, grocery, and takeout audits now prefer supported visible-page DOM access and share one bounded Safari fallback when Computer Use cannot expose an image source. Each owning skill requires the exact visible image's currently exposed context-menu action, a temporary image tab, a credential-free HTTPS address read, preservation of the original recipe/product/dish page as provenance, return to the audited page, and temporary-tab cleanup. Accessibility-tree omissions and page image controls are explicitly insufficient evidence for a null image.

The shared privacy reference keeps the workflow inside the existing trust boundary: no raw HTML, hidden network traffic, retained screenshots, clipboard reads, guessed actions or URLs, unrelated image search, or listing/order-history thumbnail provenance. Unsafe or ambiguous cases remain null or preserve a prior valid pair without blocking textual evidence.

Verification passed:

- `npm run test:evals` - 14 tests passed with explicit Safari recipe, grocery, and takeout cases.
- `npm run build --workspace @fullwell/fullwell` - 9 skills, 43 tools, and 191 eval cases validated.
- `npm run verify` - sensitive-content scan, builds, lint, typecheck, unit tests, 425 application tests with 12 expected database-gated skips, ideas, docs, and ExecPlan checks passed.

The verified behavior is prepared as immutable `@fullwell/fullwell@1.1.28` for the Codex and Claude host catalogs. No household data, browser state, cloud journal, or server deployment changed. Rollback remains a source-only revert with no stored-data migration.
