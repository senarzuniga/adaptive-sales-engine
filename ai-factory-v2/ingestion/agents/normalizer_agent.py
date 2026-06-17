"""Normalizer agent for currency, units, and dedupe keys."""

from __future__ import annotations

from datetime import datetime

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


def run(context: dict | None = None):
    """Synchronous wrapper to normalize a single ExtractedData-like object.

    Expects `context['extracted']` to be an object compatible with
    `ExtractedData` or a dict-like with required fields.
    """
    try:
        inst = NormalizerAgent()
        if not context or not isinstance(context, dict) or not context.get("extracted"):
            return {"status": "no_run", "output": "NormalizerAgent requires 'extracted' in context.", "insights": []}

        extracted = context.get("extracted")
        import asyncio

        loop = asyncio.new_event_loop()
        try:
            res = loop.run_until_complete(inst.normalize(extracted))
        finally:
            loop.close()

        try:
            normalized = res.__dict__
        except Exception:
            normalized = str(res)

        return {"status": "success", "output": "normalized", "insights": [], "normalized": normalized}
    except Exception as e:
        return {"status": "error", "error": str(e), "output": str(e), "insights": []}
