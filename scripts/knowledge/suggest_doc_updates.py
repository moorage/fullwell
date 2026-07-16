#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def changed_files() -> list[str]:
    try:
        output = subprocess.check_output(
            ["git", "status", "--porcelain"],
            cwd=ROOT,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []

    files: list[str] = []
    for line in output.splitlines():
        if not line:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        files.append(path.strip())
    return files


def suggest_updates(files: list[str]) -> list[str]:
    hints: list[str] = []

    if any(path.startswith("apps/web/") for path in files):
        hints.extend(
            [
                "Review the server product spec for changed browser behavior and acceptance criteria.",
                "Capture a screencast for a materially changed visible workflow when the environment supports it.",
            ]
        )
    if any(path.startswith("apps/server/") for path in files):
        hints.append(
            "Review the server product spec plus architecture, security, and reliability guidance."
        )
    if any(path.startswith("packages/contracts/") for path in files):
        hints.append(
            "Review both product specs and every MCP, HTTP, Git, projection, and agent-client contract consumer."
        )
    if any(path.startswith("packages/agent-client/") for path in files):
        hints.append(
            "Review the client product spec, MCP contract fixtures, packaging tests, and agent evals."
        )
    if any(path.startswith("migrations/") for path in files):
        hints.append(
            "Review architecture, security, reliability, migration rollback, and isolated Neon test evidence."
        )
    if any(
        path == "Dockerfile"
        or path.startswith("deploy/")
        or path.startswith("infra/")
        for path in files
    ):
        hints.append(
            "Review DigitalOcean deployment, persistent Git storage, backup, and rollback guidance."
        )
    if any(
        path.startswith(".codex/")
        or path.startswith(".agents/")
        or path.startswith("scripts/knowledge/")
        for path in files
    ):
        hints.append(
            "Review README.md, AGENTS.md, docs/PLANS.md, and the harness verification commands."
        )
    if any(
        path.startswith("docs/ideas/") or path == "scripts/check_ideation.py"
        for path in files
    ):
        hints.append(
            "Keep docs/ideas/index.md authoritative and run npm run verify:ideas."
        )
    if any("auth" in path.lower() or "security" in path.lower() for path in files):
        hints.append("Review docs/SECURITY.md and affected authorization tests.")

    if not hints:
        return ["No obvious documentation drift detected by path heuristics."]
    return list(dict.fromkeys(hints))


if __name__ == "__main__":
    for hint in suggest_updates(changed_files()):
        print(hint)
