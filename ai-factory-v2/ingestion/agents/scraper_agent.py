"""Scraper agent and result model."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

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


# ---------------------------------------------------------------------------
# Orchestrator-compatible synchronous adapter
# ---------------------------------------------------------------------------

def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Synchronous adapter so this agent participates in the main agent cascade.

    Scrapes any URL found in context['scrape_urls'] (list) or context['scrape_url']
    (string) using a plain HTTP GET (requests library).  If no URL is provided,
    returns a ready-state result.
    """
    if context is None:
        context = {}

    urls: List[str] = context.get("scrape_urls") or []
    single = context.get("scrape_url") or ""
    if single and single not in urls:
        urls = [single] + list(urls)

    active_company = context.get("active_company") or {}
    company_name = (
        active_company.get("company_name") or active_company.get("name", "")
    )

    if not urls:
        return {
            "status": "success",
            "output": (
                "Scraper listo. Proporciona URLs en contexto['scrape_urls'] "
                "para activar el scraping web bajo demanda."
            ),
            "insights": [
                "Añade URLs competidoras o de mercado para análisis web en tiempo real.",
                f"Empresa activa: {company_name}" if company_name else "Sin empresa activa configurada.",
            ],
            "scraped_pages": [],
        }

    scraped_pages: List[Dict[str, Any]] = []
    try:
        import requests as _requests
    except ImportError:
        return {
            "status": "error",
            "error": "requests library not available",
            "output": "No se puede realizar scraping: librería requests no instalada.",
            "insights": [],
        }

    for url in urls[:5]:  # limit to 5 URLs per cascade
        t0 = time.perf_counter()
        try:
            resp = _requests.get(
                url,
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SalesEngineBot/1.0)"},
                allow_redirects=True,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000
            # Extract plain text snippet
            text = re.sub(r"<[^>]+>", " ", resp.text)
            text = re.sub(r"\s+", " ", text).strip()[:2000]
            scraped_pages.append({
                "url": url,
                "status_code": resp.status_code,
                "success": resp.ok,
                "text_snippet": text,
                "elapsed_ms": round(elapsed_ms, 1),
            })
        except Exception as exc:
            scraped_pages.append({
                "url": url,
                "success": False,
                "error": str(exc),
                "text_snippet": "",
            })

    success_count = sum(1 for p in scraped_pages if p.get("success"))
    insights = [f"Scrapeadas {success_count}/{len(scraped_pages)} URLs correctamente."]
    for page in scraped_pages[:3]:
        if page.get("success") and page.get("text_snippet"):
            insights.append(f"[{page['url'][:60]}]: {page['text_snippet'][:120]}…")

    return {
        "status": "success",
        "output": f"Scraping completado: {success_count}/{len(scraped_pages)} URLs procesadas.",
        "insights": insights,
        "scraped_pages": scraped_pages,
    }
