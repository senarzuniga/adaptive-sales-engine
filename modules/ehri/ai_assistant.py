from typing import List, Dict, Any
from .models import HourlyRateProfile, BenchmarkValue


class AIAssistant:
    """Lightweight AI assistant placeholder.

    Uses simple heuristics for anomaly detection and scenario simulation. Replace
    with calls to your AI stack or context router as needed.
    """

    def analyze_profile(self, profile: HourlyRateProfile, benchmarks: List[BenchmarkValue]) -> Dict[str, Any]:
        anomalies = []
        recommendations = []
        selling_vals = []
        if isinstance(profile.rates, dict):
            for k, v in profile.rates.items():
                if isinstance(v, (int, float)):
                    if "sell" in k.lower() or "commercial" in k.lower() or "selling" in k.lower():
                        selling_vals.append(v)
        if not selling_vals and isinstance(profile.rates, dict):
            selling_vals = [v for v in profile.rates.values() if isinstance(v, (int, float))]
        avg_selling = sum(selling_vals) / len(selling_vals) if selling_vals else 0.0

        medians = [b.median for b in benchmarks if b.median]
        median = sum(medians) / len(medians) if medians else None
        if median and median > 0:
            diff_pct = (avg_selling - median) / median * 100
            if abs(diff_pct) > 30:
                anomalies.append({"type": "large_deviation", "message": f"selling rates deviate ~{diff_pct:.0f}% vs market median"})
            if diff_pct < -5:
                recommendations.append({"action": "increase_prices", "reason": "below market median", "suggested_pct": min(10, -diff_pct)})
            elif diff_pct > 10:
                recommendations.append({"action": "validate_premium", "reason": "above market by >10%", "suggested_pct": 0})
        else:
            recommendations.append({"action": "collect_benchmarks", "reason": "no benchmark data available"})

        for b in benchmarks:
            if b.lower_quartile and avg_selling < b.lower_quartile:
                recommendations.append({"action": "review_underpriced_services", "industry": b.industry})

        return {"anomalies": anomalies, "recommendations": recommendations, "avg_selling": avg_selling, "median": median}

    def simulate_scenarios(self, profile: HourlyRateProfile, scenarios: List[Dict[str, Any]], benchmarks: List[BenchmarkValue]) -> List[Dict[str, Any]]:
        results = []
        selling_vals = []
        if isinstance(profile.rates, dict):
            for k, v in profile.rates.items():
                if isinstance(v, (int, float)) and ("sell" in k.lower() or "commercial" in k.lower() or "selling" in k.lower()):
                    selling_vals.append(v)
        if not selling_vals and isinstance(profile.rates, dict):
            selling_vals = [v for v in profile.rates.values() if isinstance(v, (int, float))]
        baseline = sum(selling_vals) / len(selling_vals) if selling_vals else 0.0

        medians = [b.median for b in benchmarks if b.median]
        median = sum(medians) / len(medians) if medians else None

        for sc in scenarios:
            delta = sc.get("delta_pct", 0) / 100.0
            new_rate = baseline * (1 + delta)
            if median and median > 0:
                diff = abs(new_rate - median) / median
                competitiveness = max(0.0, 100 * (1 - min(diff, 0.5) / 0.5))
            else:
                competitiveness = 50.0
            results.append({"scenario": sc, "new_avg_selling": new_rate, "competitiveness": competitiveness})
        return results

    def explain_recommendation(self, rec: Dict[str, Any], profile: HourlyRateProfile, benchmarks: List[BenchmarkValue]) -> str:
        return f"Recommendation: {rec.get('action')} — reason: {rec.get('reason')}. Evidence: {len(benchmarks)} benchmark samples."
