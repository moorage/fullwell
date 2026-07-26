# Accessibility Release Review

Target: WCAG 2.2 AA for all supported public and authenticated flows.

## Automated

- Run axe on install, sign-in, invite preview/acceptance, public collection states, import plan/confirmation/result, household, members, collections, account, privacy, and terms.
- Run HTML validation, React accessibility lint, color-contrast assertions, and Playwright keyboard/focus checks.
- Verify at 320x568, 390x844, 1024x768, and 1440x900 with 200 percent zoom and reduced motion.

Current evidence, 2026-07-16:

- `npm run test:accessibility` passes six applicable checks with six deliberate project skips. Axe finds no WCAG 2.0/2.1/2.2 A/AA violations across five live public routes and nine production-SSR pending or authenticated screens in desktop WebKit, iPhone WebKit, and 320-pixel WebKit coverage.
- The matrix also asserts no horizontal overflow for every production-SSR screen at desktop and 320 CSS pixels, a working skip link, and the reduced-motion media contract.
- The first axe run found transient contrast failures while the page entrance animated from zero opacity. The animation now preserves full text opacity while retaining its short positional transition.
- Native macOS Safari exposes the install host selector as named toggle buttons with current state, updates the Codex/Claude instruction heading after activation, redirects anonymous `/account` access with the pending intent intact, and exposes labeled Apple, passkey, email, Terms, and Privacy controls through the accessibility tree.
- On macOS 26.5.1 with Safari 26.5, native page zoom was confirmed at exactly 200 percent through Safari's Page Menu. Install, sign-in, the long Privacy page, and the non-enumerating collection error state remained readable at the 1024x768 window without visible overlap or clipping; headings and controls remained coherent in the accessibility tree. Safari was restored to 100 percent after the review.
- Native keyboard traversal reaches install and sign-in form controls with `Tab` and links with Safari's `Option-Tab` convention. Activating `Skip to content` moved focus to the main-content container, and the install controls cycled without a trap or unexpected loss.

Takeout follow-on evidence, 2026-07-26:

- The authenticated Takeout route passes automated WCAG 2.0/2.1/2.2 A/AA analysis and horizontal-overflow checks at desktop and 320 CSS pixels.
- Desktop, iPhone, 320-pixel, and no-JavaScript WebKit preserve the ordinary `Load more takeout items` link, exact restaurant-location text, non-color fulfillment/alcohol labels, status announcements, and visible `Meal plans`/`Takeout` navigation. The narrow household navigation uses a three-column grid so the active Takeout tab does not begin offscreen.

## Manual

- Complete every flow using keyboard only; no focus trap, hidden action, hover-only content, or unexpected focus loss.
- Complete representative flows with VoiceOver in Safari on macOS and iPhone, plus one non-Apple screen-reader/browser pairing.
- Confirm one H1, useful landmarks, meaningful names, field instructions, error summaries, inline errors, status announcements, and focus placed at the error or new state.
- Confirm item checkboxes and recipe/snack select-all controls are independent, state is not communicated by color alone, external images have useful alt text/fallbacks, and icon-only controls have accessible names.
- Confirm `Join household` and `Import selected` are never conflated; role effects, public fields, expiration/revocation, destructive confirmation, partial success, and retry timing use plain language.
- Disable JavaScript and complete sign-in handoff, invite acceptance, collection selection, duplicate plan, and import confirmation to the extent specified by the server-rendered baseline.

Record defects with route, state, role, identity/pending-intent context, assistive technology, expected focus, actual focus, severity, and sanitized evidence. Critical or serious defects block release.

Still blocking: VoiceOver, authenticated invite/import/account keyboard journeys, authenticated and partial-success zoom states, iPhone hardware Safari, long authenticated states, and a non-Apple screen-reader/browser pairing. Automated axe results and the representative native checks do not replace those manual checks.
