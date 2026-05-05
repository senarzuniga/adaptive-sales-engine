from __future__ import annotations

import re


class NewsExtractor:
    async def extract(self, html: str) -> tuple[dict, float]:
        text = re.sub(r"\s+", " ", html)[:3000]
        impact = "high" if any(k in text.lower() for k in ["acquisition", "plant", "expansion", "price increase"]) else "medium"
        return {
            "headline": text[:180],
            "summary": text[:500],
            "impact_level": impact,
            "commercial_implication": "Review pricing and opportunity targeting.",
        }, 0.6
