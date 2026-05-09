"""
BusinessContext engine — builds a unified, typed context object from
Streamlit session state so that every agent and service works from the
same semantic model.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import pandas as pd


def build_context(action: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Build the standard agent context dict from Streamlit session state.

    This is the lightweight version used by the orchestrator panel.  For
    fully typed contexts, use ``build_business_context`` below.
    """
    try:
        import streamlit as st
        ctx: Dict[str, Any] = {
            "action": action,
            "uploaded_data":    st.session_state.get("uploaded_data_universal"),
            "saved_companies":  st.session_state.get("saved_companies", []),
            "estrategia_data":  st.session_state.get("estrategia_data"),
            "productos_data":   st.session_state.get("productos_data"),
            "oportunidades_data": st.session_state.get("oportunidades_data"),
            "portfolio_risk":   st.session_state.get("portfolio_risk"),
            "active_company":   st.session_state.get("active_company"),
            "company_notes":    st.session_state.get("company_notes", ""),
        }
    except Exception:
        ctx = {"action": action}

    if extra:
        ctx.update(extra)
    return ctx


def build_business_context(action: str, extra: Optional[Dict[str, Any]] = None):
    """Build a typed ``BusinessContext`` from Streamlit session state."""
    from domain.models import BusinessContext

    raw = build_context(action, extra)

    profile: Dict[str, Any] = {}
    try:
        import streamlit as st
        profile = st.session_state.get("profile") or {}
    except Exception:
        pass

    return BusinessContext(
        action=action,
        uploaded_data=raw.get("uploaded_data"),
        estrategia_data=raw.get("estrategia_data"),
        productos_data=raw.get("productos_data"),
        oportunidades_data=raw.get("oportunidades_data"),
        active_company=raw.get("active_company"),
        saved_companies=raw.get("saved_companies", []),
        company_notes=raw.get("company_notes", ""),
        portfolio_risk=raw.get("portfolio_risk"),
        user_id=profile.get("id", ""),
        user_role=profile.get("role", "user"),
        extra=extra or {},
    )
