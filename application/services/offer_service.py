"""
Offer service — serial number generation and CRUD for the offers table.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


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
    result = supabase.table("offers").insert(payload).execute()
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
        query = supabase.table("offers").select("*")
        if not include_deleted:
            query = query.eq("is_deleted", False)
        return query.order("created_at", desc=True).execute().data or []
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
        supabase.table("offers").update({"status_v2": status}).eq("id", offer_id).execute()
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
        supabase.table("offers").update(
            {"is_deleted": True, "status_v2": "archived"}
        ).eq("id", offer_id).execute()
        return True
    except Exception as exc:
        logger.warning("archive_offer error: %s", exc)
        return False
