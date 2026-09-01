from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from application.services.company_packs import (
    build_company_record_from_pack,
    collect_company_source_inventory,
    merge_company_records,
)


class CompanyPacksTests(unittest.TestCase):
    def test_collect_company_source_inventory_skips_virtualenv_noise(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            offers_dir = root / "COMMERCIAL" / "OFERTAS"
            offers_dir.mkdir(parents=True)
            (offers_dir / "Ingecart Offer 01.xlsx").write_text("demo", encoding="utf-8")

            venv_dir = root / ".venv" / "Lib" / "site-packages"
            venv_dir.mkdir(parents=True)
            (venv_dir / "ingecart_should_not_match.txt").write_text("noise", encoding="utf-8")

            inventory = collect_company_source_inventory(["ingecart"], [root], max_examples=5)

            self.assertEqual(inventory["matched_file_count"], 1)
            self.assertEqual(inventory["categories"]["offers"], 1)
            self.assertIn(".xlsx", inventory["extensions"])

    def test_build_company_record_from_pack_keeps_inventory_and_actions(self) -> None:
        pack = {
            "companyProfile": {"company_name": "CTA", "record_stage": "demo version", "company_key": "cta-demo"},
            "orders": [{"id": 1}],
            "products": [{"name": "Diagnostic"}],
            "opportunities": [],
            "strategy": [{"id": 1}],
            "leads": [{"id": 1}],
            "contacts": [{"id": 1}],
            "tasks": [{"id": 1}],
            "recommendedActionQueue": [{"title": "Package CTA diagnostic", "score": 90}],
            "sourceRegistry": {"matched_file_count": 3},
            "evidenceHighlights": [{"title": "Gap report"}],
        }

        record = build_company_record_from_pack(pack, "C:\\packs\\cta_demo_pack.json")

        self.assertEqual(record["company_name"], "CTA")
        self.assertEqual(record["data_inventory"]["orders"], 1)
        self.assertEqual(record["data_inventory"]["products"], 1)
        self.assertEqual(record["source_registry"]["matched_file_count"], 3)
        self.assertEqual(len(record["recommended_action_queue"]), 1)
        self.assertTrue(record["pack_available"])

    def test_merge_company_records_prefers_non_empty_incoming_values(self) -> None:
        existing = {"company_name": "Ingecart", "industry": "Automation", "strategic_goals": "Grow"}
        incoming = {"company_name": "Ingecart", "industry": "", "headquarters": "Barcelona"}

        merged = merge_company_records(existing, incoming)

        self.assertEqual(merged["industry"], "Automation")
        self.assertEqual(merged["headquarters"], "Barcelona")
        self.assertEqual(merged["strategic_goals"], "Grow")


if __name__ == "__main__":
    unittest.main()

