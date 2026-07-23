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
  const localRuntime = await readFile(path.join(root, "runtime/local-household.mjs"), "utf8");
  const localMcpRuntime = await readFile(path.join(root, "runtime/local-household-mcp.mjs"), "utf8");
  const mcpConfig = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8"));
  const ids = matrix.cases.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(matrix.hosts.sort(), expected.grader.hosts.sort());
  assert.ok(expected.forbidden_behaviors.length >= 10);
  const bareGreeting = matrix.cases.find((testCase) => testCase.id === "bare-fullwell-greeting-asks-account");
  assert.equal(bareGreeting?.prompt, "@Fullwell hi");
  assert.deepEqual(bareGreeting?.skills, ["manage-household-food-journal"]);
  assert.deepEqual(bareGreeting?.required_tools, ["fullwell_local_household_load"]);
  assert.ok(bareGreeting?.invariants.includes("no_generic_greeting_while_open"));
  assert.ok(bareGreeting?.invariants.includes("ask_existing_account_once"));
  assert.ok(bareGreeting?.invariants.includes("no_fullwell_call_before_answer"));
  const noAccount = matrix.cases.find((testCase) => testCase.id === "first-time-no-account-starts-local-groceries");
  assert.deepEqual(noAccount?.required_tools, ["fullwell_local_household_load", "fullwell_local_household_update"]);
  assert.ok(noAccount?.invariants.includes("initialize_local_guest_household"));
  assert.ok(noAccount?.invariants.includes("explain_snack_benefit_before_question"));
  assert.ok(noAccount?.invariants.includes("include_concrete_restock_example"));
  assert.ok(managingSkill.includes("snacks, ingredients, condiments, and other groceries"));
  assert.ok(managingSkill.includes("Buy a head of parsley"));
  assert.ok(managingSkill.includes("not the Japanese one"));
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
  const wholeGroceryAudit = matrix.cases.find((testCase) => testCase.id === "one-pass-whole-grocery-audit");
  assert.ok(wholeGroceryAudit?.invariants.includes("one_order_detail_traversal"));
  assert.ok(wholeGroceryAudit?.invariants.includes("learn_below_recurrence_threshold"));
  assert.ok(groceryAuditSkill.includes("never revisit the orders in a second pass"));
  assert.ok(groceryAuditSkill.includes("even when it appears in only one order"));
  const parsley = matrix.cases.find((testCase) => testCase.id === "restock-usual-parsley-source");
  assert.ok(parsley?.invariants.includes("ingredient_is_historical_candidate"));
  const mayonnaise = matrix.cases.find((testCase) => testCase.id === "restock-mayo-negative-formulation");
  assert.ok(mayonnaise?.invariants.includes("exclude_japanese_formulation"));
  assert.ok(expected.forbidden_behaviors.includes("stores_an_ingredient_condiment_or_other_grocery_as_a_snack"));
  assert.ok(expected.forbidden_behaviors.includes("drops_a_grocery_identity_below_the_recurrence_threshold"));
  assert.ok(expected.forbidden_behaviors.includes("merges_standard_and_japanese_style_mayonnaise"));
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
  assert.ok(finalConfirmation?.invariants.includes("offer_restock_try_it_after_successful_completion"));
  const localCompletion = matrix.cases.find((testCase) => testCase.id === "recipe-no-sources-finishes-guided-run");
  assert.ok(localCompletion?.invariants.includes("offer_restock_try_it_after_successful_completion"));
  assert.ok(localCompletion?.invariants.includes("explain_history_based_product_and_store"));
  assert.ok(localCompletion?.invariants.includes("preserve_cart_confirmation"));
  assert.ok(managingSkill.includes("Want to try Fullwell now?"));
  assert.ok(managingSkill.includes("usual product and store"));
  assert.ok(managingSkill.includes("then ask before adding it to your cart"));
  assert.ok(expected.forbidden_behaviors.includes("offers_restock_try_it_before_successful_onboarding_completion"));
  const largeConfirmation = matrix.cases.find((testCase) => testCase.id === "large-confirmed-onboarding-commits-once");
  assert.deepEqual(largeConfirmation?.required_tools, ["hfj_commit_onboarding"]);
  assert.ok(largeConfirmation?.invariants.includes("accept_10000_items"));
  assert.ok(largeConfirmation?.invariants.includes("accept_10000_evidence"));
  assert.ok(largeConfirmation?.invariants.includes("enforce_16_mib_request_limit"));
  assert.ok(largeConfirmation?.invariants.includes("never_split_within_limit_draft"));
  assert.ok(expected.forbidden_behaviors.includes("splits_a_within_limit_onboarding_draft_into_multiple_writes"));
  const localResume = matrix.cases.find((testCase) => testCase.id === "local-onboarding-draft-resumes");
  assert.deepEqual(localResume?.required_tools, ["fullwell_local_household_load", "fullwell_local_household_update"]);
  assert.ok(localResume?.invariants.includes("load_local_guest_before_remote_context"));
  const staleDraft = matrix.cases.find((testCase) => testCase.id === "stale-local-onboarding-draft-fails-closed");
  assert.ok(staleDraft?.invariants.includes("never_merge_stale_or_mismatched_draft"));
  assert.ok(expected.forbidden_behaviors.includes("stores_onboarding_credentials_cookies_tokens_browser_state_or_raw_pages_locally"));
  assert.ok(expected.forbidden_behaviors.includes("deletes_the_local_checkpoint_after_a_failed_or_uncertain_fullwell_write"));
  assert.ok(managingSkill.includes("fullwell/drafts/<user-id>/<household-id>/onboarding.json"));
  assert.ok(managingSkill.includes("never put draft contents in command arguments"));
  assert.ok(draftRuntime.includes("expected_draft_revision"));
  assert.ok(draftRuntime.includes("PROHIBITED_DRAFT_DATA"));
  assert.ok(managingSkill.includes("Do you already have a Fullwell account?"));
  assert.ok(managingSkill.includes("fullwell/local/household.json"));
  assert.ok(managingSkill.includes("You only need an account for cloud backup, WhatsApp, sharing, or family access"));
  assert.ok(localRuntime.includes("expected_revision"));
  assert.ok(localRuntime.includes("PROHIBITED_LOCAL_DATA"));
  assert.equal(mcpConfig["fullwell-local"].args[0], "./runtime/local-household-mcp.mjs");
  assert.ok(localMcpRuntime.includes("fullwell_local_household_load"));
  assert.ok(localMcpRuntime.includes("fullwell_local_household_update"));
  assert.ok(localMcpRuntime.includes("fullwell_local_household_delete_collecting"));
  const declinedBackup = matrix.cases.find((testCase) => testCase.id === "declined-cloud-backup-stays-local");
  assert.deepEqual(declinedBackup?.required_tools, ["fullwell_local_household_load"]);
  const acceptedBackup = matrix.cases.find((testCase) => testCase.id === "local-journal-backs-up-after-consent");
  assert.deepEqual(acceptedBackup?.required_tools, [
    "fullwell_local_household_load",
    "fullwell_local_household_update",
    "hfj_get_context",
    "hfj_create_household",
    "hfj_commit_onboarding",
  ]);
  assert.ok(acceptedBackup?.invariants.includes("record_cloud_link_only_after_success"));
  assert.ok(expected.forbidden_behaviors.includes("calls_fullwell_before_the_user_chooses_an_existing_account_or_cloud_backup"));
  assert.ok(expected.forbidden_behaviors.includes("marks_cloud_backup_after_a_failed_or_uncertain_hosted_write"));
  const stableLocalPermission = matrix.cases.find((testCase) => testCase.id === "local-tool-permission-survives-upgrade");
  assert.deepEqual(stableLocalPermission?.required_tools, ["fullwell_local_household_load", "fullwell_local_household_update"]);
  assert.ok(stableLocalPermission?.invariants.includes("no_versioned_cache_command"));
  assert.ok(managingSkill.includes("Never execute the versioned `runtime/local-household.mjs` cache path directly"));
  assert.ok(managingSkill.includes("persistent choice applies to this named local tool across Fullwell upgrades"));
  assert.ok(expected.forbidden_behaviors.includes("runs_a_version_specific_local_household_command"));
  assert.ok(expected.forbidden_behaviors.includes("edits_the_users_command_allowlist"));
  for (const testCase of matrix.cases) {
    assert.ok(testCase.prompt.length >= 20 || testCase.id === "bare-fullwell-greeting-asks-account");
    assert.ok(testCase.invariants.length >= 1);
  }
});
