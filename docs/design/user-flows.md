# User Flows

## Install and first use

1. Open `/install`.
2. Choose ChatGPT or Claude; only the selected host's current action is expanded.
3. Install and ask the agent to set up the journal.
4. The host opens `/sign-in` for protected access.
5. Continue with Apple, use an existing passkey, or request an email link.
6. Resume the pending setup rather than landing on a generic dashboard.
7. Create a household, then return to the agent for journal work.

Failure handling: a generic email response prevents account discovery; expired links offer one next action; cancelling consent returns control without creating data.

## Follow an advanced agent guide

1. Open `/guides` from public or authenticated navigation, or follow a contextual link from install, Account, Members, Collections, a household summary, or a public collection handoff.
2. Open the exact WhatsApp, household invitation, collection creation, or collection sharing guide.
3. Copy or adapt the concrete chat example.
4. Complete any sign-in, role, sharing, or browser confirmation in its owning surface; never paste credentials or one-time codes into chat.

## Join a household

1. Open `/invite/family/:token` and review household, inviter, role, and expiry.
2. Sign in as an individual account if required.
3. Return to the same invitation.
4. Select `Join household`; opening the URL never accepts it.
5. See a completed state with a direct household link.

Failure handling: expired, revoked, already-used, or wrong-account invitations explain the state without revealing additional household information.

## Preview and import a collection

1. Open `/c/:token` without signing in.
2. Review the immutable snapshot and select recipe and snack items independently.
3. Use scoped Select all controls or individual checkboxes.
4. Select `Import selected`; selection is carried through sign-in.
5. Choose an editable destination household.
6. Review exact repeats and resolve every possible duplicate as Skip, Create separate, or Merge into a named item.
7. Confirm once and receive imported, skipped, and unresolved counts.

The page states that collection access does not grant household membership. Recipe import may establish Saved only; snack import does not create purchase or preference evidence.

## Manage a household

1. Open `/households` and choose a household.
2. Review the current role and latest agent-authored summaries.
3. Owners open Members to invite an editor or viewer, change roles, revoke invitations, or remove a member.
4. Editors and owners open Collections to review links and revoke a published snapshot.
5. Any member may request an export from Account.

Final-owner operations stay blocked until ownership is transferred or the household is explicitly exported and deleted.

## Browse a visual journal

1. Open Recipes or Groceries from the household navigation or summary count.
2. Review recorded-only cards in deterministic order; missing or failed external images retain usable text.
3. Continue automatically near the end, or use the explicit `Load more` link with a keyboard.
4. Without JavaScript, follow the normal page link to the next bounded result prefix.
5. If loading fails, keep the rendered cards and retry; a completed list announces that all recorded items are shown.

## Manage an account

1. Rename the display name or add an allowed sign-in method.
2. Review passkeys and connected agent access.
3. Revoke a grant or leave a household with an explicit confirmation.
4. Request an export before a destructive action.
5. Delete the account only after reauthentication and final-owner conditions pass.
