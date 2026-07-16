#!/usr/bin/env node
import {
  buildSessionContext,
  loadSelfImprovementConfig,
  readJsonFromStdin,
  repoRoot,
} from "../../scripts/self-improvement/lib.mjs";

const input = readJsonFromStdin();
const root = repoRoot(input.cwd);
const config = loadSelfImprovementConfig(root);
const context = buildSessionContext(root, config);

if (context.trim().length > 0) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  }));
}
