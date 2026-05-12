"""Core sales execution pages."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd
import plotly.express as px
import streamlit as st

from config import SUPABASE_CONFIGURED, FULL_ACCESS_ALL_USERS
from ui.components import _field, safe_execute, _render_orchestrator_panel, get_deadline_priority


def _load_companies() -> List[Dict[str, Any]]:
    """Load companies from Supabase (if configured) or local session state."""
    from config import SUPABASE_CONFIGURED
    if SUPABASE_CONFIGURED:
        from infrastructure.supabase_client import get_supabase
        sb = get_supabase()
        if sb is not None:
            try:
                rows = sb.table("companies").select("*").order("company_name").execute().data or []
                return rows
            except Exception:
                pass
    return st.session_state.get("saved_companies", [])


def _upsert_company(company: Dict[str, Any]) -> None:
    """Persist a company to Supabase or to local session state."""
    from config import SUPABASE_CONFIGURED
    if SUPABASE_CONFIGURED:
        from infrastructure.supabase_client import get_supabase
        sb = get_supabase()
        if sb is not None:
            try:
                payload = {k: v for k, v in company.items() if k != "id"}
                cid = company.get("id")
                if cid:
                    sb.table("companies").update(payload).eq("id", cid).execute()
                else:
                    res = sb.table("companies").insert(payload).execute()
                    if res.data:
                        company["id"] = res.data[0]["id"]
                return
            except Exception:
                pass
    # Local fallback
    saved = st.session_state.get("saved_companies", [])
    cid = company.get("id")
    if cid:
        updated = [c if c.get("id") != cid else company for c in saved]
    else:
        import uuid
        company["id"] = str(uuid.uuid4())
        updated = saved + [company]
    st.session_state["saved_companies"] = updated


def _delete_company(company_id: str) -> None:
    """Delete a company from Supabase or local session state."""
    from config import SUPABASE_CONFIGURED
    if SUPABASE_CONFIGURED:
        from infrastructure.supabase_client import get_supabase
        sb = get_supabase()
        if sb is not None:
            try:
                sb.table("companies").delete().eq("id", company_id).execute()
                return
            except Exception:
                pass
    saved = st.session_state.get("saved_companies", [])
    st.session_state["saved_companies"] = [c for c in saved if c.get("id") != company_id]


_WORKSPACE_TABLE_KEYS = [
    "company_contacts",
    "social_media_accounts",
    "marketing_content",
    "business_intelligence_reports",
    "cost_rates",
    "offers",
    "offer_items",
    "cost_breakdowns",
    "offer_scenarios",
    "offer_scores",
    "installed_base_assets",
    "service_contracts",
    "after_sales_opportunities",
    "spare_parts",
]

_SUPABASE_COMPANY_SCOPED_TABLES = [
    "company_contacts",
    "social_media_accounts",
    "marketing_content",
    "business_intelligence_reports",
    "cost_rates",
    "offers",
    "installed_base_assets",
    "service_contracts",
    "after_sales_opportunities",
    "spare_parts",
]

_WORKSPACE_ROW_EXCLUDE_FIELDS = ("id", "company_id", "created_at", "updated_at")


def _workspace_session_key(table_name: str) -> str:
    return f"workspace_{table_name}"


def _persist_workspace_session(workspace: Dict[str, Any]) -> None:
    """Store workspace tables into session_state for local/demo mode pages."""
    for table in _WORKSPACE_TABLE_KEYS:
        st.session_state[_workspace_session_key(table)] = workspace.get(table, []) or []


def _hydrate_workspace_supabase(company_id: str, workspace: Dict[str, Any]) -> None:
    """Persist workspace rows into Supabase for the imported company."""
    from infrastructure.supabase_client import get_supabase

    if not SUPABASE_CONFIGURED:
        return
    sb = get_supabase()
    if sb is None:
        return

    for table in _SUPABASE_COMPANY_SCOPED_TABLES:
        rows = workspace.get(table) or []
        if not isinstance(rows, list) or not rows:
            continue

        normalized_rows: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            payload = {k: v for k, v in row.items() if k not in _WORKSPACE_ROW_EXCLUDE_FIELDS}
            payload["company_id"] = company_id
            normalized_rows.append(payload)
        if not normalized_rows:
            continue
        try:
            sb.table(table).insert(normalized_rows).execute()
        except Exception:
            # Keep pack loading resilient even if one workspace table fails.
            continue


def _load_company_pack_ui() -> None:
    """Render company pack loading buttons for available packs."""
    import json
    from pathlib import Path

    from config import APP_ROOT

    packs_dir = APP_ROOT / "public" / "company-packs"
    if not packs_dir.exists():
        st.caption("No hay packs disponibles.")
        return

    pack_dirs = [p for p in packs_dir.iterdir() if p.is_dir()]
    if not pack_dirs:
        st.caption("No hay packs disponibles.")
        return

    for pack_dir in pack_dirs:
        pack_file = pack_dir / "ingecart_pack.json"
        if not pack_file.exists():
            # try any .json file
            json_files = list(pack_dir.glob("*_pack.json"))
            if not json_files:
                continue
            pack_file = json_files[0]

        pack_name = pack_dir.name
        with st.container(border=True):
            col1, col2 = st.columns([3, 1])
            col1.markdown(f"**{pack_name}** — Pack de empresa con datos históricos, oportunidades, productos y estrategia")
            if col2.button(f"⬇️ Cargar {pack_name}", key=f"load_pack_{pack_name}", use_container_width=True):
                try:
                    with pack_file.open("r", encoding="utf-8") as f:
                        pack = json.load(f)

                    profile = pack.get("companyProfile", {})
                    if profile:
                        profile = dict(profile)  # mutable copy so _upsert_company can write back the id
                        _upsert_company(profile)
                        st.session_state["active_company"] = profile
                        st.session_state["company_notes"] = profile.get("additional_notes", "")

                    if pack.get("orders"):
                        st.session_state["uploaded_data_universal"] = pd.DataFrame(pack["orders"])

                    if pack.get("opportunities"):
                        st.session_state["oportunidades_data"] = pd.DataFrame(pack["opportunities"])

                    if pack.get("products"):
                        st.session_state["productos_data"] = pd.DataFrame(pack["products"])

                    if pack.get("strategy"):
                        st.session_state["estrategia_data"] = pd.DataFrame(pack["strategy"])

                    if pack.get("leads"):
                        st.session_state["leads_data"] = pd.DataFrame(pack["leads"])

                    if pack.get("contacts"):
                        st.session_state["contacts_data"] = pd.DataFrame(pack["contacts"])

                    if pack.get("tasks"):
                        st.session_state["tasks_data"] = pd.DataFrame(pack["tasks"])

                    if pack.get("entityRegistries"):
                        st.session_state["entity_registries"] = pack["entityRegistries"]

                    workspace = pack.get("workspace", {}) or {}
                    _persist_workspace_session(workspace)
                    company_id = (profile or {}).get("id")
                    if company_id:
                        _hydrate_workspace_supabase(company_id, workspace)
                    elif SUPABASE_CONFIGURED and workspace:
                        st.warning(
                            "Workspace cargado solo en sesión local. Guarda/activa primero la empresa con id en **Company Info** "
                            "para habilitar sincronización completa en Supabase."
                        )

                    st.success(
                        f"✅ Pack **{pack_name}** cargado: empresa activa, "
                        f"{len(pack.get('orders', []))} pedidos, "
                        f"{len(pack.get('opportunities', []))} oportunidades, "
                        f"{len(pack.get('products', []))} productos, "
                        f"{sum(len(v) for v in workspace.values() if isinstance(v, list))} registros workspace."
                    )
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error cargando pack: {exc}")


def page_saved_companies() -> None:
    st.title("🏢 Saved Companies — Empresas Guardadas")
    st.markdown("Selecciona la empresa activa. Todos los análisis y agentes usarán su contexto.")

    companies = _load_companies()

    active_company = st.session_state.get("active_company")
    active_id = (active_company or {}).get("id")

    if not companies:
        st.info("No hay empresas guardadas. Añade una empresa desde **Company Info**.")
    else:
        st.subheader(f"📋 {len(companies)} empresa(s) guardada(s)")

        # ── Active company selector ──────────────────────────────
        company_names = [c.get("company_name", c.get("name", "(sin nombre)")) for c in companies]
        selected_idx = 0
        if active_id:
            for i, c in enumerate(companies):
                if c.get("id") == active_id:
                    selected_idx = i
                    break

        selected_name = st.selectbox(
            "🎯 Empresa activa",
            company_names,
            index=selected_idx,
            key="company_selector",
            help="La empresa seleccionada se usará en todos los análisis y módulos.",
        )
        if st.button("✅ Establecer como empresa activa", type="primary", key="set_active_company_btn"):
            sel = companies[company_names.index(selected_name)]
            st.session_state["active_company"] = sel
            st.session_state["company_notes"] = sel.get("additional_notes", sel.get("notes", ""))
            st.success(f"✅ Empresa activa: **{selected_name}**")
            st.rerun()

        if active_company:
            ac_name = active_company.get("company_name", active_company.get("name", ""))
            st.success(f"🎯 Empresa activa actual: **{ac_name}**")

        st.divider()

        # ── Company cards ────────────────────────────────────────
        for company in companies:
            cid = company.get("id", "")
            cname = company.get("company_name", company.get("name", "(sin nombre)"))
            industry = company.get("industry", company.get("sector", ""))
            hq = company.get("headquarters", company.get("country", ""))
            is_active = cid == (st.session_state.get("active_company") or {}).get("id")

            with st.container(border=True):
                c1, c2, c3 = st.columns([4, 2, 1])
                label = f"**{cname}**" + (" ⭐ *Activa*" if is_active else "")
                c1.markdown(label)
                c1.caption(f"{industry} · {hq}" if industry or hq else "")
                if c2.button("🎯 Activar", key=f"activate_{cid}", use_container_width=True):
                    st.session_state["active_company"] = company
                    st.session_state["company_notes"] = company.get("additional_notes", company.get("notes", ""))
                    st.success(f"Empresa activa: **{cname}**")
                    st.rerun()
                if c3.button("🗑", key=f"del_company_{cid}", use_container_width=True):
                    _delete_company(cid)
                    if is_active:
                        st.session_state["active_company"] = None
                        st.session_state["company_notes"] = ""
                    st.rerun()

    st.divider()

    # ── Company packs (demo data) ────────────────────────────────
    st.subheader("📦 Company Packs — Datos preconfigurados")
    st.markdown("Carga un pack de empresa completo con datos de demostración.")

    _load_company_pack_ui()

    st.divider()
    _render_orchestrator_panel(action="saved_companies")


def page_company_info() -> None:
    st.title("ℹ️ Company Info — Información de Empresa")
    st.markdown("Ficha completa de empresa: sector, tamaño, KAMs, y análisis de cuenta.")

    active_company = st.session_state.get("active_company") or {}

    # ── Edit active company or create new ─────────────────────
    mode = st.radio(
        "Modo",
        ["Editar empresa activa", "Crear nueva empresa"],
        horizontal=True,
        key="company_info_mode",
    )

    if mode == "Editar empresa activa" and not active_company:
        st.info("No hay empresa activa. Selecciona una en **Saved Companies** o crea una nueva aquí.")
        mode = "Crear nueva empresa"

    prefill = active_company if mode == "Editar empresa activa" else {}

    with st.form("company_form_full"):
        st.subheader("📌 Identificación")
        c1, c2 = st.columns(2)
        company_name   = c1.text_input("Nombre de empresa *", value=prefill.get("company_name", prefill.get("name", "")), placeholder="ACME Corp.")
        industry       = c2.text_input("Sector / Industria", value=prefill.get("industry", prefill.get("sector", "")), placeholder="Automatización Industrial")
        sub_sector     = c1.text_input("Sub-sector", value=prefill.get("sub_sector", ""), placeholder="Robótica")
        headquarters   = c2.text_input("Sede central", value=prefill.get("headquarters", prefill.get("country", "")), placeholder="Madrid, España")

        st.subheader("📊 Tamaño y alcance")
        c3, c4 = st.columns(2)
        operating_regions       = c3.text_input("Regiones de operación", value=prefill.get("operating_regions", ""), placeholder="EMEA, LATAM")
        employee_count          = c4.text_input("Número de empleados", value=prefill.get("employee_count", ""), placeholder="500–1000")
        annual_revenue          = c3.text_input("Facturación anual (aprox.)", value=prefill.get("annual_revenue", ""), placeholder="€50M")
        sales_team_size         = c4.text_input("Tamaño equipo comercial", value=prefill.get("sales_team_size", ""), placeholder="15")
        kam_count               = c3.text_input("KAMs asignados", value=prefill.get("kam_count", ""), placeholder="3")
        sales_channels          = c4.text_input("Canales de venta", value=prefill.get("sales_channels", ""), placeholder="Directo, Distribuidores")

        st.subheader("🎯 Contexto estratégico")
        main_products           = st.text_area("Productos / servicios principales", value=prefill.get("main_products", ""), height=80, placeholder="Sensores industriales, controladores PLC…")
        main_customer_segments  = st.text_area("Segmentos de cliente principales", value=prefill.get("main_customer_segments", ""), height=80, placeholder="Fabricantes, integradores…")
        main_competitors        = st.text_area("Principales competidores", value=prefill.get("main_competitors", ""), height=80, placeholder="Siemens, ABB, Schneider…")
        current_challenges      = st.text_area("Retos actuales", value=prefill.get("current_challenges", ""), height=80, placeholder="Presión de margen, internacionalización…")
        strategic_goals         = st.text_area("Objetivos estratégicos", value=prefill.get("strategic_goals", ""), height=80, placeholder="Duplicar cuota en 3 años…")

        st.subheader("🌐 Digital & notas")
        c5, c6 = st.columns(2)
        website_url             = c5.text_input("Web", value=prefill.get("website_url", prefill.get("website", "")), placeholder="https://acme.com")
        linkedin_url            = c6.text_input("LinkedIn", value=prefill.get("linkedin_url", ""), placeholder="https://linkedin.com/company/acme")
        additional_notes        = st.text_area("Notas adicionales / contexto", value=prefill.get("additional_notes", prefill.get("notes", "")), height=100, placeholder="Información relevante sobre la cuenta…")

        submitted = st.form_submit_button("💾 Guardar empresa", use_container_width=True)

    if submitted and company_name:
        company_data: Dict[str, Any] = {
            "company_name": company_name,
            "industry": industry,
            "sub_sector": sub_sector,
            "headquarters": headquarters,
            "operating_regions": operating_regions,
            "employee_count": employee_count,
            "annual_revenue": annual_revenue,
            "main_products": main_products,
            "main_customer_segments": main_customer_segments,
            "main_competitors": main_competitors,
            "sales_team_size": sales_team_size,
            "kam_count": kam_count,
            "sales_channels": sales_channels,
            "current_challenges": current_challenges,
            "strategic_goals": strategic_goals,
            "additional_notes": additional_notes,
            "website_url": website_url,
            "linkedin_url": linkedin_url,
        }
        if mode == "Editar empresa activa" and active_company.get("id"):
            company_data["id"] = active_company["id"]

        _upsert_company(company_data)

        # Keep the rich company data as active company
        st.session_state["active_company"] = company_data
        st.session_state["company_notes"] = additional_notes
        st.success(f"✅ Empresa **{company_name}** guardada correctamente.")
        st.rerun()

    # ── Show current active company summary ─────────────────────
    if active_company:
        st.divider()
        st.subheader("🎯 Empresa activa")
        col1, col2, col3 = st.columns(3)
        col1.metric("Empresa", active_company.get("company_name", active_company.get("name", "—")))
        col2.metric("Sector", active_company.get("industry", active_company.get("sector", "—")))
        col3.metric("Sede", active_company.get("headquarters", active_company.get("country", "—")))
        if active_company.get("annual_revenue"):
            st.caption(f"💶 Facturación: {active_company['annual_revenue']}")
        if active_company.get("strategic_goals"):
            st.caption(f"🎯 Objetivos: {active_company['strategic_goals'][:200]}")

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
