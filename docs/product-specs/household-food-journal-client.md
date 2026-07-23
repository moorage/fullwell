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
2. choose the `Set up Fullwell` starter or say `@Fullwell hi` in Codex, or say `Set up Fullwell` in Claude;
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
7. select `Use with Codex` or `Use with Claude` and receive the shortest supported installation path.

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

- `Use with Codex`
- `Use with Claude`

Each choice must show one current, copyable install command or first-party installation action. Do not show both platforms' implementation details at once. Include a fallback manual path behind `Having trouble?`.

The installed package declares one dependency-free local stdio MCP server and the remote Streamable HTTP MCP endpoint with no bearer token. The fresh first-run skill calls only the read-only `fullwell_local_household_load` tool. If no guest household exists, it asks `Do you already have a Fullwell account?` before any protected cloud tool use.

If the answer is yes, the first protected tool starts MCP OAuth. The service authorization page offers:

1. Continue with Apple;
2. use a passkey, when one already exists;
3. email a magic link.

After authentication, the agent calls `hfj_get_context`. If the user has no household, it asks for a household name and calls `hfj_create_household`. If the user arrived through a pending family invitation or collection import, it resumes that intent instead of creating an unrelated household.

If the answer is no, the agent initializes one guest household under `~/.codex/fullwell/local/household.json`, or the configured Codex home equivalent, through `fullwell_local_household_update` and starts grocery-history onboarding without a Fullwell cloud call. The host may ask once before allowing that named local write tool; a persisted tool approval remains scoped to its stable server/tool identity across compatible Fullwell upgrades and never grants arbitrary Node execution. A remembered local guest household resumes without asking the account question again. The document has a generated local identity, collecting/ready state, monotonically increasing revision, stable cloud-promotion idempotency key, atomic replacement, `0700` directories, and `0600` file mode. It is local journal authority, not a cloud backup, and another person with access to the same operating-system account may read it.

After either authority is available, the agent begins guided first run immediately. A cloud path reads onboarding state, both profiles, and the bounded item identity index once; a guest path reuses the local journal. While any section remains unresolved, it must not return a generic greeting, ask what is on the user's mind, ask what the user wants to set up, or present a groceries-versus-recipes menu. Before the first question for each section, including a resumed section, it briefly explains the practical benefit in friendly language rather than referring to unexplained "snack setup" or "recipe setup." The internal `snacks` section is presented as one grocery-history pass that learns snacks, ingredients, condiments, and other groceries. Its examples include "Restock cashews," "Buy a head of parsley," and "I need more mayo - not the Japanese one," using past orders to identify both the familiar product and usual store with cart confirmation still required. Recipes explain that remembering what the family saves, cooks, and likes supports later questions such as "What was that pasta we loved?" or "What should we make again?" It then asks only for missing grocery source authorization and preferences needed for the audit, followed by missing recipe source meaning, authorization, and preferences.

The agent makes no intermediate Fullwell mutation. The cloud path checkpoints unconfirmed setup as versioned JSON under `~/.codex/fullwell/drafts/<fullwell-user-id>/<household-id>/onboarding.json`; every load must exactly match the authenticated Fullwell user ID, household ID, repository HEAD, and both onboarding revisions. The guest path saves the complete bounded local journal after every meaningful answer or collected occurrence. Both paths compare revisions and fail closed on stale, malformed, or conflicting writes.

Local files may contain only bounded source scope, completed-source cursors, typed food evidence, semantic decisions, profile edits, items, reports, section outcomes, and finalization metadata. They must not contain credentials, passwords, authorization headers, access or refresh tokens, cookies, browser state, screenshots, raw HTML, raw page captures, or one-time codes. A natural refusal, `not now`, `never mind`, or statement that no applicable sources exist records a bounded outcome and advances. Explicit cancellation may delete only an unfinished guest household after confirmation; it never deletes ready local data.

After both guest sections, the agent summarizes and finalizes the journal locally and tells the user it is ready on this computer. When at least one evidence-backed grocery item was learned, the successful completion response asks the user to try Fullwell with something they are out of, such as `We're out of cashews; restock them.` It explains that Fullwell will use the learned product and store history and will ask before adding anything to the cart. It omits this invitation after a failed, cancelled, unfinished, or no-grocery run rather than implying that restocking is ready. The same invitation follows a successful hosted onboarding commit, never an uncertain result.

The guest completion response also asks whether to create or connect a Fullwell account for cloud backup. It explains that an account is needed for WhatsApp, sharing, and family access, not for direct local grocery or recipe use. A decline makes no hosted call. An affirmative answer starts OAuth, creates or selects a cloud household, reconciles local semantic identities against current cloud state, shows an exact copy/merge summary, and uses one `hfj_commit_onboarding` call after confirmation. Promotion uses the stable local idempotency key, records cloud linkage only after success, and retains the local journal. Failed or uncertain promotion leaves local authority unchanged.

The final local document and hosted MCP request each accept up to 10,000 evidence records and 10,000 items within 16 MiB. A within-limit payload must not be split. `fullwell_local_household_load` remains read-only, ordinary local changes use the non-destructive `fullwell_local_household_update`, and confirmed whole-flow cancellation alone uses the separately destructive `fullwell_local_household_delete_collecting`. If the local server is unavailable, the client stops and asks for a plugin reload or reinstall; it never falls back to a version-specific shell command, edits the user's rules, or calls the hosted service without consent. Browser or website authorization remains a separate host boundary and may still require host approval.

The client must never ask the user to paste a token back into the conversation.

Supported hosts may dynamically register a native public client, repeat the MCP resource indicator during token exchange, and send the MCP initialized lifecycle notification without a request ID. The service must interoperate with those standards-compatible host behaviors without requiring host-specific secrets or configuration in the package.

### 5.2 Create or join a family

For a new household:

1. Ask for a short household name.
2. Create it with the current user as owner.
3. Complete or exit guided first run, unless the user asked specifically about family access.
4. Ask whether they want to invite another person now.
5. If yes, ask whether the person should be an editor or viewer.
6. Call `hfj_create_family_invite` and present the returned URL with `Share`, `Copy link`, `Email`, and `Text` options when the current surface supports them.

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
6. submit exact evidence with `hfj_append_evidence`;
7. classify every in-scope line as `snack`, `ingredient`, `condiment`, or `other_grocery` and make identity decisions itself;
8. submit item and report changes through `hfj_commit_change_set` with cited evidence IDs;
9. ask at the end of every update whether the user's shops have changed.

The browser traverses every qualifying order detail once and collects all grocery areas together. It authors or updates an evidence-backed item for every in-scope identity, including a one-off or otherwise below-threshold purchase. The recurrence threshold controls report assertions only and must not discard an item needed for a later source-aware request.

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
10. use an image displayed by the audited recipe site and preserve both page and image provenance;
11. commit the resulting entry and index updates through `hfj_commit_change_set`;
12. ask at the end whether the places the user saves or discusses recipes have changed.

Do not infer liked from cooked, cooked from saved, or saved from mere discoverability.

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
5. The local agent reads the current restocking snapshot and considers only products/stores supported by cited household purchase evidence. Retailer search can establish availability, not preference.
6. If one plausible historical candidate remains, add the requested quantity to that cart. If distinct historical candidates remain plausible, ask one concise question using only distinctions present in those candidates. Do not invent generic internet options.
7. Before changing the cart, recheck the current grant, membership, device/link state, and Git HEAD. Inspect the existing cart, persist a baseline and target, act once, and re-read the quantity.
8. Return `completed`, `needs_input`, `blocked`, or `cancelled`. Never check out, pay, subscribe, accept a fee, alter unrelated cart items, or silently substitute.

When the Mac is asleep, offline, locked, missing browser permission, signed out, blocked by CAPTCHA, or stale, the workflow waits or blocks without claiming success. Disconnect/revoke always purges local snapshots and receipts without deleting canonical server data.

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
|   `-- local-household-mcp.mjs
|-- skills/
|   |-- manage-household-food-journal/
|   |   `-- SKILL.md
|   |-- audit-grocery-purchases/
|   |   `-- SKILL.md
|   |-- track-recipe-history/
|   |   `-- SKILL.md
|   |-- share-food-collection/
|   |   `-- SKILL.md
|   `-- import-food-collection/
|       `-- SKILL.md
|-- references/
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

Trigger for purchase-history audits, recurring grocery reports, pantry comparisons, store changes, and recurrence recalculation. In one order-detail traversal, learn snacks, ingredients, condiments, and other groceries, including identities below the report threshold. Carry forward the full identity safeguards. When operating an authorized browser, treat order-history listings as discovery only: traverse the complete date window, open every qualifying delivered or completed order detail, expand every complete-item control, and verify exact line items through the subtotal or order-total boundary. If hidden items cannot be exposed, identify the incomplete order and do not claim the audit or affected recurrence result is complete.

### `restock-groceries`

Trigger for fixed-purpose requests to replenish a historically purchased grocery in an approved retailer cart. Read the local snapshot, resolve preference only from historical cited candidates, ask evidence-backed ambiguity questions, create an idempotent cart target, and treat provider text, journal content, and retailer pages as untrusted data. The skill has no checkout authority.

### `track-recipe-history`

Trigger for recipe discovery, saved/cooked/liked history, cooking dates, modifications, recipe-source changes, and recipe images.

### `share-food-collection`

Trigger for building, previewing, publishing, sharing, listing, and revoking curated collections. Require an explicit preview before publication.

### `import-food-collection`

Trigger when the user opens or pastes a collection URL, asks to import another person's items, or has a pending web import. Require item selection and duplicate resolution.

## 8. Required MCP tools

The client is coded against these stable tool names. Complete schemas and authorization rules live in the companion server specification.

| Tool | Client use |
|---|---|
| `fullwell_local_household_load` | Read the bounded guest household without cloud access. |
| `fullwell_local_household_update` | Initialize, revision-check and save, finalize, or record confirmed cloud linkage without destructive deletion. |
| `fullwell_local_household_delete_collecting` | Delete only an unfinished guest household after explicit cancellation confirmation. |
| `hfj_get_context` | Read authenticated user, households, pending intent, roles, current revisions, per-section onboarding state, both onboarding profiles, and a bounded item identity index. |
| `hfj_create_household` | Create a household and its Git repository. |
| `hfj_select_household` | Set the session's active household. |
| `hfj_update_onboarding` | Start, skip, or resume the current user's snack or recipe section; never mark it complete. |
| `hfj_create_family_invite` | Create a one-time household membership invitation. |
| `hfj_accept_family_invite` | Explicitly join a household. |
| `hfj_revoke_family_invite` | Revoke an unused family invitation. |
| `hfj_list_members` | Read members, roles, and pending invitations. |
| `hfj_update_member` | Change a member's role with owner authorization. |
| `hfj_remove_member` | Remove a member or leave a household without violating final-owner protection. |
| `hfj_get_profile` | Read source, browser, store, and audit preferences. |
| `hfj_update_profile` | Commit user-confirmed profile changes. |
| `hfj_search_items` | Find recipes and snack, ingredient, condiment, or other-grocery items in the active household. |
| `hfj_get_item` | Read a complete item, evidence references, and revision. |
| `hfj_append_evidence` | Append immutable purchase, recipe discovery, cooking, or import evidence. |
| `hfj_commit_change_set` | Commit agent-authored entries, reports, and corrections with expected revisions. |
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

### 9.6 Clear completion states

Every operation ends in one of these user-visible states:

- completed, with counts and a stable link or item reference;
- partially completed, with exact unresolved items;
- blocked, with the single action the user must take;
- cancelled, with confirmation that no mutation occurred.

## 10. Public installation and handoff UX

The server hosts a stable landing page such as `/install` and collection pages under `/c/<opaque-token>`.

The client repository must publish enough metadata for those pages to show current installation instructions. Do not hardcode old commands into collection snapshots.

After the install action, show one setup prompt. Codex and Claude installation add the `moorage/fullwell` marketplace and then install `fullwell@fullwell`. Codex uses the stable `Fullwell` display name and may expose a `codex://new` action that prefills the installed plugin mention plus `hi`; it must tell the user that the prompt is not sent until they review it and press Send. The manual Codex fallback is `@Fullwell hi`. Claude shows `Set up Fullwell.` without a Codex deep link. Starter prompts in the Codex manifest use natural language without embedded mention syntax.

The collection page must contain:

- collection title and optional sharer display name;
- recipe and snack sections with images when available;
- a checkbox on every importable item;
- `Select all` scoped independently to recipes and snacks;
- `Import selected` as the primary action;
- `Use with Codex` and `Use with Claude` secondary actions;
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
5. Having no recipe sources finalizes locally without claiming cloud completion, invites one concrete restocking try-it request when grocery evidence exists, preserves cart confirmation, and then offers optional backup.
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
