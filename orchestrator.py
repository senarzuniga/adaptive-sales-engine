"""
Maximum Orchestrator – Adaptive Sales Engine
Ejecuta TODOS los agentes disponibles en paralelo para cada acción del usuario.
Regla de oro: una acción = todos los agentes activos simultáneamente.
"""
from __future__ import annotations

import concurrent.futures
import importlib.util
import inspect
import logging
import os
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

logger = logging.getLogger(__name__)

APP_ROOT = Path(__file__).resolve().parent


class MaximumOrchestrator:
    """Orquesta la ejecución de TODOS los agentes para cada acción del usuario."""

    def __init__(self) -> None:
        self.agents: List[Dict[str, Any]] = self._load_all_agents()
        logger.info(
            "MaximumOrchestrator: %d agentes cargados", len(self.agents)
        )

    # ------------------------------------------------------------------
    # Agent discovery
    # ------------------------------------------------------------------

    def _load_all_agents(self) -> List[Dict[str, Any]]:
        """Carga dinámicamente todos los agentes de /agents y /ai-factory-v2."""
        agents: List[Dict[str, Any]] = []
        scan_paths: List[tuple[str, Path]] = [
            ("agents", APP_ROOT / "agents"),
            ("ai-factory-v2", APP_ROOT / "ai-factory-v2"),
            ("ai-factory-v2/ingestion/agents", APP_ROOT / "ai-factory-v2" / "ingestion" / "agents"),
        ]

        seen: set[str] = set()  # avoid loading duplicates

        for folder_label, folder_path in scan_paths:
            if not folder_path.exists():
                continue

            for py_file in sorted(folder_path.glob("*.py")):
                if py_file.name.startswith("__"):
                    continue

                unique_key = py_file.stem
                if unique_key in seen:
                    continue
                seen.add(unique_key)

                agent_entry = self._load_single_agent(py_file, folder_label)
                if agent_entry is not None:
                    agents.append(agent_entry)

        return agents

    def _load_single_agent(
        self, py_file: Path, folder_label: str
    ) -> Optional[Dict[str, Any]]:
        """Loads one agent file, returning a dict or None on hard failure."""
        stem = py_file.stem
        try:
            # Add the agent's parent directory AND grandparent to sys.path
            # so that intra-package imports (e.g. `from ingestion import …`) work.
            import sys as _sys
            extra_paths = [str(py_file.parent), str(py_file.parent.parent)]
            _added = []
            for p in extra_paths:
                if p not in _sys.path:
                    _sys.path.insert(0, p)
                    _added.append(p)

            spec = importlib.util.spec_from_file_location(stem, py_file)
            if spec is None or spec.loader is None:
                return None
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)  # type: ignore[union-attr]

            # Restore sys.path
            for p in _added:
                try:
                    _sys.path.remove(p)
                except ValueError:
                    pass

            if hasattr(module, "run"):
                run_fn = module.run
            elif hasattr(module, "Agent"):
                try:
                    run_fn = module.Agent().run
                except Exception:
                    run_fn = None
            else:
                run_fn = None

            if run_fn is None:
                # Provide a stub so the agent still appears in results
                run_fn = _make_stub_run(stem)

            return {
                "name": stem,
                "run": run_fn,
                "folder": folder_label,
                "file": str(py_file),
                "load_error": None,
            }

        except Exception as exc:  # noqa: BLE001
            err_msg = str(exc)
            logger.warning("Error cargando agente %s: %s", stem, err_msg)
            return {
                "name": stem,
                "run": _make_stub_run(stem, err_msg),
                "folder": folder_label,
                "file": str(py_file),
                "load_error": err_msg,
            }

    def reload_agents(self) -> int:
        """Reload the agent registry (useful after adding new agents at runtime)."""
        self.agents = self._load_all_agents()
        return len(self.agents)

    # ------------------------------------------------------------------
    # Parallel execution
    # ------------------------------------------------------------------

    def execute_all_agents(
        self,
        context: Dict[str, Any],
        timeout_seconds: int = 60,
    ) -> Dict[str, Any]:
        """
        Ejecuta TODOS los agentes en paralelo sin excepción.

        Args:
            context: Debe contener al menos {'action': str}.
                     Opcionalmente: 'uploaded_data' (DataFrame), 'saved_companies', etc.
            timeout_seconds: Límite por agente (default 60 s).

        Returns:
            Dict con resultados por agente + claves de resumen (_summary, _agent_count, …).
        """
        if not self.agents:
            return {
                "_summary": "⚠️ No se encontraron agentes en /agents o /ai-factory-v2.",
                "_agent_count": 0,
                "_successful_agents": 0,
                "_failed_agents": 0,
            }

        results: Dict[str, Any] = {}

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=min(len(self.agents), (os.cpu_count() or 4) * 4, 32)
        ) as executor:
            future_to_agent = {
                executor.submit(self._safe_run_agent, agent, context): agent
                for agent in self.agents
            }

            for future in concurrent.futures.as_completed(future_to_agent):
                agent = future_to_agent[future]
                try:
                    agent_result = future.result(timeout=timeout_seconds)
                    results[agent["name"]] = agent_result
                except concurrent.futures.TimeoutError:
                    results[agent["name"]] = {
                        "status": "timeout",
                        "error": f"Timeout tras {timeout_seconds}s",
                        "output": f"El agente tardó más de {timeout_seconds}s",
                        "insights": [],
                    }
                except Exception as exc:  # noqa: BLE001
                    results[agent["name"]] = {
                        "status": "error",
                        "error": str(exc),
                        "traceback": traceback.format_exc(),
                        "output": f"Error en ejecución: {exc}",
                        "insights": [],
                    }

        # Compute summary metadata
        successful = [
            k
            for k, v in results.items()
            if isinstance(v, dict) and v.get("status") not in ("error", "timeout", "load_error")
        ]
        failed = [k for k in results if k not in successful]

        results["_agent_count"] = len(self.agents)
        results["_successful_agents"] = len(successful)
        results["_failed_agents"] = len(failed)
        results["_failed_agent_names"] = failed
        results["_summary"] = self._consolidate_results(results, context)

        return results

    def _safe_run_agent(self, agent: Dict[str, Any], context: Dict[str, Any]) -> Any:
        """Ejecuta un agente capturando excepciones y adaptando la firma."""
        try:
            sig = inspect.signature(agent["run"])
            params = list(sig.parameters.keys())

            if "context" in params:
                return agent["run"](context=context)
            elif "data" in params:
                return agent["run"](data=context.get("uploaded_data"))
            elif params:
                return agent["run"](context)
            else:
                return agent["run"]()
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "error": str(exc),
                "output": f"Error en ejecución: {exc}",
                "insights": [],
            }

    # ------------------------------------------------------------------
    # Consolidated summary
    # ------------------------------------------------------------------

    def _consolidate_results(
        self, results: Dict[str, Any], context: Dict[str, Any]
    ) -> str:
        total = results.get("_agent_count", 0)
        ok = results.get("_successful_agents", 0)
        failed_names = results.get("_failed_agent_names", [])

        parts: List[str] = [
            "## 📊 RESULTADO DE ORQUESTACIÓN MÁXIMA",
            f"✅ **{ok} de {total} agentes ejecutados correctamente**",
            f"🎯 **Acción solicitada:** `{context.get('action', 'General')}`",
        ]

        df: Optional[pd.DataFrame] = context.get("uploaded_data")
        if df is not None and isinstance(df, pd.DataFrame):
            parts.append(
                f"📈 **Datos analizados:** {df.shape[0]:,} filas × {df.shape[1]} columnas"
            )

        if failed_names:
            parts.append(
                f"⚠️ **Agentes con error** ({len(failed_names)}): "
                + ", ".join(f"`{n}`" for n in failed_names[:5])
            )

        parts += ["", "### 🔍 Insights principales por agente"]

        for agent_name, output in results.items():
            if agent_name.startswith("_"):
                continue
            if not isinstance(output, dict):
                parts.append(f"- **{agent_name}**: {str(output)[:150]}")
                continue

            if output.get("status") in ("error", "timeout", "load_error"):
                err_msg = str(output.get("error", ""))[:120]
                parts.append(f"- **{agent_name}**: ⚠️ {err_msg}")
                continue

            insights: List[str] = output.get("insights") or []
            out_str = str(output.get("output", "Análisis completado"))

            if insights:
                bullet = insights[0][:150]
                parts.append(f"- **{agent_name}**: {bullet}")
            else:
                parts.append(f"- **{agent_name}**: {out_str[:150]}")

        parts += [
            "",
            "📁 **Resultados detallados disponibles en las pestañas de agentes.**",
        ]
        return "\n".join(parts)


# ------------------------------------------------------------------
# Streamlit-cached singleton
# ------------------------------------------------------------------


def _make_stub_run(stem: str, error_msg: str = "") -> Any:
    """Return a callable that returns a minimal agent result (no lambdas with closures)."""

    def _stub(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if error_msg:
            return {
                "status": "load_error",
                "error": f"Error de carga: {error_msg}",
                "output": f"No se pudo cargar el agente {stem}: {error_msg}",
                "insights": [],
            }
        return {
            "status": "no_run",
            "output": f"Agente {stem} no tiene función run().",
            "insights": [],
        }

    return _stub
def get_max_orchestrator() -> MaximumOrchestrator:
    """Returns (and caches) the single MaximumOrchestrator instance."""
    return MaximumOrchestrator()
