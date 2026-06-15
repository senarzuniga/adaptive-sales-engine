"""
ING_SupportAgent — Streamlit UI for the Adaptive Sales Engine

This app reuses the repository's orchestrator and agents. It intentionally
requires no authentication for local use and provides quick access to the
main panels: Dashboard, Agents Monitor, Action Pool and a Customer 360 view.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

# Make the repo root available for imports if running in isolation
ROOT = Path(__file__).resolve().parent.parent

st.set_page_config(page_title="ING_SupportAgent", page_icon="🤖", layout="wide")

# Lazy imports from the existing codebase
try:
    from orchestrator import get_max_orchestrator
    from infrastructure.supabase_client import get_supabase, sb_insights_save
except Exception:
    get_max_orchestrator = None  # type: ignore
    get_supabase = None  # type: ignore
    sb_insights_save = None  # type: ignore


def init_state() -> None:
    if "ing_last_results" not in st.session_state:
        st.session_state["ing_last_results"] = None
    if "ing_uploaded_df" not in st.session_state:
        st.session_state["ing_uploaded_df"] = None


init_state()

# Instantiate orchestrator and supabase client
ORCH = get_max_orchestrator() if get_max_orchestrator else None
SB = get_supabase() if get_supabase else None


def _load_latest_results() -> Optional[Dict[str, Any]]:
    """Return cached results or load the latest cascade_results_*.json from outputs."""
    if st.session_state.get("ing_last_results"):
        return st.session_state["ing_last_results"]

    out_dir = ROOT / "outputs"
    if not out_dir.exists():
        return None
    files = list(out_dir.glob("cascade_results_*.json"))
    if not files:
        return None
    latest = max(files, key=lambda p: p.stat().st_mtime)
    try:
        return json.loads(latest.read_text(encoding="utf-8"))
    except Exception:
        try:
            return json.loads(latest.read_text())
        except Exception:
            return None


with st.sidebar:
    st.title("ING_SupportAgent")
    page = st.radio(
        "Navegación",
        [
            "Dashboard",
            "Run Action",
            "Cascade Runner",
            "Agents Monitor",
            "Action Pool",
            "Customer 360",
            "Settings",
        ],
    )  # type: ignore
    st.markdown("---")
    st.write(f"Agentes detectados: {len(ORCH.agents) if ORCH else 0}")
    st.write("Supabase:", "Configured" if SB else "Not configured")
    if st.button("Recargar agentes"):
        if ORCH:
            ORCH.reload_agents()
            st.experimental_rerun()


if page == "Dashboard":
    st.header("Dashboard — ING_SupportAgent")
    st.write("Agentes cargados:", len(ORCH.agents) if ORCH else 0)
    last = _load_latest_results()
    if last:
        st.subheader("Último resumen")
        st.markdown(last.get("_summary", "Sin resumen"))

        cols = st.columns(4)
        cols[0].metric("Agentes", last.get("_agent_count", 0))
        cols[1].metric("Exitosos", last.get("_successful_agents", 0))
        cols[2].metric("Fallidos", last.get("_failed_agents", 0))
        action_total = (
            last.get("action_engine", {}).get("summary", {}).get("total")
            if last.get("action_engine")
            else None
        )
        cols[3].metric("Acciones", action_total or 0)

        # Tasks priority chart if available
        tasks = last.get("weekly_task_planner", {}).get("tasks", [])
        if tasks:
            df_tasks = pd.DataFrame(tasks)
            if "priority" in df_tasks.columns:
                prio_counts = df_tasks["priority"].value_counts()
                st.bar_chart(prio_counts)

    st.markdown("---")
    if st.button("Ejecutar cascada rápida (todos los agentes)"):
        if not ORCH:
            st.error("Orchestrator no disponible (revisa imports).")
        else:
            with st.spinner("Ejecutando agentes..."):
                ctx = {"action": "dashboard_quick_run"}
                results = ORCH.execute_all_agents(ctx, timeout_seconds=30)
                st.session_state["ing_last_results"] = results
                st.success("Ejecución completada")
                st.write(results.get("_summary", "No summary"))


if page == "Run Action":
    st.header("Run Action — Ejecuta todos los agentes sobre un contexto")
    action_name = st.text_input("Nombre de la acción", value="analyze_company")
    uploaded = st.file_uploader("Sube datos (CSV/XLSX) opcional", type=["csv", "xlsx"])
    if uploaded:
        try:
            if uploaded.name.endswith(".csv"):
                df = pd.read_csv(uploaded)
            else:
                df = pd.read_excel(uploaded)
            st.session_state["ing_uploaded_df"] = df
            st.success(f"Cargado {len(df)} filas")
            st.dataframe(df.head())
        except Exception as e:
            st.error(f"Error al leer archivo: {e}")

    timeout = st.number_input("Timeout por agente (s)", min_value=5, max_value=600, value=60)
    if st.button("Ejecutar acción con todos los agentes"):
        if not ORCH:
            st.error("Orchestrator no disponible (revisa imports).")
        else:
            ctx = {"action": action_name, "uploaded_data": st.session_state.get("ing_uploaded_df")}
            with st.spinner("Ejecutando agentes..."):
                results = ORCH.execute_all_agents(ctx, timeout_seconds=int(timeout))
                st.session_state["ing_last_results"] = results
                st.success("Ejecución completada")
                st.markdown("### Resumen")
                st.write(results.get("_summary", "Sin resumen"))
                st.markdown("### Detalle por agente")
                for name, out in results.items():
                    if name.startswith("_"):
                        continue
                    with st.expander(name):
                        try:
                            st.json(out)
                        except Exception:
                            st.write(str(out))
                if SB and sb_insights_save:
                    if st.button("Guardar insights en Supabase"):
                        for agent_name, out in results.items():
                            if agent_name.startswith("_"):
                                continue
                            insights = out.get("insights") if isinstance(out, dict) else None
                            if insights:
                                try:
                                    sb_insights_save("ing_system", agent_name, insights, context_action=action_name)
                                except Exception:
                                    pass
                        st.success("Intento de guardado de insights finalizado")


if page == "Cascade Runner":
    st.header("Cascade Runner — Ejecuta scripts/cascade_agents.py")
    st.write("Este runner ejecuta el script de cascada que ya existe en el repositorio.")
    data_path = st.text_input("Path a archivo de datos (opcional)", value="")
    per_agent_timeout = st.number_input("Timeout por agente (s)", min_value=10, max_value=600, value=60)
    if st.button("Ejecutar script de cascada"):
        import subprocess, sys

        cmd = [sys.executable, str(Path("scripts") / "cascade_agents.py"), "--timeout", str(int(per_agent_timeout))]
        if data_path:
            cmd += ["--data", data_path]
        with st.spinner("Lanzando cascade_agents.py..."):
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
                st.text(proc.stdout)
                if proc.stderr:
                    st.text(proc.stderr)
                st.success("cascade_agents.py completado")
            except Exception as e:
                st.error(f"Error ejecutando script: {e}")


if page == "Agents Monitor":
    st.header("Agents Monitor — Visualiza y ejecuta agentes individuales")
    if not ORCH:
        st.error("Orchestrator no disponible (revisa imports).")
    else:
        last_results = _load_latest_results() or {}
        for agent in ORCH.agents:
            cols = st.columns([3, 1, 1, 1])
            cols[0].write(agent.get("name"))
            cols[1].write(agent.get("folder", ""))
            cols[2].write("ERROR" if agent.get("load_error") else "OK")
            key = f"run_{agent.get('name')}"
            if cols[3].button("Run", key=key):
                with st.spinner(f"Ejecutando {agent.get('name')}..."):
                    try:
                        out = ORCH._safe_run_agent(agent, {"action": f"manual_run_{agent.get('name')}"})
                        st.success("Ejecutado")
                        try:
                            st.json(out)
                        except Exception:
                            st.write(str(out))
                    except Exception as e:
                        st.error(f"Error: {e}")

            # show last output if available
            lr = last_results.get(agent.get("name"))
            if lr:
                with st.expander(f"Último resultado — {agent.get('name')}"):
                    try:
                        st.json(lr)
                    except Exception:
                        st.write(str(lr))


if page == "Action Pool":
    st.header("Action Pool — Genera acciones a partir de agentes")
    st.write("Genera un pool de acciones utilizando los agentes disponibles en el espacio de trabajo.")
    if st.button("Generar pool de acciones (invoca agentes)"):
        if not ORCH:
            st.error("Orchestrator no disponible (revisa imports).")
        else:
            with st.spinner("Generando..."):
                results = ORCH.execute_all_agents({"action": "generate_action_pool"}, timeout_seconds=60)
                st.session_state["ing_last_results"] = results
                st.success("Pool generado")
                st.write(results.get("_summary", ""))
                payload = json.dumps(results, default=str, ensure_ascii=False, indent=2)
                st.download_button("Descargar JSON de resultados", payload, file_name="action_pool_results.json")

                actions = results.get("action_engine", {}).get("actions") or []
                if actions:
                    try:
                        st.subheader("Acciones generadas")
                        st.table(pd.DataFrame(actions))
                    except Exception:
                        st.write(actions)


if page == "Customer 360":
    st.header("Customer 360 — Vista completa del cliente")
    results = _load_latest_results()
    if not results:
        st.info("No hay resultados disponibles. Ejecuta una cascada para generar datos.")
    else:
        customers = set()
        kam_maps = results.get("kam_mapper_agent", {}).get("account_maps", []) or []
        for m in kam_maps:
            customers.add(m.get("account"))

        opps = results.get("after_sales_opportunity_agent", {}).get("opportunities", []) or []
        for o in opps:
            customers.add(o.get("customer"))

        tasks = results.get("weekly_task_planner", {}).get("tasks", []) or []
        for t in tasks:
            if t.get("customer"):
                customers.add(t.get("customer"))

        customers_list = sorted([c for c in customers if c])
        if not customers_list:
            st.info("No se han detectado clientes en los últimos resultados.")
        else:
            selected = st.selectbox("Selecciona cliente", customers_list)
            if selected:
                st.subheader(selected)
                sel_map = next((m for m in kam_maps if m.get("account") == selected), None)
                if sel_map:
                    st.write("**Stakeholders**")
                    roles = sel_map.get("stakeholders", []) or []
                    if roles:
                        st.table(pd.DataFrame(roles))
                    st.write("**Acciones recomendadas**")
                    for a in sel_map.get("recommended_actions", []) or []:
                        st.write(f"- {a}")

                cust_opps = [o for o in opps if o.get("customer") == selected]
                if cust_opps:
                    st.subheader("Oportunidades detectadas")
                    try:
                        st.table(pd.DataFrame(cust_opps))
                    except Exception:
                        st.write(cust_opps)

                cust_tasks = [t for t in tasks if t.get("customer") == selected]
                if cust_tasks:
                    st.subheader("Tareas relacionadas")
                    try:
                        st.table(pd.DataFrame(cust_tasks))
                    except Exception:
                        st.write(cust_tasks)

                with st.expander("JSON completo del cliente"):
                    st.json({"map": sel_map, "opportunities": cust_opps, "tasks": cust_tasks})


if page == "Settings":
    st.header("Settings")
    st.write("No hay autenticación por defecto — acceso total para uso local.")
    st.write("Directorio base:", str(ROOT))
