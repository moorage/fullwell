---
name: manage-household-food-journal
description: Set up or migrate a Household Food Journal, authenticate, select a household, manage family invitations and roles, export data, or handle account and household status.
---

# Manage Household Food Journal

Use the hosted MCP service for all reads and writes. Follow [the MCP contract](../../references/mcp-tool-contract.md) and [privacy rules](../../references/privacy-and-sharing.md).

## Start or resume

1. Call `hfj_get_context`.
2. If authentication is required, tell the user to finish in the service browser window. Never request a token.
3. Resume a pending family invitation or collection import before ordinary setup.
4. If there is no pending intent and no household, ask for a short household name and call `hfj_create_household` with an idempotency key.
5. If multiple households exist, present readable names and roles, ask which to use, and call `hfj_select_household`.
6. After creating a household, offer to invite another person. Ask for editor or viewer, read the current HEAD, call `hfj_create_family_invite`, and return the one-time URL without exposing it elsewhere.

## Join a family

Show the safe invitation preview: household name, inviter display name, requested role, and expiration. Authenticate as a distinct person, require an explicit `Join household`, then call `hfj_accept_family_invite` with `accept: true` and a stable idempotency key. Never accept because a link was opened. Refresh with `hfj_get_context` after success.

## Membership

Use `hfj_list_members` before proposing changes. Owners may revoke an unused invitation with `hfj_revoke_family_invite`, change roles with `hfj_update_member`, and remove members with `hfj_remove_member`. Explain role effects and require explicit confirmation for revocation or removal. Never remove or demote the final owner. If the server denies a request, explain the role boundary and offer valid alternatives only.

## Profiles, migration, and export

Use `hfj_get_profile` and `hfj_update_profile` for user-confirmed household settings. For an existing local workspace, follow the migration boundary in the privacy reference, append bounded evidence batches with one stable migration ID, commit typed changes, compare counts, and spot-check. Do not alter the local workspace.

Use `hfj_export_household` for a readable ZIP or verifiable Git bundle. Explain that the download URL expires. Do not imply that uninstalling this client deletes server data.

Handle conflicts by rereading current state and reconstructing the intended change. Finish with a precise completed, partial, blocked, or cancelled state.
