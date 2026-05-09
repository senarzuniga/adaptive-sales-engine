"""Agent Hub page."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import streamlit as st

from config import APP_ROOT


def _list_agents_from_folder() -> list:
    agent_files = []
    for folder in ("agents", "ai-factory-v2"):
        folder_path = APP_ROOT / folder
        if folder_path.exists():
            for py_file in sorted(folder_path.glob("*.py")):
                if py_file.name != "__init__.py":
                    agent_files.append(f"{folder}/{py_file.name}")
    return agent_files


def _run_agent(agent_path: str, data: Optional[pd.DataFrame] = None) -> str:
    """Execute an agent script in a subprocess."""
    allowed_roots = [APP_ROOT / "agents", APP_ROOT / "ai-factory-v2", APP_ROOT / "scripts"]
    full_path = (APP_ROOT / agent_path).resolve()
    if not any(full_path.is_relative_to(r.resolve()) for r in allowed_roots):
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


def page_agent_hub() -> None:
    st.title("⚡ Agent Hub — Agentes Autónomos")
    agents = _list_agents_from_folder()

    if not agents:
        st.warning("No se encontraron agentes en /agents o /ai-factory-v2")
        st.info("Los agentes deben ser archivos `.py` dentro de `agents/` o `ai-factory-v2/`")
    else:
        st.subheader("Agentes disponibles")
        selected_agent = st.selectbox(
            "Selecciona un agente", ["— Seleccionar —"] + agents, key="agent_selector"
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
                    output = _run_agent(selected_agent, df)
                st.session_state.agent_output = output
                st.success("✅ Ejecución completada")

    if st.session_state.get("agent_output"):
        st.subheader("Resultado del agente")
        st.text_area("Output", st.session_state.agent_output, height=300, key="agent_output_display")
        st.download_button(
            "📥 Descargar resultado",
            st.session_state.agent_output.encode("utf-8"),
            "agent_output.txt",
            "text/plain",
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
