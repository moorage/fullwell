#!/usr/bin/env python3
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = [
    ROOT / "AGENTS.md",
    ROOT / "docs" / "ARCHITECTURE.md",
    ROOT / "README.md",
    ROOT / "docs" / "PLANS.md",
    ROOT / "docs" / "SECURITY.md",
    ROOT / "docs" / "RELIABILITY.md",
    ROOT / "docs" / "QUALITY_LEDGER.md",
    ROOT / "docs" / "product-specs" / "index.md",
    ROOT / "docs" / "EXECUTION_GUIDE.md",
    ROOT / "docs" / "IMPLEMENTATION_LOG.md",
    ROOT / "scripts" / "check_ideation.py",
]

def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)

for path in REQUIRED_FILES:
    if not path.exists():
        fail(f"Missing required file: {path.relative_to(ROOT)}")

active_dir = ROOT / "docs" / "exec-plans" / "active"
completed_dir = ROOT / "docs" / "exec-plans" / "completed"
active_dir.mkdir(parents=True, exist_ok=True)
completed_dir.mkdir(parents=True, exist_ok=True)

generated = ROOT / "docs" / "generated"
generated.mkdir(parents=True, exist_ok=True)

validator = ROOT / "scripts" / "check_execplan.py"
if not validator.exists():
    fail("Missing required file: scripts/check_execplan.py")

idea_validator = ROOT / "scripts" / "check_ideation.py"
result = subprocess.run([sys.executable, str(idea_validator)], cwd=ROOT, check=False)
if result.returncode != 0:
    raise SystemExit(result.returncode)

result = subprocess.run([sys.executable, str(validator)], cwd=ROOT, check=False)
if result.returncode != 0:
    raise SystemExit(result.returncode)

print("Docs verification passed.")
