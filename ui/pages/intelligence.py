"""Intelligence & planning pages."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from ui.components import _render_orchestrator_panel


def page_portfolio_analysis() -> None:
    st.title("📁 Portfolio Analysis")
    df = st.session_state.get("uploaded_data_universal")
    if df is not None and isinstance(df, pd.DataFrame) and not df.empty:
        st.success(f"Datos cargados: {df.shape[0]:,} filas × {df.shape[1]} columnas")
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        cat_cols = df.select_dtypes(exclude="number").columns.tolist()
        if numeric_cols:
            col_x = st.selectbox("Eje X", numeric_cols, key="pa_x")
            col_y = st.selectbox("Eje Y", numeric_cols, key="pa_y")
            col_color = st.selectbox("Color (opcional)", ["Ninguno"] + cat_cols, key="pa_color")
            color_col = None if col_color == "Ninguno" else col_color
            st.plotly_chart(
                px.scatter(df, x=col_x, y=col_y, color=color_col, title=f"{col_x} vs {col_y}"),
                width='stretch',
            )
        if cat_cols and numeric_cols:
            st.plotly_chart(
                px.bar(df, x=cat_cols[0], y=numeric_cols[0],
                       title=f"Bar: {cat_cols[0]} / {numeric_cols[0]}"),
                width='stretch',
            )
    else:
        st.info("Sube datos en **Data Upload** para visualizarlos aquí.")
    st.divider()
    _render_orchestrator_panel(action="portfolio_analysis")


def page_business_intelligence() -> None:
    st.title("🔍 Business Intelligence — Inteligencia de Negocio")
    st.markdown("Análisis avanzado de datos comerciales: tendencias, patrones y KPIs estratégicos.")
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        st.subheader("📈 Análisis exploratorio")
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        cat_cols = df.select_dtypes(exclude="number").columns.tolist()
        if numeric_cols and cat_cols:
            col_x = st.selectbox("Variable X (categórica)", cat_cols, key="bi_x")
            col_y = st.selectbox("Variable Y (numérica)", numeric_cols, key="bi_y")
            agg = df.groupby(col_x)[col_y].sum().sort_values(ascending=False).head(15)
            st.plotly_chart(
                px.bar(agg.reset_index(), x=col_x, y=col_y, title=f"{col_y} por {col_x}"),
                width='stretch',
            )
        if len(numeric_cols) >= 2:
            st.plotly_chart(
                px.scatter_matrix(df[numeric_cols[:4]], title="Matriz de correlación"),
                width='stretch',
            )
    else:
        st.info("Sube datos en **Data Upload** para activar Business Intelligence.")
    st.divider()
    _render_orchestrator_panel(action="business_intelligence")


def page_budget_command_center() -> None:
    st.title("💰 Budget Command Center — Control Presupuestario")
    st.markdown("Comparativa de resultados reales vs plan estratégico.")
    df = st.session_state.get("uploaded_data_universal")
    df_strat = st.session_state.get("estrategia_data")

    if df is not None:
        rev_col = None
        for c in ["Selling Price", "revenue", "ventas", "amount", "Est Revenue"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                rev_col = matched[0]
                break
        if rev_col:
            total_real = float(pd.to_numeric(df[rev_col], errors="coerce").fillna(0).sum())
            c1, c2, c3 = st.columns(3)
            c1.metric("💶 Revenue Real Total", f"{total_real:,.0f}")
            if df_strat is not None:
                for c in ["Est Revenue", "Selling Price", "revenue"]:
                    matched = [col for col in df_strat.columns if col.lower() == c.lower()]
                    if matched:
                        total_plan = float(pd.to_numeric(df_strat[matched[0]], errors="coerce").fillna(0).sum())
                        gap = total_real - total_plan
                        gap_pct = gap / total_plan * 100 if total_plan else 0
                        c2.metric("🎯 Plan Estratégico", f"{total_plan:,.0f}")
                        c3.metric("📊 Desviación", f"{gap:+,.0f}", delta=f"{gap_pct:+.1f}%")
                        break
            else:
                c2.metric("🎯 Plan Estratégico", "—", help="Carga template_estrategia.xlsx")
                st.info("💡 Carga el **template_estrategia.xlsx** en Data Upload para comparativa completa.")
    else:
        st.info("Sube datos históricos y el plan estratégico en **Data Upload** o **Company Setup**.")
    st.divider()
    _render_orchestrator_panel(action="budget_command_center")


def page_weekly_planner() -> None:
    st.title("📅 Weekly Planner — Planificador Semanal")
    st.markdown("Tareas de la semana generadas automáticamente por el agente planificador.")
    last = st.session_state.get("last_analysis_results")
    if last and "weekly_task_planner" in last:
        planner_out = last["weekly_task_planner"]
        tasks = planner_out.get("tasks", [])
        if tasks:
            st.success(f"✅ {len(tasks)} tareas generadas automáticamente")
            st.dataframe(pd.DataFrame(tasks), width='stretch')
    else:
        st.info("Ejecuta el análisis con todos los agentes para generar el plan semanal.")
    st.divider()
    _render_orchestrator_panel(action="weekly_planner")


def page_360_analysis() -> None:
    st.title("🔄 360º Analysis — Análisis Integral")
    st.markdown(
        "**Pilar 0** — Visión 360º del negocio: clientes, productos, territorios y KAMs. "
        "Todos los agentes trabajan en paralelo para darte la imagen completa."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        c1, c2, c3 = st.columns(3)
        c1.metric("Filas de datos", f"{df.shape[0]:,}")
        c2.metric("Variables", df.shape[1])
        c3.metric("Registros nulos", int(df.isnull().sum().sum()))
        with st.expander("📊 Vista previa de datos"):
            st.dataframe(df.head(8), width='stretch')
    else:
        st.info("📂 Sube datos en **Data Upload** o **Company Setup** para análisis 360º.")

    # ── Inline results from pillar0_360_analysis agent ─────────
    last = st.session_state.get("last_analysis_results") or {}
    p0 = last.get("pillar0_360_analysis") or {}
    if p0 and p0.get("status") not in ("error", "timeout", "load_error"):
        st.subheader("📈 Resultados Análisis 360°")
        kpis = p0.get("kpis", {})
        if kpis:
            k1, k2, k3, k4 = st.columns(4)
            k1.metric("💶 Revenue Total", f"€ {kpis.get('total_revenue', 0):,.0f}")
            k2.metric("📊 Margen Medio", f"{kpis.get('avg_margin_pct', 0):.1f}%")
            k3.metric("📦 Transacciones", f"{kpis.get('n_transactions', 0):,}")
            k4.metric("⏱ Lead Time Medio", f"{kpis.get('avg_lead_time_days', 0):.0f} días")

        risk = p0.get("portfolio_risk", {})
        if risk:
            level = risk.get("risk_level", "")
            color = "🔴" if level == "ALTO" else "🟡" if level == "MEDIO" else "🟢"
            st.info(f"{color} **Riesgo de cartera: {level}** — "
                    f"{risk.get('clients_80pct', 0)} clientes representan el 80% de ventas")

        forecast = p0.get("forecast", [])
        if forecast:
            with st.expander("📅 Forecast", expanded=True):
                st.dataframe(pd.DataFrame(forecast), width='stretch')

        insights = p0.get("insights", [])
        if insights:
            with st.expander("💡 Insights clave"):
                for ins in insights[:8]:
                    st.markdown(f"• {ins}")

    st.divider()
    _render_orchestrator_panel(action="360_analysis")
