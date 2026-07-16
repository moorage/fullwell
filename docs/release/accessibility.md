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

## Manual

- Complete every flow using keyboard only; no focus trap, hidden action, hover-only content, or unexpected focus loss.
- Complete representative flows with VoiceOver in Safari on macOS and iPhone, plus one non-Apple screen-reader/browser pairing.
- Confirm one H1, useful landmarks, meaningful names, field instructions, error summaries, inline errors, status announcements, and focus placed at the error or new state.
- Confirm item checkboxes and recipe/snack select-all controls are independent, state is not communicated by color alone, external images have useful alt text/fallbacks, and icon-only controls have accessible names.
- Confirm `Join household` and `Import selected` are never conflated; role effects, public fields, expiration/revocation, destructive confirmation, partial success, and retry timing use plain language.
- Disable JavaScript and complete sign-in handoff, invite acceptance, collection selection, duplicate plan, and import confirmation to the extent specified by the server-rendered baseline.

Record defects with route, state, role, identity/pending-intent context, assistive technology, expected focus, actual focus, severity, and sanitized evidence. Critical or serious defects block release.

Still blocking: complete VoiceOver and keyboard-only journeys, 200 percent zoom, iPhone hardware Safari, long/error/partial-success states, and a non-Apple screen-reader/browser pairing. Automated axe results do not replace those manual checks.
