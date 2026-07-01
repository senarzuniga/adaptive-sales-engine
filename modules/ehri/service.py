from typing import Optional, Dict, Any, List
from .storage import Storage
from .models import HourlyRateProfile, EPISScore
from .benchmark import MarketBenchmarkEngine
from .ai_assistant import AIAssistant


class EHRIService:
    def __init__(self, db_path: Optional[str] = None):
        self.storage = Storage(db_path=db_path)
        self.benchmark_engine = MarketBenchmarkEngine(self.storage)
        self.ai = AIAssistant()

    def create_profile(self, company_id: str, profile_data: Dict[str, Any], created_by: Optional[str] = None) -> HourlyRateProfile:
        profile = HourlyRateProfile(company_id=company_id, **profile_data)
        if created_by:
            profile.created_by = created_by
        latest = self.storage.get_latest_version_number(company_id, profile.profile_id)
        if latest > 0:
            self.storage.create_new_version(profile)
        else:
            self.storage.save_profile(profile)
        return profile

    def update_profile(self, company_id: str, profile_id: str, updates: Dict[str, Any], created_by: Optional[str] = None) -> HourlyRateProfile:
        existing = self.storage.get_profile(company_id, profile_id)
        if not existing:
            raise ValueError("profile not found")
        data = existing.to_dict()
        data.update(updates)
        new_profile = HourlyRateProfile(**data)
        if created_by:
            new_profile.created_by = created_by
        self.storage.create_new_version(new_profile)
        return new_profile

    def get_profile(self, company_id: str, profile_id: str, version: Optional[int] = None) -> Optional[HourlyRateProfile]:
        return self.storage.get_profile(company_id, profile_id, version)

    def list_versions(self, company_id: str, profile_id: str) -> List[Dict[str, Any]]:
        return self.storage.list_versions(company_id, profile_id)

    def approve(self, company_id: str, profile_id: str, version: int, approved_by: str):
        self.storage.approve_version(company_id, profile_id, version, approved_by)

    def run_benchmark(self, company_id: str):
        return self.benchmark_engine.update_benchmarks(company_id)

    def compute_epis(self, company_id: str, profile_id: str, version: Optional[int] = None) -> EPISScore:
        profile = self.get_profile(company_id, profile_id, version)
        if not profile:
            raise ValueError("profile not found")
        benchmarks = self.storage.get_benchmarks(company_id)
        value, breakdown = self._compute_epis_heuristic(profile, benchmarks)
        epis = EPISScore(company_id=company_id, profile_id=profile.profile_id, version=profile.version, value=value, breakdown=breakdown)
        self.storage.save_epis(epis)
        return epis

    def _compute_epis_heuristic(self, profile: HourlyRateProfile, benchmarks: List[Any]):
        # heuristic combining competitiveness and profitability with defaults for other signals
        # compute company average selling rate
        selling_vals = []
        if isinstance(profile.rates, dict):
            for k, v in profile.rates.items():
                if isinstance(v, (int, float)) and ("sell" in k.lower() or "commercial" in k.lower() or "selling" in k.lower()):
                    selling_vals.append(v)
        if not selling_vals and isinstance(profile.rates, dict):
            selling_vals = [v for v in profile.rates.values() if isinstance(v, (int, float))]
        company_rate = sum(selling_vals) / len(selling_vals) if selling_vals else 0.0

        medians = [b.median for b in benchmarks if getattr(b, "median", None)]
        median = sum(medians) / len(medians) if medians else None
        if median and median > 0:
            diff = abs(company_rate - median) / median
            competitiveness = max(0.0, 100 * (1 - min(diff, 0.5) / 0.5))
        else:
            competitiveness = 50.0

        cost_vals = []
        if isinstance(profile.rates, dict):
            for k, v in profile.rates.items():
                if isinstance(v, (int, float)) and ("cost" in k.lower() or "internal" in k.lower()):
                    cost_vals.append(v)
        if cost_vals and company_rate > 0:
            avg_cost = sum(cost_vals) / len(cost_vals)
            profit_margin = (company_rate - avg_cost) / company_rate
            profitability = max(0.0, min(100.0, profit_margin * 100))
        else:
            profitability = 50.0

        utilization = 50.0
        conversion = 50.0
        elasticity = 50.0
        coverage = 50.0
        trend = 50.0

        weights = {"competitiveness": 0.25, "profitability": 0.2, "utilization": 0.15, "conversion": 0.15, "elasticity": 0.05, "coverage": 0.1, "trend": 0.1}
        breakdown = {"competitiveness": competitiveness, "profitability": profitability, "utilization": utilization, "conversion": conversion, "elasticity": elasticity, "coverage": coverage, "trend": trend}
        value = sum(breakdown[k] * weights[k] for k in weights)
        value = max(0.0, min(100.0, value))
        return value, breakdown
