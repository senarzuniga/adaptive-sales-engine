"""Backoffice & admin pages."""
from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd
import streamlit as st

from config import SUPABASE_CONFIGURED, FULL_ACCESS_ALL_USERS
from domain.pricing import PREDEFINED_COST_MODULES, calculate_total_cost
from ui.components import _field, safe_execute, _render_orchestrator_panel


def page_placeholder(title: str, icon: str = "🚧", action: str = "") -> None:
    st.title(f"{icon} {title}")
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        st.info(f"📊 Datos disponibles: {df.shape[0]:,} filas × {df.shape[1]} columnas")
    else:
        st.info("💡 Sube datos en **Data Upload** para activar análisis completo.")
    st.divider()
    _render_orchestrator_panel(action=action or title.lower().replace(" ", "_").replace("º", ""))


def page_cost_modules() -> None:
    st.title("💲 Cost & Rates")
    st.caption("Referencia de módulos y tasas base")

    df = pd.DataFrame(PREDEFINED_COST_MODULES)
    st.dataframe(df, use_container_width=True)

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
            if c3.button("Actualizar", key=f"usr_save_{row['id']}", use_container_width=True):
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
    st.dataframe(pd.DataFrame(preview_rows), use_container_width=True)

    if st.button("🚀 Provision access + send all invites", type="primary", use_container_width=True):
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
