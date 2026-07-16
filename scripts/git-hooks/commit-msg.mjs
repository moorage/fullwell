import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TRAILER_KEY = "AI-Model";
const MODEL_VALUE_RE = /^[A-Za-z0-9][A-Za-z0-9._:+/@ -]*[A-Za-z0-9]$/;
const DIGIT_RE = /\d/;
const DEFAULT_COMMENT_CHAR = "#";

const parseKeyValueLine = (line) => {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }
  return {
    key: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  };
};

export const cleanCommitMessage = (
  message,
  commentChar = DEFAULT_COMMENT_CHAR,
) => {
  const lines = message.replace(/\r\n?/g, "\n").split("\n");
  const cleanLines = [];

  for (const line of lines) {
    if (line.startsWith(`${commentChar} ------------------------ >8 `)) {
      break;
    }
    if (commentChar.length > 0 && line.startsWith(commentChar)) {
      continue;
    }
    cleanLines.push(line);
  }

  return cleanLines.join("\n").trimEnd();
};

export const parseGitTrailers = (message) => {
  const result = spawnSync(
    "git",
    ["interpret-trailers", "--parse", "--only-trailers"],
    {
      encoding: "utf8",
      input: message,
    },
  );

  if (result.status !== 0) {
    const detail = result.stderr.trim() || "git interpret-trailers failed";
    throw new Error(detail);
  }

  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseKeyValueLine)
    .filter((trailer) => trailer !== null);
};

export const validateAiModelTrailer = (message) => {
  const trailers = parseGitTrailers(cleanCommitMessage(message));
  const aiModelTrailers = trailers.filter(
    ({ key }) => key.toLowerCase() === TRAILER_KEY.toLowerCase(),
  );
  const errors = [];

  if (aiModelTrailers.length === 0) {
    errors.push(`missing required ${TRAILER_KEY} trailer`);
  }

  if (aiModelTrailers.length > 1) {
    errors.push(`expected exactly one ${TRAILER_KEY} trailer`);
  }

  if (aiModelTrailers.length === 1) {
    const [{ value }] = aiModelTrailers;
    if (value.length === 0) {
      errors.push(`${TRAILER_KEY} must be a model version or "none"`);
    } else if (value === "none") {
      return { ok: errors.length === 0, errors };
    } else if (value.toLowerCase() === "none") {
      errors.push(`${TRAILER_KEY} must use lowercase "none"`);
    } else if (!MODEL_VALUE_RE.test(value) || !DIGIT_RE.test(value)) {
      errors.push(
        `${TRAILER_KEY} must be "none" or a model version containing a digit`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
};

export const formatAiModelTrailerHelp = () => [
  "commit-msg: every commit message must include an AI model trailer.",
  "",
  "Add one footer line to the end of the commit message:",
  "  AI-Model: gpt-5.5",
  "",
  "If no AI model was used, write:",
  "  AI-Model: none",
].join("\n");

export const validateCommitMessageFile = (commitMessagePath) => {
  const message = readFileSync(commitMessagePath, "utf8");
  return validateAiModelTrailer(message);
};

const isMain = () => {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined
    && path.resolve(entrypoint) === fileURLToPath(import.meta.url);
};

if (isMain()) {
  const commitMessagePath = process.argv[2];
  if (commitMessagePath === undefined) {
    console.error("commit-msg: missing commit message file path");
    process.exit(2);
  }

  const result = validateCommitMessageFile(commitMessagePath);
  if (!result.ok) {
    console.error(result.errors.map((error) => `commit-msg: ${error}`).join("\n"));
    console.error("");
    console.error(formatAiModelTrailerHelp());
    process.exit(1);
  }
}
