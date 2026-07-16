#!/usr/bin/env node
import {
  appendTraceEvent,
  buildStopVerificationDecision,
  changedFiles,
  loadSelfImprovementConfig,
  readJsonFromStdin,
  readTraceEvents,
  redactText,
  renderStopDecision,
  repoRoot,
} from "../../scripts/self-improvement/lib.mjs";

const input = readJsonFromStdin();
const root = repoRoot(input.cwd);
const config = loadSelfImprovementConfig(root);
const events = readTraceEvents(root, config);
const decision = buildStopVerificationDecision({
  input,
  changed: changedFiles(root),
  events,
  config,
});
const output = renderStopDecision(decision);

if (decision.shouldContinue) {
  appendTraceEvent(root, {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    sessionId: typeof input.session_id === "string" ? input.session_id : null,
    turnId: typeof input.turn_id === "string" ? input.turn_id : null,
    eventName: "SelfImprovementVerificationGap",
    cwd: typeof input.cwd === "string" ? input.cwd : null,
    model: typeof input.model === "string" ? input.model : null,
    missingCommands: decision.missingCommands.map((command) => redactText(command, 160)),
    changedFileCount: decision.changedFiles.length,
    severity: "warning",
  }, config);
}

if (output.length > 0) {
  process.stdout.write(output);
}
