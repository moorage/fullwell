# Screen-State Matrix

| Surface            | Loading / pending      | Empty                                    | Ready                              | Recoverable error                                          | Terminal state                            |
| ------------------ | ---------------------- | ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Install            | Metadata unavailable   | Not applicable                           | One selected host action           | Current action unavailable; show retry and troubleshooting | Installed handoff returns to agent        |
| Agent guides       | Not applicable          | Not applicable                           | Hub or direct task instructions    | Broken destination returns normal not-found page           | Returns to install or task surface        |
| Sign in            | Provider redirect      | No passkey yet                           | Apple, eligible passkey, email     | Generic provider or email failure                          | Signed in and pending intent resumes      |
| Family invite      | Checking capability    | Not applicable                           | Preview; signed-in state adds Join | Sign-in interrupted or CSRF expired                        | Joined, expired, revoked, or already used |
| Collection preview | Snapshot opening       | Valid collection has no importable items | Recipes/snacks with selection      | Rate limited or selection validation error                 | Revoked, expired, unavailable             |
| Import plan        | Duplicate plan running | No editable destination                  | Destination and decisions ready    | Stale snapshot or missing decision                         | Complete, partial, cancelled              |
| Households         | Session check          | No households; create prompt             | Household list                     | Creation or selection error                                | Account signed out                        |
| Household overview | Summary loading        | No journal entries yet                   | Role and summaries                 | Projection unavailable; do not fake data                   | Household removed                         |
| Recipes/groceries  | Next batch loading      | No recorded items in section             | Visual journal cards               | Visible retry keeps already loaded cards                   | End of recorded list or access removed    |
| Members            | Invitation pending     | Owner is only member                     | Members and invitations            | Final-owner or stale-role conflict                         | Invitation revoked/member removed         |
| Collections        | Snapshot publishing    | No collections                           | Private and published lists        | Conflict or permission denial                              | Share revoked/expired                     |
| Account            | Reauthentication       | No passkeys/grants                       | Methods, grants, memberships       | Provider or final-owner block                              | Account deletion requested/completed      |

## Global state rules

- Put an error summary before the affected form and move focus to it on a full-page response.
- Pair status color with an icon and explicit text.
- Never replace missing server data with a success-shaped fixture in production.
- Preserve submitted non-secret fields after validation errors.
- Disable destructive submission only while an enhanced request is in flight; no-JavaScript forms remain usable.
- Every blocked state identifies exactly one action the person can take.
