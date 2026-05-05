from __future__ import annotations


def build_pricing_insight(payload: dict) -> dict | None:
    price = payload.get("price_estimated") if isinstance(payload.get("price_estimated"), dict) else None
    if not price or price.get("value") is None:
        return None
    value = float(price["value"])
    if value > 350000:
        impact = "high"
        message = "Competitor premium pricing detected. Reinforce value-selling and service differentiation."
    elif value > 120000:
        impact = "medium"
        message = "Mid-high pricing band detected. Opportunity for bundle optimization."
    else:
        impact = "low"
        message = "Lower pricing tier detected. Prepare cost-plus fallback strategy."
    return {"impact": impact, "message": message, "price_eur": value}
