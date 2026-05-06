"""
Template generator – creates Excel download templates in memory.
Used by page_company_setup() in streamlit_app.py.
"""
from __future__ import annotations

import io
from typing import Dict, List


_TEMPLATES: Dict[str, List[str]] = {
    "template_historico": [
        "PO date", "First offer date", "Opp Internal Number", "Geographical Area",
        "Customer Country", "Customer Name", "Scope product Family", "Segment",
        "Purchasing Year", "Purchasing Quarter", "Purchasing Month",
        "Selling Price", "Margin", "KAM",
    ],
    "template_oportunidades": [
        "Opp/Offer Number", "Status", "Geographical Area", "Customer Country",
        "Customer Name", "Scope product Family", "Segment",
        "Estimated Purchasing Year", "Estimated Purchasing Quarter",
        "Est Revenue", "Contract Prob. %", "Margin", "KAM",
    ],
    "template_productos": [
        "Name", "Average value", "Commodity/innovation/decline", "Comments",
    ],
    "template_estrategia": [
        "product Family", "number of Segment", "Geographical Area",
        "estimated Purchasing Quarter", "Est Revenue", "Margin", "KAM",
    ],
}


def get_template_bytes(template_name: str) -> bytes:
    """Return an in-memory Excel file with headers only for the given template."""
    import pandas as pd

    columns = _TEMPLATES.get(template_name)
    if columns is None:
        raise ValueError(f"Template '{template_name}' not found.")
    df = pd.DataFrame(columns=columns)
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


def template_info() -> Dict[str, Dict]:
    return {
        "template_historico": {
            "label": "📊 Histórico de Ventas",
            "description": "Datos históricos de pedidos — base para todos los análisis",
            "columns": _TEMPLATES["template_historico"],
        },
        "template_oportunidades": {
            "label": "🎯 Pipeline de Oportunidades",
            "description": "Oportunidades activas y pipeline de ventas",
            "columns": _TEMPLATES["template_oportunidades"],
        },
        "template_productos": {
            "label": "📦 Catálogo de Productos",
            "description": "Clasificación de productos: commodity / innovación / declive",
            "columns": _TEMPLATES["template_productos"],
        },
        "template_estrategia": {
            "label": "🏆 Plan Estratégico",
            "description": "Objetivos del plan estratégico a 1 y 3 años",
            "columns": _TEMPLATES["template_estrategia"],
        },
    }
