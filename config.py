"""
Application configuration — reads from environment variables and Streamlit secrets.

Import this module wherever configuration values are needed.  It does NOT import
Streamlit at module level, so it is safe to use from CLI scripts and tests.
"""
from __future__ import annotations

import os
from pathlib import Path

# Root directory of the project (same as APP_ROOT in the old monolith)
APP_ROOT: Path = Path(__file__).resolve().parent


# ──────────────────────────────────────────────────────────────
# Secret helpers
# ──────────────────────────────────────────────────────────────


def _get_secret(*names: str) -> str:
    """Return the first non-empty value found in env vars or Streamlit secrets."""
    for name in names:
        env_val = os.getenv(name)
        if env_val:
            return env_val
        try:
            import streamlit as st  # noqa: PLC0415
            secret_val = st.secrets.get(name, "")
            if secret_val:
                return str(secret_val)
        except Exception:
            pass
    return ""


def get_bool_secret(key: str, default: bool = False) -> bool:
    """Robustly parse a boolean secret regardless of storage format."""
    try:
        env_val = os.getenv(key)
        if env_val is not None:
            return env_val.strip().lower() in ("true", "1", "yes")
        import streamlit as st  # noqa: PLC0415
        value = st.secrets.get(key, default)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes")
        return bool(value)
    except Exception:
        return default


# ──────────────────────────────────────────────────────────────
# Credentials
# ──────────────────────────────────────────────────────────────

SUPABASE_URL: str = _get_secret("SUPABASE_URL", "VITE_SUPABASE_URL")
SUPABASE_KEY: str = _get_secret(
    "SUPABASE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
)
SUPABASE_SERVICE_ROLE_KEY: str = _get_secret("SUPABASE_SERVICE_ROLE_KEY")

GMAIL_ADDRESS: str = _get_secret("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD: str = _get_secret("GMAIL_APP_PASSWORD")
STREAMLIT_APP_URL: str = _get_secret("STREAMLIT_APP_URL")

# ──────────────────────────────────────────────────────────────
# Feature flags
# ──────────────────────────────────────────────────────────────

QUICK_ACCESS_ENABLED: bool = get_bool_secret("QUICK_ACCESS_ENABLED", default=True)
FULL_ACCESS_ALL_USERS: bool = get_bool_secret("FULL_ACCESS_ALL_USERS")

# ──────────────────────────────────────────────────────────────
# Optional-dependency flags (detected at import time)
# ──────────────────────────────────────────────────────────────

try:
    from supabase import create_client as _  # noqa: F401
    _SUPABASE_LIB: bool = True
except ImportError:
    _SUPABASE_LIB = False

SUPABASE_CONFIGURED: bool = bool(SUPABASE_URL and SUPABASE_KEY and _SUPABASE_LIB)

try:
    import pytesseract as _  # noqa: F401
    from PIL import Image as _  # noqa: F401
    OCR_AVAILABLE: bool = True
except ImportError:
    OCR_AVAILABLE = False

try:
    from docx import Document as _  # noqa: F401
    DOCX_AVAILABLE: bool = True
except ImportError:
    DOCX_AVAILABLE = False

try:
    from pypdf import PdfReader as _  # noqa: F401
    PDF_AVAILABLE: bool = True
except ImportError:
    PDF_AVAILABLE = False

# ──────────────────────────────────────────────────────────────
# UI constants
# ──────────────────────────────────────────────────────────────

MAX_DATAFRAME_ROWS: int = 100_000
MAX_AGENT_TABS: int = 12
MAX_AGENT_OUTPUT_PREVIEW: int = 500
AVG_OPPS_PER_ACCOUNT: int = 3
