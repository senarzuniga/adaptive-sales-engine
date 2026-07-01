import unittest

from modules.ehri.service import EHRIService


class TestEHRI(unittest.TestCase):
    def test_profile_versioning_and_epis(self):
        svc = EHRIService(db_path=":memory:")
        data = {"rates": {"commercial_selling_rate": 100.0, "internal_cost_rate": 60.0}}
        profile = svc.create_profile("ACME", data, created_by="test")
        self.assertIsNotNone(profile.profile_id)

        updated = svc.update_profile("ACME", profile.profile_id, {"rates": {"commercial_selling_rate": 110.0, "internal_cost_rate": 60.0}}, created_by="test2")
        self.assertEqual(updated.version, 2)

        b = svc.run_benchmark("ACME")
        self.assertTrue(len(b) >= 1)

        epis = svc.compute_epis("ACME", profile.profile_id)
        self.assertTrue(0.0 <= epis.value <= 100.0)


if __name__ == "__main__":
    unittest.main()
