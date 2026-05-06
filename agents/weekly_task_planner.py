"""
Weekly Task Planner – Genera tareas de seguimiento, loyalty, cross-selling y friendship actions.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd


_TASK_TEMPLATES = [
    {
        "type": "follow_up",
        "priority": "Alta",
        "template": "Seguimiento oferta {ref} con {customer} — confirmar decisión de compra",
        "days_out": 2,
    },
    {
        "type": "loyalty",
        "priority": "Media",
        "template": "Llamada de valor con {customer} — revisar satisfacción y próximas necesidades",
        "days_out": 5,
    },
    {
        "type": "cross_sell",
        "priority": "Alta",
        "template": "Propuesta cross-selling {product} para {customer} — alineado a su segmento",
        "days_out": 3,
    },
    {
        "type": "friendship",
        "priority": "Baja",
        "template": "Enviar artículo de interés / novedad de sector a {customer}",
        "days_out": 7,
    },
    {
        "type": "review",
        "priority": "Media",
        "template": "Revisión QBR con {customer} — presentar métricas de valor entregado",
        "days_out": 14,
    },
    {
        "type": "upsell",
        "priority": "Alta",
        "template": "Identificar oportunidad upsell en cuenta {customer} — análisis de base instalada",
        "days_out": 4,
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

    today = datetime.utcnow().date()
    tasks: List[Dict] = []

    # Extract top customers from data
    top_customers: List[str] = []
    top_products: List[str] = []

    if df is not None and isinstance(df, pd.DataFrame) and not df.empty:
        cust_candidates = ["Customer Name", "customer", "cliente", "company"]
        for c in cust_candidates:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                top_customers = df[matched[0]].dropna().astype(str).value_counts().head(5).index.tolist()
                break

        prod_candidates = ["Scope product Family", "product Family", "familia", "product"]
        for c in prod_candidates:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                top_products = df[matched[0]].dropna().astype(str).value_counts().head(3).index.tolist()
                break

    # Add saved companies
    if saved_companies:
        for comp in saved_companies[:5]:
            name = comp.get("name") or comp.get("company_name") or str(comp)
            if name and name not in top_customers:
                top_customers.append(str(name))

    if not top_customers:
        top_customers = ["Cliente Principal", "Cuenta Clave A", "Cliente Estratégico"]
    if not top_products:
        top_products = ["Solución Estándar", "Servicio Premium"]

    # Generate tasks
    for i, template_def in enumerate(_TASK_TEMPLATES):
        customer = top_customers[i % len(top_customers)]
        product = top_products[i % len(top_products)]
        due_date = today + timedelta(days=template_def["days_out"])
        task_text = template_def["template"].format(
            customer=customer, product=product, ref=f"OFR-{2024 + i:04d}"
        )
        tasks.append({
            "week_day": due_date.strftime("%A"),
            "due_date": due_date.isoformat(),
            "type": template_def["type"],
            "priority": template_def["priority"],
            "task": task_text,
            "customer": customer,
        })

    # Sort by due date then priority
    priority_order = {"Alta": 0, "Media": 1, "Baja": 2}
    tasks.sort(key=lambda t: (t["due_date"], priority_order.get(t["priority"], 9)))

    alta_count = len([t for t in tasks if t["priority"] == "Alta"])
    media_count = len([t for t in tasks if t["priority"] == "Media"])
    baja_count = len([t for t in tasks if t["priority"] == "Baja"])

    insights = [
        f"Plan semanal generado: {len(tasks)} tareas",
        f"🔴 Alta prioridad: {alta_count} tareas",
        f"🟡 Media prioridad: {media_count} tareas",
        f"🟢 Baja prioridad: {baja_count} tareas",
        f"Semana del {today.isoformat()} — {(today + timedelta(days=6)).isoformat()}",
    ]

    return {
        "status": "success",
        "output": f"Plan semanal con {len(tasks)} tareas para {len(set(t['customer'] for t in tasks))} cuentas.",
        "insights": insights,
        "tasks": tasks,
        "week_start": today.isoformat(),
        "summary": {
            "total": len(tasks),
            "alta": alta_count,
            "media": media_count,
            "baja": baja_count,
        },
    }


if __name__ == "__main__":
    import json
    res = run()
    print(json.dumps(res, indent=2, default=str))
