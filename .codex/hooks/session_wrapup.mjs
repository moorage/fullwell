#!/usr/bin/env node
import {
  distillCandidates,
  loadSelfImprovementConfig,
  readJsonFromStdin,
  readTraceEvents,
  repoRoot,
  writeLatestSummary,
} from "../../scripts/self-improvement/lib.mjs";

const input = readJsonFromStdin();
const root = repoRoot(input.cwd);
const config = loadSelfImprovementConfig(root);
const events = readTraceEvents(root, config);
const candidates = distillCandidates(events, config);

writeLatestSummary(root, candidates, config);
