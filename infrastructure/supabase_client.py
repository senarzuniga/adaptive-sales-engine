"""
Supabase client — singleton access via Streamlit cache.

All table-level helpers live here so that UI pages and services
never call supabase directly; they go through this module.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Client factories
# ──────────────────────────────────────────────────────────────


def get_supabase():
    """Return the anonymous Supabase client (cached per Streamlit session)."""
    from config import SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_KEY
    if not SUPABASE_CONFIGURED:
        return None
    try:
        import streamlit as st
        from supabase import create_client

        @st.cache_resource
        def _cached_client():
            return create_client(SUPABASE_URL, SUPABASE_KEY)

        return _cached_client()
    except Exception as exc:
        logger.warning("get_supabase error: %s", exc)
        return None


def get_supabase_admin():
    """Return the service-role Supabase client (cached per Streamlit session)."""
    from config import SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    if not SUPABASE_CONFIGURED or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        import streamlit as st
        from supabase import create_client

        @st.cache_resource
        def _cached_admin():
            return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        return _cached_admin()
    except Exception as exc:
        logger.warning("get_supabase_admin error: %s", exc)
        return None


# ──────────────────────────────────────────────────────────────
# Company / account persistence
# ──────────────────────────────────────────────────────────────


def sb_companies_load(user_id: str) -> List[Dict[str, Any]]:
    """Load saved companies for a user from Supabase."""
    supabase = get_supabase()
    if not supabase:
        return []
    try:
        res = supabase.table("companies").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
        return res.data or []
    except Exception as exc:
        logger.warning("sb_companies_load error: %s", exc)
        return []


def sb_company_upsert(user_id: str, company: Dict[str, Any]) -> bool:
    """Upsert a company record."""
    supabase = get_supabase()
    if not supabase:
        return False
    try:
        payload = {**company, "user_id": user_id}
        supabase.table("companies").upsert(payload).execute()
        return True
    except Exception as exc:
        logger.warning("sb_company_upsert error: %s", exc)
        return False


def sb_set_active_company(company: Dict[str, Any]) -> None:
    """Store active company in Streamlit session state."""
    try:
        import streamlit as st
        st.session_state["active_company"] = company
    except Exception:
        pass


# ──────────────────────────────────────────────────────────────
# Activity log
# ──────────────────────────────────────────────────────────────


def sb_activity_log(
    user_id: str,
    action: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Write an activity-log entry to Supabase (fire-and-forget)."""
    supabase = get_supabase()
    if not supabase:
        return
    try:
        from datetime import datetime, timezone
        supabase.table("activity_log").insert({
            "user_id": user_id,
            "action": action,
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        logger.debug("sb_activity_log error: %s", exc)


# ──────────────────────────────────────────────────────────────
# Insights persistence
# ──────────────────────────────────────────────────────────────


def sb_insights_save(
    user_id: str,
    agent_name: str,
    insights: List[str],
    context_action: str = "",
) -> None:
    """Persist agent insights to Supabase."""
    supabase = get_supabase()
    if not supabase or not insights:
        return
    try:
        from datetime import datetime, timezone
        supabase.table("agent_insights").insert({
            "user_id": user_id,
            "agent": agent_name,
            "insights": insights,
            "context_action": context_action,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        logger.debug("sb_insights_save error: %s", exc)


def sb_fetch_activity_feed(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch recent activity for a user."""
    supabase = get_supabase()
    if not supabase:
        return []
    try:
        res = (
            supabase.table("activity_log")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        logger.warning("sb_fetch_activity_feed error: %s", exc)
        return []


# ──────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────


def ensure_user_access(
    email: str,
    password: str,
    name: str,
    department: str,
    role: str,
) -> str:
    """Create or update a Supabase auth user + profile row.  Returns the user id."""
    supabase_admin = get_supabase_admin()
    if supabase_admin is None:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not configured.")

    target_user = None
    users_page = supabase_admin.auth.admin.list_users()
    all_users = getattr(users_page, "users", []) or []
    for user in all_users:
        if (getattr(user, "email", "") or "").lower() == email.lower():
            target_user = user
            break

    if target_user is None:
        created = supabase_admin.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": name},
        })
        target_user = getattr(created, "user", None)
    else:
        supabase_admin.auth.admin.update_user_by_id(
            target_user.id,
            {"password": password, "user_metadata": {"name": name}},
        )

    if target_user is None:
        raise ValueError(f"Could not create/update user for {email}")

    supabase_admin.table("profiles").upsert({
        "id": target_user.id,
        "email": email,
        "name": name,
        "department": department,
        "role": role,
    }).execute()

    return str(target_user.id)
