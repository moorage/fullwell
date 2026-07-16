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
  for (const testCase of matrix.cases) {
    assert.ok(testCase.prompt.length >= 20);
    assert.ok(testCase.invariants.length >= 1);
  }
});
