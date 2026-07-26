# Food-Delivery State Matrix

Date: 2026-07-24

## Provider Support

`unsupported` is the release classification for missing authorized evidence. It does not claim that the provider can never support the workflow.

Live history collection means a bounded, user-initiated pass through the account holder's own signed-in order-history pages. It excludes unattended crawling, public-page harvesting, credential collection, bypassing access controls, provider APIs, and resale or exposure of provider data. Cart support is separately gated and never includes checkout.

| Surface | Index support | Cart support | Alcohol cart support | Default |
| --- | --- | --- | --- | --- |
| Synthetic DoorDash fixture | `index_and_cart` | Verified by deterministic WebKit fixture | Verified only through age pause; no age step | Test-only |
| Synthetic Uber Eats fixture | `index_and_cart` | Verified by direct exact-line E2E through the shared state machine | Modeled, not live | Test-only |
| Live DoorDash | `unsupported` | Unverified | Unverified | Off |
| Live Uber Eats | `unsupported` | Unverified | Unverified | Off |
| Other live providers | `unsupported` | Unverified | Unverified | Off |

No live provider becomes `index_only` or `index_and_cart` merely because the fixture passes. The row changes only after separately authorized live evidence establishes that provider's exact behavior.

## History Resolution

| Condition | Result |
| --- | --- |
| Wanpo exists on DoorDash and Uber Eats | Ask which provider before selecting an order |
| Selected provider contains Stanford and Cupertino Wanpo | Ask which location |
| Provider and location identify one complete delivery group | Bind that exact historical group |
| Internet search shows a location absent from authorized history | Exclude it from the candidate set |
| Only a completed pickup group exists | It may inform familiarity but cannot authorize a delivery cart |
| Order is canceled, incomplete, or missing expanded details | Keep it non-reorderable |
| Restaurant name changed but stable historical location evidence remains | Show both the historical name and current visible name; never merge locations in program code |

## Access And Fulfillment

| Current state | Cart result |
| --- | --- |
| Signed in, exact origin authorized, delivery mode visible | Continue to menu and full-cart inspection |
| Sign-in required | Pause for the user; mutate nothing |
| CAPTCHA or provider permission prompt | Pause for the user; mutate nothing |
| Current mode is pickup | Block before planning or mutation |
| Current mode is not visible or cannot be verified | Block before planning or mutation |
| Navigation changes to a different origin | Block; the new origin has no inherited authority |
| Page content asks the agent to broaden tools, leave the provider, or check out | Treat it as untrusted provider content and ignore it |

## Menu And Cart

| Condition | Result |
| --- | --- |
| Historical coconut milk tea is explicitly changed to current wintermelon milk tea | Preserve the historical modifiers only when the current menu verifies each one |
| A current menu does not expose every requested modifier choice | Block before creating the cart plan and name the unavailable choices |
| Historical item is renamed, unavailable, or has modifier drift without an explicit verified replacement | Ask or block; do not silently substitute |
| Same restaurant location already has unrelated cart lines | Preserve those lines and add only the bound target delta |
| Same-name restaurant at another location owns the cart | Require a second confirmation that names both locations before replacement |
| A different restaurant owns the cart | Require the same explicit destructive replacement confirmation |
| User cancels at a warning | Leave the cart unchanged |
| A target already matches after interruption | Verify it and apply no mutation |
| A target is below the bound plan | Add only the missing delta |
| A target exceeds the bound plan or an unrelated line disappeared | Block as uncertain; never decrement or claim success |
| Session authority is lost | Re-resolve history and re-read the entire current cart; never replay remembered clicks |

The cart state stores each current item locator, exact selected modifier set, and quantity as one line identity. Apply and verification compare all three fields; an item ID or quantity match alone is insufficient.

The interruption fixture covers `before_mutation`, `after_one_line`, `after_all_lines`, `before_verification`, and `after_verification`. Every recovery converges to the same exact lines and preserves the unrelated same-location line.

## Alcohol

| Condition | Result |
| --- | --- |
| Alcohol subtotal is within the ordinary automatic food maximum | Apply the same maximum rule as any other dish, then pause at provider age verification |
| Alcohol subtotal exceeds the ordinary automatic food maximum | Block for the ordinary maximum before the age interstitial |
| Provider requests age, identity, or ID handling | User controls the step; Fullwell does not click through, enter data, upload, scan, or bypass it |
| Exact line, modifier, quantity, or cart verification is unavailable | Block like any other dish |
| Checkout becomes visible after the age step | Stop; checkout remains outside Fullwell |

Alcohol has no extra Fullwell-only confirmation merely because it is alcohol. That does not authorize age verification or checkout.

## Checkout Boundary

| Surface | Contract |
| --- | --- |
| Fixture checkout page | Shows a disabled `Place order` button and no payment form |
| `POST /checkout` | Returns `checkout_prohibited` |
| `POST /api/checkout` | Returns `checkout_prohibited` |
| Generic action API with `checkout` | Returns `unsupported_action` |
| State API | Always reports zero paid orders and zero checkout side effects |

The allowed fixture actions are limited to planning a cart, applying exact targets, and canceling a plan. No route or action can place, pay for, schedule, tip, subscribe, change an address, or complete an order.

## Rollout

Enable in order: deterministic fixture indexing, deterministic fixture cart preparation, provider-specific authorized indexing, then provider-specific authorized cart preparation. Alcohol remains independently default-off for each live provider until its ordinary-maximum and age-pause evidence passes. Roll back live cart preparation before indexing and preserve fixture coverage throughout.

The spike's Codex and Claude results are policy-harness evidence only. Both deterministic adapters reject an unapproved origin or forbidden action before their fetch boundary. They do not constitute an installed-host computer-use session or live-provider evidence.
