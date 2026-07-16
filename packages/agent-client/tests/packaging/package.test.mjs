import assert from "node:assert/strict";
import test from "node:test";

import { requiredSkills, requiredTools, validatePackage } from "../../scripts/validate-package.mjs";

test("the Codex and Claude package is complete and privacy-safe", async () => {
  const result = await validatePackage();
  assert.equal(result.skillCount, requiredSkills.length);
  assert.equal(result.toolCount, requiredTools.length);
  assert.equal(result.endpoint, "https://journal.fullwell.app/mcp");
  assert.ok(result.evalCount >= 15);
});
