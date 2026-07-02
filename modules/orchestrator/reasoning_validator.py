from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime, timezone
import math


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class ReasoningValidator:
    """Validate reasoning quality across agent results and fusion output.

    Implements heuristics for:
    - logical consistency
    - inference validity (basic premise checks)
    - contradiction detection (uses claims/evidence)
    - missing premises detection (heuristic)
    - financial coherence (simple checks)
    - multi-agent alignment
    """

    def __init__(self, min_alignment_ratio: float = 0.2):
        self.min_alignment_ratio = min_alignment_ratio

    def validate(self, context_package, fusion_output: Dict[str, Any], agent_results: List[Dict[str, Any]], storage=None) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        score = 100.0

        # 1) Multi-agent alignment: for common numeric outputs, compute relative stdev
        # collect numeric values from outputs by key path (shallow)
        nums = {}
        for r in agent_results:
            out = r.get("output") or {}
            for k, v in (out.items() if isinstance(out, dict) else []):
                if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                    nums.setdefault(k, []).append(v)

        for k, vals in nums.items():
            if len(vals) > 1:
                mean = sum(vals) / len(vals)
                var = sum((x - mean) ** 2 for x in vals) / len(vals)
                std = math.sqrt(var)
                rel = std / mean if mean else 0.0
                if rel > self.min_alignment_ratio:
                    issues.append({"type": "multi_agent_mismatch", "key": k, "std_rel": rel, "values": vals})
                    score -= 15

        # 2) Simple contradiction detection against fusion evidence if present
        evidence = fusion_output.get("evidence") or []
        # if evidence contains contradictions (structured by EvidenceEngine), penalize
        for ev in (evidence if isinstance(evidence, list) else []):
            if isinstance(ev, dict) and ev.get("contradictions"):
                issues.append({"type": "evidence_contradictions", "details": ev.get("contradictions")})
                score -= 20

        # 3) Missing premises: heuristics for pricing recommendation
        outputs = fusion_output.get("outputs") or {}
        if isinstance(outputs, dict):
            # check nested for pricing_intel keys
            if any("pricing" in k or "price" in k for k in outputs.keys()):
                # require either company.ehri_profile or market benchmarks
                comp = context_package.get("company") if hasattr(context_package, "get") else None
                market = context_package.get("market") if hasattr(context_package, "get") else None
                if (not comp or not (isinstance(comp, dict) and comp.get("ehri_profile"))) and (not market or not market.get("benchmarks")):
                    issues.append({"type": "missing_premise", "detail": "pricing requires EHRI profile or market benchmarks"})
                    score -= 25

        # 4) Financial coherence: if outputs include price and cost, check price >= cost
        price = None
        cost = None
        for r in agent_results:
            out = r.get("output") or {}
            if isinstance(out, dict):
                if price is None and out.get("recommended_price") is not None:
                    price = out.get("recommended_price")
                if cost is None and out.get("estimated_cost") is not None:
                    cost = out.get("estimated_cost")

        if price is not None and cost is not None:
            try:
                if float(price) < float(cost):
                    issues.append({"type": "financial_incoherence", "price": price, "cost": cost})
                    score -= 20
            except Exception:
                pass

        # 5) Business rule compliance: basic check for rules that may be present
        try:
            rules = context_package.get("business_rules") or {}
            if isinstance(rules, dict) and rules.get("rules"):
                # placeholder: no rule engine, but surface missing known rule fields
                pass
        except Exception:
            pass

        # cap and compute final
        score = max(0.0, min(100.0, score))
        passed = len([i for i in issues if i.get("type") in ("multi_agent_mismatch", "missing_premise", "financial_incoherence")]) == 0

        return {"timestamp": now_iso(), "passed": passed, "score": round(score, 2), "issues": issues}
