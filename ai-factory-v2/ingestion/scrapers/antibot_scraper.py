from __future__ import annotations

import asyncio
import random
import time
import requests


class AntiBotScraper:
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    ]

    def __init__(self) -> None:
        self.session = requests.Session()

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    async def scrape(self, url: str) -> tuple[bool, str | None, int | None, float, str | None]:
        start = time.perf_counter()
        try:
            await asyncio.sleep(random.uniform(0.7, 2.3))
            response = self.session.get(url, headers=self._headers(), timeout=45)
            response.raise_for_status()
            return True, response.text, response.status_code, (time.perf_counter() - start) * 1000, None
        except Exception as exc:  # noqa: BLE001
            return False, None, None, (time.perf_counter() - start) * 1000, str(exc)
