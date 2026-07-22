---
name: audit-grocery-purchases
description: Start or continue Fullwell snack onboarding and audit grocery purchase histories for snacks and drinks, including store scope, browser authorization, household preferences, pantry profiles, comparisons, and evidence-backed recurrence reports.
---

# Audit Grocery Purchases

Follow [the MCP contract](../../references/mcp-tool-contract.md), [semantic rules](../../references/semantic-food-rules.md), and [privacy rules](../../references/privacy-and-sharing.md).

1. For a standalone audit, call `hfj_get_context` and choose an editable household. During guided first run, reuse the managing skill's context snapshot and do not call Fullwell tools before final confirmation.
2. Read the snack profile from the guided snapshot, or call `hfj_get_profile` for a standalone audit. Reuse confirmed store scope and household preferences. Ask only for missing or changed stores, snack/drink preferences or exclusions that affect interpretation, and which installed browser the user authorizes for background access.
3. Before collecting any store, verify the user is already signed in to every authorized store. Never request credentials or one-time codes.
4. Use a trailing 12-month window and recurrence threshold of two distinct orders unless the user requests different values. Inspect every qualifying order, expand every item list, and preserve exact store, order, date, and line-item evidence privately.
5. In a standalone audit, call `hfj_append_evidence` in batches of at most 100 with the current HEAD and a stable idempotency key. In guided draft mode, retain typed evidence in the active conversation for `hfj_commit_onboarding`.
6. Make snack identity and category decisions using the semantic reference. In guided draft mode use the snapshot item index; otherwise search and read candidate items. If the index is truncated or lacks enough detail for a safe update, return the exact missing reads to the managing skill. Do not let exact-search code make a semantic merge.
7. Author updated item Markdown and report rows. Count distinct store/order pairs rather than quantities. Cite exact item and evidence IDs in every assertion.
8. In a standalone audit, call `hfj_commit_change_set` with current HEAD, blob revisions, evidence, assertions, and a stable idempotency key. In guided draft mode, return the items, recurring-snacks report, expected item revisions, and `complete` outcome to the managing skill without writing them.
9. Ask whether the user's shops have changed. In guided draft mode, return only confirmed snack profile changes; otherwise save them with `hfj_update_profile`.

If the user naturally declines or has no grocery sources, do not infer intent with keyword matching. During guided first run, return the bounded skip reason and snapshot revision to the managing skill without a tool call so it can advance to recipes. For a standalone onboarding transition, `hfj_update_onboarding` remains available.

Report completed counts, exact unresolved items, or the one action blocking progress. Do not log or publicly share purchase details.
