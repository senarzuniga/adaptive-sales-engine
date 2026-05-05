from __future__ import annotations

import asyncio
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingestion.agents.planner_agent import PlannerAgent
from ingestion.pipeline import IngestionPipeline


def test_planner_loads_sources() -> None:
    planner = PlannerAgent(None, config_path=str(ROOT / "config" / "sources.yaml"))
    assert len(planner.sources) >= 5


def test_planner_creates_jobs_from_schedule() -> None:
    planner = PlannerAgent(None, config_path=str(ROOT / "config" / "sources.yaml"))

    async def _run():
        await planner.run_planning_cycle(events=[])
        return planner.queue_size

    queue_size = asyncio.run(_run())
    assert queue_size > 0


def test_pipeline_cycle_without_external_clients() -> None:
    pipeline = IngestionPipeline(None, None, config_path=str(ROOT / "config" / "sources.yaml"))

    async def _run():
        return await pipeline.run_cycle_once(events=[])

    stats = asyncio.run(_run())
    assert "jobs_processed" in stats
    assert "failed_scrapes" in stats
