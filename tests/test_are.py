import unittest
import os

from modules.ehri.service import EHRIService
from modules.ehri.harness import run_all
from modules.ehri.are import AREngine


class TestARE(unittest.TestCase):
    def test_are_harness_and_ars(self):
        svc = EHRIService(db_path=":memory:")
        # Run harness to emit events
        run_all(svc.storage)

        engine = AREngine(svc.storage)
        res = engine.compute_ars()
        # generate reports to files
        engine.generate_reports()

        # Basic expectations: score computed and reports created
        self.assertIn("score", res)
        # For the simulated harness, expect a high score (>=85)
        self.assertGreaterEqual(res.get("score", 0), 85)

        # Reports exist
        base = os.path.join(os.path.dirname(__file__), "..", "modules", "ehri", "reports")
        base = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "modules", "ehri", "reports"))
        self.assertTrue(os.path.exists(os.path.join(os.path.dirname(__file__), "..", "modules", "ehri", "reports", "ARE_Operational_Readiness_Report.md")))


if __name__ == "__main__":
    unittest.main()
