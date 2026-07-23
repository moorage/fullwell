import assert from "node:assert/strict";
import test from "node:test";

import {
  requiredLocalTools,
  requiredSkills,
  requiredTools,
  validatePackage,
} from "../../scripts/validate-package.mjs";

test("the Codex and Claude package is complete and privacy-safe", async () => {
  const result = await validatePackage();
  assert.equal(result.skillCount, requiredSkills.length);
  assert.equal(result.toolCount, requiredTools.length + requiredLocalTools.length);
  assert.equal(result.endpoint, "https://fullwell.souschefstudio.com/mcp");
  assert.ok(result.evalCount >= 15);
});
