#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACTIVE_DIR = ROOT / "docs" / "exec-plans" / "active"

REQUIRED_HEADINGS = [
    "Purpose / Big Picture",
    "Progress",
    "Surprises & Discoveries",
    "Decision Log",
    "Context and Orientation",
    "Milestones",
    "Acceptance / Verification",
    "Outcomes & Retrospective",
]

COMMAND_HINT_RE = re.compile(r"(npm run|npx |node |python3 |tsx )")
FILE_RE = re.compile(r"`([^`]+)`")


def iter_plans(paths: list[Path]) -> list[Path]:
    if paths:
        return [path if path.is_absolute() else (ROOT / path) for path in paths]
    if not ACTIVE_DIR.exists():
        return []
    return sorted(path for path in ACTIVE_DIR.glob("*.md") if path.is_file())


def find_missing_sections(text: str) -> list[str]:
    missing: list[str] = []
    for heading in REQUIRED_HEADINGS:
        pattern = rf"^##\s+{re.escape(heading)}\s*$"
        if not re.search(pattern, text, re.MULTILINE):
            missing.append(heading)
    return missing


def section_body(text: str, heading: str) -> str:
    pattern = rf"^##\s+{re.escape(heading)}\s*$([\s\S]*?)(?=^##\s+|\Z)"
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1) if match else ""


def progress_warnings(text: str) -> list[str]:
    warnings: list[str] = []
    body = section_body(text, "Progress")
    if "- [ ]" not in body and "- [x]" not in body:
        warnings.append("Progress section exists but does not contain checkbox items.")
    if re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z", body) is None:
        warnings.append("Progress entries should include timestamps such as 2026-03-19T23:03Z.")
    return warnings


def acceptance_warnings(text: str) -> list[str]:
    warnings: list[str] = []
    body = section_body(text, "Acceptance / Verification")
    if not COMMAND_HINT_RE.search(body):
        warnings.append("Acceptance / Verification does not appear to include runnable commands.")
    return warnings


def file_reference_warnings(text: str) -> list[str]:
    warnings: list[str] = []
    missing_paths: list[str] = []
    for match in FILE_RE.finditer(text):
        candidate = match.group(1)
        if "/" not in candidate or candidate.startswith("http"):
            continue
        if any(ch.isspace() for ch in candidate) or "*" in candidate:
            continue
        normalized = candidate.rstrip(",:.")
        path = ROOT / normalized
        if not path.exists():
            missing_paths.append(normalized)
    if missing_paths:
        warnings.append(
            "Plan references files that do not currently exist: "
            + ", ".join(sorted(set(missing_paths))[:10])
        )
    return warnings


def validate_plan(path: Path) -> tuple[list[str], list[str]]:
    text = path.read_text(encoding="utf-8")
    missing = find_missing_sections(text)
    warnings = progress_warnings(text) + acceptance_warnings(text) + file_reference_warnings(text)
    return missing, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate active ExecPlans.")
    parser.add_argument(
        "plans",
        nargs="*",
        type=Path,
        help="Optional ExecPlan path(s). Defaults to docs/exec-plans/active/*.md",
    )
    args = parser.parse_args()

    plans = iter_plans(args.plans)
    if not plans:
        print("OK: no active ExecPlans found.")
        return 0

    exit_code = 0
    for plan in plans:
        if not plan.exists():
            print(f"ERROR: file not found: {plan}", file=sys.stderr)
            exit_code = 2
            continue
        missing, warnings = validate_plan(plan)
        rel = plan.relative_to(ROOT)
        if missing:
            exit_code = 1
            print(f"ERROR: {rel} is missing required sections:")
            for heading in missing:
                print(f"  - {heading}")
        else:
            print(f"OK: {rel}")
        for warning in warnings:
            print(f"WARNING: {rel}: {warning}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
