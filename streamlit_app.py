"""
ADAPTIVE SALES ENGINE - STREAMLIT INTERFACE
Multi-user access with Supabase Auth + shared Supabase DB.
Sidebar reorganized per spec. Universal data upload.
Maximum Agent Orchestration: all agents execute on every user action.
"""

from __future__ import annotations

import io
import logging
import os
import re
import smtplib
import subprocess
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

# ── Maximum Orchestrator ──────────────────────────────────────────
try:
    from orchestrator import get_max_orchestrator
    _ORCHESTRATOR_AVAILABLE = True
except Exception as _orch_exc:
    _ORCHESTRATOR_AVAILABLE = False
    logging.getLogger(__name__).warning("MaximumOrchestrator not available: %s", _orch_exc)

try:
    from modules.template_generator import get_template_bytes, template_info
    _TEMPLATES_AVAILABLE = True
except Exception:
    _TEMPLATES_AVAILABLE = False

# ── Optional heavy imports ────────────────────────────────────────
try:
    from supabase import Client, create_client
    _SUPABASE_LIB = True
except ImportError:
    _SUPABASE_LIB = False
    Client = None  # type: ignore[assignment,misc]

try:
    import pytesseract
    from PIL import Image as _PILImage
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    from docx import Document as _DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

try:
    from pypdf import PdfReader as _PdfReader
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


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

# Whether Supabase is fully operational (library + credentials)
SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_KEY and _SUPABASE_LIB)

# ── Startup logging ───────────────────────────────────────────
_logger = logging.getLogger(__name__)
_logger.info("=== Adaptive Sales Engine startup ===")
_logger.info("SUPABASE_CONFIGURED=%s", SUPABASE_CONFIGURED)
_logger.info("Feature flags: quick_access=%s full_access=%s", QUICK_ACCESS_ENABLED, FULL_ACCESS_ALL_USERS)
_logger.info("Gmail configured=%s", bool(GMAIL_ADDRESS and GMAIL_APP_PASSWORD))
try:
    _secrets_count = len(list(st.secrets.keys())) if hasattr(st, "secrets") else 0
    _logger.info("Secrets store: %d key(s) loaded", _secrets_count)
except Exception as _e:
    _logger.warning("Could not access st.secrets: %s", _e)

# NOTE: We no longer call st.stop() when Supabase is not configured.
# The app runs in "demo mode" — features requiring Supabase display a warning
# instead of blocking the entire application.


@st.cache_resource
def get_supabase():
    if not SUPABASE_CONFIGURED:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)  # type: ignore[name-defined]


@st.cache_resource
def get_supabase_admin():
    if not SUPABASE_CONFIGURED or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)  # type: ignore[name-defined]
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
    defaults: Dict[str, Any] = {
        "user": None,
        "session": None,
        "profile": None,
        "current_request": None,
        "offer_mode": None,
        "show_offer_builder": False,
        "is_quick_access": False,
        "active_page": "Dashboard",
        "uploaded_data_universal": None,
        "agent_output": None,
        "manual_offer_draft": None,
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


def login_form() -> None:
    st.title("⚙️ Adaptive Sales Engine")
    st.caption("Sistema de gestión comercial multi-usuario — INGECART")

    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        if not SUPABASE_CONFIGURED:
            st.warning(
                "⚠️ Supabase no configurado. "
                "Usa **Quick Access** para acceder en modo demo."
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
                    elif not SUPABASE_CONFIGURED or supabase is None:
                        st.error("Supabase no configurado. Usa Quick Access.")
                    else:
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

            # Quick Access — shown when Supabase is missing or flag is enabled
            st.divider()
            if QUICK_ACCESS_ENABLED or not SUPABASE_CONFIGURED:
                st.caption("⚡ Acceso rápido habilitado")
                if st.button("⚡ Quick Access (invitado)", use_container_width=True, key="quick_access_btn"):
                    _quick_access_login()
            else:
                st.caption("ℹ️ Quick Access no está habilitado (QUICK_ACCESS_ENABLED no configurado)")

        with t2:
            with st.form("register_form", clear_on_submit=False):
                reg_email = st.text_input("Email", key="reg_email")
                reg_name = st.text_input("Nombre completo", key="reg_name")
                reg_department = st.selectbox(
                    "Departamento",
                    ["Commercial", "Engineering", "Project Management", "Service", "Administration"],
                    key="reg_department",
                )
                reg_password = st.text_input("Contraseña", type="password", key="reg_password")
                reg_confirm = st.text_input("Confirmar contraseña", type="password", key="reg_confirm")
                reg_submitted = st.form_submit_button("Registrarse", use_container_width=True)
                if reg_submitted:
                    if not SUPABASE_CONFIGURED or supabase is None:
                        st.error("Supabase no configurado.")
                    elif reg_password != reg_confirm:
                        st.error("Las contraseñas no coinciden")
                    elif len(reg_password) < 6:
                        st.error("La contraseña debe tener al menos 6 caracteres")
                    elif not reg_email or not reg_name:
                        st.error("Completa email y nombre")
                    else:
                        try:
                            response = supabase.auth.sign_up(
                                {
                                    "email": reg_email,
                                    "password": reg_password,
                                    "options": {
                                        "data": {
                                            "name": reg_name,
                                            "department": reg_department,
                                            "role": "user",
                                        }
                                    },
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
                                            "email": reg_email,
                                            "name": reg_name,
                                            "department": reg_department,
                                            "role": "user",
                                        }
                                    ).execute()
                                except Exception:
                                    pass
                                st.success(
                                    "Registro exitoso. "
                                    "Si hay confirmación por email, actívala y luego inicia sesión."
                                )
                        except Exception as exc:
                            st.error(f"Error al registrar: {exc}")


def logout() -> None:
    if not st.session_state.get("is_quick_access") and supabase:
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    for k in ["user", "session", "profile", "current_request", "offer_mode", "show_offer_builder", "is_quick_access"]:
        st.session_state[k] = None if k not in ("show_offer_builder", "is_quick_access") else False
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
    """Render a collapsible debug panel showing secrets / flag state."""
    with st.expander("🛠️ Debug Panel", expanded=False):
        st.markdown("### Feature flags")
        st.json(
            {
                "QUICK_ACCESS_ENABLED": QUICK_ACCESS_ENABLED,
                "FULL_ACCESS_ALL_USERS": FULL_ACCESS_ALL_USERS,
                "SUPABASE_CONFIGURED": SUPABASE_CONFIGURED,
                "OCR_AVAILABLE": OCR_AVAILABLE,
                "DOCX_AVAILABLE": DOCX_AVAILABLE,
                "PDF_AVAILABLE": PDF_AVAILABLE,
            }
        )
        st.markdown("### Current session")
        profile = st.session_state.get("profile") or {}
        st.json(
            {
                "user_id": profile.get("id"),
                "email": profile.get("email"),
                "role": profile.get("role"),
                "department": profile.get("department"),
                "is_quick_access": st.session_state.get("is_quick_access", False),
                "active_page": st.session_state.get("active_page"),
                "data_loaded": st.session_state.get("uploaded_data_universal") is not None,
            }
        )


# ──────────────────────────────────────────────────────────────
# Common UI helpers
# ──────────────────────────────────────────────────────────────


def get_deadline_priority(deadline_text: str) -> tuple:
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
# Sidebar / navigation  (reorganized per spec)
# ──────────────────────────────────────────────────────────────

APP_ROOT = Path(__file__).resolve().parent

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
# Universal data parser
# ──────────────────────────────────────────────────────────────

MAX_DATAFRAME_ROWS = 100_000


def _is_safe_url(url: str) -> bool:
    """Return True only for http/https URLs pointing to non-private hosts."""
    import ipaddress
    import socket
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname or ""
    if not hostname:
        return False
    # Reject obviously local hostnames
    if hostname in ("localhost", "0.0.0.0"):
        return False
    try:
        # Resolve hostname to IP and check if it is private / loopback / link-local
        addr = ipaddress.ip_address(socket.gethostbyname(hostname))
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            return False
    except Exception:
        # If we cannot resolve, err on the side of caution
        return False
    return True


def parse_file_to_df(file_name: str, file_bytes: bytes) -> Optional[pd.DataFrame]:
    """Convert virtually ANY uploaded file to a pandas DataFrame."""
    fname = file_name.lower()
    df: Optional[pd.DataFrame] = None
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif fname.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        elif fname.endswith(".tsv"):
            df = pd.read_csv(io.BytesIO(file_bytes), sep="\t")
        elif fname.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(file_bytes))
        elif fname.endswith(".feather"):
            df = pd.read_feather(io.BytesIO(file_bytes))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(file_bytes))
        elif fname.endswith(".jsonl"):
            df = pd.read_json(io.BytesIO(file_bytes), lines=True)
        elif fname.endswith(".txt"):
            text = file_bytes.decode("utf-8", errors="replace")
            lines = text.splitlines()
            df = pd.DataFrame({"linea": lines, "longitud": [len(ln) for ln in lines]})
        elif fname.endswith(".md"):
            text = file_bytes.decode("utf-8", errors="replace")
            df = pd.DataFrame({"linea_markdown": text.splitlines()})
        elif fname.endswith((".html", ".xml")):
            text = file_bytes.decode("utf-8", errors="replace")
            df = pd.DataFrame({"linea": text.splitlines()})
        elif fname.endswith(".pdf"):
            if PDF_AVAILABLE:
                reader = _PdfReader(io.BytesIO(file_bytes))
                texts = [page.extract_text() or "" for page in reader.pages]
                df = pd.DataFrame({"pagina": range(1, len(texts) + 1), "texto": texts})
            else:
                df = pd.DataFrame({"error": ["pypdf not installed — pip install pypdf"]})
        elif fname.endswith(".docx"):
            if DOCX_AVAILABLE:
                doc = _DocxDocument(io.BytesIO(file_bytes))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                df = pd.DataFrame({"parrafo": paragraphs})
            else:
                df = pd.DataFrame({"error": ["python-docx not installed"]})
        elif fname.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
            if OCR_AVAILABLE:
                image = _PILImage.open(io.BytesIO(file_bytes))
                text = pytesseract.image_to_string(image)
                df = pd.DataFrame({"texto_extraido": text.splitlines()})
            else:
                df = pd.DataFrame(
                    {"info": ["Imagen recibida (OCR no disponible)"],
                     "nombre_archivo": [file_name]}
                )
        elif fname.endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                all_dfs: List[pd.DataFrame] = []
                for inner_name in z.namelist():
                    if inner_name.endswith("/"):
                        continue
                    with z.open(inner_name) as inner_file:
                        inner_bytes = inner_file.read()
                        inner_df = parse_file_to_df(inner_name, inner_bytes)
                        if inner_df is not None:
                            inner_df["archivo_origen"] = inner_name
                            all_dfs.append(inner_df)
                if all_dfs:
                    df = pd.concat(all_dfs, ignore_index=True)
        elif fname.endswith((".db", ".sqlite")):
            import sqlite3
            import tempfile
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                conn = sqlite3.connect(tmp_path)
                tables = pd.read_sql(
                    "SELECT name FROM sqlite_master WHERE type='table'", conn
                )
                if not tables.empty:
                    first_table = str(tables.iloc[0]["name"])
                    # Validate table name is a safe identifier before using in SQL
                    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', first_table):
                        raise ValueError(f"Unsafe table name: {first_table!r}")
                    # Double-quote is standard SQLite identifier quoting
                    df = pd.read_sql(f'SELECT * FROM "{first_table}"', conn)
                    df["_tabla_origen"] = first_table
                conn.close()
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
    except Exception as exc:
        df = pd.DataFrame({"error": [str(exc)], "archivo": [file_name]})

    if df is not None and len(df) > MAX_DATAFRAME_ROWS:
        st.warning(f"⚠️ El archivo tiene {len(df):,} filas. Truncado a {MAX_DATAFRAME_ROWS:,}.")
        df = df.head(MAX_DATAFRAME_ROWS)
    return df


# ──────────────────────────────────────────────────────────────
# Agent helpers
# ──────────────────────────────────────────────────────────────


def list_agents_from_folder() -> List[str]:
    agent_files: List[str] = []
    for folder in ("agents", "ai-factory-v2"):
        folder_path = APP_ROOT / folder
        if folder_path.exists():
            for py_file in sorted(folder_path.glob("*.py")):
                if py_file.name != "__init__.py":
                    agent_files.append(f"{folder}/{py_file.name}")
    return agent_files


def run_agent(agent_path: str, data: Optional[pd.DataFrame] = None) -> str:
    # Validate agent path is within an allowed directory to prevent path traversal
    _allowed_roots = [APP_ROOT / "agents", APP_ROOT / "ai-factory-v2", APP_ROOT / "scripts"]
    full_path = (APP_ROOT / agent_path).resolve()
    # Use is_relative_to for robust path traversal prevention (Python 3.9+)
    if not any(full_path.is_relative_to(r.resolve()) for r in _allowed_roots):
        return f"❌ Ruta de agente no permitida: {agent_path}"
    if not full_path.exists():
        return f"❌ Agente no encontrado: {agent_path}"
    if full_path.suffix != ".py":
        return f"❌ Solo se permiten scripts Python (.py): {agent_path}"
    outputs_dir = APP_ROOT / "outputs"
    outputs_dir.mkdir(exist_ok=True)
    env = os.environ.copy()
    env["PYTHONPATH"] = str(APP_ROOT)
    if data is not None:
        tmp_csv = outputs_dir / "agent_input.csv"
        data.to_csv(tmp_csv, index=False)
        env["AGENT_INPUT_FILE"] = str(tmp_csv)
    try:
        result = subprocess.run(
            [sys.executable, str(full_path)],
            capture_output=True, text=True, timeout=30,
            env=env, cwd=str(APP_ROOT),
        )
        output = result.stdout or ""
        if result.stderr:
            output += f"\n[stderr]: {result.stderr[:500]}"
        if not output.strip():
            output = f"✅ Ejecutado sin salida (exit code {result.returncode})"
        out_file = outputs_dir / f"{full_path.stem}_output.txt"
        out_file.write_text(output, encoding="utf-8")
        return output
    except subprocess.TimeoutExpired:
        return "⏱️ Timeout: el agente tardó más de 30 segundos"
    except Exception as exc:
        return f"❌ Error ejecutando agente: {exc}"


# ──────────────────────────────────────────────────────────────
# Maximum Orchestration helper (used by every page)
# ──────────────────────────────────────────────────────────────

# Maximum number of agent tabs to show in the UI (Streamlit has soft tab limits)
_MAX_AGENT_TABS = 12
# Max characters to display for agent text output preview
_MAX_AGENT_OUTPUT_PREVIEW = 500
# Average after-sales opportunities per installed-base account (heuristic)
_AVG_OPPS_PER_ACCOUNT = 3


def _build_context(action: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Build a standard context dict for the orchestrator."""
    ctx: Dict[str, Any] = {
        "action": action,
        "uploaded_data": st.session_state.get("uploaded_data_universal"),
        "saved_companies": st.session_state.get("saved_companies", []),
        "estrategia_data": st.session_state.get("estrategia_data"),
        "portfolio_risk": st.session_state.get("portfolio_risk"),
    }
    if extra:
        ctx.update(extra)
    return ctx


def _render_orchestrator_panel(
    action: str,
    button_label: str = "🚀 Ejecutar análisis con TODOS los agentes",
    auto_run: bool = False,
    extra_context: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Renders the orchestrator run button (or runs automatically if auto_run=True).
    Returns the full results dict if executed, else None.
    """
    if not _ORCHESTRATOR_AVAILABLE:
        st.warning("⚠️ Orchestrator no disponible. Verifica orchestrator.py en la raíz.")
        return None

    orch = get_max_orchestrator()
    n_agents = len(orch.agents)
    results: Optional[Dict[str, Any]] = None

    if auto_run:
        context = _build_context(action, extra_context)
        with st.spinner(f"⚡ Ejecutando {n_agents} agentes en paralelo…"):
            results = orch.execute_all_agents(context)
    else:
        if st.button(
            f"{button_label}  ({n_agents} agentes)",
            type="primary",
            use_container_width=True,
            key=f"orch_btn_{action}",
        ):
            context = _build_context(action, extra_context)
            with st.spinner(f"⚡ Ejecutando {n_agents} agentes en paralelo…"):
                results = orch.execute_all_agents(context)

    if results:
        st.session_state["last_analysis_results"] = results
        st.session_state["last_analysis_action"] = action
        _render_orchestration_results(results)

    return results


def _render_orchestration_results(results: Dict[str, Any]) -> None:
    """Renders summary + per-agent tabs."""
    summary = results.get("_summary", "")
    if summary:
        st.markdown(summary)

    agent_names = [k for k in results if not k.startswith("_")]
    if not agent_names:
        return

    st.subheader("📁 Outputs detallados por agente")
    # Limit to _MAX_AGENT_TABS tabs to avoid Streamlit tab overflow
    display_names = agent_names[:_MAX_AGENT_TABS]
    if len(agent_names) > _MAX_AGENT_TABS:
        st.caption(f"Mostrando {_MAX_AGENT_TABS} de {len(agent_names)} agentes. Ver Agent Hub para todos.")

    tabs = st.tabs(display_names)
    for tab, name in zip(tabs, display_names):
        with tab:
            output = results[name]
            if isinstance(output, dict):
                status = output.get("status", "")
                if status in ("error", "load_error", "timeout"):
                    st.error(output.get("error") or output.get("output", "Error"))
                else:
                    agent_out = output.get("output")
                    if agent_out:
                        st.success(str(agent_out)[:_MAX_AGENT_OUTPUT_PREVIEW])
                    insights = output.get("insights") or []
                    if insights:
                        for ins in insights[:5]:
                            st.markdown(f"• {ins}")
                    # Show any special data
                    for special_key in ("tasks", "opportunities", "matrix", "account_maps", "gaps", "critical_clients"):
                        special_val = output.get(special_key)
                        if special_val and isinstance(special_val, list) and special_val:
                            st.dataframe(pd.DataFrame(special_val), use_container_width=True)
                            break
                    with st.expander("Ver JSON completo", expanded=False):
                        safe = {k: v for k, v in output.items() if not isinstance(v, pd.DataFrame)}
                        st.json(safe)
            elif isinstance(output, pd.DataFrame):
                st.dataframe(output, use_container_width=True)
            else:
                st.write(str(output)[:1000])


# ──────────────────────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────────────────────


def page_dashboard() -> None:
    profile = st.session_state.profile or {}
    department = profile.get("department", "")
    st.title(f"📊 Dashboard — {department}")

    if not SUPABASE_CONFIGURED or supabase is None:
        st.info("ℹ️ Supabase no configurado. Mostrando datos de demostración.")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Actions", 0)
        c2.metric("Open", 0)
        c3.metric("On Going", 0)
        c4.metric("Close", 0)
        df_loaded = st.session_state.get("uploaded_data_universal")
        if df_loaded is not None:
            st.subheader("Datos cargados en memoria")
            st.dataframe(df_loaded.head(10), use_container_width=True)
        st.divider()
        _render_orchestrator_panel(action="dashboard")
        return

    def _fetch_actions():
        return supabase.table("actions").select("*").execute().data or []

    actions = safe_execute(_fetch_actions, [])

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Actions", len(actions))
    c2.metric("Open",     len([a for a in actions if _field(a, "status") == "open"]))
    c3.metric("On Going", len([a for a in actions if _field(a, "status") == "on-going"]))
    c4.metric("Close",    len([a for a in actions if _field(a, "status") == "close"]))

    if actions:
        df = pd.DataFrame(actions)
        if "status" in df.columns:
            st.plotly_chart(px.pie(df, names="status", title="Actions by status"), use_container_width=True)

    st.subheader("Últimas acciones")
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
            f"{_field(row, 'goal', default='')}"
        )
    st.divider()
    _render_orchestrator_panel(action="dashboard")


# ──────────────────────────────────────────────────────────────
# Portfolio Analysis
# ──────────────────────────────────────────────────────────────


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
                use_container_width=True,
            )
        if cat_cols and numeric_cols:
            st.plotly_chart(
                px.bar(df, x=cat_cols[0], y=numeric_cols[0],
                       title=f"Bar: {cat_cols[0]} / {numeric_cols[0]}"),
                use_container_width=True,
            )
    else:
        st.info("Sube datos en **Data Upload** para visualizarlos aquí.")
    st.divider()
    _render_orchestrator_panel(action="portfolio_analysis")


def page_placeholder(title: str, icon: str = "🚧", action: str = "") -> None:
    st.title(f"{icon} {title}")
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        st.info(f"📊 Datos disponibles: {df.shape[0]:,} filas × {df.shape[1]} columnas")
    else:
        st.info("💡 Sube datos en **Data Upload** para activar análisis completo.")
    st.divider()
    _render_orchestrator_panel(action=action or title.lower().replace(" ", "_").replace("º", ""))


# ──────────────────────────────────────────────────────────────
# 7-Pillar Pages (orchestrator-powered)
# ──────────────────────────────────────────────────────────────


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
            st.dataframe(df.head(8), use_container_width=True)
    else:
        st.info("📂 Sube datos en **Data Upload** o **Company Setup** para análisis 360º.")
    st.divider()
    _render_orchestrator_panel(action="360_analysis")


def page_sales_architecture() -> None:
    st.title("🏗️ Sales Architecture — Arquitectura Comercial Global")
    st.markdown(
        "**Pilar 1** — Diseño del sistema comercial: segmentación, cobertura territorial, "
        "modelo de canales y estructura de la fuerza de ventas."
    )
    df = st.session_state.get("uploaded_data_universal")
    if df is not None:
        # Quick segmentation view
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
                f"~{n_accounts * _AVG_OPPS_PER_ACCOUNT} oportunidades post-venta identificables"
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
                px.pie(kam_stats.reset_index(), values="count", names=kam_col,
                       title="Distribución de operaciones por KAM"),
                use_container_width=True,
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
                px.treemap(prod_rev, path=["Familia"], values="Revenue",
                           title="Revenue por Familia"),
                use_container_width=True,
            )
    st.divider()
    _render_orchestrator_panel(action="product_strategy")


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
                px.bar(agg.reset_index(), x=col_x, y=col_y,
                       title=f"{col_y} por {col_x}"),
                use_container_width=True,
            )
        if len(numeric_cols) >= 2:
            st.plotly_chart(
                px.scatter_matrix(df[numeric_cols[:4]], title="Matriz de correlación"),
                use_container_width=True,
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
            st.dataframe(pd.DataFrame(tasks), use_container_width=True)
    else:
        st.info("Ejecuta el análisis con todos los agentes para generar el plan semanal.")
    st.divider()
    _render_orchestrator_panel(action="weekly_planner")


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


def page_company_setup() -> None:
    st.title("⚙️ Company Setup — Configuración y Plantillas")
    st.markdown(
        "Descarga las plantillas Excel, súbelas con tus datos y el sistema activará "
        "automáticamente todos los análisis de inteligencia comercial."
    )

    if _TEMPLATES_AVAILABLE:
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
                        use_container_width=True,
                    )
                except Exception as exc:
                    st.error(f"Error generando plantilla: {exc}")
    else:
        # Fallback: download from templates/ directory
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
                        use_container_width=True,
                    )
        else:
            st.warning("Plantillas no disponibles. Instala openpyxl: pip install openpyxl")

    st.divider()
    st.subheader("📤 Subir datos de configuración")
    st.markdown("Sube aquí tus plantillas rellenas. El análisis completo se ejecutará automáticamente.")

    col1, col2 = st.columns(2)
    with col1:
        hist_file = st.file_uploader("📊 Histórico de ventas", type=["xlsx", "csv"], key="setup_hist")
        if hist_file:
            file_bytes = hist_file.read()
            df_hist = parse_file_to_df(hist_file.name, file_bytes)
            if df_hist is not None:
                st.session_state["uploaded_data_universal"] = df_hist
                st.success(f"✅ Histórico: {df_hist.shape[0]:,} filas")

        prod_file = st.file_uploader("📦 Catálogo de productos", type=["xlsx", "csv"], key="setup_prod")
        if prod_file:
            file_bytes = prod_file.read()
            df_prod = parse_file_to_df(prod_file.name, file_bytes)
            if df_prod is not None:
                st.session_state["productos_data"] = df_prod
                st.success(f"✅ Productos: {df_prod.shape[0]:,} registros")

    with col2:
        opp_file = st.file_uploader("🎯 Pipeline de oportunidades", type=["xlsx", "csv"], key="setup_opp")
        if opp_file:
            file_bytes = opp_file.read()
            df_opp = parse_file_to_df(opp_file.name, file_bytes)
            if df_opp is not None:
                st.session_state["oportunidades_data"] = df_opp
                st.success(f"✅ Oportunidades: {df_opp.shape[0]:,} registros")

        strat_file = st.file_uploader("🏆 Plan estratégico", type=["xlsx", "csv"], key="setup_strat")
        if strat_file:
            file_bytes = strat_file.read()
            df_strat = parse_file_to_df(strat_file.name, file_bytes)
            if df_strat is not None:
                st.session_state["estrategia_data"] = df_strat
                st.success(f"✅ Estrategia: {df_strat.shape[0]:,} registros")

    # If any file was uploaded in this session, run orchestrator
    any_uploaded = any([hist_file, prod_file, opp_file, strat_file])
    if any_uploaded:
        st.divider()
        st.subheader("🤖 Análisis automático en curso")
        _render_orchestrator_panel(action="company_setup", auto_run=True)
    else:
        st.divider()
        _render_orchestrator_panel(action="company_setup")


def page_monitoring_dashboard() -> None:
    st.title("📡 Monitoring Dashboard — Estado del Sistema")
    st.markdown("Visión en tiempo real del estado de los agentes, datos cargados y análisis ejecutados.")

    # Agent status
    if _ORCHESTRATOR_AVAILABLE:
        orch = get_max_orchestrator()
        n_agents = len(orch.agents)
        load_errors = sum(1 for a in orch.agents if a.get("load_error"))
    else:
        n_agents = 0
        load_errors = 0

    # Data status
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

    # KPI metrics
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("⚡ Agentes disponibles", n_agents, delta=f"{load_errors} con errores" if load_errors else None)
    col2.metric("📂 Datasets cargados", n_templates, delta="/4 plantillas")
    col3.metric("✅ Último análisis", f"{last_ok}/{last_total}" if last_total else "—")
    col4.metric("🎯 Última acción", last_action[:20] if last_action != "—" else "—")

    st.divider()

    # Agent registry
    if _ORCHESTRATOR_AVAILABLE and n_agents > 0:
        orch = get_max_orchestrator()
        st.subheader(f"🤖 Registro de agentes ({n_agents})")
        agent_rows = []
        for a in orch.agents:
            agent_rows.append({
                "Nombre": a["name"],
                "Carpeta": a["folder"],
                "Estado": "⚠️ Error de carga" if a.get("load_error") else "✅ Listo",
                "Error": (a.get("load_error") or "")[:80],
            })
        st.dataframe(pd.DataFrame(agent_rows), use_container_width=True)

    # Data inventory
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
    st.dataframe(pd.DataFrame(data_rows), use_container_width=True)

    # Last analysis results summary
    if last_results:
        st.subheader("📋 Último análisis ejecutado")
        summary = last_results.get("_summary", "")
        if summary:
            st.markdown(summary)
        failed_names = last_results.get("_failed_agent_names", [])
        if failed_names:
            st.warning(f"Agentes con error: {', '.join(failed_names)}")

    st.divider()
    _render_orchestrator_panel(action="monitoring_refresh")


# ──────────────────────────────────────────────────────────────
# Data Upload (universal)
# ──────────────────────────────────────────────────────────────


def page_data_upload() -> None:
    st.title("📤 Data Upload — Carga Universal")
    st.markdown(
        "**Formatos soportados**: CSV, Excel, TSV, Parquet, Feather, JSON, JSONL, "
        "TXT, Markdown, HTML, XML, PDF, DOCX, ZIP, Imágenes (OCR), SQLite."
    )

    st.subheader("1️⃣ Desde URL")
    url_input = st.text_input(
        "URL de datos (JSON/CSV/XML)", placeholder="https://ejemplo.com/data.csv",
        key="data_url_input",
    )
    if st.button("Cargar desde URL", key="load_url_btn") and url_input:
        # Validate URL to prevent SSRF attacks (scheme + private IP check)
        if not _is_safe_url(url_input):
            st.error(
                "URL no permitida. Solo se aceptan URLs https:// / http:// "
                "hacia hosts públicos (no IPs privadas ni localhost)."
            )
        else:
            try:
                import requests as _requests
                import json as _json
                resp = _requests.get(
                    url_input, timeout=15, allow_redirects=False
                )
                # Follow only one redirect (if any) to a safe destination.
                # Check explicit HTTP redirect status codes (301/302/303/307/308)
                # rather than relying on requests.is_redirect which may miss some codes.
                if resp.status_code in (301, 302, 303, 307, 308):
                    loc = resp.headers.get("Location", "")
                    if loc and _is_safe_url(loc):
                        resp = _requests.get(loc, timeout=15, allow_redirects=False)
                    else:
                        st.error("Redirección bloqueada: destino no permitido")
                        resp = None
                if resp is not None:
                    resp.raise_for_status()
                    url_fname = url_input.split("?")[0].split("/")[-1] or "data.json"
                    df = parse_file_to_df(url_fname, resp.content)
                    if df is None:
                        try:
                            data = _json.loads(resp.text)
                            df = pd.DataFrame(data if isinstance(data, list) else [data])
                        except Exception:
                            df = pd.DataFrame({"linea": resp.text.splitlines()})
                    if df is not None:
                        st.session_state.uploaded_data_universal = df
                        st.success(f"✅ URL cargada: {df.shape[0]:,} filas, {df.shape[1]} columnas")
                        st.dataframe(df.head(5))
                    else:
                        st.error("No se pudo interpretar la respuesta de la URL")
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
            st.session_state.uploaded_data_universal = df
            # Detect and store specific template types
            fname_lower = uploaded_file.name.lower()
            if "estrategia" in fname_lower:
                st.session_state["estrategia_data"] = df
            elif "producto" in fname_lower:
                st.session_state["productos_data"] = df
            st.success(
                f"✅ **{uploaded_file.name}** — {df.shape[0]:,} filas, {df.shape[1]} columnas"
            )
            col1, col2, col3 = st.columns(3)
            col1.metric("Filas", f"{df.shape[0]:,}")
            col2.metric("Columnas", df.shape[1])
            col3.metric("Valores nulos", int(df.isnull().sum().sum()))
            st.subheader("Vista previa")
            st.dataframe(df.head(10), use_container_width=True)
            type_df = pd.DataFrame(
                {"Columna": df.dtypes.index, "Tipo": df.dtypes.values.astype(str)}
            )
            st.dataframe(type_df, use_container_width=True)
            st.download_button(
                "📥 Descargar como CSV",
                df.to_csv(index=False).encode("utf-8"),
                "datos_procesados.csv",
                "text/csv",
            )
            # ── Auto-orchestration after upload ───────────────────
            st.divider()
            st.subheader("🤖 Análisis automático — Todos los agentes")
            _render_orchestrator_panel(
                action="data_upload",
                auto_run=True,
                extra_context={"file_name": uploaded_file.name},
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


# ──────────────────────────────────────────────────────────────
# Agent Hub
# ──────────────────────────────────────────────────────────────


def page_agent_hub() -> None:
    st.title("⚡ Agent Hub — Agentes Autónomos")
    agents = list_agents_from_folder()

    if not agents:
        st.warning("No se encontraron agentes en /agents o /ai-factory-v2")
        st.info("Los agentes deben ser archivos `.py` dentro de `agents/` o `ai-factory-v2/`")
    else:
        st.subheader("Agentes disponibles")
        selected_agent = st.selectbox(
            "Selecciona un agente",
            ["— Seleccionar —"] + agents,
            key="agent_selector",
        )
        df = st.session_state.get("uploaded_data_universal")
        if df is not None:
            st.success(f"✅ Datos disponibles: {df.shape[0]:,} filas × {df.shape[1]} columnas")
        else:
            st.info("ℹ️ Carga datos en **Data Upload** para pasarlos al agente.")

        if selected_agent != "— Seleccionar —":
            st.markdown(f"**Agente:** `{selected_agent}`")
            agent_path_full = APP_ROOT / selected_agent
            if agent_path_full.exists():
                with st.expander("Ver código del agente", expanded=False):
                    code = agent_path_full.read_text(encoding="utf-8", errors="replace")
                    st.code(code[:3000] + ("…" if len(code) > 3000 else ""), language="python")
            if st.button("▶️ Ejecutar agente", type="primary", key="run_agent_btn"):
                with st.spinner(f"Ejecutando {selected_agent}…"):
                    output = run_agent(selected_agent, df)
                st.session_state.agent_output = output
                st.success("✅ Ejecución completada")

    if st.session_state.get("agent_output"):
        st.subheader("Resultado del agente")
        st.text_area(
            "Output", st.session_state.agent_output, height=300, key="agent_output_display"
        )
        st.download_button(
            "📥 Descargar resultado",
            st.session_state.agent_output.encode("utf-8"),
            "agent_output.txt", "text/plain",
        )
        if st.button("🗑️ Limpiar resultado", key="clear_agent_output"):
            st.session_state.agent_output = None
            st.rerun()

    st.divider()
    st.subheader("Estado del orquestador")
    try:
        from agents.self_improving_orchestrator import get_orchestrator
        orch = get_orchestrator()
        if not orch.is_running:
            orch.start()
        st.json(orch.get_status_report())
    except Exception as exc:
        st.caption(f"Orquestador no disponible: {exc}")


# ──────────────────────────────────────────────────────────────
# Actions page (CRUD + Excel sync)
# ──────────────────────────────────────────────────────────────


def page_actions() -> None:
    profile = st.session_state.profile or {}
    department = profile.get("department", "")

    st.title("📋 Commercial Actions Repository")

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
    profile = st.session_state.profile or {}
    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Esta sección requiere conexión a Supabase.")
        return
    if profile.get("department") != "Commercial":
        st.warning("Esta vista es solo para el departamento Commercial")
        return

    st.subheader("📥 Request Pool")

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
    st.title("💼 Offer & Pricing")

    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Funcionalidad completa requiere Supabase.")
        st.subheader("💰 Calculadora de costes (modo demo)")
        page_cost_engine_block()
        return

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
    profile = st.session_state.profile or {}
    if profile.get("role") != "admin" and not FULL_ACCESS_ALL_USERS:
        st.warning("Acceso restringido a administradores")
        return

    st.title("👥 Team Directory")

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
            dep = c1.selectbox("Departamento", departments,
                index=departments.index(_field(row, "department", default="Commercial")),
                key=f"usr_dep_{row['id']}")
            role_val = c2.selectbox("Rol", ["user", "admin"],
                index=0 if _field(row, "role", default="user") == "user" else 1,
                key=f"usr_role_{row['id']}")
            if c3.button("Actualizar", key=f"usr_save_{row['id']}", use_container_width=True):
                try:
                    supabase.table("profiles").update({"department": dep, "role": role_val}).eq(
                        "id", row["id"]
                    ).execute()
                    st.success("Actualizado")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error: {exc}")


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


def page_invites() -> None:
    profile = st.session_state.profile or {}
    if profile.get("role") != "admin" and not FULL_ACCESS_ALL_USERS:
        st.warning("Acceso restringido")
        return

    st.title("📧 Email Cobot — User Invites (Gmail)")
    st.caption("Provisiona acceso en Supabase y envía email de bienvenida con contraseña temporal")

    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Supabase no configurado.")
        return

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
# Page routing map
# ──────────────────────────────────────────────────────────────

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
