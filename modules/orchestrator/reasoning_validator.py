from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime, timezone
import math


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class ReasoningValidator:
    """Improved Reasoning Validator.

    Responsibilities:
    - logical consistency validation
    - contradiction detection between agent outputs
    - missing-premise detection
    - unsupported-claim detection (claims without evidence)
    - financial / commercial coherence checks
    - reasoning quality scoring and structured report
    """

    def __init__(self, min_alignment_ratio: float = 0.2):
        self.min_alignment_ratio = min_alignment_ratio
        # penalty values (tunable)
        self.penalties = {
            "alignment": 12.0,
            "contradiction": 20.0,
            "missing_premise": 18.0,
            "unsupported_claim": 10.0,
            "financial_incoherence": 25.0,
        }

    def _is_number(self, v):
        return isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))

    def validate(self, context_package, fusion_output: Dict[str, Any], agent_results: List[Dict[str, Any]], storage=None) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        score = 100.0

        # 1) Multi-agent numeric alignment (shallow)
        nums: Dict[str, List[float]] = {}
        for r in agent_results:
            out = r.get("output") or {}
            if isinstance(out, dict):
                for k, v in out.items():
                    if self._is_number(v):
                        nums.setdefault(k, []).append(float(v))

        for k, vals in nums.items():
            if len(vals) > 1:
                mean = sum(vals) / len(vals)
                var = sum((x - mean) ** 2 for x in vals) / len(vals)
                std = math.sqrt(var)
                rel = (std / abs(mean)) if mean else 0.0
                if rel > self.min_alignment_ratio:
                    issues.append({"type": "multi_agent_mismatch", "key": k, "std_rel": rel, "values": vals})
                    score -= self.penalties["alignment"]

        # 2) Contradiction detection across agent outputs (non-numeric)
        claims: Dict[str, set] = {}
        claim_sources: Dict[str, List[str]] = {}
        for r in agent_results:
            out = r.get("output") or {}
            agent = r.get("agent_name")
            if isinstance(out, dict):
                for k, v in out.items():
                    if not self._is_number(v):
                        sval = str(v)
                        claims.setdefault(k, set()).add(sval)
                        claim_sources.setdefault(k, []).append(agent)

        for k, vals in claims.items():
            if len(vals) > 1:
                issues.append({"type": "contradiction", "key": k, "values": list(vals), "agents": claim_sources.get(k, [])})
                score -= self.penalties["contradiction"]

        # 3) Unsupported-claim detection: outputs produced without agent evidence
        for r in agent_results:
            evid = r.get("evidence") or []
            out = r.get("output") or {}
            agent = r.get("agent_name")
            if (not evid) and isinstance(out, dict) and out:
                # if the agent produced meaningful claims but has no evidence
                issues.append({"type": "unsupported_claim", "agent": agent, "output_preview": {k: out[k] for k in list(out)[:3]}})
                score -= self.penalties["unsupported_claim"]

        # 4) Missing-premise detection for pricing/financial outputs
        outputs_flat = fusion_output.get("outputs") or {}
        try:
            company = context_package.get("company") if hasattr(context_package, "get") else None
            market = context_package.get("market") if hasattr(context_package, "get") else None
        except Exception:
            company = None
            market = None

        # detect keys suggesting pricing or revenue recommendations
        price_keys = [k for k in outputs_flat.keys() if "price" in k or "pricing" in k or "recommend" in k or "opportunity_score" in k]
        if price_keys:
            has_ehri = isinstance(company, dict) and bool(company.get("ehri_profile"))
            has_benchmarks = isinstance(market, dict) and bool(market.get("benchmarks"))
            if not has_ehri and not has_benchmarks:
                issues.append({"type": "missing_premise", "detail": "pricing requires EHRI profile or market benchmarks", "keys": price_keys})
                score -= self.penalties["missing_premise"]

        # 5) Financial coherence: price vs cost checks across agent outputs
        price = None
        cost = None
        for r in agent_results:
            out = r.get("output") or {}
            if isinstance(out, dict):
                if price is None and (out.get("recommended_price") is not None or out.get("price") is not None):
                    price = out.get("recommended_price") or out.get("price")
                if cost is None and (out.get("estimated_cost") is not None or out.get("cost") is not None):
                    cost = out.get("estimated_cost") or out.get("cost")

        if price is not None and cost is not None:
            try:
                if float(price) < float(cost):
                    issues.append({"type": "financial_incoherence", "price": price, "cost": cost})
                    score -= self.penalties["financial_incoherence"]
            except Exception:
                pass

        # Cap score
        score = max(0.0, min(100.0, score))

        major_issue_types = {"contradiction", "missing_premise", "financial_incoherence"}
        passed = not any(i.get("type") in major_issue_types for i in issues)
        suggested_replan = not passed

        result = {
            "timestamp": now_iso(),
            "passed": passed,
            "score": round(score, 2),
            "issues": issues,
            "suggested_replan": suggested_replan,
        }
        return result
