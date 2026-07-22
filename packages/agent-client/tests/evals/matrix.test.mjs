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
  const snackBenefit = managingSkill.indexOf("Restock cashews");
  const snackQuestion = managingSkill.indexOf("Ask the first missing question");
  const recipeBenefit = managingSkill.indexOf("What was that pasta we loved?");
  const recipeQuestion = managingSkill.indexOf("Ask where the user saves");
  assert.ok(snackBenefit >= 0 && snackBenefit < snackQuestion);
  assert.ok(recipeBenefit >= 0 && recipeBenefit < recipeQuestion);
  const finalConfirmation = matrix.cases.find((testCase) => testCase.id === "confirmed-onboarding-commits-once");
  assert.deepEqual(finalConfirmation?.required_tools, ["hfj_commit_onboarding"]);
  assert.ok(finalConfirmation?.invariants.includes("one_final_fullwell_write"));
  for (const testCase of matrix.cases) {
    assert.ok(testCase.prompt.length >= 20 || testCase.id === "bare-fullwell-greeting-starts-snacks");
    assert.ok(testCase.invariants.length >= 1);
  }
});
