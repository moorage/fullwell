# Household Food Journal Central Git Server Specification

Status: Ready for implementation

Date: 2026-07-15

Companion specification: [Codex and Claude Client](household-food-journal-client.md)

## 1. Purpose

Build a hosted Household Food Journal service that provides:

- very low-friction account creation and sign-in;
- family households with separate member identities and roles;
- an authenticated remote MCP endpoint for Codex and Claude;
- one authoritative Git repository per household;
- a single server-side Git writer with safe concurrent mutation handling;
- auditable snack, recipe, evidence, report, membership, sharing, and import history;
- family invitation links for ongoing collaboration;
- revocable collection links that can be shared through email or text;
- a mobile-friendly public collection preview and selective import flow;
- portable household exports.

Google Drive is out of scope. End users never interact with Git, SSH, repository hosting, personal access tokens, or server credentials.

The installed agent may provide a single-user local guest journal before account creation. That guest document is outside this service's authority and contains no server identity, OAuth state, or Git checkout. A client compatibility repair for a recognized older local delivery identifier remains entirely inside the locked local runtime, changes no hosted state, and must rebuild the exact provider payload before a later hosted contribution. The hosted service becomes involved only when the user chooses an existing account or explicitly promotes local data for cloud backup, WhatsApp, sharing, or family access. Once promoted, all cloud mutations still pass through this specification's authenticated contracts and sole Git writer.

## 2. Product decisions

These decisions are normative for version 1.

1. The service runs Git and is the only Git writer.
2. Each household has a separate repository and a separate authorization boundary.
3. Git is authoritative for cloud household content and its audit history. A pre-account local guest journal is a separate client authority and is never presented as cloud-backed.
4. Neon PostgreSQL stores operational state needed for authentication, OAuth, sessions, idempotency, locks, token revocation, invitations, and query projections. It is not the authoritative copy of household journal content.
5. Agents, guided by installed skills, make semantic decisions and author Markdown reports. The server does not classify food, merge food identities, decide recipe equivalence, infer statuses, or write report prose.
6. The server validates structure, authorization, evidence references, arithmetic assertions, allowed transitions, and Git consistency.
7. Every person has an individual account. A household membership grants collaboration rights.
8. Continue with Apple is the primary first-run sign-in. Existing passkeys are equally prominent. Email magic link is the fallback.
9. MCP uses standards-based OAuth with no copied bearer tokens.
10. Family invitations grant membership only after authenticated, explicit acceptance.
11. Collection shares expose immutable public-safe snapshots, not live household data.
12. Collection imports are copies with provenance, not subscriptions or two-way sync.
13. Git history is signed and backed up outside the primary server.
14. Version 1 deploys one TypeScript application service and its React 19.2 web build on a DigitalOcean Droplet, with Neon PostgreSQL and DigitalOcean Block Storage. Avoid microservices.

## 3. Success criteria

The system succeeds when:

- a new user can authenticate and create a household in under two minutes without a password;
- a second user can join through a texted invitation link and both users retain separate audit identities;
- Codex and Claude can authenticate to the same MCP endpoint and see the same household state;
- concurrent edits never silently overwrite each other;
- every accepted content mutation corresponds to exactly one signed Git commit and one append-only audit event;
- retried MCP requests cannot duplicate evidence, imports, invitations, or commits;
- a collection visitor can preview without an account and import selected items after sign-in;
- a collection link cannot expose unselected private content or grant household membership;
- a household can be restored from its repository plus operational metadata backup;
- users can download a readable ZIP and a verifiable Git bundle.

## 4. Technical baseline

Use a small TypeScript service unless implementation constraints discovered during the initial spike justify a documented change.

Recommended baseline:

- current supported Node.js LTS;
- TypeScript with `strict` mode and no unchecked `any`;
- Fastify or an equivalently small standards-oriented HTTP framework;
- the official stable MCP TypeScript SDK;
- Neon PostgreSQL for operational metadata and durable job/idempotency state;
- the system Git executable invoked with argument arrays and `shell: false` behind a typed adapter;
- React and React DOM 19.2 for sign-in, invitations, collection preview, Web Share, import, account, connected weekly meal planning, and installation browser flows;
- JSON Schema or an equivalent runtime validator generated from shared semantic types;
- Vitest for units and integration tests;
- Playwright for browser flows;
- one containerized application process on a DigitalOcean Droplet;
- DigitalOcean Block Storage mounted at `/data/households` for the persistent repository volume.

React is a presentation boundary, not a second service or authorization layer. The TypeScript application service must serve the production web build and remain authoritative for sessions, pending intents, authorization, validation, and mutations. Prefer native form semantics and server-rendered or progressively enhanced entry states when they improve resilience and accessibility.

Suggested repository layout:

```text
household-food-journal/
|-- apps/
|   |-- server/
|   |   `-- src/
|   |       |-- auth/
|   |       |-- collections/
|   |       |-- domain/
|   |       |-- git/
|   |       |-- households/
|   |       |-- imports/
|   |       |-- mcp/
|   |       |-- persistence/
|   |       |-- web/
|   |       `-- workers/
|   `-- web/
|       `-- src/
|-- packages/
|   |-- contracts/
|   `-- agent-client/
|-- migrations/
|-- schemas/
|-- tests/
|   |-- contract/
|   |-- integration/
|   |-- security/
|   `-- e2e/
|-- docs/
|-- Dockerfile
|-- package.json
|-- tsconfig.json
`-- CHANGELOG.md
```

Keep side effects at module boundaries. Domain validation and sharing projections should be pure functions. Git, database, clock, randomness, mail, and HTTP access must be explicit interfaces with deterministic fakes in tests.

## 5. Architecture

```text
Codex / Claude                         Browser
      |
      | MCP over HTTPS + OAuth
      v
Application service ---------------- React 19.2 web experience
      |                                      |
      |                                      | sign-in, invite, preview, import
      |
      +---- Neon PostgreSQL
      |       users, memberships projection, OAuth, sessions,
      |       idempotency, locks, share-token hashes, jobs
      |
      +---- DigitalOcean Block Storage
      |       one signed repository per household
      |
      `---- Encrypted off-site backup
              Git bundles + database backup + signed HEAD manifest
```

The service is logically one writer even if later deployed in more than one process. A transaction-scoped Neon PostgreSQL advisory lock keyed by household ID and a durable mutation record must serialize writes. The lock and mutation state transition must use the same checked-out connection and transaction; do not use session-scoped locks through Neon's pooled endpoint.

## 6. Authority and consistency boundaries

### 6.1 Git-authoritative data

Git owns:

- household display settings that are safe to export;
- pseudonymous member IDs and role-change audit events;
- snack profiles, evidence, items, ledgers, and agent-authored reports;
- recipe profiles, evidence, entries, cooking history, and agent-authored indexes;
- the shared meal-planning constraint profile, immutable weekly review events, meal proposals, and withdrawal events;
- private collection definitions and published collection snapshots;
- import provenance;
- immutable audit event files;
- format-version and migration history.

### 6.2 Operational database data

PostgreSQL owns:

- user identity mappings and private email data;
- Apple identity subject mappings and token-revocation state;
- passkey public credentials;
- email magic-link challenges;
- web and OAuth sessions;
- MCP authorization codes, grants, refresh tokens, and revocations;
- household-to-repository location mapping and provisioning state;
- materialized membership authorization used at request time;
- per-household mutation locks and durable mutation status;
- idempotency keys and stored responses;
- per-user, per-household snack and recipe onboarding progress and bounded skip reasons;
- hashed family-invitation and collection-share tokens;
- collection expiration and immediate revocation state;
- search projections that can be rebuilt from Git;
- backup and reconciliation checkpoints.

Membership changes must be committed to Git and projected into PostgreSQL. Authorization uses the projection. If the projection disagrees with Git, fail closed and run reconciliation.

### 6.3 No bidirectional content synchronization

Clients never write repositories. PostgreSQL projections never author journal content. Git changes flow only from the central mutation pipeline; search and authorization projections flow one way from accepted commits.

## 7. Identity and authentication

### 7.1 User-facing sign-in

Present these choices in order:

1. Continue with Apple.
2. Sign in with a passkey, when browser capability and an existing credential are detected.
3. Email me a sign-in link.

Do not offer a service-specific password in version 1.

Continue with Apple must use the web Services ID flow and validate authorization codes and identity tokens server-side. Treat Apple's stable subject as the external identity key. The user's name and email may be available only during the first authorization; store only what is needed for account display, invitations, security notices, and recovery.

Apple's cross-site `form_post` callback must use a short-lived `Secure; SameSite=None` browser-binding cookie. The sign-in page's Content Security Policy may allow form navigation only to the service origin and `https://appleid.apple.com`; every other form destination remains blocked.

After initial Apple or magic-link authentication, offer passkey enrollment. Passkeys must use WebAuthn with discoverable credentials and required user verification where supported. The private key remains in the user's credential provider, including Apple Passwords/iCloud Keychain.

Email magic links:

- expire after 15 minutes;
- are one-time use;
- store only a hash of the token;
- are bound to the initiating browser transaction when practical;
- do not reveal whether an address already has an account;
- redirect back to the pending invitation, import, or MCP authorization intent.

### 7.2 MCP OAuth

Expose one Streamable HTTP MCP endpoint at `/mcp` and implement the current MCP authorization specification.

Required capabilities:

- OAuth Protected Resource Metadata at the standard well-known location;
- authorization-server metadata;
- authorization-code flow with PKCE S256;
- exact redirect-URI validation;
- state and nonce validation where applicable;
- short-lived access tokens;
- rotated refresh tokens with reuse detection, including scope-bearing refresh requests from current Codex/RMCP clients when the requested scope matches the original grant;
- token revocation;
- resource and audience validation;
- scoped consent;
- support for the client registration/discovery mechanisms currently required by both Codex and Claude, including Client ID Metadata Documents and Dynamic Client Registration when those hosts require them.

Authorization-server metadata must advertise the dynamic registration endpoint and public-client token authentication. Dynamic registration must accept the bounded standards-compatible native-client metadata emitted by supported hosts, persist only the metadata needed for validation and consent, and return a non-cacheable response. The server-rendered consent screen must derive the client name and exact requested scopes from the validated authorization request rather than from free-form browser input.

For the macOS local runner, the consent page's Content Security Policy may add only the exact validated `http://127.0.0.1:<ephemeral-port>` origin for a bounded `/oauth/callback` redirect. This exception is route-specific; all other pages retain the normal form destinations, and OAuth validation still requires an exact dynamically registered redirect URI before issuing a code.

Authorization-code and refresh-token requests may repeat the RFC resource indicator. Validate it against the MCP audience before consuming or rotating a credential. After a successful initialize response, accept the no-ID `notifications/initialized` lifecycle notification and return an empty successful notification response before serving tool discovery. Tool calls accept the MCP-standard `params._meta` object as bounded JSON metadata while continuing to validate the tool name, arguments, and all other request fields strictly.

Initial scopes:

| Scope | Permission |
|---|---|
| `journal:read` | Read households, profiles, items, reports, and private collections available to the user. |
| `journal:write` | Append evidence and propose content changes in editable households. |
| `household:manage` | Create households and manage invitations/members when the household role permits it. |
| `collection:share` | Publish and revoke collection snapshots. |
| `journal:export` | Request portable exports. |
| `runner:messages` | Receive linked fixed-purpose restocking requests on one registered Mac. |

Scopes do not override household roles. A token with `journal:write` still cannot write a viewer-only household.

`runner:messages` also requires `journal:read` and current household membership for the restocking snapshot. It does not grant checkout, general remote-agent, or journal-write authority. The consent screen names the linked-Mac behavior explicitly.

Do not place access tokens, refresh tokens, authorization codes, or Apple client secrets in Git, logs, MCP tool output, URLs, or analytics.

### 7.3 Account lifecycle

Users may:

- rename their display name;
- add or remove passkeys;
- link or unlink sign-in methods while retaining at least one method;
- list active MCP grants and revoke them;
- leave households unless they are the sole owner;
- request account deletion.

Account deletion must revoke sessions and tokens immediately. If other members retain a household, replace the deleted user's exported display identity with a stable pseudonymous former-member label while preserving audit integrity. A sole owner must transfer ownership or explicitly delete/export the household before deleting the account.

The MCP surface exposes the same display-name capability through account-scoped `hfj_update_user_display_name`. It requires `journal:write`, an idempotency key, and an authenticated user, but no household membership or repository commit. Exact replay returns the stored result; reusing a key for another name fails before the account changes.

## 8. Household collaboration

An authenticated user may create a household from the server-rendered household list. The form submission must authenticate the browser session, verify CSRF, validate the household name and idempotency key, and call the same single-writer `hfj_create_household` use case as MCP. A completed request redirects to the new household; an exact replay returns the same household without another Git commit.

An owner may rename a household through `hfj_update_household_name`. The mutation replaces only `household.md` at an exact repository HEAD, creates one signed commit, and updates the Neon display-name projection. Reconciliation parses the authoritative name from Git and repairs projection drift.

### 8.1 Roles

| Operation | Owner | Editor | Viewer |
|---|---:|---:|---:|
| Read private household content | Yes | Yes | Yes |
| Append evidence | Yes | Yes | No |
| Edit items and reports | Yes | Yes | No |
| Create and share collections | Yes | Yes | No |
| Import into household | Yes | Yes | No |
| Invite viewers/editors | Yes | No | No |
| Change roles or remove members | Yes | No | No |
| Export household | Yes | Yes | Yes |
| Delete household | Yes | No | No |

At least one owner must remain.

### 8.2 Family invitations

A family invitation is a one-time membership capability, separate from collection sharing.

Requirements:

- token: at least 256 bits from a cryptographically secure generator;
- storage: only an HMAC or slow hash of the token, never the token itself;
- default expiration: 7 days;
- role: editor or viewer, selected at creation;
- optional intended-email hint: never required for text invitations and never displayed publicly;
- single acceptance;
- revocable before acceptance;
- no household data beyond household name, inviter display name, requested role, and expiration before sign-in;
- explicit acceptance after authentication;
- audit events for create, revoke, accept, role change, removal, and departure.

Opening an invitation must set a signed, short-lived pending-intent cookie so authentication resumes the correct flow. Do not mark it accepted until the user selects `Join household`.

## 9. Household Git repository

### 9.1 Repository topology

Create one bare repository per household:

```text
/data/households/<household-uuid>.git
```

Use `main` as the only writable branch in version 1. Mutations use temporary worktrees under a service-controlled path. Clients have no repository network endpoint.

Repository paths are derived solely from validated internal UUIDs, never user input. Git commands use fixed subcommands and argument arrays; never interpolate a shell command.

### 9.2 Repository layout

```text
FORMAT_VERSION
household.md
members/
  <actor-id>.md
profiles/
  household.md
  snacks.md
  recipes.md
  delivery.md
  meal-planning.md
snacks/
  evidence/<year>/<evidence-id>.json  # legacy read compatibility
  items/<snack-id>.md
  reports/recurring-snacks.md
ingredients/
  items/<ingredient-id>.md
condiments/
  items/<condiment-id>.md
groceries/
  evidence/<year>/<evidence-id>.json
  items/<other-grocery-id>.md
recipes/
  evidence/<year>/<evidence-id>.json
  items/<recipe-id>.md
  reports/recipe-index.md
delivery/
  evidence/<year>/<evidence-id>.json
  items/<delivery-dish-id>.md
  reports/delivery-index.md
meal-plans/
  weeks/<monday-date>/proposals/<proposal-id>.json
  weeks/<monday-date>/events/<event-id>.json
collections/
  <collection-id>/collection.md
  <collection-id>/snapshots/<snapshot-id>.json
imports/
  <year>/<import-id>.json
audit/
  <year>/<event-id>.json
```

All text is UTF-8 with LF endings. JSON uses deterministic key ordering and a trailing newline. Markdown entries use YAML frontmatter for typed fields followed by human-readable content authored by the agent.

### 9.3 Identifier and timestamp conventions

- Use UUIDv7 for server-created entity and event IDs.
- Use RFC 3339 UTC timestamps with millisecond precision.
- Use Git object IDs only as revisions, never as public access tokens.
- Use opaque pseudonymous actor UUIDs in exported repositories; private identity mappings remain in PostgreSQL.
- Never use titles or user-provided strings as filesystem paths.

### 9.4 Append-only paths

Files under these paths may be created but never modified or deleted by ordinary mutations:

- `snacks/evidence/` for legacy purchase evidence
- `groceries/evidence/`
- `recipes/evidence/`
- `delivery/evidence/`
- `imports/`
- `audit/`
- `collections/*/snapshots/`
- `meal-plans/weeks/*/proposals/`
- `meal-plans/weeks/*/events/`

A correction is a new event that references the superseded event. Repository validation must reject a change set that alters an existing append-only blob.

### 9.5 Mutable current-state paths

`household.md`, profiles, item entries, reports, member projections, and private collection definitions may change. Delivery mutable paths are `profiles/delivery.md`, `delivery/items/`, and `delivery/reports/delivery-index.md`. Git history preserves their earlier versions. Household names are trimmed text of at most 120 characters and are never used as filesystem paths. Every update must use an expected blob object ID or expected repository HEAD and cite relevant evidence when the domain change requires it.

## 10. Domain contracts

Define semantic TypeScript types and runtime schemas for every boundary. The following fields are the minimum contract.

### 10.1 Evidence

Common fields:

- `id`
- `kind`: `purchase`, `recipe_discovery`, `cooking`, `user_confirmation`, `import`, `correction`, or `delivery_order_line`
- `observed_at`
- `evidence_date` and `date_precision`
- `source_type`
- `source_label`
- `stable_locator`
- `summary`
- `actor_id`
- `limitations`
- `supersedes_evidence_id`, when correcting
- `schema_version`

Purchase evidence additionally includes private store, order reference, exact line-item title, and order date. It must not be projected into public collections.

Recipe discovery evidence may include canonical recipe URL, audited page URL, displayed image URL, author/publisher, and source-scope semantics.

Cooking evidence includes recipe candidate or ID, date, result, changes, and whether each change is one-time or confirmed typical.

Delivery-order-line evidence is accepted only through `hfj_commit_delivery_index`. It stores the exact canonical HTTPS provider origin/label, private provider order/group locator, completed order date, `delivery | pickup`, literal complete-group and complete-modifier assertions, declared line count, stable line key, exact restaurant name/public location/public merchant address plus private merchant locator, dish, quantity, modifiers, optional historical menu locator, and agent-authored `food | alcohol` classification. The schema has no delivery-destination, account-address, payment, credential, or identity-document field. Only completed, fully exposed groups are canonical evidence; an incomplete or hidden-line order is reported as incomplete and is not submitted.

### 10.2 Grocery item

Typed frontmatter must include:

- `id`
- `kind`: `snack`, `ingredient`, `condiment`, or `other_grocery`
- `display_name`
- `brand`
- `product_line`
- `flavor`
- `formulation`
- `format`
- `category`
- `produce_variety`, when relevant
- `known_size_variants`
- `image_page_url`
- `image_url`
- `evidence_ids`
- `created_at`
- `updated_at`
- `schema_version`

The Markdown body may contain agent-authored identity reasoning, pantry notes, observed store examples, recurrence assertions, and restock notes. Canonical item paths are `snacks/items/`, `ingredients/items/`, `condiments/items/`, and `groceries/items/` respectively. New purchase evidence is stored under `groceries/evidence/`; reconciliation continues to read legacy `snacks/evidence/` without rewriting history.

Server validation may verify that a submitted recurrence count equals the number of distinct cited private order keys and that item kind matches its canonical path. It must not classify a line item, choose its grocery kind, or decide semantic identity. An item remains valid below the recurrence threshold; the threshold controls report assertions only.

### 10.3 Recipe item

Typed frontmatter must include:

- `id`
- `title`
- `canonical_url`
- `audited_page_url`
- `author_or_publisher`
- `saved`: `yes`, `no`, or `unknown`
- `cooked`: `yes`, `no`, or `unknown`
- `liked`: `yes`, `no`, or `unknown`
- `last_cooked`
- `date_precision`
- `image_url`
- `image_page_url`
- `evidence_ids`
- `created_at`
- `updated_at`
- `schema_version`

The body contains the agent-authored summary, typical preparation changes, cooking-history table, status reasoning, conflicts, and provenance.

The server validates only supported state/evidence relationships. It must not infer status or merge recipes.

### 10.4 Report or index

Reports are Markdown authored by the agent. A report submission includes a machine-readable sidecar assertion list in the tool input:

- row identifier;
- referenced item IDs;
- referenced evidence IDs;
- asserted distinct-order count, if any;
- asserted last date, if any.

The server verifies referential integrity and deterministic arithmetic. It stores only validated Markdown. It does not rewrite prose, reorder rows, group items, or add missing rows.

### 10.5 Collection snapshot

A snapshot is a strict union of `recipe`, compatibility `snack`, and `delivery_dish` public items. A delivery dish contains its collection-local ID, title, restaurant name, public location label/address, optional public description/note, image provenance, source display attribution, source item revision, and optional explicit `alcohol` classification. It never reuses private journal/order fields.

Recipe and snack snapshots contain only public-safe fields:

- collection-local item ID;
- kind: `recipe` or `snack`;
- title/display name;
- public description selected by the publisher;
- brand, flavor, formulation, and format for snacks;
- author/publisher and canonical recipe link for recipes;
- image reference and its audited-page provenance;
- selected preparation notes, only when explicitly included;
- source display attribution chosen by the publishing user;
- source item revision for later provenance;
- snapshot creation timestamp and schema version.

It must not contain household IDs, actor IDs, order data, counts, private evidence IDs, private source labels, message/notes locators, or unselected private notes.

### 10.6 Food-delivery history, dishes, and cart authority

`delivery_order_line` evidence records provider origin, private provider/order-group and merchant/menu locators, exact restaurant display/location, `delivery | pickup`, date, dish, modifiers, quantity, declared group line count, and completeness. A complete group requires the exact declared line set. `delivery_dish` items cite canonical evidence and keep provider/location identities distinct; deterministic code validates locators and counts but does not merge same-name restaurants or dishes.

The local runtime stores provider-neutral delivery evidence, dishes, per-provider audit profiles, and indexes. Connected `hfj_commit_delivery_index` accepts exactly one provider origin, explicit household visibility/retention consent, complete aggregate replacements, expected revisions/HEAD, and an idempotency key. Git is authoritative; `search_items` is a public-safe rebuildable projection.

Delivery dishes may enter immutable collection snapshots only through a delivery-specific public allowlist. Import produces a destination dish plus import provenance, never private order evidence, recurrence, fulfillment history, or reorder authority. `journal_delivery_dish` meal proposals cite an exact current item revision plus ordered-before or import evidence. They preserve append-only proposal history, default compatibility to incomplete evidence, and become `needs_recheck` after item or constraint revision changes.

The server does not control providers or carts. The agent's ephemeral `delivery_cart_plan` and session contract bind a complete prior delivery order, provider origin, exact location, fulfillment, source lines, quantities, modifiers, full current-cart baseline, requested/preserved/full subtotals, ordinary maximum, current local revision or Git HEAD, and any different-location replacement confirmation. A terminal prepared result requires complete post-action cart proof. Checkout, payment, tips, address/schedule changes, memberships, and subscriptions have no tool, route, schema, or durable action authority. Alcohol may be selected under the ordinary maximum; age/identity UI remains user-controlled and no ID data is accepted.

## 11. Git mutation pipeline

Every mutation follows this algorithm.

1. Authenticate the request and resolve the user.
2. Validate OAuth scope and household role.
3. Validate the idempotency key format.
4. Insert or read a durable `mutation_requests` row keyed by `(user_id, tool_name, idempotency_key)`.
5. If a completed row exists, return the stored response without repeating work.
6. Acquire the PostgreSQL advisory lock for the household.
7. Refresh membership and current Git HEAD. Fail closed on projection disagreement.
8. Check `expected_head` and expected blob revisions.
9. Create a clean temporary worktree from current `main`.
10. Apply only typed, server-mapped path changes.
11. Validate schemas, append-only rules, evidence references, public-safe projections, arithmetic assertions, and repository invariants.
12. Create one append-only audit event file describing the request, actor, operation, affected entity IDs, parent HEAD, and idempotency key. Do not include secrets or raw private input.
13. Stage an explicit allowlist of changed paths.
14. Create one signed commit.
15. Atomically advance `main` only if its parent remains the expected HEAD.
16. Record the commit ID and result in `mutation_requests`.
17. Update operational projections and search indexes.
18. Remove the temporary worktree and release the lock.
19. Return only after Git commit and required projections are durable.

If the process crashes after the commit but before the database result is stored, the reconciler scans commit trailers for the request ID, completes projections, and returns the original result on retry. Never create a second commit for the same idempotency key.

### 11.1 Commit format

Use a fixed service author that contains no user's private email. Sign every commit with a service signing key held outside the repository.

Example:

```text
recipes: record r_018f... cooking update

Actor-ID: a_018f...
Household-ID: h_018f...
Request-ID: req_018f...
Tool: hfj_commit_change_set
Client: codex
Schema-Version: 1
```

The `Client` value is asserted from trusted OAuth client metadata, not free-form model input.

### 11.2 Conflict response

Return `REVISION_CONFLICT` with:

- expected and current HEAD;
- affected entity IDs;
- current blob revisions;
- a bounded semantic-neutral diff or changed-field list;
- no unrelated private content.

Do not auto-merge Markdown from two agents. The requesting agent must read the current item and submit a newly reasoned change.

## 12. MCP tool contract

All tools return a common envelope:

```json
{
  "ok": true,
  "data": {},
  "request_id": "req_...",
  "repository_head": "<git-object-id-or-null>"
}
```

Errors return:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary",
    "field_errors": [],
    "retryable": false,
    "retry_after_seconds": null
  },
  "request_id": "req_..."
}
```

Tool results must remain concise. Large Markdown bodies and evidence lists should use pagination or MCP resources when supported.

### 12.1 Context and households

#### `hfj_get_context`

Input: optional `household_id`.

Output: the stable authenticated Fullwell user ID and display data, editable/readable households with roles, default household, pending invitation/import intent, granted scopes, current repository HEADs, and the selected household's snack and recipe onboarding states. The stable user ID is non-secret and lets installed clients isolate resumable local working drafts without using display names. For a selected household, also return both onboarding profile Markdown documents with revisions and a deterministic item identity index capped at 200 entries with an explicit truncation flag. Resolve the repository HEAD, household projection HEAD, membership projection HEAD, onboarding state, profiles, and item index under the household lock; reject drift rather than returning a mixed snapshot. Reject a supplied household ID unless the caller has a current membership before reading repository state.

#### `hfj_update_user_display_name`

Input: `display_name`, `idempotency_key`.

Output: the saved cloud display name and a null repository HEAD. The mutation is account-scoped, requires `journal:write`, and does not require a household or write Git. It records the request fingerprint before changing the user row so an interrupted exact retry can safely repeat the idempotent assignment.

#### `hfj_create_household`

Input: `name`, `idempotency_key`.

Output: household ID, owner role, repository HEAD, and onboarding state.

#### `hfj_select_household`

Input: `household_id`.

Output: selected default household. All later mutation tools still require an explicit household ID.

#### `hfj_update_household_name`

Input: `household_id`, `name`, `expected_head`, `idempotency_key`.

Output: the saved name and new repository HEAD. Only an owner may rename. The normal household mutation pipeline replaces `household.md`, signs one commit, and updates the Neon projection; changed reuse of an idempotency key fails.

#### `hfj_update_onboarding`

Input: `household_id`, section (`snacks` or `recipes`), transition (`start`, bounded `skip`, or `resume`), `expected_revision`, and `idempotency_key`.

Output: the updated per-user section state and current repository HEAD. Owners and editors may mutate their own onboarding state; viewers may only read it. The server compare-and-sets the onboarding row and completes the idempotency record in the same household-scoped Neon transaction. It rejects stale revisions and never accepts a client-authored `complete` transition. `complete` is derived from the canonical `snacks/reports/recurring-snacks.md` or `recipes/reports/recipe-index.md` file in the membership-authorized household repository.

#### `hfj_commit_onboarding`

Input: `household_id`, snapshot `expected_head`, `idempotency_key`, up to one explicit outcome per section, up to one changed profile per onboarding profile, up to 10,000 evidence records, up to 10,000 unique items, canonical reports, and expected revisions for changed existing items. The complete MCP envelope is limited to 16 MiB independently of the record counts; unrelated HTTP and direct tool routes retain the one-megabyte default. A section outcome is either `skip` with a bounded reason and expected onboarding revision, or `complete` with an expected revision. The server rejects duplicate section/profile/item entries, an empty draft, a `complete` outcome without the matching canonical report, a skip for an already-complete section, stale Git or onboarding revisions, invalid evidence references, repository-capacity overflow, and requests outside the HTTP/schema bounds.

Output: final per-user onboarding state, committed IDs and counts, and repository HEAD. Owners and editors may commit. The normal content path creates one signed Git commit, applies rebuilt projections, and compare-and-sets bounded skip outcomes before reporting success. Recovery metadata contains only section, reason, and revision; the reconciliation worker reapplies it after rebuilding a Git-committed request. A skip-only draft completes in one household-scoped operational transaction against the unchanged verified HEAD and does not create an empty Git commit. Repeating the exact request with the same idempotency key returns the original result; reusing the key for different input fails.

#### `hfj_create_family_invite`

Input: `household_id`, `role`, optional intended email hint, expiration, `idempotency_key`, `expected_head`.

Output: one-time URL, expiration, role, and invitation ID. The raw token is returned only in this response.

#### `hfj_accept_family_invite`

Input: raw invitation token, explicit `accept: true`, `idempotency_key`.

Output: household ID, role, and repository HEAD.

#### `hfj_revoke_family_invite`

Input: `household_id`, invitation ID, explicit confirmation, `expected_head`, `idempotency_key`.

Output: invitation ID, revoked timestamp, commit, and repository HEAD. Revocation takes effect in PostgreSQL before the tool returns; reconcile the Git audit commit if a later projection step fails.

#### `hfj_list_members`

Input: `household_id`.

Output: member IDs, display names, roles, joined dates, and pending invitations. Do not return private emails unless the current user is an owner and the invited person supplied it for this purpose.

#### `hfj_update_member`

Input: `household_id`, `member_id`, new role, `expected_head`, `idempotency_key`.

Output: updated member projection and commit.

#### `hfj_remove_member`

Input: `household_id`, `member_id`, explicit confirmation, `expected_head`, `idempotency_key`.

Output: removed member ID and commit. Reject removal of the final owner.

### 12.2 Profiles and private content

#### `hfj_get_profile`

Input: `household_id`, profile type (`household`, `snacks`, `recipes`, or read-only `delivery`).

Output: typed fields, Markdown, blob revision, and repository HEAD.

#### `hfj_update_profile`

Input: `household_id`, profile type (`household`, `snacks`, or `recipes`), typed fields, agent-authored Markdown, expected blob revision, evidence IDs where relevant, `idempotency_key`. Delivery profiles cannot use this generic writer; `hfj_commit_delivery_index` is their only write path.

Output: new blob revision and commit.

#### `hfj_search_items`

Input: `household_id`, query, optional kind (`snack`, `ingredient`, `condiment`, `other_grocery`, `recipe`, or `delivery_dish`), cursor, limit no greater than 100.

Output: bounded summaries with IDs, kind, title, distinguishing fields, image, updated time, and blob revision. Search is a rebuildable projection and must not decide semantic identity.

#### `hfj_get_item`

Input: `household_id` and item ID.

Output: the current item variant, typed frontmatter, full Markdown, cited evidence summaries, blob revision, and repository HEAD. A history-backed delivery dish may resolve its private canonical evidence only for an authorized member; a public-import delivery dish returns import provenance and has no provider/order history.

#### `hfj_append_evidence`

Input: `household_id`, one to 100 typed evidence records, migration ID when applicable, `idempotency_key`, `expected_head`.

Output: evidence IDs, duplicate/replayed IDs, commit, and updated HEAD.

Reject any evidence record that contains credentials, session cookies, raw message bodies beyond allowed minimal summaries, or unknown fields. Stable locators are private by default. This generic tool accepts only non-delivery evidence; delivery-order evidence must use the provider-scoped delivery commit.

#### `hfj_commit_change_set`

Input:

- `household_id`;
- `expected_head`;
- one to 50 typed changes;
- each change's entity kind, entity ID, operation, expected blob revision, typed frontmatter, agent-authored Markdown, evidence IDs, and report assertions;
- `idempotency_key`.

Output: commit, new HEAD, per-entity blob revisions, validation results, and projection checkpoint.

Allowed operations are create item, update item, append correction, update report, and update index for non-delivery items/reports only. `delivery_dish` and `delivery_index` are excluded from this generic writer. The server maps entity kinds to paths; callers never provide arbitrary paths.

### 12.2a Food-delivery history

These four tools are always discoverable but remain provider-neutral. They authorize household journal reads/writes, not browser control or cart mutation.

#### `hfj_search_delivery_history`

Input: `household_id`, bounded query, optional exact provider origin, opaque cursor, and limit no greater than 50 (default 25).

Output: deterministic candidate pages containing an opaque order-group handle, dish name, public provider label, restaurant name, public location label/address, and current item revision. It never returns order/group/merchant/menu locators, dates, counts, fulfillment, account fields, or report prose.

#### `hfj_get_delivery_order`

Input: `household_id` and one opaque group handle returned by delivery search.

Output: one exact complete delivery or pickup order group and current repository revision. The server revalidates membership, every line's provider/order/group/location/fulfillment identity, unique line/evidence keys, declared line count, complete modifiers, and canonical evidence references. A stale, incomplete, cross-household, or invented handle fails closed.

#### `hfj_get_delivery_index`

Input: `household_id`.

Output: the canonical agent-authored `delivery_index` report and its exact document revision. Report prose is read from Git and is not copied into operational search.

#### `hfj_commit_delivery_index`

Input: `connected_audit_checkpoint | local_promotion`, one exact provider label/origin and `household_visibility_confirmed: true` asserted by the agent only after a clear contextual response to that provider's visibility and retention preview, expected household HEAD and delivery profile/report revisions, exact expected and next aggregate delivery profile/report documents, zero to 10,000 new completed delivery evidence records, zero to 10,000 history-backed delivery dishes, expected item revisions, and one provider-scoped idempotency key within the 16 MiB MCP request limit. The server validates the boolean boundary; it does not require or parse scripted confirmation text.

Output: completed mode/provider, evidence and item IDs, and exact profile/report revisions.

The commit is one editor-authorized household mutation. Every submitted evidence/item uses the approved origin, every cited history record is complete, and expected/next aggregate documents preserve every unselected provider and citation exactly. Exact retries return the prior result; changed reuse conflicts; uncertain local promotion does not mark cloud linkage until the response is confirmed.

### 12.3 Household meal planning

The meal-planning server is a bounded storage and authorization boundary, not a recipe search engine or food-safety classifier. A meal slot is an unordered set of immutable proposals. Appending a proposal never replaces another proposal in the same date and slot.

Cloud meal-planning tool discovery, calls, browser navigation, and browser mutations are part of every server deployment. The five tools are always present in authenticated MCP discovery, the household `Meal plans` navigation is always rendered for an authenticated household context, and the authenticated route and form actions are always registered. Membership, OAuth scope, CSRF, role, validation, and idempotency checks remain authoritative. Local agent planning and private recipe boards remain independent. Application rollback must preserve append-only Git data and use a reader compatible with meal-plan paths and projection fields.

#### `hfj_get_meal_plan`

Input: `household_id`, Monday `week_start`, optional proposal cursor, and limit no greater than 500.

Output: the current shared constraint profile, a bounded proposal page, the complete bounded review and withdrawal event set, active state, and effective compatibility. Events are returned independently of proposal pagination, so the default 200-proposal page cannot hide a current review or withdrawal. A proposal becomes `needs_recheck` when its cited constraint-profile revision or journal-recipe revision is no longer current. It remains in Git and in the historical result. Resolve membership, repository HEAD, projection HEAD, profile, proposals, and events under the household lock and reject drift.

A week contains at most 500 immutable proposals and at most 48 proposals in one date-and-slot combination. It separately reserves capacity for 500 constraint-review events and 500 proposal-withdrawal events, so every accepted proposal can still be withdrawn even when the review quota is full. Writers count authoritative projected records by kind under the household lock before appending. Exact limits remain readable and exactly replayable, the next same-kind append returns a bounded validation failure, and any projection already beyond a limit fails closed as `PROJECTION_DRIFT` before the server or browser paginates it.

#### `hfj_update_meal_planning_constraints`

Input: `household_id`, exact `expected_head`, `idempotency_key`, a confirmed IANA time zone, and either explicit no known allergies/sensitivities or bounded user-supplied labels. Unresolved constraints are not accepted.

Output: the new constraint-profile Git revision. The profile is shared with current household members and must not contain member names or medical narratives. It is excluded from public collection projections.

#### `hfj_review_meal_constraints`

Input: `household_id`, Monday `week_start`, current constraint-profile revision, and `idempotency_key`.

Output: one immutable attributed weekly-review event. Owners and editors may append it. The server rechecks the current profile revision and editor membership under the household lock.

#### `hfj_add_meal_proposal`

Input: `household_id`, week/date/slot, bounded free-form, journal-recipe, `journal_delivery_dish`, or credential-free HTTPS external-recipe source, servings, notes, current constraint revision, matching weekly-review event, evidence-based compatibility status and caveat, and `idempotency_key`.

Output: one deterministic immutable proposal ID. Journal recipes must cite the exact current item revision and structured Liked confirmation evidence for that same recipe. A `journal_delivery_dish` source must cite the exact current dish revision and evidence IDs already owned by that item: `delivery_order_line` evidence for a history-backed `ordered before` dish, or import evidence for a public-import `shared dish`. The wrong evidence kind, stale revision, or evidence not cited by the item fails closed. Delivery-dish compatibility is always `incomplete_evidence`; menu titles and history cannot justify `appears_compatible`. Later item or constraint revisions produce effective `needs_recheck` without rewriting the proposal.

The mutation uses the current locked Git HEAD only after rechecking editor membership, but it accepts exactly one server-generated append-only path. Exact retries return the same proposal and commit; changed reuse of the key conflicts. Independent same-slot additions both survive.

#### `hfj_withdraw_meal_proposal`

Input: `household_id`, Monday `week_start`, proposal ID, optional bounded reason, and `idempotency_key`.

Output: one immutable attributed withdrawal event. The proposing actor may withdraw their proposal; a household owner may withdraw any proposal; another editor may not. The proposal document is never deleted or rewritten.

The server never searches the internet, sends constraint terms to a provider, or fetches recipe/image URLs. Those are separately approved host actions. Telemetry contains only bounded tool/request/timing/error fields and never meal titles, URLs, notes, constraint labels, actor display names, or household names.

#### Connected browser week

`GET /households/:id/meal-plan?week=<monday-date>` is an authenticated membership-authorized projection of one week. The server groups every active proposal by date and slot without choosing a winner or collapsing conflicts, emits all seven dates and the standard meal slots even when empty, and adds any custom slots represented by active proposals. Each proposal identifies its proposer, source class, compatibility caveat, and non-color `needs_recheck` state. The page exposes withdrawal only to the proposing actor or a household owner. Constraint labels and medical narratives are never serialized into the browser view model.

The page works without JavaScript. Review, proposal-add, and withdrawal forms use `POST`, server-owned session authentication and CSRF verification, shared runtime validation, idempotency keys, role checks, and post/redirect/get. The simple browser add form appends a bounded free-form proposal with incomplete compatibility evidence and a conservative caveat; external search and journal-recipe evidence selection remain agent workflows. Redirect status parameters are from a fixed allowlist and never contain meal titles, constraint terms, URLs, notes, or actor names.

An exact form replay returns the original mutation result without another commit. Changed reuse of an idempotency key conflicts. Concurrent additions to the same date and slot both remain visible. Anonymous access redirects to sign-in with the exact local return path; missing, removed, and cross-household membership render the same unavailable state. Authenticated week responses are `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.

### 12.4 Collections and import

#### `hfj_create_collection`

Input: `household_id`, title, optional public description, ordered item selections, per-item public field choices, optional source display attribution, `expected_head`, `idempotency_key`.

Output: private collection ID, draft preview, snapshot ID, validation warnings, commit, and HEAD.

Collection creation resolves all source items at the stated revisions. If an item changed, return a conflict rather than sharing an unreviewed version.

#### `hfj_create_collection_share`

Input: `household_id`, collection ID, snapshot ID, expiration of 1, 7, 30, or 90 days, `idempotency_key`.

Output: opaque share URL, expiration, share ID, suggested message, commit, and HEAD. Default expiration is 30 days.

#### `hfj_revoke_collection_share`

Input: `household_id`, share ID, explicit confirmation, `idempotency_key`.

Output: revoked timestamp and audit commit. Revocation in PostgreSQL takes effect before the tool returns, even if the Git audit projection must be reconciled asynchronously.

#### `hfj_preview_shared_collection`

Input: raw share token, optional cursor.

Output: public snapshot only, expiration, source display attribution, and collection-local item IDs. A valid token requires no source-household membership; the MCP transport may still require its normal OAuth session. Apply strict rate limits.

#### `hfj_plan_collection_import`

Input: destination household ID, raw share token, selected collection-local item IDs.

Output for every selection:

- `new`;
- `exact_import_duplicate`, based on source snapshot provenance;
- `possible_duplicate`, with candidates based only on deterministic fields such as exact canonical recipe URL or exact structured snack identity tuple;
- allowed decisions.

This tool does not merge or mutate.

#### `hfj_import_collection_items`

Input: destination household ID, raw share token, selected item IDs, explicit per-item decisions, expected destination HEAD, `idempotency_key`.

Output: imported destination IDs, skipped IDs, merge targets, import event ID, commit, and HEAD.

The import is one destination-household commit. Never access the source household repository through an imported token; use only the already published snapshot.

#### `hfj_export_household`

Input: household ID, format (`readable_zip` or `git_bundle`), `idempotency_key`.

Output: short-lived authenticated download URL, content hash, source HEAD, and expiration.

## 13. Collection sharing and public web

### 13.1 Share-token security

- Generate 32 random bytes and encode with unpadded base64url.
- Store only an HMAC of the token with a rotating server-side pepper.
- Use constant-time comparison.
- Never place tokens in logs, analytics, error reporting, or Git.
- Mark responses `Cache-Control: private, no-store` unless a reviewed public cache design preserves revocation.
- Set `Referrer-Policy: no-referrer` so tokens do not leak through outbound recipe or image links.
- Set `X-Robots-Tag: noindex, nofollow, noarchive`.
- Rate-limit by token hash and network signals without building a cross-site tracking profile.

### 13.2 Public routes

| Route | Purpose |
|---|---|
| `GET /install` | Branded ChatGPT/Claude platform chooser and current client installation instructions. |
| `GET /guides` | Public advanced-agent guide index. |
| `GET /guides/whatsapp` | WhatsApp connection instructions and safe chat example. |
| `GET /guides/household-invitations` | Household invitation instructions and role-aware chat example. |
| `GET /guides/collections/create` | Collection creation instructions and chat example. |
| `GET /guides/collections/share` | Collection publishing instructions and confirmation boundary. |
| `GET /invite/family/:token` | Safe invitation preview and sign-in/accept flow. |
| `POST /invite/family/:token/accept` | Explicit authenticated acceptance with CSRF protection. |
| `GET /c/:token` | Public-safe collection preview. |
| `POST /c/:token/import/plan` | Authenticated duplicate plan for selected items. |
| `POST /c/:token/import` | Authenticated confirmed import. |
| `GET /account` | Sign-in methods, passkeys, MCP grants, households, exports, deletion. |
| `GET /households/:id` | Minimal authenticated household/member/collection management UI. |
| `GET /households/:id/recipes` | Membership-authorized visual recipe journal with bounded progressive loading. |
| `GET /households/:id/groceries` | Membership-authorized visual grocery journal with bounded progressive loading. |
| `GET /households/:id/takeout` | Membership-authorized visual delivery-dish journal with exact public restaurant locations. |
| `GET /households/:id/journal-items?section=<section>&cursor=<cursor>&snapshotRevision=<head>` | Membership-authorized, no-store continuation projection for a recipe, grocery, or Takeout browser. |
| `GET /households/:id/meal-plan?week=<monday-date>` | Membership-authorized seven-day meal proposal view. |
| `POST /households/:id/meal-plan/review` | CSRF-protected weekly constraint review. |
| `POST /households/:id/meal-plan/proposals` | CSRF-protected append-only free-form proposal. |
| `POST /households/:id/meal-plan/proposals/:proposalId/withdraw` | Authorized append-only proposal withdrawal. |

The public guide routes contain examples only and never receive credentials, access codes, or mutation confirmations. Contextual install, account, members, collection, and household links target the narrowest relevant guide.

The recipe, grocery, and Takeout document routes are server rendered and then progressively enhanced. They use the same deterministic, display-only server projection as the continuation endpoint, return recorded fields without semantic merging, and expose a normal page link when JavaScript or automatic loading is unavailable. Takeout sorts by restaurant, exact public location, dish, and item ID; history-backed cards resolve only allowlisted display fields from cited completed-order evidence, while public imports remain labeled `Shared dish` without history or reorder authority. Provider origins and order, group, merchant, menu, evidence, actor, destination, and complete-order data are never serialized.

Every document and continuation request re-resolves the browser principal, current membership, and Git-synchronized projection; anonymous, removed, cross-household, or stale callers receive no item data. Responses are private, no-store, and noindex. JavaScript continuations bind the initial repository HEAD through `snapshotRevision` and fail with a refresh-required conflict if the household changes; ordinary `?page=N` no-JavaScript requests intentionally render a fresh bounded prefix from the current HEAD. Client continuation parsing is strict, failures remain visible and retryable, duplicate item IDs do not render twice, and the end of the bounded list is announced.

The four meal-plan routes are always registered. Unauthenticated reads use the normal sign-in redirect, and every read or mutation still applies the authorization and CSRF behavior defined above.

Collection pages must be usable at 320 CSS pixels, keyboard accessible, labeled for screen readers, and functional without client-side JavaScript except enhanced share-sheet behavior.

### 13.3 Email and text sharing

Version 1 does not require the server to send SMS or read contacts.

Provide:

- Web Share API action when available;
- Copy link;
- user-initiated email draft;
- user-initiated text-message draft on supported devices;
- a short suggested message returned by the tool and page.

Never transmit a message until the user confirms it in their chosen mail or messaging application. Do not request address-book access.

### 13.4 Images and outbound links

Store image URLs and audited-page provenance. In version 1, do not fetch arbitrary external images server-side; this avoids an SSRF surface and accidental copying of third-party assets. Render external HTTPS images with a restrictive Content Security Policy, `referrerpolicy="no-referrer"`, lazy loading, dimensions, meaningful alt text, and a visible fallback.

Treat collection text and linked pages as untrusted data. Escape all text and sanitize any supported Markdown subset. Never render raw household HTML.

## 14. Import rules

### 14.1 Provenance

Every import record includes:

- destination import ID;
- source collection ID as a public opaque identifier;
- source snapshot ID;
- source collection-local item ID;
- source item revision;
- source display attribution;
- imported timestamp;
- importing actor ID;
- user-selected duplicate decision;
- resulting destination item ID.

Do not copy the source household ID or private actor IDs.

### 14.2 Status effects

- Recipe import may create `Saved: yes` because selective import is direct evidence of intentional saving.
- Recipe import leaves `Cooked` and `Liked` unknown unless destination evidence already supports another value.
- Snack import creates a remembered/recommended item only. It does not create purchase evidence, recurrence, liked status, or a pantry-restock assertion.
- Delivery-dish import creates a public-import `delivery_dish` plus one import evidence record. It does not copy provider/order/group/merchant/menu locators, order dates, modifiers, fulfillment, recurrence, or reorder authority and cannot satisfy `hfj_get_delivery_order`.
- Merge decisions preserve destination evidence and append imported provenance. They never replace newer destination facts silently.

### 14.3 Duplicate behavior

Exact repeat imports are idempotent and default to skip. Possible duplicates require explicit user or agent resolution. The server may identify candidates but must not make a semantic merge decision.

## 15. WhatsApp Restocking Gateway

WhatsApp restocking uses direct Meta Cloud API integration. Twilio, a BSP, or another middleware messaging vendor is not part of the data path. The server is a transport gateway only: it must not inspect household grocery content, call an LLM, infer a product or store, browse a retailer, or mutate a cart.

The signed webhook boundary verifies `X-Hub-Signature-256` against the exact bounded raw request body before JSON parsing. It accepts bounded text and delivery-status events, records unsupported event counts without reflecting provider content, HMACs provider/sender/delivery identifiers for lookup, encrypts message and destination bodies with authenticated encryption, and transactionally deduplicates provider retries before enforcing queue capacity.

Linking requires both sides. A recently authenticated browser creates a hashed, single-use, ten-minute challenge bound to one user, household, browser session, and registered primary runner. A valid signed WhatsApp message consumes the challenge and creates a pending link. The same browser session explicitly confirms it before that sender can route work. Revocation immediately disables the link and device and prevents claims and pre-action authorization.

The gateway serializes work to one primary device with an exclusive 90-second renewable lease, at most eight open envelopes per link and 1,000 globally. Message bodies expire within seven days. A `needs_input` terminal result becomes `awaiting_user`; the next linked inbound text resumes the same envelope and local host session. When replies were gated during host execution, the next authenticated claim retries the encrypted `response_ready` result before returning new work, without requiring another inbound message. Provider delivery receipts store only a hashed delivery ID, bounded status/failure class, and timestamps.

The runner snapshot route is membership-authorized and read-only. It returns an ETag/HEAD, content hash, bounded manifest, and archive containing only the compatibility snack profile and report, all snack/ingredient/condiment/other-grocery items, current `groceries/evidence/`, legacy `snacks/evidence/`, and the format marker. Archive paths, modes, types, file counts, individual sizes, total size, hashes, and HEAD are validated. The browser and runner never receive Git credentials.

Before a local cart mutation, the runner revalidates its OAuth grant, device, provider link, membership, and authoritative HEAD. The server does not receive the selected item, store, cart quantity, browser state, or local action receipt. Local results are relayed only while the user-opened 24-hour service window remains valid and the compiled zero-cost cutoff has not arrived.

No template-send operation exists. Configuration may move the compiled `2026-10-01T00:00:00-07:00` cutoff earlier but not later. At or after it, valid webhooks are acknowledged but no cart work is enqueued, claimed, or replied to. Re-enabling requires an explicit product/code change that accepts a bounded paid-message policy.

## 16. Operational database

Minimum tables:

- `users`
- `external_identities`
- `passkey_credentials`
- `login_challenges`
- `web_sessions`
- `oauth_clients`
- `oauth_authorization_codes`
- `oauth_grants`
- `oauth_access_tokens`
- `oauth_refresh_tokens`
- `households`
- `household_memberships`
- `family_invitations`
- `collection_shares`
- `mutation_requests`
- `repository_projections`
- `search_items`
- `backup_checkpoints`
- `reconciliation_jobs`
- `onboarding_preferences`

Use explicit foreign keys, unique constraints, expiry indexes, and row-level application authorization. Secrets and raw tokens must be encrypted or hashed as appropriate. Migrations require forward and rollback instructions; destructive data migrations require a verified backup and a staged rehearsal.

The service must be able to rebuild `household_memberships`, content search projections, and repository checkpoints from repositories plus private identity mappings. OAuth and session state is intentionally not rebuilt from Git.

## 17. Security requirements

### 17.1 Tenant isolation

Every request resolves an authenticated user and explicit household ID before reading a repository. Test all cross-household permutations. A repository path, item ID, share ID, or mutation ID from another household must return a non-enumerating not-found/forbidden response.

### 17.2 Git safety

- Do not expose a Git network port.
- Do not accept arbitrary refs, revisions, paths, commit messages, authors, or Git arguments from clients.
- Disable hooks in mutation worktrees unless a reviewed server-owned hook is required.
- Set a safe fixed environment for Git subprocesses.
- Enforce file-count, file-size, request-size, and commit-size limits.
- Reject symlinks, submodules, executable files, and path traversal.
- Sign commits and verify signatures during backup and restore drills.
- Prohibit force updates and deletion of `main`.

### 17.3 Web and OAuth safety

- TLS only, with HSTS in production.
- Secure, HttpOnly, SameSite cookies.
- CSRF protection on browser mutations.
- Exact redirect allowlists.
- PKCE S256 for public OAuth clients.
- Rotate refresh tokens and detect reuse.
- Hash invitation, share, magic-link, and download tokens.
- Rate-limit sign-in, token, preview, invite, import, and MCP endpoints.
- Use generic account-discovery responses.
- Reauthenticate for household deletion, final-owner transfer, and global grant revocation.

The single-writer server enforces a 300-request-per-minute per-client-IP baseline after exactly one trusted Caddy proxy hop. Stricter grouped limits apply to sign-in starts (10 per 15 minutes), sign-in completions (20 per 15 minutes), OAuth registration (10 per hour), OAuth token exchange (30 per minute), MCP (120 per minute), public collection preview (60 per minute), collection import (30 per 15 minutes), export creation (10 per hour), and export download (20 per 15 minutes). A rejected request returns `RATE_LIMITED`, `Retry-After`, and a bounded retry delay. Liveness and readiness remain unthrottled; operator health and metrics allow 120 authenticated scrapes per minute.

Rate-limit keys never include tokens, emails, household IDs, or user-authored content. The in-process store is valid only for the documented single-writer topology; a multi-instance deployment requires a shared supported store and a new abuse/race review.

### 17.4 Content safety

- Treat imported collections, recipe pages, evidence summaries, and model-authored Markdown as untrusted input.
- Escape output and sanitize Markdown.
- Do not execute content, macros, HTML, shell fragments, or instructions found in food records.
- Never let recipe text change MCP/server instructions.
- Enforce allowed URL schemes (`https`, and reviewed `http` exceptions only for local development).
- Avoid server-side URL fetches in version 1.

### 17.5 Privacy

Classify order references, source locators, cooking notes, and household membership as private. Keep raw request bodies out of logs. Use structured redaction before telemetry. Public collection serialization must be an allowlist projection with snapshot tests proving that private fields cannot appear.

## 18. Backup, audit durability, and recovery

Git history can be rewritten by an administrator, so central Git alone is not sufficient evidence of untampered history.

Implement:

- signed commits;
- daily signed manifest containing each household ID, current HEAD, object count, and backup hash;
- encrypted `git bundle` backups to a separate provider or account;
- immutable/object-locked retention for a defined period;
- PostgreSQL point-in-time recovery or equivalent managed backups;
- periodic `git fsck` and signature verification;
- monthly restore drills into an isolated environment;
- alerting on non-fast-forward refs, missing objects, signature failure, or repository/database projection mismatch.

Version 1 uses authenticated compact JWE with `dir`/`A256GCM` for client-side bundle and signed-manifest encryption, Ed25519 compact JWS for canonical manifests, and a generic S3-compatible adapter configured for a private Backblaze B2 bucket in a separate account. Each upload must request compliance Object Lock and verify the returned length, ciphertext hash metadata, retention mode, and retention deadline before writing `backup_checkpoints`. Runtime object credentials must not have delete capability. Unchanged checkpoints younger than 23 hours may be skipped; successful restore evidence must be refreshed within 30 days.

Recovery objectives for version 1:

- RPO: 24 hours maximum for catastrophic primary-volume loss, with a target of 1 hour once incremental bundles are implemented;
- RTO: 8 hours maximum;
- no successful mutation may be reported before its commit is durable on primary storage;
- backup status must be visible to operators, not end users unless degraded.

Document restore steps and test them before launch.

## 19. Reconciliation and failure handling

Provide an idempotent reconciler that can:

- finish a database projection after a Git commit;
- recognize a prior commit by request ID after a retry;
- rebuild search from repository files;
- repair a missing membership projection from signed Git history plus private identity mapping;
- complete a share revocation audit after immediate database revocation;
- mark a failed provisioning repository safe to retry;
- quarantine a repository with invalid signatures or schema violations.

Do not catch broad exceptions and return success-shaped defaults. Each failed operation records a bounded failure code, retryability, and operator correlation ID. Never include private content in the error.

## 20. Observability

Emit structured metrics and logs for:

- authentication and OAuth success/failure by safe category;
- MCP request count, latency, and tool name;
- Git mutation duration and outcome;
- lock wait time;
- conflict count;
- idempotent replay count;
- reconciliation lag;
- invitation and share creation/acceptance/revocation;
- collection preview and import success without recording tokens or item titles;
- repository validation failures;
- backup age, fsck status, signature status, and restore-drill result.

Use request IDs across HTTP, MCP, PostgreSQL mutation rows, Git trailers, and operator logs. Do not use household titles, recipe names, order IDs, URLs, emails, or share tokens as metric labels.

## 21. Accessibility and user experience

All public and authenticated web flows must:

- meet WCAG 2.2 AA for supported interactions;
- work with keyboard and screen readers;
- use clear focus states and error summaries;
- avoid relying on color alone;
- preserve selected import items through sign-in and recoverable errors;
- show destructive confirmations in plain language;
- present Account actions that require `LEAVE`, `DELETE`, or `REVOKE` as cancellable modal dialogs in hydrated browsers, with Cancel, Escape, backdrop dismissal, and focus restoration; supply the existing server-validated literal only after the user confirms, while retaining an exact typed fallback inside `noscript`;
- explain family role effects before invitation acceptance;
- show exactly which fields a collection publishes;
- clearly distinguish `Join household` from `Import selected`.

The UI should use household and food language, not Git, repository, MCP, OAuth, token, or commit terminology. Technical export details may appear only in an advanced export panel.

## 22. Testing requirements

### 22.1 Unit tests

Target 100% line and branch coverage for:

- domain schemas and state transitions;
- public collection allowlist projection;
- invitation/share expiration and hashing;
- idempotency state machine;
- role authorization;
- Git path mapping and command construction;
- append-only validation;
- report assertion validation;
- import provenance and duplicate-candidate detection;
- OAuth redirect, scope, and token validation;
- error mapping and redaction.

### 22.2 Git integration tests

Use real temporary repositories and the real supported Git executable. Test:

- repository provisioning;
- signed commit creation with a test key;
- one commit per mutation;
- append-only rejection;
- expected-HEAD conflicts;
- concurrent mutations serialized by household;
- crash after commit/before projection and successful reconciliation;
- idempotent retry finding the existing commit;
- export bundles, `git fsck`, signature verification, and restore.

### 22.3 Database integration tests

Run against the supported PostgreSQL version. Test constraints, expiry cleanup, token reuse detection, invitation races, final-owner protection, cross-tenant authorization, advisory locks, migration rollback, and projection rebuilds.

### 22.4 OAuth and MCP contract tests

Test protected-resource metadata, authorization metadata, dynamic registration, PKCE, redirect validation, token-request resource indicators, scopes, refresh rotation, lifecycle notifications, revocation, and tool schemas using current Codex and Claude clients in addition to protocol-level fixtures.

Publish a machine-readable tool schema artifact consumed by the client repository's contract tests. Breaking schema changes require a versioned migration and coordinated client release.

### 22.5 Browser end-to-end tests

Cover:

1. Continue with Apple using a safe test identity or provider simulator.
2. Passkey registration and sign-in using WebAuthn virtual authenticators.
3. Magic-link sign-in.
4. Pending family invitation through sign-in and explicit acceptance.
5. Public collection preview on mobile and desktop.
6. Selective import with two selected of five.
7. Exact duplicate skip and possible-duplicate choice.
8. Share revocation while a preview is open.
9. Expiration handling.
10. Web Share fallback to copy/email/text drafts.
11. Account deletion and final-owner protection.
12. Connected meal-plan authorization, all seven dates, concurrent same-slot proposals, stale-review warnings, exact retry/conflict behavior, ordinary no-JavaScript forms, and 320 CSS-pixel rendering.
13. Direct public guide routes and contextual links for WhatsApp, household invitations, collection creation, and collection sharing.
14. Recipe, grocery, and Takeout browsers on desktop, mobile, keyboard, reduced-motion, and no-JavaScript paths, including automatic and explicit continuation, retry, snapshot binding, deduplication, image fallback, and end-of-list states.
15. Anonymous, removed-member, stale-projection, and cross-household visual-journal denial without private item serialization.

### 22.6 Security tests

Include tests for cross-household ID substitution, token enumeration, CSRF, open redirects, stored/reflected XSS, malicious Markdown, prompt-injection text, path traversal, Git argument injection, symlink/submodule insertion, oversized input, replay, refresh-token reuse, share-token leakage through referrers, and log redaction.

Malformed JSON, unsupported media types, and oversized request bodies must fail as bounded, non-reflecting 4xx responses. Browser-rendered URL fields must accept only HTTP(S), and production browser builds must not publish source maps or read server-secret environment variables.

No new LLM-involved server behavior may ship without evals. The server should not call an LLM in version 1; semantic reasoning belongs to the connected Codex or Claude client.

## 23. Deployment

Deploy one containerized application process on one DigitalOcean Droplet initially, with:

- a public HTTPS domain;
- optional HTTPS brand aliases that terminate at the gateway and permanently preserve path and query while redirecting to the sole application origin;
- DigitalOcean Block Storage mounted at `/data/households` for repositories and temporary worktrees;
- Neon PostgreSQL, using pooled runtime connections and direct migration/administrative connections;
- secret-manager injection for Apple credentials, OAuth signing/encryption keys, HMAC peppers, email provider credentials, and Git signing key;
- outbound email for magic links and security notices;
- scheduled reconciliation, expiry cleanup, backup, fsck, and manifest jobs;
- encrypted off-site backup in a separate failure domain.

Do not deploy the authoritative repository store on DigitalOcean App Platform or any ephemeral container filesystem. Do not place live `.git` directories on the Droplet root filesystem, in Dropbox, iCloud Drive, Google Drive, or another desktop sync folder.

An alias domain must not become a second application origin. Browser sessions, passkey RP ID, Apple callbacks, OAuth issuer and resource metadata, MCP configuration, and absolute application links remain bound to the configured canonical public domain.

Database releases must run through an explicit one-shot migration command, never application startup. The command must bind to an operator-supplied exact direct host, reject pooled or non-TLS endpoints, require an additional production confirmation, serialize with a database advisory lock, record a content hash for every applied migration, and reject changes to applied migration files.

Before horizontal scaling, prove that transaction-scoped Neon advisory locking, shared persistent repository storage, Git filesystem semantics, writer fencing, and split-brain prevention are safe on the chosen platform. Otherwise remain single-instance with a documented Droplet and volume failover procedure.

## 24. Delivery phases

### Phase 1: Foundation

- Scaffold the typed service, database migrations, auth boundary, Git adapter, repository schema, and test harness.
- Implement signed repository provisioning, mutation records, locks, idempotency, and reconciliation.
- Implement `hfj_get_context`, `hfj_create_household`, and a read-only MCP health flow.

### Phase 2: Authentication and household collaboration

- Implement Continue with Apple, passkeys, magic links, MCP OAuth, roles, family invitations, membership projection, and account lifecycle.
- Prove separate audit identity for two users in one household.

### Phase 3: Journal storage

- Implement profiles, evidence append, typed item storage, reports, search projection, conflict responses, existing-workspace migration, and exports.
- Integrate the companion client's existing snack and recipe skills.

### Phase 4: Collections

- Implement collection drafts, public-safe snapshots, share/revoke, public preview, selective import, provenance, and duplicate planning.
- Complete email/text share drafts and installation handoff pages.

### Phase 5: Production hardening

- Complete security review, accessibility audit, load and race tests, backup/restore drills, OAuth interoperability matrix, observability, operator runbooks, privacy policy, terms, changelog, and rollback plan.

Every phase must ship with its tests and migrations. Do not defer foundational authorization, idempotency, audit, or backup work to a post-launch phase.

## 25. Definition of done

The server is complete when:

- users can sign up/in with Apple, passkey, or magic link without a service password;
- Codex and Claude authenticate through standards-compliant MCP OAuth;
- each household has an isolated signed Git repository;
- the server is the only Git writer;
- mutation retries are idempotent and concurrent writes cannot silently overwrite;
- family invitations are one-time, explicit, role-aware, and audited;
- every accepted journal mutation has evidence, an audit event, and one signed commit;
- agents, not server code, make semantic food and report decisions;
- public collection serialization is allowlist-only and proven not to leak private fields;
- collection links work through email/text sharing and can be revoked or expire;
- recipients can selectively import with correct status semantics and provenance;
- imported snacks do not become purchases and imported recipes do not become cooked/liked;
- the public site identifies ChatGPT, Claude, and Apple actions with recognizable decorative marks and visible accessible names;
- advanced-agent guides have stable task-specific routes, safe examples, and correct contextual links;
- authorized household members can browse recorded recipes, groceries, and exact-location Takeout dishes through bounded, progressively loaded visual projections with a no-JavaScript path;
- household ZIP and Git bundle exports work and verify;
- backup and isolated restore drills pass;
- deterministic tests meet the coverage target and all integration, browser, client-contract, security, and accessibility gates pass;
- deployment and rollback procedures have been exercised in staging.

## 26. Implementation references

Verify protocol details against current primary documentation before coding and again before release:

- MCP authorization specification: <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
- OAuth Protected Resource Metadata: <https://www.rfc-editor.org/info/rfc9728/>
- OpenAI MCP authentication: <https://developers.openai.com/api/docs/mcp#handle-authentication>
- Claude remote MCP: <https://code.claude.com/docs/en/mcp>
- Claude custom remote connectors: <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
- Sign in with Apple: <https://developer.apple.com/documentation/signinwithapple>
- Sign in with Apple REST API: <https://developer.apple.com/documentation/signinwithapplerestapi>
- Apple passkeys: <https://developer.apple.com/passkeys/>
