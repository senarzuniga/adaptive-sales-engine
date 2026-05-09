"""
Shared UI helpers — field accessors, formatting utilities, and the
orchestrator panel that every page uses.

No business logic lives here; only rendering and session-state reads.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

from config import MAX_AGENT_TABS, MAX_AGENT_OUTPUT_PREVIEW


# ──────────────────────────────────────────────────────────────
# Field / data helpers
# ──────────────────────────────────────────────────────────────


def _field(row: Dict[str, Any], *names: str, default: Any = "") -> Any:
    """Return the first non-None value for the given key names in *row*."""
    for n in names:
        if n in row and row[n] is not None:
            return row[n]
    return default


def safe_execute(fetcher: Any, fallback: Any) -> Any:
    """Call *fetcher()* and return *fallback* on any exception."""
    try:
        return fetcher()
    except Exception:
        return fallback


def get_deadline_priority(deadline_text: str) -> tuple:
    """Return (css_class, emoji, days_left) for a deadline string."""
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


# ──────────────────────────────────────────────────────────────
# Orchestrator panel
# ──────────────────────────────────────────────────────────────


def _build_context(action: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Build the agent context dict from session state."""
    from application.context_engine import build_context
    return build_context(action, extra)


def _render_orchestration_results(results: Dict[str, Any]) -> None:
    """Render the summary + per-agent tabs from an orchestration result."""
    summary = results.get("_summary", "")
    if summary:
        st.markdown(summary)

    agent_names = [k for k in results if not k.startswith("_")]
    if not agent_names:
        return

    st.subheader("📁 Outputs detallados por agente")
    display_names = agent_names[:MAX_AGENT_TABS]
    if len(agent_names) > MAX_AGENT_TABS:
        st.caption(f"Mostrando {MAX_AGENT_TABS} de {len(agent_names)} agentes. Ver Agent Hub para todos.")

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
                        preview = str(agent_out)[:MAX_AGENT_OUTPUT_PREVIEW]
                        if len(str(agent_out)) > MAX_AGENT_OUTPUT_PREVIEW:
                            preview += "…"
                        st.success(preview)
                    for ins in (output.get("insights") or [])[:5]:
                        st.markdown(f"• {ins}")
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


def _render_orchestrator_panel(
    action: str,
    button_label: str = "🚀 Ejecutar análisis con TODOS los agentes",
    auto_run: bool = False,
    extra_context: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Render the orchestrator run button (or auto-run) and show results."""
    try:
        from orchestrator import get_max_orchestrator
        _ORCHESTRATOR_AVAILABLE = True
    except Exception:
        _ORCHESTRATOR_AVAILABLE = False

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
