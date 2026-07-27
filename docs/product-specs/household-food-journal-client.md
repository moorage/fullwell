# Household Food Journal Agent Client Specification

Status: Ready for implementation

Date: 2026-07-15

Companion specification: [Central Git Server](household-food-journal-server.md)

## 1. Purpose

Build one installable Household Food Journal client package that works in Codex and Claude Code/Cowork and connects each agent to the hosted Household Food Journal MCP service.

The client must make these jobs feel conversational:

- start or join a family household;
- audit snack and drink purchases;
- record saved, cooked, and liked recipes;
- collaborate safely with family members;
- create a collection of selected recipes and snacks;
- share that collection using one link through email, text, or any operating-system share target;
- let a recipient preview the collection, select only the items they want, create or choose a household, install the client for Codex or Claude, and import those selections.

The client is a local-first agent layer. It contains skills, manifests, MCP configuration, installation metadata, a dependency-free local guest-household runtime and stdio adapter, tests, and evals. It must not contain credentials, bundled household data, a programmatic report generator, or a background synchronization engine. Cloud households remain server-authoritative; one explicit local guest household may be authoritative on the current computer until the user chooses cloud promotion.

## 2. Product decisions

These decisions are normative for version 1.

1. The same skill source files serve both Codex and Claude. Host-specific manifests may differ.
2. The remote MCP service is the only mutation path for cloud household data. A guest may use one revisioned local household without an account.
3. The central server is the only Git writer. Clients never clone, pull, push, merge, or receive repository credentials. The local guest household is bounded JSON, not a Git clone or synchronization engine.
4. Agents make semantic food judgments. Programs must not classify foods, decide recipe identity, merge snack variants, or author reports.
5. The server may validate a submitted conclusion against its cited evidence, but it must not invent the conclusion.
6. Each person has an individual account. Family collaboration uses household membership, not a shared password or shared Apple identity.
7. Family invitations and shared collections are different concepts:
   - a family invitation grants ongoing household access after acceptance;
   - a collection link grants access only to an intentionally published snapshot and never grants household access.
8. A shared collection is a snapshot in version 1. Later edits do not silently change an already shared snapshot.
9. A recipient may preview a collection without installing a plugin or signing in. Import requires sign-in.
10. An imported recipe or snack is copied with provenance. It is not kept in live synchronization with the source household.
11. Google Drive is out of scope.

## 3. Success criteria

A first-time user who already has Codex or Claude installed must be able to:

1. install the client with one platform-specific action;
2. choose the `Set up Fullwell` starter or say `@Fullwell hi` in Codex, or say `Hi Fullwell` in Claude;
3. say whether they already have a Fullwell account;
4. continue locally without authentication, or complete browser authentication when they choose an existing account;
5. perform a useful grocery or recipe action without editing configuration files or handling tokens;
6. optionally create or connect an account later to back up the local journal and enable WhatsApp, sharing, or family access.

A recipient of a collection link must be able to:

1. open a readable mobile-friendly preview;
2. check individual recipes and snacks;
3. choose `Import selected`;
4. sign in or create an account;
5. create or choose a destination household;
6. complete the import;
7. select `Use with ChatGPT` or `Use with Claude` and receive the shortest supported installation path.

No successful path may ask a user to create an SSH key, copy an API token, edit JSON/TOML, share a password, or understand Git.

## 4. Users and roles

The client recognizes the server roles but does not independently enforce them.

| Role | Client behavior |
|---|---|
| Owner | May manage members, create and revoke family invitations, edit content, publish collections, export, and delete the household. |
| Editor | May edit content and publish collections. May not manage owners or delete the household. |
| Viewer | May read household content and reports. May copy selected content into another household where they have edit access. |
| Link visitor | May read only the published collection snapshot addressed by the link. Has no household visibility. |

If the server denies an operation, the client must explain the missing permission in plain language and offer only valid alternatives.

## 5. Core user journeys

### 5.1 Install, choose local or cloud, and begin

The public installation page must present two primary choices:

- `Use with ChatGPT`
- `Use with Claude`

Each choice must show its recognizable host mark beside the visible action name and one current, copyable install command or first-party installation action. The mark is decorative and never replaces the accessible text label. Public website copy calls the Codex-hosted option `ChatGPT`; commands, manifests, deep links, plugin selectors, and other installed host contracts retain their stable Codex identifiers. Do not show both platforms' implementation details at once. Include a fallback manual path behind `Having trouble?`.

The installed package declares one dependency-free local stdio MCP server and the remote Streamable HTTP MCP endpoint with no bearer token. The fresh first-run skill first calls only the read-only `fullwell_local_profile_load` tool. If no preferred name is remembered and the user has not already supplied one, its first question is exactly `What should I call you?` It saves that answer under `~/.codex/fullwell/local/profile.json` with a private revisioned write before loading a household, asking about an account, or using a protected cloud tool.

If the answer is yes, the first protected tool starts MCP OAuth. The service authorization page offers:

1. Continue with Apple;
2. use a passkey, when one already exists;
3. email a magic link.

After authentication, the agent calls `hfj_get_context`, then saves the remembered preferred name through `hfj_update_user_display_name`. If the user has no household and is not joining one through a pending family invitation, it calls `hfj_create_household` with the deterministic first-household name: `<NAME>'s Household`, or `<NAME>' Household` when the name ends in `s`. A pending family invitation or collection import resumes instead of creating an unrelated household.

If the answer is no, the agent initializes one guest household under `~/.codex/fullwell/local/household.json`, or the configured Codex home equivalent, through `fullwell_local_household_update` and starts grocery-history onboarding without a Fullwell cloud call. The host may ask once before allowing that named local write tool; a persisted tool approval remains scoped to its stable server/tool identity across compatible Fullwell upgrades and never grants arbitrary Node execution. A remembered local guest household resumes without asking the account question again. The document has a generated local identity, collecting/ready state, monotonically increasing revision, stable cloud-promotion idempotency key, atomic replacement, `0700` directories, and `0600` file mode. It is local journal authority, not a cloud backup, and another person with access to the same operating-system account may read it.

Guest initialization supplies the same deterministic first-household name returned by the local profile. The private profile and guest household have separate revisions and authority: changing the member name does not silently rename the household.

After either authority is available, the agent begins guided first run immediately. A cloud path reads onboarding state, both profiles, and the bounded item identity index once; a guest path reuses the local journal. While any section remains unresolved, it must not return a generic greeting, ask what is on the user's mind, ask what the user wants to set up, or present a groceries-versus-recipes menu. Before the first question for each section, including a resumed section, it briefly explains the practical benefit in friendly first-person language rather than referring to Fullwell as a separate assistant or to unexplained "snack setup" or "recipe setup." The internal `snacks` section is presented as one grocery-history pass in which the agent says it can learn snacks, ingredients, condiments, and other groceries. Its examples include "Restock cashews," "Buy a head of parsley," and "I need more mayo - not the Japanese one," using past orders to identify both the familiar product and usual store. It explains the default $50 automatic cart-add maximum: complete USD requests strictly below it may be added without another confirmation, while requests at or above it require confirmation. The agent says it can remember what the family saves, cooks, and likes to answer later questions such as "What was that pasta we loved?" or "What should we make again?" It then asks only for missing grocery source authorization and preferences needed for the audit, followed by missing recipe source meaning, authorization, and preferences.

The agent makes no intermediate Fullwell mutation. The cloud path checkpoints unconfirmed setup as versioned JSON under `~/.codex/fullwell/drafts/<fullwell-user-id>/<household-id>/onboarding.json`; every load must exactly match the authenticated Fullwell user ID, household ID, repository HEAD, and both onboarding revisions. The guest path saves the complete bounded local journal after every meaningful answer or collected occurrence. Both paths compare revisions and fail closed on stale, malformed, or conflicting writes.

Local files may contain only bounded source scope, completed-source cursors, typed food evidence, semantic decisions, profile edits, items, reports, section outcomes, and finalization metadata. They must not contain credentials, passwords, authorization headers, access or refresh tokens, cookies, browser state, screenshots, raw HTML, raw page captures, or one-time codes. A natural refusal, `not now`, `never mind`, or statement that no applicable sources exist records a bounded outcome and advances. Explicit cancellation may delete only an unfinished guest household after confirmation; it never deletes ready local data.

After both guest sections, the agent summarizes and finalizes the journal locally in first person, such as `I finished learning 42 grocery products and 17 recipes, and I saved what I found locally`, with actual counts and accurate skipped sections. When at least one evidence-backed grocery item was learned, the successful completion response asks the user to try an out-of-stock request such as `We're out of cashews; restock them.` It says `I'll use your shopping history` to identify the usual product and store, add complete requests strictly below the default $50 automatic cart-add maximum, and ask first at or above it. It omits this invitation after a failed, cancelled, unfinished, or no-grocery run rather than implying that restocking is ready. If the user accepts the try-it invitation before answering the optional cloud question, a verified direct-local add must resume that handoff: an unconnected guest receives `(P.S. You can use WhatsApp, collaborate, and share with others by connecting to Fullwell cloud.)` followed by `Would you like to connect now?` A recorded local cloud link, a cloud household, and linked WhatsApp work omit the redundant reminder. The same restocking invitation follows a successful hosted onboarding commit, never an uncertain result.

The guest completion response also asks whether to create or connect a Fullwell account for cloud backup. It explains that an account is needed for WhatsApp, sharing, and family access, not for direct local grocery or recipe use. A decline makes no hosted call. An affirmative answer starts OAuth, creates or selects a cloud household, reconciles local semantic identities against current cloud state, shows an exact copy/merge summary, and uses one `hfj_commit_onboarding` call after confirmation. Promotion uses the stable local idempotency key, records cloud linkage only after success, and retains the local journal. Failed or uncertain promotion leaves local authority unchanged.

Promotion first saves the remembered preferred name as the authenticated cloud display name. When there is no household and no pending household invitation to join, the first cloud household uses the profile's deterministic possessive name instead of asking for another title.

The final local document and hosted MCP request each accept up to 10,000 evidence records and 10,000 items within 16 MiB. A within-limit payload must not be split. `fullwell_local_household_load` remains read-only, ordinary local changes use the non-destructive `fullwell_local_household_update`, and confirmed whole-flow cancellation alone uses the separately destructive `fullwell_local_household_delete_collecting`. A dry read may return `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED` only when the current package proves that a recognized older delivery-journal format can be transformed into a completely valid document without guessing. The agent then invokes the non-destructive `repair_compatibility` update itself, reloads, and resumes without asking the user to understand or approve a local format-only update. The repair is locked, atomic, idempotent, and local-only. It may deterministically replace legacy delivery IDs and exact references, partition an item whose own exact evidence proves two restaurant display names, recalculate delivery-report summaries, and remove obsolete browser-label fields; it never invents food or location meaning. If the local server is unavailable, the client stops and asks for a plugin reload or reinstall; it never falls back to a version-specific shell command, edits the user's rules, or calls the hosted service without consent. Browser or website authorization remains a separate host boundary and may still require host approval.

The client must never ask the user to paste a token back into the conversation.

Supported hosts may dynamically register a native public client, repeat the MCP resource indicator during token exchange, and send the MCP initialized lifecycle notification without a request ID. The service must interoperate with those standards-compatible host behaviors without requiring host-specific secrets or configuration in the package.

### 5.2 Create or join a family

For a new household:

1. Use the deterministic preferred-name household title for a person's first unjoined household; later households may ask for a short name.
2. Create it with the current user as owner.
3. Complete or exit guided first run, unless the user asked specifically about family access.
4. Ask whether they want to invite another person now.
5. If yes, ask whether the person should be an editor or viewer.
6. Call `hfj_create_family_invite` and present the returned URL with `Share`, `Copy link`, `Email`, and `Text` options when the current surface supports them.

After a cloud household is created or connected, the chat may mention that an eligible owner can invite someone in chat. After cloud onboarding creates at least one item, the chat may also mention collections with an example such as `Make a Weeknight Favorites collection from the recipes we liked.` These are contextual next steps, not authority to create an invitation or collection.

The chat supports member and household renames without requiring the website. A member rename updates the revisioned local profile and, when connected, the account-scoped cloud display name. A household rename uses the local `rename_household` operation and, when connected, the owner-only `hfj_update_household_name` mutation at the exact Git HEAD. Local and cloud writes are independent; a partial result must identify which side changed. An owner can also rename a connected cloud household from its website overview: the edit control appears beside the title on hover or keyboard focus, remains visible on touch, and opens a dialog with the current name selected in an autofocus input. The public household-naming guide explains both entry points.

For an invite recipient:

1. Show the household name, inviter display name, requested role, and expiration before acceptance.
2. Authenticate the recipient as a distinct user.
3. Require an explicit `Join household` confirmation.
4. Call `hfj_accept_family_invite`.
5. Run `hfj_get_context` and show the newly available household.

Never accept an invitation automatically merely because the URL was opened.

### 5.3 Audit grocery purchases

Preserve the existing audit workflow, including shop selection, approved background browser, sign-in preflight, complete order expansion, exact line-item evidence, trailing date windows, and distinct-order counting.

The agent must:

1. load the household's grocery-history settings through the compatibility `snacks` profile;
2. ask which stores to inspect when the profile is absent;
3. ask which installed browser may be used in the background;
4. verify the user is signed in to every store before collecting any store;
5. inspect every qualifying order and expand all item lists;
6. capture an exact visibly associated credential-free HTTPS product image and exact page URL when available, then submit exact evidence with `hfj_append_evidence`;
7. classify every in-scope line as `snack`, `ingredient`, `condiment`, or `other_grocery` and make identity decisions itself;
8. submit item and report changes through `hfj_commit_change_set` with cited evidence IDs;
9. ask at the end of every update whether the user's shops have changed.

The browser traverses every qualifying order detail once and collects all grocery areas together. It authors or updates an evidence-backed item for every in-scope identity, including a one-off or otherwise below-threshold purchase. For each exact product row or visible exact product/detail link, it records the visibly associated credential-free HTTPS image plus the exact page URL when available. Listing thumbnails, hidden network traffic, raw HTML, unrelated image searches, HTTP/data/blob/credential-bearing URLs, and unproven decorative or tracking images are not provenance. A missing image never blocks complete textual evidence. Refresh preserves a prior valid image/page pair unless the newly inspected exact page proves a replacement. The recurrence threshold controls report assertions only and must not discard an item needed for a later source-aware request.

#### Grocery identity rules

Only collapse package-size or count differences. Keep separate rows when any of these differ:

- brand;
- product line;
- flavor;
- formulation;
- format;
- materially different produce variety.

Required examples:

- Golden sandwich cookies and classic sandwich cookies are separate.
- Every cereal is a separate pantry item.
- Cashews from different brands are separate; sizes of the same branded formulation may combine.
- Red bean, taro, sesame, lotus, and custard buns are separate.
- Bars, pints, and drinks are separate formats.
- Red and green grapes are separate pantry varieties.
- Fresh and dried parsley are separate formats.
- Standard and Japanese-style mayonnaise are separate formulations.

The agent counts distinct `(store, order identifier)` pairs. It does not sum quantities.

### 5.4 Track recipes

Preserve the existing evidence-first recipe workflow. The agent must:

1. load the authorized recipe source profile;
2. ask which websites, bookmarking services, notes, communications, and other sources the user authorizes;
3. for every website, ask whether the whole discoverable site or a specific subsection is in scope;
4. ask what presence in that scope means: discoverable, saved, cooked, liked, or another user-defined status;
5. check access and sign-in before collection;
6. append every occurrence, including duplicates and conflicts, as evidence;
7. resolve recipe identity itself;
8. keep Saved, Cooked, and Liked independent;
9. track every supported cooking date and preparation change;
10. use a visibly associated credential-free HTTPS image displayed by the exact audited recipe page and preserve both page and image provenance;
11. commit the resulting entry and index updates through `hfj_commit_change_set`;
12. ask at the end whether the places the user saves or discusses recipes have changed.

Do not infer liked from cooked, cooked from saved, or saved from mere discoverability.

### 5.4a Index and reuse food-delivery history

When food-delivery history is absent or the user asks to update it, Fullwell asks which provider sites they use and which installed browser is already signed in. DoorDash, Uber Eats, and other common providers are examples until an authorized current installed-host matrix records a support label. Fullwell follows a bounded history window through the same visible order-detail navigation the account holder could perform manually. It does not crawl public pages, run unattended, ask for credentials, bypass sign-in/MFA/CAPTCHA, or use undocumented provider interfaces.

For every completed order whose full line and modifier list can be exposed, record the exact provider, restaurant display name, human-readable location, private merchant locator, delivery or pickup mode, date, private order group, dish, modifiers, quantity, declared complete line count, and any visibly associated exact dish image/page provenance. The image pair belongs on the history-backed delivery dish and is included in local saves and `hfj_commit_delivery_index`. Listing thumbnails, hidden network traffic, raw HTML, unrelated image searches, and unsafe or unproven URLs are excluded. Missing images do not invalidate complete order evidence, and refresh preserves prior valid provenance unless the exact newly inspected dish/menu page proves a replacement. An incomplete, canceled, or hidden-line group is identified to the user but is not stored as canonical delivery evidence and cannot authorize reorder. Same-name locations stay separate unless exact provider/location evidence proves identity.

The local delivery index remains on the current computer unless the user chooses a household and approves a provider-specific preview explaining member visibility, retained modifiers/order dates/grouping, lack of per-provider erasure, and backup expiry after household deletion. After every successful local-only delivery audit that saved new or refreshed history, the completion response briefly explains household collaboration, shared collections, and shared meal plans, then explicitly asks whether to connect and sync or sync to the already-linked household. Interpret clear contextual responses such as `yes`, `sync it`, or `go ahead` conversationally; never demand scripted confirmation text or use deterministic keyword matching. Ambiguous intent gets one natural clarification, while decline or silence makes no remote call. Acceptance starts household resolution and the separate provider-by-provider visibility preview; after that preview, another clear contextual affirmative authorizes its provider's boolean confirmation and write. Omit the offer when the same audit already committed the selected history or when the run failed, was cancelled, remained unfinished, or saved no new evidence. Commit one provider per idempotent cloud mutation; a failed or uncertain result leaves local authority and linkage unchanged.

If delivery sync encounters the dedicated local compatibility-required signal, Fullwell repairs the recognized older local format, reloads, rebuilds the provider payload from the repaired revision, and continues the already-requested workflow. It says only that it updated the saved delivery history and is continuing. It never leaves an ordinary user with connector, schema, validation, malformed-ID, migration-operation, or future-product-fix language. The repair makes no hosted call, does not change food meaning, and does not replace provider visibility consent. Unrelated corruption and privacy or concurrency failures never trigger repair.

A delivery dish may be deliberately selected for a shared collection. Publish only the dish plus public restaurant/location and provenance fields; never publish order/group/menu/merchant locators, dates, recurrence, account data, or reorder authority. Import creates a public `shared dish` provenance record only. Local and cloud meal plans may cite the exact current dish revision as `ordered before` or `shared dish`, but neither means Liked or proves ingredient compatibility.

Connected household members may browse current delivery dishes in the authenticated website's `Takeout` tab and from `Journal at a glance`. Cards keep same-name restaurant locations separate and show only the dish, public restaurant/location, ordered-before or shared-dish provenance, provider label, recorded fulfillment modes, bounded prior-order summary, recent modifiers, public image provenance, and food/alcohol classification. The browser UI is read-only and instructs the member to ask Fullwell in chat for reorder or previous-order cart preparation; it never exposes provider locators or grants checkout authority. The household navigation labels the established weekly route `Meal plans`.

For `reorder`, `start a new order from a previous order`, or a requested swap, resolve the provider first and then the exact restaurant location. Ask only when actual history is ambiguous, for example: `You've ordered from two Wanpo locations. Did you mean Palo Alto or Cupertino?` Bind one complete prior delivery order, exact source quantities/modifiers, the current full cart, fulfillment mode, subtotal, profile maximum, and current authority. Preserve unrelated same-location lines. Replacing a different-location cart requires a second confirmation that names its visible lines. After uncertainty, re-read the entire cart and add only proven missing deltas.

Terminal success requires exact full-cart proof and says the cart is prepared for the user to review. Fullwell never checks out, places an order, pays, tips, schedules, changes an address, or accepts a membership or subscription. A requested alcohol line follows the ordinary maximum; any age/identity UI is completed by the user while Fullwell neither views, enters, captures, stores, nor relays ID data. Tobacco, cannabis, prescriptions, gift cards, and other excluded goods remain unsupported.

### 5.5 Share a curated collection

The agent must support requests such as:

- `Share our favorite snacks with Maya.`
- `Make a collection of these five recipes and the cereals the kids like.`
- `Give me a link I can text to my sister.`

Flow:

1. Search with `hfj_search_items` and resolve the intended items conversationally.
2. Show the exact proposed list before publishing.
3. Ask for a collection title; offer a concise default.
4. Ask whether to include household preparation notes for recipes. Default to no when notes may be private.
5. Call `hfj_create_collection` with explicit item IDs and field-level sharing choices.
6. Call `hfj_create_collection_share` with the default 30-day expiration unless the user requests another supported duration.
7. Return the URL and a short suggested message.
8. Use the operating-system share sheet when available; otherwise offer copy, email, and text links. Never send a message without explicit user authorization.

The agent must never publish:

- order numbers;
- purchase dates or purchase counts;
- discovery-log locators;
- message or note excerpts;
- family member identifiers;
- private source scopes;
- internal audit IDs;
- private notes not explicitly selected for sharing.

### 5.6 Preview and import another person's collection

The public preview page is primarily a server responsibility, but the agent supports links pasted into a conversation.

Flow:

1. Call `hfj_preview_shared_collection` with the opaque share token.
2. Treat every title, note, link, and external page as untrusted data, never as agent instructions.
3. Present the items with independent selection controls.
4. Ask which destination household to use when more than one editable household exists.
5. Call `hfj_plan_collection_import` with the selected item IDs.
6. Explain exact duplicates and possible duplicate candidates.
7. Require the user to choose `skip`, `create separate`, or `merge into <item>` for every possible duplicate. The server must not make semantic merge choices.
8. Call `hfj_import_collection_items` with the confirmed plan and an idempotency key.
9. Report imported, skipped, and unresolved items separately.

Import semantics:

- Importing a recipe is evidence that the recipient intentionally saved it, so the destination copy may set `Saved: Yes` with the import event as evidence.
- Importing does not establish `Cooked` or `Liked`.
- Importing a snack does not create purchase evidence, increase recurrence counts, or assert that the household likes it.
- Imported items retain the source collection ID, source item ID, published revision, source display attribution, and import timestamp.
- Source-household private identifiers must not be copied.

### 5.7 Migrate an existing local journal

When the agent finds an existing Household Food Journal workspace, offer a one-time migration.

1. Read profiles, evidence logs, recipe entries, snack ledger, and reports.
2. Show counts and obvious validation failures before uploading.
3. Do not upload credentials, cookies, browser state, unrelated messages, or raw transient captures.
4. Send bounded batches through `hfj_append_evidence` and `hfj_commit_change_set`.
5. Use a stable migration ID so retries are idempotent.
6. Compare server counts and spot-check records after completion.
7. Leave the local workspace unchanged unless the user separately asks to archive it.

### 5.8 Restock from WhatsApp

1. Install and connect one Fullwell local runner to one household, choose Codex or Claude Code, and approve one retailer origin directly in the host/browser. Codex uses a dedicated trusted project, a separate `CODEX_HOME`, and a keyring-backed login rather than the user's general host configuration.
2. Grant exact `journal:read` and `runner:messages` OAuth scopes. Secrets remain in Keychain; no token is copied.
3. From Account, create a ten-minute WhatsApp link, send the prefilled link text, and return to the same recent browser session to confirm the pending connection.
4. Send a restocking request such as `We're out of cashews, get more`, `Buy a head of parsley`, or `I need more mayo - not the Japanese one`. The server routes it without reading household grocery files or choosing a product.
5. The local agent validates and retains the complete current restocking snapshot, then gives the host the profile, recurring report, and every grocery item record with its purchase-evidence citations. Raw evidence files are not duplicated into the model prompt because item records already carry exact product/store provenance and the report carries evidence-backed recurrence conclusions. The host considers only products/stores supported by those citations; retailer search can establish availability, not preference. A fresh runner process makes one recovery claim so a request whose bounded lease attempts were exhausted by an older incompatible runtime resumes automatically after repair; the process cannot repeat that reset during its normal retry loop.
6. If one plausible historical candidate remains, inspect its exact price, currency, requested quantity, and the `profiles/snacks.md` automatic cart-add maximum. A missing setting means `USD 50.00`; `USD 0.00` disables automatic additions; direct assistant conversations may set an explicit USD maximum through `USD 10,000.00` while preserving all other profile text. The linked runner reads but never writes this setting.
7. Add without another confirmation only when the complete requested incremental item amount, including displayed item discounts, is in USD and strictly below the maximum. Exactly equal or greater amounts require confirmation bound to that active request's exact item, quantity, currency, and displayed amount. Missing or non-USD pricing blocks safely. Taxes, delivery, tips, memberships, subscriptions, and checkout fees are never part of cart-add authority.
8. Before changing the cart, recheck the current grant, membership, device/link state, Git HEAD, cart quantity, currency, and price. Persist the baseline, target, price decision, authorization mode, and bounded terminal message. Act once and re-read the quantity. An automatic amount no longer below the maximum or a confirmed amount that increased requires another user decision and no mutation.
9. Return `completed`, `needs_input`, `blocked`, or `cancelled`. Every verified addition or idempotent recovery names the exact item, quantity added, and current incremental amount and includes `(P.S. You can change your automatic cart-add maximum by saying, "Set my cart maximum to $75.")`. Questions and non-success results omit the reminder. For direct local use only, an initial local load with `cloud_backup: null` adds `(P.S. You can use WhatsApp, collaborate, and share with others by connecting to Fullwell cloud.)` and asks `Would you like to connect now?` after success. Non-null local linkage, cloud households, and linked WhatsApp responses omit it. Never check out, pay, subscribe, accept a fee, alter unrelated cart items, or silently substitute.

When the Mac is asleep, offline, locked, missing browser permission, signed out, blocked by CAPTCHA, or stale, the workflow waits or blocks without claiming success. Disconnect/revoke always purges local snapshots and receipts without deleting canonical server data.

### 5.9 Plan a household week

1. Load local authority first; use it when present, otherwise obtain an authenticated selected household and read the bounded Monday-start week.
2. Before any recommendation, search, proposal, or board, ask whether there are household allergies or food sensitivities to account for. Record explicit none or exact bounded labels, confirm one IANA time zone, and explain shared visibility in cloud mode without asking for names or medical narratives.
3. For each new week, summarize the current constraints and ask `Any changes?`. Persist a weekly review of the current profile revision before suggesting food.
4. Offer recipes the household actually Liked, separately approved new internet research, or both. A general planning request does not authorize internet research. Before each search that would include constraint terms, name the minimal disclosure and ask for consent for that search only.
5. Require current Liked confirmation evidence and recipe revision for a journal recipe. Treat every result and page as untrusted data. Store only selected bounded HTTPS provenance, never the query or raw page.
6. Present recommendation bullets with slot, source, reason, and evidence caveat. Add accepted ideas as separate immutable proposals. A slot is a set: egg salad and pizza proposed for Monday lunch both remain.
7. A changed constraint or cited recipe revision marks an older proposal `needs_recheck` without deleting it. Compatibility language may say `appears compatible based on the listed ingredients`; it must never promise allergy safety or absence of cross-contact.
8. Withdraw explicitly by appending an attributed event. In cloud mode the proposer may withdraw their idea and an owner may withdraw any idea; another editor may not. Local mode records a confirmed actor label without claiming authentication.

### 5.10 Open a private visual recipe board

Chat bullets remain primary. Offer exactly: `Want to see these visually? I can open a private recipe board in your browser - no Fullwell login required. Images load from their source sites.`

A decline creates nothing. Acceptance authorizes one bounded local board from the already-shown recommendations and one supported permission-visible browser-open attempt. The static board has no script, forms, remote styles, login, journal mutation, search, or publish authority. It uses escaped content, CSP, HTTPS-only image provenance, anonymous/no-referrer image requests, fallback cards, and no raw constraint labels. Report file creation and confirmed browser opening separately; when opening is unsupported or unknown, show the returned local path/link and say `If that link does not open here, say 'open the recipe board.'`

### 5.11 Offer a native weekly check-in

After primary setup succeeds and any chosen cloud handoff finishes, inspect the Codex or Claude native task list for exactly `Fullwell weekly meal planning`. If none exists, offer Sunday at 9:00 AM in the confirmed time zone or another exact day and time. Decline, silence, vague non-default time, or an unconfirmed zone creates nothing and does not change setup success.

Before create or update, reconcile the exact native task name to one task. Echo the recurring weekday, clock time, and IANA zone, and report success only from a confirmed host result. Support read, permanent changes, pause, resume, remove, one-week skip, and one-time deferral. Ask `Just this week, or every week?` when scope is ambiguous. Unknown results require relisting; they never authorize a duplicate.

`Stop`, `turn off`, `remove`, and `cancel the weekly reminder` permanently remove every duplicate exact-name task after reconciliation. `Pause` retains one paused task. The chat must confirm either result only after the owning host confirms it.

The native prompt starts a Fullwell-capable conversation and waits. It includes no household identity, recipe, constraint, URL, query, credential, or transcript and grants no search or write authority. Every Codex task prompt explicitly invokes `$plan-household-meals`, including a task attached to the current chat; Claude explicitly routes the task to the same shared skill. Codex uses the current chat when supported; a local-only Claude household uses a local Desktop task with directory access; remote Claude tasks are limited to authenticated cloud capability. Fullwell stores no scheduler state and adds no MCP scheduler, cron, launchd job, calendar event, worker, email, WhatsApp, or push fallback. Missed runs create no backlog storm, and local wall-clock time remains stable through daylight-saving transitions.

Before uninstalling or rolling back the scheduling guidance, pause or remove the exact task through the owning Codex task list, Claude Desktop task list, or Claude remote-task list. If that host cannot confirm the result, report the remaining host-owned task and the exact cleanup still required; never claim removal from Fullwell state. Fullwell cannot guarantee a run while the selected host, device, app, project context, or authorized local/cloud data is unavailable.

## 6. Package architecture

Use this target layout unless current platform validation requires a narrowly documented adjustment:

```text
repo-root/
|-- .agents/plugins/marketplace.json
|-- .claude-plugin/marketplace.json
`-- packages/agent-client/
    |-- .codex-plugin/
    |   `-- plugin.json
    |-- .claude-plugin/
    |   `-- plugin.json
    |-- .mcp.json
    |-- codex-mcp.json
    |-- skills/
    |-- references/
    |-- evals/
    |-- tests/
    |-- README.md
    `-- CHANGELOG.md
```

The marketplace catalogs live at the repository paths discovered by their hosts: `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude. Both catalogs must reference the same immutable published npm package version. Codex and Claude expose the public selector `fullwell@fullwell`; both adapters use the same `@fullwell/fullwell` package and `household-food-journal` MCP service. Publishing the npm payload does not publish either host catalog; public catalog discovery requires a separately published repository or catalog source. The installed package contains the host manifests and shared implementation:

```text
packages/agent-client/
|-- .codex-plugin/
|   `-- plugin.json
|-- .claude-plugin/
|   `-- plugin.json
|-- .mcp.json
|-- codex-mcp.json
|-- runtime/
|   |-- local-household.mjs
|   |-- local-household-mcp.mjs
|   |-- local-profile.mjs
|   `-- local-runner-control.mjs
|-- skills/
|   |-- manage-household-food-journal/
|   |   `-- SKILL.md
|   |-- audit-grocery-purchases/
|   |   `-- SKILL.md
|   |-- audit-food-delivery-orders/
|   |   `-- SKILL.md
|   |-- reorder-food-delivery/
|   |   `-- SKILL.md
|   |-- track-recipe-history/
|   |   `-- SKILL.md
|   |-- share-food-collection/
|   |   `-- SKILL.md
|   `-- import-food-collection/
|       `-- SKILL.md
|-- references/
|   |-- food-delivery-and-cart-safety.md
|   |-- mcp-tool-contract.md
|   |-- privacy-and-sharing.md
|   `-- semantic-food-rules.md
|-- evals/
|   |-- cases/
|   `-- expected/
|-- tests/
|-- README.md
`-- CHANGELOG.md
```

The two host manifests and marketplace catalogs are packaging adapters. They must resolve to the same `skills/` directory, stable local MCP server/tool identities, and remote MCP URL. Codex uses `codex-mcp.json` for its plugin-root working directory; Claude uses `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` because it ignores that working-directory field. These files may differ only in host path resolution and must start the same packaged server. Do not fork the skill instructions by host.

Each `SKILL.md` must have only `name` and `description` in YAML frontmatter so the shared files satisfy both hosts. Keep each skill under 500 lines and link directly to relevant reference files rather than duplicating large contracts.

The MCP config contains only the stable dependency-free `fullwell-local` stdio declaration and the public HTTPS cloud URL. The local server resolves `${CLAUDE_PLUGIN_ROOT}/runtime/local-household-mcp.mjs` to the installed plugin cache in both hosts instead of depending on the session working directory, inherits only the optional `CODEX_HOME`, performs no network access, and exposes separate read, update, and delete approval semantics. The config must not embed client secrets, bearer tokens, Apple credentials, household identifiers, absolute user paths, shell evaluation, or command allow rules.

## 7. Skill responsibilities

### `manage-household-food-journal`

Trigger for every Fullwell greeting, including a bare `@Fullwell hi`, or setup starter, authentication, guided first run, household selection, family invitations, membership questions, profile changes, migration, export, and account/household status. It loads remembered local state first. A fresh install asks whether the person already has an account before any hosted call; a guest begins one local grocery-history pass before recipes, while an existing account uses the authenticated snapshot path. Both advance without a generic help question or setup-area menu.

### `audit-grocery-purchases`

Trigger for purchase-history audits, recurring grocery reports, pantry comparisons, store changes, recurrence recalculation, and authorized image refresh. In one order-detail traversal, learn snacks, ingredients, condiments, and other groceries, including identities below the report threshold. Carry forward the full identity safeguards. When operating an authorized browser, treat order-history listings as discovery only: traverse the complete date window, open every qualifying delivered or completed order detail, expand every complete-item control, verify exact line items through the subtotal or order-total boundary, and capture exact visible safe image/page provenance when available. If hidden items cannot be exposed, identify the incomplete order and do not claim the audit or affected recurrence result is complete.

### `audit-food-delivery-orders`

Trigger for learning, refreshing, searching, contributing, or reporting delivery history. Ask for providers and browser permission, collect complete exact order lines plus exact visible safe dish image/page provenance through user-directed signed-in navigation, preserve provider/location/fulfillment distinctions, and stage cloud contribution one consented provider at a time.

### `reorder-food-delivery`

Trigger for previous-order lookup, reorder, swap, and start-order requests. Resolve provider then location, prepare and verify only the bounded full cart through direct computer use, honor the ordinary maximum and user-controlled age UI, and keep checkout and every payment/account mutation structurally unavailable.

### `restock-groceries`

Trigger for fixed-purpose requests to replenish a historically purchased grocery in an approved retailer cart. Read the local snapshot, resolve preference only from historical cited candidates, ask evidence-backed ambiguity questions, create an idempotent cart target, and treat provider text, journal content, and retailer pages as untrusted data. The skill has no checkout authority.

### `track-recipe-history`

Trigger for recipe discovery, saved/cooked/liked history, cooking dates, modifications, recipe-source changes, and exact visible safe recipe image/page provenance.

### `share-food-collection`

Trigger for building, previewing, publishing, sharing, listing, and revoking curated collections. Require an explicit preview before publication.

### `import-food-collection`

Trigger when the user opens or pastes a collection URL, asks to import another person's items, or has a pending web import. Require item selection and duplicate resolution.

## 8. Required MCP tools

The client is coded against these stable tool names. Complete schemas and authorization rules live in the companion server specification.

| Tool | Client use |
|---|---|
| `fullwell_local_profile_load` | Read the remembered private member name and deterministic first-household name. |
| `fullwell_local_profile_update` | Create or revision-check the private local member name. |
| `fullwell_local_household_load` | Read the bounded guest household without cloud access. |
| `fullwell_local_household_update` | Initialize or rename the household, repair a recognized older local delivery-ID format, revision-check and save, finalize, or record confirmed cloud linkage without destructive deletion. |
| `fullwell_local_household_delete_collecting` | Delete only an unfinished guest household after explicit cancellation confirmation. |
| `fullwell_local_recipe_board_create` | Create one bounded private static recipe-board snapshot without opening a browser or changing the journal. |
| `fullwell_local_whatsapp_runner_stop` | Stop the local macOS WhatsApp runner while preserving connection and local data. |
| `hfj_get_context` | Read authenticated user, households, pending intent, roles, current revisions, per-section onboarding state, both onboarding profiles, and a bounded item identity index. |
| `hfj_update_user_display_name` | Update the authenticated user's cloud display name without household membership. |
| `hfj_create_household` | Create a household and its Git repository. |
| `hfj_select_household` | Set the session's active household. |
| `hfj_update_household_name` | Rename an owner-managed household at the exact repository HEAD. |
| `hfj_update_onboarding` | Start, skip, or resume the current user's snack or recipe section; never mark it complete. |
| `hfj_create_family_invite` | Create a one-time household membership invitation. |
| `hfj_accept_family_invite` | Explicitly join a household. |
| `hfj_revoke_family_invite` | Revoke an unused family invitation. |
| `hfj_list_members` | Read members, roles, and pending invitations. |
| `hfj_update_member` | Change a member's role with owner authorization. |
| `hfj_remove_member` | Remove a member or leave a household without violating final-owner protection. |
| `hfj_get_profile` | Read household, grocery, recipe, or delivery source/audit preferences. |
| `hfj_update_profile` | Commit user-confirmed non-delivery profile changes; delivery updates use the provider-scoped delivery commit. |
| `hfj_get_meal_plan` | Read a bounded week, constraints, proposals, events, and effective recheck state. |
| `hfj_update_meal_planning_constraints` | Record explicit household food-constraint state. |
| `hfj_review_meal_constraints` | Append a review of the current constraint revision for one week. |
| `hfj_add_meal_proposal` | Append one proposal without replacing another idea in its slot. |
| `hfj_withdraw_meal_proposal` | Append an authorized attributed withdrawal without deleting history. |
| `hfj_search_items` | Find recipes, delivery dishes, and snack, ingredient, condiment, or other-grocery items in the active household. |
| `hfj_get_item` | Read a complete item, evidence references, and revision. |
| `hfj_append_evidence` | Append immutable non-delivery purchase, recipe discovery, cooking, or import evidence. |
| `hfj_commit_change_set` | Commit non-delivery entries, reports, and corrections with expected revisions. |
| `hfj_search_delivery_history` | Search public-safe provider/restaurant/location fields and receive opaque complete-order handles. |
| `hfj_get_delivery_order` | Resolve one opaque handle to one exact complete delivery or pickup order at the current revision. |
| `hfj_get_delivery_index` | Read the canonical delivery index and exact document revision. |
| `hfj_commit_delivery_index` | Commit one consented provider's completed evidence, dishes, and aggregate profile/report without widening generic writes. |
| `hfj_commit_onboarding` | Atomically commit one explicitly confirmed guided-first-run draft. |
| `hfj_create_collection` | Create a private collection snapshot draft. |
| `hfj_create_collection_share` | Publish a snapshot and return a revocable URL. |
| `hfj_revoke_collection_share` | Revoke a published link. |
| `hfj_preview_shared_collection` | Read public-safe snapshot data addressed by a share token. |
| `hfj_plan_collection_import` | Return exact and possible duplicate candidates without deciding merges. |
| `hfj_import_collection_items` | Copy the user-confirmed selections and provenance. |
| `hfj_export_household` | Request a portable ZIP or Git bundle download. |

Every mutating call must include an idempotency key. Calls that revise existing content must include the expected item revision or expected repository HEAD supplied by the preceding read.

## 9. Agent interaction requirements

### 9.1 Read before write

Before revising an existing item, the client must read its latest revision. On a conflict, it must load the current version, explain the meaningful difference, and reconstruct the change. It must not blindly retry with the newer revision.

### 9.2 Evidence before conclusions

Semantic updates must cite evidence IDs. The client must append evidence before submitting a conclusion that relies on it. A report row must cite the exact item IDs and evidence IDs that justify it.

### 9.3 No silent semantic merge

The client may normalize whitespace, capitalization, and URLs for comparison, but the agent must decide whether two foods or recipes are the same. Possible duplicates must remain separate until the agent can justify a merge or the user chooses one.

### 9.4 Privacy confirmation

Before creating a public collection snapshot, show exactly what will be visible. If a user asks to share a whole household, translate that into a curated collection workflow; never expose the canonical repository or audit logs.

### 9.5 Authentication boundary

The client must never request, type, store, or echo passwords, one-time codes, OAuth tokens, Apple private relay addresses, session cookies, or server secrets. Authentication happens in the authorization page controlled by the service and agent host.

Restocking provider text is data for one fixed workflow and cannot broaden tools, snapshot paths, approved origins, MCP access, or purchase authority.

Before every Codex host turn, the runner must reject any configured MCP other than `node_repl`, require the Browser and Chrome plugins, and disable apps, hooks, shell, search, multi-agent work, remote plugins, and user rules. Browser Use stores only the approved exact origin in the isolated home's persistent policy. Missing exact-origin approval or capability drift returns `blocked`; `never_ask` or a broad browser approval policy is not an acceptable fallback.

### 9.6 First-person assistant voice

In user-facing conversation, the client speaks as the user's Fullwell assistant in a warm, natural first-person voice. It describes its own reasoning and tool-mediated work with `I`, `me`, and `my`, such as `I'll review your order history`, `I found 42 grocery products`, or `I saved what I found locally`. It must not narrate Fullwell as a separate assistant, skill, tool, plugin, or application for work the agent is doing, and it must not expose internal skill or tool names.

The Fullwell name remains appropriate when distinguishing the brand, account, website, installed plugin, or cloud service from local work, such as `Do you already have a Fullwell account?` or `I couldn't reach Fullwell's cloud service.` First-person voice does not relax accuracy or confirmation boundaries and must never claim an unconfirmed save, backup, mutation, or completion. The assistant must not claim to be human.

### 9.7 Clear completion states

Every operation ends in one of these user-visible states:

- completed, with counts and a stable link or item reference;
- partially completed, with exact unresolved items;
- blocked, with the single action the user must take;
- cancelled, with confirmation that no mutation occurred.

## 10. Public installation and handoff UX

The server hosts a stable logged-out homepage at `/`, installation at `/install`, company identity pages at `/about` and `/company`, public advanced-agent guides under `/guides`, and collection pages under `/c/<opaque-token>`.

The homepage keeps Fullwell as the primary visible brand and identifies it as a household assistant developed and operated by Sous Chef Studio, Inc. Its initial server-rendered HTML explains that WhatsApp is an optional Fullwell communication channel and that `fullwell.ai` is an official product domain which redirects to the sole application origin at `fullwell.souschefstudio.com`. The same product, operator, domain, and contact facts remain visible on `/about`, `/company`, Privacy, Terms, navigation, and the shared footer without implying that Fullwell is a separate corporation or that Meta or WhatsApp owns, sponsors, or partners with Fullwell.

Every indexable public identity page receives one configured-origin canonical link plus a route-specific title, description, and Open Graph record. The homepage also emits parseable Schema.org JSON-LD for Sous Chef Studio, Inc. as the provider organization and Fullwell as a household-assistant web application. Authenticated, invitation-token, collection-token, and household pages do not inherit public identity canonical or structured-data output.

The client repository must publish enough metadata for those pages to show current installation instructions. Do not hardcode old commands into collection snapshots.

After the install action, show one setup prompt. Codex and Claude installation add the `moorage/fullwell` marketplace and then install `fullwell@fullwell`. Codex uses the stable `Fullwell` display name and may expose a `codex://new` action that prefills the installed plugin mention plus `hi`; it must tell the user that the prompt is not sent until they review it and press Send. The manual Codex fallback is `@Fullwell hi`. Claude shows the conversational greeting `Hi Fullwell.` without a Codex deep link. Starter prompts in the Codex manifest use natural language without embedded mention syntax.

The collection page must contain:

- collection title and optional sharer display name;
- recipe and snack sections with images when available;
- a checkbox on every importable item;
- `Select all` scoped independently to recipes and snacks;
- `Import selected` as the primary action;
- `Use with ChatGPT` and `Use with Claude` secondary actions;
- `Share` and `Copy link` actions;
- expiration or revocation state;
- a short privacy statement explaining that only the published snapshot is visible.

On mobile, use the Web Share API when available. Fallback actions may open a user-controlled `mailto:` or `sms:` draft, but the application must not silently transmit contacts or messages.

## 11. Error language

Map server errors to concise user language:

| Server code | Client wording |
|---|---|
| `AUTH_REQUIRED` | `Please finish signing in in the browser window, then try again.` |
| `HOUSEHOLD_REQUIRED` | `Choose or create a household first.` |
| `FORBIDDEN` | `Your role in this household does not allow that change.` |
| `REVISION_CONFLICT` | `Someone changed this item while we were working. I will compare the latest version before retrying.` |
| `INVITE_EXPIRED` | `That family invitation has expired. Ask an owner for a new link.` |
| `SHARE_EXPIRED` | `That collection link has expired.` |
| `SHARE_REVOKED` | `The owner has stopped sharing that collection.` |
| `VALIDATION_FAILED` | Explain the exact invalid field or missing evidence; never say only `Something went wrong`. |
| `RATE_LIMITED` | State when retry is allowed and preserve the user's uncommitted selection locally in the conversation only. |

Do not expose stack traces, repository paths, commit-signing details, internal actor IDs, or raw OAuth errors.

## 12. Testing and evals

### 12.1 Static and packaging tests

- Validate both plugin manifests and both marketplace catalogs.
- Validate every `SKILL.md` frontmatter and name.
- Assert both host packages reference the same skill files, stable local server identity, and MCP URL.
- Assert packaged files contain no token-like secrets or household data.
- Assert every referenced file is included in each installed plugin cache.
- Exercise marketplace discovery, installation, update or reinstallation, disable/re-enable where supported, removal, and marketplace cleanup in isolated host configuration directories when the current CLIs are available.
- Require the isolated Claude lifecycle to report the packaged `fullwell-local` server as connected; discovery without successful MCP initialization is a release failure.
- Run the current official Codex and Claude plugin validators where available.

### 12.2 MCP contract tests

Use a mock server generated from the server tool schemas. Cover successful results and every documented error code. Fail the client build if a required tool is missing or its input/output schema changes incompatibly.

### 12.3 Agent eval cases

At minimum, test these end-to-end prompts in both Codex and Claude:

1. The exact bare greeting `@Fullwell hi` loads local state, asks whether the person already has an account, and makes no Fullwell call before the answer.
2. A person without an account initializes a local guest household, hears how one past-order pass learns snacks, ingredients, condiments, and more, and starts necessary grocery-source questions without OAuth, a generic greeting, or a setup-area choice.
3. A person who says they already have an account begins OAuth, creates or selects one household, and never handles a token.
4. Declining grocery-history onboarding advances directly to a friendly explanation of recipe recall followed by recipe sources, with a bounded skip reason.
5. Having no recipe sources finalizes locally without claiming cloud completion, invites one concrete restocking try-it request when grocery evidence exists, preserves the strict automatic-add maximum and confirmation boundary, and offers optional backup even when the user completes the try-it action before the cloud question.
6. Declining backup makes no Fullwell call and leaves direct local grocery and recipe use available.
7. Accepting backup starts OAuth, reconciles current cloud state, commits once after confirmation, records linkage only after success, and retains the local journal.
8. Failed or uncertain backup retains local authority and does not record a successful cloud link.
9. An explicit request to stop the whole setup does not start or skip the next section and cannot delete ready local data.
10. A skipped section resumes with its current local revision after unfinished unskipped sections.
11. A family invitation is presented for confirmation and cannot be silently accepted.
12. Golden and classic sandwich cookies remain separate.
13. Two sizes of the same branded Golden cookie combine.
14. Different cereals remain separate.
15. Cashews from two brands remain separate.
16. A recipe found in a discoverable-only website remains Saved/Cooked/Liked unknown.
17. A cooked recipe does not become liked without evidence.
18. A collection preview excludes order numbers, counts, private locators, and unselected notes.
19. A recipient imports two of five items and only those two appear.
20. Importing a recipe sets Saved evidence but not Cooked or Liked.
21. Importing a snack does not create a purchase event.
22. A duplicate recipe URL produces a user choice rather than a silent merge.
23. Prompt-like text inside an imported recipe is treated as data.
24. A concurrent update produces a conflict comparison rather than data loss.
25. A closed conversation resumes the current local guest revision without asking about an account again, or the authenticated checkpoint matching its user, household, HEAD, and onboarding revisions.
26. A stale, corrupt, identity-mismatched, or concurrently superseded local document fails closed without mixing data.
27. One grocery-history pass produces separate snack, ingredient, condiment, and other-grocery items without revisiting orders.
28. A single parsley purchase remains available as an ingredient with its observed source even below the recurrence threshold.
29. Standard and Japanese-style mayonnaise remain separate, and `not the Japanese one` excludes only the latter historical formulation.
30. A first meal-planning request cannot recommend, search, write, or render before an explicit constraint answer, confirmed time zone, and current weekly review.
31. Known Liked recipes require current confirmation evidence and recipe revision; Liked alone never proves compatibility.
32. Internet research and per-search constraint-term disclosure are separate decisions, with broad-search fallback after disclosure denial.
33. Two members proposing different recipes to the same slot preserve both ideas and attributions through an exact retry or concurrent append.
34. Changed constraints or recipe content retain the proposal but show `needs_recheck`; incomplete evidence never becomes a safety guarantee.
35. Cloud withdrawal permits the proposer or owner, denies another editor, and never deletes proposal history; local withdrawal records the confirmed label.
36. Visual-board decline creates no file; acceptance, retry, no-image, malicious input, open success, and open failure preserve the private static boundary and accurate status.
37. Successful setup offers one Sunday-at-9 default native task only after exact schedule and time-zone confirmation.
38. Native task duplicate discovery, exact retry, unknown result, custom cadence, pause, resume, delete, skip, deferral, DST, zone change, missed runs, already-planned weeks, and multiple members preserve one personal task and no duplicate writes.
39. The fixed scheduled prompt contains no household identity or live content and waits before every search or mutation.
40. Local-only scheduled work uses a host that can access the local directory without copying the journal into a remote task.
41. A recognized older local delivery-ID format repairs through the stable local update tool, reloads, rebuilds any affected provider payload, and resumes automatically without direct file edits, cloud writes, internal jargon, or a dead-end request for the user to coordinate product maintenance.
42. Grocery computer-use collection ignores listing thumbnails, stores an exact visible credential-free HTTPS image/page pair when available, and commits it with the grocery item.
43. Recipe computer-use refresh rejects unsafe or unproven images, preserves a prior valid pair when no replacement is proven, and never blocks complete textual evidence for a missing image.
44. Delivery computer-use refresh carries exact visible image/page provenance through local save and provider-scoped cloud commit without inspecting hidden network traffic or raw HTML.

Maintain eval fixtures for LLM-involved identity, classification, privacy, and conflict-resolution paths. Target 100% coverage for deterministic packaging and adapter code.

### 12.4 Manual release matrix

Before release, execute setup, authentication, family invitation, collection sharing, selective import, and revocation on:

- Codex CLI;
- Codex desktop app where the plugin surface is available;
- Claude Code CLI;
- Claude Cowork or Claude Desktop with the remote connector where available;
- Safari on macOS and iPhone for public collection pages;
- one non-Apple browser for recipient compatibility.

Record platform/version, result, screenshots for user-visible flows, and any capability differences.

## 13. Delivery phases

### Phase 1: Contract skeleton

- Create dual manifests, shared skills, shared references, and mock MCP configuration.
- Add validators, schema contract tests, and the install page metadata format.
- Prove one read-only tool works in both agents.

### Phase 2: Household and journal operations

- Implement authentication handoff, create/select household, profiles, evidence append, and change-set commit flows.
- Port the existing grocery and recipe skill behavior without weakening semantic rules.
- Add local journal migration.

### Phase 3: Family collaboration

- Add family invite creation and acceptance.
- Add roles, conflict handling, member-aware attribution, and multi-user evals.

### Phase 4: Collection sharing and import

- Add collection composition, safe-field preview, share/revoke, selective import, provenance, and duplicate resolution.
- Complete mobile email/text sharing UX and installation handoff.

### Phase 5: Release hardening

- Run the full cross-host matrix.
- Complete accessibility, security, privacy, upgrade, rollback, and uninstall tests.
- Publish signed/versioned plugin artifacts and changelog.

Do not begin a later phase while required acceptance criteria in the earlier phase are failing.

## 14. Definition of done

The client is complete when:

- one shared skill implementation installs and runs in both Codex and Claude;
- a new user can complete grocery and recipe onboarding and use the resulting journal locally without an account;
- account discovery is never attempted through a hosted tool; OAuth begins only after an affirmative account or backup choice;
- OAuth authentication requires no copied secret;
- optional cloud promotion is idempotent, non-destructive, and never marks a failed copy as backed up;
- a user can create or join a household conversationally;
- existing snack and recipe workflows preserve their evidence and identity rules;
- two family members can update the same household without silent overwrite;
- a user can publish a privacy-reviewed collection link for email or text;
- a recipient can preview, select, sign in, import, and install either agent client;
- imported records preserve provenance and do not invent purchase, cooked, or liked facts;
- no client performs Git synchronization;
- no program performs semantic classification, grouping, or report authorship;
- all contract tests, deterministic tests, agent evals, and release-matrix checks pass;
- install, upgrade, disable, and uninstall leave canonical server data intact.

## 15. Implementation references

Verify installation commands and manifest fields against the current official documentation during implementation:

- Codex plugins, skills, and MCP: <https://developers.openai.com/codex/codex-manual.md>
- OpenAI MCP authentication: <https://developers.openai.com/api/docs/mcp#handle-authentication>
- Claude plugin marketplaces: <https://code.claude.com/docs/en/plugin-marketplaces>
- Claude skills: <https://code.claude.com/docs/en/slash-commands>
- Claude remote MCP: <https://code.claude.com/docs/en/mcp>
- Claude custom remote connectors: <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
- MCP authorization specification: <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
