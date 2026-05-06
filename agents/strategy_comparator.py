"""
Strategy Comparator – Compara resultados reales vs plan estratégico.
Gap analysis y desviaciones 1 año / 3 años.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df_real: Optional[pd.DataFrame] = context.get("uploaded_data")
    df_strategy: Optional[pd.DataFrame] = context.get("estrategia_data")

    if df_real is None:
        input_file = os.environ.get("AGENT_INPUT_FILE")
        if input_file and os.path.exists(input_file):
            try:
                df_real = pd.read_csv(input_file)
            except Exception:
                df_real = None

    if df_real is None or not isinstance(df_real, pd.DataFrame) or df_real.empty:
        return {
            "status": "success",
            "output": "Sube datos históricos y plantilla estratégica para comparar.",
            "insights": [
                "Compara ventas reales vs objetivos del plan estratégico",
                "Gap analysis por familia de producto y área geográfica",
                "Semáforo de desviación: verde <10%, amarillo <20%, rojo >20%",
            ],
            "gaps": [],
            "overall_gap_pct": None,
            "status_label": "sin_datos",
        }

    # Try to find revenue column in real data
    rev_candidates = ["Selling Price", "revenue", "ventas", "importe", "amount", "Est Revenue"]
    rev_col_real = None
    for c in rev_candidates:
        matched = [col for col in df_real.columns if col.lower() == c.lower()]
        if matched:
            rev_col_real = matched[0]
            break

    total_real = 0.0
    if rev_col_real:
        total_real = float(pd.to_numeric(df_real[rev_col_real], errors="coerce").fillna(0).sum())

    gaps: List[Dict] = []
    overall_gap_pct: Optional[float] = None

    if df_strategy is not None and isinstance(df_strategy, pd.DataFrame) and not df_strategy.empty:
        rev_col_strat = None
        for c in rev_candidates:
            matched = [col for col in df_strategy.columns if col.lower() == c.lower()]
            if matched:
                rev_col_strat = matched[0]
                break

        if rev_col_strat:
            total_plan = float(
                pd.to_numeric(df_strategy[rev_col_strat], errors="coerce").fillna(0).sum()
            )
            if total_plan:
                gap = total_real - total_plan
                overall_gap_pct = gap / total_plan * 100
                if overall_gap_pct >= -10:
                    status_label = "🟢 En objetivo"
                elif overall_gap_pct >= -20:
                    status_label = "🟡 Desviación moderada"
                else:
                    status_label = "🔴 Desviación crítica"

                gaps.append({
                    "dimension": "Revenue total",
                    "real": round(total_real, 2),
                    "plan": round(total_plan, 2),
                    "gap": round(gap, 2),
                    "gap_pct": round(overall_gap_pct, 1),
                    "status": status_label,
                })
    else:
        # No strategy loaded → produce insights vs own historical trend
        status_label = "⚠️ Sin plan estratégico cargado"

    # Per-family gap if both datasets have product family
    fam_candidates = ["Scope product Family", "product Family", "familia", "product family"]
    fam_col_real = None
    for c in fam_candidates:
        matched = [col for col in df_real.columns if col.lower() == c.lower()]
        if matched:
            fam_col_real = matched[0]
            break

    if fam_col_real and rev_col_real:
        by_family = (
            df_real.groupby(fam_col_real)[rev_col_real]
            .apply(lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum())
            .sort_values(ascending=False)
            .head(5)
        )
        for fam, val in by_family.items():
            gaps.append({
                "dimension": f"Familia: {fam}",
                "real": round(float(val), 2),
                "plan": None,
                "gap": None,
                "gap_pct": None,
                "status": "📊 Real",
            })

    insights = [
        f"Revenue real total: {total_real:,.0f}",
        f"Gaps analizados: {len(gaps)}",
    ]
    if overall_gap_pct is not None:
        insights.append(f"Desviación global: {overall_gap_pct:+.1f}%")
    if not df_strategy:
        insights.append("Carga template_estrategia.xlsx para comparativa completa")

    return {
        "status": "success",
        "output": f"Gap analysis completado. {len(gaps)} dimensiones comparadas.",
        "insights": insights,
        "gaps": gaps,
        "overall_gap_pct": round(overall_gap_pct, 1) if overall_gap_pct is not None else None,
        "total_real": round(total_real, 2),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run(), indent=2, default=str))
