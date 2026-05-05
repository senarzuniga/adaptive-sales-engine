from __future__ import annotations

import json
import re
from typing import Any

try:
    from bs4 import BeautifulSoup
except Exception:  # noqa: BLE001
    BeautifulSoup = None


class ProductExtractor:
    def __init__(self, openai_client: Any | None) -> None:
        self.openai = openai_client

    def _fallback_extract(self, text: str) -> dict:
        title = text.split("\n", 1)[0][:120] if text else "unknown"
        speed_match = re.search(r"(\d{2,5})\s*(m/min|m\/min)", text, flags=re.IGNORECASE)
        width_match = re.search(r"(\d{3,5})\s*(mm)", text, flags=re.IGNORECASE)
        return {
            "product_name": title,
            "manufacturer": None,
            "category": "corrugated_machinery",
            "specifications": {
                "speed": {
                    "value": float(speed_match.group(1)) if speed_match else None,
                    "unit": speed_match.group(2) if speed_match else None,
                },
                "width": {
                    "value": float(width_match.group(1)) if width_match else None,
                    "unit": width_match.group(2) if width_match else None,
                },
            },
            "key_features": [],
            "applications": ["corrugado"],
        }

    async def extract(self, html: str, source_name: str, url: str) -> tuple[dict, float]:
        if BeautifulSoup is not None:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            clean_text = soup.get_text(separator="\n", strip=True)[:9000]
        else:
            clean_text = re.sub(r"<[^>]+>", " ", html)
            clean_text = re.sub(r"\s+", " ", clean_text)[:9000]

        if not self.openai:
            return self._fallback_extract(clean_text), 0.55

        prompt = f"""
        Extrae información de producto industrial del siguiente contenido.

        source_name: {source_name}
        url: {url}
        text:
        {clean_text}

        Devuelve JSON con llaves:
        product_name, manufacturer, category, specifications, price_estimated, key_features, applications
        """

        try:
            response = await self.openai.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": "Eres analista de maquinaria industrial para corrugado. Responde en JSON estricto.",
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            payload = json.loads(response.choices[0].message.content)
            return payload, 0.86
        except Exception:
            return self._fallback_extract(clean_text), 0.6
