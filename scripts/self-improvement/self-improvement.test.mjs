import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildStopVerificationDecision,
  buildTraceEvent,
  defaultSelfImprovementConfig,
  distillCandidates,
  redactText,
  renderContextLedger,
} from "./lib.mjs";

const config = structuredClone(defaultSelfImprovementConfig);

assert.equal(
  redactText("OPENAI_API_KEY=sk-123456789012345678901234567890"),
  "OPENAI_API_KEY=[REDACTED]",
  "redacts env-style API keys",
);
assert.equal(
  redactText(`token ${["ghp", "123456789012345678901234567890123456"].join("_")}`),
  "token [REDACTED_GITHUB_TOKEN]",
  "redacts GitHub tokens",
);

const correctionEvents = [
  buildTraceEvent({
    hook_event_name: "UserPromptSubmit",
    prompt: "You forgot to run the docs verification.",
  }, new Date("2026-05-30T00:00:00Z")),
  buildTraceEvent({
    hook_event_name: "UserPromptSubmit",
    prompt: "Actually, you missed the verification step again.",
  }, new Date("2026-05-30T00:01:00Z")),
];
const failureEvent = buildTraceEvent({
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: { command: "npm run test:self-improvement" },
  tool_response: { exit_code: 1 },
}, new Date("2026-05-30T00:02:00Z"));

const candidates = distillCandidates([...correctionEvents, failureEvent], config, new Date("2026-05-30T00:03:00Z"));
const correctionCandidate = candidates.find((candidate) => candidate.id === "prompt-corrections");
assert.equal(correctionCandidate?.promotable, true, "repeated corrections become promotable");

const failureCandidate = candidates.find((candidate) => candidate.id.startsWith("tool-failure-"));
assert.equal(failureCandidate?.promotable, true, "single real failures become promotable");
assert.equal(failureCandidate?.severity, "failure", "failure candidates carry failure severity");

const observationalFailureCandidates = distillCandidates([
  buildTraceEvent({
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "rg -n stale-pattern docs" },
    tool_response: { status: "failed" },
  }),
], config);
assert.equal(
  observationalFailureCandidates.length,
  0,
  "failed read-only searches do not become improvement candidates",
);

const missingVerify = buildStopVerificationDecision({
  input: { stop_hook_active: false, last_assistant_message: "Done." },
  changed: ["scripts/self-improvement/lib.mjs", "docs/CONTEXT_LEDGER.md"],
  events: [],
  config,
});
assert.equal(missingVerify.shouldContinue, true, "changed files require verification");
assert.deepEqual(
  missingVerify.missingCommands.sort(),
  ["npm run verify", "npm run verify:docs"].sort(),
  "docs changes add docs verification",
);

const aggregateVerify = buildStopVerificationDecision({
  input: { stop_hook_active: false, last_assistant_message: "Done." },
  changed: ["docs/CONTEXT_LEDGER.md"],
  events: [
    buildTraceEvent({
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm run verify" },
      tool_response: { exit_code: 0 },
    }),
  ],
  config,
});
assert.equal(aggregateVerify.shouldContinue, false, "aggregate verification satisfies narrower checks");

const skippedVerify = buildStopVerificationDecision({
  input: {
    stop_hook_active: false,
    last_assistant_message: "Investigation only. [self-improvement:skip-verify]",
  },
  changed: ["scripts/self-improvement/lib.mjs"],
  events: [],
  config,
});
assert.equal(skippedVerify.shouldContinue, false, "skip token bypasses stop verification");

const activeStop = buildStopVerificationDecision({
  input: { stop_hook_active: true, last_assistant_message: "Done." },
  changed: ["scripts/self-improvement/lib.mjs"],
  events: [],
  config,
});
assert.equal(activeStop.shouldContinue, false, "active stop hook does not loop");

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "self-improvement-test-"));
try {
  mkdirSync(path.join(tempRoot, "docs", "exec-plans", "active"), { recursive: true });
  writeFileSync(path.join(tempRoot, "docs", "exec-plans", "active", "plan.md"), "# Plan\n", "utf8");
  const ledger = renderContextLedger({
    root: tempRoot,
    config,
    candidates,
    gitChanges: ["scripts/self-improvement/lib.mjs"],
    generatedAt: new Date("2026-05-30T00:04:00Z"),
  });
  assert.match(ledger, /App type: generic/, "ledger includes fallback app type");
  assert.match(ledger, /docs\/exec-plans\/active\/plan\.md/, "ledger includes active plans");
  assert.match(ledger, /prompt-corrections/, "ledger includes candidates");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const hooks = JSON.parse(readFileSync(".codex/hooks.json", "utf8"));
for (const [event, groups] of Object.entries(hooks.hooks)) {
  for (const group of groups) {
    for (const hook of group.hooks) {
      const beadsEvent = hook.command.match(/^bd codex-hook (PostCompact|PreCompact|SessionStart|UserPromptSubmit)$/)?.[1];
      if (beadsEvent !== undefined) {
        assert.equal(beadsEvent, event, `Beads hook event matches its group: ${hook.command}`);
        continue;
      }
      const script = hook.command.match(/\/\.codex\/hooks\/([^"]+)/)?.[1];
      assert.ok(script, `hook command should point at a repo-local script: ${hook.command}`);
      assert.ok(existsSync(path.join(".codex", "hooks", script)), `hook script exists: ${script}`);
    }
  }
}

console.log("self-improvement tests passed.");
