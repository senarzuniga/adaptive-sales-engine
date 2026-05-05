from __future__ import annotations

import time
import requests


class StaticScraper:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
        )

    async def scrape(self, url: str) -> tuple[bool, str | None, int | None, float, str | None]:
        start = time.perf_counter()
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return True, response.text, response.status_code, (time.perf_counter() - start) * 1000, None
        except Exception as exc:  # noqa: BLE001
            return False, None, None, (time.perf_counter() - start) * 1000, str(exc)
