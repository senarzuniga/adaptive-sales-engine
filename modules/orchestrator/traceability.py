from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class TraceabilityEngine:
    """
    Builds a structured trace for executive decisions, linking agents, evidence,
    knowledge objects and referenced events.
    """

    def trace(self, context_package, fusion_output: Dict[str, Any], agent_results: List[Dict[str, Any]], storage) -> Dict[str, Any]:
        decision_id = str(uuid.uuid4())
        participating_agents = list({r.get("agent_name") for r in agent_results})

        # Map agent -> evidence
        evidence_map = {r.get("agent_name"): r.get("evidence", []) for r in agent_results}

        # If EvidenceEngine annotations are present in evidence items, include summary
        evidence_summary = None
        try:
            # look for evidence items that include 'evidence_id' or 'canonicalized_at'
            found = [e for evs in evidence_map.values() for e in (evs or []) if isinstance(e, dict) and e.get("evidence_id")]
            if found:
                evidence_summary = {"sample_count": len(found)}
        except Exception:
            evidence_summary = None

        # Resolve evidence to events where possible
        events_by_evidence = {}
        try:
            events = storage.get_events()
            for agent, evidences in evidence_map.items():
                resolved = []
                for ev in evidences:
                    eid = ev.get("id") or ev.get("doc_id") or ev.get("profile_id")
                    if not eid:
                        continue
                    matches = [e for e in events if ((e.get("payload") or {}).get("doc_id") == eid) or ((e.get("payload") or {}).get("profile_id") == eid)]
                    resolved.append({"evidence": ev, "events": matches})
                events_by_evidence[agent] = resolved
        except Exception:
            events_by_evidence = {a: [] for a in evidence_map.keys()}

        knowledge_objs = {n: c.to_dict() if hasattr(c, "to_dict") else c for n, c in (context_package.contexts().items() if hasattr(context_package, "contexts") else {})}

        trace = {
            "decision_id": decision_id,
            "timestamp": now_iso(),
            "participating_agents": participating_agents,
            "evidence_map": evidence_map,
            "evidence_summary": evidence_summary,
            "events_by_evidence": events_by_evidence,
            "knowledge_objects": knowledge_objs,
            "fusion_reasons": fusion_output.get("reasons"),
        }
        return trace
