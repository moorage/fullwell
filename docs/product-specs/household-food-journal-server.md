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

## 2. Product decisions

These decisions are normative for version 1.

1. The service runs Git and is the only Git writer.
2. Each household has a separate repository and a separate authorization boundary.
3. Git is authoritative for household content and its audit history.
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
- React and React DOM 19.2 for sign-in, invitations, collection preview, Web Share, import, account, and installation browser flows;
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
- rotated refresh tokens with reuse detection;
- token revocation;
- resource and audience validation;
- scoped consent;
- support for the client registration/discovery mechanisms currently required by both Codex and Claude, including Client ID Metadata Documents and Dynamic Client Registration when those hosts require them.

Initial scopes:

| Scope | Permission |
|---|---|
| `journal:read` | Read households, profiles, items, reports, and private collections available to the user. |
| `journal:write` | Append evidence and propose content changes in editable households. |
| `household:manage` | Create households and manage invitations/members when the household role permits it. |
| `collection:share` | Publish and revoke collection snapshots. |
| `journal:export` | Request portable exports. |

Scopes do not override household roles. A token with `journal:write` still cannot write a viewer-only household.

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

## 8. Household collaboration

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
snacks/
  evidence/<year>/<evidence-id>.json
  items/<snack-id>.md
  reports/recurring-snacks.md
recipes/
  evidence/<year>/<evidence-id>.json
  items/<recipe-id>.md
  reports/recipe-index.md
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

- `snacks/evidence/`
- `recipes/evidence/`
- `imports/`
- `audit/`
- `collections/*/snapshots/`

A correction is a new event that references the superseded event. Repository validation must reject a change set that alters an existing append-only blob.

### 9.5 Mutable current-state paths

Profiles, item entries, reports, member projections, and private collection definitions may change. Git history preserves their earlier versions. Every update must cite relevant evidence and use an expected blob object ID or expected repository HEAD.

## 10. Domain contracts

Define semantic TypeScript types and runtime schemas for every boundary. The following fields are the minimum contract.

### 10.1 Evidence

Common fields:

- `id`
- `kind`: `purchase`, `recipe_discovery`, `cooking`, `user_confirmation`, `import`, or `correction`
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

### 10.2 Snack item

Typed frontmatter must include:

- `id`
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

The Markdown body may contain agent-authored identity reasoning, pantry notes, source examples, recurrence assertions, and restock notes.

Server validation may verify that a submitted recurrence count equals the number of distinct cited private order keys. It must not choose which line items belong to the snack item.

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

A snapshot contains only public-safe fields:

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

Output: user display data, editable/readable households with roles, default household, pending invitation/import intent, granted scopes, and current repository HEADs.

#### `hfj_create_household`

Input: `name`, `idempotency_key`.

Output: household ID, owner role, repository HEAD, and onboarding state.

#### `hfj_select_household`

Input: `household_id`.

Output: selected default household. All later mutation tools still require an explicit household ID.

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

Input: `household_id`, profile type (`household`, `snacks`, or `recipes`).

Output: typed fields, Markdown, blob revision, and repository HEAD.

#### `hfj_update_profile`

Input: `household_id`, profile type, typed fields, agent-authored Markdown, expected blob revision, evidence IDs where relevant, `idempotency_key`.

Output: new blob revision and commit.

#### `hfj_search_items`

Input: `household_id`, query, kinds, cursor, limit no greater than 100.

Output: bounded summaries with IDs, kind, title, distinguishing fields, image, updated time, and blob revision. Search is a rebuildable projection and must not decide semantic identity.

#### `hfj_get_item`

Input: `household_id`, item kind, item ID, optional evidence cursor.

Output: typed frontmatter, full Markdown, cited evidence summaries, blob revision, and repository HEAD.

#### `hfj_append_evidence`

Input: `household_id`, one to 100 typed evidence records, migration ID when applicable, `idempotency_key`, `expected_head`.

Output: evidence IDs, duplicate/replayed IDs, commit, and updated HEAD.

Reject any evidence record that contains credentials, session cookies, raw message bodies beyond allowed minimal summaries, or unknown fields. Stable locators are private by default.

#### `hfj_commit_change_set`

Input:

- `household_id`;
- `expected_head`;
- one to 50 typed changes;
- each change's entity kind, entity ID, operation, expected blob revision, typed frontmatter, agent-authored Markdown, evidence IDs, and report assertions;
- `idempotency_key`.

Output: commit, new HEAD, per-entity blob revisions, validation results, and projection checkpoint.

Allowed operations are create item, update item, append correction, update report, and update index. The server maps entity kinds to paths; callers never provide arbitrary paths.

### 12.3 Collections and import

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
| `GET /install` | Platform chooser and current client installation instructions. |
| `GET /invite/family/:token` | Safe invitation preview and sign-in/accept flow. |
| `POST /invite/family/:token/accept` | Explicit authenticated acceptance with CSRF protection. |
| `GET /c/:token` | Public-safe collection preview. |
| `POST /c/:token/import/plan` | Authenticated duplicate plan for selected items. |
| `POST /c/:token/import` | Authenticated confirmed import. |
| `GET /account` | Sign-in methods, passkeys, MCP grants, households, exports, deletion. |
| `GET /households/:id` | Minimal authenticated household/member/collection management UI. |

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
- Merge decisions preserve destination evidence and append imported provenance. They never replace newer destination facts silently.

### 14.3 Duplicate behavior

Exact repeat imports are idempotent and default to skip. Possible duplicates require explicit user or agent resolution. The server may identify candidates but must not make a semantic merge decision.

## 15. Operational database

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

Use explicit foreign keys, unique constraints, expiry indexes, and row-level application authorization. Secrets and raw tokens must be encrypted or hashed as appropriate. Migrations require forward and rollback instructions; destructive data migrations require a verified backup and a staged rehearsal.

The service must be able to rebuild `household_memberships`, content search projections, and repository checkpoints from repositories plus private identity mappings. OAuth and session state is intentionally not rebuilt from Git.

## 16. Security requirements

### 16.1 Tenant isolation

Every request resolves an authenticated user and explicit household ID before reading a repository. Test all cross-household permutations. A repository path, item ID, share ID, or mutation ID from another household must return a non-enumerating not-found/forbidden response.

### 16.2 Git safety

- Do not expose a Git network port.
- Do not accept arbitrary refs, revisions, paths, commit messages, authors, or Git arguments from clients.
- Disable hooks in mutation worktrees unless a reviewed server-owned hook is required.
- Set a safe fixed environment for Git subprocesses.
- Enforce file-count, file-size, request-size, and commit-size limits.
- Reject symlinks, submodules, executable files, and path traversal.
- Sign commits and verify signatures during backup and restore drills.
- Prohibit force updates and deletion of `main`.

### 16.3 Web and OAuth safety

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

### 16.4 Content safety

- Treat imported collections, recipe pages, evidence summaries, and model-authored Markdown as untrusted input.
- Escape output and sanitize Markdown.
- Do not execute content, macros, HTML, shell fragments, or instructions found in food records.
- Never let recipe text change MCP/server instructions.
- Enforce allowed URL schemes (`https`, and reviewed `http` exceptions only for local development).
- Avoid server-side URL fetches in version 1.

### 16.5 Privacy

Classify order references, source locators, cooking notes, and household membership as private. Keep raw request bodies out of logs. Use structured redaction before telemetry. Public collection serialization must be an allowlist projection with snapshot tests proving that private fields cannot appear.

## 17. Backup, audit durability, and recovery

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

Recovery objectives for version 1:

- RPO: 24 hours maximum for catastrophic primary-volume loss, with a target of 1 hour once incremental bundles are implemented;
- RTO: 8 hours maximum;
- no successful mutation may be reported before its commit is durable on primary storage;
- backup status must be visible to operators, not end users unless degraded.

Document restore steps and test them before launch.

## 18. Reconciliation and failure handling

Provide an idempotent reconciler that can:

- finish a database projection after a Git commit;
- recognize a prior commit by request ID after a retry;
- rebuild search from repository files;
- repair a missing membership projection from signed Git history plus private identity mapping;
- complete a share revocation audit after immediate database revocation;
- mark a failed provisioning repository safe to retry;
- quarantine a repository with invalid signatures or schema violations.

Do not catch broad exceptions and return success-shaped defaults. Each failed operation records a bounded failure code, retryability, and operator correlation ID. Never include private content in the error.

## 19. Observability

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

## 20. Accessibility and user experience

All public and authenticated web flows must:

- meet WCAG 2.2 AA for supported interactions;
- work with keyboard and screen readers;
- use clear focus states and error summaries;
- avoid relying on color alone;
- preserve selected import items through sign-in and recoverable errors;
- show destructive confirmations in plain language;
- explain family role effects before invitation acceptance;
- show exactly which fields a collection publishes;
- clearly distinguish `Join household` from `Import selected`.

The UI should use household and food language, not Git, repository, MCP, OAuth, token, or commit terminology. Technical export details may appear only in an advanced export panel.

## 21. Testing requirements

### 21.1 Unit tests

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

### 21.2 Git integration tests

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

### 21.3 Database integration tests

Run against the supported PostgreSQL version. Test constraints, expiry cleanup, token reuse detection, invitation races, final-owner protection, cross-tenant authorization, advisory locks, migration rollback, and projection rebuilds.

### 21.4 OAuth and MCP contract tests

Test protected-resource metadata, authorization metadata, PKCE, redirect validation, scopes, refresh rotation, revocation, and tool schemas using current Codex and Claude clients in addition to protocol-level fixtures.

Publish a machine-readable tool schema artifact consumed by the client repository's contract tests. Breaking schema changes require a versioned migration and coordinated client release.

### 21.5 Browser end-to-end tests

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

### 21.6 Security tests

Include tests for cross-household ID substitution, token enumeration, CSRF, open redirects, stored/reflected XSS, malicious Markdown, prompt-injection text, path traversal, Git argument injection, symlink/submodule insertion, oversized input, replay, refresh-token reuse, share-token leakage through referrers, and log redaction.

No new LLM-involved server behavior may ship without evals. The server should not call an LLM in version 1; semantic reasoning belongs to the connected Codex or Claude client.

## 22. Deployment

Deploy one containerized application process on one DigitalOcean Droplet initially, with:

- a public HTTPS domain;
- DigitalOcean Block Storage mounted at `/data/households` for repositories and temporary worktrees;
- Neon PostgreSQL, using pooled runtime connections and direct migration/administrative connections;
- secret-manager injection for Apple credentials, OAuth signing/encryption keys, HMAC peppers, email provider credentials, and Git signing key;
- outbound email for magic links and security notices;
- scheduled reconciliation, expiry cleanup, backup, fsck, and manifest jobs;
- encrypted off-site backup in a separate failure domain.

Do not deploy the authoritative repository store on DigitalOcean App Platform or any ephemeral container filesystem. Do not place live `.git` directories on the Droplet root filesystem, in Dropbox, iCloud Drive, Google Drive, or another desktop sync folder.

Before horizontal scaling, prove that transaction-scoped Neon advisory locking, shared persistent repository storage, Git filesystem semantics, writer fencing, and split-brain prevention are safe on the chosen platform. Otherwise remain single-instance with a documented Droplet and volume failover procedure.

## 23. Delivery phases

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

## 24. Definition of done

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
- household ZIP and Git bundle exports work and verify;
- backup and isolated restore drills pass;
- deterministic tests meet the coverage target and all integration, browser, client-contract, security, and accessibility gates pass;
- deployment and rollback procedures have been exercised in staging.

## 25. Implementation references

Verify protocol details against current primary documentation before coding and again before release:

- MCP authorization specification: <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
- OAuth Protected Resource Metadata: <https://www.rfc-editor.org/info/rfc9728/>
- OpenAI MCP authentication: <https://developers.openai.com/api/docs/mcp#handle-authentication>
- Claude remote MCP: <https://code.claude.com/docs/en/mcp>
- Claude custom remote connectors: <https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>
- Sign in with Apple: <https://developer.apple.com/documentation/signinwithapple>
- Sign in with Apple REST API: <https://developer.apple.com/documentation/signinwithapplerestapi>
- Apple passkeys: <https://developer.apple.com/passkeys/>
