"""Organization Manager — minimal CRUD for enterprise_registry.yaml"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import streamlit as st

from config import APP_ROOT


REG_PATH = APP_ROOT / "Architecture" / "EnterpriseHub" / "enterprise_registry.yaml"


def _load_registry() -> Dict[str, Any]:
    if not REG_PATH.exists():
        return {}
    try:
        import yaml

        data = yaml.safe_load(REG_PATH.read_text(encoding="utf-8")) or {}
        return data
    except Exception as exc:  # pragma: no cover - runtime safety
        st.error("PyYAML required or registry unreadable. Run `pip install PyYAML`.")
        st.exception(exc)
        return {}


def _save_registry(data: Dict[str, Any]) -> bool:
    try:
        import yaml

        REG_PATH.parent.mkdir(parents=True, exist_ok=True)
        REG_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        return True
    except Exception as exc:  # pragma: no cover - runtime safety
        st.error("Failed to write registry. Ensure PyYAML is installed and writable path.")
        st.exception(exc)
        return False


def page_organization_manager() -> None:
    st.title("🏢 Organization Manager")

    reg = _load_registry()
    orgs: List[Dict[str, Any]] = reg.get("organizations", []) or []

    st.subheader("Organizaciones registradas")
    if not orgs:
        st.info("No hay organizaciones en el registro. CTA estará disponible por defecto si añades una.")

    for o in orgs:
        cols = st.columns([4, 1, 1])
        cols[0].markdown(f"**{o.get('name')}** — `{o.get('id')}` — *{o.get('status', 'unknown')}*")
        if cols[1].button("Switch", key=f"switch_{o.get('id')}"):
            st.session_state["active_organization"] = o
            st.success(f"Organización activa: {o.get('name')}")
            st.rerun()
        if cols[2].button("Delete", key=f"del_{o.get('id')}"):
            with st.expander("Confirmar eliminación", expanded=True):
                if st.button("Confirmar eliminación", key=f"confirm_del_{o.get('id')}"):
                    reg["organizations"] = [x for x in orgs if x.get("id") != o.get("id")]
                    if _save_registry(reg):
                        st.success("Organización eliminada")
                        st.rerun()

    st.divider()
    st.subheader("Crear nueva organización")
    with st.form("create_org"):
        new_name = st.text_input("Nombre", key="new_org_name")
        new_id = st.text_input("ID corto (sin espacios)", key="new_org_id")
        new_status = st.selectbox("Estado", ["active", "inactive", "archived"], index=0, key="new_org_status")
        submitted = st.form_submit_button("Crear organización")
        if submitted:
            if not new_name or not new_id:
                st.error("Nombre e ID son requeridos")
            else:
                org = {"id": new_id, "name": new_name, "status": new_status}
                reg.setdefault("organizations", []).append(org)
                if _save_registry(reg):
                    st.success("Organización creada")
                    st.rerun()

    st.divider()
    st.subheader("Preferencias")
    default_org = reg.get("default_organization")
    st.markdown(f"**Organización por defecto:** {default_org or 'No definida'}")
    ids = [o.get("id") for o in orgs]
    if ids:
        chosen = st.selectbox("Seleccionar organización por defecto", ["(ninguna)"] + ids, index=0 if not default_org else (ids.index(default_org) + 1))
        if st.button("Establecer por defecto"):
            reg["default_organization"] = None if chosen == "(ninguna)" else chosen
            if _save_registry(reg):
                st.success("Organización por defecto actualizada")
                st.rerun()
