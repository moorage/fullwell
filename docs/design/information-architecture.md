# Information Architecture

## Navigation model

The product has three contexts rather than one universal navigation tree.

### Public context

Public pages use a small masthead with the Fullwell wordmark, a sign-in action, and a restrained legal footer. Collection and invitation links keep their opaque URL intact through sign-in.

| Route                   | Purpose                                                            | Primary action                        |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `/install`              | Choose one agent host and follow its current installation handoff. | Use with ChatGPT or Use with Claude   |
| `/guides`               | Choose an advanced task-specific chat guide.                       | Open a guide                          |
| `/guides/whatsapp`      | Connect WhatsApp without putting credentials in chat.              | Set up WhatsApp                       |
| `/guides/household-invitations` | Invite a person with an explicit role and browser confirmation. | Invite someone                     |
| `/guides/collections/create` | Build a named recipe or grocery collection in chat.             | Create a collection                   |
| `/guides/collections/share` | Publish and share a reviewed collection snapshot.                | Share a collection                    |
| `/sign-in`              | Start Apple, passkey, or email-link authentication.                | Continue with Apple                   |
| `/invite/family/:token` | Review a family invitation without accepting it.                   | Sign in to continue or Join household |
| `/c/:token`             | Preview a public-safe collection snapshot and select items.        | Import selected                       |
| `/c/:token/import/plan` | Choose a destination and resolve possible duplicates.              | Confirm import                        |
| `/privacy`              | Explain data handling and public-link boundaries.                  | Return to prior task                  |
| `/terms`                | State service conditions in plain language.                        | Return to prior task                  |

### Authenticated workspace

Authenticated pages share a compact top navigation: Households, Collections, Guides, and Account. The active household appears in the page heading, not as a hidden global state. Household pages use local tabs for Overview, Recipes, Groceries, Members, and Collections.

| Route                         | Purpose                                                              | Primary action       |
| ----------------------------- | -------------------------------------------------------------------- | -------------------- |
| `/households`                 | Choose or create a household.                                        | Create household     |
| `/households/:id`             | Review role, recent journal summaries, and agent handoff.            | Open in ChatGPT/Claude |
| `/households/:id/recipes`     | Browse recorded recipes as progressively loaded visual cards.        | Load more recipes    |
| `/households/:id/groceries`   | Browse recorded groceries as progressively loaded visual cards.      | Load more groceries  |
| `/households/:id/members`     | Review people, invitations, and role controls.                       | Invite family member |
| `/households/:id/collections` | Review private collections and published links.                      | Create with agent    |
| `/account`                    | Manage identity methods, grants, exports, memberships, and deletion. | Contextual only      |

### Authorization consent

`/authorize` is a focused pending-intent screen. It shows the requesting host and household-language permissions, then offers Allow or Cancel. It does not expose protocol vocabulary or technical scopes.

## Content hierarchy

1. State: what is happening now, including expired, revoked, blocked, or completed.
2. Object: household, invitation, collection, person, or account.
3. Consequence: what the primary action will and will not do.
4. Action: one primary command with quieter alternatives.
5. Trust detail: privacy, expiration, role, or provenance near the decision.

## Responsive behavior

- At 320-639 pixels, navigation becomes a wrapping text rail; tables become labeled rows without losing headings.
- At 640-959 pixels, lists remain single-column and action groups may wrap.
- At 960 pixels and above, workspace pages use a 12-column content grid with a narrow context rail only where it improves scanning.
- Collection item selection remains one column until 760 pixels, then uses a two-column media list. Recipe and grocery journal cards adapt from one to multiple columns while preserving deterministic reading order. Recipes and groceries never merge into one undifferentiated grid.
