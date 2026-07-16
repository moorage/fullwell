import assert from "node:assert/strict";

import {
  cleanCommitMessage,
  validateAiModelTrailer,
} from "./commit-msg.mjs";

const validMessage = (trailer) => `feat: add harness policy

Document commit provenance.

${trailer}
`;

const invalidMessage = (body) => `feat: add harness policy

${body}
`;

const cases = [
  {
    name: "accepts no-AI commits",
    message: validMessage("AI-Model: none"),
    ok: true,
  },
  {
    name: "accepts versioned model ids",
    message: validMessage("AI-Model: gpt-5.5"),
    ok: true,
  },
  {
    name: "accepts model ids with suffixes",
    message: validMessage("AI-Model: gpt-5.3-codex"),
    ok: true,
  },
  {
    name: "accepts trailer blocks with other trailers",
    message: `${validMessage("AI-Model: gpt-5.5").trimEnd()}
Signed-off-by: Example User <user@example.com>
`,
    ok: true,
  },
  {
    name: "rejects missing trailers",
    message: invalidMessage("Body without provenance."),
    ok: false,
  },
  {
    name: "rejects empty model values",
    message: validMessage("AI-Model:"),
    ok: false,
  },
  {
    name: "rejects uppercase none",
    message: validMessage("AI-Model: None"),
    ok: false,
  },
  {
    name: "rejects generic non-version model names",
    message: validMessage("AI-Model: codex"),
    ok: false,
  },
  {
    name: "rejects duplicate trailers",
    message: `${validMessage("AI-Model: gpt-5.5").trimEnd()}
AI-Model: none
`,
    ok: false,
  },
  {
    name: "rejects non-footer mentions",
    message: invalidMessage(`AI-Model: gpt-5.5

More body after the mention.`),
    ok: false,
  },
  {
    name: "ignores commit template comments after footer",
    message: `${validMessage("AI-Model: gpt-5.5").trimEnd()}
# Please enter the commit message for your changes.
`,
    ok: true,
  },
];

for (const { name, message, ok } of cases) {
  assert.equal(validateAiModelTrailer(message).ok, ok, name);
}

assert.equal(
  cleanCommitMessage(`feat: add policy

AI-Model: none
# ------------------------ >8 ------------------------
ignored
`),
  `feat: add policy

AI-Model: none`,
  "commit cleanup removes scissor blocks",
);

console.log("commit-msg hook tests passed.");
