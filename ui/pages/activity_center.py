"""Activity Center — show current operations, completed tasks and logs."""
from __future__ import annotations

from pathlib import Path
from typing import List

import streamlit as st

from config import APP_ROOT


LOG_DIR = APP_ROOT / "logs"
OUT_DIR = APP_ROOT / "outputs"


def _tail(path: Path, n: int = 100) -> List[str]:
    try:
        with path.open("rb") as fh:
            fh.seek(0, 2)
            end = fh.tell()
            size = 0
            block = 1024
            data = b""
            while end > 0 and len(data.splitlines()) <= n:
                read_size = min(block, end)
                end -= read_size
                fh.seek(end)
                data = fh.read(read_size) + data
            return data.decode(errors="ignore").splitlines()[-n:]
    except Exception:
        return ["<no readable log>"]


def page_activity_center() -> None:
    st.title("🕒 Activity Center")

    st.subheader("Background outputs")
    if OUT_DIR.exists():
        files = sorted(OUT_DIR.glob("**/*"), key=lambda p: p.stat().st_mtime if p.is_file() else 0, reverse=True)[:40]
        for f in files:
            if f.is_file():
                st.markdown(f"- **{f.name}** — {f.relative_to(APP_ROOT)}")
                if st.button(f"View {f.name}", key=f"view_out_{str(f)}"):
                    try:
                        txt = f.read_text(encoding="utf-8", errors="ignore")
                        st.code(txt[-4000:])
                    except Exception as exc:
                        st.write(f"Error reading file: {exc}")
    else:
        st.info("No hay salidas en la carpeta outputs/")

    st.divider()
    st.subheader("Recent logs")
    if LOG_DIR.exists():
        log_files = sorted(LOG_DIR.glob("**/*"), key=lambda p: p.stat().st_mtime if p.is_file() else 0, reverse=True)[:20]
        for lf in log_files:
            st.markdown(f"- {lf.name} — {lf.relative_to(APP_ROOT)}")
            if st.button(f"Tail {lf.name}", key=f"tail_{str(lf)}"):
                lines = _tail(lf, 200)
                st.code("\n".join(lines[-200:]))
    else:
        st.info("No se encontraron logs en logs/")

    st.divider()
    st.subheader("Current tasks")
    last_results = st.session_state.get("last_analysis_results")
    if last_results:
        st.json({k: v for k, v in last_results.items() if k.startswith("_")})
    else:
        st.info("No hay tareas activas en la sesión actual.")
