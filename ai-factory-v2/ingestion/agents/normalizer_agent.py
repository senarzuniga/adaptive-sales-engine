"""Normalizer agent for currency, units, and dedupe keys."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from ingestion.models.extracted_data import ExtractedData, NormalizedData
from ingestion.normalizers.currency_normalizer import CurrencyNormalizer
from ingestion.normalizers.product_matcher import ProductMatcher
from ingestion.normalizers.unit_normalizer import UnitNormalizer


class NormalizerAgent:
    def __init__(self) -> None:
        self.currency_normalizer = CurrencyNormalizer()
        self.unit_normalizer = UnitNormalizer()
        self.matcher = ProductMatcher()

    async def normalize(self, extracted: ExtractedData) -> NormalizedData:
        payload = dict(extracted.content)

        price = payload.get("price_estimated") if isinstance(payload.get("price_estimated"), dict) else None
        if price:
            eur_value, eur_ccy = self.currency_normalizer.normalize(price.get("value"), price.get("currency"))
            payload["price_estimated"] = {"value": eur_value, "currency": eur_ccy}

        specs = payload.get("specifications") if isinstance(payload.get("specifications"), dict) else {}
        if isinstance(specs.get("speed"), dict):
            speed_val, speed_unit = self.unit_normalizer.normalize_speed(specs["speed"].get("value"), specs["speed"].get("unit"))
            specs["speed"] = {"value": speed_val, "unit": speed_unit}
        if isinstance(specs.get("width"), dict):
            width_val, width_unit = self.unit_normalizer.normalize_width(specs["width"].get("value"), specs["width"].get("unit"))
            specs["width"] = {"value": width_val, "unit": width_unit}
        if specs:
            payload["specifications"] = specs

        dedupe_key = self.matcher.dedupe_key(
            payload.get("product_name"),
            payload.get("manufacturer"),
            extracted.url,
        )

        return NormalizedData(
            source_id=extracted.source_id,
            source_name=extracted.source_name,
            url=extracted.url,
            data_type=extracted.data_type,
            normalized_at=datetime.utcnow(),
            normalized_content=payload,
            confidence_score=extracted.confidence_score,
            dedupe_key=dedupe_key,
        )


# ---------------------------------------------------------------------------
# Orchestrator-compatible synchronous adapter
# ---------------------------------------------------------------------------

def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Synchronous adapter so this agent participates in the main agent cascade.

    Normalises price data extracted from scraped pages (context['scraped_web_content'])
    using the CurrencyNormalizer from the ingestion package.
    """
    if context is None:
        context = {}

    scraped_pages: List[Dict[str, Any]] = context.get("scraped_web_content") or []

    if not scraped_pages:
        return {
            "status": "success",
            "output": "Normalizer listo. Procesará precios y unidades de las fuentes web scrapeadas.",
            "insights": [
                "Normaliza monedas (EUR/USD/GBP) y unidades físicas (m/s, mm, rpm).",
                "Activa el scraping web para que este agente procese datos reales.",
            ],
        }

    normalizer = CurrencyNormalizer()
    normalized_prices: List[Dict[str, Any]] = []

    for page in scraped_pages[:5]:
        text = page.get("text_snippet", "")
        url = page.get("url", "unknown")
        price_matches = re.findall(r"(EUR|USD|GBP|€|\$)\s?([\d\.,]{3,12})", text)
        for ccy_raw, val_raw in price_matches[:5]:
            try:
                val = float(val_raw.replace(".", "").replace(",", "."))
                eur_val, eur_ccy = normalizer.normalize(val, ccy_raw)
                normalized_prices.append({
                    "url": url[:60],
                    "original": f"{ccy_raw} {val_raw}",
                    "eur_value": round(eur_val or val, 2),
                })
            except Exception:
                continue

    if not normalized_prices:
        return {
            "status": "success",
            "output": "Normalización completada. Sin precios detectables en el contenido web.",
            "insights": ["No se encontraron patrones de precios en los textos scrapeados."],
        }

    insights = [f"{p['original']} → EUR {p['eur_value']:,.2f}" for p in normalized_prices[:5]]
    return {
        "status": "success",
        "output": f"Normalización completada: {len(normalized_prices)} precios normalizados a EUR.",
        "insights": insights,
        "normalized_prices": normalized_prices,
    }
