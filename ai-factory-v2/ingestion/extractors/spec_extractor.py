from __future__ import annotations

import re


class SpecExtractor:
    async def extract(self, html: str) -> tuple[dict, float]:
        specs = {
            "speed_m_min": None,
            "width_mm": None,
            "power_kw": None,
        }
        speed = re.search(r"(\d{2,5})\s*(m/min|m\/min)", html, flags=re.IGNORECASE)
        width = re.search(r"(\d{3,5})\s*mm", html, flags=re.IGNORECASE)
        power = re.search(r"(\d{1,4})\s*kW", html, flags=re.IGNORECASE)
        if speed:
            specs["speed_m_min"] = float(speed.group(1))
        if width:
            specs["width_mm"] = float(width.group(1))
        if power:
            specs["power_kw"] = float(power.group(1))
        confidence = 0.4 + (0.2 * sum(1 for v in specs.values() if v is not None))
        return specs, min(confidence, 0.95)
