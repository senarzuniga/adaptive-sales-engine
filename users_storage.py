"""
Local user storage — fallback authentication when Supabase is not configured.

Users are stored as JSON files under ``data/users/``.  This module is
intentionally minimal: it covers the demo/local-development case.  For
production on Streamlit Cloud, configure Supabase instead.

NOTE: Streamlit Cloud has an ephemeral filesystem; user accounts created here
will not survive a cold restart.  For persistent multi-user auth, configure
SUPABASE_URL / SUPABASE_KEY in Streamlit secrets.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_USERS_DIR = Path(__file__).resolve().parent / "data" / "users"

# scrypt parameters (OWASP recommended minimum)
_SCRYPT_N = 2**14   # CPU/memory cost
_SCRYPT_R = 8       # block size
_SCRYPT_P = 1       # parallelisation


def _ensure_dir() -> None:
    _USERS_DIR.mkdir(parents=True, exist_ok=True)


def _user_file(email: str) -> Path:
    uid = hashlib.sha256(email.strip().lower().encode()).hexdigest()[:24]
    return _USERS_DIR / f"{uid}.json"


def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Return ``(hash_hex, salt_hex)`` using scrypt."""
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.scrypt(
        password.encode(),
        salt=bytes.fromhex(salt),
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
    )
    return dk.hex(), salt


def _verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Constant-time password verification using scrypt."""
    candidate_hash, _ = _hash_password(password, salt)
    return secrets.compare_digest(candidate_hash, stored_hash)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Public API ────────────────────────────────────────────────────


def create_user(
    email: str,
    name: str = "",
    department: str = "Commercial",
    role: str = "user",
    password: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Create a new local user.

    Returns a dict with ``email`` and ``password`` (plaintext, to be sent
    to the user), or ``None`` if the email already exists.
    """
    _ensure_dir()
    fpath = _user_file(email)
    if fpath.exists():
        return None  # already registered

    if not password:
        password = secrets.token_urlsafe(10)

    pw_hash, pw_salt = _hash_password(password)

    user_data: Dict[str, Any] = {
        "email": email.strip().lower(),
        "name": name,
        "department": department,
        "role": role,
        "password_hash": pw_hash,
        "password_salt": pw_salt,
        "created_at": _utcnow_iso(),
        "last_login": None,
        "workspace": {
            "uploaded_data": None,
            "saved_companies": [],
            "scraped_urls": [],
            "documents": [],
            "settings": {},
        },
    }

    fpath.write_text(json.dumps(user_data, indent=2), encoding="utf-8")
    return {"email": user_data["email"], "password": password, "name": name}


def verify_user(email: str, password: str) -> bool:
    """Return ``True`` when email/password are valid."""
    fpath = _user_file(email)
    if not fpath.exists():
        return False
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        stored_hash = data.get("password_hash", "")
        stored_salt = data.get("password_salt", "")
        if not stored_hash or not stored_salt:
            return False
        return _verify_password(password, stored_hash, stored_salt)
    except Exception:
        return False


def get_user(email: str) -> Optional[Dict[str, Any]]:
    """Return the user record (without password fields) or ``None``."""
    fpath = _user_file(email)
    if not fpath.exists():
        return None
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        # Return a safe copy without password fields
        return {k: v for k, v in data.items() if not k.startswith("password_")}
    except Exception:
        return None


def update_last_login(email: str) -> None:
    fpath = _user_file(email)
    if not fpath.exists():
        return
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        data["last_login"] = _utcnow_iso()
        fpath.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception:
        pass


def load_workspace(email: str) -> Dict[str, Any]:
    """Return the user's workspace dict (empty dict on any error)."""
    fpath = _user_file(email)
    if not fpath.exists():
        return {}
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        return data.get("workspace", {})
    except Exception:
        return {}


def save_workspace(email: str, workspace: Dict[str, Any]) -> bool:
    fpath = _user_file(email)
    if not fpath.exists():
        return False
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        data["workspace"] = workspace
        fpath.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return True
    except Exception:
        return False


def list_users() -> List[Dict[str, Any]]:
    """Return all local users (without password fields)."""
    _ensure_dir()
    users = []
    for fpath in sorted(_USERS_DIR.glob("*.json")):
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
            users.append({k: v for k, v in data.items() if not k.startswith("password_")})
        except Exception:
            pass
    return users


def build_profile_from_local_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a local user record into the same profile shape used by Supabase auth."""
    return {
        "id": hashlib.sha256(user_data["email"].encode()).hexdigest()[:24],
        "email": user_data["email"],
        "name": user_data.get("name", ""),
        "department": user_data.get("department", "Commercial"),
        "role": user_data.get("role", "user"),
        "created_at": user_data.get("created_at", ""),
        "_local_auth": True,
    }
