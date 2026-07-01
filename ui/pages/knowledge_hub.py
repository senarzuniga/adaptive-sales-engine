"""Knowledge Hub — lightweight searchable interface over repository documents."""
from __future__ import annotations

from pathlib import Path
from typing import List

import streamlit as st

from config import APP_ROOT


SEARCH_DIRS = [
    APP_ROOT / "documents",
    APP_ROOT / "docs",
    APP_ROOT / "Architecture",
    APP_ROOT / "outputs",
    APP_ROOT / "Adaptive Sales Engine - Lovable_files",
]


def _iter_files():
    for base in SEARCH_DIRS:
        if not base.exists():
            continue
        for f in base.rglob("*"):
            if f.is_file() and f.suffix.lower() in (".md", ".txt", ".yaml", ".yml", ".py", ".json", ".html", ".csv"):
                yield f


def page_knowledge_hub() -> None:
    st.title("📚 Knowledge Hub")
    q = st.text_input("Buscar en documentos, ADRs, especificaciones, código y reportes")
    if not q:
        st.info("Introduce una consulta para buscar en los documentos indexados.")
        return

    results: List[Path] = []
    max_results = 60
    q_lower = q.lower()
    with st.spinner("Buscando…"):
        for f in _iter_files():
            try:
                text = f.read_text(encoding="utf-8", errors="ignore")
                if q_lower in text.lower() or q_lower in f.name.lower():
                    results.append(f)
                    if len(results) >= max_results:
                        break
            except Exception:
                continue

    st.success(f"{len(results)} resultados encontrados (máx {max_results})")
    for f in results:
        with st.expander(f"{f.relative_to(APP_ROOT)}", expanded=False):
            try:
                snippet = f.read_text(encoding="utf-8", errors="ignore")
                idx = snippet.lower().find(q_lower)
                if idx >= 0:
                    start = max(0, idx - 120)
                    excerpt = snippet[start : start + 400]
                    st.code(excerpt)
                else:
                    st.code(snippet[:400])
                if st.button("Abrir archivo en editor", key=f"open_{str(f)}"):
                    st.info(f"Path: {f}")
            except Exception as exc:
                st.write(f"No se pudo leer: {exc}")
