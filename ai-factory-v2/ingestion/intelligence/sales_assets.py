from __future__ import annotations


def build_sales_asset(title: str, message: str, source_url: str) -> dict:
    return {
        "asset_type": "battle_card",
        "title": title,
        "summary": message,
        "cta": "Update KAM strategy and commercial action repository.",
        "source_url": source_url,
    }
