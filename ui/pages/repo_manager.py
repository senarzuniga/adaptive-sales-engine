"""Repository Manager — discover and register local repositories."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import os
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


def _discover_repos() -> List[Path]:
    roots: List[Path] = []
    for p in sorted(APP_ROOT.iterdir()):
        try:
            if not p.is_dir() or p.name.startswith("."):
                continue
            if (p / ".git").exists() or (p / "package.json").exists() or (p / "requirements.txt").exists() or (p / "pyproject.toml").exists():
                roots.append(p)
        except Exception:
            continue
    return roots


def _detect_manifests(p: Path) -> List[str]:
    res = []
    for fname in ("package.json", "requirements.txt", "pyproject.toml", "setup.py"):
        if (p / fname).exists():
            res.append(fname)
    if (p / ".git").exists():
        res.append(".git")
    return res


def page_repository_manager() -> None:
    st.title("📁 Repository Manager")

    discovered = _discover_repos()
    st.subheader("Repositorios detectados en el workspace")
    if not discovered:
        st.info("No se detectaron repositorios. Asegúrate de que hay carpetas con package.json, requirements.txt o .git")
    for p in discovered:
        cols = st.columns([4, 1, 1, 1])
        manifests = _detect_manifests(p)
        cols[0].markdown(f"**{p.name}** — {str(p)}")
        cols[0].caption(f"Manifiestos: {', '.join(manifests) or '(ninguno)'}")
        if cols[1].button("Register", key=f"reg_{p.name}"):
            reg = _load_registry()
            repos = reg.setdefault("repositories", [])
            if any(r.get("id") == p.name for r in repos):
                st.warning("Repositorio ya registrado")
            else:
                repo_entry = {"id": p.name, "path": str(p.relative_to(APP_ROOT)), "manifests": manifests}
                repos.append(repo_entry)
                if _save_registry(reg):
                    st.success("Repositorio registrado")
                    st.rerun()
        if cols[2].button("Open", key=f"open_{p.name}"):
            try:
                # Try to open in file explorer (Windows)
                if os.name == "nt":
                    os.startfile(str(p))
                else:
                    st.info(f"Path: {p}")
            except Exception:
                st.info(f"Path: {p}")
        if cols[3].button("Scan", key=f"scan_{p.name}"):
            st.info(f"Scanning {p.name}... (quick index)")
            reg = _load_registry()
            for r in reg.setdefault("repositories", []):
                if r.get("id") == p.name:
                    r["last_scanned"] = st.time() if hasattr(st, "time") else "now"
            _save_registry(reg)

    st.divider()
    st.subheader("Repositorios registrados")
    reg = _load_registry()
    repos = reg.get("repositories", []) or []
    if repos:
        for r in repos:
            cols = st.columns([4, 1, 1])
            cols[0].markdown(f"**{r.get('id')}** — {r.get('path')}")
            if cols[1].button("Re-index", key=f"reidx_{r.get('id')}"):
                r["last_indexed"] = st.time() if hasattr(st, "time") else "now"
                if _save_registry(reg):
                    st.success("Re-index queued (metadata updated)")
            if cols[2].button("Remove", key=f"rm_{r.get('id')}"):
                reg["repositories"] = [x for x in repos if x.get("id") != r.get("id")]
                if _save_registry(reg):
                    st.success("Repositorio eliminado")
                    st.rerun()
    else:
        st.info("No hay repositorios registrados aún.")
