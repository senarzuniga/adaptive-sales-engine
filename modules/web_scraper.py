"""
Professional Web Scraper – Adaptive Sales Engine
Lightweight market-intelligence scraper built on requests + BeautifulSoup.

All requests use a shared :class:`requests.Session` with a browser-like
``User-Agent`` and a configurable timeout.  Each scrape result is saved as
a JSON file under ``data/web_scraped/`` so it can be consumed by the data
loader.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_DEFAULT_UA = (
    "Mozilla/5.0 (compatible; AdaptiveSalesEngine/1.0; "
    "+https://github.com/senarzuniga/adaptive-sales-engine)"
)
_DEFAULT_TIMEOUT = 15  # seconds


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_get(
    session: requests.Session,
    url: str,
    timeout: int = _DEFAULT_TIMEOUT,
) -> Optional[requests.Response]:
    """GET *url*, returning ``None`` on any network/HTTP error."""
    try:
        resp = session.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp
    except requests.RequestException as exc:
        logger.warning("GET %s failed: %s", url, exc)
        return None


def _text_from(tag: Optional[Any]) -> str:
    return tag.get_text(separator=" ", strip=True) if tag else ""


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class ProfessionalWebScraper:
    """
    Market-intelligence scraper.

    Parameters
    ----------
    base_path:
        Project root used to write scraped JSON files.
        Defaults to the current working directory.
    output_dir:
        Sub-path (relative to *base_path*) where results are written.
    rate_limit:
        Minimum seconds between requests to the same host.
    """

    def __init__(
        self,
        base_path: Optional[str] = None,
        output_dir: str = "data/web_scraped",
        rate_limit: float = 1.5,
    ) -> None:
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.output_dir = self.base_path / output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.rate_limit = rate_limit

        self.session = requests.Session()
        self.session.headers.update({"User-Agent": _DEFAULT_UA})

        self._last_request: Dict[str, float] = {}  # host → timestamp

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scrape_url(self, url: str) -> Dict[str, Any]:
        """
        Scrape a single URL and return a structured result dict.

        The dict contains:
        - ``url``, ``title``, ``description``, ``headings``,
          ``paragraphs`` (first 10), ``links`` (first 20),
          ``scraped_at`` (ISO-8601).
        """
        self._throttle(url)
        resp = _safe_get(self.session, url)
        if resp is None:
            return {"url": url, "error": "request_failed", "scraped_at": _now()}

        soup = BeautifulSoup(resp.text, "html.parser")

        title = _text_from(soup.find("title"))
        description = ""
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            description = meta_desc.get("content", "")  # type: ignore[arg-type]

        headings = [
            _text_from(h)
            for h in soup.find_all(["h1", "h2", "h3"])
        ]
        paragraphs = [_text_from(p) for p in soup.find_all("p")][:10]
        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        links = [
            urljoin(base, a["href"])
            for a in soup.find_all("a", href=True)
            if not a["href"].startswith(("#", "javascript:"))
        ][:20]

        result: Dict[str, Any] = {
            "url": url,
            "title": title,
            "description": description,
            "headings": headings,
            "paragraphs": paragraphs,
            "links": links,
            "scraped_at": _now(),
        }
        self._save(result, label=urlparse(url).netloc)
        return result

    def scrape_multiple(
        self, urls: List[str]
    ) -> List[Dict[str, Any]]:
        """Scrape several URLs and return a list of result dicts."""
        return [self.scrape_url(u) for u in urls]

    def scrape_competitor_analysis(
        self, competitor_urls: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Scrape a set of competitor URLs and return a comparison DataFrame.

        If *competitor_urls* is ``None`` the method returns an empty
        DataFrame so that code that consumes it always gets a consistent
        object without side effects.
        """
        if not competitor_urls:
            return pd.DataFrame(
                columns=["url", "title", "description", "headings_count",
                         "paragraphs_count", "scraped_at"]
            )

        rows = []
        for url in competitor_urls:
            result = self.scrape_url(url)
            rows.append(
                {
                    "url": result.get("url"),
                    "title": result.get("title"),
                    "description": result.get("description"),
                    "headings_count": len(result.get("headings", [])),
                    "paragraphs_count": len(result.get("paragraphs", [])),
                    "scraped_at": result.get("scraped_at"),
                }
            )
        return pd.DataFrame(rows)

    def scrape_all_sources(self) -> Dict[str, Any]:
        """
        Return a status dict.  Extend with real URLs to enable live scraping.
        """
        return {
            "status": "ready",
            "output_dir": str(self.output_dir),
            "message": (
                "Call scrape_url(url) or scrape_multiple(urls) to fetch data."
            ),
        }

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _throttle(self, url: str) -> None:
        host = urlparse(url).netloc
        last = self._last_request.get(host, 0.0)
        wait = self.rate_limit - (time.monotonic() - last)
        if wait > 0:
            time.sleep(wait)
        self._last_request[host] = time.monotonic()

    def _save(self, result: Dict[str, Any], label: str) -> None:
        ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        safe_label = "".join(c if c.isalnum() else "_" for c in label)[:40]
        out_file = self.output_dir / f"{safe_label}_{ts}.json"
        try:
            out_file.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as exc:
            logger.warning("could not save scrape result: %s", exc)


def _now() -> str:
    return datetime.utcnow().isoformat()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_web_scraper: Optional[ProfessionalWebScraper] = None


def get_web_scraper() -> ProfessionalWebScraper:
    global _web_scraper
    if _web_scraper is None:
        _web_scraper = ProfessionalWebScraper()
    return _web_scraper
