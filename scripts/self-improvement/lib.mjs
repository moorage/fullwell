import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_MAX_TEXT = 600;
const TRACE_SCHEMA_VERSION = 1;
const NON_ACTIONABLE_FAILURE_FAMILIES = new Set(["rg -n", "sed -n"]);

export const defaultSelfImprovementConfig = {
  schemaVersion: 1,
  appType: "generic",
  runtimeDir: ".codex/self-improvement",
  traceFile: "traces.jsonl",
  candidateFile: "candidates.json",
  contextLedgerPath: "docs/CONTEXT_LEDGER.md",
  candidateLessonsPath: "docs/self-improvement/candidate-lessons.md",
  stopVerification: {
    enabled: true,
    skipTokens: ["[skip-verify]", "[self-improvement:skip-verify]"],
    aggregateCommands: ["npm run verify"],
    changedFileCommands: ["npm run verify"],
    docsCommands: ["npm run verify:docs"],
    execPlanCommands: ["npm run verify:execplan"],
    evalCommands: [],
  },
  gate: {
    minOccurrences: 2,
  },
  pathGroups: {
    docs: ["AGENTS.md", "README.md", "docs/"],
    execPlans: ["docs/exec-plans/active/"],
    evals: ["evals/", "prompts/", "docs/product-specs/"],
    app: [
      "app/",
      "client/",
      "lib/",
      "pages/",
      "scripts/",
      "server/",
      "src/",
      "Cargo.toml",
      "go.mod",
      "package.json",
      "Package.swift",
      "pyproject.toml",
    ],
  },
};

export function repoRoot(startDir = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: startDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return startDir;
  }
}

export function readJsonFromStdin() {
  const input = readFileSync(0, "utf8").trim();
  if (input.length === 0) {
    return {};
  }
  try {
    return JSON.parse(input);
  } catch (error) {
    return {
      hook_event_name: "InvalidHookInput",
      parse_error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function loadSelfImprovementConfig(root) {
  const configPath = path.join(root, ".codex", "self-improvement.config.json");
  if (!existsSync(configPath)) {
    return structuredClone(defaultSelfImprovementConfig);
  }
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  return mergeConfig(defaultSelfImprovementConfig, parsed);
}

export function runtimePaths(root, config = loadSelfImprovementConfig(root)) {
  const runtimeDir = path.join(root, config.runtimeDir);
  return {
    runtimeDir,
    tracePath: path.join(runtimeDir, config.traceFile),
    candidatePath: path.join(runtimeDir, config.candidateFile),
    latestSummaryPath: path.join(runtimeDir, "latest-summary.md"),
    contextLedgerPath: path.join(root, config.contextLedgerPath),
    candidateLessonsPath: path.join(root, config.candidateLessonsPath),
  };
}

export function redactText(value, maxLength = DEFAULT_MAX_TEXT) {
  const text = String(value ?? "");
  const redacted = text
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, "[REDACTED_SLACK_TOKEN]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|DSN|DATABASE_URL))=([^\s"'`]+)/g,
      "$1=[REDACTED]",
    );

  if (redacted.length <= maxLength) {
    return redacted;
  }
  return `${redacted.slice(0, maxLength)}...`;
}

export function fingerprint(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

export function classifyPrompt(prompt) {
  const text = prompt.toLowerCase();
  const classes = [];
  if (/\b(fix|bug|broken|error|failing|failure|regression)\b/.test(text)) {
    classes.push("bugfix");
  }
  if (/\b(add|build|implement|feature|create)\b/.test(text)) {
    classes.push("feature");
  }
  if (/\b(review|audit|scan|risk)\b/.test(text)) {
    classes.push("review");
  }
  if (/\b(doc|docs|readme|agents\.md|claude\.md)\b/.test(text)) {
    classes.push("docs");
  }
  if (/\b(eval|evaluation|golden|score|benchmark)\b/.test(text)) {
    classes.push("eval");
  }
  if (/\b(secret|credential|token|auth|security|permission|sandbox)\b/.test(text)) {
    classes.push("security");
  }
  if (/\b(you forgot|forgot|actually|instead|wrong|missing|missed|not what|do not|don't|stop)\b/.test(text)) {
    classes.push("correction");
  }
  return classes.length > 0 ? classes : ["general"];
}

export function buildTraceEvent(input, now = new Date()) {
  const eventName = String(input.hook_event_name ?? "Unknown");
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const toolName = typeof input.tool_name === "string" ? input.tool_name : null;
  const toolInput = summarizeToolInput(toolName, input.tool_input);
  const toolResponse = summarizeToolResponse(input.tool_response);
  const promptClasses = prompt ? classifyPrompt(prompt) : [];

  return {
    schemaVersion: TRACE_SCHEMA_VERSION,
    timestamp: now.toISOString(),
    sessionId: stringOrNull(input.session_id),
    turnId: stringOrNull(input.turn_id),
    eventName,
    cwd: stringOrNull(input.cwd),
    model: stringOrNull(input.model),
    permissionMode: stringOrNull(input.permission_mode),
    prompt:
      prompt.length > 0
        ? {
            classes: promptClasses,
            fingerprint: fingerprint(redactText(prompt, 2000)),
            length: prompt.length,
            preview: redactText(prompt, 240),
          }
        : null,
    toolName,
    toolInput,
    toolResponse,
    severity: eventSeverity(eventName, promptClasses, toolResponse),
  };
}

export function appendTraceEvent(root, event, config = loadSelfImprovementConfig(root)) {
  const { runtimeDir, tracePath } = runtimePaths(root, config);
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(tracePath, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

export function readTraceEvents(root, config = loadSelfImprovementConfig(root), limit = 500) {
  const { tracePath } = runtimePaths(root, config);
  if (!existsSync(tracePath)) {
    return [];
  }
  const lines = readFileSync(tracePath, "utf8").trim().split("\n").filter(Boolean);
  return lines.slice(-limit).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

export function distillCandidates(events, config = defaultSelfImprovementConfig, now = new Date()) {
  const candidates = [];
  const correctionEvents = events.filter((event) => event.prompt?.classes?.includes("correction"));
  if (correctionEvents.length > 0) {
    candidates.push(makeCandidate({
      id: "prompt-corrections",
      title: "Repeated user correction pattern",
      signal: "User prompts corrected prior agent behavior.",
      severity: "warning",
      recommendedTarget: "AGENTS.md or a focused skill",
      events: correctionEvents,
      config,
      now,
    }));
  }

  const failedToolGroups = groupBy(
    events.filter(isActionableToolFailure),
    (event) => commandFamily(event.toolInput?.command ?? event.toolName ?? "tool"),
  );
  for (const [family, group] of failedToolGroups) {
    candidates.push(makeCandidate({
      id: `tool-failure-${fingerprint(family)}`,
      title: `Failure observed for ${family}`,
      signal: "A tool or verification command returned a failure signal.",
      severity: "failure",
      recommendedTarget: "eval fixture, test, or reliability guidance",
      events: group,
      config,
      now,
    }));
  }

  const verificationGaps = events.filter((event) => event.eventName === "SelfImprovementVerificationGap");
  if (verificationGaps.length > 0) {
    candidates.push(makeCandidate({
      id: "verification-gap",
      title: "Verification gap before stop",
      signal: "A stop hook found changed files without the expected verification command.",
      severity: "warning",
      recommendedTarget: "AGENTS.md or stop verification config",
      events: verificationGaps,
      config,
      now,
    }));
  }

  return candidates.sort((left, right) => {
    if (left.promotable !== right.promotable) {
      return left.promotable ? -1 : 1;
    }
    return right.occurrences - left.occurrences;
  });
}

export function writeCandidateArtifacts(root, candidates, config = loadSelfImprovementConfig(root)) {
  const paths = runtimePaths(root, config);
  mkdirSync(paths.runtimeDir, { recursive: true });
  mkdirSync(path.dirname(paths.candidateLessonsPath), { recursive: true });
  writeFileSync(paths.candidatePath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
  writeFileSync(paths.candidateLessonsPath, renderCandidateLessons(candidates), "utf8");
}

export function writeLatestSummary(root, candidates, config = loadSelfImprovementConfig(root)) {
  const paths = runtimePaths(root, config);
  mkdirSync(paths.runtimeDir, { recursive: true });
  const promotableCount = candidates.filter((candidate) => candidate.promotable).length;
  writeFileSync(
    paths.latestSummaryPath,
    [
      "# Latest Self-Improvement Summary",
      "",
      `- candidates: ${candidates.length}`,
      `- promotable: ${promotableCount}`,
      `- generated: ${new Date().toISOString()}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

export function changedFiles(root) {
  try {
    const output = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const file = line.slice(3).trim();
        return file.includes(" -> ") ? file.split(" -> ").at(-1) : file;
      });
  } catch {
    return [];
  }
}

export function buildStopVerificationDecision({ input, changed, events, config }) {
  if (!config.stopVerification?.enabled) {
    return { shouldContinue: false, missingCommands: [] };
  }
  if (input.stop_hook_active) {
    return { shouldContinue: false, missingCommands: [] };
  }

  const lastMessage = String(input.last_assistant_message ?? "");
  const skipTokens = config.stopVerification.skipTokens ?? [];
  if (skipTokens.some((token) => lastMessage.includes(token))) {
    return { shouldContinue: false, missingCommands: [] };
  }

  const relevantChanged = changed.filter((file) => !isRuntimeFile(file, config));
  if (relevantChanged.length === 0) {
    return { shouldContinue: false, missingCommands: [] };
  }

  const required = new Set(config.stopVerification.changedFileCommands ?? []);
  if (relevantChanged.some((file) => matchesPathGroup(file, config.pathGroups.docs))) {
    for (const command of config.stopVerification.docsCommands ?? []) {
      required.add(command);
    }
  }
  if (relevantChanged.some((file) => matchesPathGroup(file, config.pathGroups.execPlans))) {
    for (const command of config.stopVerification.execPlanCommands ?? []) {
      required.add(command);
    }
  }
  if (relevantChanged.some((file) => matchesPathGroup(file, config.pathGroups.evals))) {
    for (const command of config.stopVerification.evalCommands ?? []) {
      required.add(command);
    }
  }

  const aggregateCommands = config.stopVerification.aggregateCommands ?? [];
  const missingCommands = [...required].filter(
    (command) => !wasCommandRun(command, events) && !aggregateCommands.some((aggregate) => wasCommandRun(aggregate, events)),
  );

  return {
    shouldContinue: missingCommands.length > 0,
    missingCommands,
    changedFiles: relevantChanged,
  };
}

export function renderStopDecision(decision) {
  if (!decision.shouldContinue) {
    return "";
  }
  const commands = decision.missingCommands.map((command) => `\`${command}\``).join(", ");
  const files = decision.changedFiles.slice(0, 8).map((file) => `\`${file}\``).join(", ");
  return JSON.stringify({
    decision: "block",
    reason: `Changed files are present (${files}). Run the missing verification command(s): ${commands}. If this is intentionally skipped, include [self-improvement:skip-verify] in the final response with the reason.`,
  });
}

export function renderContextLedger({ root, config, candidates, gitChanges, generatedAt = new Date() }) {
  const activePlans = listMarkdownFiles(root, path.join(root, "docs", "exec-plans", "active"));
  const promotable = candidates.filter((candidate) => candidate.promotable);
  const candidateLines = candidates.length
    ? candidates.slice(0, 8).map((candidate) => {
        const status = candidate.promotable ? "promotable" : "watch";
        return `- ${candidate.id}: ${status}, ${candidate.occurrences} occurrence(s), target ${candidate.recommendedTarget}`;
      })
    : ["- none"];

  return [
    "# Context Ledger",
    "",
    "Generated by `npm run self-improve:context`.",
    "",
    `Generated at: ${generatedAt.toISOString()}`,
    `App type: ${config.appType}`,
    "",
    "## Current State",
    `- Git changes: ${gitChanges.length}`,
    `- Active ExecPlans: ${activePlans.length ? activePlans.map((file) => `\`${file}\``).join(", ") : "none"}`,
    `- Candidate lessons: ${candidates.length}`,
    `- Promotable lessons: ${promotable.length}`,
    "",
    "## Verification Commands",
    ...unique([
      ...(config.stopVerification.changedFileCommands ?? []),
      ...(config.stopVerification.docsCommands ?? []),
      ...(config.stopVerification.execPlanCommands ?? []),
      ...(config.stopVerification.evalCommands ?? []),
    ]).map((command) => `- \`${command}\``),
    "",
    "## App Surface Configuration",
    ...Object.entries(config.pathGroups).map(([name, patterns]) => `- ${name}: ${patterns.map((pattern) => `\`${pattern}\``).join(", ")}`),
    "",
    "## Candidate Lessons",
    ...candidateLines,
    "",
    "## Agent Startup Notes",
    "- Read this ledger after `AGENTS.md` when a task is broad or touches harness workflow.",
    "- Promote only repeated lessons or lessons backed by a real failure.",
    "- Keep durable guidance short; move repeat workflows into skills or eval fixtures.",
    "",
  ].join("\n");
}

export function renderCandidateLessons(candidates) {
  const rows = candidates.length
    ? candidates.map((candidate) =>
        `| \`${candidate.id}\` | ${candidate.promotable ? "promote" : "watch"} | ${candidate.severity} | ${candidate.occurrences} | ${candidate.recommendedTarget} | ${candidate.signal} |`,
      )
    : ["| none | watch | info | 0 | n/a | No candidate lessons found. |"];

  return [
    "# Candidate Lessons",
    "",
    "Generated by `npm run self-improve:distill` from redacted runtime traces.",
    "",
    "| Candidate | Gate | Severity | Occurrences | Suggested target | Signal |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...rows,
    "",
    "Promotion rule: materialize a lesson only when it repeats or when a real failure signal exists.",
    "Raw traces stay under ignored `.codex/self-improvement/` and should not be committed.",
    "",
  ].join("\n");
}

export function writeContextLedger(root, config, candidates) {
  const paths = runtimePaths(root, config);
  mkdirSync(path.dirname(paths.contextLedgerPath), { recursive: true });
  writeFileSync(
    paths.contextLedgerPath,
    renderContextLedger({
      root,
      config,
      candidates,
      gitChanges: changedFiles(root),
    }),
    "utf8",
  );
}

export function buildSessionContext(root, config = loadSelfImprovementConfig(root)) {
  const paths = runtimePaths(root, config);
  const sections = [];
  if (existsSync(paths.contextLedgerPath)) {
    sections.push(readFileSync(paths.contextLedgerPath, "utf8").slice(0, 3000));
  }
  if (existsSync(paths.candidateLessonsPath)) {
    sections.push(readFileSync(paths.candidateLessonsPath, "utf8").slice(0, 1600));
  }
  if (sections.length === 0) {
    return "";
  }
  return [
    "Self-improvement context from the project harness:",
    "",
    sections.join("\n---\n"),
  ].join("\n");
}

function mergeConfig(base, override) {
  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(override ?? {})) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeConfig(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function summarizeToolInput(toolName, input) {
  if (!input || typeof input !== "object") {
    return null;
  }
  if (toolName === "apply_patch") {
    const patch = typeof input.command === "string" ? input.command : JSON.stringify(input);
    return {
      kind: "patch",
      touchedFiles: extractPatchFiles(patch),
      patchFingerprint: fingerprint(patch),
    };
  }
  const command = typeof input.command === "string" ? input.command : null;
  if (toolName === "Bash" || command) {
    return {
      kind: "command",
      command: redactText(command ?? "", DEFAULT_MAX_TEXT),
      commandFingerprint: fingerprint(command ?? ""),
    };
  }
  return {
    kind: "structured",
    keys: Object.keys(input).sort().slice(0, 20),
  };
}

function summarizeToolResponse(response) {
  if (response === undefined || response === null) {
    return null;
  }
  const text = typeof response === "string" ? response : JSON.stringify(response);
  return {
    failed: responseIndicatesFailure(response),
    exitCode: findExitCode(response),
    fingerprint: fingerprint(redactText(text, 2000)),
    bytes: text.length,
  };
}

function responseIndicatesFailure(response) {
  const exitCode = findExitCode(response);
  if (typeof exitCode === "number") {
    return exitCode !== 0;
  }
  if (typeof response === "string") {
    return /process exited with code [1-9]|error:|failed/i.test(response);
  }
  if (response && typeof response === "object") {
    const status = String(response.status ?? response.outcome ?? "").toLowerCase();
    return ["failed", "failure", "error", "rejected"].includes(status);
  }
  return false;
}

function findExitCode(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const key of ["exit_code", "exitCode", "status", "code", "returncode"]) {
    if (typeof value[key] === "number") {
      return value[key];
    }
  }
  return null;
}

function eventSeverity(eventName, promptClasses, toolResponse) {
  if (toolResponse?.failed) {
    return "failure";
  }
  if (promptClasses.includes("correction")) {
    return "warning";
  }
  if (eventName === "InvalidHookInput") {
    return "warning";
  }
  return "info";
}

function extractPatchFiles(patch) {
  const files = new Set();
  for (const line of String(patch).split("\n")) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
    if (match) {
      files.add(match[1].trim());
    }
  }
  return [...files].sort();
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function makeCandidate({ id, title, signal, severity, recommendedTarget, events, config, now }) {
  const occurrences = events.length;
  const firstSeen = events.map((event) => event.timestamp).sort()[0] ?? now.toISOString();
  const lastSeen = events.map((event) => event.timestamp).sort().at(-1) ?? now.toISOString();
  const promotable = severity === "failure" || occurrences >= config.gate.minOccurrences;
  return {
    id,
    title,
    signal,
    severity,
    occurrences,
    promotable,
    recommendedTarget,
    firstSeen,
    lastSeen,
    evidence: events.slice(-5).map((event) => ({
      eventName: event.eventName,
      timestamp: event.timestamp,
      fingerprint: event.prompt?.fingerprint ?? event.toolResponse?.fingerprint ?? fingerprint(JSON.stringify(event)),
    })),
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function commandFamily(command) {
  const text = String(command ?? "").trim();
  if (/^npm run [^\s]+/.test(text)) {
    return text.match(/^npm run [^\s]+/)[0];
  }
  if (/^(pnpm|yarn) [^\s]+/.test(text)) {
    return text.match(/^(pnpm|yarn) [^\s]+/)[0];
  }
  if (/^(pytest|go test|cargo test|swift test)\b/.test(text)) {
    return text.match(/^(pytest|go test|cargo test|swift test)\b/)[0];
  }
  return text.split(/\s+/).slice(0, 2).join(" ") || "tool";
}

function isActionableToolFailure(event) {
  if (!event.toolResponse?.failed) {
    return false;
  }
  const family = commandFamily(event.toolInput?.command ?? event.toolName ?? "tool");
  return !NON_ACTIONABLE_FAILURE_FAMILIES.has(family);
}

function matchesPathGroup(file, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return file === pattern.slice(0, -1) || file.startsWith(pattern);
    }
    return file === pattern || file.startsWith(`${pattern}/`);
  });
}

function isRuntimeFile(file, config) {
  const runtime = config.runtimeDir.endsWith("/") ? config.runtimeDir : `${config.runtimeDir}/`;
  return file === config.runtimeDir || file.startsWith(runtime);
}

function wasCommandRun(requiredCommand, events) {
  return events.some((event) => {
    const command = event.toolInput?.command;
    return typeof command === "string" && normalizeCommand(command).includes(normalizeCommand(requiredCommand));
  });
}

function normalizeCommand(command) {
  return String(command).replace(/\s+/g, " ").trim();
}

function listMarkdownFiles(root, dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => path.relative(root, path.join(dir, file)));
}

function unique(values) {
  return [...new Set(values)];
}
