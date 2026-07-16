import process from "node:process";
import { spawnSync } from "node:child_process";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const getOutput = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
};

const hasStagedChanges = () => getOutput("git", ["diff", "--cached", "--name-only"]).length > 0;
const stageIfChanged = (path) => {
  const status = getOutput("git", ["status", "--short", "--", path]);
  if (status.length > 0) {
    run("git", ["add", path]);
    console.log(`pre-commit: refreshed and staged ${path}`);
  }
};

if (!hasStagedChanges()) {
  process.exit(0);
}

run("python3", ["scripts/knowledge/generate_repo_map.py"]);
run("python3", ["scripts/knowledge/update_quality_ledger.py"]);
run("python3", ["scripts/knowledge/suggest_doc_updates.py"]);

stageIfChanged("docs/generated/repo-map.json");
stageIfChanged("docs/QUALITY_LEDGER.md");
