---
name: manage-household-food-journal
description: Handle every Fullwell greeting or setup request, including a bare @Fullwell hi, by checking unresolved snack-then-recipe onboarding before general help; also authenticate, select or migrate a household, manage family access, profiles, and exports.
---

# Manage Household Food Journal

Use the hosted MCP service for all reads and writes. Follow [the MCP contract](../../references/mcp-tool-contract.md) and [privacy rules](../../references/privacy-and-sharing.md).

## Start or resume

1. Call `hfj_get_context` before replying to any Fullwell greeting or setup request.
2. If authentication is required, tell the user to finish in the service browser window. Never request a token.
3. Resume a pending family invitation or collection import before ordinary setup.
4. If there is no pending intent and no household, ask for a short household name and call `hfj_create_household` with an idempotency key.
5. If multiple households exist, present readable names and roles, ask which to use, and call `hfj_select_household`.
6. After creating or selecting a household, refresh with `hfj_get_context` and begin guided first run. Do not interrupt it with an invitation offer.

## Guided first run

Treat every greeting addressed to Fullwell, including a bare `@Fullwell hi`, as a request to start or resume guided first run. If `hfj_get_context` reports any `not_started`, `in_progress`, or `skipped` section, continue the flow without another Fullwell call. Do not return a generic greeting, list capabilities, ask what is on the user's mind, ask what they want to set up, or present snacks-versus-recipes choices while onboarding work remains. General help is appropriate only when both sections are `complete`.

Keep the evolving draft only in the active conversation. Do not save it to a workspace file, a client database, or another local persistence surface, and do not promise that it survives a new conversation. Until final confirmation, do not call `hfj_update_onboarding`, `hfj_get_profile`, `hfj_search_items`, `hfj_get_item`, `hfj_append_evidence`, `hfj_update_profile`, or `hfj_commit_change_set` in the normal guided path.

1. Use `onboarding`, both profiles, the bounded item identity index, and `items_truncated` from the single `hfj_get_context` response. Handle `snacks` first, then `recipes`; omit sections already `complete`.
2. Revisit a previously skipped section only when no unskipped section remains and the user has started a later setup conversation. Its returned revision remains the final compare-and-set revision; do not write a resume transition.
3. Start snacks from the snapshot's snack profile. Before the first snack question, briefly explain the practical benefit in friendly, plain language, even when resuming: "Fullwell can help keep your family's favorite snacks stocked. Later, you can say, 'Restock cashews,' and I can use your past orders to identify the cashews you usually buy and help add them to your cart after you confirm. I just need to know which grocery sites to look on." Do not use an unexplained label such as "snack setup." Say the benefit once per section in this conversation, then reuse confirmed stores and preferences without re-asking. Ask the first missing question about grocery stores the user orders from; after sources are named, ask only for browser authorization and preference or exclusion details needed to interpret the audit. Use the grocery-audit skill in guided draft mode. Unless the user asks to change them, use a trailing 12-month window and recurrence threshold of two distinct orders.
4. After the snack draft is complete or locally marked skipped, start recipes from the snapshot's recipe profile. Before the first recipe question, briefly explain the practical benefit in friendly, plain language, even when resuming: "Fullwell can remember the recipes your family saves, cooks, and likes. Later, you can ask, 'What was that pasta we loved?' or 'What should we make again?' and I can answer from your actual recipe history instead of guessing. I just need to know where you save or discuss recipes." Do not use an unexplained label such as "recipe setup." Say the benefit once per section in this conversation, then reuse confirmed sources and preferences without re-asking. Ask where the user saves, finds, or discusses recipes, then only the source-scope, meaning, authorization, and preference questions needed for collection. Use the recipe-history skill in guided draft mode.
5. If the user naturally declines the current section, record a draft `skip` outcome with its snapshot revision and exactly one reason: `no_sources` when there are no applicable sources, `not_now` when they defer or say never mind, or `user_declined` for another refusal. Advance to the next section without asking permission. Do not revisit a section skipped in this guided run.
6. Interpret meaning conversationally; never imitate keyword matching. If the user explicitly stops, cancels, or quits the whole setup, discard the uncommitted draft and end without a Fullwell write.
7. Before any write, validate that the draft fits the final tool bounds and does not depend on an omitted item when `items_truncated` is true. If exact current items are required, explain why and use the narrow legacy read tools before presenting the confirmation. If the payload is too large, explain that bounded batches will be necessary instead of claiming one-write completion.
8. Present one concise final summary covering source/profile changes, evidence and item counts, reports, and skipped sections. Ask for explicit confirmation to save it. If the user declines or edits the summary, keep drafting without a Fullwell write.
9. After confirmation, call `hfj_commit_onboarding` exactly once with the snapshot HEAD, a stable idempotency key, unique section outcomes, changed profiles, evidence, items, canonical reports, and expected item revisions. Omit unchanged profiles and already-complete sections. A `complete` outcome is valid only when the matching canonical report is included or already exists.
10. On an uncertain result, retry the exact final request with the same idempotency key. On `REVISION_CONFLICT`, reread context, reconstruct the draft against current state, show the changed summary, and confirm again. Never report completion from conversation-local state alone.

After guided first run, or when the user asks specifically about family access, offer to invite another person. Ask for editor or viewer, read the current HEAD, call `hfj_create_family_invite`, and return the one-time URL without exposing it elsewhere.

## Join a family

Show the safe invitation preview: household name, inviter display name, requested role, and expiration. Authenticate as a distinct person, require an explicit `Join household`, then call `hfj_accept_family_invite` with `accept: true` and a stable idempotency key. Never accept because a link was opened. Refresh with `hfj_get_context` after success.

## Membership

Use `hfj_list_members` before proposing changes. Owners may revoke an unused invitation with `hfj_revoke_family_invite`, change roles with `hfj_update_member`, and remove members with `hfj_remove_member`. Explain role effects and require explicit confirmation for revocation or removal. Never remove or demote the final owner. If the server denies a request, explain the role boundary and offer valid alternatives only.

## Profiles, migration, and export

Outside guided first run, use `hfj_get_profile` and `hfj_update_profile` for user-confirmed household settings. For an existing local workspace, follow the migration boundary in the privacy reference, append bounded evidence batches with one stable migration ID, commit typed changes, compare counts, and spot-check. Do not alter the local workspace.

Use `hfj_export_household` for a readable ZIP or verifiable Git bundle. Explain that the download URL expires. Do not imply that uninstalling this client deletes server data.

Handle conflicts by rereading current state and reconstructing the intended change. Finish with a precise completed, partial, blocked, or cancelled state.
