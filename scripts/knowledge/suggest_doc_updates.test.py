#!/usr/bin/env python3
from __future__ import annotations

import unittest

from generate_repo_map import ROOT, should_ignore
from suggest_doc_updates import suggest_updates


class SuggestDocUpdatesTests(unittest.TestCase):
    def test_repo_map_excludes_raw_self_improvement_runtime(self) -> None:
        trace_path = ROOT / ".codex" / "self-improvement" / "traces.jsonl"

        self.assertTrue(should_ignore(trace_path))

    def test_repo_map_excludes_local_runtime_credentials(self) -> None:
        credential_path = ROOT / ".codex" / "runtime" / "hfj-postgres.env"

        self.assertTrue(should_ignore(credential_path))

    def test_repo_map_excludes_opentofu_runtime_state(self) -> None:
        state_path = ROOT / "infra" / "opentofu" / ".terraform" / "terraform.tfstate"

        self.assertTrue(should_ignore(state_path))

    def test_repo_map_excludes_local_beads_state(self) -> None:
        database_path = ROOT / ".beads" / "dolt" / "noms"

        self.assertTrue(should_ignore(database_path))

    def test_repo_map_excludes_local_household_runtime_state(self) -> None:
        repository_object = ROOT / "apps" / "server" / ".data" / "households" / "hsh_test.git" / "objects" / "00" / "fixture"

        self.assertTrue(should_ignore(repository_object))

    def test_web_changes_require_product_review_and_visible_evidence(self) -> None:
        hints = suggest_updates(["apps/web/src/CollectionPreview.tsx"])

        self.assertTrue(any("server product spec" in hint for hint in hints))
        self.assertTrue(any("screencast" in hint for hint in hints))

    def test_contract_changes_cover_both_specs_and_consumers(self) -> None:
        hints = suggest_updates(["packages/contracts/src/mcp.ts"])

        self.assertEqual(
            hints,
            [
                "Review both product specs and every MCP, HTTP, Git, projection, and agent-client contract consumer."
            ],
        )

    def test_migrations_require_neon_and_rollback_evidence(self) -> None:
        hints = suggest_updates(["migrations/0001_accounts.sql"])

        self.assertTrue(any("Neon" in hint and "rollback" in hint for hint in hints))

    def test_harness_changes_point_to_harness_guidance(self) -> None:
        hints = suggest_updates([".codex/self-improvement.config.json"])

        self.assertTrue(any("harness verification" in hint for hint in hints))

    def test_unmatched_changes_return_one_explicit_result(self) -> None:
        self.assertEqual(
            suggest_updates(["LICENSE"]),
            ["No obvious documentation drift detected by path heuristics."],
        )


if __name__ == "__main__":
    unittest.main()
