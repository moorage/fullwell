#!/usr/bin/env node
import {
  appendTraceEvent,
  buildTraceEvent,
  loadSelfImprovementConfig,
  readJsonFromStdin,
  repoRoot,
} from "../../scripts/self-improvement/lib.mjs";

const input = readJsonFromStdin();
const root = repoRoot(input.cwd);
const config = loadSelfImprovementConfig(root);

appendTraceEvent(root, buildTraceEvent(input), config);
