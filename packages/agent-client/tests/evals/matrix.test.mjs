import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("each eval has a unique identity and runs on both hosts", async () => {
  const matrix = JSON.parse(await readFile(path.join(root, "evals/cases/v1.json"), "utf8"));
  const expected = JSON.parse(await readFile(path.join(root, "evals/expected/v1.json"), "utf8"));
  const ids = matrix.cases.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(matrix.hosts.sort(), expected.grader.hosts.sort());
  assert.ok(expected.forbidden_behaviors.length >= 10);
  const bareGreeting = matrix.cases.find((testCase) => testCase.id === "bare-fullwell-greeting-starts-snacks");
  assert.equal(bareGreeting?.prompt, "@Fullwell hi");
  assert.deepEqual(bareGreeting?.skills, ["manage-household-food-journal", "audit-grocery-purchases"]);
  assert.deepEqual(bareGreeting?.required_tools, ["hfj_get_context", "hfj_update_onboarding", "hfj_get_profile"]);
  assert.ok(bareGreeting?.invariants.includes("no_generic_greeting_while_open"));
  for (const testCase of matrix.cases) {
    assert.ok(testCase.prompt.length >= 20 || testCase.id === "bare-fullwell-greeting-starts-snacks");
    assert.ok(testCase.invariants.length >= 1);
  }
});
