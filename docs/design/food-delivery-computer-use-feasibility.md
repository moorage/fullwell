# Food-Delivery Computer-Use Feasibility

Date: 2026-07-24

## Decision

Proceed with the provider-neutral delivery contracts and later product surfaces. Treat delivery-history collection as bounded, user-directed browser assistance over the user's own signed-in account, comparable to the user opening their order history and recording what they bought. It is not a public-web crawler, unattended scraper, bulk data service, credential-sharing system, or provider-side integration.

The local fixture proves the proposed history, location, modifier, cart-target, recovery, and no-checkout state machine without accessing a real account. It does not prove that current live provider pages expose complete history, stable location evidence, exact modifiers, verifiable cart quantities, or a safely pausable age interstitial. Provider-specific support therefore remains `unsupported` until a separately authorized, private validation produces enough redacted evidence to update the support matrix. That evidence gate limits release claims; it does not block implementation of the provider-neutral journal, sharing, collection, meal-plan, or cart-preparation contracts.

Every live session must be initiated by the account holder, use an installed browser in which that person is already signed in, stay within the exact provider origin and requested history window, follow ordinary visible navigation, and stop for sign-in, MFA, CAPTCHA, age/identity, permission, or other provider controls. Fullwell never asks for credentials, bypasses controls, runs a background crawl, exposes the resulting catalog as a data service, or checks out.

## Fixture Evidence

The fixture contains invented data only. It runs one control origin and two provider origins:

- `http://127.0.0.1:4290` controls deterministic health, reset, scenarios, and history resolution;
- `http://127.0.0.1:4291` models DoorDash;
- `http://127.0.0.1:4292` models Uber Eats.

Playwright owns all three fixture listeners through one third `webServer` entry. The standalone spike uses separate ports and owns its child process so it cannot accidentally reuse an E2E instance.

The focused proof covers:

- Wanpo Stanford on both providers and Wanpo Cupertino on DoorDash;
- provider ambiguity before same-provider location ambiguity;
- completed delivery, completed pickup, canceled, and detail-incomplete history;
- historical modifiers, current modifier-choice validation, renamed or unavailable current menu entries, current item locators, and current prices;
- a two-line Stanford reorder that changes coconut milk tea to wintermelon milk tea while preserving modifiers and an unrelated same-location cart line;
- direct Uber Eats planning, exact line/modifier application, verification, and no-checkout rejection through the same provider-neutral state machine;
- exact recovery before mutation, after one line, after all lines, before verification, and after verification;
- pickup and unverifiable fulfillment modes that block before mutation;
- same-location cart preservation plus warnings for same-name/different-location and different-restaurant cart replacement;
- sign-in, CAPTCHA, prompt injection, cross-origin, age-verification, and checkout traps;
- alcohol evaluated by the ordinary food-subtotal maximum before pausing for user-controlled age verification; and
- disabled checkout UI plus rejected checkout routes and generic checkout actions.

The fixture exposes no payment, address, credential, cookie, account, or real order data. Its order IDs, restaurant locators, dishes, prices, account state, and provider pages are synthetic.

## Verification Results

Run:

```text
node scripts/spikes/verify-food-delivery-hosts.mjs --fake-provider
npm run test:e2e -- tests/e2e/food-delivery.spec.ts
```

On 2026-07-24 the spike passed exact-origin, cross-origin, structural no-checkout, and deterministic shared host-policy checks. Each adapter rejected cross-origin and checkout requests before its injected fetch boundary. The focused Playwright command passed the delivery matrix across desktop, mobile, narrow, and no-JavaScript WebKit projects.

The spike deliberately rejects invocation without `--fake-provider`. Its named Codex and Claude adapters exercise the same deterministic policy implementation because the product invariant is shared: receive a requested URL and typed capability, allow only configured origins and cart-preparation capabilities, and deny cross-origin, payment/checkout paths, shell, search, tool broadening, or embedded-provider instructions before any fetch. The Playwright proof—not the policy double—expands order lines and then each line's modifiers before reading them. The spike does not launch an installed host, browse a live provider, or prove either host's current permission UX; those claims belong only to the Milestone 6 authorized matrix.

## Provider Terms and Account Safety

Reviewed 2026-07-24:

- DoorDash's [consumer terms](https://help.doordash.com/en-ca/consumers/article/consumer-terms-and-conditions-us-english-section-1-11) restrict automated scraping and systematic retrieval. Its [termination terms](https://help.doordash.com/en-ca/consumers/article/consumer-terms-and-conditions-us-english-section-15-26) reserve suspension, termination, and other remedies. Fullwell therefore excludes unattended crawling, public-page harvesting, bypassing provider controls, and operation beyond the user's explicit personal-history request.
- DoorDash's [US privacy policy](https://help.doordash.com/en-ca/consumers/article/privacy-policy-united-states) describes retention based on service, legal, dispute, and recordkeeping needs rather than promising deletion on Fullwell origin revocation.
- Uber's [acceptable-use policy](https://www.uber.com/legal/en/document/?country=great-britain&lang=en&name=app-and-website-acceptable-use-policy) restricts robots, scrapers, and other automated tools used to obtain or monitor site content. Its [US terms](https://www.uber.com/legal/en/document/?country=united-states&lang=en&name=general-terms-of-use%5C) grant a revocable personal-use license. Fullwell applies the same bounded, user-directed, no-bypass boundary to Uber Eats.
- Uber's [US privacy portal](https://privacy.uber.com/us) is the authoritative starting point for access, deletion, and retention choices; Fullwell does not infer provider deletion from household-origin revocation.

These findings are policy evidence, not legal advice and not live capability evidence. They do not by themselves establish that a user may or may not delegate ordinary browser interactions over their own account. A future provider row requires authorized technical validation and release review. Grubhub and every user-named provider remain `unsupported` until independently validated.

## Evidence Still Required

Before changing a live provider from `unsupported`, a separately authorized interactive session must establish all of the following without committing private evidence:

- the exact HTTPS origin and signed-in account boundary;
- complete traversal of delivered order groups, hidden lines, modifiers, fulfillment mode, and restaurant location;
- explicit exclusion or blocking of canceled, incomplete, pickup, and unverifiable history;
- exact current menu, modifier, price, and full-cart re-reading;
- provider-specific behavior for same-location and destructive restaurant-cart replacement;
- all-phase interruption recovery without duplicate quantities or unrelated-line removal;
- sign-in, CAPTCHA, permission, cross-origin, and provider-instruction blocking;
- no checkout, payment, tip, address, schedule, membership, subscription, or age/identity automation; and
- for alcohol, ordinary maximum handling followed by a pause that leaves every age or identity step to the user.

Sanitized evidence may record only the date, provider label, tested capability, pass/fail result, and release classification. Credentials, cookies, account identifiers, delivery addresses, payment details, real order identifiers, restaurant history, dish history, screenshots, and browser captures remain outside Git.

## Release Consequence

Fixture behavior is sufficient to continue contract, journal, collection, meal-plan, and skill implementation. It is not evidence for a provider-specific release claim. Live DoorDash, Uber Eats, alcohol-cart, and additional-provider actions remain default-off until their independent rows in the state matrix are updated from an authorized user-directed session.
