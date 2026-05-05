"""Extractor agent that converts HTML into structured payloads."""

from __future__ import annotations

from datetime import datetime
import hashlib
from typing import Any

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
