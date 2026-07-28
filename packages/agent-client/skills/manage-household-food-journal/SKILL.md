---
name: manage-household-food-journal
description: Handle every Fullwell greeting or setup request through local-first grocery, recipe, and food-delivery history, optional account connection and provider-scoped household contribution, weekly meal-planning follow-up, hosted household selection, family access, profiles, and exports.
---

# Manage Household Food Journal

Fullwell has two explicit authority modes:

- A **local guest household** works without a Fullwell account and is the default for a new installation. It supports grocery-history collection, recipe collection, food-delivery indexing, direct restocking, recipe recall, and household meal planning on this computer.
- A **cloud household** uses the hosted MCP service and is required for cloud backup, WhatsApp, collection sharing, invitations, and multiplayer access.

Use the plugin-provided `fullwell-local` tools for guest data and the bundled [local onboarding draft helper](../../runtime/onboarding-draft.mjs) for unconfirmed work tied to an authenticated cloud household. Never execute the versioned `runtime/local-household.mjs` cache path directly. Pass draft-helper JSON only through standard input; never put draft contents in command arguments. Follow [voice and identity](../../references/voice-and-identity.md), [the MCP contract](../../references/mcp-tool-contract.md), and [privacy rules](../../references/privacy-and-sharing.md).

## Remember the member before choosing authority

Treat every greeting addressed to Fullwell, including a bare `@Fullwell hi` or `Hi Fullwell.`, as a request to start or resume this flow. Never call a Fullwell MCP tool merely to discover whether the person has an account.

1. Call `fullwell_local_profile_load` with no arguments before loading a household or contacting the cloud.
2. If the profile is `missing` and the user has not already supplied a preferred name, ask exactly: "What should I call you?" Stop there. The account question, household setup, audits, and hosted calls all wait for this answer.
3. Save an explicit preferred name with `fullwell_local_profile_update`, using `expected_revision: 0` for a missing profile or the returned revision for a rename. Keep the returned `display_name` and `default_household_name`; names ending in `s` use `<NAME>' Household`, while other names use `<NAME>'s Household`.
4. Call `fullwell_local_household_load` with no arguments. It is a local read-only tool and never contacts the Fullwell cloud service.
5. If it returns a local household, resume it without asking the account question again. A `collecting` household resumes its first unresolved grocery or recipe section. A `ready` household can answer direct local requests; offer cloud backup only at the end of a setup run, when its recorded backup is stale, or when the user requests an account-gated feature.
6. If it returns `missing`, ask exactly one routing question before any hosted call: "Do you already have a Fullwell account?"
7. If the user says yes, use the cloud path. Calling `hfj_get_context` starts OAuth when needed; tell the user to finish in the service browser window and never request a token.
8. If the user says no, or says they want to continue without an account, call `fullwell_local_household_update` with `{ "operation": "initialize", "household_name": "<default_household_name>" }` and begin grocery-history onboarding immediately. The host may ask once for permission to update Fullwell's private local journal; explain that a persistent choice applies to this named local tool across Fullwell upgrades, not to arbitrary Node commands. Do not call `hfj_get_context`, create a cloud household, or mention an authentication blocker.
9. Interpret the answer conversationally. Do not use keyword matching. If the answer is genuinely unclear, clarify only whether to connect an existing account or continue locally.

## Local guest household

The local tools store a private member profile at `fullwell/local/profile.json` and one private household document at `fullwell/local/household.json`. These are durable local data, not a cloud backup. Carry each returned monotonically increasing revision into its next mutation:

- `fullwell_local_profile_load` takes no arguments and returns the remembered name plus the deterministic default household name.
- `fullwell_local_profile_update` takes `expected_revision` and `display_name`.
- `fullwell_local_household_load` takes no arguments.
- `fullwell_local_household_update` with `initialize` may add the first `household_name`.
- `fullwell_local_household_update` with `repair_compatibility` safely updates a recognized older local delivery format, rewrites only its defined references, and returns bounded counts. It requires no expected revision because it locks and validates the current private file itself.
- `fullwell_local_household_update` with `save` adds `expected_revision` and the complete `journal` object.
- `fullwell_local_household_update` with `rename_household` adds `expected_revision` and `household_name`.
- `fullwell_local_household_update` with `finalize` adds `expected_revision` and makes collected data ready for direct local use.
- `fullwell_local_household_update` with `record_cloud_backup` adds `expected_revision`, the successful hosted `user_id`, `household_id`, and `repository_head`.
- `fullwell_local_household_update` with `stage_delivery_promotion` records one provider, reconciled payload digest, one-way cloud target-binding digest, expected HEAD, and stable provider key before a hosted attempt. It does not persist the raw cloud user or household ID.
- `fullwell_local_household_update` with `record_delivery_promotion` verifies that target-binding digest and adds the returned cloud user, household, provider, and repository HEAD only after `hfj_commit_delivery_index` succeeds.
- Meal-planning profile, review, proposal, and withdrawal operations use their operation-discriminated fields, current references, and exact idempotency keys. They preserve concurrent proposals instead of accepting a replacement journal.
- `fullwell_local_household_delete_collecting` takes `expected_revision` and may remove only an unfinished guest household.
- `fullwell_local_recipe_board_create` creates a bounded private visual snapshot after explicit user interest; it never opens a browser or changes the journal.
- `fullwell_local_whatsapp_runner_stop` stops only the local macOS runner and preserves the cloud connection, credentials, snapshots, receipts, and journal.

If the `fullwell-local` server or any of these tools is unavailable, stop local setup and ask the user to reload or reinstall the Fullwell plugin. Do not fall back to a version-specific shell command, edit the user's Codex rules, or call the hosted service without account or cloud-backup consent.

If `fullwell_local_household_load` returns `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED`, this is recoverable work for Fullwell, not a user decision. Call `fullwell_local_household_update` once with `{ "operation": "repair_compatibility" }`, reload, and continue the exact interrupted task. Do not edit the private file directly, ask the user to request a repair, or stop with "Fullwell needs to add a migration." Tell the user only the useful outcome: "I updated the saved delivery history and I'm continuing with the sync." If repair returns `LOCAL_HOUSEHOLD_COMPATIBILITY_BLOCKED`, keep everything unchanged, make no cloud call, avoid all implementation terms, and explain in ordinary language what is still safe and usable. Ask one concrete question only when its answer would let Fullwell proceed without guessing; otherwise offer to continue with unaffected local features instead of promising a future engineering fix. Never call compatibility repair for malformed JSON, prohibited local data, lock contention, conflicts, or any error other than `LOCAL_HOUSEHOLD_COMPATIBILITY_REQUIRED`.

The journal contains only bounded source scope, completed-source cursors, typed grocery, recipe, or delivery evidence, agent-authored semantic decisions, profiles, items, reports, section outcomes, and finalization metadata. It must never contain credentials, passwords, authorization headers, access or refresh tokens, cookies, browser state, screenshots, raw HTML, raw page captures, delivery destinations, payment state, account identifiers, or one-time codes.

Use this local guided flow:

1. Handle groceries first, then recipes. Reuse the current journal after each load; do not ask for confirmed sources or preferences again.
2. Introduce groceries in friendly benefit language before the first question: "I can learn the snacks, ingredients, condiments, and other groceries you buy. Later, you can say, 'Restock cashews,' 'Buy a head of parsley,' or 'I need more mayo - not the Japanese one,' and I can use your past orders to identify the product and store you usually use. I'll add requests under your $50 automatic cart maximum and ask you first at or above it. I just need to know which grocery sites to look on." Ask the first missing question about grocery stores, then only the browser authorization and preference or exclusion details needed for the audit. Use the grocery-audit skill in local guided mode.
3. After groceries complete or are locally skipped, introduce recipes before the first recipe question: "I can remember the recipes you save, cook, and like. Later, you can ask, 'What was that pasta we loved?' or 'What should we make again?' and I can answer from your actual recipe history instead of guessing. I just need to know where you save or discuss recipes." Ask where the user saves, finds, or discusses recipes, then only necessary scope, meaning, authorization, and preference questions. Use the recipe-history skill in local guided mode.
4. After every user answer, completed order detail, collected recipe occurrence, section skip, or other meaningful progress, call `fullwell_local_household_update` with `save`, the entire bounded journal, and the exact last revision. On `LOCAL_HOUSEHOLD_CONFLICT`, reload and never overwrite another conversation's progress.
5. If the user naturally declines a section, store exactly one local outcome: `no_sources` when no applicable source exists, `not_now` when they defer or say never mind, or `user_declined` for another refusal. Advance to the next section without asking what to set up next. Do not treat a local skip as cloud onboarding state.
6. If the user explicitly stops, cancels, or quits the whole unfinished setup, explain that cancellation removes the unfinished local journal and call `fullwell_local_household_delete_collecting` only after they confirm deletion. Never delete a `ready` local household through this flow.
7. Keep at most 10,000 evidence records and 10,000 items and a complete local document no larger than 16 MiB. Name the exact blocking limit rather than dropping data or claiming completion.
8. After collection, show a concise summary of sources, evidence counts, item counts by grocery area, recipe counts, reports, and skipped sections. Use `finalize` so the journal is locally usable before discussing an account. Finish in first person, for example: "I finished learning 42 grocery products and 17 recipes, and I saved what I found locally." Replace the illustrative counts with actual counts and name skipped sections accurately.
9. Only after `finalize` succeeds, and only when the journal contains at least one evidence-backed grocery item, ask: "Want to try this now? Tell me something you're out of - for example, 'We're out of cashews; restock them.' I'll use your shopping history to identify the usual product and store. I'll add requests under your $50 automatic cart maximum and ask you first at or above it." Omit this invitation when no restockable grocery was learned rather than implying you can identify one. If the user accepts this invitation before answering the cloud question, complete the restock first; the restocking skill must carry the unconnected local state forward and resume the cloud offer after a verified add instead of ending the onboarding conversation.
10. Then ask: "Would you like to create or connect a Fullwell account to back this up? You only need an account for cloud backup, WhatsApp, sharing, or family access." When the first restock completes before this question, the equivalent handoff is `(P.S. You can use WhatsApp, collaborate, and share with others by connecting to Fullwell cloud.) Would you like to connect now?` A decline ends successfully with no Fullwell call. Do not describe the local file as cloud-backed.
11. After the primary setup and any chosen cloud handoff finish, offer the personal weekly meal-planning check-in through the meal-planning skill. Inspect native tasks first. Offer Sunday at 9:00 AM in the user-confirmed IANA time zone, accept another exact day and time, and create nothing after a decline or silence. This optional question never changes the successful setup result.

## Food-delivery history

Route requests to learn, index, refresh, search, or compare delivery history through `audit-food-delivery-orders`. Delivery setup is optional and does not reopen or block the grocery-then-recipe first run.

1. Reuse the loaded local household and ask which delivery providers and installed signed-in browser the user wants to use. Do not require a Fullwell account for local indexing.
2. Save the complete canonical local journal at the exact revision after every complete order. Preserve existing delivery evidence, dishes, profile, report, meal-planning state, and provider promotion receipts across unrelated operations.
3. If a local user asks to collaborate, authenticate and select the destination household, then reconcile with `hfj_search_delivery_history`, `hfj_get_delivery_order`, `hfj_get_delivery_index`, and current item/profile reads. Present the exact provider-specific copy/merge and retention notice.
4. For each provider whose visibility and retention preview received a clear contextual affirmative, call local `stage_delivery_promotion`; do not require scripted confirmation text. The selected user and household IDs are transient inputs and only their one-way target-binding digest is retained while pending. Then call `hfj_commit_delivery_index` once in `local_promotion` mode with that stable key and `household_visibility_confirmed: true`. Call local `record_delivery_promotion` only after the hosted response confirms the returned user, household, provider, and HEAD.
5. A decline makes no hosted write. A failed or uncertain result keeps the exact pending provider digest, authority, and key for retry without storing raw cloud linkage IDs. A conflict rereads and reconfirms that provider without undoing already committed providers.
6. A recognized local compatibility failure runs the automatic repair/reload sequence above, then rebuilds the provider payload from the new local revision and resumes the already-requested sync. The format-only local repair does not require another explanation from the user and does not itself authorize or perform a hosted write.

## Optional cloud backup of a local household

Start this only after an affirmative backup/connect answer or an explicit request for WhatsApp, sharing, invitations, or family access.

1. Retain the exact ready local journal and its `promotion_idempotency_key`. Call `hfj_get_context`; if authentication is required, let the hosted OAuth flow open and never ask the user to paste a token. After authentication, call `hfj_update_user_display_name` with the remembered local name and a stable idempotency key before continuing.
2. Resume a pending invitation or collection import before creating an unrelated household. If no household exists and no invitation is being joined, call `hfj_create_household` with the profile's exact `default_household_name`; do not ask the user to invent another first-household name. If multiple editable households exist, ask which receives the backup and call `hfj_select_household`.
3. Refresh `hfj_get_context` for one current selected-household snapshot. Reconcile each local item against the bounded hosted identity index. If the index is truncated or a candidate is ambiguous, use the narrow search/read tools. Deterministic title or URL equality may identify candidates but must never make a semantic merge decision.
4. For a non-empty hosted household, present every create, update, separate-item, or merge choice. Require explicit user decisions for semantic candidates and use current hosted item revisions. Never silently overwrite cloud data.
5. Rebuild local section outcomes against the current hosted onboarding revisions. Omit already-complete sections and unchanged profiles. Use the local `promotion_idempotency_key` for the exact retryable payload.
6. Show one exact cloud-copy summary and ask for confirmation. Then call `hfj_commit_onboarding` once with current HEAD, reconciled items, evidence, profiles, reports, section outcomes, expected item revisions, and the stable idempotency key.
7. Only after a successful response, call local `record_cloud_backup` with the exact current local revision and returned Fullwell user, household, and repository HEAD. Keep the local journal. Future local changes make the backup marker stale until another confirmed backup succeeds.
8. On a failed or uncertain hosted result, retain the local journal and exact promotion payload. Retry with the same key only when the payload is unchanged. On `REVISION_CONFLICT`, reread, reconcile, summarize, and confirm again. Never report cloud backup from local state alone.

## Existing cloud account path

After an affirmative existing-account answer, call `hfj_get_context` and stay within the hosted path:

When the local household load is `missing` but the authenticated context returns an existing household, that is a recovered cloud account, not a new local guest. Use the returned cloud household, repository HEAD, and `user.actor_id`; do not initialize, hydrate, or reconstruct a local household from cloud data.

1. Save the remembered local name to the authenticated cloud account with `hfj_update_user_display_name`, using a stable idempotency key. Report a local-only result if that cloud write fails.
2. Resume a pending family invitation or collection import before ordinary setup.
3. If no household exists and no invitation is being joined, call `hfj_create_household` with the profile's exact `default_household_name` and an idempotency key.
4. If multiple households exist, present readable names and roles, ask which to use, and call `hfj_select_household`.
5. Refresh `hfj_get_context`, then load the exact authenticated checkpoint from `fullwell/drafts/<user-id>/<household-id>/onboarding.json` with repository HEAD and both onboarding revisions.
6. Run groceries then recipes using the same benefit-first questions. Save the full authenticated draft after meaningful progress. Natural declines stay in the draft; explicit cancellation deletes only its exact revision.
7. Present one final summary and require confirmation. Call `hfj_commit_onboarding` once with the snapshot HEAD, stable idempotency key, profiles, evidence, items, reports, expected item revisions, and unique section outcomes.
8. Only after the commit succeeds, delete the checkpoint and, when at least one evidence-backed grocery item is available, ask: "Want to try this now? Tell me something you're out of - for example, 'We're out of cashews; restock them.' I'll use your shopping history to identify the usual product and store. I'll add requests under your $50 automatic cart maximum and ask you first at or above it." Retain the checkpoint and omit the invitation after a failed or uncertain result. Omit it after a successful no-grocery completion rather than implying you learned a restockable item.
9. After successful onboarding and any accepted try-it interaction finish, use the meal-planning skill to offer the optional native weekly check-in. It must not create a task until the user confirms an exact cadence and time zone.

Never call `hfj_update_onboarding`, `hfj_get_profile`, `hfj_append_evidence`, `hfj_update_profile`, or `hfj_commit_change_set` as intermediate writes during either guided first-run path.

## Account-gated capabilities

For WhatsApp, collection sharing, invitations, multiplayer membership, server exports, or cloud backup, a guest must first choose the optional cloud promotion above. Explain the concrete reason for the account instead of presenting authentication as a general prerequisite.

After cloud onboarding, family invitations require an editor/viewer choice and `hfj_create_family_invite`. A recipient must see the safe preview and explicitly agree before `hfj_accept_family_invite`. Owners may use `hfj_revoke_family_invite`, while membership review and changes use `hfj_list_members`, `hfj_update_member`, and `hfj_remove_member` with confirmation and final-owner protection.

When a cloud household has just been created or connected and the current user can manage it, a concise next step is useful: "You can invite someone to this household here in chat whenever you're ready." Do not suggest this while local-only, while an invitation is already pending, after a decline, or when the user's role cannot invite.

When cloud onboarding has produced at least one item, another useful chat-native next step is: "You can also make a collection here in chat - for example, 'Make a Weeknight Favorites collection from the recipes we liked.'" Do not imply that a local-only household can publish or share a cloud collection, and do not create one until the user asks and reviews its contents.

## Names and local controls

- To change the member name, load and revision-check `fullwell_local_profile_update`. If the household is connected to cloud, also call `hfj_update_user_display_name` with its own stable idempotency key. These are two independent writes: never claim both changed unless both succeed, and state which side changed after a partial result.
- To change a household name, load the local household and use `rename_household` at its exact revision. For a connected cloud household, refresh `hfj_get_context` and call `hfj_update_household_name` at the exact repository HEAD. Cloud renames require owner authority. Keep local and cloud outcomes explicit if either side conflicts or fails.
- To stop the local WhatsApp runner, call `fullwell_local_whatsapp_runner_stop`. Say that the background runner stopped and its cloud connection was preserved. Do not revoke the runner, sign out, purge credentials, delete snapshots, or describe this as a full disconnect.
- To stop the weekly meal reminder, route to `plan-household-meals` and remove the exact host-native task named `Fullwell weekly meal planning`. "Stop", "turn off", "remove", and "cancel the weekly reminder" mean permanent removal; "pause" means pause. Confirm completion only after the host confirms the resulting state.

Outside guided first run, cloud profile reads and edits use `hfj_get_profile` and `hfj_update_profile`. A bounded ordinary cloud journal update sends its new evidence, items, and reports together through one `hfj_commit_change_set`; reserve `hfj_append_evidence` for evidence-only checkpoints or migrations where no item or report is ready. Keep the local guest authority unchanged until a separate confirmed promotion succeeds. Use `hfj_export_household` only for a cloud household and explain that its download URL expires.

Route requests to organize a week of household meals, suggest recipes for slots, preserve competing meal ideas, inspect or withdraw meal proposals, open a visual recipe board, or manage the weekly planning reminder through the `plan-household-meals` skill.

Do not route delivery dishes into local or cloud meal proposals yet; that source remains closed until its owning meal-planning milestone.

Handle conflicts by rereading the applicable local or hosted authority and reconstructing the intended change. Finish with a precise local, cloud-backed, partial, blocked, or cancelled state.
