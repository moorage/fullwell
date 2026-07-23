# Local-agent grocery restocking with WhatsApp gateway

## Snapshot

- Status: `promoted`
- Priority lane: `next`
- Impact: `high`
- Confidence: `medium`
- Effort: `large`
- Last reviewed: `2026-07-23`

## Why this matters

The household's local Markdown journal records which foods it buys, how recently it bought them, how often they recur, and which stores supplied them. A request such as `We're out of cashews, get more` should let a locally running Codex or Claude session turn that evidence into one ordinary add-to-cart action without making the user repeat a brand, formulation, or store that the journal can resolve confidently.

The feature is trusted replenishment, not general product recommendation. It should prefer the household's demonstrated purchase behavior, ask only about real ambiguity in that history, and stop before checkout. Requests may arrive through host or operating-system dictation or through one Fullwell WhatsApp business number. The message server is only a gateway: it does not read journal files, rank products, invoke retailer APIs, or operate carts.

## Current evidence

- The user explicitly requested dictated restocking from Codex desktop and, where the same browser-control capability exists, Claude Cowork.
- The user clarified that Codex or Claude must read the household's Markdown files locally and perform the cart action with local computer use. The server may only act as a message gateway.
- Purchase evidence records the private store, order reference, exact line-item title, and order date. Snack items preserve brand, product line, flavor, formulation, format, and known size variants.
- The shared agent package already supports Codex and Claude from one skill source and requires an explicitly authorized, already-authenticated browser for grocery-history access.
- Existing identity rules keep cashew brands and formulations distinct while allowing package-size variants of the same product to combine.
- Meta's [official WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) is hosted by Meta and supports sending and receiving messages directly between a business's own system and WhatsApp. Direct integration requires a Meta business portfolio, WhatsApp Business Account, business phone number, system-user token, and webhook, but it does not require Twilio or another messaging middleware vendor.
- Meta's [Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/) does not charge for user-initiated service replies within the 24-hour customer-service window through 2026-09-30. Meta announced that service replies become billable on 2026-10-01, so this idea permits only pre-cutoff service replies and must automatically stop intake and replies before the paid policy begins.
- Selecting `Use a display name only` provisioned Fullwell an automatically verified Meta `+1 555` virtual identity. It is the connected WhatsApp Business Platform address, not a PSTN number, and it removes the need to register the Google Voice number.
- [Apple Messages for Business documentation](https://register.apple.com/resources/messages/messaging-documentation/) dated May 21, 2026 requires an Apple-approved Messaging Service Provider and a path to a live human agent. Those requirements conflict with the user's no-middleware constraint and this product's household-assistant scope, so an iMessage business channel is dropped from this idea.
- [Claude Code print mode](https://code.claude.com/docs/en/cli-usage) provides a supported non-interactive `claude -p` entry point, and [Claude Code with Chrome](https://code.claude.com/docs/en/chrome) exposes the signed-in browser to CLI sessions through the Claude in Chrome extension. A local runner can therefore invoke Claude Code in the household checkout without routing journal or browser data through Fullwell's server.
- [Claude Code Desktop local scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks) can run in a selected local folder while the machine is awake and the Desktop app is open. Anthropic cloud routines can be API-triggered, but run on Anthropic infrastructure and cannot operate the household's local browser, so they do not satisfy this workflow.
- [Claude Cowork scheduled tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork) and [Dispatch](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork) can use local files and computer use when Claude Desktop is awake and open. Anthropic does not document a public API that can inject a Fullwell WhatsApp webhook into a local Cowork task, so Cowork is not the primary gateway target unless that surface changes.
- The user requested a default USD 50 automatic cart-add maximum, a conversational way to change it, and a short maximum-change reminder after each verified addition. The current grocery profile already reaches both direct agent sessions and the read-only runner snapshot, so the preference does not require a new server or runner write authority.

## Expert panel

- UX expert - define when the original utterance is sufficient authorization and when a follow-up adds real value.
- Applied ML and evals expert - constrain agent reasoning to cited household history and make ambiguity behavior testable.
- Security researcher - bound gateway authority, local browser authority, retailer-page prompt injection, credentials, and purchase risk.
- Staff architect - keep message transport on the server and all journal reasoning and retailer side effects on the linked local device.
- Reliability engineer - handle offline devices, duplicate messages, duplicate cart changes, and observable completion states.

## What problem are we actually solving?

Reduce a routine pantry-restocking task to one natural request while keeping the selected product explainable from private household evidence and keeping all financially consequential actions under user control.

## Roundtable highlights

- UX: Treat `get more` as authorization to add one normal unit of one historically supported product to a cart. Ask a follow-up only when multiple plausible prior purchases differ on a decision-relevant field; never ask about variants found only in the retailer's catalog.
- Applied ML and evals: Use a closed candidate set built from journal items and cited purchase observations. Let the agent weigh recurrence and recency and explain ties; deterministic code may calculate dates and distinct-order counts but must not choose a food identity or preferred product.
- Security: Link each WhatsApp sender to a Fullwell account and local device through an authenticated, expiring ceremony. Use only an explicitly approved local browser that is already signed in. Never request credentials, reveal cookies, follow instructions embedded in retailer content, start a subscription, or proceed to checkout.
- Architecture: The server verifies Meta webhooks, deduplicates and routes opaque message envelopes, and relays responses. A linked local runner invokes Codex or Claude; the agent reads local Markdown and performs the cart action through local computer use.
- Reliability: The gateway reports an offline local runner instead of pretending work started. The local runner inspects the cart before mutation, avoids increasing an already-satisfied quantity on retry, inspects it after mutation, and returns an accurate terminal state.

## Key tensions

- Low friction versus accidental cart changes: the original restock request should authorize one cart addition, but not substitutions, unusual quantities, subscriptions, or checkout.
- Closed-world preference versus current availability: a retailer may not stock the exact prior product even though unrelated alternatives are abundant.
- Shared skill behavior versus host capability: Codex and Claude can share reasoning and safety rules, but their approved browser-control surfaces may differ.
- Household purchase history versus individual taste: recurrence supports `what this household tends to buy`; it does not by itself prove that a particular member likes the item.
- Gateway availability versus local authority: WhatsApp is always reachable, but no request can execute unless a linked local runner with the Markdown and authorized retailer browser is online.
- Privacy versus routing: Meta and the gateway necessarily handle message plaintext, but the gateway must not open household files or interpret the request.

## Proposed direction

Create one shared local restocking workflow for prompts such as `We're out of cashews, get more`, `Add our usual sparkling water`, or `Put two more boxes of that cereal in the cart`.

1. Accept direct dictation in Codex or Claude, or receive a user-initiated WhatsApp webhook through a direct Meta Cloud API integration owned by Fullwell.
2. At the gateway, verify Meta's webhook signature, validate the linked sender, deduplicate the provider message ID, attach only routing and expiry metadata, and forward the unchanged request to the sender's linked local runner over an authenticated outbound connection.
3. Do not load household journal data, call an LLM, classify the request, rank candidates, or access retailer state in the gateway.
4. At the local runner, resolve the active household from local configuration, compare its cached revision with the authoritative server Git HEAD, and refresh the local read-only restocking snapshot only when the revision changed.
5. Invoke the user's chosen Codex or Claude host with a fixed restocking instruction, request ID, and the exact user message as delimited untrusted data, using the restocking snapshot as the working directory. The initial Claude implementation should spawn `claude -p --chrome` directly with argument arrays and structured output; it must not interpolate the message into a shell command.
6. Read the snapshot's snack/profile/report Markdown and cited purchase-evidence JSON locally.
7. Search only those local files for the requested food. Compare historical candidates using exact identity fields, most recent purchase date, distinct-order recurrence, and observed stores. Do not broaden the preference candidate set with internet products.
8. When one historical candidate is clearly supported, choose it without a confirmation question. When plausible historical candidates remain, return one concise question through the gateway using only their actual distinguishing fields, such as `Salted or unsalted?` only when both formulations exist in local history.
9. Select the store associated with the chosen historical item. If store history remains genuinely ambiguous, ask only about the stores represented in that history.
10. Use local computer use with the user-approved, already-authenticated browser to open that retailer, inspect the current cart, and locate the exact historical item or a size-only equivalent of the same identity.
11. Treat an unqualified `get more` as one normal retail unit. Treat an explicit quantity as authoritative. Do not silently substitute a different brand, product line, flavor, formulation, or format.
12. If the exact identity is unavailable, offer only available products that also appear in the household history. Otherwise ask whether the user wants to choose a new product or cancel.
13. Add to cart but never check out, subscribe, accept a paid membership, replace another cart item, or change an unrelated quantity.
14. Re-read the cart and return the selected product, store, quantity, and final state through the same local-runner connection. A retry must recognize an already-completed request and cart state instead of duplicating the addition.
15. Relay WhatsApp responses only before 2026-10-01 while Meta classifies them as free service messages inside the open 24-hour window. Never send a paid template or out-of-window response. At or after the cutoff, acknowledge valid provider webhooks without enqueueing cart work and keep WhatsApp disabled until the user explicitly accepts a paid-message policy.
16. Default the grocery profile's automatic cart-add maximum to `USD 50.00`. Compare the complete incremental item amount for the requested quantity, not merely unit price. Add automatically only when that amount is strictly below the maximum; require exact item, quantity, and amount confirmation at or above it or when price or currency is unavailable.
17. Let the user change the maximum by asking Fullwell in a direct Codex or Claude conversation. Persist one canonical grocery-profile setting through the existing local or hosted profile authority. Keep the linked runner read-only and let it consume the updated profile on its next authoritative snapshot.
18. After a verified addition or idempotent recovery, report the exact item, quantity, and amount plus a brief parenthetical explaining that the maximum can be changed by saying `Set my cart maximum to $75`.

The server addition is a generic message gateway, not a restock-candidate MCP tool. It owns provider webhook verification, sender-to-account/device routing, replay protection, bounded encrypted queueing, delivery acknowledgements, and free-window enforcement. It must not receive filesystem paths, journal contents, retailer credentials, browser state, candidate products, or cart contents except the minimal user-facing response text returned for relay.

The local addition is a small runner plus a dedicated shared agent skill. On macOS, install the runner as a per-user `launchd` LaunchAgent so it starts at login, restarts after failure, runs inside the signed-in GUI session, and receives gateway work immediately without opening an inbound household-network port. A cron job that polls the gateway and invokes Claude Code in the checkout is an acceptable fallback, but it adds latency and is less reliable for Chrome-extension and keychain access. The runner tracks request lifecycle without making semantic decisions; the agent reads the Markdown and owns every product decision and computer-use action.

Claude Code is the primary Claude execution target because its non-interactive CLI and Chrome integration are documented. Claude Code Desktop local scheduled tasks are suitable for periodic maintenance but not necessary for event-driven WhatsApp delivery. Cowork Dispatch is a useful native alternative to WhatsApp for assigning work from the Claude mobile app, but Fullwell should not automate Cowork through undocumented UI control. Anthropic cloud/API routines are out of scope because they cannot reach the authoritative local checkout and signed-in retailer browser.

## Non-goals

- checking out, placing an order, scheduling delivery, starting subscriptions, or authorizing payment
- recommending novel products from the internet or treating retailer search results as evidence of user preference
- inferring that an individual likes a product solely because the household purchased it
- uploading journal Markdown, retailer credentials, session cookies, or a replica of cart contents to the message gateway
- building direct retailer integrations before an authenticated-browser spike proves they are needed
- adding a server-side LLM, semantic router, restock-candidate reader, retailer adapter, or cart worker
- using Twilio, another Business Solution Provider, or any middleware in front of Meta's Cloud API
- sending WhatsApp templates, business-initiated notifications, or any other message that Meta charges to deliver
- providing a personal Apple-ID Messages bot, an AppleScript relay on an always-on Mac, SMS, RCS, or Apple Messages for Business
- adding speech recognition; dictation remains a Codex, Claude, or operating-system input capability
- exposing a general-purpose remote Codex/Claude prompt, shell, broad filesystem access, unrelated MCP tools, or browser origins outside the approved retailer
- granting the linked WhatsApp runner profile-write authority or accepting an unbounded automatic-add maximum

## Priority and sequencing

Keep this in `next` until the version 1 release blockers in the active Household Food Journal ExecPlan are closed. It extends the local grocery evidence and cross-host skill surfaces, but it introduces a public messaging gateway, a linked local runner, and an external cart mutation boundary whose availability, terms, browser behavior, idempotency, privacy, and eval coverage need focused spikes before implementation.

Before implementation, Milestone 0 must prove direct WhatsApp Cloud API webhook and free service-message handling without a BSP; prove that a local runner can invoke each target host and use its computer-control surface; and validate one representative retailer flow with a fake storefront for deterministic tests and an authorized real account for manual evidence. The first implementation slice should prove local file reading and ambiguity evals before enabling any live cart mutation.

## Open questions

- Which retailer should be the first supported real-world cart, and do its current terms and authenticated web experience permit this automation?
- Can non-interactive `claude -p --chrome` reliably reconnect to the approved browser and complete a state-changing cart action under a `launchd` LaunchAgent without an unattended permission bypass?
- Which Codex automation interface provides the matching event-driven local invocation and structured-result contract?
- What should the gateway return when the linked runner is offline, and how long may an encrypted pending message remain queued?
- What evidence makes one prior variant clearly preferred when recency and recurrence point to different products?
- Are store preferences household-wide, member-specific, or both?
- Does the local journal need stable retailer product locators, or are exact historical line-item titles sufficient and safer?
- How should the agent distinguish a retailer sign-in block, item unavailability, cart conflict, browser-control failure, and an expired free WhatsApp reply window?
- What exact North America service-message rate will Meta publish for 2026-10-01, and does the user ever want a separately budgeted paid-channel plan after the automatic free-channel shutdown?
- Should a future release add an authenticated WhatsApp settings mutation, or should canonical preference changes remain in direct Fullwell conversations?

## Promotion trigger

Promoted on `2026-07-20` to `docs/exec-plans/active/2026-07-20-whatsapp-local-restocking.md`. Milestone 0 owns the direct no-BSP WhatsApp, free-window, local host, local snapshot, and add-and-verify feasibility gates before production implementation proceeds.
