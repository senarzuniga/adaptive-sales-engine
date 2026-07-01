from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime, timezone
import math


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class FactCheckerEngine:
    """
    Lightweight fact checker that validates fused outputs and agent evidence
    against the Event Capture Layer and context package. Returns a structured
    validation result with issues and a pass/fail flag.
    """

    def __init__(self, min_confidence: float = 0.2):
        self.min_confidence = min_confidence

    def _is_number(self, v):
        return isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))

    def validate(self, context_package, fusion_output: Dict[str, Any], agent_results: List[Dict[str, Any]], storage) -> Dict[str, Any]:
        issues = []
        score = 100.0

        # 1) Numerical value checks: ensure numeric values are present and not None
        def scan_numbers(o, path=""):
            if isinstance(o, dict):
                for k, v in o.items():
                    scan_numbers(v, f"{path}/{k}")
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    scan_numbers(v, f"{path}[{i}]")
            else:
                if o is None:
                    issues.append({"type": "missing_numeric", "path": path, "value": o})

        scan_numbers(fusion_output.get("outputs", {}), "/outputs")

        # 2) Evidence completeness: ensure at least one piece of evidence is present
        evidence = fusion_output.get("evidence", [])
        if not evidence:
            issues.append({"type": "no_evidence", "detail": "No evidence found in fusion output"})
            score -= 30

        # 3) Agent confidence thresholds
        low_conf_agents = [r.get("agent_name") for r in agent_results if (r.get("confidence", 0) < self.min_confidence)]
        if low_conf_agents:
            issues.append({"type": "low_confidence_agents", "agents": low_conf_agents})
            score -= len(low_conf_agents) * 5

        # 4) Referenced documents and profiles validation against event store
        missing_refs = []
        for ev in evidence:
            # common keys: id, doc_id, profile_id
            doc_id = ev.get("doc_id") or ev.get("id") or ev.get("profile_id")
            if doc_id:
                # search events for matching doc id in payload
                try:
                    events = storage.get_events()
                    found = any(((e.get("payload") or {}).get("doc_id") == doc_id) or ((e.get("payload") or {}).get("profile_id") == doc_id) for e in events)
                    if not found:
                        missing_refs.append(doc_id)
                except Exception:
                    # if storage inaccessible, produce warning
                    issues.append({"type": "storage_unavailable", "detail": "could not query events"})
        if missing_refs:
            issues.append({"type": "missing_referenced_documents", "ids": missing_refs})
            score -= 20

        # 5) Knowledge version checks: if context has knowledge_hub with approved versions
        try:
            kh = context_package.get("knowledge_hub", {})
            if isinstance(kh, dict):
                approved = kh.get("approved_versions")
                if approved and evidence:
                    # ensure profile evidence references an approved version (best-effort)
                    for ev in evidence:
                        pid = ev.get("profile_id")
                        ver = ev.get("version")
                        if pid and ver and pid not in approved:
                            issues.append({"type": "unapproved_version", "profile_id": pid, "version": ver})
                            score -= 10
        except Exception:
            pass

        # 6) Truth graph consistency: if truth_graph context provided, ensure evidence nodes exist
        try:
            tg = context_package.get("truth_graph", {})
            nodes = set((tg.get("nodes") or []))
            missing_nodes = []
            for ev in evidence:
                nid = ev.get("id") or ev.get("profile_id")
                if nid and nodes and nid not in nodes:
                    missing_nodes.append(nid)
            if missing_nodes:
                issues.append({"type": "truth_graph_missing_nodes", "nodes": missing_nodes})
                score -= 5
        except Exception:
            pass

        passed = len([i for i in issues if i.get("type") in ("no_evidence", "missing_referenced_documents", "low_confidence_agents", "missing_numeric")]) == 0

        result = {
            "timestamp": now_iso(),
            "passed": passed,
            "score": max(0.0, score),
            "issues": issues,
        }
        return result
