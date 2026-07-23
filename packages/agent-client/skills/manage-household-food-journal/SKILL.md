---
name: manage-household-food-journal
description: Handle every Fullwell greeting or setup request through local-first grocery-and-recipe onboarding, optional account connection and cloud backup, hosted household selection, family access, profiles, and exports.
---

# Manage Household Food Journal

Fullwell has two explicit authority modes:

- A **local guest household** works without a Fullwell account and is the default for a new installation. It supports grocery-history collection, recipe collection, direct restocking, and recipe recall on this computer.
- A **cloud household** uses the hosted MCP service and is required for cloud backup, WhatsApp, collection sharing, invitations, and multiplayer access.

Use the bundled [local household helper](../../runtime/local-household.mjs) for guest data and [local onboarding draft helper](../../runtime/onboarding-draft.mjs) for unconfirmed work tied to an authenticated cloud household. Pass helper JSON only through standard input; never put draft contents in command arguments. Follow [the MCP contract](../../references/mcp-tool-contract.md) and [privacy rules](../../references/privacy-and-sharing.md).

## Choose authority before authentication

Treat every greeting addressed to Fullwell, including a bare `@Fullwell hi`, as a request to start or resume this flow. Never call a Fullwell MCP tool merely to discover whether the person has an account.

1. Run `../../runtime/local-household.mjs` with Node and exactly `{ "operation": "load" }` on standard input. Never put journal contents in command arguments.
2. If it returns a local household, resume it without asking the account question again. A `collecting` household resumes its first unresolved grocery or recipe section. A `ready` household can answer direct local requests; offer cloud backup only at the end of a setup run, when its recorded backup is stale, or when the user requests an account-gated feature.
3. If it returns `missing`, ask exactly one routing question before any hosted call: "Do you already have a Fullwell account?"
4. If the user says yes, use the cloud path. Calling `hfj_get_context` starts OAuth when needed; tell the user to finish in the service browser window and never request a token.
5. If the user says no, or says they want to continue without an account, initialize the local household with `{ "operation": "initialize" }` and begin grocery-history onboarding immediately. Do not call `hfj_get_context`, create a cloud household, or mention an authentication blocker.
6. Interpret the answer conversationally. Do not use keyword matching. If the answer is genuinely unclear, clarify only whether to connect an existing account or continue locally.

## Local guest household

The helper stores one private document under the active Codex home at `fullwell/local/household.json`. This is durable local journal data, not a cloud backup. Pass one JSON request on standard input and carry the returned monotonically increasing `revision` into every mutation:

- `initialize` and `load` take only `operation`.
- `save` adds `expected_revision` and the complete `journal` object.
- `finalize` adds `expected_revision` and makes collected data ready for direct local use.
- `record_cloud_backup` adds `expected_revision`, the successful hosted `user_id`, `household_id`, and `repository_head`.
- `delete_collecting` adds `expected_revision` and may remove only an unfinished guest household.

The journal contains only bounded source scope, completed-source cursors, typed grocery or recipe evidence, agent-authored semantic decisions, profiles, items, reports, section outcomes, and finalization metadata. It must never contain credentials, passwords, authorization headers, access or refresh tokens, cookies, browser state, screenshots, raw HTML, raw page captures, or one-time codes.

Use this local guided flow:

1. Handle groceries first, then recipes. Reuse the current journal after each load; do not ask for confirmed sources or preferences again.
2. Introduce groceries in friendly benefit language before the first question: "Fullwell can learn the snacks, ingredients, condiments, and other groceries you buy. Later, you can say, 'Restock cashews,' 'Buy a head of parsley,' or 'I need more mayo - not the Japanese one,' and I can use your past orders to identify the product and store you usually use before helping add it to your cart after you confirm. I just need to know which grocery sites to look on." Ask the first missing question about grocery stores, then only the browser authorization and preference or exclusion details needed for the audit. Use the grocery-audit skill in local guided mode.
3. After groceries complete or are locally skipped, introduce recipes before the first recipe question: "Fullwell can remember the recipes you save, cook, and like. Later, you can ask, 'What was that pasta we loved?' or 'What should we make again?' and I can answer from your actual recipe history instead of guessing. I just need to know where you save or discuss recipes." Ask where the user saves, finds, or discusses recipes, then only necessary scope, meaning, authorization, and preference questions. Use the recipe-history skill in local guided mode.
4. After every user answer, completed order detail, collected recipe occurrence, section skip, or other meaningful progress, use `save` with the entire bounded journal and exact last revision. On `LOCAL_HOUSEHOLD_CONFLICT`, reload and never overwrite another conversation's progress.
5. If the user naturally declines a section, store exactly one local outcome: `no_sources` when no applicable source exists, `not_now` when they defer or say never mind, or `user_declined` for another refusal. Advance to the next section without asking what to set up next. Do not treat a local skip as cloud onboarding state.
6. If the user explicitly stops, cancels, or quits the whole unfinished setup, explain that cancellation removes the unfinished local journal and use `delete_collecting` only after they confirm deletion. Never delete a `ready` local household through this flow.
7. Keep at most 10,000 evidence records and 10,000 items and a complete local document no larger than 16 MiB. Name the exact blocking limit rather than dropping data or claiming completion.
8. After collection, show a concise summary of sources, evidence counts, item counts by grocery area, recipe counts, reports, and skipped sections. Use `finalize` so the journal is locally usable before discussing an account. Tell the user it is saved locally.
9. Only after `finalize` succeeds, and only when the journal contains at least one evidence-backed grocery item, ask: "Want to try Fullwell now? Tell me something you're out of - for example, 'We're out of cashews; restock them.' I'll use your shopping history to identify the usual product and store, then ask before adding it to your cart." Omit this invitation when no restockable grocery was learned rather than implying Fullwell can identify one.
10. Then ask: "Would you like to create or connect a Fullwell account to back this up? You only need an account for cloud backup, WhatsApp, sharing, or family access." A decline ends successfully with no Fullwell call. Do not describe the local file as cloud-backed.

## Optional cloud backup of a local household

Start this only after an affirmative backup/connect answer or an explicit request for WhatsApp, sharing, invitations, or family access.

1. Retain the exact ready local journal and its `promotion_idempotency_key`. Call `hfj_get_context`; if authentication is required, let the hosted OAuth flow open and never ask the user to paste a token.
2. Resume a pending invitation or collection import before creating an unrelated household. If no household exists, offer a concise household name and call `hfj_create_household`. If multiple editable households exist, ask which receives the backup and call `hfj_select_household`.
3. Refresh `hfj_get_context` for one current selected-household snapshot. Reconcile each local item against the bounded hosted identity index. If the index is truncated or a candidate is ambiguous, use the narrow search/read tools. Deterministic title or URL equality may identify candidates but must never make a semantic merge decision.
4. For a non-empty hosted household, present every create, update, separate-item, or merge choice. Require explicit user decisions for semantic candidates and use current hosted item revisions. Never silently overwrite cloud data.
5. Rebuild local section outcomes against the current hosted onboarding revisions. Omit already-complete sections and unchanged profiles. Use the local `promotion_idempotency_key` for the exact retryable payload.
6. Show one exact cloud-copy summary and ask for confirmation. Then call `hfj_commit_onboarding` once with current HEAD, reconciled items, evidence, profiles, reports, section outcomes, expected item revisions, and the stable idempotency key.
7. Only after a successful response, call local `record_cloud_backup` with the exact current local revision and returned Fullwell user, household, and repository HEAD. Keep the local journal. Future local changes make the backup marker stale until another confirmed backup succeeds.
8. On a failed or uncertain hosted result, retain the local journal and exact promotion payload. Retry with the same key only when the payload is unchanged. On `REVISION_CONFLICT`, reread, reconcile, summarize, and confirm again. Never report cloud backup from local state alone.

## Existing cloud account path

After an affirmative existing-account answer, call `hfj_get_context` and stay within the hosted path:

1. Resume a pending family invitation or collection import before ordinary setup.
2. If no household exists, ask for a short household name and call `hfj_create_household` with an idempotency key.
3. If multiple households exist, present readable names and roles, ask which to use, and call `hfj_select_household`.
4. Refresh `hfj_get_context`, then load the exact authenticated checkpoint from `fullwell/drafts/<user-id>/<household-id>/onboarding.json` with repository HEAD and both onboarding revisions.
5. Run groceries then recipes using the same benefit-first questions. Save the full authenticated draft after meaningful progress. Natural declines stay in the draft; explicit cancellation deletes only its exact revision.
6. Present one final summary and require confirmation. Call `hfj_commit_onboarding` once with the snapshot HEAD, stable idempotency key, profiles, evidence, items, reports, expected item revisions, and unique section outcomes.
7. Only after the commit succeeds, delete the checkpoint and, when at least one evidence-backed grocery item is available, ask: "Want to try Fullwell now? Tell me something you're out of - for example, 'We're out of cashews; restock them.' I'll use your shopping history to identify the usual product and store, then ask before adding it to your cart." Retain the checkpoint and omit the invitation after a failed or uncertain result. Omit it after a successful no-grocery completion rather than implying Fullwell learned a restockable item.

Never call `hfj_update_onboarding`, `hfj_get_profile`, `hfj_append_evidence`, `hfj_update_profile`, or `hfj_commit_change_set` as intermediate writes during either guided first-run path.

## Account-gated capabilities

For WhatsApp, collection sharing, invitations, multiplayer membership, server exports, or cloud backup, a guest must first choose the optional cloud promotion above. Explain the concrete reason for the account instead of presenting authentication as a general prerequisite.

After cloud onboarding, family invitations require an editor/viewer choice and `hfj_create_family_invite`. A recipient must see the safe preview and explicitly agree before `hfj_accept_family_invite`. Owners may use `hfj_revoke_family_invite`, while membership review and changes use `hfj_list_members`, `hfj_update_member`, and `hfj_remove_member` with confirmation and final-owner protection.

Outside guided first run, cloud profile reads and edits use `hfj_get_profile` and `hfj_update_profile`; cloud evidence and ordinary journal changes use `hfj_append_evidence` and `hfj_commit_change_set`. Keep the local guest authority unchanged until a separate confirmed promotion succeeds. Use `hfj_export_household` only for a cloud household and explain that its download URL expires.

Handle conflicts by rereading the applicable local or hosted authority and reconstructing the intended change. Finish with a precise local, cloud-backed, partial, blocked, or cancelled state.
