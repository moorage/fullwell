---
name: share-food-collection
description: Build, preview, publish, share, list, or revoke a curated snapshot of selected household recipes and snacks.
---

# Share a Food Collection

Follow [the MCP contract](../../references/mcp-tool-contract.md), [privacy rules](../../references/privacy-and-sharing.md), and [semantic rules](../../references/semantic-food-rules.md).

1. Load the local household before any Fullwell call. If a guest household is found, explain that a Fullwell account is needed because sharing publishes a cloud snapshot, offer to back up the local household through the managing skill, and make no MCP call unless the user agrees. After successful promotion, or when no local guest exists and the user says they already have an account, call `hfj_get_context` and use an editable cloud household.
2. Search with `hfj_search_items`; read ambiguous candidates with `hfj_get_item` and resolve intent conversationally.
3. Show the exact proposed item list. Ask for a title and offer a concise default.
4. For every item, show the exact public fields. Ask whether recipe preparation notes should be included; default to no when they may be private.
5. Require explicit approval of this public preview. A request to share a household becomes this curated workflow, never repository or audit-log access.
6. Call `hfj_create_collection` with explicit item IDs, revisions, public-field choices, current HEAD, and an idempotency key. Resolve any changed item before proceeding.
7. Call `hfj_create_collection_share` for the approved snapshot. Use 30 days unless the user selects 1, 7, or 90.
8. Return the URL, expiration, and suggested message. Use the system share sheet when available or offer copy/email/text drafts. Never send without user confirmation.

For revocation, identify the share, explain that open previews will stop working, require confirmation, and call `hfj_revoke_collection_share`. Report the exact completion state.
