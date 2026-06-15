"""
cascade_agents.py — Ejecuta todos los agentes ACS en cascada sobre el contexto actual
======================================================================================
Carga los datos disponibles, construye el contexto y lanza el orquestador
completo. Los resultados se guardan en outputs/cascade_results_<timestamp>.json.

Uso:
    python scripts/cascade_agents.py
    python scripts/cascade_agents.py --data path/to/file.xlsx
    python scripts/cascade_agents.py --action forecast_deviation
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _load_data(path: Optional[str] = None):
    """Load data from a file path or return None."""
    if not path:
        return None
    try:
        import pandas as pd
        p = Path(path)
        if p.suffix in (".xlsx", ".xls"):
            return pd.read_excel(p)
        elif p.suffix == ".csv":
            return pd.read_csv(p)
        return None
    except Exception as e:
        print(f"[WARN] No se pudo cargar {path}: {e}")
        return None


def _build_context(action: str, data_path: Optional[str] = None) -> Dict[str, Any]:
    """Build a minimal context dict without requiring Streamlit."""
    df = _load_data(data_path)
    return {
        "action": action,
        "uploaded_data": df,
        "saved_companies": [],
        "active_company": None,
        "company_notes": "",
        "portfolio_risk": None,
        "productos_data": None,
        "oportunidades_data": df,  # also pass as opportunities if generic upload
        "estrategia_data": None,
    }


def _save_results(results: Dict[str, Any], output_dir: Path) -> Path:
    """Persist results to a JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = output_dir / f"cascade_results_{ts}.json"
    # Make JSON-serializable: convert DataFrames to row counts
    import pandas as pd
    safe: Dict[str, Any] = {}
    for k, v in results.items():
        if isinstance(v, pd.DataFrame):
            safe[k] = f"<DataFrame {v.shape[0]}×{v.shape[1]}>"
        elif isinstance(v, dict):
            row: Dict[str, Any] = {}
            for kk, vv in v.items():
                row[kk] = f"<DataFrame {vv.shape[0]}×{vv.shape[1]}>" if isinstance(vv, pd.DataFrame) else vv
            safe[k] = row
        else:
            safe[k] = v
    out_path.write_text(json.dumps(safe, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="ACS Cascade Agents Runner")
    parser.add_argument("--action", default="cascade_all", help="Trigger action name")
    parser.add_argument("--data",   default=None, help="Path to data file (xlsx/csv)")
    parser.add_argument("--timeout", type=int, default=60, help="Per-agent timeout seconds")
    args = parser.parse_args()

    print(f"[ACS] Iniciando ejecución en cascada — acción: {args.action}")
    print(f"[ACS] Timestamp: {datetime.now().isoformat()}")

    from orchestrator import get_max_orchestrator

    orch = get_max_orchestrator()
    n = len(orch.agents)
    print(f"[ACS] Orquestador cargado — {n} agentes detectados")

    context = _build_context(args.action, args.data)
    print(f"[ACS] Contexto construido — datos: {'sí' if context['uploaded_data'] is not None else 'no'}")

    print(f"\n[ACS] ⚡ Ejecutando {n} agentes en paralelo...\n")
    start = datetime.now()
    results = orch.execute_all_agents(context, timeout_seconds=args.timeout)
    elapsed = (datetime.now() - start).total_seconds()

    successful = results.get("_successful_agents", 0)
    failed     = results.get("_failed_agents", 0)
    print(f"\n[ACS] ✅ Completado en {elapsed:.1f}s — {successful} OK, {failed} errores")

    summary = results.get("_summary", "")
    if summary:
        print(f"\n{summary[:1000]}")

    out_path = _save_results(results, ROOT / "outputs")
    print(f"\n[ACS] Resultados guardados en: {out_path}")

    # Print per-agent status
    print("\n[ACS] Estado por agente:")
    for agent_name, agent_result in results.items():
        if agent_name.startswith("_"):
            continue
        if isinstance(agent_result, dict):
            status = agent_result.get("status", "?")
            icon = "✅" if status not in ("error", "timeout", "load_error") else "❌"
            print(f"  {icon} {agent_name}: {status}")


if __name__ == "__main__":
    main()
