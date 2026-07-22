---
name: audit-grocery-purchases
description: Start or continue Fullwell snack onboarding and audit grocery purchase histories for snacks and drinks, including store scope, browser authorization, household preferences, pantry profiles, comparisons, and evidence-backed recurrence reports.
---

# Audit Grocery Purchases

Follow [the MCP contract](../../references/mcp-tool-contract.md), [semantic rules](../../references/semantic-food-rules.md), and [privacy rules](../../references/privacy-and-sharing.md).

1. For a standalone audit, call `hfj_get_context` and choose an editable household. During guided first run, reuse the managing skill's context snapshot and do not call Fullwell tools before final confirmation.
2. Read the snack profile from the guided snapshot, or call `hfj_get_profile` for a standalone audit. When opening or resuming snack onboarding, explain once that learning from past orders lets Fullwell respond to a request such as "Restock cashews" with the familiar product instead of guessing, while still requiring confirmation before adding it to the cart. Do not call it "snack setup" without that context. Reuse confirmed store scope and household preferences. Ask only for missing or changed stores, snack/drink preferences or exclusions that affect interpretation, and which installed browser the user authorizes for background access.
3. Before collecting any store, verify the user is already signed in to every authorized store. Never request credentials or one-time codes.
4. Use a trailing 12-month window and recurrence threshold of two distinct orders unless the user requests different values. While operating the authorized browser, treat order-history listing pages as discovery only: thumbnails, abbreviated cards, and visible summary items are never complete purchase evidence.
   - Traverse every result page and required date or year filter for the window. Open the detail page for every qualifying delivered or completed order, even when its listing card appears to show items.
   - Expand every **View all items**, **Show more**, item-count link, or equivalent control. Verify exact line-item names are visible through the subtotal or order-total boundary before treating that order as collected.
   - For Amazon, Fresh, or Whole Foods, expand **Items in your order (N)** and capture every row. For Weee, capture every product under **Item Info** through the subtotal. For Good Eggs, capture every product between **Items** and **Subtotal**.
   - If a detail page or expansion control cannot expose all items, mark that order incomplete, state the limitation, and do not claim the audit or any affected recurrence result is complete. Never infer hidden items from listing-page thumbnails or summaries.
5. In a standalone audit, call `hfj_append_evidence` in batches of at most 100 with the current HEAD and a stable idempotency key. In guided draft mode, return each completed order cursor and its typed evidence to the managing skill so it checkpoints them locally for `hfj_commit_onboarding`; never retain the only copy in conversation state until the entire site is finished.
6. Make snack identity and category decisions using the semantic reference. In guided draft mode use the snapshot item index; otherwise search and read candidate items. If the index is truncated or lacks enough detail for a safe update, return the exact missing reads to the managing skill. Do not let exact-search code make a semantic merge.
7. Author updated item Markdown and report rows. Count distinct store/order pairs rather than quantities. Cite exact item and evidence IDs in every assertion.
8. In a standalone audit, call `hfj_commit_change_set` with current HEAD, blob revisions, evidence, assertions, and a stable idempotency key. In guided draft mode, return the items, recurring-snacks report, expected item revisions, and `complete` outcome to the managing skill without writing them.
9. Ask whether the user's shops have changed. In guided draft mode, return only confirmed snack profile changes; otherwise save them with `hfj_update_profile`.

If the user naturally declines or has no grocery sources, do not infer intent with keyword matching. During guided first run, return the bounded skip reason and snapshot revision to the managing skill without a tool call so it can advance to recipes. For a standalone onboarding transition, `hfj_update_onboarding` remains available.

Report completed counts, exact unresolved items, or the one action blocking progress. Do not log or publicly share purchase details.
