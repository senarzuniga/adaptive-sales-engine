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

    # Panel de histórico centralizado y buscador global
    st.subheader("🔎 Histórico y buscador global de acciones, contactos y comunicaciones")
    search_query = st.text_input("Buscar por palabra clave, usuario, estado o tipo", key="dashboard_search")
    filter_status = st.selectbox("Filtrar por estado", ["Todos", "open", "on-going", "close"], key="dashboard_status")
    filter_user = st.text_input("Filtrar por usuario asignado", key="dashboard_user")

    if not SUPABASE_CONFIGURED or supabase is None:
        st.info("ℹ️ Supabase no configurado. Mostrando datos de demostración.")
        actions = []
        df_loaded = st.session_state.get("uploaded_data_universal")
        if df_loaded is not None:
            st.subheader("Datos cargados en memoria")
            st.dataframe(df_loaded.head(10), width='stretch')
        st.divider()
        _render_orchestrator_panel(action="dashboard")
        return

    actions: List[Dict[str, Any]] = safe_execute(
        lambda: supabase.table("actions").select("*").execute().data or [], []
    )

    # Filtros de búsqueda
    filtered_actions = actions
    if search_query:
        filtered_actions = [a for a in filtered_actions if search_query.lower() in str(a).lower()]
    if filter_status != "Todos":
        filtered_actions = [a for a in filtered_actions if _field(a, "status") == filter_status]
    if filter_user:
        filtered_actions = [a for a in filtered_actions if filter_user.lower() in str(_field(a, "assigned_to", default="")).lower()]

    st.markdown(f"**{len(filtered_actions)} resultados encontrados**")
    if filtered_actions:
        df = pd.DataFrame(filtered_actions)
        st.dataframe(df, width='stretch')
    else:
        st.info("No hay resultados para los filtros aplicados.")

    st.divider()
    # Panel de actividad reciente y accesos rápidos
    st.subheader("🕒 Actividad reciente y accesos rápidos")
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
            f"{_field(row, 'goal', default='')} | Asignado: {_field(row, 'assigned_to', default='')} | {_field(row, 'created_at', default='')}"
        )
        # Acceso rápido al detalle
        if st.button(f"Ver detalle de {_field(row, 'name', default='(sin nombre)')}", key=f"ver_detalle_{_field(row, 'id', default='')}" ):
            st.json(row)

    st.divider()
    _render_orchestrator_panel(action="dashboard")
