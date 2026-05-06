"""
Product Lifecycle Analyzer – Clasifica productos como commodity/innovación/declive.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


_LIFECYCLE_RULES = {
    "innovacion": {
        "keywords": ["new", "nuevo", "proto", "r&d", "advanced", "smart", "digital", "ai", "iot"],
        "margin_threshold": 30.0,
        "label": "🚀 Innovación",
        "action": "Escalar ventas — diferenciar en propuesta de valor",
    },
    "commodity": {
        "keywords": ["standard", "estándar", "basic", "basic", "regular", "generic", "genérico"],
        "margin_threshold": 15.0,
        "label": "📦 Commodity",
        "action": "Defender margen — bundle con servicios / soluciones",
    },
    "declive": {
        "keywords": ["legacy", "old", "obsolete", "obsoleto", "discontinued", "descontinuado", "end-of-life"],
        "margin_threshold": 0.0,
        "label": "⚠️ Declive",
        "action": "Plan de retirada — cross-sell hacia sustitutos",
    },
}


def _classify_product(name: str, avg_value: float, margin: Optional[float], comments: str) -> Dict:
    name_lower = (name or "").lower()
    comment_lower = (comments or "").lower()
    combined = f"{name_lower} {comment_lower}"

    # Check keywords
    for cat, rules in _LIFECYCLE_RULES.items():
        if any(kw in combined for kw in rules["keywords"]):
            return {"category": cat, "label": rules["label"], "action": rules["action"]}

    # Classify by margin if available
    if margin is not None and not pd.isna(margin):
        if margin >= 30:
            return {
                "category": "innovacion",
                "label": _LIFECYCLE_RULES["innovacion"]["label"],
                "action": _LIFECYCLE_RULES["innovacion"]["action"],
            }
        elif margin >= 15:
            return {
                "category": "commodity",
                "label": _LIFECYCLE_RULES["commodity"]["label"],
                "action": _LIFECYCLE_RULES["commodity"]["action"],
            }
        else:
            return {
                "category": "declive",
                "label": _LIFECYCLE_RULES["declive"]["label"],
                "action": _LIFECYCLE_RULES["declive"]["action"],
            }

    # Default to commodity
    return {
        "category": "commodity",
        "label": _LIFECYCLE_RULES["commodity"]["label"],
        "action": _LIFECYCLE_RULES["commodity"]["action"],
    }


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")
    productos_df: Optional[pd.DataFrame] = context.get("productos_data")

    if df is None:
        input_file = os.environ.get("AGENT_INPUT_FILE")
        if input_file and os.path.exists(input_file):
            try:
                df = pd.read_csv(input_file)
            except Exception:
                df = None

    # Use productos_data if available, else fall back to uploaded_data
    working_df = productos_df if (productos_df is not None and not productos_df.empty) else df

    if working_df is None or not isinstance(working_df, pd.DataFrame) or working_df.empty:
        return {
            "status": "success",
            "output": "Sin catálogo de productos. Sube template_productos.xlsx para clasificar.",
            "insights": [
                "Clasifica productos: Innovación (>30% margen), Commodity (15-30%), Declive (<15%)",
                "Usa keywords: 'legacy', 'new', 'standard' para clasificación automática",
                "Genera matriz de posición y acciones estratégicas por producto",
            ],
            "matrix": [],
            "counts": {"innovacion": 0, "commodity": 0, "declive": 0},
        }

    products: List[Dict] = []
    counts = {"innovacion": 0, "commodity": 0, "declive": 0}

    name_col = None
    for c in ["Name", "nombre", "product", "name", "Scope product Family", "product Family"]:
        matched = [col for col in working_df.columns if col.lower() == c.lower()]
        if matched:
            name_col = matched[0]
            break

    margin_col = None
    for c in ["Margin", "margen", "margin"]:
        matched = [col for col in working_df.columns if col.lower() == c.lower()]
        if matched:
            margin_col = matched[0]
            break

    value_col = None
    for c in ["Average value", "Selling Price", "revenue", "ventas", "amount"]:
        matched = [col for col in working_df.columns if col.lower() == c.lower()]
        if matched:
            value_col = matched[0]
            break

    comment_col = None
    for c in ["Comments", "comentarios", "notes", "Commodity/innovation/decline"]:
        matched = [col for col in working_df.columns if col.lower() == c.lower()]
        if matched:
            comment_col = matched[0]
            break

    # If comment_col contains the classification directly, use it
    if comment_col and "commodity/innovation/decline" in (comment_col or "").lower():
        for _, row in working_df.iterrows():
            name = str(row[name_col]) if name_col else "Producto"
            classification_raw = str(row[comment_col]).lower() if not pd.isna(row[comment_col]) else ""
            avg_val = float(row[value_col]) if value_col and not pd.isna(row[value_col]) else 0.0
            margin = float(row[margin_col]) if margin_col and not pd.isna(row[margin_col]) else None

            if "innovacion" in classification_raw or "innovation" in classification_raw:
                cat = "innovacion"
            elif "declive" in classification_raw or "decline" in classification_raw:
                cat = "declive"
            else:
                cat = "commodity"

            result = _lifecycle_rules_cat(cat)
            counts[cat] = counts.get(cat, 0) + 1
            products.append({"name": name, "avg_value": avg_val, "margin": margin, **result})
    else:
        for _, row in working_df.iterrows():
            name = str(row[name_col]) if name_col else "Producto"
            avg_val = float(row[value_col]) if value_col and not pd.isna(row.get(value_col, None)) else 0.0
            margin = None
            if margin_col and margin_col in row.index and not pd.isna(row[margin_col]):
                margin = float(row[margin_col])
            comments = str(row[comment_col]) if comment_col and comment_col in row.index else ""
            result = _classify_product(name, avg_val, margin, comments)
            counts[result["category"]] = counts.get(result["category"], 0) + 1
            products.append({"name": name, "avg_value": avg_val, "margin": margin, **result})

    total = len(products)
    insights = [
        f"Productos analizados: {total}",
        f"🚀 Innovación: {counts.get('innovacion', 0)} ({counts.get('innovacion', 0)/total*100:.0f}%)" if total else "Sin productos",
        f"📦 Commodity: {counts.get('commodity', 0)} ({counts.get('commodity', 0)/total*100:.0f}%)" if total else "",
        f"⚠️ Declive: {counts.get('declive', 0)} ({counts.get('declive', 0)/total*100:.0f}%)" if total else "",
        "Revisa los productos en declive para plan de sustitución",
    ]

    return {
        "status": "success",
        "output": f"{total} productos clasificados. Innovación: {counts.get('innovacion',0)}, Commodity: {counts.get('commodity',0)}, Declive: {counts.get('declive',0)}.",
        "insights": [i for i in insights if i],
        "matrix": products[:20],
        "counts": counts,
    }


def _lifecycle_rules_cat(cat: str) -> Dict:
    return {
        "category": cat,
        "label": _LIFECYCLE_RULES[cat]["label"],
        "action": _LIFECYCLE_RULES[cat]["action"],
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run(), indent=2, default=str))
