from __future__ import annotations

import re


class PriceExtractor:
    async def extract(self, html: str) -> tuple[dict, float]:
        text = re.sub(r"\s+", " ", html)
        matches = re.findall(r"(?:EUR|USD|€|\$)\s?([\d\.,]{3,20})", text)
        prices = []
        for raw in matches[:20]:
            normalized = raw.replace(".", "").replace(",", ".")
            try:
                prices.append(float(normalized))
            except ValueError:
                continue
        return {"price_points": prices, "currency_hint": "mixed"}, 0.65 if prices else 0.35
