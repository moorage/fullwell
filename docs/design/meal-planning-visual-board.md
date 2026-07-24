# Meal-Planning Visual Recipe Board

Status: local static renderer implemented; browser evidence is part of the feature acceptance gate.

## Direction

The board is an image-forward private companion to the normal chat bullets. Its visual language is a bright kitchen notebook rather than a generic dashboard: warm paper, leafy green, tomato and saffron accents, restrained rules, a literary serif for recipe names, and a compact humanist sans serif for evidence and controls.

The artifact is a static `index.html` beneath Fullwell's private local view directory. It needs no Fullwell login, starts no server, and has no edit authority. Local-only and connected-cloud conversations can render the same already-authorized recommendation cards.

## Conversation handoff

The normal answer ends with:

> Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites.

- Decline: create no file.
- Accept: create one board from the exact recommendations already shown and attempt one supported permission-visible open.
- Confirmed open: `I opened the private recipe board in your browser.`
- Created but not confirmed open: return the local link/path and `If that link does not open here, say 'open the recipe board.'`

Creation and browser opening are separate states. The agent never reports the second from the first.

## Card anatomy

Each DOM-ordered list item contains:

1. a fixed-ratio HTTPS image with meaningful recipe-title alt text, or an attractive text fallback;
2. source label;
3. recipe title and recommendation reason;
4. Saved, Cooked, and Liked badges only when backed by journal state;
5. proposed meal slot;
6. text-plus-symbol compatibility state and caveat;
7. separate recipe and image-source links.

Cards never display raw allergy or sensitivity labels by default. A missing or unsafe image remains a fallback; the renderer never invents, downloads, proxies, or caches one.

## Responsive states

- 861 pixels and wider: three-column grid with generous page margins.
- 561 to 860 pixels: two columns.
- 320 to 560 pixels: one column, reduced page margin, and 190-pixel media height.
- Print: two columns without screen-only layout dependencies.

CSS Grid preserves DOM, keyboard, and screen-reader order. Focus uses a visible three-pixel outline. The board defines no animation; reduced-motion rules prevent inherited motion. Text and cards reflow rather than clip at 200 percent zoom.

## Privacy and active-content boundary

The board uses a meta CSP with `default-src 'none'`; only owned inline style and HTTPS images are allowed. Connections, objects, frames, media, forms, base changes, scripts, remote fonts, analytics, event handlers, service workers, and active SVG are absent.

Recipe and image URLs must be credential-free HTTPS. Images require an image-page provenance URL, use fixed dimensions, lazy loading, `crossorigin="anonymous"`, and `referrerpolicy="no-referrer"`. Source links open separately with `noopener noreferrer`. Visible copy explains that source sites still receive ordinary network metadata and recipe links may use existing site state.

All dynamic text is escaped. The local tool accepts no caller path, HTML, CSS, or browser option. Private directories use mode `0700`, files use `0600`, and symlink traversal fails closed.

## Durability and cleanup

The board ID is deterministic from an idempotency key. Its private manifest records the exact input fingerprint and HTML SHA-256 digest. Exact replay verifies the durable file; changed input with the same key conflicts.

The renderer bounds cards at 48, HTML at 1 MiB, the manifest at 64 KiB, retained complete boards at 20, and age at 30 days. A later successful create removes only non-current generated boards beyond those bounds and cleans crash-incomplete or integrity-failed directories. It never touches journal data and runs no background cleanup process.

## Acceptance views

Release evidence covers image and fallback cards, escaped malicious content, source behavior with live network blocked, DOM and keyboard order, accessible names, visible focus, reduced motion, 200 percent zoom, desktop, 390-by-844, and 320-by-568. Approved screenshots are recorded with redacted fixture recipes only.
