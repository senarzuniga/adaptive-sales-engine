#!/usr/bin/env python3
"""
prioritize_improvement.py — Selects the highest-impact next improvement.

Reads MATURITY_REPORT.md and PROFESSIONAL_REFERENCES.yaml, applies a
heuristic scoring model, and writes IMPROVEMENT_PLAN.md with ranked
improvements.

Heuristic scoring:
    impact_score = (100 - overall_maturity) * strategic_weight
    effort_score = (inverse of implementation complexity)
    priority = impact_score * 0.7 + effort_score * 0.3
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

# ── Improvement catalogue ──────────────────────────────────────────────────────
# Each entry describes a concrete improvement that can be auto-implemented.
# "template" points to the file in /templates/ that auto_implement.py will use.
# "requires_module_missing" means the improvement only applies if the module
# function doesn't exist yet.

IMPROVEMENTS: list[dict] = [
    {
        "id": "budget_command_center_whatsif",
        "module": "Budget Command Center",
        "title": "Simulación What-If con sliders + alertas de desviación",
        "description": (
            "Añade motor de simulación de escenarios presupuestarios con sliders interactivos, "
            "alertas cuando la desviación supera el 10%, gráfico de barras de desviación y "
            "exportación de escenarios como CSV."
        ),
        "gap_type": "simulation",
        "template": "templates/budget_command_center.py.tpl",
        "page_key": "budget_command_center",
        "nav_label": "💰 Budget Command Center",
        "strategic_weight": 0.95,
        "effort": "low",
        "requires_module_missing": True,
    },
    {
        "id": "key_account_management_protocol",
        "module": "Key Account Management",
        "title": "Protocolo KAM + Customer Health Score + alertas de riesgo",
        "description": (
            "Implementa gestión de cuentas clave con protocolo de 6 pasos (Gainsight-style), "
            "tabla con Health Score y NPS, alertas automáticas de NPS negativo / sin contacto "
            ">30 días / Health Score crítico, y exportación."
        ),
        "gap_type": "protocol",
        "template": "templates/key_account_management.py.tpl",
        "page_key": "key_account_management",
        "nav_label": "🏆 Key Account Management",
        "strategic_weight": 0.90,
        "effort": "low",
        "requires_module_missing": True,
    },
    {
        "id": "business_intelligence_dashboard",
        "module": "Business Intelligence",
        "title": "Dashboard BI con KPIs, tendencias y exploración de datos",
        "description": (
            "Crea módulo de Business Intelligence con KPI cards por período, gráfico de tendencias "
            "por segmento, top-5 cuentas, distribución de pipeline, configuración de informes "
            "programados y exploración de consultas rápidas."
        ),
        "gap_type": "analytics",
        "template": "templates/business_intelligence.py.tpl",
        "page_key": "business_intelligence",
        "nav_label": "📊 Business Intelligence",
        "strategic_weight": 0.88,
        "effort": "low",
        "requires_module_missing": True,
    },
    {
        "id": "dashboard_trend_comparison",
        "module": "Dashboard",
        "title": "Comparativa con período anterior en KPIs del Dashboard",
        "description": (
            "Añade deltas de comparación período anterior a los KPIs del Dashboard, "
            "un gráfico de tendencia semanal de acciones y un resumen ejecutivo exportable."
        ),
        "gap_type": "analytics",
        "template": None,
        "page_key": "dashboard",
        "nav_label": None,
        "strategic_weight": 0.75,
        "effort": "medium",
        "requires_module_missing": False,
    },
    {
        "id": "cost_modules_whatsif",
        "module": "Cost Modules",
        "title": "Escenarios What-If en el motor de costes",
        "description": (
            "Añade simulación de escenarios (optimista/base/pesimista) al motor de costes "
            "con slider de ajuste de materiales y alerta de margen mínimo."
        ),
        "gap_type": "simulation",
        "template": None,
        "page_key": "cost_modules",
        "nav_label": None,
        "strategic_weight": 0.80,
        "effort": "medium",
        "requires_module_missing": False,
    },
]


def _parse_maturity_report(report_path: Path) -> dict[str, int]:
    """Extract overall maturity score per module from MATURITY_REPORT.md."""
    if not report_path.exists():
        return {}

    scores: dict[str, int] = {}
    content = report_path.read_text(encoding="utf-8")
    for line in content.splitlines():
        if line.startswith("| ") and "%" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 5 and parts[0] != "Module":
                module_name = parts[0]
                overall_str = parts[4].replace("%", "").strip()
                try:
                    scores[module_name] = int(float(overall_str))
                except ValueError:
                    pass
    return scores


def _score_improvement(improvement: dict, maturity_scores: dict[str, int]) -> float:
    module = improvement["module"]
    current_maturity = maturity_scores.get(module, 0)
    gap = 100 - current_maturity

    effort_map = {"low": 90, "medium": 60, "high": 30}
    effort_score = effort_map.get(improvement["effort"], 60)

    strategic = improvement["strategic_weight"]
    impact = gap * strategic

    return impact * 0.7 + effort_score * 0.3


def _is_implemented(improvement: dict, source: str) -> bool:
    """Check if this improvement is already in the source."""
    fn_name = f"page_{improvement['page_key']}"
    return bool(re.search(rf"def {fn_name}\s*\(", source))


def prioritize(source_path: Path, report_path: Path) -> list[dict]:
    maturity_scores = _parse_maturity_report(report_path)
    source = source_path.read_text(encoding="utf-8") if source_path.exists() else ""

    scored: list[dict] = []
    for imp in IMPROVEMENTS:
        already_implemented = _is_implemented(imp, source)
        if imp["requires_module_missing"] and already_implemented:
            continue

        score = _score_improvement(imp, maturity_scores)
        current_maturity = maturity_scores.get(imp["module"], 0)
        scored.append(
            {
                **imp,
                "priority_score": round(score, 1),
                "current_maturity": current_maturity,
                "already_implemented": already_implemented,
            }
        )

    scored.sort(key=lambda x: -x["priority_score"])
    return scored


def render_plan(ranked: list[dict]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# IMPROVEMENT PLAN",
        f"_Generated: {now}_",
        "",
        "## Ranked improvements",
        "",
        "| Rank | Module | Improvement | Priority Score | Current Maturity | Effort | Has Template |",
        "|------|--------|-------------|----------------|-----------------|--------|-------------|",
    ]

    for i, imp in enumerate(ranked, 1):
        has_tpl = "✅" if imp.get("template") else "⬜"
        lines.append(
            f"| {i} | {imp['module']} | {imp['title']} | {imp['priority_score']} "
            f"| {imp['current_maturity']}% | {imp['effort']} | {has_tpl} |"
        )

    lines += ["", "---", "", "## Detailed improvement briefs", ""]

    for i, imp in enumerate(ranked, 1):
        lines.append(f"### #{i} — {imp['title']}")
        lines.append(f"- **Module**: {imp['module']}")
        lines.append(f"- **Gap type**: {imp['gap_type']}")
        lines.append(f"- **Priority score**: {imp['priority_score']}")
        lines.append(f"- **Current maturity**: {imp['current_maturity']}%")
        lines.append(f"- **Effort**: {imp['effort']}")
        lines.append(f"- **Template**: {imp.get('template') or '(requires manual implementation)'}")
        lines.append(f"- **Description**: {imp['description']}")
        lines.append("")

    top = ranked[0] if ranked else None
    if top:
        lines += [
            "---",
            "",
            "## Next action",
            "",
            f"**Highest priority improvement**: {top['title']}",
            f"Run `python scripts/auto_implement.py --improvement {top['id']}` to implement.",
        ]

    return "\n".join(lines)


def main() -> None:
    source_path = Path("streamlit_app.py")
    report_path = Path("MATURITY_REPORT.md")

    if not source_path.exists():
        print("ERROR: streamlit_app.py not found. Run from repo root.")
        raise SystemExit(1)

    print("Prioritizing improvements …")
    ranked = prioritize(source_path, report_path)

    plan = render_plan(ranked)
    Path("IMPROVEMENT_PLAN.md").write_text(plan, encoding="utf-8")
    print("✅ IMPROVEMENT_PLAN.md written")

    print("\nTop 5 improvements by priority:")
    for i, imp in enumerate(ranked[:5], 1):
        tpl = "✅" if imp.get("template") else "⬜"
        print(f"  {i}. [{tpl}] {imp['module']:30s} — {imp['title']} (score={imp['priority_score']})")

    if ranked:
        print(f"\nRecommended next: {ranked[0]['id']}")


if __name__ == "__main__":
    main()
