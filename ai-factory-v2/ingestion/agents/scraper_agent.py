"""Scraper agent and result model."""

from __future__ import annotations

from dataclasses import dataclass

from ingestion.scrapers.antibot_scraper import AntiBotScraper
from ingestion.scrapers.dynamic_scraper import DynamicScraper
from ingestion.scrapers.static_scraper import StaticScraper


@dataclass
class ScrapingResult:
    source_id: str
    source_name: str
    url: str
    success: bool
    html_content: str | None = None
    error_message: str | None = None
    response_time_ms: float = 0
    status_code: int | None = None
    scraper_type: str = "static"


class ScraperAgent:
    def __init__(self) -> None:
        self.static_scraper = StaticScraper()
        self.dynamic_scraper = DynamicScraper()
        self.antibot_scraper = AntiBotScraper()

    async def scrape(self, url: str, source_id: str, source_name: str, scraper_type: str, **kwargs) -> ScrapingResult:
        if scraper_type == "dynamic":
            ok, html, status, elapsed, err = await self.dynamic_scraper.scrape(
                url,
                wait_for_selector=kwargs.get("wait_for_selector"),
            )
        elif scraper_type == "antibot":
            ok, html, status, elapsed, err = await self.antibot_scraper.scrape(url)
        else:
            ok, html, status, elapsed, err = await self.static_scraper.scrape(url)

        return ScrapingResult(
            source_id=source_id,
            source_name=source_name,
            url=url,
            success=ok,
            html_content=html,
            error_message=err,
            response_time_ms=elapsed,
            status_code=status,
            scraper_type=scraper_type,
        )
