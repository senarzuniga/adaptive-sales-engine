from __future__ import annotations


def build_competitor_signal(source_name: str, payload: dict) -> dict:
    manufacturer = payload.get("manufacturer") or source_name
    product_name = payload.get("product_name") or "unknown"
    title = f"Competitor update: {manufacturer}"
    message = f"Detected product/page signal for '{product_name}' from {source_name}."
    return {"title": title, "message": message, "competitor": manufacturer}
