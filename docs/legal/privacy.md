# Fullwell Privacy Notice

Effective date: 2026-07-24

Fullwell is a product operated by Sous Chef Studio, Inc. In this notice, “Fullwell” refers to the service operated by Sous Chef Studio, Inc. Contact `privacy@fullwell.ai` for privacy requests and `support@fullwell.ai` for product support.

## Information we process

- Account information: display name, sign-in provider subject, email when supplied for sign-in or an invitation, passkey public credential, and security events.
- Household information: membership, roles, invitations, journal profiles, food and recipe entries, evidence, cooking and preparation notes, reports, collections, import provenance, and audit history.
- Purchase evidence: store, private order reference, date, and exact item title when you authorize an agent to audit a signed-in store.
- Source evidence: authorized recipe pages, links, image URLs, source-scope meaning, and minimal notes or communication summaries you choose to include.
- Service information: sessions, OAuth grants, request IDs, idempotency records, safe error categories, timing, device/browser security signals, backup and integrity results.
- Optional messaging information: a linked WhatsApp sender and local-runner device, encrypted inbound request and reply text, provider delivery status, and bounded queue/lease timestamps. Searchable fields contain only HMACed provider identifiers and low-cardinality status.
- Local onboarding information: while setup is unfinished, the installed client may checkpoint authorized source scope, audit progress, typed food evidence, proposed profiles, and reports under the Codex home on your computer. It excludes passwords, tokens, cookies, browser state, screenshots, and raw page captures and is not sent to Fullwell until you confirm the final write.
- Food-delivery information: when you ask Fullwell to catalog purchases visible in your signed-in browser, it may process the selected provider origin, complete order dates/groupings, fulfillment mode, restaurant locations, dishes, modifiers, quantities, and private provider/order locators. It excludes credentials, raw pages, delivery destinations, payment data, provider account identifiers, and age/identity documents.
- Meal-planning information: the explicit household answer about allergies and food sensitivities, confirmed time zone, weekly review history, proposed meals, proposer attribution, compatibility caveats, recipe provenance, and withdrawal history. Fullwell does not ask for names, diagnoses, severity, or medical narratives in the constraint profile.

We do not ask for store passwords, one-time codes, browser cookies, Apple private relay addresses beyond what Apple provides for account use, SSH keys, Git credentials, or copied MCP tokens. Codex, Claude, Apple, your email provider, and sites you ask an agent to inspect operate under their own privacy terms.

## How we use information

We use information to authenticate you, authorize household access, preserve an auditable journal, prevent duplicate or conflicting changes, deliver magic links and security notices, create exports, publish only collections you approve, support imports, detect abuse, reconcile storage, and restore from failure. We do not sell personal information or use private journal content for advertising.

Programs validate structure and deterministic evidence relationships. Connected Codex or Claude agents, under your direction, make semantic food judgments, author journal prose, and recommend meals. The central service does not use a separate model to classify your food, search for recipes, decide compatibility, or write reports. Internet recipe research occurs only after you approve it in the agent host; if a search would include an allergy or sensitivity term, the agent asks separately before sending that term for that search. Recipe pages and image hosts operate under their own privacy terms. For optional WhatsApp restocking, the central service verifies and routes the message only. Codex or Claude reads the fixed grocery snapshot for snacks, ingredients, condiments, and other groceries and controls the approved retailer locally on your Mac; the server does not receive the selected product, store, cart quantity, browser session, or local action receipt. Food-delivery history uses bounded user-directed navigation in an already signed-in local browser, not public crawling or unattended scraping. The agent may prepare and verify a previous-order cart but cannot check out, pay, tip, schedule, change an address, or accept a membership or subscription.

## Household and public sharing

Household members can see private household content according to their owner, editor, or viewer role. Each member uses a separate account. A family invitation grants membership only after sign-in and explicit acceptance.

Connected household members can see the shared meal-planning constraint profile, weekly reviews, proposals, proposer attribution, compatibility caveats, and withdrawal history. These fields are not included in public collection snapshots. A personal Codex or Claude weekly task is not shared household state and is not stored by Fullwell.

A collection link is a revocable capability URL to an immutable snapshot. Anyone holding a valid link can view that snapshot until it expires or is revoked. It does not grant household membership. Before publishing, you choose the items and public fields. Public snapshots exclude order data, counts, private evidence and locators, household/member identifiers, and unselected notes. Avoid forwarding a link beyond its intended recipients.

## Storage and subprocessors

- DigitalOcean hosts the application and encrypted Block Storage volume.
- Neon hosts PostgreSQL operational data and managed database recovery.
- Backblaze stores client-side encrypted, object-locked off-site backups in a separate account.
- Resend delivers magic links and security notices.
- Apple provides Sign in with Apple and may provide passkey synchronization through Apple Passwords/iCloud Keychain.
- Meta/WhatsApp carries optional restocking requests and Fullwell's bounded service replies through the direct WhatsApp Business Platform. No messaging middleware vendor receives them.
- Codex or Claude and the approved retailer process local restocking work under the accounts and permissions you choose on your Mac.
- Codex or Claude and a user-approved food-delivery provider process visible order and cart pages on your Mac. The server receives only an explicitly consented provider-scoped journal contribution, not browser state or active cart contents.
- Codex or Claude stores an unfinished onboarding checkpoint under the Codex home, separated by stable Fullwell user and household IDs. It uses private local file modes but is not encrypted from another person who can access the same operating-system account.
- Codex or Claude may store local meal-planning state and private static recipe boards under the Codex home. Board image requests contact the named source host directly with ordinary network metadata and may include existing site state; boards use no-referrer and anonymous loading where supported but are not an anonymity service.
- Codex or Claude owns any optional personal weekly meal-planning task. Fullwell stores no schedule, reminder receipt, calendar event, or task prompt.

Repositories contain pseudonymous member identifiers; private identity mappings remain in PostgreSQL. Git is authoritative for household journal content. Operational logs are structured and exclude tokens, emails, titles, food names, order IDs, source URLs, and request bodies.

## Retention and deletion

Revoking a food-delivery browser origin stops future provider access but does not erase delivery history already saved locally or contributed to household Git. Version 1 does not promise per-provider erasure. The local journal remains under your control on that computer. No self-service household-deletion route or tool exists in this release; if a separately authorized operator deletion is offered and confirmed, it removes active canonical household data while encrypted backups expire under the period described here. Public collection shares can be revoked or expire, but a public dish already imported into another household remains there with public provenance and no private order or reorder authority.

Magic links expire after 15 minutes. Family invitations default to 7 days. Collection shares default to 30 days and may be 1, 7, 30, or 90 days. Revocation takes effect in the operational database immediately.

WhatsApp link challenges expire after ten minutes. Encrypted message envelopes and delivery metadata expire within seven days and may be removed earlier after completion. Revoking the link/device prevents new claims and pre-action authorization. Disconnecting the runner always removes its local snapshot, receipts, tokens, and config without deleting server-authoritative household data.

An onboarding checkpoint expires after 30 days and is discarded when setup next loads it. Confirmed finalization or explicit setup cancellation removes the matching checkpoint immediately. Uninstalling the plugin does not delete a checkpoint automatically; you may remove `~/.codex/fullwell/drafts` to delete all local Fullwell onboarding drafts on that operating-system account without changing server-authoritative household data.

Private recipe boards are bounded disposable local snapshots. Later board creation removes expired or excess generated boards; uninstalling the plugin does not guarantee immediate deletion. Removing the local generated-board directory does not change the journal or connected household. Native weekly tasks remain in their Codex or Claude host until you pause or remove them there.

We retain household content and audit history while the household exists. Account deletion immediately revokes sessions and grants. If other members retain a household, audit identity becomes a stable pseudonymous former-member label. A sole owner must transfer or explicitly export/delete the household first. Deleted active data may remain in encrypted, access-controlled backups until the backup retention window expires; the production retention schedule and any legal hold override are recorded in the service release notice.

## Your choices

You can review household membership, revoke invitations and collection links, revoke MCP and local-runner grants, unlink WhatsApp, remove passkeys while retaining another sign-in method, delete local onboarding checkpoints and recipe boards, pause or remove personal host tasks, leave an eligible household, export a readable ZIP or verifiable Git bundle, and request account deletion. Household deletion has no self-service route or tool in this release. You can also choose which stores and recipe sources an agent may inspect, whether each web search may disclose constraint terms, and update those choices later.

Requests may require reauthentication. We may retain bounded security and audit records when necessary to protect other members, establish what happened, meet legal obligations, or preserve repository integrity.

## Security and international processing

We use TLS, secure cookies, PKCE, hashed capability tokens, signed Git commits, least-privilege credentials, encrypted off-site backups, integrity checks, and periodic restore drills. No system is risk-free. Report suspected unauthorized access to `security@fullwell.app`.

Service providers may process information in the regions selected for the production deployment. The release privacy review records those regions and applicable transfer safeguards before launch.

## Changes

Material changes receive a new effective date and notice through the service when appropriate. Earlier policy versions remain in release records.
