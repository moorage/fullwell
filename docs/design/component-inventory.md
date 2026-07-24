# Component Inventory

## Global primitives

| Component      | Responsibility                                                              | Variants                             |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `AppShell`     | Skip link, masthead, authenticated navigation, main landmark, legal footer. | Public, workspace, focused consent   |
| `PageHeader`   | Route identity, concise supporting copy, contextual action.                 | Default, split action                |
| `Button`       | Clear command with icon where useful.                                       | Primary, secondary, quiet, danger    |
| `StatusNotice` | Announce result or blocker with heading and next action.                    | Info, success, warning, error        |
| `Field`        | Label, control, hint, and inline error association.                         | Text, email, select, radio, checkbox |
| `ActionList`   | Separated operational rows.                                                 | Compact, media, dangerous            |
| `EmptyState`   | One explanation and one valid next action.                                  | Default, blocked                     |

## Product components

| Component           | Responsibility                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| `BrandMark`         | Decorative ChatGPT, Claude, or Apple mark paired with visible text.      |
| `HostChooser`       | Segmented ChatGPT/Claude mode with one visible current install action.   |
| `GuideCard`         | Task, outcome, concrete chat example, and stable detail destination.     |
| `SignInOptions`     | Ordered Apple, eligible passkey, and email-link choices.                 |
| `InviteSummary`     | Household, inviter, requested role, expiry, and membership consequence.  |
| `CollectionItem`    | Image/fallback, safe title, source, optional note, and labeled checkbox. |
| `SelectionToolbar`  | Scoped select-all and selected count for recipes or snacks.              |
| `ShareActions`      | Web Share enhancement, copy, email draft, and text draft.                |
| `DuplicateDecision` | Exact-repeat explanation or required possible-match decision.            |
| `HouseholdSwitcher` | Explicit household choice without implying authorization.                |
| `MemberRow`         | Person, role explanation, role form, or remove action.                   |
| `CollectionRow`     | Visibility, item counts, expiration, copy/revoke actions.                |
| `SignInMethodRow`   | Apple/email/passkey method status and permitted removal action.          |
| `GrantRow`          | Connected host, granted household actions, last used, revoke action.     |
| `DangerZone`        | Plain-language consequence and reauthentication-gated form.              |
| `VisualJournalFeed` | Deterministic recipe/grocery cards, bounded continuation, retry, and end state. |

## Interaction contracts

- Icon-only controls are limited to familiar actions such as copy; every one has an accessible name and tooltip.
- `details` provides the no-JavaScript disclosure baseline for troubleshooting and advanced export information.
- Client enhancement may update selection counts, copy to clipboard, call Web Share, or focus an error; it does not decide authorization or mutation success.
- Visual-journal enhancement may append a strictly parsed same-origin batch automatically or through an explicit link, but authorization and item projection remain server-owned.
- Every form includes a server-provided CSRF field and a scoped idempotency field where the server contract requires one.
