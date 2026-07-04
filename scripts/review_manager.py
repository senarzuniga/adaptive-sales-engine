"""Review manager for ingestion candidates.

Provides listing, inspection and promotion helpers used by the review UI.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from scripts import ingestion_db
from infrastructure import enterprise_store


def _short_id() -> str:
    return uuid.uuid4().hex[:24]


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def list_candidates(
    enterprise_id: Optional[str] = None,
    upload_batch: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    candidates = ingestion_db.fetch_all("candidate_structured_data", limit=limit)
    # prefetch file_ingestions map
    ingestion_map: Dict[str, Dict[str, Any]] = {}
    for c in candidates:
        iid = c.get("ingestion_id")
        if iid and iid not in ingestion_map:
            ingestion_map[iid] = ingestion_db.fetch_one("file_ingestions", "id", iid) or {}

    out: List[Dict[str, Any]] = []
    for c in candidates:
        cid = c.get("id")
        iid = c.get("ingestion_id")
        file_meta = ingestion_map.get(iid, {})
        # latest review
        latest_review = ingestion_db.get_latest_review_for_candidate(cid)
        review_action = latest_review.get("review_action") if latest_review else None
        # fact check confidence
        facts = ingestion_db.fetch_all("fact_check_reports", limit=50)
        conf = None
        for f in facts:
            if f.get("ingestion_id") == iid:
                conf = f.get("confidence")
                break

        # filters
        if enterprise_id and c.get("enterprise_id") != enterprise_id:
            continue
        if upload_batch and file_meta.get("upload_batch") != upload_batch:
            continue
        if entity_type and c.get("entity_type") != entity_type:
            continue

        title = None
        payload = c.get("payload")
        if isinstance(payload, dict):
            title = payload.get("title") or payload.get("name")
        elif isinstance(payload, str):
            try:
                p = json.loads(payload)
                title = p.get("title") or p.get("name")
            except Exception:
                title = payload[:80]

        out.append({
            "candidate_id": cid,
            "ingestion_id": iid,
            "entity_type": c.get("entity_type"),
            "title": title,
            "enterprise_id": c.get("enterprise_id"),
            "provenance": c.get("provenance"),
            "created_at": c.get("created_at"),
            "upload_batch": file_meta.get("upload_batch"),
            "file_name": file_meta.get("file_name"),
            "ingestion_created_at": file_meta.get("created_at"),
            "uploader": file_meta.get("uploader"),
            "classification": file_meta.get("classification"),
            "confidence": conf,
            "review_action": review_action,
        })

    return out


def get_candidate_details(candidate_id: str) -> Dict[str, Any]:
    c = ingestion_db.fetch_one("candidate_structured_data", "id", candidate_id)
    if not c:
        raise ValueError("Candidate not found")
    iid = c.get("ingestion_id")
    file_ingestion = ingestion_db.fetch_one("file_ingestions", "id", iid) or {}
    raw_extracts = [r for r in ingestion_db.fetch_all("raw_extracts", limit=200) if r.get("ingestion_id") == iid]
    normalized = [r for r in ingestion_db.fetch_all("normalized_data", limit=200) if r.get("ingestion_id") == iid]
    contextual = [r for r in ingestion_db.fetch_all("contextualized_data", limit=200) if r.get("ingestion_id") == iid]
    facts = [r for r in ingestion_db.fetch_all("fact_check_reports", limit=200) if r.get("ingestion_id") == iid]
    reviews = ingestion_db.get_reviews_for_candidate(candidate_id)

    return {
        "candidate": c,
        "file_ingestion": file_ingestion,
        "raw_extracts": raw_extracts,
        "normalized": normalized,
        "contextual": contextual,
        "fact_check_reports": facts,
        "reviews": reviews,
    }


def promote_candidate(
    candidate_id: str,
    reviewer: str,
    review_action: str,
    reason: str = "",
    linked_existing_entity_id: Optional[str] = None,
    fields_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Promote a candidate into final_structured_data according to review action.

    review_action: APPROVE_NEW | APPROVE_UPDATE_EXISTING | APPROVE_MERGE | REJECT | KEEP_PENDING | REQUEST_RECHECK
    """
    cand = ingestion_db.fetch_one("candidate_structured_data", "id", candidate_id)
    if not cand:
        raise ValueError("Candidate not found")

    iid = cand.get("ingestion_id")
    # compose provenance
    provenance = {
        "candidate_id": candidate_id,
        "file_ingestion": ingestion_db.fetch_one("file_ingestions", "id", iid) or {},
        "raw_extracts": [r for r in ingestion_db.fetch_all("raw_extracts", limit=200) if r.get("ingestion_id") == iid],
        "normalized": [r for r in ingestion_db.fetch_all("normalized_data", limit=200) if r.get("ingestion_id") == iid],
        "contextualized": [r for r in ingestion_db.fetch_all("contextualized_data", limit=200) if r.get("ingestion_id") == iid],
        "fact_checks": [r for r in ingestion_db.fetch_all("fact_check_reports", limit=200) if r.get("ingestion_id") == iid],
    }

    candidate_payload = cand.get("payload")
    if isinstance(candidate_payload, str):
        try:
            candidate_payload = json.loads(candidate_payload)
        except Exception:
            candidate_payload = {"text": candidate_payload}

    resulting_final_id = None
    # Handle actions
    if review_action == "APPROVE_NEW":
        final_id = _short_id()
        final_row = {
            "id": final_id,
            "ingestion_id": iid,
            "entity_type": cand.get("entity_type"),
            "payload": json.dumps({**(candidate_payload or {}), **(fields_override or {})}),
            "enterprise_id": cand.get("enterprise_id"),
            "provenance": json.dumps(provenance),
            "approval_status": "approved",
            "created_at": _now_iso(),
        }
        ingestion_db.insert("final_structured_data", final_row)
        resulting_final_id = final_id

    elif review_action in ("APPROVE_UPDATE_EXISTING", "APPROVE_MERGE"):
        if not linked_existing_entity_id:
            raise ValueError("linked_existing_entity_id is required for update/merge actions")
        existing = ingestion_db.fetch_one("final_structured_data", "id", linked_existing_entity_id)
        if not existing:
            raise ValueError("Linked existing final_structured_data not found")
        # parse existing payload
        existing_payload = existing.get("payload")
        if isinstance(existing_payload, str):
            try:
                existing_payload = json.loads(existing_payload)
            except Exception:
                existing_payload = {"text": existing_payload}

        # merge strategy: non-destructive by default (do not overwrite existing non-empty fields)
        merged = dict(existing_payload or {})
        for k, v in (candidate_payload or {}).items():
            if merged.get(k) in (None, "", [], {}):
                merged[k] = v
        # apply explicit overrides if provided
        if fields_override:
            merged.update(fields_override)

        final_row = {
            "id": linked_existing_entity_id,
            "ingestion_id": iid,
            "entity_type": cand.get("entity_type"),
            "payload": json.dumps(merged),
            "enterprise_id": cand.get("enterprise_id"),
            "provenance": json.dumps(provenance),
            "approval_status": "approved",
            "created_at": _now_iso(),
        }
        ingestion_db.insert("final_structured_data", final_row)
        resulting_final_id = linked_existing_entity_id

    elif review_action == "REJECT":
        # just record decision
        pass

    elif review_action in ("KEEP_PENDING", "REQUEST_RECHECK"):
        # record decision only
        pass

    else:
        raise ValueError(f"Unknown review action: {review_action}")

    # record review decision
    decision = {
        "id": _short_id(),
        "candidate_id": candidate_id,
        "enterprise_id": cand.get("enterprise_id"),
        "reviewer": reviewer,
        "review_action": review_action,
        "reason": reason or "",
        "linked_existing_entity_id": linked_existing_entity_id,
        "resulting_final_id": resulting_final_id,
        "notes": "",
        "timestamp": _now_iso(),
    }
    ingestion_db.insert_review_decision(decision)

    return {"decision": decision, "resulting_final_id": resulting_final_id}


def reject_candidate(candidate_id: str, reviewer: str, reason: str = "") -> Dict[str, Any]:
    return promote_candidate(candidate_id, reviewer, "REJECT", reason=reason)


def keep_pending(candidate_id: str, reviewer: str, reason: str = "") -> Dict[str, Any]:
    return promote_candidate(candidate_id, reviewer, "KEEP_PENDING", reason=reason)


def request_recheck(candidate_id: str, reviewer: str, reason: str = "") -> Dict[str, Any]:
    return promote_candidate(candidate_id, reviewer, "REQUEST_RECHECK", reason=reason)


def create_action_from_gap(candidate_id: str, reviewer: str, action_type: str, owner: str, due_date: str = "", comments: str = "") -> Dict[str, Any]:
    cand = ingestion_db.fetch_one("candidate_structured_data", "id", candidate_id)
    if not cand:
        raise ValueError("Candidate not found")
    action = {
        "id": _short_id(),
        "ingestion_id": cand.get("ingestion_id"),
        "action_type": action_type,
        "owner": owner,
        "due_date": due_date,
        "status": "open",
        "comments": comments,
        "created_at": _now_iso(),
    }
    ingestion_db.insert("actions", action)
    # record decision as well
    decision = {
        "id": _short_id(),
        "candidate_id": candidate_id,
        "enterprise_id": cand.get("enterprise_id"),
        "reviewer": reviewer,
        "review_action": "CREATE_ACTION_FROM_GAP",
        "reason": comments,
        "linked_existing_entity_id": None,
        "resulting_final_id": None,
        "notes": json.dumps(action),
        "timestamp": _now_iso(),
    }
    ingestion_db.insert_review_decision(decision)
    return {"action": action, "decision": decision}
