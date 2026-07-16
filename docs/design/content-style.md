# Content Style

## Voice

Fullwell sounds like a calm household organizer: direct, specific, and warm without being chatty. Use short sentences and concrete nouns. Prefer `family member`, `household`, `collection`, `saved recipe`, and `purchase history`.

Do not use infrastructure language such as Git, repository, commit, MCP, OAuth, capability, token, projection, or idempotency in general UI. `Git bundle` may appear only inside the advanced export panel.

## Commands

- Label buttons with the outcome: `Join household`, `Import 2 items`, `Revoke link`.
- Use `Cancel` when no change has occurred.
- Do not use `Submit`, `OK`, or `Continue` when a more precise label exists.
- Destructive actions name the affected object and explain permanence immediately above the button.

## Roles

- Owner: can manage people and delete the household.
- Editor: can add journal evidence and create collections.
- Viewer: can read journal content and export it.

Explain these effects before invitation acceptance and role changes. Never imply that a collection link adds someone to a household.

## Errors

Write: what happened, whether data changed, and the single next action.

- `That invitation has expired. Ask a household owner for a new link.`
- `This collection is no longer available. Nothing was imported.`
- `Someone changed this item while you were choosing. Review the updated choice before importing.`
- `We could not finish that request. Your selection is still here; try again.`

## Privacy statements

Place a brief boundary statement at the decision point, not only in the footer:

- `Only this published snapshot is visible. The rest of the household stays private.`
- `Joining adds your individual account to this household.`
- `Fullwell never asks you to paste a sign-in code into a conversation.`
