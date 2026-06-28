"""
Offer service — serial number generation and CRUD for the offers table.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _infer_active_company_id() -> Optional[str]:
    """Best-effort company_id lookup from Streamlit session state."""
    try:
        import streamlit as st
        active = st.session_state.get("active_company")
        if isinstance(active, dict):
            cid = active.get("id")
            return str(cid) if cid else None
    except Exception:
        pass
    return None


def _build_legacy_offer_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Map rich offer payload to the legacy offers schema used by React/Lovable."""
    company_id = payload.get("company_id") or _infer_active_company_id()
    if not company_id:
        raise ValueError("company_id is required to create an offer.")

    return {
        "company_id": company_id,
        "offer_number": payload.get("offer_number") or payload.get("serial_number") or next_offer_serial(),
        "title": payload.get("title") or "",
        "customer_name": payload.get("customer_name") or payload.get("company") or "",
        "project_description": payload.get("project_description") or payload.get("description") or "",
        "status": payload.get("status") or payload.get("status_v2") or "draft",
        "currency": payload.get("currency") or "EUR",
        "notes": payload.get("notes") or "",
    }


def next_offer_serial() -> str:
    """Generate a unique offer serial number."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    seq = abs(hash(now.isoformat())) % 10000
    return f"OFF-{date_part}-{seq:04d}"


def create_offer(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a new offer.  Returns the created row or raises on error."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        raise ValueError("Supabase not configured.")

    rich_payload = dict(payload)
    if not rich_payload.get("company_id"):
        inferred_company = _infer_active_company_id()
        if inferred_company:
            rich_payload["company_id"] = inferred_company

    try:
        result = supabase.table("offers").insert(rich_payload).execute()
        if result.data:
            return result.data[0]
    except Exception as exc:
        logger.warning("create_offer rich insert failed, retrying legacy payload: %s", exc)

    legacy_payload = _build_legacy_offer_payload(rich_payload)
    result = supabase.table("offers").insert(legacy_payload).execute()
    if not result.data:
        raise ValueError("No record returned from offers insert.")
    return result.data[0]


def list_offers(include_deleted: bool = False) -> List[Dict[str, Any]]:
    """Return all non-deleted offers."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return []
    try:
        rows = supabase.table("offers").select("*").order("created_at", desc=True).execute().data or []
        if include_deleted:
            return rows
        # Some deployments still use legacy schema without is_deleted.
        return [row for row in rows if row.get("is_deleted") is not True]
    except Exception as exc:
        logger.warning("list_offers error: %s", exc)
        return []


def update_offer_status(offer_id: str, status: str) -> bool:
    """Update the status_v2 field of an offer."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return False
    try:
        try:
            supabase.table("offers").update({"status_v2": status}).eq("id", offer_id).execute()
        except Exception:
            supabase.table("offers").update({"status": status}).eq("id", offer_id).execute()
        return True
    except Exception as exc:
        logger.warning("update_offer_status error: %s", exc)
        return False


def archive_offer(offer_id: str) -> bool:
    """Soft-delete an offer."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return False
    try:
        try:
            supabase.table("offers").update(
                {"is_deleted": True, "status_v2": "archived"}
            ).eq("id", offer_id).execute()
        except Exception:
            supabase.table("offers").update({"status": "archived"}).eq("id", offer_id).execute()
        return True
    except Exception as exc:
        logger.warning("archive_offer error: %s", exc)
        return False
