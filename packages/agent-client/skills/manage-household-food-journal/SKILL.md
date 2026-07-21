---
name: manage-household-food-journal
description: Start or resume Fullwell's conversational first run, set up or migrate a household food journal, authenticate, manage family access, or export data.
---

# Manage Household Food Journal

Use the hosted MCP service for all reads and writes. Follow [the MCP contract](../../references/mcp-tool-contract.md) and [privacy rules](../../references/privacy-and-sharing.md).

## Start or resume

1. Call `hfj_get_context`.
2. If authentication is required, tell the user to finish in the service browser window. Never request a token.
3. Resume a pending family invitation or collection import before ordinary setup.
4. If there is no pending intent and no household, ask for a short household name and call `hfj_create_household` with an idempotency key.
5. If multiple households exist, present readable names and roles, ask which to use, and call `hfj_select_household`.
6. After creating or selecting a household, refresh with `hfj_get_context` and begin guided first run. Do not interrupt it with an invitation offer.

## Guided first run

When the user greets Fullwell, asks to set it up, or selects the setup starter, begin the questions below. Do not ask what they want to set up and do not present snacks-versus-recipes choices.

1. Use the `onboarding` object from `hfj_get_context`. Handle `snacks` first, then `recipes`.
2. For a `not_started` section, call `hfj_update_onboarding` with `transition: { "action": "start" }` and `expected_revision: 0` before asking its first question. For `in_progress`, continue without another transition. For `complete`, advance immediately.
3. Leave a `skipped` section alone while another section is `not_started` or `in_progress`. On a later greeting or setup request, when no such section remains, call `hfj_update_onboarding` with `transition: { "action": "resume" }` and the returned revision before revisiting the earliest skipped section. Never revisit a section during the same guided run in which the user skipped it.
4. Start snacks by asking which grocery stores the user orders from. Use the grocery-audit skill for the remaining source authorization and audit. Unless the user asks to change them, use a trailing 12-month window and a recurrence threshold of two distinct orders instead of asking extra setup questions.
5. After snacks completes or is skipped, start recipes by asking where the user saves, finds, or discusses recipes. Use the recipe-history skill for source scope, meaning, authorization, and collection.
6. If the user naturally declines the current section, call `hfj_update_onboarding` with `transition.action: "skip"`, its current revision, and exactly one reason: `no_sources` when they have no applicable sources, `not_now` when they defer or say never mind, or `user_declined` for another refusal. Then advance to the next section without asking permission to continue. After recipes is skipped, end the current guided run precisely instead of looping back to snacks.
7. Interpret the user's meaning conversationally. Do not implement or imitate keyword matching. If the user explicitly asks to stop, cancel, or quit the whole setup, end it without starting or skipping the next section; an `in_progress` section remains resumable.
8. Never send `complete` to `hfj_update_onboarding`. A section becomes complete only when its canonical report exists, which the next `hfj_get_context` reports.

Use a new stable idempotency key for each transition and reuse it only to retry that exact transition. On `REVISION_CONFLICT`, reread context and continue from the returned state.

After guided first run, or when the user asks specifically about family access, offer to invite another person. Ask for editor or viewer, read the current HEAD, call `hfj_create_family_invite`, and return the one-time URL without exposing it elsewhere.

## Join a family

Show the safe invitation preview: household name, inviter display name, requested role, and expiration. Authenticate as a distinct person, require an explicit `Join household`, then call `hfj_accept_family_invite` with `accept: true` and a stable idempotency key. Never accept because a link was opened. Refresh with `hfj_get_context` after success.

## Membership

Use `hfj_list_members` before proposing changes. Owners may revoke an unused invitation with `hfj_revoke_family_invite`, change roles with `hfj_update_member`, and remove members with `hfj_remove_member`. Explain role effects and require explicit confirmation for revocation or removal. Never remove or demote the final owner. If the server denies a request, explain the role boundary and offer valid alternatives only.

## Profiles, migration, and export

Use `hfj_get_profile` and `hfj_update_profile` for user-confirmed household settings. For an existing local workspace, follow the migration boundary in the privacy reference, append bounded evidence batches with one stable migration ID, commit typed changes, compare counts, and spot-check. Do not alter the local workspace.

Use `hfj_export_household` for a readable ZIP or verifiable Git bundle. Explain that the download URL expires. Do not imply that uninstalling this client deletes server data.

Handle conflicts by rereading current state and reconstructing the intended change. Finish with a precise completed, partial, blocked, or cancelled state.
