import random
from datetime import datetime
from typing import List
from .models import BenchmarkValue
from .storage import Storage


class MarketBenchmarkEngine:
    """Simple benchmark engine placeholder.

    Replace connectors to external market intelligence sources here.
    """

    def __init__(self, storage: Storage):
        self.storage = storage

    def update_benchmarks(self, company_id: str) -> List[BenchmarkValue]:
        now = datetime.utcnow().isoformat()
        samples = []
        sectors = ["Engineering", "Manufacturing", "Logistics", "Automation"]
        for s in sectors:
            median = round(random.uniform(20, 120), 2)
            upper = round(median * random.uniform(1.1, 1.5), 2)
            lower = round(median * random.uniform(0.6, 0.9), 2)
            b = BenchmarkValue(
                company_id=company_id,
                industry=s,
                median=median,
                upper_quartile=upper,
                lower_quartile=lower,
                best_competitor=upper,
                sample_size=random.randint(10, 200),
                confidence=round(random.uniform(0.6, 0.95), 2),
                source="synthetic:market-sample",
                date=now,
                geographical_scope="global",
                last_validation=now,
            )
            self.storage.save_benchmark(company_id, b)
            samples.append(b)
        return samples

    def get_benchmarks(self, company_id: str) -> List[BenchmarkValue]:
        return self.storage.get_benchmarks(company_id)
