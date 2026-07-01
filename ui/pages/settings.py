"""Settings — lightweight configuration UI for organizations, vector store and providers."""
from __future__ import annotations

from typing import Any, Dict

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


def page_settings() -> None:
    st.title("⚙️ Settings")

    reg = _load_registry()

    st.subheader("Organization / Registry")
    st.write(reg.get("default_organization", "(no definido)"))

    st.subheader("Operational rules")
    st.markdown(
        "- Every PR must increase operational value.\n- Lightweight enforcement via PR template recommended."
    )

    st.subheader("Vector store / AI providers (placeholders)")
    vect = reg.get("vector_store", {})
    provider = st.text_input("Provider", value=vect.get("provider", "local"))
    conn = st.text_input("Connection / URL", value=vect.get("url", ""))
    if st.button("Save providers"):
        reg.setdefault("vector_store", {})["provider"] = provider
        reg.setdefault("vector_store", {})["url"] = conn
        if _save_registry(reg):
            st.success("Providers saved")
