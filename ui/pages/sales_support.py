"""Sales support & enablement pages."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from config import SUPABASE_CONFIGURED, AVG_OPPS_PER_ACCOUNT
from ui.components import _render_orchestrator_panel
from infrastructure.file_parser import parse_file_to_df, is_safe_url, fetch_url_safe


def page_after_sales_engine() -> None:
    st.title("🔧 After-Sales Engine — Motor de Beneficio Postventa")
    st.markdown(
        "**Pilar 3** — Monetizar la base instalada: contratos de mantenimiento, "
        "upgrades, cross-selling y upselling en clientes existentes."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        cust_col = None
        for c in ["Customer Name", "customer", "cliente"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                cust_col = matched[0]
                break
        if cust_col:
            n_accounts = df[cust_col].nunique()
            st.metric("🏢 Cuentas en base instalada", n_accounts)
            st.info(
                f"Potencial: {n_accounts} cuentas × avg. 2.5 oportunidades = "
                f"~{n_accounts * AVG_OPPS_PER_ACCOUNT} oportunidades post-venta identificables"
            )
    st.divider()
    _render_orchestrator_panel(action="after_sales_engine")


def page_ai_augmented_sales() -> None:
    st.title("🤖 AI-Augmented Sales — Venta Aumentada con IA")
    st.markdown(
        "**Pilar 4** — Procesos de venta potenciados con inteligencia artificial: "
        "scoring de oportunidades, next-best-action y automatización comercial."
    )
    st.info(
        "Este módulo combina el análisis de todos los agentes de IA para generar "
        "recomendaciones de acción específicas para cada oportunidad."
    )

    # ── Cross-Selling results panel ─────────────────────────────
    last = st.session_state.get("last_analysis_results") or {}
    cross = last.get("cross_selling_agent") or {}
    pricing = last.get("dynamic_pricing") or {}

    if cross or pricing:
        st.subheader("📊 Resultados de los agentes IA")
        tabs = []
        if cross:
            tabs.append("🔀 Cross-Selling")
        if pricing:
            tabs.append("💲 Dynamic Pricing")
        tab_objs = st.tabs(tabs) if tabs else []

        tab_idx = 0
        if cross and tab_objs:
            with tab_objs[tab_idx]:
                tab_idx += 1
                opps = cross.get("opportunities", [])
                if opps:
                    st.success(f"✅ {len(opps)} oportunidades de venta cruzada identificadas")
                    st.dataframe(pd.DataFrame(opps), width='stretch')
                email_tpl = cross.get("email_template", "")
                if email_tpl:
                    with st.expander("📧 Plantilla de email de venta cruzada"):
                        st.text(email_tpl)
                sale_script = cross.get("sale_script", "")
                if sale_script:
                    with st.expander("📝 Script de venta"):
                        st.text(sale_script)
                if not opps and not email_tpl:
                    out = cross.get("output", "")
                    if out:
                        st.markdown(out)

        if pricing and tab_objs:
            with tab_objs[tab_idx]:
                rec = pricing.get("recommendation", {})
                if rec:
                    c1, c2, c3 = st.columns(3)
                    c1.metric("💶 Precio recomendado", f"€ {rec.get('price', 0):,.0f}")
                    c2.metric("📊 Estrategia", rec.get("strategy", "—"))
                    c3.metric("🎯 Score confianza", f"{rec.get('confidence', 0):.0%}")
                    with st.expander("Ver justificación"):
                        st.markdown(rec.get("justification", "—"))
                elif pricing.get("output"):
                    st.markdown(pricing["output"])

    st.divider()
    _render_orchestrator_panel(action="ai_augmented_sales")



def page_behavioral_transform() -> None:
    st.title("🧠 Behavioral Transform — Transformación del Comportamiento")
    st.markdown(
        "**Pilar 5** — Cambio de comportamiento comercial: de ventas reactivas "
        "a creación proactiva de valor. Análisis de patrones de comportamiento."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        kam_col = None
        for c in ["KAM", "commercial", "vendedor", "sales rep"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                kam_col = matched[0]
                break
        if kam_col:
            kam_stats = df[kam_col].value_counts().head(8)
            st.subheader("📊 Actividad por KAM")
            st.plotly_chart(
                px.pie(
                    kam_stats.reset_index(),
                    values="count",
                    names=kam_col,
                    title="Distribución de operaciones por KAM",
                ),
                width='stretch',
            )
    st.divider()
    _render_orchestrator_panel(action="behavioral_transform")


def page_product_strategy() -> None:
    st.title("📦 Product Strategy — Posicionamiento de Producto y Valor")
    st.markdown(
        "**Pilar 6** — Estrategia de producto: posicionamiento, pricing, "
        "lifecycle management y propuestas de valor diferenciadas."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        fam_col = None
        rev_col = None
        for c in ["Scope product Family", "product Family", "familia"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                fam_col = matched[0]
                break
        for c in ["Selling Price", "revenue", "ventas", "amount"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                rev_col = matched[0]
                break
        if fam_col and rev_col:
            prod_rev = (
                df.groupby(fam_col)[rev_col]
                .apply(lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum())
                .sort_values(ascending=False)
                .head(10)
                .reset_index()
            )
            prod_rev.columns = ["Familia", "Revenue"]
            st.subheader("📊 Revenue por Familia de Producto")
            st.plotly_chart(
                px.treemap(prod_rev, path=["Familia"], values="Revenue", title="Revenue por Familia"),
                width='stretch',
            )
    st.divider()
    _render_orchestrator_panel(action="product_strategy")


def page_monitoring_dashboard() -> None:
    st.title("📡 Monitoring Dashboard — Estado del Sistema")
    st.markdown("Visión en tiempo real del estado de los agentes, datos cargados y análisis ejecutados.")

    try:
        from orchestrator import get_max_orchestrator
        orch = get_max_orchestrator()
        n_agents = len(orch.agents)
        load_errors = sum(1 for a in orch.agents if a.get("load_error"))
    except Exception:
        n_agents = 0
        load_errors = 0

    n_templates = sum([
        "uploaded_data_universal" in st.session_state,
        "estrategia_data" in st.session_state,
        "productos_data" in st.session_state,
        "oportunidades_data" in st.session_state,
    ])

    last_results = st.session_state.get("last_analysis_results", {})
    last_action = st.session_state.get("last_analysis_action", "—")
    last_ok = last_results.get("_successful_agents", 0)
    last_total = last_results.get("_agent_count", 0)

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("⚡ Agentes disponibles", n_agents,
                delta=f"{load_errors} con errores" if load_errors else None)
    col2.metric("📂 Datasets cargados", n_templates, delta="/4 plantillas")
    col3.metric("✅ Último análisis", f"{last_ok}/{last_total}" if last_total else "—")
    col4.metric("🎯 Última acción", last_action[:20] if last_action != "—" else "—")

    st.divider()

    if n_agents > 0:
        try:
            from orchestrator import get_max_orchestrator as _get
            _orch = _get()
            st.subheader(f"🤖 Registro de agentes ({n_agents})")
            agent_rows = []
            for a in _orch.agents:
                agent_rows.append({
                    "Nombre": a["name"],
                    "Carpeta": a["folder"],
                    "Estado": "⚠️ Error de carga" if a.get("load_error") else "✅ Listo",
                    "Error": (a.get("load_error") or "")[:80],
                })
            st.dataframe(pd.DataFrame(agent_rows), width='stretch')
        except Exception:
            pass

    st.subheader("📊 Inventario de datos")
    data_rows = [
        {"Fuente": "Histórico de ventas", "Key": "uploaded_data_universal",
         "Estado": "✅ Cargado" if "uploaded_data_universal" in st.session_state else "❌ No cargado",
         "Filas": st.session_state.get("uploaded_data_universal", pd.DataFrame()).shape[0]
                  if isinstance(st.session_state.get("uploaded_data_universal"), pd.DataFrame) else 0},
        {"Fuente": "Plan estratégico", "Key": "estrategia_data",
         "Estado": "✅ Cargado" if "estrategia_data" in st.session_state else "❌ No cargado",
         "Filas": st.session_state.get("estrategia_data", pd.DataFrame()).shape[0]
                  if isinstance(st.session_state.get("estrategia_data"), pd.DataFrame) else 0},
        {"Fuente": "Catálogo productos", "Key": "productos_data",
         "Estado": "✅ Cargado" if "productos_data" in st.session_state else "❌ No cargado",
         "Filas": st.session_state.get("productos_data", pd.DataFrame()).shape[0]
                  if isinstance(st.session_state.get("productos_data"), pd.DataFrame) else 0},
        {"Fuente": "Pipeline oportunidades", "Key": "oportunidades_data",
         "Estado": "✅ Cargado" if "oportunidades_data" in st.session_state else "❌ No cargado",
         "Filas": st.session_state.get("oportunidades_data", pd.DataFrame()).shape[0]
                  if isinstance(st.session_state.get("oportunidades_data"), pd.DataFrame) else 0},
    ]
    st.dataframe(pd.DataFrame(data_rows), width='stretch')

    if last_results:
        st.subheader("📋 Último análisis ejecutado")
        summary = last_results.get("_summary", "")
        if summary:
            st.markdown(summary)
        failed_names = last_results.get("_failed_agent_names", [])
        if failed_names:
            st.warning(f"Agentes con error: {', '.join(failed_names)}")

    # AI Observability summary
    st.divider()
    st.subheader("🔭 AI Observability")
    try:
        from ai.observability import observability
        summary = observability.get_summary()
        c1, c2, c3 = st.columns(3)
        c1.metric("Total ejecuciones AI", summary.get("total", 0))
        c2.metric("Exitosas", summary.get("success", 0))
        c3.metric("Avg duración (ms)", summary.get("avg_duration_ms", 0))
        recent = observability.get_recent(10)
        if recent:
            st.dataframe(pd.DataFrame(recent), width='stretch')
    except Exception as exc:
        st.caption(f"Observability no disponible: {exc}")

    st.divider()
    _render_orchestrator_panel(action="monitoring_refresh")


def page_data_upload() -> None:
    st.title("📤 Data Upload — Carga Universal")
    st.markdown(
        "**Formatos soportados**: CSV, Excel, TSV, Parquet, Feather, JSON, JSONL, "
        "TXT, Markdown, HTML, XML, PDF, DOCX, ZIP, Imágenes (OCR), SQLite."
    )

    # ── Dataset type selector ─────────────────────────────────
    st.subheader("📂 Tipo de contenido")
    CONTENT_TYPES = {
        "📊 Histórico de ventas":          "uploaded_data_universal",
        "📦 Catálogo de productos":        "productos_data",
        "🎯 Pipeline de oportunidades":    "oportunidades_data",
        "🏆 Plan estratégico":             "estrategia_data",
        "🧲 Leads comerciales":            "leads_data",
        "👥 Contactos":                    "contacts_data",
        "🗂️ Universal / otros":            "uploaded_data_misc",
    }
    content_type_label = st.selectbox(
        "¿Qué tipo de datos vas a cargar?",
        list(CONTENT_TYPES.keys()),
        key="data_upload_content_type",
        help="Selecciona el tipo de contenido para que se almacene en la ranura correcta.",
    )
    target_key = CONTENT_TYPES[content_type_label]
    st.caption(f"Los datos se guardarán en: `st.session_state['{target_key}']`")

    # ── Dataset status ─────────────────────────────────────────
    with st.expander("📋 Estado actual de datasets", expanded=False):
        for label, key in [
            ("📊 Histórico de ventas",       "uploaded_data_universal"),
            ("📦 Catálogo de productos",      "productos_data"),
            ("🎯 Pipeline oportunidades",     "oportunidades_data"),
            ("🏆 Plan estratégico",           "estrategia_data"),
            ("🧲 Leads comerciales",          "leads_data"),
            ("👥 Contactos",                  "contacts_data"),
        ]:
            df_val = st.session_state.get(key)
            if isinstance(df_val, pd.DataFrame) and not df_val.empty:
                st.success(f"{label}: ✅ {df_val.shape[0]:,} filas × {df_val.shape[1]} columnas")
            else:
                st.warning(f"{label}: ❌ No cargado")

    st.divider()

    st.subheader("1️⃣ Desde URL")
    url_input = st.text_input(
        "URL de datos (JSON/CSV/XML)",
        placeholder="https://ejemplo.com/data.csv",
        key="data_url_input",
    )
    if st.button("Cargar desde URL", key="load_url_btn") and url_input:
        try:
            import json as _json
            content = fetch_url_safe(url_input, timeout=15)
            url_fname = url_input.split("?")[0].split("/")[-1] or "data.json"
            df = parse_file_to_df(url_fname, content)
            if df is None:
                try:
                    data = _json.loads(content.decode("utf-8", errors="replace"))
                    df = pd.DataFrame(data if isinstance(data, list) else [data])
                except Exception:
                    df = pd.DataFrame({"linea": content.decode("utf-8", errors="replace").splitlines()})
            if df is not None:
                st.session_state[target_key] = df
                st.success(f"✅ URL cargada → *{content_type_label}*: {df.shape[0]:,} filas, {df.shape[1]} columnas")
                st.dataframe(df.head(5))
            else:
                st.error("No se pudo interpretar la respuesta de la URL")
        except ValueError as exc:
            st.error(str(exc))
        except Exception as exc:
            st.error(f"Error cargando URL: {exc}")

    st.subheader("2️⃣ Subir archivo")
    uploaded_file = st.file_uploader(
        "Selecciona o arrastra cualquier archivo", type=None, key="universal_uploader"
    )
    if uploaded_file is not None:
        file_bytes = uploaded_file.read()
        with st.spinner(f"Procesando {uploaded_file.name}…"):
            df = parse_file_to_df(uploaded_file.name, file_bytes)
        if df is not None:
            st.session_state[target_key] = df
            st.success(f"✅ **{uploaded_file.name}** → *{content_type_label}* — {df.shape[0]:,} filas, {df.shape[1]} columnas")
            col1, col2, col3 = st.columns(3)
            col1.metric("Filas", f"{df.shape[0]:,}")
            col2.metric("Columnas", df.shape[1])
            col3.metric("Valores nulos", int(df.isnull().sum().sum()))
            st.subheader("Vista previa")
            st.dataframe(df.head(10), width='stretch')
            type_df = pd.DataFrame({"Columna": df.dtypes.index, "Tipo": df.dtypes.values.astype(str)})
            st.dataframe(type_df, width='stretch')
            st.download_button(
                "📥 Descargar como CSV",
                df.to_csv(index=False).encode("utf-8"),
                "datos_procesados.csv",
                "text/csv",
            )
            st.divider()
            st.subheader("🤖 Análisis automático — Todos los agentes")
            _render_orchestrator_panel(
                action="data_upload",
                auto_run=True,
                extra_context={
                    "file_name": uploaded_file.name,
                    "content_type": content_type_label,
                    # Ensure every agent receives the just-uploaded data
                    # regardless of which session-state slot it was stored in.
                    "uploaded_data": df,
                },
            )
        else:
            st.error("No se pudo procesar el archivo. Formato no reconocido.")

    df_current = st.session_state.get("uploaded_data_universal")
    if df_current is not None:
        st.divider()
        st.subheader("📊 Datos actualmente en memoria")
        st.info(f"{df_current.shape[0]:,} filas × {df_current.shape[1]} columnas")
        if st.button("🗑️ Limpiar datos cargados", key="clear_data_btn"):
            st.session_state.uploaded_data_universal = None
            st.rerun()


def page_company_setup() -> None:
    st.title("⚙️ Company Setup — Configuración y Plantillas")
    st.markdown(
        "Descarga las plantillas Excel, súbelas con tus datos y el sistema activará "
        "automáticamente todos los análisis de inteligencia comercial."
    )

    try:
        from modules.template_generator import get_template_bytes, template_info
        _TEMPLATES_AVAILABLE = True
    except Exception:
        _TEMPLATES_AVAILABLE = False

    if _TEMPLATES_AVAILABLE:
        from modules.template_generator import get_template_bytes, template_info  # type: ignore[no-redef]
        infos = template_info()
        st.subheader("📥 Descargar plantillas")
        cols = st.columns(2)
        for i, (tpl_key, tpl_data) in enumerate(infos.items()):
            with cols[i % 2]:
                st.markdown(f"### {tpl_data['label']}")
                st.caption(tpl_data["description"])
                st.markdown("**Columnas:** " + " · ".join(tpl_data["columns"][:5]) + ("…" if len(tpl_data["columns"]) > 5 else ""))
                try:
                    tpl_bytes = get_template_bytes(tpl_key)
                    st.download_button(
                        f"⬇️ Descargar {tpl_key}.xlsx",
                        data=tpl_bytes,
                        file_name=f"{tpl_key}.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"dl_{tpl_key}",
                        width='stretch',
                    )
                except Exception as exc:
                    st.error(f"Error generando plantilla: {exc}")
    else:
        from config import APP_ROOT
        st.subheader("📥 Descargar plantillas")
        tpl_dir = APP_ROOT / "templates"
        tpl_files = list(tpl_dir.glob("template_*.xlsx"))
        if tpl_files:
            for tpl_file in tpl_files:
                with open(tpl_file, "rb") as f:
                    st.download_button(
                        f"⬇️ {tpl_file.name}",
                        data=f.read(),
                        file_name=tpl_file.name,
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"dl_{tpl_file.stem}",
                        width='stretch',
                    )
        else:
            st.warning("Plantillas no disponibles. Instala openpyxl: pip install openpyxl")

    st.divider()
    st.subheader("📤 Subir datos de configuración")
    st.markdown("Sube aquí tus plantillas rellenas. El análisis completo se ejecutará automáticamente.")

    col1, col2 = st.columns(2)
    any_uploaded = False
    with col1:
        hist_file = st.file_uploader("📊 Histórico de ventas", type=["xlsx", "csv"], key="setup_hist")
        if hist_file:
            any_uploaded = True
            df_hist = parse_file_to_df(hist_file.name, hist_file.read())
            if df_hist is not None:
                st.session_state["uploaded_data_universal"] = df_hist
                st.success(f"✅ Histórico: {df_hist.shape[0]:,} filas")

        prod_file = st.file_uploader("📦 Catálogo de productos", type=["xlsx", "csv"], key="setup_prod")
        if prod_file:
            any_uploaded = True
            df_prod = parse_file_to_df(prod_file.name, prod_file.read())
            if df_prod is not None:
                st.session_state["productos_data"] = df_prod
                st.success(f"✅ Productos: {df_prod.shape[0]:,} registros")

    with col2:
        opp_file = st.file_uploader("🎯 Pipeline de oportunidades", type=["xlsx", "csv"], key="setup_opp")
        if opp_file:
            any_uploaded = True
            df_opp = parse_file_to_df(opp_file.name, opp_file.read())
            if df_opp is not None:
                st.session_state["oportunidades_data"] = df_opp
                st.success(f"✅ Oportunidades: {df_opp.shape[0]:,} registros")

        strat_file = st.file_uploader("🏆 Plan estratégico", type=["xlsx", "csv"], key="setup_strat")
        if strat_file:
            any_uploaded = True
            df_strat = parse_file_to_df(strat_file.name, strat_file.read())
            if df_strat is not None:
                st.session_state["estrategia_data"] = df_strat
                st.success(f"✅ Estrategia: {df_strat.shape[0]:,} registros")

    st.divider()
    if any_uploaded:
        st.subheader("🤖 Análisis automático en curso")
        _render_orchestrator_panel(action="company_setup", auto_run=True)
    else:
        _render_orchestrator_panel(action="company_setup")
