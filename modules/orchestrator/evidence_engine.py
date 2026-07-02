from __future__ import annotations

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import uuid
import math


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class EvidenceEngine:
    """Canonical evidence model and helper utilities.

    Responsibilities implemented:
    - source type classification
    - trust level scoring
    - freshness scoring
    - authority ranking (simple mapping)
    - contradiction detection (heuristic)
    - evidence aggregation rules
    """

    SOURCE_TRUST = {
        "approved_document": 95.0,
        "document": 80.0,
        "profile": 85.0,
        "external": 70.0,
        "agent_inference": 50.0,
        "system": 75.0,
    }

    def canonicalize(self, raw: Dict[str, Any], agent_name: Optional[str] = None) -> Dict[str, Any]:
        """Turn a raw evidence dict into a canonical evidence object."""
        e = dict(raw or {})
        ev_id = e.get("id") or e.get("doc_id") or e.get("profile_id") or str(uuid.uuid4())
        source_type = self.classify_source(e)
        trust = float(e.get("trust_level") or self.SOURCE_TRUST.get(source_type, 50.0))
        # normalize to 0-100
        trust = max(0.0, min(100.0, trust))
        ts = e.get("timestamp")
        freshness_seconds = 0.0
        if ts:
            try:
                dt = datetime.fromisoformat(ts)
                freshness_seconds = (datetime.now(timezone.utc) - dt).total_seconds()
            except Exception:
                freshness_seconds = 0.0

        authority = float(e.get("authority_rank") or (trust / 10.0))

        claim = e.get("claim") or e.get("statement") or e.get("value")

        canonical = {
            "evidence_id": str(ev_id),
            "agent": agent_name,
            "source_type": source_type,
            "trust_level": round(trust, 2),
            "freshness_seconds": freshness_seconds,
            "authority_rank": round(authority, 2),
            "claim": claim,
            "raw": e,
            "timestamp": ts or now_iso(),
            "canonicalized_at": now_iso(),
        }
        return canonical

    def classify_source(self, e: Dict[str, Any]) -> str:
        if not e:
            return "agent_inference"
        if e.get("approved") or e.get("approval_status") == "approved":
            return "approved_document"
        if e.get("doc_id"):
            return "document"
        if e.get("profile_id"):
            return "profile"
        if e.get("external_id") or e.get("url"):
            return "external"
        if e.get("source") == "system":
            return "system"
        return "agent_inference"

    def aggregate(self, evidences: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Aggregate raw/canonical evidences into deduplicated set and detect contradictions.

        Returns (aggregated_list, contradictions_list)
        """
        canon_map: Dict[str, Dict[str, Any]] = {}
        for ev in evidences or []:
            # if ev looks already canonical (has 'evidence_id'), keep
            if ev.get("evidence_id"):
                cid = ev.get("evidence_id")
                canon_map[cid] = ev
                continue
            # else try to determine a canonical id
            key = ev.get("doc_id") or ev.get("profile_id") or ev.get("id") or str(uuid.uuid4())
            if key in canon_map:
                # merge trust levels
                existing = canon_map[key]
                existing_trust = existing.get("trust_level", 50.0)
                new_trust = float(ev.get("trust_level") or existing_trust)
                existing["trust_level"] = round((existing_trust + new_trust) / 2.0, 2)
            else:
                # canonicalize raw
                canon_map[key] = self.canonicalize(ev)

        aggregated = list(canon_map.values())

        contradictions = self.detect_contradictions(aggregated)
        return aggregated, contradictions

    def detect_contradictions(self, aggregated: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Very lightweight contradiction detector.

        Heuristic: if multiple evidence items share a non-empty 'claim' but different values,
        mark as contradiction.
        """
        claims: Dict[str, List[Dict[str, Any]]] = {}
        for a in aggregated:
            c = a.get("claim")
            if c is None:
                continue
            key = str(c)
            claims.setdefault(key, []).append(a)

        contradictions = []
        # If a claim appears with different 'raw' values (heuristic), mark
        for k, items in claims.items():
            vals = set()
            for it in items:
                raw = it.get("raw") or {}
                # try common numeric or scalar fields
                v = raw.get("value") or raw.get("amount") or raw.get("recommended_price") or raw.get("statement")
                vals.add(str(v))
            if len(vals) > 1:
                contradictions.append({"claim": k, "values": list(vals), "items": items})
        return contradictions

    def score_evidence_set(self, aggregated: List[Dict[str, Any]], contradictions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        total = len(aggregated)
        if total == 0:
            return {"evidence_score": 0.0, "avg_trust": 0.0, "contradictions": contradictions or []}
        avg_trust = sum((a.get("trust_level", 0.0) for a in aggregated)) / total
        contradictions = contradictions or self.detect_contradictions(aggregated)
        penalty = len(contradictions) * 20.0
        evidence_score = max(0.0, min(100.0, avg_trust - penalty))
        return {"evidence_score": round(evidence_score, 2), "avg_trust": round(avg_trust, 2), "contradictions": contradictions}

    def validate_evidence(self, evidences: List[Dict[str, Any]], storage=None, context_package=None) -> Dict[str, Any]:
        """Validate presence of referenced documents in storage and compute scores."""
        aggregated, contradictions = self.aggregate(evidences or [])
        score = self.score_evidence_set(aggregated, contradictions)

        # verify referenced docs exist in storage when possible
        missing_refs = []
        try:
            if storage:
                events = storage.get_events()
                for a in aggregated:
                    raw = a.get("raw") or {}
                    doc = raw.get("doc_id") or raw.get("profile_id") or raw.get("id")
                    if doc:
                        found = any(((e.get("payload") or {}).get("doc_id") == doc) or ((e.get("payload") or {}).get("profile_id") == doc) for e in events)
                        if not found:
                            missing_refs.append(doc)
        except Exception:
            # storage issues -> do not fail the validation, just note
            pass

        result = {
            "timestamp": now_iso(),
            "aggregated_count": len(aggregated),
            "aggregated": aggregated,
            "contradictions": contradictions,
            "missing_refs": missing_refs,
            "score": score,
        }
        return result
