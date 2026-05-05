from __future__ import annotations

import hashlib
import re


class ProductMatcher:
    def dedupe_key(self, product_name: str | None, manufacturer: str | None, source_url: str) -> str:
        name = re.sub(r"\W+", "", (product_name or "").lower())
        maker = re.sub(r"\W+", "", (manufacturer or "").lower())
        raw = f"{name}:{maker}:{source_url.split('?')[0]}"
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()
