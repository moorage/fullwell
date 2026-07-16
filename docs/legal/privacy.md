# Household Food Journal Privacy Notice

Effective date: 2026-07-15

This notice describes the Household Food Journal service operated by Fullwell. Contact `privacy@fullwell.app` for privacy requests and `support@fullwell.app` for product support.

## Information we process

- Account information: display name, sign-in provider subject, email when supplied for sign-in or an invitation, passkey public credential, and security events.
- Household information: membership, roles, invitations, journal profiles, food and recipe entries, evidence, cooking and preparation notes, reports, collections, import provenance, and audit history.
- Purchase evidence: store, private order reference, date, and exact item title when you authorize an agent to audit a signed-in store.
- Source evidence: authorized recipe pages, links, image URLs, source-scope meaning, and minimal notes or communication summaries you choose to include.
- Service information: sessions, OAuth grants, request IDs, idempotency records, safe error categories, timing, device/browser security signals, backup and integrity results.

We do not ask for store passwords, one-time codes, browser cookies, Apple private relay addresses beyond what Apple provides for account use, SSH keys, Git credentials, or copied MCP tokens. Codex, Claude, Apple, your email provider, and sites you ask an agent to inspect operate under their own privacy terms.

## How we use information

We use information to authenticate you, authorize household access, preserve an auditable journal, prevent duplicate or conflicting changes, deliver magic links and security notices, create exports, publish only collections you approve, support imports, detect abuse, reconcile storage, and restore from failure. We do not sell personal information or use private journal content for advertising.

Programs validate structure and deterministic evidence relationships. Connected Codex or Claude agents, under your direction, make semantic food judgments and author journal prose. The central service does not use a separate model to classify your food or write reports.

## Household and public sharing

Household members can see private household content according to their owner, editor, or viewer role. Each member uses a separate account. A family invitation grants membership only after sign-in and explicit acceptance.

A collection link is a revocable capability URL to an immutable snapshot. Anyone holding a valid link can view that snapshot until it expires or is revoked. It does not grant household membership. Before publishing, you choose the items and public fields. Public snapshots exclude order data, counts, private evidence and locators, household/member identifiers, and unselected notes. Avoid forwarding a link beyond its intended recipients.

## Storage and subprocessors

- DigitalOcean hosts the application and encrypted Block Storage volume.
- Neon hosts PostgreSQL operational data and managed database recovery.
- Amazon Web Services stores encrypted, object-locked off-site backups in a separate account.
- Resend delivers magic links and security notices.
- Apple provides Sign in with Apple and may provide passkey synchronization through Apple Passwords/iCloud Keychain.

Repositories contain pseudonymous member identifiers; private identity mappings remain in PostgreSQL. Git is authoritative for household journal content. Operational logs are structured and exclude tokens, emails, titles, food names, order IDs, source URLs, and request bodies.

## Retention and deletion

Magic links expire after 15 minutes. Family invitations default to 7 days. Collection shares default to 30 days and may be 1, 7, 30, or 90 days. Revocation takes effect in the operational database immediately.

We retain household content and audit history while the household exists. Account deletion immediately revokes sessions and grants. If other members retain a household, audit identity becomes a stable pseudonymous former-member label. A sole owner must transfer or explicitly export/delete the household first. Deleted active data may remain in encrypted, access-controlled backups until the backup retention window expires; the production retention schedule and any legal hold override are recorded in the service release notice.

## Your choices

You can review household membership, revoke invitations and collection links, revoke MCP grants, remove passkeys while retaining another sign-in method, leave an eligible household, export a readable ZIP or verifiable Git bundle, and request account or household deletion. You can also choose which stores and recipe sources an agent may inspect and update those choices later.

Requests may require reauthentication. We may retain bounded security and audit records when necessary to protect other members, establish what happened, meet legal obligations, or preserve repository integrity.

## Security and international processing

We use TLS, secure cookies, PKCE, hashed capability tokens, signed Git commits, least-privilege credentials, encrypted off-site backups, integrity checks, and periodic restore drills. No system is risk-free. Report suspected unauthorized access to `security@fullwell.app`.

Service providers may process information in the regions selected for the production deployment. The release privacy review records those regions and applicable transfer safeguards before launch.

## Changes

Material changes receive a new effective date and notice through the service when appropriate. Earlier policy versions remain in release records.
