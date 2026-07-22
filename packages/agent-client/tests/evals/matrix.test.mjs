import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("each eval has a unique identity and runs on both hosts", async () => {
  const matrix = JSON.parse(await readFile(path.join(root, "evals/cases/v1.json"), "utf8"));
  const expected = JSON.parse(await readFile(path.join(root, "evals/expected/v1.json"), "utf8"));
  const managingSkill = await readFile(path.join(root, "skills/manage-household-food-journal/SKILL.md"), "utf8");
  const groceryAuditSkill = await readFile(path.join(root, "skills/audit-grocery-purchases/SKILL.md"), "utf8");
  const draftRuntime = await readFile(path.join(root, "runtime/onboarding-draft.mjs"), "utf8");
  const ids = matrix.cases.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(matrix.hosts.sort(), expected.grader.hosts.sort());
  assert.ok(expected.forbidden_behaviors.length >= 10);
  const bareGreeting = matrix.cases.find((testCase) => testCase.id === "bare-fullwell-greeting-starts-snacks");
  assert.equal(bareGreeting?.prompt, "@Fullwell hi");
  assert.deepEqual(bareGreeting?.skills, ["manage-household-food-journal", "audit-grocery-purchases"]);
  assert.deepEqual(bareGreeting?.required_tools, ["hfj_get_context"]);
  assert.ok(bareGreeting?.invariants.includes("no_generic_greeting_while_open"));
  assert.ok(bareGreeting?.invariants.includes("explain_snack_benefit_before_question"));
  assert.ok(bareGreeting?.invariants.includes("include_concrete_restock_example"));
  assert.ok(bareGreeting?.invariants.includes("no_intermediate_onboarding_write"));
  const recipeTransition = matrix.cases.find((testCase) => testCase.id === "snack-decline-advances-to-recipes");
  assert.ok(recipeTransition?.invariants.includes("explain_recipe_benefit_before_question"));
  assert.ok(recipeTransition?.invariants.includes("include_concrete_recipe_recall_example"));
  assert.ok(expected.forbidden_behaviors.includes("uses_unexplained_snack_or_recipe_setup_label"));
  const orderDetailAudit = matrix.cases.find((testCase) => testCase.id === "order-list-summary-is-incomplete");
  assert.deepEqual(orderDetailAudit?.invariants, [
    "order_listing_is_discovery_only",
    "open_every_qualifying_order_detail",
    "expand_complete_item_list",
    "hidden_items_block_complete_audit"
  ]);
  assert.ok(expected.forbidden_behaviors.includes("treats_order_listing_summary_as_complete_purchase_evidence"));
  assert.ok(groceryAuditSkill.includes("treat order-history listing pages as discovery only"));
  assert.ok(groceryAuditSkill.includes("Open the detail page for every qualifying delivered or completed order"));
  assert.ok(groceryAuditSkill.includes("mark that order incomplete"));
  const snackBenefit = managingSkill.indexOf("Restock cashews");
  const snackQuestion = managingSkill.indexOf("Ask the first missing question");
  const recipeBenefit = managingSkill.indexOf("What was that pasta we loved?");
  const recipeQuestion = managingSkill.indexOf("Ask where the user saves");
  assert.ok(snackBenefit >= 0 && snackBenefit < snackQuestion);
  assert.ok(recipeBenefit >= 0 && recipeBenefit < recipeQuestion);
  const finalConfirmation = matrix.cases.find((testCase) => testCase.id === "confirmed-onboarding-commits-once");
  assert.deepEqual(finalConfirmation?.required_tools, ["hfj_commit_onboarding"]);
  assert.ok(finalConfirmation?.invariants.includes("one_final_fullwell_write"));
  assert.ok(finalConfirmation?.invariants.includes("delete_checkpoint_only_after_success"));
  const largeConfirmation = matrix.cases.find((testCase) => testCase.id === "large-confirmed-onboarding-commits-once");
  assert.deepEqual(largeConfirmation?.required_tools, ["hfj_commit_onboarding"]);
  assert.ok(largeConfirmation?.invariants.includes("accept_10000_items"));
  assert.ok(largeConfirmation?.invariants.includes("accept_10000_evidence"));
  assert.ok(largeConfirmation?.invariants.includes("enforce_16_mib_request_limit"));
  assert.ok(largeConfirmation?.invariants.includes("never_split_within_limit_draft"));
  assert.ok(expected.forbidden_behaviors.includes("splits_a_within_limit_onboarding_draft_into_multiple_writes"));
  const localResume = matrix.cases.find((testCase) => testCase.id === "local-onboarding-draft-resumes");
  assert.deepEqual(localResume?.required_tools, ["hfj_get_context"]);
  assert.ok(localResume?.invariants.includes("exact_user_household_head_revision_binding"));
  const staleDraft = matrix.cases.find((testCase) => testCase.id === "stale-local-onboarding-draft-fails-closed");
  assert.ok(staleDraft?.invariants.includes("never_merge_stale_or_mismatched_draft"));
  assert.ok(expected.forbidden_behaviors.includes("stores_onboarding_credentials_cookies_tokens_browser_state_or_raw_pages_locally"));
  assert.ok(expected.forbidden_behaviors.includes("deletes_the_local_checkpoint_after_a_failed_or_uncertain_fullwell_write"));
  assert.ok(managingSkill.includes("fullwell/drafts/<user-id>/<household-id>/onboarding.json"));
  assert.ok(managingSkill.includes("never put draft contents in command arguments"));
  assert.ok(draftRuntime.includes("expected_draft_revision"));
  assert.ok(draftRuntime.includes("PROHIBITED_DRAFT_DATA"));
  for (const testCase of matrix.cases) {
    assert.ok(testCase.prompt.length >= 20 || testCase.id === "bare-fullwell-greeting-starts-snacks");
    assert.ok(testCase.invariants.length >= 1);
  }
});
