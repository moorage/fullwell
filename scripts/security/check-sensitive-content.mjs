import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const privatePathPatterns = [
  {
    kind: "private Beads export",
    pattern: /(?:^|\/)\.beads\/(?:issues|interactions|events)\.jsonl$/,
  },
  {
    kind: "private Beads database",
    pattern: /(?:^|\/)\.beads\/(?:backup|dolt|embeddeddolt)(?:\/|$)/,
  },
  {
    kind: "private Dolt database",
    pattern: /(?:^|\/)\.dolt(?:\/|$)/,
  },
  {
    kind: "private Beads credential",
    pattern: /(?:^|\/)\.beads-credential-key$/,
  },
];

const sensitiveFilenamePatterns = [
  {
    kind: "environment credential file",
    pattern: /(?:^|\/)\.env(?:\.[^/]+)?$/,
    allow: /(?:^|\/)\.env\.(?:example|sample|template)$/,
  },
  {
    kind: "private key or certificate bundle",
    pattern: /(?:^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:key|pem|p12|pfx))$/,
  },
  {
    kind: "provider client-secret file",
    pattern: /(?:^|\/)client_secret[^/]*\.json$/i,
  },
  {
    kind: "infrastructure state file",
    pattern: /\.(?:tfstate|tfplan)$/,
  },
];

const sensitiveContentPatterns = [
  {
    kind: "private key",
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  },
  {
    kind: "AWS access key",
    pattern: /\bAKIA[A-Z0-9]{16}\b/,
  },
  {
    kind: "DigitalOcean access token",
    pattern: /\bdop_v1_[a-f0-9]{64}\b/i,
  },
  {
    kind: "Stripe live credential",
    pattern: /\b(?:rk|sk)_live_[A-Za-z0-9]{20,}\b/,
  },
  {
    kind: "GitHub access token",
    pattern: /\b(?:ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  {
    kind: "Slack access token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  },
  {
    kind: "Google API key",
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/,
  },
  {
    kind: "credential-bearing database URL",
    pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@[^\s/"']+/,
  },
  {
    kind: "personal macOS home path",
    pattern: /\/Users\/[A-Za-z0-9._-]+\//,
  },
  {
    kind: "personal Linux home path",
    pattern: /\/home\/[A-Za-z0-9._-]+\//,
  },
  {
    kind: "personal Windows home path",
    pattern: /[A-Za-z]:\\Users\\[^\\\r\n]+\\/,
  },
];

const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length;

export const findSensitiveFindings = ({ filePath, content }) => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const findings = [];

  for (const rule of privatePathPatterns) {
    if (rule.pattern.test(normalizedPath)) {
      findings.push({ filePath: normalizedPath, kind: rule.kind });
    }
  }

  for (const rule of sensitiveFilenamePatterns) {
    if (rule.pattern.test(normalizedPath) && !(rule.allow?.test(normalizedPath) ?? false)) {
      findings.push({ filePath: normalizedPath, kind: rule.kind });
    }
  }

  if (content !== undefined) {
    for (const rule of sensitiveContentPatterns) {
      const index = content.search(rule.pattern);
      if (index >= 0) {
        findings.push({
          filePath: normalizedPath,
          kind: rule.kind,
          line: lineNumberAt(content, index),
        });
      }
    }
  }

  return findings;
};

const runGit = (args, cwd, encoding = "utf8") => {
  const result = spawnSync("git", args, {
    cwd,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString().trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
};

const parseNulPaths = (output) => output.toString().split("\0").filter((candidate) => candidate.length > 0);

const loadWorkingTreeFiles = async (cwd) => {
  const candidates = parseNulPaths(runGit(
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    cwd,
    "buffer",
  ));
  const deleted = new Set(parseNulPaths(runGit(["ls-files", "-z", "--deleted"], cwd, "buffer")));
  const files = [];

  for (const filePath of candidates) {
    if (deleted.has(filePath)) continue;
    const absolutePath = path.join(cwd, filePath);
    const metadata = await lstat(absolutePath);
    files.push({
      filePath,
      content: metadata.isFile() ? (await readFile(absolutePath)).toString("utf8") : undefined,
    });
  }

  return files;
};

const loadStagedFiles = (cwd) => {
  const paths = parseNulPaths(runGit(
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
    cwd,
    "buffer",
  ));
  return paths.map((filePath) => ({
    filePath,
    content: runGit(["show", `:${filePath}`], cwd, "buffer").toString("utf8"),
  }));
};

export const scanSensitiveContent = async ({ cwd = process.cwd(), staged = false } = {}) => {
  const files = staged ? loadStagedFiles(cwd) : await loadWorkingTreeFiles(cwd);
  return files.flatMap(findSensitiveFindings);
};

const runCli = async () => {
  const args = new Set(process.argv.slice(2));
  const valid = args.size === 0 || (args.size === 1 && args.has("--staged"));
  if (!valid) {
    console.error("usage: node scripts/security/check-sensitive-content.mjs [--staged]");
    process.exitCode = 2;
    return;
  }

  const findings = await scanSensitiveContent({ staged: args.has("--staged") });
  if (findings.length === 0) {
    console.log(`sensitive-content check passed (${args.has("--staged") ? "staged files" : "repository files"}).`);
    return;
  }

  console.error("Sensitive repository content detected. Remove it and rotate any real credential before committing.");
  for (const finding of findings) {
    const location = finding.line === undefined ? finding.filePath : `${finding.filePath}:${finding.line}`;
    console.error(`- ${location}: ${finding.kind}`);
  }
  process.exitCode = 1;
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runCli();
}
