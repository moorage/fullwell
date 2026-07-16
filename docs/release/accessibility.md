# Accessibility Release Review

Target: WCAG 2.2 AA for all supported public and authenticated flows.

## Automated

- Run axe on install, sign-in, invite preview/acceptance, public collection states, import plan/confirmation/result, household, members, collections, account, privacy, and terms.
- Run HTML validation, React accessibility lint, color-contrast assertions, and Playwright keyboard/focus checks.
- Verify at 320x568, 390x844, 1024x768, and 1440x900 with 200 percent zoom and reduced motion.

## Manual

- Complete every flow using keyboard only; no focus trap, hidden action, hover-only content, or unexpected focus loss.
- Complete representative flows with VoiceOver in Safari on macOS and iPhone, plus one non-Apple screen-reader/browser pairing.
- Confirm one H1, useful landmarks, meaningful names, field instructions, error summaries, inline errors, status announcements, and focus placed at the error or new state.
- Confirm item checkboxes and recipe/snack select-all controls are independent, state is not communicated by color alone, external images have useful alt text/fallbacks, and icon-only controls have accessible names.
- Confirm `Join household` and `Import selected` are never conflated; role effects, public fields, expiration/revocation, destructive confirmation, partial success, and retry timing use plain language.
- Disable JavaScript and complete sign-in handoff, invite acceptance, collection selection, duplicate plan, and import confirmation to the extent specified by the server-rendered baseline.

Record defects with route, state, role, identity/pending-intent context, assistive technology, expected focus, actual focus, severity, and sanitized evidence. Critical or serious defects block release.
