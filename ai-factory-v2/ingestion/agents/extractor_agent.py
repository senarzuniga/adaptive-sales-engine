"""Extractor agent that converts HTML into structured payloads."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from ingestion.extractors.news_extractor import NewsExtractor
from ingestion.extractors.price_extractor import PriceExtractor
from ingestion.extractors.product_extractor import ProductExtractor
from ingestion.extractors.spec_extractor import SpecExtractor
from ingestion.models.extracted_data import ExtractedData


class ExtractorAgent:
    def __init__(self, openai_client: Any | None):
        self.product_extractor = ProductExtractor(openai_client)
        self.price_extractor = PriceExtractor()
        self.spec_extractor = SpecExtractor()
        self.news_extractor = NewsExtractor()

    async def extract(self, html: str, source_id: str, source_name: str, url: str, data_type: str) -> ExtractedData:
        if data_type == "news":
            payload, confidence = await self.news_extractor.extract(html)
        elif data_type == "price":
            payload, confidence = await self.price_extractor.extract(html)
        elif data_type == "specs":
            payload, confidence = await self.spec_extractor.extract(html)
        else:
            payload, confidence = await self.product_extractor.extract(html, source_name, url)

        content_hash = hashlib.sha256(html.encode("utf-8", errors="ignore")).hexdigest()
        return ExtractedData(
            source_id=source_id,
            source_name=source_name,
            url=url,
            data_type=data_type,
            extracted_at=datetime.utcnow(),
            content=payload,
            confidence_score=confidence,
            content_hash=content_hash,
        )


# ---------------------------------------------------------------------------
# Orchestrator-compatible synchronous adapter
# ---------------------------------------------------------------------------

def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Synchronous adapter so this agent participates in the main agent cascade.

    Extracts structured data (headlines, prices, specs) from scraped web pages
    in context['scraped_web_content'] using the lightweight sync extractors.
    """
    if context is None:
        context = {}

    scraped_pages: List[Dict[str, Any]] = context.get("scraped_web_content") or []

    if not scraped_pages:
        return {
            "status": "success",
            "output": "Extractor listo. Procesará contenido HTML de las fuentes web scrapeadas.",
            "insights": [
                "Extrae titulares, precios, especificaciones y señales de noticias.",
                "Activa el scraping web para recibir contenido procesable.",
            ],
        }

    # Use the sync extractors directly (avoid asyncio overhead for simple parsing)
    news_extractor = NewsExtractor()
    price_extractor = PriceExtractor()

    extractions: List[Dict[str, Any]] = []
    for page in scraped_pages[:5]:
        text = page.get("text_snippet", "")
        url = page.get("url", "unknown")
        if not text:
            continue

        # News extraction (sync-friendly: pure regex)
        text_clean = re.sub(r"\s+", " ", text)[:3000]
        impact = (
            "high"
            if any(k in text_clean.lower() for k in ["acquisition", "plant", "expansion", "price increase"])
            else "medium"
        )
        prices = []
        for raw in re.findall(r"(?:EUR|USD|€|\$)\s?([\d\.,]{3,12})", text_clean)[:5]:
            try:
                prices.append(float(raw.replace(".", "").replace(",", ".")))
            except ValueError:
                pass

        extractions.append({
            "url": url[:60],
            "headline": text_clean[:180],
            "impact": impact,
            "prices_detected": prices,
        })

    insights = [
        f"[{e['url']}] impact={e['impact']}, precios={e['prices_detected'][:3]}"
        for e in extractions[:3]
    ]
    return {
        "status": "success",
        "output": f"Extracción completada: {len(extractions)} páginas procesadas.",
        "insights": insights,
        "extractions": extractions,
    }
