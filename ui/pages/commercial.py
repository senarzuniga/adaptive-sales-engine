"""Core sales execution pages."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd
import plotly.express as px
import streamlit as st

from config import SUPABASE_CONFIGURED, FULL_ACCESS_ALL_USERS
from ui.components import _field, safe_execute, _render_orchestrator_panel, get_deadline_priority


def page_saved_companies() -> None:
    st.title("🏢 Saved Companies — Empresas Guardadas")
    st.markdown("Directorio de empresas clave con análisis de contexto.")
    saved = st.session_state.get("saved_companies", [])
    if saved:
        st.success(f"✅ {len(saved)} empresas guardadas")
        st.dataframe(pd.DataFrame(saved), use_container_width=True)
    else:
        st.info("No hay empresas guardadas. Añade empresas desde **Company Info**.")
    st.divider()
    _render_orchestrator_panel(action="saved_companies")


def page_company_info() -> None:
    st.title("ℹ️ Company Info — Información de Empresa")
    st.markdown("Ficha completa de empresa: sector, tamaño, KAMs, y análisis de cuenta.")
    with st.form("company_form"):
        col1, col2 = st.columns(2)
        company_name = col1.text_input("Nombre de empresa", placeholder="ACME Corp.")
        country = col2.text_input("País", placeholder="España")
        sector = col1.text_input("Sector", placeholder="Automatización Industrial")
        segment = col2.text_input("Segmento", placeholder="Manufacturing")
        notes = st.text_area("Notas / contexto", placeholder="Información relevante sobre la cuenta...")
        submitted = st.form_submit_button("💾 Guardar empresa", use_container_width=True)
    if submitted and company_name:
        companies = st.session_state.get("saved_companies", [])
        companies.append({
            "name": company_name, "country": country, "sector": sector,
            "segment": segment, "notes": notes,
        })
        st.session_state["saved_companies"] = companies
        st.success(f"✅ '{company_name}' guardada. Total: {len(companies)} empresas.")
        st.rerun()
    st.divider()
    _render_orchestrator_panel(action="company_info")


def page_sales_architecture() -> None:
    st.title("🏗️ Sales Architecture — Arquitectura Comercial Global")
    st.markdown(
        "**Pilar 1** — Diseño del sistema comercial: segmentación, cobertura territorial, "
        "modelo de canales y estructura de la fuerza de ventas."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        seg_candidates = ["Segment", "segmento", "Geographical Area", "Customer Country"]
        shown = False
        for c in seg_candidates:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                counts = df[matched[0]].value_counts().head(10)
                st.subheader(f"Distribución por {matched[0]}")
                st.plotly_chart(
                    px.bar(counts.reset_index(), x=matched[0], y="count",
                           title=f"Top 10 {matched[0]}"),
                    use_container_width=True,
                )
                shown = True
                break
        if not shown:
            st.info("Sube datos con columnas de Segment o Geographical Area para visualización.")
    st.divider()
    _render_orchestrator_panel(action="sales_architecture")


def page_key_account_management() -> None:
    st.title("🔑 Key Account Management — Gestión de Cuentas Clave")
    st.markdown(
        "**Pilar 2** — Sistemas de valor en cuentas clave: mapeo de stakeholders, "
        "planes de cuenta y estrategias de penetración."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        rev_col = None
        cust_col = None
        for c in ["Selling Price", "revenue", "ventas", "amount"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                rev_col = matched[0]
                break
        for c in ["Customer Name", "customer", "cliente"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                cust_col = matched[0]
                break
        if cust_col and rev_col:
            top_df = (
                df.groupby(cust_col)[rev_col]
                .apply(lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum())
                .sort_values(ascending=False)
                .head(10)
                .reset_index()
            )
            top_df.columns = ["Cliente", "Revenue Total"]
            st.subheader("🏆 Top 10 Cuentas por Revenue")
            st.plotly_chart(
                px.bar(top_df, x="Cliente", y="Revenue Total",
                       color="Revenue Total", color_continuous_scale="Blues"),
                use_container_width=True,
            )
    else:
        st.info("Sube datos en **Data Upload** para ver el ranking de cuentas clave.")
    st.divider()
    _render_orchestrator_panel(action="key_account_management")


def page_actions() -> None:
    profile = st.session_state.profile or {}
    department = profile.get("department", "")

    st.title("📋 Commercial Actions Repository")

    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()

    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Esta sección requiere conexión a Supabase.")
        return

    with st.expander("➕ Crear acción", expanded=False):
        with st.form("action_create"):
            name = st.text_input("Nombre")
            goal = st.text_area("Objetivo")
            description = st.text_area("Descripción")
            assigned_to = st.text_input("Asignado a")
            status = st.selectbox("Estado", ["open", "on-going", "close"], index=0)
            importance = st.slider("Importance score", 0, 100, 70)
            strategy_alignment = st.slider("Strategy alignment", 0, 100, 70)
            estimated_hours = st.number_input("Horas estimadas", min_value=0.0, step=1.0, value=0.0)
            submitted = st.form_submit_button("Guardar", use_container_width=True)

            if submitted:
                if not name or not goal:
                    st.error("Nombre y objetivo son obligatorios")
                else:
                    payload = {
                        "name": name,
                        "goal": goal,
                        "description": description,
                        "department": department,
                        "assigned_to": assigned_to or profile.get("name", ""),
                        "status": status,
                        "comments": "",
                        "importance_score": importance,
                        "strategy_alignment": strategy_alignment,
                        "estimated_hours": estimated_hours,
                        "supportive_content": {},
                        "created_by": st.session_state.user.id,
                    }
                    now_iso = datetime.now(timezone.utc).isoformat()
                    payload["created_at"] = now_iso
                    payload["last_modified"] = now_iso
                    try:
                        supabase.table("actions").insert(payload).execute()
                        st.success("Acción creada")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"No se pudo crear: {exc}")

    # Excel sync
    st.subheader("🔁 Sync Excel (bidireccional)")
    s1, s2 = st.columns([1, 1])
    with s1:
        if st.button("Exportar acciones a Excel", use_container_width=True):
            try:
                import io
                rows = supabase.table("actions").select("*").order("created_at", desc=True).execute().data or []
                df = pd.DataFrame(rows)
                buffer = io.BytesIO()
                with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
                    df.to_excel(writer, index=False, sheet_name="ACTION_LOG")
                st.download_button(
                    label="Descargar ACTION_LOG.xlsx",
                    data=buffer.getvalue(),
                    file_name=f"Actions_{department.replace(' ', '')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
            except Exception as exc:
                st.error(f"Error exportando: {exc}")

    with s2:
        up = st.file_uploader("Importar workbook ACTION_LOG", type=["xlsx"], key="actions_upload")
        if up is not None:
            try:
                df = pd.read_excel(up, sheet_name=0)
                required = {"id", "status", "comments"}
                if not required.issubset(set(df.columns)):
                    st.error("El archivo debe incluir columnas: id, status, comments")
                else:
                    ok = 0
                    fail = 0
                    for _, row in df.iterrows():
                        try:
                            supabase.table("actions").update({
                                "status": str(row.get("status", "open")),
                                "comments": str(row.get("comments", "")),
                                "last_modified": datetime.now(timezone.utc).isoformat(),
                            }).eq("id", str(row.get("id"))).execute()
                            ok += 1
                        except Exception:
                            fail += 1
                    st.success(f"Sync completada: {ok} actualizadas, {fail} fallidas")
            except Exception as exc:
                st.error(f"Error importando Excel: {exc}")

    status_filter = st.selectbox("Filtrar estado", ["Todas", "open", "on-going", "close"])
    try:
        query = supabase.table("actions").select("*")
        if status_filter != "Todas":
            query = query.eq("status", status_filter)
        rows = query.order("created_at", desc=True).execute().data or []
    except Exception as exc:
        st.error(f"No se pudieron cargar acciones: {exc}")
        rows = []

    st.subheader("Listado")
    for action in rows:
        with st.container(border=True):
            c1, c2, c3, c4 = st.columns([3, 2, 3, 1])
            c1.markdown(f"**{_field(action, 'name', default='(sin nombre)')}**")
            c1.caption(_field(action, "goal", default=""))

            new_status = c2.selectbox(
                "Estado",
                ["open", "on-going", "close"],
                index=["open", "on-going", "close"].index(_field(action, "status", default="open")),
                key=f"act_status_{action['id']}",
                label_visibility="collapsed",
            )
            if new_status != _field(action, "status", default="open"):
                supabase.table("actions").update(
                    {"status": new_status, "last_modified": datetime.now(timezone.utc).isoformat()}
                ).eq("id", action["id"]).execute()
                st.rerun()

            comments_val = c3.text_input(
                "Comentarios",
                value=str(_field(action, "comments", default="")),
                key=f"act_comments_{action['id']}",
                label_visibility="collapsed",
            )
            if comments_val != str(_field(action, "comments", default="")):
                supabase.table("actions").update(
                    {"comments": comments_val, "last_modified": datetime.now(timezone.utc).isoformat()}
                ).eq("id", action["id"]).execute()

            if c4.button("🗑", key=f"act_del_{action['id']}", use_container_width=True):
                supabase.table("actions").delete().eq("id", action["id"]).execute()
                st.rerun()
