"""
Action service — CRUD operations for the commercial actions table.

UI pages should call these functions instead of talking to Supabase directly.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def list_actions(status_filter: str = "Todas") -> List[Dict[str, Any]]:
    """Return all actions, optionally filtered by status."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return []
    try:
        query = supabase.table("actions").select("*")
        if status_filter != "Todas":
            query = query.eq("status", status_filter)
        return query.order("created_at", desc=True).execute().data or []
    except Exception as exc:
        logger.warning("list_actions error: %s", exc)
        return []


def create_action(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Insert a new action.  Returns the created row or None."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return None
    try:
        result = supabase.table("actions").insert(payload).execute()
        return (result.data or [None])[0]
    except Exception as exc:
        logger.warning("create_action error: %s", exc)
        return None


def update_action(action_id: str, updates: Dict[str, Any]) -> bool:
    """Patch an existing action by id."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return False
    try:
        updates["last_modified"] = datetime.now(timezone.utc).isoformat()
        supabase.table("actions").update(updates).eq("id", action_id).execute()
        return True
    except Exception as exc:
        logger.warning("update_action error: %s", exc)
        return False


def delete_action(action_id: str) -> bool:
    """Delete an action by id."""
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    if not supabase:
        return False
    try:
        supabase.table("actions").delete().eq("id", action_id).execute()
        return True
    except Exception as exc:
        logger.warning("delete_action error: %s", exc)
        return False


def export_actions_to_excel(department: str = "") -> Optional[bytes]:
    """Export all actions to an in-memory Excel file.  Returns bytes or None."""
    import io
    import pandas as pd
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        return None

    rows = list_actions()
    if not rows:
        return None
    df = pd.DataFrame(rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="ACTION_LOG")
    return buffer.getvalue()
