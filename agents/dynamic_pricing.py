"""
Dynamic Pricing Agent — Cálculo de precios óptimos basado en contexto
======================================================================
Estrategias: penetración, skimming, competitiva, basada en valor.
Factores: elasticidad, estacionalidad, inventario, valor cliente.
Output: precio recomendado + score de confianza + justificación.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Strategy catalogue ─────────────────────────────────────────
STRATEGIES = {
    "penetracion": {
        "name": "Penetración de mercado",
        "multiplier_range": (0.75, 0.90),
        "description": "Precio reducido para capturar cuota rápidamente",
        "recommended_when": "mercado nuevo, alta elasticidad, competencia intensa",
    },
    "skimming": {
        "name": "Descremado (Skimming)",
        "multiplier_range": (1.20, 1.50),
        "description": "Precio premium en lanzamiento para capturar valor máximo",
        "recommended_when": "producto innovador, baja elasticidad, sin sustitutos directos",
    },
    "competitiva": {
        "name": "Basada en competencia",
        "multiplier_range": (0.95, 1.05),
        "description": "Precio alineado con mercado para mantener competitividad",
        "recommended_when": "mercado maduro, producto commodity, alta sensibilidad al precio",
    },
    "valor": {
        "name": "Basada en valor (Value-Based)",
        "multiplier_range": (1.10, 1.35),
        "description": "Precio basado en el valor percibido por el cliente",
        "recommended_when": "cliente premium, solución única, relación consolidada",
    },
}

# ── Month seasonality factors (B2B industrial) ────────────────
_SEASONALITY = {
    1: 0.90,  # Jan – slow start
    2: 0.95,
    3: 1.05,  # Q1 budgets open
    4: 1.08,
    5: 1.05,
    6: 0.95,  # pre-summer slowdown
    7: 0.85,
    8: 0.80,  # August low
    9: 1.10,  # back-to-business
    10: 1.15,
    11: 1.10,
    12: 0.90,  # year-end budget flush
}


def _elasticity_factor(client_segment: str) -> float:
    """Price elasticity multiplier by segment."""
    mapping = {
        "premium": 0.15,
        "strategic": 0.10,
        "standard": 0.25,
        "price_sensitive": 0.35,
    }
    seg = str(client_segment).lower()
    for key, val in mapping.items():
        if key in seg:
            return val
    return 0.20  # default


def _client_value_multiplier(client_revenue: float, avg_revenue: float) -> float:
    """Adjust price based on client strategic value."""
    if avg_revenue <= 0:
        return 1.0
    ratio = client_revenue / avg_revenue
    if ratio >= 3.0:
        return 1.08   # top client → offer premium service, small discount acceptable
    if ratio >= 1.5:
        return 1.04
    if ratio < 0.5:
        return 0.97   # low-value client → be competitive
    return 1.0


def _recommend_strategy(
    product_type: str,
    client_segment: str,
    market_pressure: str,
) -> str:
    """Select best strategy from context signals."""
    pt = str(product_type).lower()
    cs = str(client_segment).lower()
    mp = str(market_pressure).lower()

    if "innov" in pt or "premium" in cs:
        return "valor"
    if "commodity" in pt or "high" in mp or "alta" in mp:
        return "competitiva"
    if "new" in cs or "nuevo" in cs:
        return "penetracion"
    return "valor"


def _calculate_price(
    base_price: float,
    strategy: str,
    season_factor: float,
    client_value_mult: float,
    elasticity: float,
    cost_floor: float,
) -> Dict[str, Any]:
    """Compute recommended price range and point estimate."""
    strat_info = STRATEGIES.get(strategy, STRATEGIES["valor"])
    low_mult, high_mult = strat_info["multiplier_range"]

    low_price  = base_price * low_mult  * season_factor * client_value_mult
    high_price = base_price * high_mult * season_factor * client_value_mult

    # Ensure above cost floor
    low_price  = max(low_price,  cost_floor * 1.05)
    high_price = max(high_price, cost_floor * 1.10)

    point_estimate = (low_price + high_price) / 2

    # Confidence score: 0-100 based on data completeness
    confidence = 70
    if base_price > 0:
        confidence += 10
    if cost_floor > 0:
        confidence += 10
    if season_factor != 1.0:
        confidence += 5
    if client_value_mult != 1.0:
        confidence += 5

    return {
        "recommended_price": round(point_estimate, 2),
        "price_range_low":   round(low_price, 2),
        "price_range_high":  round(high_price, 2),
        "strategy":          strategy,
        "strategy_name":     strat_info["name"],
        "confidence_score":  min(confidence, 100),
        "season_factor":     round(season_factor, 3),
        "client_value_mult": round(client_value_mult, 3),
        "elasticity":        elasticity,
        "margin_over_cost":  round((point_estimate - cost_floor) / point_estimate * 100, 1) if point_estimate > 0 else 0,
    }


def _analyze_product_portfolio(productos_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Generate pricing recommendations for each product in the catalogue."""
    results: List[Dict[str, Any]] = []
    import datetime

    current_month = datetime.datetime.now().month
    season_factor = _SEASONALITY.get(current_month, 1.0)

    for _, row in productos_df.iterrows():
        name = row.get("product_name", row.get("Name", row.get("nombre", "Producto")))
        avg_val = pd.to_numeric(row.get("average_value", row.get("Average value", 0)), errors="coerce") or 0
        positioning = str(row.get("positioning", row.get("commodity/innovation", "standard"))).lower()
        lifecycle = str(row.get("lifecycle_stage", row.get("lifecycle stage", "mature"))).lower()

        # Adjust strategy by lifecycle
        if "launch" in lifecycle or "lanzamiento" in lifecycle:
            strategy = "skimming"
        elif "decline" in lifecycle or "declive" in lifecycle:
            strategy = "competitiva"
        elif "innovation" in positioning or "innov" in positioning:
            strategy = "valor"
        elif "commodity" in positioning:
            strategy = "competitiva"
        else:
            strategy = "valor"

        if avg_val > 0:
            pricing = _calculate_price(
                base_price=avg_val,
                strategy=strategy,
                season_factor=season_factor,
                client_value_mult=1.0,
                elasticity=0.20,
                cost_floor=avg_val * 0.55,
            )
            results.append({
                "product": name,
                "positioning": positioning,
                "lifecycle": lifecycle,
                **pricing,
            })

    return results


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        import datetime
        current_month = datetime.datetime.now().month
        season_factor = _SEASONALITY.get(current_month, 1.0)

        # ── Portfolio-level pricing from products catalogue ─────
        productos_df = context.get("productos_data")
        portfolio_pricing: List[Dict[str, Any]] = []
        if isinstance(productos_df, pd.DataFrame) and not productos_df.empty:
            portfolio_pricing = _analyze_product_portfolio(productos_df)

        # ── Context-specific single product pricing ─────────────
        active_company = context.get("active_company") or {}
        if isinstance(active_company, dict):
            client_segment = active_company.get("segment", "standard")
            client_budget  = float(active_company.get("budget_1y", 0) or 0)
        else:
            client_segment = "standard"
            client_budget  = 0.0

        # Estimate avg client revenue from uploaded data
        uploaded = context.get("uploaded_data")
        avg_revenue = 0.0
        if isinstance(uploaded, pd.DataFrame) and not uploaded.empty:
            rev_col = next(
                (c for c in uploaded.columns if any(k in c.lower() for k in ["selling price", "revenue"])),
                None,
            )
            if rev_col:
                avg_revenue = float(pd.to_numeric(uploaded[rev_col], errors="coerce").mean() or 0)

        elasticity = _elasticity_factor(client_segment)
        client_mult = _client_value_multiplier(client_budget, max(avg_revenue, 1))

        insights: List[str] = [
            f"🗓️ Factor estacionalidad ({current_month}/12): {season_factor:.2f}x",
            f"🎯 Segmento cliente: {client_segment} | Elasticidad: {elasticity:.0%}",
            f"📊 Multiplicador valor cliente: {client_mult:.2f}x",
        ]

        if portfolio_pricing:
            by_strategy: Dict[str, int] = {}
            for p in portfolio_pricing:
                s = p.get("strategy_name", "")
                by_strategy[s] = by_strategy.get(s, 0) + 1
            strat_summary = ", ".join(f"{k}: {v}" for k, v in by_strategy.items())
            insights.append(f"🏷️ Estrategias en cartera: {strat_summary}")
            avg_confidence = sum(p.get("confidence_score", 0) for p in portfolio_pricing) / len(portfolio_pricing)
            insights.append(f"✅ Confianza media recomendaciones: {avg_confidence:.0f}%")

        output_msg = (
            f"Dynamic Pricing: {len(portfolio_pricing)} productos analizados, "
            f"factor estacional {season_factor:.2f}x, "
            f"segmento {client_segment}."
        )
        if not portfolio_pricing:
            output_msg = "Dynamic Pricing: Sin catálogo de productos. Cargue productos para análisis de precios."
            insights.append("📂 Cargue el catálogo de productos (plantilla templates/products_template.csv)")

        return {
            "status": "success",
            "output": output_msg,
            "insights": insights,
            "portfolio_pricing": portfolio_pricing,
            "season_factor": season_factor,
            "client_segment": client_segment,
            "client_value_multiplier": client_mult,
            "strategies": list(STRATEGIES.keys()),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("DynamicPricing error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Dynamic Pricing: {exc}",
            "insights": [],
        }
