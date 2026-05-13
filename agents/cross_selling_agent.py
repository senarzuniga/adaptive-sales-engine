"""
Cross-Selling Agent — Identificación de oportunidades de venta cruzada
=======================================================================
• Matriz de afinidad de productos
• Estimación de valor potencial por oportunidad
• Generación de scripts de venta y plantillas de email
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Product affinity matrix (generic B2B industrial) ──────────
# Tuple: (product_a_keyword, product_b_keyword, affinity_score, rationale)
_AFFINITY_RULES: List[tuple] = [
    ("bomba",       "filtro",       0.85, "Bombas requieren filtración — propuesta de mantenimiento preventivo"),
    ("motor",       "variador",     0.90, "Motores eléctricos + variadores de frecuencia = eficiencia energética"),
    ("compresor",   "secador",      0.88, "Compresores de aire comprimen humedad — secadores complementarios"),
    ("valvula",     "actuador",     0.82, "Válvulas manuales → actuadores eléctricos/neumáticos (automatización)"),
    ("sensor",      "plc",          0.80, "Sensores necesitan PLC o controlador para cerrar el bucle"),
    ("panel",       "cableado",     0.78, "Paneles eléctricos → cableado y protecciones asociadas"),
    ("robot",       "gripper",      0.92, "Robots industriales necesitan efectores finales"),
    ("conveyor",    "sensor",       0.75, "Cintas transportadoras → sensores de detección y control"),
    ("mantenimiento","repuesto",    0.88, "Contratos mantenimiento → consumibles y recambios periódicos"),
    ("instalacion", "formacion",    0.72, "Instalación de equipos → formación del personal técnico"),
    ("proyecto",    "postventa",    0.80, "Proyectos entregados → contratos de postventa/soporte"),
    ("caldera",     "quemador",     0.87, "Calderas → quemadores de repuesto + mantenimiento"),
    ("compresor",   "mantenimiento",0.85, "Compresores → contratos mantenimiento preventivo"),
    ("software",    "formacion",    0.78, "Software industrial → formación y actualizaciones"),
    ("maquinaria",  "repuesto",     0.82, "Maquinaria vendida → stock de repuestos críticos"),
]


def _build_client_product_matrix(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Build {client: [products_purchased]} map."""
    client_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["customer", "cliente", "company"])),
        None,
    )
    product_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["product", "producto", "familia", "family", "description"])),
        None,
    )
    if not client_col or not product_col:
        return {}

    matrix: Dict[str, List[str]] = {}
    for _, row in df.iterrows():
        client = str(row.get(client_col, "")).strip()
        product = str(row.get(product_col, "")).strip()
        if client and product and client != "N/D" and product != "N/D":
            matrix.setdefault(client, [])
            if product not in matrix[client]:
                matrix[client].append(product)
    return matrix


def _find_cross_sell_opportunities(
    client: str,
    purchased: List[str],
    avg_ticket: float,
) -> List[Dict[str, Any]]:
    """Apply affinity rules to find cross-sell opportunities."""
    opportunities: List[Dict[str, Any]] = []
    purchased_lower = [p.lower() for p in purchased]

    for rule in _AFFINITY_RULES:
        a_kw, b_kw, score, rationale = rule
        # Check if client has product_a but NOT product_b
        has_a = any(a_kw in p for p in purchased_lower)
        has_b = any(b_kw in p for p in purchased_lower)
        if has_a and not has_b:
            estimated_value = avg_ticket * score * 0.6  # conservative estimate
            opportunities.append({
                "client": client,
                "has_product": a_kw,
                "cross_sell_product": b_kw,
                "affinity_score": score,
                "rationale": rationale,
                "estimated_value": round(estimated_value, 2),
                "priority": "HIGH" if score >= 0.85 else ("MEDIUM" if score >= 0.75 else "LOW"),
            })

    return sorted(opportunities, key=lambda x: -x["affinity_score"])


def _generate_email_template(client: str, has_product: str, cross_sell: str) -> str:
    """Generate a short B2B email for the cross-sell opportunity."""
    return (
        f"Asunto: Propuesta de solución complementaria para optimizar su {has_product}\n\n"
        f"Estimado equipo de {client},\n\n"
        f"Dado que ya trabaja con nosotros en soluciones de {has_product}, "
        f"identificamos una oportunidad de mejora: incorporar {cross_sell} a su proceso "
        f"puede aumentar la eficiencia operativa y reducir costes de mantenimiento.\n\n"
        f"¿Le interesaría recibir una propuesta técnica sin compromiso?\n\n"
        f"Quedamos a su disposición.\n"
        f"Un saludo,\n[Nombre Comercial] — Adaptive Sales Engine"
    )


def _generate_sales_script(has_product: str, cross_sell: str, rationale: str) -> str:
    """Generate a brief sales call script."""
    return (
        f"OPENING: 'Hola [nombre], le llamo porque trabajamos juntos en {has_product} "
        f"y he identificado algo que puede ser muy valioso para ustedes.'\n\n"
        f"HOOK: '{rationale}'\n\n"
        f"OFERTA: 'Tenemos una solución de {cross_sell} que se integra perfectamente "
        f"con lo que ya tienen. ¿Tiene 10 minutos para que le explique cómo funciona?'\n\n"
        f"CIERRE: '¿Prefiere que prepare una propuesta técnica o una demo en sus instalaciones?'"
    )


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        df: Optional[pd.DataFrame] = context.get("uploaded_data")

        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return {
                "status": "success",
                "output": "Cross-Selling Agent: No hay datos de ventas. Cargue el histórico para identificar oportunidades.",
                "insights": ["📂 Cargue histórico de ventas con columnas cliente y producto"],
                "opportunities": [],
            }

        # Build client-product matrix
        client_products = _build_client_product_matrix(df)

        if not client_products:
            return {
                "status": "success",
                "output": "Cross-Selling Agent: No se pudieron extraer columnas cliente/producto del archivo cargado.",
                "insights": ["⚠️ Verifique que el archivo tiene columnas 'Customer' y 'Product'"],
                "opportunities": [],
            }

        # Compute average ticket
        rev_col = next(
            (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
            None,
        )
        avg_ticket = float(pd.to_numeric(df[rev_col], errors="coerce").mean() or 10000) if rev_col else 10000.0

        # Find opportunities
        all_opportunities: List[Dict[str, Any]] = []
        email_templates: Dict[str, str] = {}
        sales_scripts: Dict[str, str] = {}

        for client, products in client_products.items():
            opps = _find_cross_sell_opportunities(client, products, avg_ticket)
            all_opportunities.extend(opps[:3])  # top 3 per client

            # Generate content for top opportunity
            if opps:
                top = opps[0]
                key = f"{client}_{top['cross_sell_product']}"
                email_templates[key] = _generate_email_template(
                    client, top["has_product"], top["cross_sell_product"]
                )
                sales_scripts[key] = _generate_sales_script(
                    top["has_product"], top["cross_sell_product"], top["rationale"]
                )

        # Sort all opportunities by value
        all_opportunities.sort(key=lambda x: -x.get("estimated_value", 0))

        total_potential = sum(o.get("estimated_value", 0) for o in all_opportunities)
        high_priority = [o for o in all_opportunities if o["priority"] == "HIGH"]

        insights = [
            f"🔄 {len(all_opportunities)} oportunidades cross-sell identificadas en {len(client_products)} clientes",
            f"💰 Valor potencial total estimado: {total_potential:,.0f} €",
            f"🎯 Oportunidades HIGH priority: {len(high_priority)}",
        ]

        if all_opportunities:
            top_opp = all_opportunities[0]
            insights.append(
                f"⭐ Top oportunidad: {top_opp['client']} — {top_opp['has_product']} → {top_opp['cross_sell_product']} "
                f"(valor estimado: {top_opp['estimated_value']:,.0f} €)"
            )
            insights.append(f"📧 {len(email_templates)} plantillas de email generadas")
            insights.append(f"📞 {len(sales_scripts)} scripts de llamada generados")

        return {
            "status": "success",
            "output": (
                f"Cross-Selling Agent: {len(all_opportunities)} oportunidades detectadas, "
                f"potencial {total_potential:,.0f} €."
            ),
            "insights": insights,
            "opportunities": all_opportunities[:20],  # top 20
            "total_potential_value": round(total_potential, 2),
            "email_templates": email_templates,
            "sales_scripts": sales_scripts,
            "clients_analyzed": len(client_products),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("CrossSelling error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Cross-Selling Agent: {exc}",
            "insights": [],
            "opportunities": [],
        }
