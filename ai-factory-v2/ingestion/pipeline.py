"""Main intelligent ingestion pipeline (Discovery -> Extraction -> Structuring -> Intelligence)."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from ingestion.utils.logging import logger

from ingestion.agents.extractor_agent import ExtractorAgent
from ingestion.agents.intelligence_agent import IntelligenceAgent
from ingestion.agents.normalizer_agent import NormalizerAgent
from ingestion.agents.planner_agent import PlannerAgent
from ingestion.agents.sales_agent import SalesAgent
from ingestion.agents.scraper_agent import ScraperAgent
from ingestion.storage.raw_storage import RawStorage
from ingestion.storage.structured_db import StructuredDB


class IngestionPipeline:
    def __init__(self, supabase_client: Any | None, openai_client: Any | None, config_path: str = "config/sources.yaml"):
        self.planner = PlannerAgent(supabase_client, config_path=config_path)
        self.scraper = ScraperAgent()
        self.extractor = ExtractorAgent(openai_client)
        self.normalizer = NormalizerAgent()
        self.intelligence = IntelligenceAgent(openai_client)
        self.sales = SalesAgent(supabase_client)
        self.raw_storage = RawStorage(supabase_client)
        self.structured_db = StructuredDB(supabase_client)

        self.stats = {
            "jobs_processed": 0,
            "successful_scrapes": 0,
            "failed_scrapes": 0,
            "extractions_done": 0,
            "actions_created": 0,
        }

    async def process_job(self, job) -> None:
        result = await self.scraper.scrape(
            url=job.url,
            source_id=job.source_id,
            source_name=job.source_name,
            scraper_type=job.scraper_type,
            wait_for_selector=job.selectors.get("wait_for") if job.selectors else None,
        )

        if not result.success or not result.html_content:
            await self.raw_storage.save_error(job.source_id, job.source_name, job.url, result.error_message or "unknown")
            self.stats["failed_scrapes"] += 1
            logger.warning("Failed scrape {} {}", job.source_name, result.error_message)
            return

        extracted = await self.extractor.extract(
            html=result.html_content,
            source_id=job.source_id,
            source_name=job.source_name,
            url=job.url,
            data_type=job.data_type,
        )

        await self.raw_storage.save_html(job.source_id, job.source_name, job.url, result.html_content, extracted.content_hash or "")

        normalized = await self.normalizer.normalize(extracted)
        await self.structured_db.save_normalized_data(normalized)

        intel_outputs = await self.intelligence.analyze_record(
            source_id=normalized.source_id,
            source_name=normalized.source_name,
            source_url=normalized.url,
            payload=normalized.normalized_content,
        )
        await self.structured_db.save_intelligence_outputs(intel_outputs)

        created = await self.sales.create_actions(intel_outputs)

        self.stats["jobs_processed"] += 1
        self.stats["successful_scrapes"] += 1
        self.stats["extractions_done"] += 1
        self.stats["actions_created"] += created

    async def run_cycle_once(self, events: list[dict] | None = None) -> dict:
        await self.planner.run_planning_cycle(events=events or [])
        while True:
            job = await self.planner.get_next_job()
            if not job:
                break
            await self.process_job(job)
            await asyncio.sleep(0.2)
        await self.intelligence.run_analysis_cycle()
        return dict(self.stats)

    async def run_continuous_cycle(self, interval_seconds: int = 300) -> None:
        logger.info("Starting continuous ingestion pipeline")
        while True:
            try:
                stats = await self.run_cycle_once(events=[])
                logger.info("Cycle completed: {}", stats)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Pipeline cycle failed: {}", exc)
            await asyncio.sleep(interval_seconds)


def build_pipeline(supabase_client: Any | None, openai_client: Any | None, config_path: str = "config/sources.yaml") -> IngestionPipeline:
    return IngestionPipeline(supabase_client=supabase_client, openai_client=openai_client, config_path=config_path)


if __name__ == "__main__":
    # Manual smoke run without external providers.
    pipeline = build_pipeline(None, None)
    print("Ingestion pipeline ready", datetime.utcnow().isoformat())
