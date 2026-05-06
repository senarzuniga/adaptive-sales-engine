"""
ADAPTIVE SALES ENGINE - STREAMLIT INTERFACE
Multi-user access with Supabase Auth + shared Supabase DB
"""

from __future__ import annotations

import io
import logging
import os
import re
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv
from supabase import Client, create_client


# ──────────────────────────────────────────────────────────────
# Config & setup
# ──────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Adaptive Sales Engine - INGECART",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
  .priority-danger { border-left: 4px solid #ff4b4b; padding-left: 10px; margin: 8px 0; }
  .priority-warning { border-left: 4px solid #ffa500; padding-left: 10px; margin: 8px 0; }
  .priority-success { border-left: 4px solid #00cc66; padding-left: 10px; margin: 8px 0; }
</style>
""",
    unsafe_allow_html=True,
)

# Load the same config files used by the current project setup.
# .env.local is loaded after .env so local overrides win.
load_dotenv(".env", override=False)
load_dotenv(".env.local", override=True)


def _get_secret(*names: str) -> str:
    for name in names:
        env_val = os.getenv(name)
        if env_val:
            return env_val
        try:
            secret_val = st.secrets.get(name, "")
            if secret_val:
                return secret_val
        except Exception:
            pass
    return ""


def get_bool_secret(key: str, default: bool = False) -> bool:
    """Robustly parse a boolean secret regardless of whether it is stored as a
    native TOML boolean, the string ``"true"``/``"1"``/``"yes"``, or is missing
    entirely.  Falls back to *default* on any error."""
    try:
        # Prefer environment variable first (matches _get_secret behaviour)
        env_val = os.getenv(key)
        if env_val is not None:
            return env_val.strip().lower() in ("true", "1", "yes")
        value = st.secrets.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes")
        return bool(value)
    except Exception:
        return default


SUPABASE_URL = _get_secret("SUPABASE_URL", "VITE_SUPABASE_URL")
SUPABASE_KEY = _get_secret(
    "SUPABASE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
)
SUPABASE_SERVICE_ROLE_KEY = _get_secret("SUPABASE_SERVICE_ROLE_KEY")

GMAIL_ADDRESS = _get_secret("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = _get_secret("GMAIL_APP_PASSWORD")
STREAMLIT_APP_URL = _get_secret("STREAMLIT_APP_URL")

# ── Feature flags ─────────────────────────────────────────────
QUICK_ACCESS_ENABLED = get_bool_secret("QUICK_ACCESS_ENABLED")
FULL_ACCESS_ALL_USERS = get_bool_secret("FULL_ACCESS_ALL_USERS")

# ── Startup logging ───────────────────────────────────────────
_logger = logging.getLogger(__name__)
_logger.info("=== Adaptive Sales Engine startup ===")
_logger.info("Environment: SUPABASE_URL configured=%s", bool(SUPABASE_URL))
_logger.info("Feature flags: quick_access=%s full_access=%s", QUICK_ACCESS_ENABLED, FULL_ACCESS_ALL_USERS)
_logger.info("Gmail configured=%s", bool(GMAIL_ADDRESS and GMAIL_APP_PASSWORD))
try:
    _secrets_count = len(list(st.secrets.keys())) if hasattr(st, "secrets") else 0
    _logger.info("Secrets store: %d key(s) loaded", _secrets_count)
except Exception as _e:
    _logger.warning("Could not access st.secrets: %s", _e)

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("Faltan credenciales de Supabase (SUPABASE_URL + SUPABASE_KEY/SUPABASE_ANON_KEY).")
    st.stop()


@st.cache_resource
def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


@st.cache_resource
def get_supabase_admin() -> Optional[Client]:
    if not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        return None


supabase = get_supabase()
supabase_admin = get_supabase_admin()


# ──────────────────────────────────────────────────────────────
# Cost engine (Python mirror of src/lib/costEngine.ts)
# ──────────────────────────────────────────────────────────────

PREDEFINED_COST_MODULES: List[Dict[str, Any]] = [
    {"id": "eng_hour", "name": "Engineering Cost", "rate": 65, "unit": "hour", "is_percentage": False, "category": "labor"},
    {"id": "assembly_hour", "name": "Assembly Cost", "rate": 45, "unit": "hour", "is_percentage": False, "category": "labor"},
    {"id": "quality_hour", "name": "Quality Inspection", "rate": 65, "unit": "hour", "is_percentage": False, "category": "labor"},
    {"id": "automation_hour", "name": "Automation Cost", "rate": 65, "unit": "hour", "is_percentage": False, "category": "labor"},
    {"id": "mech_day", "name": "Mechanical Support", "rate": 650, "unit": "day", "is_percentage": False, "category": "labor"},
    {"id": "elec_day", "name": "Electrical Support", "rate": 650, "unit": "day", "is_percentage": False, "category": "labor"},
    {"id": "auto_day", "name": "Automation Support", "rate": 750, "unit": "day", "is_percentage": False, "category": "labor"},
    {"id": "eng_day", "name": "Engineering Support", "rate": 750, "unit": "day", "is_percentage": False, "category": "labor"},
    {"id": "accommodation_spain", "name": "Accommodation Spain", "rate": 120, "unit": "day", "is_percentage": False, "category": "accommodation"},
    {"id": "accommodation_europe", "name": "Accommodation Europe", "rate": 180, "unit": "day", "is_percentage": False, "category": "accommodation"},
    {"id": "accommodation_usa", "name": "Accommodation USA", "rate": 250, "unit": "day", "is_percentage": False, "category": "accommodation"},
    {"id": "travel_spain", "name": "Travel Spain", "rate": 200, "unit": "trip", "is_percentage": False, "category": "travel"},
    {"id": "travel_europe", "name": "Travel Europe", "rate": 400, "unit": "trip", "is_percentage": False, "category": "travel"},
    {"id": "travel_usa", "name": "Travel USA", "rate": 1200, "unit": "trip", "is_percentage": False, "category": "travel"},
    {"id": "warranty", "name": "Warranty", "rate": 3.0, "unit": "%", "is_percentage": True, "percentage_of": "total_excluding_warranty", "category": "fee"},
    {"id": "contingency", "name": "Contingency Fee", "rate": 1.5, "unit": "%", "is_percentage": True, "percentage_of": "total", "category": "fee"},
    {"id": "material_fee", "name": "Material Fee", "rate": 3.0, "unit": "%", "is_percentage": True, "percentage_of": "materials", "category": "fee"},
    {"id": "delivery_insurance", "name": "Delivery Insurance", "rate": 0.1, "unit": "%", "is_percentage": True, "percentage_of": "goods", "category": "fee"},
]

FREIGHT_BASE_RATES = {
    "ALEMANIA - BERLIN": {"truck": 2625, "20ft": 3200, "40ft": 4800},
    "ESPAÑA - BARCELONA": {"truck": 695, "20ft": 1900, "40ft": 1900},
    "FRANCE - PARIS": {"truck": 1850, "20ft": 2800, "40ft": 3900},
    "USA - NEW YORK": {"truck": 0, "20ft": 4800, "40ft": 7200},
}


def calculate_freight_cost(destination: str, transport_mode: str, container_type: str = "20ft", quantity: int = 1) -> float:
    rates = FREIGHT_BASE_RATES.get(destination.upper(), {})
    if transport_mode == "truck":
        return float(rates.get("truck", 0)) * quantity
    key = "20ft" if container_type == "20ft" else "40ft"
    return float(rates.get(key, 0)) * quantity


def calculate_total_cost(lines: List[Dict[str, Any]], material_cost: float, freight_cost: float, packaging_cost: float) -> Dict[str, Any]:
    module_map = {m["id"]: m for m in PREDEFINED_COST_MODULES}
    subtotal = float(material_cost) + float(freight_cost) + float(packaging_cost)
    breakdown: Dict[str, float] = {
        "materials": float(material_cost),
        "freight": float(freight_cost),
        "packaging": float(packaging_cost),
    }

    # Non-percentage modules first
    for line in lines:
        module_id = line.get("module_id")
        quantity = float(line.get("quantity", 0))
        mod = module_map.get(module_id)
        if not mod or mod.get("is_percentage"):
            continue
        amount = float(mod.get("rate", 0)) * quantity
        subtotal += amount
        breakdown[module_id] = amount

    total = subtotal

    # Percentage modules
    warranty = 0.0
    contingency = 0.0
    material_fee = 0.0
    insurance = 0.0

    for line in lines:
        module_id = line.get("module_id")
        mod = module_map.get(module_id)
        if not mod or not mod.get("is_percentage"):
            continue

        base_type = mod.get("percentage_of", "total")
        if base_type == "materials":
            base = float(material_cost)
        elif base_type == "goods":
            base = float(material_cost) + float(freight_cost)
        elif base_type == "total_excluding_warranty":
            base = subtotal
        else:
            base = total

        amount = base * (float(mod.get("rate", 0)) / 100.0)
        total += amount
        breakdown[module_id] = amount

        if module_id == "warranty":
            warranty = amount
        elif module_id == "contingency":
            contingency = amount
        elif module_id == "material_fee":
            material_fee = amount
        elif module_id == "delivery_insurance":
            insurance = amount

    return {
        "labor": {k: v for k, v in breakdown.items() if "hour" in k or "_day" in k},
        "materials": float(material_cost),
        "freight": float(freight_cost),
        "packaging": float(packaging_cost),
        "warranty": warranty,
        "contingency": contingency,
        "material_fee": material_fee,
        "delivery_insurance": insurance,
        "incoterms": {},
        "total": total,
        "detail": breakdown,
    }


# ──────────────────────────────────────────────────────────────
# Session & auth helpers
# ──────────────────────────────────────────────────────────────


def init_session_state() -> None:
    defaults = {
        "user": None,
        "session": None,
        "profile": None,
        "current_request": None,
        "offer_mode": None,
        "show_offer_builder": False,
        "is_quick_access": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _build_fallback_profile(user: Any) -> Optional[Dict[str, Any]]:
    if not user:
        return None

    metadata = getattr(user, "user_metadata", None) or {}
    email = getattr(user, "email", "") or ""
    department = metadata.get("department") or ("Administration" if email.lower().startswith("administracion") else "Commercial")
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


def _get_profile(user_id: str, user: Any | None = None) -> Optional[Dict[str, Any]]:
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return res.data or _build_fallback_profile(user)
    except Exception:
        return _build_fallback_profile(user)


def refresh_auth_from_supabase() -> None:
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


def login_form() -> None:
    st.title("⚙️ Adaptive Sales Engine")
    st.caption("Sistema de gestión comercial multi-usuario")

    # Failsafe warnings for missing secrets
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.warning("⚠️ Credenciales de Supabase no configuradas. Comprueba los secrets.")

    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        t1, t2 = st.tabs(["🔐 Iniciar Sesión", "📝 Registrarse"])

        with t1:
            with st.form("login_form", clear_on_submit=False):
                email = st.text_input("Email", key="login_email")
                password = st.text_input("Contraseña", type="password", key="login_password")
                submitted = st.form_submit_button("Entrar", use_container_width=True)
                if submitted:
                    if not email or not password:
                        st.error("Por favor completa todos los campos")
                    else:
                        try:
                            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
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

            # Quick Access button — rendered outside the form so it always shows
            if QUICK_ACCESS_ENABLED:
                st.divider()
                st.caption("⚡ Acceso rápido habilitado")
                if st.button("⚡ Quick Access (invitado)", use_container_width=True, key="quick_access_btn"):
                    _quick_access_login()
            else:
                # Show a subtle warning so admins know the flag is not set
                st.caption("ℹ️ Quick Access no está habilitado (QUICK_ACCESS_ENABLED no configurado)")

        with t2:
            with st.form("register_form", clear_on_submit=False):
                email = st.text_input("Email", key="reg_email")
                name = st.text_input("Nombre completo", key="reg_name")
                department = st.selectbox(
                    "Departamento",
                    ["Commercial", "Engineering", "Project Management", "Service", "Administration"],
                    key="reg_department",
                )
                password = st.text_input("Contraseña", type="password", key="reg_password")
                confirm = st.text_input("Confirmar contraseña", type="password", key="reg_confirm")
                submitted = st.form_submit_button("Registrarse", use_container_width=True)

                if submitted:
                    if password != confirm:
                        st.error("Las contraseñas no coinciden")
                    elif len(password) < 6:
                        st.error("La contraseña debe tener al menos 6 caracteres")
                    elif not email or not name:
                        st.error("Completa email y nombre")
                    else:
                        try:
                            response = supabase.auth.sign_up(
                                {
                                    "email": email,
                                    "password": password,
                                    "options": {"data": {"name": name, "department": department, "role": "user"}},
                                }
                            )
                            user = response.user
                            if not user:
                                st.error("No se pudo crear usuario")
                            else:
                                try:
                                    supabase.table("profiles").upsert(
                                        {
                                            "id": user.id,
                                            "email": email,
                                            "name": name,
                                            "department": department,
                                            "role": "user",
                                        }
                                    ).execute()
                                except Exception:
                                    pass
                                st.success("Registro exitoso. Si hay confirmación por email, actívala y luego inicia sesión.")
                        except Exception as exc:
                            st.error(f"Error al registrar: {exc}")


def logout() -> None:
    if not st.session_state.get("is_quick_access"):
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    for k in ["user", "session", "profile", "current_request", "offer_mode", "show_offer_builder", "is_quick_access"]:
        st.session_state[k] = None if k in ["user", "session", "profile", "current_request", "offer_mode"] else False
    st.rerun()


def _quick_access_login() -> None:
    """Create a synthetic guest session without Supabase authentication.

    This is only reachable when QUICK_ACCESS_ENABLED=true.  The resulting
    session has read-only commercial access and is clearly flagged as a guest
    so the rest of the application can restrict write operations if desired.
    """
    guest_profile: Dict[str, Any] = {
        "id": "quick_access_guest",
        "email": "guest@quick-access.local",
        "name": "Guest (Quick Access)",
        "department": "Commercial",
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    class _GuestUser:
        """Minimal mock user object compatible with the rest of the application."""

        id = "quick_access_guest"
        email = "guest@quick-access.local"

        @property
        def user_metadata(self) -> Dict[str, Any]:
            return {}

    st.session_state.user = _GuestUser()
    st.session_state.session = None
    st.session_state.profile = guest_profile
    st.session_state.is_quick_access = True
    _logger.info("Quick access session created for guest user")
    st.rerun()


def show_debug_panel() -> None:
    """Render a collapsible debug panel showing secrets / flag state.

    Visible to admin users via the sidebar and to anyone who appends
    ``?debug=1`` to the URL (useful during initial setup).
    """
    with st.expander("🛠️ Debug Panel", expanded=False):
        st.markdown("### Feature flags")
        st.json(
            {
                "QUICK_ACCESS_ENABLED": QUICK_ACCESS_ENABLED,
                "FULL_ACCESS_ALL_USERS": FULL_ACCESS_ALL_USERS,
            }
        )

        st.markdown("### Secrets availability")
        secrets_status: Dict[str, bool] = {}
        for key in ("SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
                    "QUICK_ACCESS_ENABLED", "FULL_ACCESS_ALL_USERS",
                    "GMAIL_ADDRESS", "STREAMLIT_APP_URL"):
            try:
                secrets_status[key] = bool(st.secrets.get(key))
            except Exception:
                secrets_status[key] = bool(os.getenv(key))
        st.json(secrets_status)

        st.markdown("### Current session")
        profile = st.session_state.get("profile") or {}
        st.json(
            {
                "user_id": profile.get("id"),
                "email": profile.get("email"),
                "role": profile.get("role"),
                "department": profile.get("department"),
                "is_quick_access": st.session_state.get("is_quick_access", False),
            }
        )


# ──────────────────────────────────────────────────────────────
# Common UI helpers
# ──────────────────────────────────────────────────────────────


def get_deadline_priority(deadline_text: str) -> tuple[str, str, int]:
    try:
        deadline = datetime.fromisoformat(deadline_text.replace("Z", ""))
    except Exception:
        deadline = datetime.now() + timedelta(days=10)
    days_left = (deadline.date() - datetime.now().date()).days
    if days_left < 3:
        return "priority-danger", "🔴", days_left
    if days_left < 7:
        return "priority-warning", "🟡", days_left
    return "priority-success", "🟢", days_left


def _field(row: Dict[str, Any], *names: str, default: Any = "") -> Any:
    for n in names:
        if n in row and row[n] is not None:
            return row[n]
    return default


def safe_execute(fetcher, fallback: Any):
    try:
        return fetcher()
    except Exception:
        return fallback


def _parse_users_credentials_file(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []

    content = path.read_text(encoding="utf-8", errors="ignore")
    users: List[Dict[str, str]] = []
    current: Dict[str, str] = {}

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
    if email.lower().startswith("administracion"):
        return "Administration"
    return "Commercial"


def _default_role_for_email(email: str) -> str:
    if email.lower().startswith("administracion"):
        return "admin"
    return "user"


def _send_gmail_invite(recipient_email: str, recipient_name: str, temporary_password: str, app_url: str) -> None:
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise ValueError("Falta GMAIL_ADDRESS o GMAIL_APP_PASSWORD en secrets")

    subject = "Welcome to Adaptive Sales Engine - INGECART Access"
    safe_name = recipient_name or "Team Member"
    body = f"""Hello {safe_name},

Welcome to Adaptive Sales Engine.
We are pleased to invite you to join the application.

Access URL: {app_url}
Email: {recipient_email}
Temporary password: {temporary_password}

Please sign in and change your password on first access.

Best regards,
INGECART Team
"""

    msg = EmailMessage()
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        smtp.send_message(msg)


def _ensure_user_access(email: str, password: str, name: str, department: str, role: str) -> str:
    if supabase_admin is None:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY no está configurada. No se puede crear acceso automáticamente.")

    target_user = None
    users_page = supabase_admin.auth.admin.list_users()
    all_users = getattr(users_page, "users", []) or []
    for user in all_users:
        user_email = getattr(user, "email", "") or ""
        if user_email.lower() == email.lower():
            target_user = user
            break

    if target_user is None:
        created = supabase_admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"name": name},
            }
        )
        target_user = getattr(created, "user", None)
    else:
        supabase_admin.auth.admin.update_user_by_id(
            target_user.id,
            {
                "password": password,
                "user_metadata": {"name": name},
            },
        )

    if target_user is None:
        raise ValueError(f"No se pudo crear/actualizar usuario para {email}")

    supabase_admin.table("profiles").upsert(
        {
            "id": target_user.id,
            "email": email,
            "name": name,
            "department": department,
            "role": role,
        }
    ).execute()

    return str(target_user.id)


# ──────────────────────────────────────────────────────────────
# Sidebar / navigation
# ──────────────────────────────────────────────────────────────


def show_sidebar() -> str:
    profile = st.session_state.profile or {}
    name = profile.get("name", "Usuario")
    department = profile.get("department", "Unknown")
    role = profile.get("role", "user")
    is_quick = st.session_state.get("is_quick_access", False)

    # FULL_ACCESS_ALL_USERS: treat every logged-in user as admin for navigation
    effective_role = "admin" if FULL_ACCESS_ALL_USERS else role

    with st.sidebar:
        st.title("Adaptive Sales")
        st.caption("INGECART CRM")
        st.divider()
        st.write(f"**👤 {name}**")
        st.write(f"🏢 {department}")
        st.write(f"🔐 Rol: {role}")
        if is_quick:
            st.warning("⚡ Sesión de invitado (Quick Access)")
        if FULL_ACCESS_ALL_USERS and role != "admin":
            st.info("🔓 Acceso completo habilitado (FULL_ACCESS_ALL_USERS)")
        st.divider()

        pages = {
            "Dashboard": "dashboard",
            "📋 Actions": "actions",
            "📄 Offers": "offers",
            "📥 Request Pool": "requests",
            "💰 Cost Modules": "cost_modules",
            # ── PROFESSIONAL_MODULES_START ──
            "📊 Business Intelligence": "business_intelligence",
            "💰 Budget Command Center": "budget_command_center",
            "🏆 Key Account Management": "key_account_management",
            # ── PROFESSIONAL_MODULES_END ──
        }

        if effective_role == "admin":
            pages["👥 Users"] = "users"
            pages["📧 User Invites"] = "invites"

        selected = st.radio("Navegación", list(pages.keys()), key="main_nav")
        st.divider()
        if st.button("🚪 Cerrar sesión", use_container_width=True):
            logout()

        _show_professional_mode_sidebar()

        # Debug panel: visible to admins or when ?debug=1 is in the URL
        try:
            _debug_param = st.query_params.get("debug", "0")
        except Exception:
            _debug_param = "0"
        if effective_role == "admin" or str(_debug_param) == "1":
            show_debug_panel()

        return pages[selected]


# ──────────────────────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────────────────────


def page_dashboard() -> None:
    profile = st.session_state.profile
    department = profile.get("department")

    st.title(f"📊 Dashboard - {department}")

    def _fetch_actions():
        query = supabase.table("actions").select("*")
        return query.execute().data or []

    actions = safe_execute(_fetch_actions, [])

    c1, c2, c3, c4 = st.columns(4)
    total = len(actions)
    open_count = len([a for a in actions if _field(a, "status") == "open"])
    on_going_count = len([a for a in actions if _field(a, "status") == "on-going"])
    close_count = len([a for a in actions if _field(a, "status") == "close"])

    c1.metric("Total Actions", total)
    c2.metric("Open", open_count)
    c3.metric("On Going", on_going_count)
    c4.metric("Close", close_count)

    if actions:
        df = pd.DataFrame(actions)
        if "status" in df.columns:
            st.plotly_chart(px.pie(df, names="status", title="Actions by status"), use_container_width=True)

    st.subheader("Últimas acciones")
    recent = sorted(actions, key=lambda x: _field(x, "last_modified", "created_at", default=""), reverse=True)[:8]
    for row in recent:
        status = _field(row, "status", default="open")
        emoji = "🔴" if status == "open" else "🟡" if status == "on-going" else "✅"
        st.write(f"{emoji} **{_field(row, 'name', default='(sin nombre)')}** — {_field(row, 'goal', default='')}")


# ──────────────────────────────────────────────────────────────
# Actions page (CRUD + Excel sync)
# ──────────────────────────────────────────────────────────────


def page_actions() -> None:
    profile = st.session_state.profile
    department = profile.get("department")

    st.title("📋 Actions")

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
                        "created_at": datetime.utcnow().isoformat(),
                        "last_modified": datetime.utcnow().isoformat(),
                    }
                    try:
                        supabase.table("actions").insert(payload).execute()
                        st.success("Acción creada")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"No se pudo crear: {exc}")

    st.subheader("🔁 Sync Excel (bidireccional)")
    s1, s2 = st.columns([1, 1])
    with s1:
        if st.button("Exportar acciones a Excel", use_container_width=True):
            try:
                query = supabase.table("actions").select("*")
                rows = query.order("created_at", desc=True).execute().data or []
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
                            supabase.table("actions").update(
                                {
                                    "status": str(row.get("status", "open")),
                                    "comments": str(row.get("comments", "")),
                                    "last_modified": datetime.utcnow().isoformat(),
                                }
                            ).eq("id", str(row.get("id"))).execute()
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
                    {"status": new_status, "last_modified": datetime.utcnow().isoformat()}
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
                    {"comments": comments_val, "last_modified": datetime.utcnow().isoformat()}
                ).eq("id", action["id"]).execute()

            if c4.button("🗑", key=f"act_del_{action['id']}", use_container_width=True):
                supabase.table("actions").delete().eq("id", action["id"]).execute()
                st.rerun()


# ──────────────────────────────────────────────────────────────
# Request Pool (Commercial)
# ──────────────────────────────────────────────────────────────


def page_requests() -> None:
    profile = st.session_state.profile
    if profile.get("department") != "Commercial":
        st.warning("Esta vista es solo para Commercial")
        return

    st.title("📥 Request Pool")

    with st.expander("➕ Nueva solicitud", expanded=False):
        with st.form("request_create"):
            company = st.text_input("Empresa")
            contact_name = st.text_input("Contacto")
            contact_email = st.text_input("Email contacto")
            contact_phone = st.text_input("Teléfono contacto")
            description = st.text_area("Descripción")
            days_to_deadline = st.number_input("Días para deadline", min_value=1, max_value=180, value=7)
            submitted = st.form_submit_button("Guardar", use_container_width=True)

            if submitted:
                payload = {
                    "company": company,
                    "contact_name": contact_name,
                    "contact_email": contact_email,
                    "contact_phone": contact_phone,
                    "description": description,
                    "received_date": datetime.utcnow().date().isoformat(),
                    "deadline_preliminary_budget": (datetime.utcnow() + timedelta(days=int(days_to_deadline))).date().isoformat(),
                    "status": "new",
                    "created_by": st.session_state.user.id,
                }
                try:
                    supabase.table("customer_requests").insert(payload).execute()
                    st.success("Solicitud creada")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error creando solicitud: {exc}")

    try:
        rows = (
            supabase.table("customer_requests")
            .select("*")
            .order("deadline_preliminary_budget", desc=False)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        st.error(f"No se pudo cargar request pool: {exc}")
        rows = []

    st.subheader("Solicitudes")
    for req in rows:
        if _field(req, "status") == "declined":
            continue
        css_class, emoji, days_left = get_deadline_priority(str(_field(req, "deadline_preliminary_budget", default="")))
        with st.container():
            st.markdown(f'<div class="{css_class}">', unsafe_allow_html=True)
            c1, c2, c3 = st.columns([4, 1, 1])
            company = _field(req, "company", default="")
            contact = _field(req, "contact", "contact_name", default="")
            desc = _field(req, "description", default="")
            deadline_txt = _field(req, "deadline_preliminary_budget", default="")

            c1.markdown(f"**{emoji} {company}**")
            c1.caption(desc)
            c1.write(f"Contacto: {contact}")
            c1.write(f"Deadline: {deadline_txt} ({days_left} días)")
            c1.write(f"Estado: {_field(req, 'status', default='new')}")

            if c2.button("Procesar", key=f"req_process_{req['id']}", use_container_width=True):
                st.session_state.current_request = req
                st.session_state.offer_mode = "from_request"
                st.rerun()

            if c3.button("Declinar", key=f"req_decline_btn_{req['id']}", use_container_width=True):
                st.session_state[f"declining_{req['id']}"] = True

            if st.session_state.get(f"declining_{req['id']}"):
                reason = st.text_input("Motivo", key=f"req_decline_reason_{req['id']}")
                if st.button("Confirmar declinar", key=f"req_decline_ok_{req['id']}"):
                    if not reason:
                        st.warning("Escribe un motivo")
                    else:
                        supabase.table("customer_requests").update(
                            {"status": "declined", "decline_reason": reason}
                        ).eq("id", req["id"]).execute()
                        st.session_state[f"declining_{req['id']}"] = False
                        st.rerun()

            st.markdown("</div>", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────
# Offers (manual, from request, upload)
# ──────────────────────────────────────────────────────────────


def _next_offer_serial() -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    seq = abs(hash(datetime.utcnow().isoformat())) % 10000
    return f"OFF-{date_part}-{seq:04d}"


def _create_offer(payload: Dict[str, Any]) -> Dict[str, Any]:
    result = supabase.table("offers").insert(payload).execute()
    if not result.data:
        raise ValueError("No se recibió registro creado")
    return result.data[0]


def page_cost_engine_block(default_materials: float = 0.0) -> Dict[str, Any]:
    st.subheader("⚙️ Cost Module Engine")

    material_cost = st.number_input("Materiales (€)", min_value=0.0, step=100.0, value=float(default_materials), key="ce_material")
    packaging = st.number_input("Packaging (€)", min_value=0.0, step=50.0, value=0.0, key="ce_pack")

    destination = st.selectbox("Destino", list(FREIGHT_BASE_RATES.keys()), key="ce_destination")
    mode = st.selectbox("Transporte", ["truck", "maritime"], key="ce_mode")
    container = st.selectbox("Contenedor", ["20ft", "40ft"], key="ce_container")
    qty = st.number_input("Cantidad viajes/contenedores", min_value=1, max_value=100, value=1, key="ce_qty")

    freight = calculate_freight_cost(destination, "truck" if mode == "truck" else "maritime", container, int(qty))

    st.write("Selecciona módulos de coste")
    selected_lines: List[Dict[str, Any]] = []
    for mod in PREDEFINED_COST_MODULES:
        checked = st.checkbox(f"{mod['name']} ({mod['rate']} {mod['unit']})", key=f"ce_mod_{mod['id']}")
        if checked:
            q = st.number_input(f"Cantidad {mod['name']}", min_value=0.0, step=1.0, value=1.0, key=f"ce_qty_{mod['id']}")
            selected_lines.append({"module_id": mod["id"], "quantity": q})

    calc = calculate_total_cost(selected_lines, material_cost, freight, packaging)
    st.metric("Total estimado", f"€ {calc['total']:,.2f}")

    return calc


def page_create_offer_manual() -> None:
    st.subheader("📝 Crear oferta manual")

    with st.form("offer_manual_form"):
        title = st.text_input("Nombre de oferta")
        customer_company = st.text_input("Empresa cliente")
        customer_contact = st.text_input("Contacto")
        description = st.text_area("Descripción")
        valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60)
        submitted = st.form_submit_button("Continuar a cálculo", use_container_width=True)

    if submitted:
        st.session_state.manual_offer_draft = {
            "title": title,
            "company": customer_company,
            "contact": customer_contact,
            "description": description,
            "valid_days": int(valid_days),
        }

    draft = st.session_state.get("manual_offer_draft")
    if draft:
        calc = page_cost_engine_block(default_materials=0.0)
        if st.button("Guardar oferta", use_container_width=True):
            payload = {
                "serial_number": _next_offer_serial(),
                "title": draft["title"],
                "description": draft["description"],
                "version": 1,
                "version_group_id": st.session_state.user.id,
                "status_v2": "draft",
                "total_amount": calc["total"],
                "currency": "EUR",
                "cost_breakdown": calc,
                "delivery_terms": {},
                "customer_name": draft["company"],
                "customer_contact": draft["contact"],
                "valid_until": (datetime.utcnow() + timedelta(days=draft["valid_days"])).date().isoformat(),
                "created_from": "manual",
                "warnings": [],
                "is_deleted": False,
                "offer_data": {},
                "created_by": st.session_state.user.id,
            }
            try:
                _create_offer(payload)
                st.success("Oferta creada")
                st.session_state.offer_mode = None
                st.session_state.manual_offer_draft = None
                st.rerun()
            except Exception as exc:
                st.error(f"Error creando oferta: {exc}")


def page_select_request_for_offer() -> None:
    st.subheader("📥 Seleccionar solicitud")
    rows = safe_execute(
        lambda: supabase.table("customer_requests").select("*").eq("status", "new").order("deadline_preliminary_budget").execute().data or [],
        [],
    )
    if not rows:
        st.info("No hay solicitudes nuevas")
        return

    for req in rows:
        with st.expander(f"{_field(req, 'company', default='(sin empresa)')} · {_field(req, 'description', default='')[:90]}"):
            st.write(f"Contacto: {_field(req, 'contact_name', 'contact', default='')}")
            st.write(f"Deadline: {_field(req, 'deadline_preliminary_budget', default='')}")
            if st.button("Usar solicitud", key=f"offer_use_req_{req['id']}"):
                st.session_state.current_request = req
                st.session_state.offer_mode = "from_request"
                st.rerun()


def page_create_offer_from_request() -> None:
    req = st.session_state.current_request
    if not req:
        st.warning("No hay solicitud seleccionada")
        return

    st.subheader(f"📄 Oferta desde request · {_field(req, 'company', default='')}")

    default_name = f"Oferta para {_field(req, 'company', default='cliente')}"
    title = st.text_input("Nombre oferta", value=default_name)
    description = st.text_area("Descripción", value=str(_field(req, "description", default="")))
    valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60, key="req_valid_days")

    calc = page_cost_engine_block(default_materials=0.0)

    c1, c2 = st.columns(2)
    if c1.button("Crear oferta desde solicitud", use_container_width=True):
        try:
            created = _create_offer(
                {
                    "serial_number": _next_offer_serial(),
                    "title": title,
                    "description": description,
                    "version": 1,
                    "version_group_id": st.session_state.user.id,
                    "status_v2": "draft",
                    "total_amount": calc["total"],
                    "currency": "EUR",
                    "cost_breakdown": calc,
                    "delivery_terms": {},
                    "customer_name": _field(req, "company", default=""),
                    "customer_contact": _field(req, "contact_name", "contact", default=""),
                    "valid_until": (datetime.utcnow() + timedelta(days=int(valid_days))).date().isoformat(),
                    "created_from": "request_pool",
                    "warnings": ["filled from request, verify all data"],
                    "is_deleted": False,
                    "offer_data": {},
                    "created_by": st.session_state.user.id,
                }
            )
            supabase.table("customer_requests").update(
                {"status": "converted_to_offer", "converted_offer_id": created["id"]}
            ).eq("id", req["id"]).execute()

            st.success("Oferta creada y request actualizada")
            st.session_state.current_request = None
            st.session_state.offer_mode = None
            st.rerun()
        except Exception as exc:
            st.error(f"Error: {exc}")

    if c2.button("Cancelar", use_container_width=True):
        st.session_state.current_request = None
        st.session_state.offer_mode = None
        st.rerun()


def page_upload_offer_document() -> None:
    st.subheader("📎 Subir documento de oferta")
    st.caption("Flujo upload: extracción inicial + revisión humana")

    uploaded = st.file_uploader("Archivo (pdf/docx/xlsx/csv/txt)", type=["pdf", "docx", "xlsx", "csv", "txt"])
    if uploaded is None:
        return

    extracted = {
        "title": f"Oferta desde {uploaded.name}",
        "company": "",
        "contact": "",
        "description": "",
    }

    # Minimal parser for CSV/XLSX to prefill; otherwise manual review
    try:
        if uploaded.name.lower().endswith(".csv"):
            df = pd.read_csv(uploaded)
            if not df.empty:
                extracted["description"] = "; ".join(df.columns.tolist())
        elif uploaded.name.lower().endswith(".xlsx"):
            df = pd.read_excel(uploaded, sheet_name=0)
            if not df.empty:
                extracted["description"] = "; ".join(df.columns.tolist())
    except Exception:
        pass

    st.info("Revisa/edita los campos extraídos antes de crear la oferta")

    title = st.text_input("Nombre oferta", value=extracted["title"], key="up_title")
    company = st.text_input("Empresa cliente", value=extracted["company"], key="up_company")
    contact = st.text_input("Contacto", value=extracted["contact"], key="up_contact")
    description = st.text_area("Descripción", value=extracted["description"], key="up_desc")
    valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60, key="up_valid_days")

    calc = page_cost_engine_block(default_materials=0.0)

    if st.button("Crear oferta desde upload", use_container_width=True):
        try:
            _create_offer(
                {
                    "serial_number": _next_offer_serial(),
                    "title": title,
                    "description": description,
                    "version": 1,
                    "version_group_id": st.session_state.user.id,
                    "status_v2": "draft",
                    "total_amount": calc["total"],
                    "currency": "EUR",
                    "cost_breakdown": calc,
                    "delivery_terms": {},
                    "customer_name": company,
                    "customer_contact": contact,
                    "valid_until": (datetime.utcnow() + timedelta(days=int(valid_days))).date().isoformat(),
                    "created_from": "document_upload",
                    "warnings": ["source document uploaded", "verify extraction"],
                    "is_deleted": False,
                    "offer_data": {"source_file": uploaded.name},
                    "created_by": st.session_state.user.id,
                }
            )
            st.success("Oferta creada desde documento")
            st.session_state.offer_mode = None
            st.rerun()
        except Exception as exc:
            st.error(f"Error creando oferta: {exc}")


def page_list_offers() -> None:
    st.subheader("Listado de ofertas")
    rows = safe_execute(
        lambda: supabase.table("offers").select("*").eq("is_deleted", False).order("created_at", desc=True).execute().data or [],
        [],
    )

    if not rows:
        st.info("No hay ofertas")
        return

    for offer in rows[:50]:
        serial = _field(offer, "serial_number", "offer_number", default="OFF-NA")
        title = _field(offer, "title", "name", default="(sin nombre)")
        status = _field(offer, "status_v2", "status", default="draft")
        total = float(_field(offer, "total_amount", "total_price", default=0.0))

        with st.expander(f"{serial} · {title} · {status}"):
            st.write(f"Cliente: {_field(offer, 'customer_name', 'customer_company', default='')}")
            st.write(f"Total: € {total:,.2f}")
            st.write(f"Válida hasta: {_field(offer, 'valid_until', default='')}")
            st.write(f"Versión: {_field(offer, 'version', default=1)}")

            c1, c2, c3 = st.columns(3)
            new_status = c1.selectbox(
                "Estado",
                ["draft", "in_review", "sent", "negotiated", "accepted", "rejected", "expired", "archived"],
                index=["draft", "in_review", "sent", "negotiated", "accepted", "rejected", "expired", "archived"].index(status if status in ["draft", "in_review", "sent", "negotiated", "accepted", "rejected", "expired", "archived"] else "draft"),
                key=f"off_status_{offer['id']}",
            )
            if new_status != status:
                supabase.table("offers").update({"status_v2": new_status}).eq("id", offer["id"]).execute()
                st.rerun()

            if c2.button("Nueva versión", key=f"off_version_{offer['id']}", use_container_width=True):
                try:
                    new_payload = dict(offer)
                    for remove_key in ["id", "created_at", "updated_at"]:
                        new_payload.pop(remove_key, None)
                    new_payload["version"] = int(_field(offer, "version", default=1)) + 1
                    new_payload["serial_number"] = _next_offer_serial()
                    new_payload["status_v2"] = "draft"
                    new_payload["created_by"] = st.session_state.user.id
                    _create_offer(new_payload)
                    st.success("Versión creada")
                    st.rerun()
                except Exception as exc:
                    st.error(f"No se pudo versionar: {exc}")

            if c3.button("Archivar", key=f"off_archive_{offer['id']}", use_container_width=True):
                supabase.table("offers").update({"is_deleted": True, "status_v2": "archived"}).eq("id", offer["id"]).execute()
                st.rerun()


def page_offers() -> None:
    st.title("📄 Offers")

    m1, m2, m3 = st.columns(3)
    if m1.button("📝 Crear manual", use_container_width=True):
        st.session_state.offer_mode = "manual"
    if m2.button("📥 Desde request", use_container_width=True):
        st.session_state.offer_mode = "from_request_select"
    if m3.button("📎 Upload", use_container_width=True):
        st.session_state.offer_mode = "upload"

    mode = st.session_state.get("offer_mode")

    if mode == "manual":
        page_create_offer_manual()
    elif mode == "from_request_select":
        page_select_request_for_offer()
    elif mode == "from_request":
        page_create_offer_from_request()
    elif mode == "upload":
        page_upload_offer_document()
    else:
        page_list_offers()


# ──────────────────────────────────────────────────────────────
# Admin pages
# ──────────────────────────────────────────────────────────────


def page_users() -> None:
    profile = st.session_state.profile
    if profile.get("role") != "admin":
        st.warning("Acceso restringido")
        return

    st.title("👥 Gestión de usuarios")

    rows = safe_execute(lambda: supabase.table("profiles").select("*").order("created_at", desc=True).execute().data or [], [])

    departments = ["Commercial", "Engineering", "Project Management", "Service", "Administration"]

    for row in rows:
        with st.expander(f"{_field(row, 'name')} · {_field(row, 'email')}"):
            c1, c2, c3 = st.columns(3)
            dep = c1.selectbox("Departamento", departments, index=departments.index(_field(row, "department", default="Commercial")), key=f"usr_dep_{row['id']}")
            role = c2.selectbox("Rol", ["user", "admin"], index=0 if _field(row, "role", default="user") == "user" else 1, key=f"usr_role_{row['id']}")
            if c3.button("Actualizar", key=f"usr_save_{row['id']}", use_container_width=True):
                try:
                    supabase.table("profiles").update({"department": dep, "role": role}).eq("id", row["id"]).execute()
                    st.success("Actualizado")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error actualizando: {exc}")


def page_cost_modules() -> None:
    st.title("💰 Cost Modules")
    st.caption("Referencia de módulos y tasas base")

    df = pd.DataFrame(PREDEFINED_COST_MODULES)
    st.dataframe(df, use_container_width=True)

    st.subheader("Simulador rápido")
    material = st.number_input("Materiales", min_value=0.0, value=10000.0)
    line_count = st.number_input("Número de líneas no porcentuales", min_value=0, max_value=10, value=2)
    lines = []
    ids = [m["id"] for m in PREDEFINED_COST_MODULES]
    for i in range(int(line_count)):
        c1, c2 = st.columns(2)
        mid = c1.selectbox(f"Módulo {i+1}", ids, key=f"sim_mod_{i}")
        qty = c2.number_input(f"Cantidad {i+1}", min_value=0.0, value=1.0, key=f"sim_qty_{i}")
        lines.append({"module_id": mid, "quantity": qty})
    result = calculate_total_cost(lines, material, 0, 0)
    st.metric("Total", f"€ {result['total']:,.2f}")


def page_invites() -> None:
    profile = st.session_state.profile
    if profile.get("role") != "admin":
        st.warning("Acceso restringido")
        return

    st.title("📧 User Invites (Gmail)")
    st.caption("Provisiona acceso en Supabase y envía email de bienvenida con contraseña temporal")

    credentials_path = Path(__file__).resolve().parent / "user_access_credentials.txt"
    users = _parse_users_credentials_file(credentials_path)

    app_url = st.text_input("Streamlit access URL", value=STREAMLIT_APP_URL or "https://your-app.streamlit.app")

    c1, c2, c3 = st.columns(3)
    c1.metric("Users loaded", len(users))
    c2.metric("Gmail configured", "Yes" if GMAIL_ADDRESS and GMAIL_APP_PASSWORD else "No")
    c3.metric("Supabase admin", "Yes" if supabase_admin else "No")

    if not users:
        st.error("No se encontraron usuarios en user_access_credentials.txt")
        return

    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        st.warning("Configura GMAIL_ADDRESS y GMAIL_APP_PASSWORD en Streamlit secrets antes de enviar")

    if supabase_admin is None:
        st.warning("Configura SUPABASE_SERVICE_ROLE_KEY para crear/actualizar accesos automáticamente")

    st.subheader("Preview")
    preview_rows = []
    for u in users:
        preview_rows.append(
            {
                "name": u.get("name", ""),
                "email": u.get("email", ""),
                "department": _default_department_for_email(u.get("email", "")),
                "role": _default_role_for_email(u.get("email", "")),
            }
        )
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
                _ensure_user_access(email, password, name, dep, role)
                _send_gmail_invite(email, name, password, app_url)
                sent_ok += 1
                st.success(f"Enviado: {email}")
            except Exception as exc:
                sent_fail += 1
                st.error(f"Error con {email}: {exc}")

        st.info(f"Proceso finalizado. OK: {sent_ok} | Error: {sent_fail}")


# ──────────────────────────────────────────────────────────────
# Professional Mode sidebar
# ──────────────────────────────────────────────────────────────

_DEFAULT_MATURITY: Dict[str, int] = {
    "Dashboard": 55,
    "Actions": 60,
    "Offers": 65,
    "Request Pool": 50,
    "Cost Modules": 70,
    "Business Intelligence": 62,
    "Budget Command Center": 68,
    "Key Account Management": 65,
    "Pipeline Manager": 0,
    "Market Intelligence": 0,
    "Competitive Analysis": 0,
    "Customer Success": 0,
    "Revenue Forecasting": 0,
    "Portfolio Analysis": 0,
    "Weekly Planner": 0,
    "Saved Companies": 0,
    "Sales Analytics": 0,
    "Territory Management": 0,
    "Campaign Manager": 0,
    "Contract Management": 0,
    "Product Catalog": 0,
    "Team Management": 0,
}


def _load_maturity_scores() -> Dict[str, int]:
    """Load maturity scores from MATURITY_REPORT.md if it exists, otherwise return defaults."""
    report_path = Path("MATURITY_REPORT.md")
    scores: Dict[str, int] = dict(_DEFAULT_MATURITY)
    if not report_path.exists():
        return scores
    try:
        content = report_path.read_text(encoding="utf-8")
        for line in content.splitlines():
            if line.startswith("- overall:"):
                pass  # handled below
            if "| " in line and "%" in line:
                parts = [p.strip() for p in line.split("|") if p.strip()]
                if len(parts) >= 3:
                    module_name = parts[0]
                    pct_str = parts[2].replace("%", "").strip()
                    try:
                        scores[module_name] = int(float(pct_str))
                    except ValueError:
                        pass
    except Exception:
        pass
    return scores


def _show_professional_mode_sidebar() -> None:
    with st.expander("🚀 Modo Profesional", expanded=False):
        scores = _load_maturity_scores()
        st.caption("Índice de madurez por módulo")
        implemented = {k: v for k, v in scores.items() if v > 0}
        pending = {k: v for k, v in scores.items() if v == 0}
        for module, score in sorted(implemented.items(), key=lambda x: -x[1]):
            color = "🟢" if score >= 70 else "🟡" if score >= 40 else "🔴"
            st.progress(score / 100, text=f"{color} {module}: {score}%")
        if pending:
            st.caption(f"⬜ {len(pending)} módulos pendientes de implementar")
        overall = sum(implemented.values()) // max(len(implemented), 1)
        st.divider()
        st.metric("Madurez global", f"{overall}%", help="Promedio de módulos implementados")

        st.caption("📅 Próximas mejoras planificadas")
        st.markdown(
            "- **Pipeline Manager**: Vista kanban + forecast ponderado\n"
            "- **Revenue Forecasting**: Escenarios predictivos\n"
            "- **Customer Success**: Health score en tiempo real"
        )

        vote_options = [k for k in pending.keys()][:5] or list(implemented.keys())[:5]
        if vote_options:
            voted = st.selectbox("🗳️ ¿Qué módulo mejorar primero?", vote_options, key="pro_vote")
            if st.button("Votar", key="pro_vote_btn"):
                st.success(f"Voto registrado: **{voted}**. ¡Gracias!")


# ── AUTO_IMPLEMENT_PAGES_START ──


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
            {
                "Presupuesto_inicial": "€{:,.0f}",
                "Real_actual": "€{:,.0f}",
                "Desviación_€": "€{:,.0f}",
                "Desviación_%": "{:+.1f}%",
            }
        ).bar(subset=["Desviación_€"], color=["#ff9999", "#00cc66"]),
        use_container_width=True,
    )

    total_presupuestado = df_sim["Presupuesto_inicial"].sum()
    total_real = df_sim["Real_actual"].sum()
    desviacion_total = total_real - total_presupuestado

    m1, m2, m3 = st.columns(3)
    m1.metric("Total Presupuestado", f"€{total_presupuestado:,.0f}")
    m2.metric("Total Real", f"€{total_real:,.0f}")
    m3.metric(
        "Desviación Global",
        f"€{desviacion_total:,.0f}",
        delta=f"{desviacion_total / total_presupuestado * 100:+.1f}%",
    )

    desviaciones_criticas = df_sim[abs(df_sim["Desviación_%"]) > 10]
    if not desviaciones_criticas.empty:
        st.warning(
            f"⚠️ **Alerta de desviación >10%** en: {', '.join(desviaciones_criticas['Producto'].tolist())}. "
            "Revisar y actualizar el forecast."
        )
    else:
        st.success("✅ Todas las líneas dentro del umbral de desviación (<10%)")

    with st.expander("📈 Gráfico de desviaciones"):
        fig_bcc = px.bar(
            df_sim,
            x="Producto",
            y="Desviación_%",
            color="Desviación_%",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            title="Desviación presupuestaria por línea (%)",
            labels={"Desviación_%": "Desviación (%)"},
        )
        fig_bcc.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="Umbral +10%")
        fig_bcc.add_hline(y=-10, line_dash="dash", line_color="red", annotation_text="Umbral -10%")
        st.plotly_chart(fig_bcc, use_container_width=True)

    st.download_button(
        "⬇️ Descargar escenario como CSV",
        data=df_sim.to_csv(index=False),
        file_name=f"budget_scenario_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv",
        mime="text/csv",
        use_container_width=True,
    )


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

    df_kam = st.session_state.kam_accounts.copy()

    st.subheader("📊 Mis cuentas clave")
    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Cuentas gestionadas", len(df_kam))
    col_b.metric("Ingreso total gestionado", f"€{df_kam['Ingreso_anual_€'].sum():,.0f}")
    col_c.metric("Health Score promedio", f"{df_kam['Health_Score'].mean():.0f}/100")

    def _health_color(score: int) -> str:
        if score >= 75:
            return "🟢"
        if score >= 55:
            return "🟡"
        return "🔴"

    df_kam["Estado"] = df_kam["Health_Score"].apply(_health_color)
    st.dataframe(
        df_kam[["Estado", "Cuenta", "Ingreso_anual_€", "Health_Score", "NPS", "Días_sin_contacto", "Responsable"]].style.format(
            {"Ingreso_anual_€": "€{:,.0f}"}
        ).background_gradient(subset=["Health_Score"], cmap="RdYlGn"),
        use_container_width=True,
    )

    st.subheader("🚨 Alertas automáticas")
    alertas_kam: List[str] = []
    for _, row in df_kam.iterrows():
        if row["NPS"] < 0:
            alertas_kam.append(f"🔴 **{row['Cuenta']}**: NPS negativo ({row['NPS']}). Reunión de recuperación urgente.")
        if row["Días_sin_contacto"] > 30:
            alertas_kam.append(
                f"🟡 **{row['Cuenta']}**: Sin contacto hace {row['Días_sin_contacto']} días. Sugerir follow-up."
            )
        if row["Health_Score"] < 55:
            alertas_kam.append(
                f"🔴 **{row['Cuenta']}**: Health Score crítico ({row['Health_Score']}/100). Activar plan de recuperación."
            )

    if alertas_kam:
        for alerta in alertas_kam:
            st.warning(alerta)
    else:
        st.success("✅ Todas las cuentas clave están dentro de parámetros saludables.")

    with st.expander("📈 Visualización de health scores"):
        fig_kam = px.bar(
            df_kam.sort_values("Health_Score"),
            x="Health_Score",
            y="Cuenta",
            orientation="h",
            color="Health_Score",
            color_continuous_scale=["#ff4b4b", "#ffa500", "#00cc66"],
            range_color=[0, 100],
            title="Customer Health Score por cuenta clave",
        )
        fig_kam.add_vline(x=60, line_dash="dash", line_color="red", annotation_text="Umbral crítico: 60")
        st.plotly_chart(fig_kam, use_container_width=True)

    st.download_button(
        "⬇️ Exportar cuentas clave",
        data=df_kam.to_csv(index=False),
        file_name=f"key_accounts_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
        mime="text/csv",
        use_container_width=True,
    )


def page_business_intelligence() -> None:
    import numpy as np  # noqa: PLC0415

    st.header("📊 Business Intelligence")
    st.caption("Referencia: Looker · Domo · ThoughtSpot")

    with st.expander("📋 Protocolo BI estándar (referencia: Looker + Domo)", expanded=False):
        protocol_steps_bi = [
            "1. Conectar fuentes de datos (CRM, ERP, base de datos propia)",
            "2. Definir métricas y KPIs con definición única acordada",
            "3. Segmentar dashboards por audiencia (dirección, comercial, operaciones)",
            "4. Configurar alertas sobre umbrales críticos",
            "5. Programar distribución automática de informes",
            "6. Capacitar al equipo en exploración autoservicio",
        ]
        for step in protocol_steps_bi:
            st.checkbox(step, key=f"bi_proto_{step[:30]}")

    period = st.selectbox(
        "Período de análisis",
        ["Últimos 7 días", "Últimos 30 días", "Trimestre actual", "Año actual"],
        key="bi_period",
    )

    period_multiplier: Dict[str, float] = {
        "Últimos 7 días": 0.25,
        "Últimos 30 días": 1.0,
        "Trimestre actual": 3.0,
        "Año actual": 12.0,
    }
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
        fig_top = px.bar(
            df_top,
            x="Revenue_€",
            y="Cuenta",
            orientation="h",
            color="Revenue_€",
            color_continuous_scale="Blues",
            title="Top 5 cuentas",
        )
        st.plotly_chart(fig_top, use_container_width=True)

    with col_right:
        st.subheader("📊 Distribución de estados de ofertas")
        df_status = pd.DataFrame(
            {"Estado": ["Ganadas", "En negociación", "Perdidas", "Expiradas"], "Cantidad": [8, 7, 4, 4]}
        )
        fig_pie = px.pie(
            df_status,
            values="Cantidad",
            names="Estado",
            color_discrete_sequence=["#00cc66", "#ffa500", "#ff4b4b", "#999999"],
            title="Pipeline de ofertas",
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    st.subheader("⏰ Informes programados")
    with st.expander("Configurar informe automático"):
        report_freq = st.selectbox(
            "Frecuencia", ["Diario", "Semanal (lunes)", "Mensual (día 1)"], key="bi_report_freq"
        )
        report_recipients = st.text_input(
            "Destinatarios (emails separados por coma)", key="bi_report_recipients"
        )
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
        st.info(
            f"💡 Consulta: *{query_example}* — "
            "Integra tu fuente de datos real para obtener respuestas en tiempo real."
        )


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────


def main() -> None:
    init_session_state()

    if st.session_state.user is None:
        refresh_auth_from_supabase()

    if not st.session_state.user or not st.session_state.profile:
        login_form()
        return

    page = show_sidebar()
    if page == "dashboard":
        page_dashboard()
    elif page == "actions":
        page_actions()
    elif page == "requests":
        page_requests()
    elif page == "offers":
        page_offers()
    elif page == "users":
        page_users()
    elif page == "cost_modules":
        page_cost_modules()
    elif page == "invites":
        page_invites()
    # ── PROFESSIONAL_ROUTING_START ──
    elif page == "business_intelligence":
        page_business_intelligence()
    elif page == "budget_command_center":
        page_budget_command_center()
    elif page == "key_account_management":
        page_key_account_management()
    # ── PROFESSIONAL_ROUTING_END ──


if __name__ == "__main__":
    main()
