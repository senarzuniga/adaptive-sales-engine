"""Planner agent for multi-source ingestion orchestration."""

from __future__ import annotations

import asyncio
from datetime import datetime
import heapq
from pathlib import Path
from typing import Any

from ingestion.utils.logging import logger

from ingestion.models.source_config import PRIORITY_WEIGHT, ScrapingJob, SourceConfig
from ingestion.sources.source_registry import SourceRegistry


class PlannerAgent:
    def __init__(self, supabase_client: Any, config_path: str = "config/sources.yaml"):
        self.supabase = supabase_client
        self.registry = SourceRegistry(Path(config_path))
        self.sources: list[SourceConfig] = self.registry.load()
        self._priority_heap: list[tuple[int, float, int, ScrapingJob]] = []
        self._counter: int = 0
        self._lock = asyncio.Lock()

    def _is_due(self, source: SourceConfig, now: datetime) -> bool:
        if not source.is_active:
            return False
        if source.last_scraped is None:
            return True
        elapsed_hours = (now - source.last_scraped).total_seconds() / 3600
        return elapsed_hours >= source.scraping_frequency_hours

    def get_due_sources(self) -> list[SourceConfig]:
        now = datetime.now()
        return [s for s in self.sources if self._is_due(s, now)]

    def get_triggered_sources(self, events: list[dict]) -> list[SourceConfig]:
        if not events:
            return []

        by_id = {s.id: s for s in self.sources}
        triggered: dict[str, SourceConfig] = {}
        for event in events:
            source_id = event.get("source_id")
            event_type = event.get("type")
            if source_id and source_id in by_id:
                source = by_id[source_id]
                if event_type in source.event_triggers:
                    triggered[source.id] = source
            else:
                for source in self.sources:
                    if event_type in source.event_triggers:
                        triggered[source.id] = source
        return list(triggered.values())

    async def create_scraping_jobs(self, sources: list[SourceConfig], triggered_by: str) -> list[ScrapingJob]:
        jobs: list[ScrapingJob] = []
        now = datetime.now()
        for source in sources:
            jobs.append(
                ScrapingJob(
                    source_id=source.id,
                    source_name=source.name,
                    url=source.url,
                    scraper_type=source.scraper_type,
                    priority=source.priority,
                    triggered_by=triggered_by,
                    scheduled_at=now,
                    selectors=source.selectors,
                    data_type=source.data_type,
                )
            )
        return jobs

    async def _enqueue(self, job: ScrapingJob) -> None:
        async with self._lock:
            weight = PRIORITY_WEIGHT[job.priority]
            heapq.heappush(self._priority_heap, (weight, job.scheduled_at.timestamp(), self._counter, job))
            self._counter += 1

    async def run_planning_cycle(self, events: list[dict] | None = None) -> None:
        events = events or []
        due_sources = self.get_due_sources()
        triggered_sources = self.get_triggered_sources(events)

        jobs: list[ScrapingJob] = []
        jobs.extend(await self.create_scraping_jobs(due_sources, "schedule"))
        jobs.extend(await self.create_scraping_jobs(triggered_sources, "event"))

        dedup: dict[str, ScrapingJob] = {f"{j.source_id}:{j.triggered_by}": j for j in jobs}
        for job in dedup.values():
            await self._enqueue(job)

        logger.info("Planner enqueued {} jobs (schedule={}, event={})", len(dedup), len(due_sources), len(triggered_sources))
        await self.log_planning_cycle(
            {
                "timestamp": datetime.now().isoformat(),
                "scheduled_jobs": len(due_sources),
                "event_jobs": len(triggered_sources),
                "queue_size": self.queue_size,
            }
        )

    async def log_planning_cycle(self, payload: dict[str, Any]) -> None:
        if not self.supabase:
            return
        try:
            self.supabase.table("ingestion_planning_log").insert(payload).execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not persist planner audit log: {}", exc)

    @property
    def queue_size(self) -> int:
        return len(self._priority_heap)

    async def get_next_job(self) -> ScrapingJob | None:
        async with self._lock:
            if not self._priority_heap:
                return None
            _, _, _, job = heapq.heappop(self._priority_heap)
            return job
