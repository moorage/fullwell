---
name: audit-grocery-purchases
description: Start or continue Fullwell snack onboarding and audit grocery purchase histories for snacks and drinks, including store scope, browser authorization, household preferences, pantry profiles, comparisons, and evidence-backed recurrence reports.
---

# Audit Grocery Purchases

Follow [the MCP contract](../../references/mcp-tool-contract.md), [semantic rules](../../references/semantic-food-rules.md), and [privacy rules](../../references/privacy-and-sharing.md).

1. Call `hfj_get_context` and choose an editable household. If snack onboarding is `not_started`, call `hfj_update_onboarding` with `transition.action: "start"` and `expected_revision: 0`; if it is `skipped`, resume it with the returned revision. Do not mutate a `complete` section.
2. Call `hfj_get_profile` for `snacks`. Reuse confirmed store scope and household preferences. Ask only for missing or changed stores, snack/drink preferences or exclusions that affect interpretation, and which installed browser the user authorizes for background access.
3. Before collecting any store, verify the user is already signed in to every authorized store. Never request credentials or one-time codes.
4. Use a trailing 12-month window and recurrence threshold of two distinct orders unless the user requests different values. Inspect every qualifying order, expand every item list, and preserve exact store, order, date, and line-item evidence privately.
5. Call `hfj_append_evidence` in batches of at most 100 with the current HEAD and a stable idempotency key.
6. Make snack identity and category decisions using the semantic reference. Search and read candidate items; do not let exact-search code make a semantic merge.
7. Author updated item Markdown and report rows. Count distinct store/order pairs rather than quantities. Cite exact item and evidence IDs in every assertion.
8. Call `hfj_commit_change_set` with current HEAD, blob revisions, evidence, assertions, and a stable idempotency key. On conflict, reread and compare before reconstruction.
9. Ask whether the user's shops have changed. Save only confirmed profile changes with `hfj_update_profile`.

If the user naturally declines or has no grocery sources, call `hfj_update_onboarding` for `snacks` with `transition.action: "skip"`, the current revision, and the matching bounded reason. Do not infer intent with keyword matching. When this skill is part of guided first run, return control so the managing skill can advance to recipes.

Report completed counts, exact unresolved items, or the one action blocking progress. Do not log or publicly share purchase details.
