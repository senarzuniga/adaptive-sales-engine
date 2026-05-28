"""Backoffice & admin pages."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd
import streamlit as st

from config import SUPABASE_CONFIGURED, FULL_ACCESS_ALL_USERS
from domain.pricing import PREDEFINED_COST_MODULES, calculate_total_cost
from ui.components import _field, safe_execute, _render_orchestrator_panel


def page_placeholder(title: str, icon: str = "🚧", action: str = "") -> None:
    # Onboarding y ayuda contextual
    if st.session_state.get('onboard_backoffice', True):
        with st.expander('👋 Bienvenido a Backoffice', expanded=True):
            st.markdown('''
**¿Qué puedes hacer aquí?**
- Gestionar usuarios, accesos y configuración avanzada.
- Administrar módulos de costes, social media y proyectos.
- Acceder a herramientas de administración y soporte.

**Tips de productividad:**
- Usa los accesos rápidos para saltar entre paneles administrativos.
- Aprovecha la automatización de invitaciones y provisión de accesos.
            ''')
            if st.button('¡Entendido! Ocultar ayuda', key='hide_onboard_backoffice'):
                st.session_state['onboard_backoffice'] = False
    st.title(f"{icon} {title}")
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        st.info(f"📊 Datos disponibles: {df.shape[0]:,} filas × {df.shape[1]} columnas")
    else:
        st.info("💡 Sube datos en **Data Upload** para activar análisis completo.")
    st.divider()
    _render_orchestrator_panel(action=action or title.lower().replace(" ", "_").replace("º", ""))


def _require_active_company() -> Dict[str, Any] | None:
    active_company = st.session_state.get("active_company") or {}
    if not active_company.get("id"):
        st.warning("Selecciona una empresa activa en **Saved Companies** para usar este módulo.")
        return None
    return active_company


def _workspace_key(table: str) -> str:
    return f"workspace_{table}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_iso_date(date_text: str, field_label: str) -> str | None:
    value = (date_text or "").strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError as exc:
        raise ValueError(f"{field_label} debe tener formato YYYY-MM-DD.") from exc


def _workspace_list(table: str) -> List[Dict[str, Any]]:
    val = st.session_state.get(_workspace_key(table), [])
    return val if isinstance(val, list) else []


def _workspace_save(table: str, rows: List[Dict[str, Any]]) -> None:
    st.session_state[_workspace_key(table)] = rows


def _table_rows(table: str, company_id: str, order_col: str = "created_at", desc: bool = True) -> List[Dict[str, Any]]:
    from infrastructure.supabase_client import get_supabase

    if SUPABASE_CONFIGURED:
        sb = get_supabase()
        if sb is not None:
            try:
                return (
                    sb.table(table)
                    .select("*")
                    .eq("company_id", company_id)
                    .order(order_col, desc=desc)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                pass
    return _workspace_list(table)


def _table_insert(table: str, company_id: str, payload: Dict[str, Any]) -> None:
    from infrastructure.supabase_client import get_supabase

    payload = dict(payload)
    payload["company_id"] = company_id
    if SUPABASE_CONFIGURED:
        sb = get_supabase()
        if sb is not None:
            sb.table(table).insert(payload).execute()
            return

    import uuid

    now_iso = _utc_now_iso()
    payload.setdefault("id", str(uuid.uuid4()))
    payload.setdefault("created_at", now_iso)
    payload.setdefault("updated_at", now_iso)
    rows = _workspace_list(table)
    _workspace_save(table, [payload] + rows)


def _table_update(table: str, company_id: str, row_id: str, updates: Dict[str, Any]) -> None:
    from infrastructure.supabase_client import get_supabase

    if SUPABASE_CONFIGURED:
        sb = get_supabase()
        if sb is not None:
            sb.table(table).update(updates).eq("id", row_id).eq("company_id", company_id).execute()
            return

    rows = _workspace_list(table)
    merged = []
    for row in rows:
        if str(row.get("id")) == str(row_id):
            merged.append({**row, **updates, "updated_at": _utc_now_iso()})
        else:
            merged.append(row)
    _workspace_save(table, merged)


def _table_delete(table: str, company_id: str, row_id: str) -> None:
    from infrastructure.supabase_client import get_supabase

    if SUPABASE_CONFIGURED:
        sb = get_supabase()
        if sb is not None:
            sb.table(table).delete().eq("id", row_id).eq("company_id", company_id).execute()
            return

    rows = _workspace_list(table)
    _workspace_save(table, [r for r in rows if str(r.get("id")) != str(row_id)])


def page_cost_modules() -> None:
    st.title("💲 Cost & Rates")
    st.caption("Referencia de módulos y tasas base")

    df = pd.DataFrame(PREDEFINED_COST_MODULES)
    st.dataframe(df, width='stretch')

    st.subheader("Simulador rápido")
    material = st.number_input("Materiales", min_value=0.0, value=10000.0)
    line_count = st.number_input("Número de líneas", min_value=0, max_value=10, value=2)
    lines: List[Dict[str, Any]] = []
    ids = [m["id"] for m in PREDEFINED_COST_MODULES]
    for i in range(int(line_count)):
        c1, c2 = st.columns(2)
        mid = c1.selectbox(f"Módulo {i + 1}", ids, key=f"sim_mod_{i}")
        qty = c2.number_input(f"Cantidad {i + 1}", min_value=0.0, value=1.0, key=f"sim_qty_{i}")
        lines.append({"module_id": mid, "quantity": qty})
    result = calculate_total_cost(lines, material, 0.0, 0.0)
    st.metric("Total", f"€ {result['total']:,.2f}")


def page_users() -> None:
    profile = st.session_state.profile or {}
    if profile.get("role") != "admin" and not FULL_ACCESS_ALL_USERS:
        st.warning("Acceso restringido a administradores")
        return

    st.title("👥 Team Directory")

    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()

    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Supabase no configurado.")
        return

    rows = safe_execute(
        lambda: supabase.table("profiles").select("*").order("created_at", desc=True).execute().data or [],
        [],
    )
    departments = ["Commercial", "Engineering", "Project Management", "Service", "Administration"]
    for row in rows:
        with st.expander(f"{_field(row, 'name')} · {_field(row, 'email')}"):
            c1, c2, c3 = st.columns(3)
            dep = c1.selectbox(
                "Departamento", departments,
                index=departments.index(_field(row, "department", default="Commercial")),
                key=f"usr_dep_{row['id']}",
            )
            role_val = c2.selectbox(
                "Rol", ["user", "admin"],
                index=0 if _field(row, "role", default="user") == "user" else 1,
                key=f"usr_role_{row['id']}",
            )
            if c3.button("Actualizar", key=f"usr_save_{row['id']}", width='stretch'):
                try:
                    supabase.table("profiles").update(
                        {"department": dep, "role": role_val}
                    ).eq("id", row["id"]).execute()
                    st.success("Actualizado")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error: {exc}")


def page_invites() -> None:
    import re
    from pathlib import Path

    profile = st.session_state.profile or {}
    if profile.get("role") != "admin" and not FULL_ACCESS_ALL_USERS:
        st.warning("Acceso restringido")
        return

    st.title("📧 Email Cobot — User Invites (Gmail)")
    st.caption("Provisiona acceso en Supabase y envía email de bienvenida con contraseña temporal")

    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()

    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Supabase no configurado.")
        return

    from config import GMAIL_ADDRESS, GMAIL_APP_PASSWORD, STREAMLIT_APP_URL, APP_ROOT

    def _parse_users_credentials_file(path: Path) -> List[Dict[str, Any]]:
        if not path.exists():
            return []
        content = path.read_text(encoding="utf-8", errors="ignore")
        users: List[Dict[str, Any]] = []
        current: Dict[str, Any] = {}
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            user_match = re.match(r"^\d+\)\s*User:\s*(.+)$", line)
            email_match = re.match(r"^Email:\s*(.+)$", line)
            pass_match = re.match(r"^Temporary Password:\s*(.+)$", line)
            if user_match:
                if current.get("email") and current.get("password"):
                    users.append(current)
                current = {"name": user_match.group(1).strip()}
            elif email_match:
                current["email"] = email_match.group(1).strip()
            elif pass_match:
                current["password"] = pass_match.group(1).strip()
        if current.get("email") and current.get("password"):
            users.append(current)
        return users

    def _default_department_for_email(email: str) -> str:
        return "Administration" if email.lower().startswith("administracion") else "Commercial"

    def _default_role_for_email(email: str) -> str:
        return "admin" if email.lower().startswith("administracion") else "user"

    credentials_path = APP_ROOT / "user_access_credentials.txt"
    users = _parse_users_credentials_file(credentials_path)

    app_url = st.text_input(
        "Streamlit access URL", value=STREAMLIT_APP_URL or "https://your-app.streamlit.app"
    )

    c1, c2, c3 = st.columns(3)
    c1.metric("Users loaded", len(users))
    c2.metric("Gmail configured", "Yes" if GMAIL_ADDRESS and GMAIL_APP_PASSWORD else "No")

    from infrastructure.supabase_client import get_supabase_admin
    supabase_admin = get_supabase_admin()
    c3.metric("Supabase admin", "Yes" if supabase_admin else "No")

    if not users:
        st.error("No se encontraron usuarios en user_access_credentials.txt")
        return

    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        st.warning("Configura GMAIL_ADDRESS y GMAIL_APP_PASSWORD en Streamlit secrets antes de enviar")

    if supabase_admin is None:
        st.warning("Configura SUPABASE_SERVICE_ROLE_KEY para crear/actualizar accesos automáticamente")

    st.subheader("Preview")
    preview_rows = [
        {
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "department": _default_department_for_email(u.get("email", "")),
            "role": _default_role_for_email(u.get("email", "")),
        }
        for u in users
    ]
    st.dataframe(pd.DataFrame(preview_rows), width='stretch')
    if st.button("🚀 Provision access + send all invites", type="primary", width='stretch'):
        if not app_url:
            st.error("Define la URL de acceso")
            return
        if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
            st.error("Falta configuración de Gmail en secrets")
            return
        if supabase_admin is None:
            st.error("Falta SUPABASE_SERVICE_ROLE_KEY en secrets")
            return

        from infrastructure.supabase_client import ensure_user_access
        from infrastructure.gmail_client import send_invite

        sent_ok = 0
        sent_fail = 0

        for user in users:
            email = user.get("email", "").strip()
            name = user.get("name", "").strip()
            password = user.get("password", "").strip()
            dep = _default_department_for_email(email)
            role = _default_role_for_email(email)

            if not email or not password:
                sent_fail += 1
                st.error(f"Datos incompletos para usuario: {name or email}")
                continue

            try:
                ensure_user_access(email, password, name, dep, role)
                send_invite(email, name, password, app_url)
                sent_ok += 1
                st.success(f"Enviado: {email}")
            except Exception as exc:
                sent_fail += 1
                st.error(f"Error con {email}: {exc}")

        st.info(f"Proceso finalizado. OK: {sent_ok} | Error: {sent_fail}")


def page_social_media_settings() -> None:
    st.title("📱 Social Media — Configuración de Canales")
    active = _require_active_company()
    if not active:
        return
    company_id = active["id"]

    with st.expander("➕ Añadir cuenta social", expanded=False):
        with st.form("social_add_form"):
            c1, c2 = st.columns(2)
            platform = c1.selectbox("Plataforma", ["linkedin", "twitter", "instagram", "facebook", "youtube", "tiktok"])
            account_name = c2.text_input("Cuenta / handle", placeholder="@empresa")
            profile_url = c1.text_input("URL del perfil", placeholder="https://...")
            enabled = c2.checkbox("Activa", value=True)
            notes = st.text_area("Notas", placeholder="API status, credenciales, owner...")
            submitted = st.form_submit_button("Guardar", width='stretch')
            if submitted:
                _table_insert(
                    "social_media_accounts",
                    company_id,
                    {
                        "platform": platform,
                        "account_name": account_name,
                        "profile_url": profile_url,
                        "is_enabled": enabled,
                        "notes": notes,
                        "api_credentials": {},
                        "posting_preferences": {"auto_post": False, "content_types": ["article", "update"], "frequency": "manual"},
                    },
                )
                st.success("Cuenta social guardada")
                st.rerun()

    rows = _table_rows("social_media_accounts", company_id, order_col="platform", desc=False)
    if not rows:
        st.info("No hay cuentas sociales configuradas para esta empresa.")
        st.divider()
        _render_orchestrator_panel(action="social_media")
        return

    st.subheader("Canales configurados")
    for row in rows:
        row_id = str(row.get("id", ""))
        with st.container(border=True):
            c1, c2, c3 = st.columns([2, 3, 1])
            c1.markdown(f"**{_field(row, 'platform', default='N/A').upper()}**")
            c1.caption(_field(row, "account_name", default=""))
            c2.write(_field(row, "profile_url", default="—"))
            c2.caption("🟢 Activa" if bool(row.get("is_enabled")) else "⚪ Inactiva")
            if c3.button("🗑", key=f"sm_del_{row_id}", width='stretch'):
                _table_delete("social_media_accounts", company_id, row_id)
                st.rerun()

    st.divider()
    _render_orchestrator_panel(action="social_media")


def page_marketing_content() -> None:
    st.title("📰 Marketing Content — Repositorio de Contenidos")
    active = _require_active_company()
    if not active:
        return
    company_id = active["id"]

    with st.expander("➕ Crear pieza de contenido", expanded=False):
        with st.form("marketing_create_form"):
            c1, c2 = st.columns(2)
            title = c1.text_input("Título", placeholder="Caso de éxito...")
            content_type = c2.selectbox("Tipo", ["article", "update", "case_study", "product_news", "industry_insight", "newsletter"])
            platform = c1.selectbox("Plataforma", ["linkedin", "newsletter", "twitter", "instagram", "facebook"])
            status = c2.selectbox("Estado", ["draft", "scheduled", "published", "archived"])
            summary = st.text_area("Resumen", placeholder="Resumen ejecutivo...")
            body = st.text_area("Contenido", placeholder="Texto completo...", height=180)
            hashtags_txt = st.text_input("Hashtags (separados por coma)", placeholder="automation, industrial, ai")
            cta = st.text_input("Call to Action", placeholder="Agenda una demo")
            submitted = st.form_submit_button("Guardar contenido", width='stretch')
            if submitted:
                hashtags = [h.strip().lstrip("#") for h in hashtags_txt.split(",") if h.strip()]
                _table_insert(
                    "marketing_content",
                    company_id,
                    {
                        "title": title,
                        "summary": summary,
                        "body": body,
                        "content_type": content_type,
                        "platform": platform,
                        "status": status,
                        "hashtags": hashtags,
                        "call_to_action": cta,
                        "suggested_image_description": "",
                        "alternative_versions": [],
                        "intelligence_sources": {},
                    },
                )
                st.success("Contenido guardado")
                st.rerun()

    rows = _table_rows("marketing_content", company_id)
    if not rows:
        st.info("No hay contenido guardado para esta empresa.")
        st.divider()
        _render_orchestrator_panel(action="marketing_content")
        return

    status_filter = st.selectbox("Filtrar por estado", ["Todos", "draft", "scheduled", "published", "archived"])
    filtered = rows if status_filter == "Todos" else [r for r in rows if str(r.get("status", "")) == status_filter]

    for row in filtered:
        row_id = str(row.get("id", ""))
        with st.container(border=True):
            c1, c2 = st.columns([5, 1])
            c1.markdown(f"**{_field(row, 'title', default='(sin título)')}**")
            c1.caption(f"{_field(row, 'platform', default='-')} · {_field(row, 'content_type', default='-')} · {_field(row, 'status', default='draft')}")
            c1.write(_field(row, "summary", default=""))
            if row.get("hashtags"):
                st.caption(" ".join([f"#{h}" for h in (row.get("hashtags") or [])]))
            if c2.button("🗑", key=f"mk_del_{row_id}", width='stretch'):
                _table_delete("marketing_content", company_id, row_id)
                st.rerun()

    st.divider()
    _render_orchestrator_panel(action="marketing_content")


def page_project_management() -> None:
    st.title("🗂️ Project Management — Portafolio de Proyectos")
    active = _require_active_company()
    if not active:
        return
    company_id = active["id"]

    with st.expander("➕ Crear proyecto", expanded=False):
        with st.form("project_create_form"):
            c1, c2, c3 = st.columns(3)
            project_number = c1.text_input("Número proyecto", placeholder="PRJ-2026-001")
            title = c2.text_input("Título", placeholder="Automatización línea...")
            customer_name = c3.text_input("Cliente", placeholder="Ingecart")
            status = c1.selectbox("Estado", ["planning", "in_progress", "on_hold", "completed", "cancelled"])
            risk_level = c2.selectbox("Riesgo", ["low", "medium", "high", "critical"])
            complexity = c3.selectbox("Complejidad", ["low", "medium", "high"])
            delivery_deadline = c1.text_input("Deadline entrega (YYYY-MM-DD)", placeholder="2026-12-31")
            planned_start = c2.text_input("Inicio planificado (YYYY-MM-DD)", placeholder="2026-06-01")
            planned_end = c3.text_input("Fin planificado (YYYY-MM-DD)", placeholder="2026-11-30")
            contract_value = st.number_input("Valor contrato", min_value=0.0, value=0.0, step=1000.0)
            notes = st.text_area("Notas")
            submitted = st.form_submit_button("Guardar proyecto", width='stretch')
            if submitted:
                try:
                    _table_insert(
                        "projects",
                        company_id,
                        {
                            "project_number": project_number,
                            "title": title,
                            "customer_name": customer_name,
                            "status": status,
                            "risk_level": risk_level,
                            "complexity": complexity,
                            "delivery_deadline": _normalize_iso_date(delivery_deadline, "Deadline entrega"),
                            "planned_start": _normalize_iso_date(planned_start, "Inicio planificado"),
                            "planned_end": _normalize_iso_date(planned_end, "Fin planificado"),
                            "contract_value": contract_value,
                            "currency": "EUR",
                            "notes": notes,
                        },
                    )
                    st.success("Proyecto creado")
                    st.rerun()
                except ValueError as exc:
                    st.error(str(exc))

    rows = _table_rows("projects", company_id, order_col="created_at")
    if not rows:
        st.info("No hay proyectos para esta empresa.")
        st.divider()
        _render_orchestrator_panel(action="project_management")
        return

    n_total = len(rows)
    n_active = len([r for r in rows if str(r.get("status")) in ("planning", "in_progress", "on_hold")])
    total_value = sum(float(r.get("contract_value") or 0) for r in rows)
    high_risk = len([r for r in rows if str(r.get("risk_level")) in ("high", "critical")])
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Proyectos", n_total)
    c2.metric("Activos", n_active)
    c3.metric("Valor total", f"€ {total_value:,.0f}")
    c4.metric("Riesgo alto", high_risk)

    table_rows = []
    for r in rows:
        table_rows.append(
            {
                "ID": _field(r, "project_number", default="—"),
                "Título": _field(r, "title", default=""),
                "Cliente": _field(r, "customer_name", default=""),
                "Estado": _field(r, "status", default="planning"),
                "Riesgo": _field(r, "risk_level", default="medium"),
                "Deadline": _field(r, "delivery_deadline", default=""),
                "Valor": float(r.get("contract_value") or 0),
            }
        )
    st.dataframe(pd.DataFrame(table_rows), width='stretch')

    st.divider()
    _render_orchestrator_panel(action="project_management")
