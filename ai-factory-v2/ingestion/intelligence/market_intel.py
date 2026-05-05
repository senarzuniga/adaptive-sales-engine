from __future__ import annotations


def build_market_signal(payload: dict) -> dict | None:
    headline = (payload.get("headline") or "").lower()
    if not headline:
        return None
    key_terms = ["expansion", "investment", "new line", "capacity", "acquisition"]
    hit = [term for term in key_terms if term in headline]
    if not hit:
        return None
    return {
        "impact": "medium" if len(hit) == 1 else "high",
        "message": f"Market movement detected ({', '.join(hit)}).",
    }
