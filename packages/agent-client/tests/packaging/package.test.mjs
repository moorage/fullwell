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
  assert.ok(requiredSkills.includes("audit-food-delivery-orders"));
  assert.ok(requiredSkills.includes("reorder-food-delivery"));
  assert.deepEqual(requiredTools.filter((tool) => tool.includes("delivery")), [
    "hfj_commit_delivery_index",
    "hfj_get_delivery_index",
    "hfj_get_delivery_order",
    "hfj_search_delivery_history",
  ]);
});
