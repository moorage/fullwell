---
name: audit-grocery-purchases
description: Audit grocery purchase histories for snacks and drinks, update pantry profiles, compare stores, or recalculate evidence-backed recurrence reports.
---

# Audit Grocery Purchases

Follow [the MCP contract](../../references/mcp-tool-contract.md), [semantic rules](../../references/semantic-food-rules.md), and [privacy rules](../../references/privacy-and-sharing.md).

1. Call `hfj_get_context`, choose an editable household, and call `hfj_get_profile` for `snacks`.
2. Ask which stores to inspect when the profile is absent. Ask which installed browser the user authorizes for background access.
3. Before collecting any store, verify the user is already signed in to every authorized store. Never request credentials or one-time codes.
4. Establish the trailing date window. Inspect every qualifying order, expand every item list, and preserve exact store, order, date, and line-item evidence privately.
5. Call `hfj_append_evidence` in batches of at most 100 with the current HEAD and a stable idempotency key.
6. Make snack identity and category decisions using the semantic reference. Search and read candidate items; do not let exact-search code make a semantic merge.
7. Author updated item Markdown and report rows. Count distinct store/order pairs rather than quantities. Cite exact item and evidence IDs in every assertion.
8. Call `hfj_commit_change_set` with current HEAD, blob revisions, evidence, assertions, and a stable idempotency key. On conflict, reread and compare before reconstruction.
9. Ask whether the user's shops have changed. Save only confirmed profile changes with `hfj_update_profile`.

Report completed counts, exact unresolved items, or the one action blocking progress. Do not log or publicly share purchase details.
