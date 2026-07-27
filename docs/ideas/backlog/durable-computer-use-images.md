# Durable Images from Computer-Use Collection

## Snapshot

- Status: `promoted`
- Priority lane: `now`
- Impact: `high`
- Confidence: `high`
- Effort: `medium`
- Last reviewed: `2026-07-27`
- Outcome: implemented locally under the completed ExecPlan; existing private records still require a separately authorized refresh

## Why this matters

Fullwell's visual journal can only display images that its journal records retain. Recipe and grocery contracts already have image fields, but the browser-audit instructions do not consistently require exact image capture. History-backed delivery dishes have no image fields at all, and the Takeout projection therefore discards images by construction. A successful local audit and cloud sync can consequently produce a complete textual index with no pictures.

## Current evidence

- `packages/contracts/src/domain.ts` gives recipes and groceries `image_url` and `image_page_url`, but omits both from `HistoryBackedDeliveryDishItemSchema`.
- `apps/server/src/http/web-view-model.ts` returns `imageUrl: null` and `imagePageUrl: null` for history-backed Takeout cards.
- `packages/agent-client/skills/track-recipe-history/SKILL.md` asks for displayed recipe images, while grocery and delivery audit skills do not make item-page image capture an explicit completion step.
- Bead `fullwell-dt7` records the live symptom: cloud journal items were valid but had no durable image URLs.

## Proposed direction

Use one provenance rule for every journal-authoring computer-use traversal: when the exact item or detail page visibly exposes a public HTTPS image, record the image URL and the exact page URL together. Apply it to groceries, recipes, and delivery dishes during initial collection and refresh/backfill. Missing, data/blob, credential-bearing, tracker-only, listing-thumbnail-only, or unprovable images remain `null`; they never block an otherwise complete audit.

Keep Git authoritative and use the existing revision-checked local and cloud mutations. Extend the history-backed delivery dish contract additively so old records parse with null image defaults, then carry recorded images through delivery cloud commits, public collection selection, and authenticated Takeout projection. Do not download or proxy image bytes and do not store screenshots, raw HTML, cookies, or browser state.

## Non-goals

- scraping private sites from the server or during page rendering
- uploading image binaries or browser screenshots
- treating an image as purchase, cooking, liking, ingredient, or food-safety evidence
- inventing decorative images when an exact item image is unavailable
- blocking a complete textual audit because a source has no usable image

## Priority and sequencing

Promote immediately. First make the shared delivery contract backward-compatible and prove exact cloud round trips. Then update local validation and every journal-authoring browser skill, add evals for capture and truthful fallback, and finally verify the authenticated web and collection surfaces. Existing items are refreshed through the same authorized source traversal and revision-checked mutation rather than a server-side crawl.

## Open questions

- Some signed-in order-detail pages may expose transient CDN URLs. The first implementation stores only URLs accepted by the existing safe-URL boundary and reports unavailable or rejected images as skipped.
- Background WhatsApp cart preparation is read-only and does not author journal items. This work applies to computer-use searches that learn or refresh journal content; it does not widen the runner's server authority.

## Promotion trigger

Promoted on `2026-07-27` after the user required every computer-use collection flow to retain image URLs and commit them to the cloud.
