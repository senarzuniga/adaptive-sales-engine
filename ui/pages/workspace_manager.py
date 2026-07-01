"""Workspace Manager — manage local folders and authorized locations."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import streamlit as st

from config import APP_ROOT


REG_PATH = APP_ROOT / "Architecture" / "EnterpriseHub" / "enterprise_registry.yaml"


def _load_registry() -> Dict[str, Any]:
    try:
        import yaml

        if not REG_PATH.exists():
            return {}
        return yaml.safe_load(REG_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _save_registry(data: Dict[str, Any]) -> bool:
    try:
        import yaml
        REG_PATH.parent.mkdir(parents=True, exist_ok=True)
        REG_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        return True
    except Exception:
        return False


def page_workspace_manager() -> None:
    st.title("🗂️ Workspace Manager")

    reg = _load_registry()
    workspaces: List[str] = reg.get("workspaces", []) or []

    st.subheader("Authorized locations")
    if workspaces:
        for p in workspaces:
            cols = st.columns([6, 1])
            cols[0].write(str(p))
            if cols[1].button("Remove", key=f"rm_ws_{p}"):
                reg["workspaces"] = [x for x in workspaces if x != p]
                if _save_registry(reg):
                    st.success("Ubicación eliminada")
                    st.rerun()
    else:
        st.info("No hay ubicaciones autorizadas registradas.")

    st.divider()
    st.subheader("Add authorized location")
    with st.form("add_ws"):
        path_input = st.text_input("Carpeta absoluta o relativa al repo", value=str(APP_ROOT), key="ws_path")
        submitted = st.form_submit_button("Agregar")
        if submitted:
            p = Path(path_input)
            if not p.exists():
                st.error("La carpeta no existe en el sistema de archivos del host")
            else:
                rel = str(p) if p.is_absolute() else str(p)
                reg.setdefault("workspaces", []).append(rel)
                if _save_registry(reg):
                    st.success("Ubicación autorizada agregada")
                    st.rerun()

    st.divider()
    st.subheader("Quick view — local folders")
    cols = st.columns([1, 3])
    base = APP_ROOT
    try:
        entries = [e for e in sorted(base.iterdir()) if e.is_dir() and not e.name.startswith('.')][:40]
    except Exception:
        entries = []
    for e in entries:
        st.write(f"• {e.name} — {e}")
