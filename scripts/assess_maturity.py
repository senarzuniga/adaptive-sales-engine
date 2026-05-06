#!/usr/bin/env python3
"""
assess_maturity.py — Evaluates the maturity of each module in streamlit_app.py.

Produces MATURITY_REPORT.md with scores for:
- functional_coverage (0-100): How many reference capabilities are implemented?
- protocol_score (0-100): Are there documented, executable workflows?
- ux_score (0-100): Does the module follow professional UI/UX patterns?
- overall (0-100): Weighted average of the three dimensions.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

# ── Scoring rules ──────────────────────────────────────────────────────────────
# Each module defines:
#   - function_name: the page_* function in streamlit_app.py
#   - reference_apps: tools used as benchmark
#   - capability_patterns: (capability_name, regex_pattern) pairs
#   - protocol_patterns: regex patterns indicating a protocol/checklist exists
#   - ux_patterns: regex patterns indicating professional UX elements

MODULE_DEFINITIONS: list[dict] = [
    {
        "name": "Dashboard",
        "function_name": "page_dashboard",
        "reference_apps": ["Salesforce Einstein Analytics", "Tableau", "Power BI"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("KPIs en tiempo real", r"st\.metric"),
            ("Drill-down interactivo", r"st\.expander|plotly_chart"),
            ("Alertas predictivas", r"st\.warning|st\.error"),
            ("Personalización por rol", r"department|profile.*get"),
            ("Gráficos interactivos", r"px\.|plotly"),
        ],
        "protocol_patterns": [r"st\.expander|protocol|checklist"],
        "ux_patterns": [r"st\.columns|st\.metric|use_container_width"],
    },
    {
        "name": "Actions",
        "function_name": "page_actions",
        "reference_apps": ["Asana", "Monday.com", "Salesforce Tasks"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("CRUD completo", r"supabase.*insert|supabase.*update|supabase.*delete"),
            ("Filtros de estado", r"selectbox.*estado|status_filter"),
            ("Exportación Excel", r"ExcelWriter|to_excel"),
            ("Importación Excel", r"read_excel|file_uploader"),
            ("Historial / auditoría", r"last_modified|created_at"),
        ],
        "protocol_patterns": [r"st\.expander|protocol"],
        "ux_patterns": [r"st\.columns|use_container_width|st\.container"],
    },
    {
        "name": "Offers",
        "function_name": "page_offers",
        "reference_apps": ["Salesforce CPQ", "PandaDoc", "DocuSign"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("Motor de cálculo de costes", r"calculate_total_cost|cost_engine"),
            ("Múltiples versiones", r"version|serial_number"),
            ("Estados de oferta", r"status_v2|draft|sent|approved"),
            ("Exportación PDF/Excel", r"download_button|ExcelWriter"),
            ("Origen desde solicitud", r"from_request|current_request"),
        ],
        "protocol_patterns": [r"st\.expander|workflow|approval"],
        "ux_patterns": [r"st\.columns|st\.metric|use_container_width"],
    },
    {
        "name": "Request Pool",
        "function_name": "page_requests",
        "reference_apps": ["Salesforce Service Cloud", "Zendesk", "HubSpot Service Hub"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("Gestión de solicitudes", r"customer_requests"),
            ("Priorización por deadline", r"deadline|priority|days_left"),
            ("Declinar con motivo", r"declined|decline_reason"),
            ("Routing a oferta", r"offer_mode|current_request"),
            ("Alertas de urgencia", r"priority-danger|st\.warning"),
        ],
        "protocol_patterns": [r"st\.expander|protocol"],
        "ux_patterns": [r"st\.columns|priority-danger|use_container_width"],
    },
    {
        "name": "Cost Modules",
        "function_name": "page_cost_modules",
        "reference_apps": ["Oracle Fusion Costing", "SAP Product Costing", "Epicor"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("Módulos predefinidos", r"PREDEFINED_COST_MODULES"),
            ("Cálculo de flete", r"calculate_freight_cost|FREIGHT_BASE_RATES"),
            ("Porcentajes de coste", r"is_percentage|percentage_of"),
            ("Exportación", r"download_button|to_csv"),
            ("Múltiples destinos", r"FREIGHT_BASE_RATES|destination"),
        ],
        "protocol_patterns": [r"st\.expander|protocol"],
        "ux_patterns": [r"st\.columns|st\.metric|use_container_width"],
    },
    {
        "name": "Business Intelligence",
        "function_name": "page_business_intelligence",
        "reference_apps": ["Looker", "Domo", "ThoughtSpot"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("KPI metrics", r"st\.metric"),
            ("Gráficos de tendencia", r"px\.line|plotly_chart"),
            ("Segmentación de datos", r"selectbox|melt|segmento"),
            ("Informes programados", r"report_freq|informe.*programado"),
            ("Exploración de datos", r"bi_query|consulta"),
        ],
        "protocol_patterns": [r"st\.expander.*protocolo|protocol_steps_bi"],
        "ux_patterns": [r"st\.columns|st\.metric|use_container_width"],
    },
    {
        "name": "Budget Command Center",
        "function_name": "page_budget_command_center",
        "reference_apps": ["Anaplan", "Vareto", "Cube"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("Simulación what-if", r"ajuste_[abc]|what.if|slider"),
            ("Tracking de desviaciones", r"Desviaci.n|desviacion"),
            ("Alertas de desviación", r"st\.warning.*desviaci|alerta.*desviaci"),
            ("Exportación de escenarios", r"download_button|to_csv"),
            ("Visualización de barras", r"px\.bar|plotly_chart"),
        ],
        "protocol_patterns": [r"st\.expander.*protocolo|protocol"],
        "ux_patterns": [r"st\.columns|st\.metric|use_container_width"],
    },
    {
        "name": "Key Account Management",
        "function_name": "page_key_account_management",
        "reference_apps": ["Gainsight", "Salesforce CRM", "HubSpot Sales Hub"],
        "missing_capabilities": [],
        "capability_patterns": [
            ("Tabla de cuentas clave", r"kam_accounts|key.*account"),
            ("Health Score", r"Health_Score|health_score"),
            ("Alertas de riesgo", r"alertas_kam|NPS.*alerta|Days_sin_contacto"),
            ("Visualización horizontal", r"orientation.*h|px\.bar"),
            ("Exportación", r"download_button|to_csv"),
        ],
        "protocol_patterns": [r"protocol_steps|st\.expander.*protocolo"],
        "ux_patterns": [r"st\.columns|st\.metric|background_gradient"],
    },
    {
        "name": "Pipeline Manager",
        "function_name": "page_pipeline_manager",
        "reference_apps": ["Salesforce Sales Cloud", "HubSpot CRM", "Pipedrive"],
        "missing_capabilities": [
            "Vista kanban del pipeline",
            "Forecast de cierre por probabilidad",
            "Alertas de estancamiento",
            "Análisis de conversión por etapa",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Market Intelligence",
        "function_name": "page_market_intelligence",
        "reference_apps": ["Crayon", "Klue", "Bombora"],
        "missing_capabilities": [
            "Monitoreo de señales del mercado",
            "Alertas de cambio en competidores",
            "Análisis de tendencias de la industria",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Competitive Analysis",
        "function_name": "page_competitive_analysis",
        "reference_apps": ["Klue", "Crayon", "Kompyte"],
        "missing_capabilities": [
            "Battlecards por competidor",
            "Win/loss analysis",
            "Seguimiento de precios de competidores",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Customer Success",
        "function_name": "page_customer_success",
        "reference_apps": ["Gainsight", "ChurnZero", "Totango"],
        "missing_capabilities": [
            "Customer Health Score en tiempo real",
            "Alertas de riesgo de churn",
            "Playbooks de onboarding",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Revenue Forecasting",
        "function_name": "page_revenue_forecasting",
        "reference_apps": ["Clari", "Gong Forecast", "Salesforce Forecasting"],
        "missing_capabilities": [
            "Forecast por representante/región",
            "Escenarios optimista/base/pesimista",
            "Comparativa real vs forecast",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Portfolio Analysis",
        "function_name": "page_portfolio_analysis",
        "reference_apps": ["Alphasense", "Bloomberg Terminal", "FactSet"],
        "missing_capabilities": [
            "Matriz BCG dinámica",
            "Análisis de concentración",
            "Simulación de riesgo",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Weekly Planner",
        "function_name": "page_weekly_planner",
        "reference_apps": ["Outreach", "Salesloft", "Clari"],
        "missing_capabilities": [
            "Secuencias de tareas automatizadas",
            "Cadencia por etapa del cliente",
            "Integración con calendario",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Saved Companies",
        "function_name": "page_saved_companies",
        "reference_apps": ["LinkedIn Sales Navigator", "ZoomInfo", "Apollo.io"],
        "missing_capabilities": [
            "Enriquecimiento automático de datos",
            "Scoring de prospectos",
            "Alertas de cambio de empresa",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Sales Analytics",
        "function_name": "page_sales_analytics",
        "reference_apps": ["Salesforce Einstein", "Gong", "Chorus"],
        "missing_capabilities": [
            "Análisis de actividad comercial",
            "Leaderboard de rendimiento",
            "Tendencias de win rate",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Territory Management",
        "function_name": "page_territory_management",
        "reference_apps": ["Salesforce Territory Management", "Xactly Territories", "Varicent"],
        "missing_capabilities": [
            "Diseño de territorios por regla",
            "Balanceo de carga comercial",
            "Mapa visual de cobertura",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Campaign Manager",
        "function_name": "page_campaign_manager",
        "reference_apps": ["HubSpot Marketing Hub", "Marketo", "Salesforce Marketing Cloud"],
        "missing_capabilities": [
            "Segmentación de audiencias",
            "Automatización de secuencias email",
            "Tracking de ROI por campaña",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Contract Management",
        "function_name": "page_contract_management",
        "reference_apps": ["Ironclad", "DocuSign CLM", "Conga"],
        "missing_capabilities": [
            "Ciclo de vida completo del contrato",
            "Alertas de vencimiento",
            "Aprobaciones multi-firma",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Product Catalog",
        "function_name": "page_product_catalog",
        "reference_apps": ["Salesforce CPQ", "SAP Variant Configuration", "Zuora"],
        "missing_capabilities": [
            "Configurador de productos",
            "Reglas de precios dinámicas",
            "Gestión de bundles",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
    {
        "name": "Team Management",
        "function_name": "page_team_management",
        "reference_apps": ["Salesforce Sales Cloud", "Workday", "BambooHR"],
        "missing_capabilities": [
            "Gestión de cuotas y objetivos",
            "Performance dashboard por rep",
            "Onboarding checklist",
        ],
        "capability_patterns": [],
        "protocol_patterns": [],
        "ux_patterns": [],
    },
]


def _extract_function_body(source: str, function_name: str) -> str:
    """Extract the body of a function from source code."""
    pattern = rf"def {function_name}\s*\(.*?\).*?(?=\ndef |\Z)"
    match = re.search(pattern, source, re.DOTALL)
    return match.group(0) if match else ""


def _score_patterns(body: str, patterns: list[tuple[str, str]]) -> tuple[int, list[str], list[str]]:
    """Score a function body against capability patterns.

    Returns (score_0_100, implemented_list, missing_list).
    """
    if not patterns:
        return 0, [], []

    implemented = []
    missing = []
    for capability, pattern in patterns:
        if re.search(pattern, body):
            implemented.append(capability)
        else:
            missing.append(capability)

    score = int(len(implemented) / len(patterns) * 100)
    return score, implemented, missing


def _score_ux(body: str, ux_patterns: list[str]) -> int:
    if not ux_patterns:
        return 0
    hits = sum(1 for p in ux_patterns if re.search(p, body))
    return int(hits / len(ux_patterns) * 100)


def _score_protocol(body: str, protocol_patterns: list[str]) -> int:
    if not protocol_patterns:
        return 0
    hits = sum(1 for p in protocol_patterns if re.search(p, body))
    return int(hits / len(protocol_patterns) * 100)


def assess(source_path: Path) -> list[dict]:
    source = source_path.read_text(encoding="utf-8")
    results = []

    for mod in MODULE_DEFINITIONS:
        fn_body = _extract_function_body(source, mod["function_name"])
        exists = bool(fn_body)

        if not exists:
            results.append(
                {
                    "name": mod["name"],
                    "exists": False,
                    "functional_coverage": 0,
                    "protocol_score": 0,
                    "ux_score": 0,
                    "overall": 0,
                    "implemented_capabilities": [],
                    "missing_capabilities": mod.get("missing_capabilities", []),
                    "reference_apps": mod["reference_apps"],
                }
            )
            continue

        fc_score, implemented, missing_from_patterns = _score_patterns(fn_body, mod["capability_patterns"])
        # Merge missing from patterns with any pre-defined missing capabilities
        missing_caps = list(dict.fromkeys(missing_from_patterns + mod.get("missing_capabilities", [])))

        proto_score = _score_protocol(fn_body, mod["protocol_patterns"])
        ux_score = _score_ux(fn_body, mod["ux_patterns"])

        # Weighted average: functional 50%, ux 30%, protocol 20%
        overall = int(fc_score * 0.5 + ux_score * 0.3 + proto_score * 0.2)
        # Clamp to minimum 20 if function exists but patterns list is empty
        if exists and not mod["capability_patterns"]:
            overall = 0

        results.append(
            {
                "name": mod["name"],
                "exists": exists,
                "functional_coverage": fc_score,
                "protocol_score": proto_score,
                "ux_score": ux_score,
                "overall": overall,
                "implemented_capabilities": implemented,
                "missing_capabilities": missing_caps,
                "reference_apps": mod["reference_apps"],
            }
        )

    return results


def render_report(results: list[dict]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# MATURITY REPORT",
        f"_Generated: {now}_",
        "",
        "## Summary table",
        "",
        "| Module | Functional | Protocol | UX | Overall |",
        "|--------|-----------|----------|----|---------|",
    ]

    for r in results:
        lines.append(
            f"| {r['name']} | {r['functional_coverage']}% | {r['protocol_score']}% "
            f"| {r['ux_score']}% | {r['overall']}% |"
        )

    lines += ["", "---", "", "## Module details", ""]

    for r in results:
        lines.append(f"### {r['name']}")
        lines.append(f"- **Status**: {'✅ Implemented' if r['exists'] else '⬜ Not implemented'}")
        lines.append(f"- **functional_coverage**: {r['functional_coverage']}%")
        lines.append(f"- **protocol_score**: {r['protocol_score']}%")
        lines.append(f"- **ux_score**: {r['ux_score']}%")
        lines.append(f"- **overall**: {r['overall']}%")
        lines.append(f"- **References**: {', '.join(r['reference_apps'])}")
        if r["implemented_capabilities"]:
            lines.append(f"- **Implemented**: {', '.join(r['implemented_capabilities'])}")
        if r["missing_capabilities"]:
            lines.append(f"- **Missing**: {', '.join(r['missing_capabilities'])}")
        lines.append("")

    implemented_count = sum(1 for r in results if r["exists"])
    avg_overall = sum(r["overall"] for r in results if r["exists"]) // max(implemented_count, 1)
    lines += [
        "---",
        "",
        f"**Modules implemented**: {implemented_count}/{len(results)}",
        f"**Average maturity (implemented)**: {avg_overall}%",
        f"**Total modules planned**: {len(results)}",
    ]

    return "\n".join(lines)


def main() -> None:
    source_path = Path("streamlit_app.py")
    if not source_path.exists():
        print(f"ERROR: {source_path} not found. Run from repo root.")
        raise SystemExit(1)

    print(f"Assessing maturity of {source_path} …")
    results = assess(source_path)

    report = render_report(results)
    Path("MATURITY_REPORT.md").write_text(report, encoding="utf-8")
    print("✅ MATURITY_REPORT.md written")

    for r in results:
        status = "✅" if r["exists"] else "⬜"
        print(f"  {status} {r['name']:30s} overall={r['overall']:3d}%")


if __name__ == "__main__":
    main()
