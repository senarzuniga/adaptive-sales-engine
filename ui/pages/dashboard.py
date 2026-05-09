"""Dashboard page."""
from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd
import plotly.express as px
import streamlit as st

from config import SUPABASE_CONFIGURED
from ui.components import _field, safe_execute, _render_orchestrator_panel


def page_dashboard() -> None:
    profile = st.session_state.profile or {}
    department = profile.get("department", "")
    st.title(f"📊 Dashboard — {department}")

    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()

    if not SUPABASE_CONFIGURED or supabase is None:
        st.info("ℹ️ Supabase no configurado. Mostrando datos de demostración.")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Actions", 0)
        c2.metric("Open", 0)
        c3.metric("On Going", 0)
        c4.metric("Close", 0)
        df_loaded = st.session_state.get("uploaded_data_universal")
        if df_loaded is not None:
            st.subheader("Datos cargados en memoria")
            st.dataframe(df_loaded.head(10), use_container_width=True)
        st.divider()
        _render_orchestrator_panel(action="dashboard")
        return

    actions: List[Dict[str, Any]] = safe_execute(
        lambda: supabase.table("actions").select("*").execute().data or [], []
    )

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Actions", len(actions))
    c2.metric("Open",     len([a for a in actions if _field(a, "status") == "open"]))
    c3.metric("On Going", len([a for a in actions if _field(a, "status") == "on-going"]))
    c4.metric("Close",    len([a for a in actions if _field(a, "status") == "close"]))

    if actions:
        df = pd.DataFrame(actions)
        if "status" in df.columns:
            st.plotly_chart(px.pie(df, names="status", title="Actions by status"), use_container_width=True)

    st.subheader("Últimas acciones")
    recent = sorted(
        actions,
        key=lambda x: _field(x, "last_modified", "created_at", default=""),
        reverse=True,
    )[:8]
    for row in recent:
        status = _field(row, "status", default="open")
        emoji = "🔴" if status == "open" else "🟡" if status == "on-going" else "✅"
        st.write(
            f"{emoji} **{_field(row, 'name', default='(sin nombre)')}** — "
            f"{_field(row, 'goal', default='')}"
        )

    st.divider()
    _render_orchestrator_panel(action="dashboard")
