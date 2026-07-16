#!/usr/bin/env node
import {
  distillCandidates,
  loadSelfImprovementConfig,
  readTraceEvents,
  repoRoot,
  runtimePaths,
  writeCandidateArtifacts,
} from "./lib.mjs";

const root = repoRoot();
const config = loadSelfImprovementConfig(root);
const events = readTraceEvents(root, config, 2000);
const candidates = distillCandidates(events, config);
const paths = runtimePaths(root, config);

writeCandidateArtifacts(root, candidates, config);

console.log(`Read ${events.length} trace event(s).`);
console.log(`Wrote ${paths.candidateLessonsPath}.`);
