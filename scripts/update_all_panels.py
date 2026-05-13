"""
update_all_panels.py — Actualiza todos los paneles del ecosistema ACS
======================================================================
Regenera datos JSON para los paneles del orquestador y ofertas.
Útil para refrescar dashboards sin reiniciar servicios.

Uso:
    python scripts/update_all_panels.py
    python scripts/update_all_panels.py --data path/to/sales.xlsx
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR      = ROOT / "data"
DASHBOARD_DIR = ROOT / "dashboard"
OUTPUTS_DIR   = ROOT / "outputs"

sys.path.insert(0, str(ROOT))


def _load_data(path: Optional[str] = None):
    if not path:
        return None
    try:
        import pandas as pd
        p = Path(path)
        if p.suffix in (".xlsx", ".xls"):
            return pd.read_excel(p)
        elif p.suffix == ".csv":
            return pd.read_csv(p)
    except Exception as e:
        print(f"[WARN] Cannot load {path}: {e}")
    return None


def _load_offers_pool() -> List[Dict[str, Any]]:
    f = DATA_DIR / "offers_pool.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _update_orchestrator_panel_data(df=None) -> Dict[str, Any]:
    """Generate orchestrator panel data payload."""
    from orchestrator import get_max_orchestrator

    orch = get_max_orchestrator()
    agent_list = [
        {
            "name":   a["name"],
            "folder": a["folder"],
            "status": "ready" if a.get("load_error") is None else "error",
            "error":  a.get("load_error"),
        }
        for a in orch.agents
    ]

    context: Dict[str, Any] = {
        "action": "panel_refresh",
        "uploaded_data": df,
    }

    # Quick execution to get status
    print(f"  ⚡ Ejecutando {len(orch.agents)} agentes para actualizar datos del panel...")
    results = orch.execute_all_agents(context, timeout_seconds=30)

    successful = results.get("_successful_agents", 0)
    failed     = results.get("_failed_agents", 0)

    panel_data: Dict[str, Any] = {
        "generated_at":    datetime.now().isoformat(),
        "agent_count":     len(orch.agents),
        "agents_ready":    sum(1 for a in agent_list if a["status"] == "ready"),
        "agents_error":    sum(1 for a in agent_list if a["status"] == "error"),
        "agents":          agent_list,
        "last_run": {
            "successful": successful,
            "failed":     failed,
            "summary":    str(results.get("_summary", ""))[:500],
        },
        "services": {
            "streamlit":  "http://localhost:8501",
            "nextjs":     "http://localhost:8080",
            "fastapi":    "http://localhost:8000",
            "ingestion":  "http://localhost:8502",
        },
    }
    return panel_data


def _update_offers_panel_data() -> Dict[str, Any]:
    """Generate offers panel data payload."""
    offers = _load_offers_pool()

    by_status: Dict[str, int] = {}
    total_value = 0.0
    for offer in offers:
        s = offer.get("status", "unknown")
        by_status[s] = by_status.get(s, 0) + 1
        total_value += float(offer.get("total", 0) or 0)

    panel_data: Dict[str, Any] = {
        "generated_at": datetime.now().isoformat(),
        "total_offers": len(offers),
        "total_value":  round(total_value, 2),
        "by_status":    by_status,
        "recent_offers": sorted(
            offers, key=lambda o: o.get("created_at", ""), reverse=True
        )[:10],
    }
    return panel_data


def _write_json(data: Dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="ACS Panel Data Updater")
    parser.add_argument("--data", default=None, help="Path to sales data file")
    args = parser.parse_args()

    print(f"\n{'='*55}")
    print("  ACS: Actualización de Paneles")
    print(f"{'='*55}")
    print(f"  Timestamp: {datetime.now().isoformat()}\n")

    df = _load_data(args.data)

    # 1. Orchestrator panel
    print("[1/2] Actualizando panel del orquestador...")
    try:
        orch_data = _update_orchestrator_panel_data(df)
        out = DATA_DIR / "orchestrator_panel_data.json"
        _write_json(orch_data, out)
        print(f"  ✅ Guardado → {out}")
        print(f"  📊 {orch_data['agent_count']} agentes | {orch_data['last_run']['successful']} OK | {orch_data['last_run']['failed']} errores")
    except Exception as exc:
        print(f"  ❌ Error: {exc}")

    # 2. Offers panel
    print("\n[2/2] Actualizando panel de ofertas...")
    try:
        offers_data = _update_offers_panel_data()
        out = DATA_DIR / "offers_panel_data.json"
        _write_json(offers_data, out)
        print(f"  ✅ Guardado → {out}")
        print(f"  📋 {offers_data['total_offers']} ofertas | Valor total: {offers_data['total_value']:,.0f} €")
    except Exception as exc:
        print(f"  ❌ Error: {exc}")

    print(f"\n{'='*55}")
    print("  ✅ Paneles actualizados")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()
