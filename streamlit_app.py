"""
ADAPTIVE SALES ENGINE — Streamlit Entry Point
============================================
This file is now a **thin routing layer** — it handles only:
  • Page configuration and global CSS
  • Environment / secret loading
  • Session state initialisation
  • Authentication (login / register / logout)
  • Sidebar navigation
  • Page routing via _PAGE_MAP

All business logic, domain models, infrastructure and UI pages live in
their respective sub-packages:

  config.py               — secrets & feature flags
  domain/                 — Pydantic models (Account, Offer, AgentResult …)
  infrastructure/         — Supabase client, Gmail client, file parser
  application/            — Context engine, services, workflows
  ai/                     — Observability, agent runtime
  ui/                     — Shared components + page modules
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import streamlit as st
from dotenv import load_dotenv

# ── Load .env files before any secret reading ─────────────────
load_dotenv(".env", override=False)
load_dotenv(".env.local", override=True)

# ── Page config (must be the first Streamlit call) ────────────
st.set_page_config(
    page_title="Adaptive Sales Engine - INGECART",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
  .priority-danger  { border-left: 4px solid #ff4b4b; padding-left: 10px; margin: 8px 0; }
  .priority-warning { border-left: 4px solid #ffa500; padding-left: 10px; margin: 8px 0; }
  .priority-success { border-left: 4px solid #00cc66; padding-left: 10px; margin: 8px 0; }
  .nav-section { font-size: 0.72rem; font-weight: 700; color: #888;
                 text-transform: uppercase; letter-spacing: 0.08em;
                 margin: 10px 0 3px 0; }
</style>
""",
    unsafe_allow_html=True,
)

# ── Config imports (reads secrets/env) ────────────────────────
from config import (  # noqa: E402
    SUPABASE_CONFIGURED,
    QUICK_ACCESS_ENABLED,
    FULL_ACCESS_ALL_USERS,
    OCR_AVAILABLE,
    DOCX_AVAILABLE,
    PDF_AVAILABLE,
)

# ── Startup logging ───────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
_logger = logging.getLogger(__name__)
_logger.info("=== Adaptive Sales Engine startup ===")
_logger.info("SUPABASE_CONFIGURED=%s", SUPABASE_CONFIGURED)
_logger.info(
    "Feature flags: quick_access_enabled=%s full_access_all=%s",
    bool(QUICK_ACCESS_ENABLED), bool(FULL_ACCESS_ALL_USERS),
)

# ── Supabase singletons (cached by Streamlit) ─────────────────
from infrastructure.supabase_client import get_supabase, get_supabase_admin  # noqa: E402

supabase = get_supabase()

# ──────────────────────────────────────────────────────────────
# Session state initialisation
# ──────────────────────────────────────────────────────────────


def init_session_state() -> None:
    defaults: Dict[str, Any] = {
        "user":                 None,
        "session":              None,
        "profile":              None,
        "current_request":      None,
        "offer_mode":           None,
        "show_offer_builder":   False,
        "is_quick_access":      False,
        "active_page":          "Dashboard",
        "uploaded_data_universal": None,
        "agent_output":         None,
        "manual_offer_draft":   None,
        # ── Company context ──────────────────────────────────────
        "active_company":       None,   # dict with company profile
        "company_notes":        "",
        "saved_companies":      [],     # list of company dicts (local fallback)
        "portfolio_risk":       None,
        # ── Dataset slots ────────────────────────────────────────
        "productos_data":       None,
        "oportunidades_data":   None,
        "estrategia_data":      None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


# ──────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────


def _build_fallback_profile(user: Any) -> Optional[Dict[str, Any]]:
    if not user:
        return None
    metadata = getattr(user, "user_metadata", None) or {}
    email = getattr(user, "email", "") or ""
    department = metadata.get("department") or (
        "Administration" if email.lower().startswith("administracion") else "Commercial"
    )
    role = metadata.get("role") or ("admin" if email.lower().startswith("administracion") else "user")
    name = metadata.get("name") or email.split("@")[0] or "Usuario"
    return {
        "id": getattr(user, "id", ""),
        "email": email,
        "name": name,
        "department": department,
        "role": role,
        "created_at": datetime.now().isoformat(),
    }


def _get_profile(user_id: str, user: Any = None) -> Optional[Dict[str, Any]]:
    if supabase is None:
        return _build_fallback_profile(user)
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return res.data or _build_fallback_profile(user)
    except Exception:
        return _build_fallback_profile(user)


def refresh_auth_from_supabase() -> None:
    if supabase is None:
        return
    try:
        session_res = supabase.auth.get_session()
        session = session_res.session
        user = session.user if session else None
        st.session_state.session = session
        st.session_state.user = user
        st.session_state.profile = _get_profile(user.id, user) if user else None
    except Exception:
        st.session_state.user = None
        st.session_state.session = None
        st.session_state.profile = None


def _local_login(email: str, password: str) -> bool:
    """Authenticate against the local users_storage (used when Supabase is not configured).

    Updates ``st.session_state`` with user, session (None) and profile on success.
    Returns True on success, False on wrong credentials or any error.
    """
    try:
        from users_storage import build_profile_from_local_user, get_user, update_last_login, verify_user
        if not verify_user(email, password):
            return False
        user_data = get_user(email)
        if not user_data:
            return False
        update_last_login(email)
        profile = build_profile_from_local_user(user_data)

        class _LocalUser:
            id = profile["id"]
            email = user_data["email"]

            @property
            def user_metadata(self) -> Dict[str, Any]:
                return {}

        st.session_state.user = _LocalUser()
        st.session_state.session = None
        st.session_state.profile = profile
        st.session_state.is_quick_access = False
        _logger.info("Local auth login for %s", email)
        return True
    except Exception as exc:
        _logger.warning("Local login error: %s", exc)
        return False


def _local_register(email: str, name: str, department: str) -> Optional[str]:
    """Register a new user in the local users_storage.

    Returns the temporary password on success, or None if the email is already taken
    or any other error occurs.
    """
    try:
        from users_storage import create_user
        result = create_user(email=email, name=name, department=department)
        return result["password"] if result else None
    except Exception as exc:
        _logger.warning("Local register error: %s", exc)
        return None


def _send_welcome_email(email: str, name: str, password: str) -> bool:
    from infrastructure.gmail_client import send_welcome_email
    return send_welcome_email(email, name, password)


def _quick_access_login() -> None:
    guest_profile: Dict[str, Any] = {
        "id": "key_administrator",
        "email": "keyadministrator@quick-access.local",
        "name": "KeyAdministrator",
        "department": "Administration",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    class _GuestUser:
        id = "key_administrator"
        email = "keyadministrator@quick-access.local"

        @property
        def user_metadata(self) -> Dict[str, Any]:
            return {}

    st.session_state.user = _GuestUser()
    st.session_state.session = None
    st.session_state.profile = guest_profile
    st.session_state.is_quick_access = True
    _logger.info("Quick access session created for KeyAdministrator user")
    st.rerun()


def logout() -> None:
    if not st.session_state.get("is_quick_access") and supabase:
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    for k in ["user", "session", "profile", "current_request", "offer_mode",
              "show_offer_builder", "is_quick_access"]:
        st.session_state[k] = None if k not in ("show_offer_builder", "is_quick_access") else False
    st.rerun()


def login_form() -> None:
    st.title("⚙️ Adaptive Sales Engine")
    st.caption("Sistema de gestión comercial multi-usuario — INGECART")

    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        if not SUPABASE_CONFIGURED:
            st.info(
                "ℹ️ Supabase no configurado. "
                "Usa tu cuenta local, regístrate, o accede con **Quick Access**."
            )

        t1, t2 = st.tabs(["🔐 Iniciar Sesión", "📝 Registrarse"])

        with t1:
            with st.form("login_form", clear_on_submit=False):
                email = st.text_input("Email", key="login_email")
                password = st.text_input("Contraseña", type="password", key="login_password")
                submitted = st.form_submit_button("Entrar", use_container_width=True)
                if submitted:
                    if not email or not password:
                        st.error("Por favor completa todos los campos")
                    elif SUPABASE_CONFIGURED and supabase is not None:
                        try:
                            response = supabase.auth.sign_in_with_password(
                                {"email": email, "password": password}
                            )
                            user = response.user
                            profile = _get_profile(user.id, user) if user else None
                            if not user:
                                st.error("No se pudo iniciar sesión")
                            elif not profile:
                                st.error("Usuario sin perfil. Contacta con administración.")
                            else:
                                st.session_state.user = user
                                st.session_state.session = response.session
                                st.session_state.profile = profile
                                st.rerun()
                        except Exception as exc:
                            st.error(f"Error al iniciar sesión: {exc}")
                    else:
                        if _local_login(email, password):
                            st.rerun()
                        else:
                            st.error("Email o contraseña incorrectos")

            st.divider()
            if QUICK_ACCESS_ENABLED:
                st.caption("⚡ Acceso rápido disponible")
                if st.button("⚡ Quick Access (KeyAdministrator)", use_container_width=True, key="quick_access_btn"):
                    _quick_access_login()

        with t2:
            with st.form("register_form", clear_on_submit=False):
                reg_email = st.text_input("Email", key="reg_email")
                reg_name = st.text_input("Nombre completo", key="reg_name")
                reg_department = st.selectbox(
                    "Departamento",
                    ["Commercial", "Engineering", "Project Management", "Service", "Administration"],
                    key="reg_department",
                )
                if SUPABASE_CONFIGURED and supabase is not None:
                    reg_password = st.text_input("Contraseña", type="password", key="reg_password")
                    reg_confirm = st.text_input("Confirmar contraseña", type="password", key="reg_confirm")
                else:
                    reg_password = ""
                    reg_confirm = ""
                    st.caption(
                        "Se generará una contraseña temporal. "
                        "Si GMAIL_ADDRESS y GMAIL_APP_PASSWORD están configurados, "
                        "se enviará a tu email; en caso contrario, se mostrará en pantalla."
                    )
                reg_submitted = st.form_submit_button("Registrarse", use_container_width=True)
                if reg_submitted:
                    if not reg_email or not reg_name:
                        st.error("Completa email y nombre")
                    elif SUPABASE_CONFIGURED and supabase is not None:
                        if reg_password != reg_confirm:
                            st.error("Las contraseñas no coinciden")
                        elif len(reg_password) < 6:
                            st.error("La contraseña debe tener al menos 6 caracteres")
                        else:
                            try:
                                response = supabase.auth.sign_up({
                                    "email": reg_email,
                                    "password": reg_password,
                                    "options": {"data": {
                                        "name": reg_name,
                                        "department": reg_department,
                                        "role": "user",
                                    }},
                                })
                                user = response.user
                                if not user:
                                    st.error("No se pudo crear usuario")
                                else:
                                    try:
                                        supabase.table("profiles").upsert({
                                            "id": user.id,
                                            "email": reg_email,
                                            "name": reg_name,
                                            "department": reg_department,
                                            "role": "user",
                                        }).execute()
                                    except Exception:
                                        pass
                                    st.success(
                                        "Registro exitoso. "
                                        "Si hay confirmación por email, actívala y luego inicia sesión."
                                    )
                            except Exception as exc:
                                st.error(f"Error al registrar: {exc}")
                    else:
                        tmp_password = _local_register(reg_email, reg_name, reg_department)
                        if tmp_password is None:
                            st.error("Este email ya está registrado. Inicia sesión.")
                        else:
                            email_sent = _send_welcome_email(reg_email, reg_name, tmp_password)
                            if email_sent:
                                st.success(f"✅ Credenciales enviadas a {reg_email}. Revisa tu bandeja de entrada.")
                            else:
                                st.warning(
                                    "⚠️ No se pudo enviar el email (Gmail no configurado). "
                                    "Guarda tu contraseña temporal en un lugar seguro:"
                                )
                                with st.expander("🔑 Ver contraseña temporal", expanded=False):
                                    st.text_input(
                                        "Contraseña temporal",
                                        value=tmp_password,
                                        type="default",
                                        key="tmp_pw_reveal",
                                        help="Cópiala y cámbiala tras el primer acceso",
                                    )
                            st.info("Inicia sesión con las credenciales recibidas.")


# ──────────────────────────────────────────────────────────────
# Debug panel
# ──────────────────────────────────────────────────────────────


def show_debug_panel() -> None:
    with st.expander("🛠️ Debug Panel", expanded=False):
        st.markdown("### Feature flags")
        st.json({
            "QUICK_ACCESS_ENABLED": QUICK_ACCESS_ENABLED,
            "FULL_ACCESS_ALL_USERS": FULL_ACCESS_ALL_USERS,
            "SUPABASE_CONFIGURED": SUPABASE_CONFIGURED,
            "OCR_AVAILABLE": OCR_AVAILABLE,
            "DOCX_AVAILABLE": DOCX_AVAILABLE,
            "PDF_AVAILABLE": PDF_AVAILABLE,
        })
        st.markdown("### Current session")
        profile = st.session_state.get("profile") or {}
        st.json({
            "user_id": profile.get("id"),
            "email": profile.get("email"),
            "role": profile.get("role"),
            "department": profile.get("department"),
            "is_quick_access": st.session_state.get("is_quick_access", False),
            "active_page": st.session_state.get("active_page"),
            "data_loaded": st.session_state.get("uploaded_data_universal") is not None,
        })


# ──────────────────────────────────────────────────────────────
# Sidebar / navigation
# ──────────────────────────────────────────────────────────────

_NAV_STRUCTURE: List[tuple] = [
    ("📈 Intelligence & Planning", [
        ("Dashboard",               "📊"),
        ("Business Intelligence",   "🔍"),
        ("Budget Command Center",   "💰"),
        ("Portfolio Analysis",      "📁"),
        ("Weekly Planner",          "📅"),
    ]),
    ("🎯 Core Sales Execution", [
        ("Saved Companies",                 "🏢"),
        ("Company Info",                    "ℹ️"),
        ("360º Analysis",                   "🔄"),
        ("Sales Architecture",              "🏗️"),
        ("Key Account Management",          "🔑"),
        ("Commercial Actions Repository",   "📋"),
    ]),
    ("⚙️ Sales Support & Enablement", [
        ("AI-Augmented Sales",   "🤖"),
        ("Behavioral Transform", "🧠"),
        ("Product Strategy",     "📦"),
        ("Monitoring",           "📡"),
        ("Offer & Pricing",      "💼"),
        ("Data Upload",          "📤"),
        ("Company Setup",        "⚙️"),
    ]),
    ("🔄 After Sales", [
        ("After-Sales Engine", "🔧"),
    ]),
    ("🏢 Backoffice & Operations", [
        ("Team Directory",    "👥"),
        ("Email Cobot",       "📧"),
        ("Marketing Content", "📰"),
        ("Social Media",      "📱"),
        ("Project Management","🗂️"),
        ("Cost & Rates",      "💲"),
    ]),
    ("🤖 Autonomous Agents", [
        ("Agent Hub", "⚡"),
    ]),
]


def show_sidebar() -> None:
    profile = st.session_state.profile or {}
    name = profile.get("name", "Usuario")
    department = profile.get("department", "Unknown")
    role = profile.get("role", "user")
    is_quick = st.session_state.get("is_quick_access", False)
    effective_role = "admin" if FULL_ACCESS_ALL_USERS else role

    with st.sidebar:
        st.title("⚙️ Sales Engine")
        st.caption("INGECART CRM")
        st.divider()
        st.write(f"**👤 {name}**")
        st.write(f"🏢 {department}")
        if is_quick:
            st.warning("⚡ Sesión de invitado")
        if not SUPABASE_CONFIGURED:
            st.info("🔵 Modo demo")
        st.divider()

        current = st.session_state.get("active_page", "Dashboard")

        # ── PROFESSIONAL_MODULES_START ──
        for section_label, pages in _NAV_STRUCTURE:
            st.markdown(
                f"<div class='nav-section'>{section_label}</div>",
                unsafe_allow_html=True,
            )
            for page_name, icon in pages:
                if page_name in ("Team Directory", "Email Cobot") and effective_role != "admin":
                    continue
                label = f"{icon} {page_name}"
                btn_type = "primary" if current == page_name else "secondary"
                if st.button(
                    label,
                    key=f"nav_{page_name}",
                    use_container_width=True,
                    type=btn_type,
                ):
                    st.session_state.active_page = page_name
                    st.rerun()
        # ── PROFESSIONAL_MODULES_END ──

        st.divider()
        if st.button("🚪 Cerrar sesión", use_container_width=True):
            logout()

        try:
            _debug_param = st.query_params.get("debug", "0")
        except Exception:
            _debug_param = "0"
        if effective_role == "admin" or str(_debug_param) == "1":
            show_debug_panel()


# ──────────────────────────────────────────────────────────────
# Page routing map — imports from ui/pages/
# ──────────────────────────────────────────────────────────────

from ui.pages.dashboard import page_dashboard  # noqa: E402
from ui.pages.intelligence import (  # noqa: E402
    page_portfolio_analysis,
    page_business_intelligence,
    page_budget_command_center,
    page_weekly_planner,
    page_360_analysis,
)
from ui.pages.commercial import (  # noqa: E402
    page_saved_companies,
    page_company_info,
    page_sales_architecture,
    page_key_account_management,
    page_actions,
)
from ui.pages.offers import page_offers  # noqa: E402
from ui.pages.sales_support import (  # noqa: E402
    page_ai_augmented_sales,
    page_behavioral_transform,
    page_product_strategy,
    page_monitoring_dashboard,
    page_data_upload,
    page_company_setup,
    page_after_sales_engine,
)
from ui.pages.backoffice import (  # noqa: E402
    page_placeholder,
    page_cost_modules,
    page_users,
    page_invites,
)
from ui.pages.agent_hub import page_agent_hub  # noqa: E402

# ── Auto-implement injection anchors (do not remove) ──────────
# ── AUTO_IMPLEMENT_PAGES_START ──
# ── AUTO_IMPLEMENT_PAGES_END ──

_PAGE_MAP: Dict[str, Any] = {
    "Dashboard":                        page_dashboard,
    "Business Intelligence":            page_business_intelligence,
    "Budget Command Center":            page_budget_command_center,
    "Portfolio Analysis":               page_portfolio_analysis,
    "Weekly Planner":                   page_weekly_planner,
    "Saved Companies":                  page_saved_companies,
    "Company Info":                     page_company_info,
    "360º Analysis":                    page_360_analysis,
    "Sales Architecture":               page_sales_architecture,
    "Key Account Management":           page_key_account_management,
    "Commercial Actions Repository":    page_actions,
    "AI-Augmented Sales":               page_ai_augmented_sales,
    "Behavioral Transform":             page_behavioral_transform,
    "Product Strategy":                 page_product_strategy,
    "Monitoring":                       page_monitoring_dashboard,
    "Offer & Pricing":                  page_offers,
    "Data Upload":                      page_data_upload,
    "Company Setup":                    page_company_setup,
    "After-Sales Engine":               page_after_sales_engine,
    "Team Directory":                   page_users,
    "Email Cobot":                      page_invites,
    "Marketing Content":                lambda: page_placeholder("Marketing Content", "📰", "marketing_content"),
    "Social Media":                     lambda: page_placeholder("Social Media", "📱", "social_media"),
    "Project Management":               lambda: page_placeholder("Project Management", "🗂️", "project_management"),
    "Cost & Rates":                     page_cost_modules,
    "Agent Hub":                        page_agent_hub,
}

# ── Professional routing anchors (auto-implement compatibility) ──
# ── PROFESSIONAL_ROUTING_START ──
# ── PROFESSIONAL_ROUTING_END ──


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────


def main() -> None:
    init_session_state()

    if st.session_state.user is None:
        if SUPABASE_CONFIGURED:
            refresh_auth_from_supabase()
        if st.session_state.user is None or st.session_state.profile is None:
            login_form()
            return

    show_sidebar()

    active = st.session_state.get("active_page", "Dashboard")
    page_fn = _PAGE_MAP.get(active)
    if page_fn:
        page_fn()
    else:
        page_placeholder(active)


if __name__ == "__main__":
    main()
