"""
After-Sales Opportunity Agent – Identifica oportunidades en base instalada.
Cross-selling y up-selling en clientes existentes.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


_OPPORTUNITY_TYPES = [
    {
        "type": "mantenimiento_preventivo",
        "label": "🔧 Mantenimiento Preventivo",
        "description": "Contrato anual de mantenimiento + diagnóstico remoto",
        "value_range": "15-25% del valor de venta original",
        "trigger": "Equipos con >1 año de antigüedad sin contrato activo",
    },
    {
        "type": "upgrade_software",
        "label": "💻 Upgrade de Software / Firmware",
        "description": "Actualización a última versión con nuevas funcionalidades",
        "value_range": "10-15% del valor original",
        "trigger": "Versión instalada con >18 meses sin actualizar",
    },
    {
        "type": "expansion_capacidad",
        "label": "📈 Expansión de Capacidad",
        "description": "Módulos adicionales o ampliación del sistema existente",
        "value_range": "30-60% del valor original",
        "trigger": "Utilización >85% de capacidad instalada",
    },
    {
        "type": "formacion",
        "label": "🎓 Formación y Certificación",
        "description": "Programa de formación para maximizar el uso del sistema",
        "value_range": "5-10% del valor original",
        "trigger": "KPI de adopción <70% — cliente no usa todas las funciones",
    },
    {
        "type": "cross_sell_complementario",
        "label": "🔗 Producto Complementario",
        "description": "Solución complementaria que amplía el valor entregado",
        "value_range": "20-80% del valor original (nuevo producto)",
        "trigger": "Necesidad detectada en otras áreas del cliente",
    },
]


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")
    saved_companies: List[Dict] = context.get("saved_companies", []) or []

    if df is None:
        input_file = os.environ.get("AGENT_INPUT_FILE")
        if input_file and os.path.exists(input_file):
            try:
                df = pd.read_csv(input_file)
            except Exception:
                df = None

    opportunities: List[Dict] = []
    base_instalada_customers: List[str] = []

    if df is not None and isinstance(df, pd.DataFrame) and not df.empty:
        # Find customers with historical purchases
        cust_col = None
        rev_col = None
        date_col = None

        for c in ["Customer Name", "customer", "cliente", "company"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                cust_col = matched[0]
                break

        for c in ["Selling Price", "revenue", "ventas", "amount"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                rev_col = matched[0]
                break

        for c in ["PO date", "date", "fecha", "order date"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                date_col = matched[0]
                break

        if cust_col:
            base_instalada_customers = df[cust_col].dropna().astype(str).unique().tolist()[:10]

            # Calculate revenue per customer for opportunity sizing
            if rev_col:
                by_cust = (
                    df.groupby(cust_col)[rev_col]
                    .apply(lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum())
                    .sort_values(ascending=False)
                )
                for cust, total_rev in by_cust.head(5).items():
                    total_rev_f = float(total_rev)
                    for i, opp_type in enumerate(_OPPORTUNITY_TYPES[:3]):
                        opportunities.append({
                            "customer": str(cust),
                            "opportunity_type": opp_type["type"],
                            "label": opp_type["label"],
                            "description": opp_type["description"],
                            "estimated_value_range": opp_type["value_range"],
                            "trigger": opp_type["trigger"],
                            "base_revenue": round(total_rev_f, 2),
                            "priority": "Alta" if i == 0 else "Media",
                        })

    if not base_instalada_customers and saved_companies:
        for comp in saved_companies[:5]:
            name = comp.get("name") or comp.get("company_name")
            if name:
                base_instalada_customers.append(str(name))

    if not base_instalada_customers:
        base_instalada_customers = ["Cliente con Base Instalada A"]

    # If no data-driven opportunities, generate template ones
    if not opportunities:
        for customer in base_instalada_customers[:3]:
            for opp_type in _OPPORTUNITY_TYPES[:2]:
                opportunities.append({
                    "customer": customer,
                    "opportunity_type": opp_type["type"],
                    "label": opp_type["label"],
                    "description": opp_type["description"],
                    "estimated_value_range": opp_type["value_range"],
                    "trigger": opp_type["trigger"],
                    "base_revenue": None,
                    "priority": "Media",
                })

    alta = len([o for o in opportunities if o["priority"] == "Alta"])
    media = len([o for o in opportunities if o["priority"] == "Media"])

    insights = [
        f"Base instalada identificada: {len(base_instalada_customers)} clientes",
        f"Oportunidades detectadas: {len(opportunities)} ({alta} alta, {media} media prioridad)",
        "Mayor potencial: Contratos de mantenimiento preventivo",
        "Quick win: Upgrades en cuentas sin contrato activo",
        "Estrategia: Segmentar base instalada por antigüedad de compra",
    ]

    return {
        "status": "success",
        "output": f"{len(opportunities)} oportunidades post-venta identificadas en {len(base_instalada_customers)} cuentas.",
        "insights": insights,
        "opportunities": opportunities[:20],
        "installed_base_count": len(base_instalada_customers),
        "opportunity_types": [ot["label"] for ot in _OPPORTUNITY_TYPES],
        "total_opportunities": len(opportunities),
    }


if __name__ == "__main__":
    import json
    res = run()
    print(json.dumps(res, indent=2, default=str))
