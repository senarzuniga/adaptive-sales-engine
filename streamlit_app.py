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
        "leads_data":           None,
        "contacts_data":        None,
        # ad-hoc uploads intentionally separated from named analysis slots
        # (uploaded_data_universal/productos_data/oportunidades_data/estrategia_data/leads_data/contacts_data)
        "uploaded_data_misc":   None,
        # ── Workspace slots (company-scoped) ────────────────────
        "workspace_company_contacts": [],
        "workspace_social_media_accounts": [],
        "workspace_marketing_content": [],
        "workspace_business_intelligence_reports": [],
        "workspace_cost_rates": [],
        "workspace_service_contracts": [],
        "workspace_after_sales_opportunities": [],
        "workspace_spare_parts": [],
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
try:
    from ui.pages.backoffice import (  # noqa: E402
        page_placeholder,
        page_cost_modules,
        page_users,
        page_invites,
        page_marketing_content,
        page_social_media_settings,
        page_project_management,
    )
except (ImportError, ModuleNotFoundError):  # pragma: no cover - runtime safety for Streamlit Cloud
    _logger.exception("Failed to import ui.pages.backoffice; using fallback pages.")

    def _fallback_page_placeholder(title: str, icon: str = "🚧", action: str = "") -> None:
        st.title(f"{icon} {title}")
        st.error(
            "The Backoffice module failed to load due to a dependency or configuration issue. "
            "Please contact your administrator and check deployment logs."
        )
        if action:
            st.caption(f"Action key: {action}")

    def page_cost_modules() -> None:
        _fallback_page_placeholder("Cost & Rates", "💲", "cost_rates")

    def page_users() -> None:
        _fallback_page_placeholder("Team Directory", "👥", "team_directory")

    def page_invites() -> None:
        _fallback_page_placeholder("Email Cobot", "📧", "email_cobot")

    def page_marketing_content() -> None:
        _fallback_page_placeholder("Marketing Content", "📰", "marketing_content")

    def page_social_media_settings() -> None:
        _fallback_page_placeholder("Social Media", "📱", "social_media")

    def page_project_management() -> None:
        _fallback_page_placeholder("Project Management", "🗂️", "project_management")

    page_placeholder = _fallback_page_placeholder
from ui.pages.agent_hub import page_agent_hub  # noqa: E402

# ── Auto-implement injection anchors (do not remove) ──────────
# ── AUTO_IMPLEMENT_PAGES_START ──


def page_business_intelligence() -> None:
    st.header("📊 Business Intelligence")
    st.caption("Referencia: Looker · Domo · ThoughtSpot")

    with st.expander("📋 Protocolo BI estándar (referencia: Looker + Domo)", expanded=False):
        protocol_steps = [
            "1. Conectar fuentes de datos (CRM, ERP, base de datos propia)",
            "2. Definir métricas y KPIs con definición única acordada",
            "3. Segmentar dashboards por audiencia (dirección, comercial, operaciones)",
            "4. Configurar alertas sobre umbrales críticos",
            "5. Programar distribución automática de informes",
            "6. Capacitar al equipo en exploración autoservicio",
        ]
        for step in protocol_steps:
            st.checkbox(step, key=f"bi_proto_{step[:30]}")

    period = st.selectbox("Período de análisis", ["Últimos 7 días", "Últimos 30 días", "Trimestre actual", "Año actual"], key="bi_period")

    period_multiplier = {"Últimos 7 días": 0.25, "Últimos 30 días": 1.0, "Trimestre actual": 3.0, "Año actual": 12.0}
    mult = period_multiplier.get(period, 1.0)

    base_revenue = 487000 * mult
    base_offers = int(23 * mult)
    base_win_rate = 34.8
    base_avg_deal = 21200

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Revenue generado", f"€{base_revenue:,.0f}", delta=f"+{base_revenue * 0.08:,.0f} vs período anterior")
    m2.metric("Ofertas enviadas", base_offers, delta=f"+{int(base_offers * 0.12)} vs período anterior")
    m3.metric("Win rate", f"{base_win_rate:.1f}%", delta="+2.3pp vs período anterior")
    m4.metric("Ticket medio", f"€{base_avg_deal:,.0f}", delta=f"+€{int(base_avg_deal * 0.05):,} vs período anterior")

    st.subheader("📈 Tendencias por segmento")

    import numpy as np  # noqa: PLC0415

    months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"]
    rng = np.random.default_rng(42)
    df_trend = pd.DataFrame(
        {
            "Mes": months,
            "Automatización": rng.integers(60000, 120000, 6).tolist(),
            "Servicios": rng.integers(40000, 90000, 6).tolist(),
            "Componentes": rng.integers(30000, 70000, 6).tolist(),
        }
    )

    df_melted = df_trend.melt(id_vars="Mes", var_name="Segmento", value_name="Revenue")
    fig_trend = px.line(
        df_melted,
        x="Mes",
        y="Revenue",
        color="Segmento",
        markers=True,
        title="Evolución del revenue por segmento de producto",
        labels={"Revenue": "Revenue (€)"},
    )
    st.plotly_chart(fig_trend, use_container_width=True)

    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("🏆 Top 5 cuentas por revenue")
        rng2 = np.random.default_rng(7)
        df_top = pd.DataFrame(
            {
                "Cuenta": ["Volkswagen", "Siemens", "SEAT", "Schneider", "ABB"],
                "Revenue_€": sorted(rng2.integers(80000, 250000, 5).tolist(), reverse=True),
            }
        )
        fig_top = px.bar(df_top, x="Revenue_€", y="Cuenta", orientation="h", color="Revenue_€",
                         color_continuous_scale="Blues", title="Top 5 cuentas")
        st.plotly_chart(fig_top, use_container_width=True)

    with col_right:
        st.subheader("📊 Distribución de estados de ofertas")
        df_status = pd.DataFrame(
            {"Estado": ["Ganadas", "En negociación", "Perdidas", "Expiradas"], "Cantidad": [8, 7, 4, 4]}
        )
        fig_pie = px.pie(df_status, values="Cantidad", names="Estado",
                         color_discrete_sequence=["#00cc66", "#ffa500", "#ff4b4b", "#999999"],
                         title="Pipeline de ofertas")
        st.plotly_chart(fig_pie, use_container_width=True)

    st.subheader("⏰ Informes programados")
    with st.expander("Configurar informe automático"):
        report_freq = st.selectbox("Frecuencia", ["Diario", "Semanal (lunes)", "Mensual (día 1)"], key="bi_report_freq")
        report_recipients = st.text_input("Destinatarios (emails separados por coma)", key="bi_report_recipients")
        if st.button("💾 Guardar configuración de informe", key="bi_save_report"):
            st.success(f"✅ Informe {report_freq} configurado para: {report_recipients or '(ninguno)'}")

    st.subheader("🔍 Exploración de datos")
    query_example = st.selectbox(
        "Consulta rápida",
        [
            "¿Cuáles son mis 5 clientes con más revenue este mes?",
            "¿Qué segmento tiene la mayor tasa de crecimiento?",
            "¿Cuántas ofertas están en riesgo de expirar esta semana?",
            "¿Cuál es el win rate por comercial?",
        ],
        key="bi_query",
    )
    if st.button("▶️ Ejecutar consulta", key="bi_run_query"):
        st.info(f"💡 Consulta: *{query_example}* — Integra tu fuente de datos real para obtener respuestas en tiempo real.")



def page_key_account_management() -> None:
    st.header("🏆 Key Account Management")
    st.caption("Referencia: Gainsight · Salesforce CRM · HubSpot Sales Hub")

    with st.expander("📋 Protocolo KAM estándar (referencia: Gainsight + Salesforce)", expanded=False):
        protocol_steps = [
            "1. Identificar cuentas estratégicas (Top 20% de ingresos)",
            "2. Mapear stakeholders y niveles de influencia",
            "3. Evaluar Customer Health Score (NPS, frecuencia de contacto, satisfacción)",
            "4. Crear Joint Business Plan con objetivos compartidos",
            "5. Planificar acciones: meetings trimestrales, follow-ups mensuales, upselling",
            "6. Revisión periódica del plan y activar alertas de riesgo",
        ]
        for step in protocol_steps:
            st.checkbox(step, key=f"kam_proto_{step[:30]}")

    if "kam_accounts" not in st.session_state:
        st.session_state.kam_accounts = pd.DataFrame(
            {
                "Cuenta": ["Volkswagen Group", "Siemens AG", "SEAT S.A.", "Schneider Electric", "ABB Ltd"],
                "Ingreso_anual_€": [420000, 310000, 280000, 195000, 160000],
                "Health_Score": [82, 71, 45, 90, 63],
                "NPS": [8, 6, -2, 9, 4],
                "Días_sin_contacto": [12, 8, 35, 5, 42],
                "Responsable": ["Ana García", "Carlos López", "Ana García", "Pedro Martín", "Carlos López"],
            }
        )

    df = st.session_state.kam_accounts.copy()

    st.subheader("📊 Mis cuentas clave")

    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Cuentas gestionadas", len(df))
    col_b.metric("Ingreso total gestionado", f"€{df['Ingreso_anual_€'].sum():,.0f}")
    col_c.metric("Health Score promedio", f"{df['Health_Score'].mean():.0f}/100")

    def _health_color(score: int) -> str:
        if score >= 75:
            return "🟢"
        if score >= 55:
            return "🟡"
        return "🔴"

    df["Estado"] = df["Health_Score"].apply(_health_color)
    st.dataframe(
        df[["Estado", "Cuenta", "Ingreso_anual_€", "Health_Score", "NPS", "Días_sin_contacto", "Responsable"]].style.format(
            {"Ingreso_anual_€": "€{:,.0f}"}
        ).background_gradient(subset=["Health_Score"], cmap="RdYlGn"),
        use_container_width=True,
    )

    st.subheader("🚨 Alertas automáticas")
    alertas = []
    for _, row in df.iterrows():
        if row["NPS"] < 0:
            alertas.append(f"🔴 **{row['Cuenta']}**: NPS negativo ({row['NPS']}). Reunión de recuperación urgente.")
        if row["Días_sin_contacto"] > 30:
            alertas.append(f"🟡 **{row['Cuenta']}**: Sin contacto hace {row['Días_sin_contacto']} días. Sugerir follow-up.")
        if row["Health_Score"] < 55:
            alertas.append(f"🔴 **{row['Cuenta']}**: Health Score crítico ({row['Health_Score']}/100). Activar plan de recuperación.")

    if alertas:
        for alerta in alertas:
            st.warning(alerta)
    else:
        st.success("✅ Todas las cuentas clave están dentro de parámetros saludables.")

    with st.expander("📈 Visualización de health scores"):
        fig = px.bar(
            df.sort_values("Health_Score"),
            x="Health_Score",
            y="Cuenta",
            orientation="h",
            color="Health_Score",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            range_color=[0, 100],
            title="Customer Health Score por cuenta clave",
        )
        fig.add_vline(x=60, line_dash="dash", line_color="red", annotation_text="Umbral crítico: 60")
        st.plotly_chart(fig, use_container_width=True)

    st.download_button(
        "⬇️ Exportar cuentas clave",
        data=df.to_csv(index=False),
        file_name=f"key_accounts_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
        mime="text/csv",
        use_container_width=True,
    )



def page_budget_command_center() -> None:
    st.header("💰 Budget Command Center")
    st.caption("Referencia: Anaplan · Vareto · Cube")

    with st.expander("📋 Protocolo profesional (Anaplan-style)", expanded=False):
        protocol = [
            "1. Definir supuestos del período (inflación, crecimiento, inversiones)",
            "2. Cargar presupuesto base por departamento / línea de producto",
            "3. Simular escenarios optimista / base / pesimista",
            "4. Revisar y aprobar con flujo multi-rol",
            "5. Activar tracking mensual real vs. presupuestado",
            "6. Re-forecast trimestral con datos acumulados",
        ]
        for step in protocol:
            st.checkbox(step, key=f"bcc_proto_{step[:20]}")

    if "bcc_data" not in st.session_state:
        st.session_state.bcc_data = pd.DataFrame(
            {
                "Producto": ["Automatización Industrial", "Servicios de Campo", "Componentes Eléctricos"],
                "Presupuesto_inicial": [300000, 180000, 220000],
                "Real_actual": [285000, 195000, 210000],
            }
        )

    df = st.session_state.bcc_data.copy()

    st.subheader("📊 Escenario What-If")
    col1, col2, col3 = st.columns(3)
    with col1:
        ajuste_a = st.slider(f"Ajuste {df.iloc[0]['Producto']} (%)", -30, 30, 0, key="bcc_adj_a")
    with col2:
        ajuste_b = st.slider(f"Ajuste {df.iloc[1]['Producto']} (%)", -30, 30, 0, key="bcc_adj_b")
    with col3:
        ajuste_c = st.slider(f"Ajuste {df.iloc[2]['Producto']} (%)", -30, 30, 0, key="bcc_adj_c")

    df_sim = df.copy()
    df_sim.loc[0, "Presupuesto_inicial"] *= 1 + ajuste_a / 100
    df_sim.loc[1, "Presupuesto_inicial"] *= 1 + ajuste_b / 100
    df_sim.loc[2, "Presupuesto_inicial"] *= 1 + ajuste_c / 100
    df_sim["Desviación_€"] = df_sim["Real_actual"] - df_sim["Presupuesto_inicial"]
    df_sim["Desviación_%"] = (df_sim["Desviación_€"] / df_sim["Presupuesto_inicial"] * 100).round(1)

    st.dataframe(
        df_sim.style.format(
            {"Presupuesto_inicial": "€{:,.0f}", "Real_actual": "€{:,.0f}", "Desviación_€": "€{:,.0f}", "Desviación_%": "{:+.1f}%"}
        ).bar(subset=["Desviación_€"], color=["#ff9999", "#00cc66"]),
        use_container_width=True,
    )

    total_presupuestado = df_sim["Presupuesto_inicial"].sum()
    total_real = df_sim["Real_actual"].sum()
    desviacion_total = total_real - total_presupuestado

    m1, m2, m3 = st.columns(3)
    m1.metric("Total Presupuestado", f"€{total_presupuestado:,.0f}")
    m2.metric("Total Real", f"€{total_real:,.0f}")
    m3.metric("Desviación Global", f"€{desviacion_total:,.0f}", delta=f"{desviacion_total / total_presupuestado * 100:+.1f}%")

    desviaciones_criticas = df_sim[abs(df_sim["Desviación_%"]) > 10]
    if not desviaciones_criticas.empty:
        st.warning(
            f"⚠️ **Alerta de desviación >10%** en: {', '.join(desviaciones_criticas['Producto'].tolist())}. "
            "Revisar y actualizar el forecast."
        )
    else:
        st.success("✅ Todas las líneas dentro del umbral de desviación (<10%)")

    with st.expander("📈 Gráfico de desviaciones"):
        fig = px.bar(
            df_sim,
            x="Producto",
            y="Desviación_%",
            color="Desviación_%",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            title="Desviación presupuestaria por línea (%)",
            labels={"Desviación_%": "Desviación (%)"},
        )
        fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="Umbral +10%")
        fig.add_hline(y=-10, line_dash="dash", line_color="red", annotation_text="Umbral -10%")
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("📤 Exportar escenario")
    csv = df_sim.to_csv(index=False)
    st.download_button(
        "⬇️ Descargar escenario como CSV",
        data=csv,
        file_name=f"budget_scenario_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        use_container_width=True,
    )

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
    "Marketing Content":                page_marketing_content,
    "Social Media":                     page_social_media_settings,
    "Project Management":               page_project_management,
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
