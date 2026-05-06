"""Business intelligence agent for ingestion outputs."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from ingestion.intelligence.competitive_intel import build_competitor_signal
from ingestion.intelligence.market_intel import build_market_signal
from ingestion.intelligence.pricing_intel import build_pricing_insight
from ingestion.intelligence.sales_assets import build_sales_asset
from ingestion.models.intelligence_output import IntelligenceOutput


class IntelligenceAgent:
    def __init__(self, openai_client: Any | None = None) -> None:
        self.openai = openai_client

    async def analyze_record(self, source_id: str, source_name: str, source_url: str, payload: dict) -> list[IntelligenceOutput]:
        outputs: list[IntelligenceOutput] = []

        competitor = build_competitor_signal(source_name, payload)
        pricing = build_pricing_insight(payload)
        market = build_market_signal(payload)

        base_payload = build_sales_asset(competitor["title"], competitor["message"], source_url)
        outputs.append(
            IntelligenceOutput(
                output_type="competitor_movement",
                title=competitor["title"],
                description=competitor["message"],
                impact="medium",
                suggested_action="Review positioning and update opportunity notes.",
                source_url=source_url,
                source_id=source_id,
                created_at=datetime.utcnow(),
                payload=base_payload,
            )
        )

        if pricing:
            outputs.append(
                IntelligenceOutput(
                    output_type="pricing_alert",
                    title="Competitive pricing band updated",
                    description=pricing["message"],
                    impact=pricing["impact"],
                    suggested_action="Recalculate target margin and update offer strategy.",
                    source_url=source_url,
                    source_id=source_id,
                    created_at=datetime.utcnow(),
                    payload=pricing,
                )
            )

        if market:
            outputs.append(
                IntelligenceOutput(
                    output_type="market_trend",
                    title="Industry news impact",
                    description=market["message"],
                    impact=market["impact"],
                    suggested_action="Create commercial follow-up action for affected segment.",
                    source_url=source_url,
                    source_id=source_id,
                    created_at=datetime.utcnow(),
                    payload=market,
                )
            )

        return outputs

    async def run_analysis_cycle(self) -> None:
        # Hook point for batch-level synthesis (daily/weekly digests).
        return


# ---------------------------------------------------------------------------
# Orchestrator-compatible synchronous adapter
# ---------------------------------------------------------------------------

def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Synchronous adapter so this agent participates in the main agent cascade.

    Analyses scraped page content (context['scraped_web_content']) or any available
    company/market data using the intelligence builders from ingestion.intelligence.
    """
    if context is None:
        context = {}

    scraped_pages: List[Dict[str, Any]] = context.get("scraped_web_content") or []
    active_company = context.get("active_company") or {}
    company_name = (
        active_company.get("company_name") or active_company.get("name", "")
    )
    company_notes: str = context.get("company_notes") or ""

    outputs: List[Dict[str, Any]] = []

    if scraped_pages:
        for page in scraped_pages[:5]:
            text = page.get("text_snippet", "") or page.get("html", "")
            url = page.get("url", "unknown")
            if not text:
                continue

            # Build a minimal payload for the intelligence builders
            payload: Dict[str, Any] = {
                "headline": text[:200],
                "product_name": company_name or "unknown",
            }
            # Price detection
            price_matches = re.findall(r"(?:EUR|USD|€|\$)\s?([\d\.,]{3,12})", text)
            prices = []
            for raw in price_matches[:5]:
                try:
                    prices.append(float(raw.replace(".", "").replace(",", ".")))
                except ValueError:
                    pass
            if prices:
                payload["price_estimated"] = {"value": max(prices), "currency": "EUR"}

            competitor = build_competitor_signal(
                page.get("url", "web_source"), payload
            )
            market = build_market_signal(payload)
            pricing = build_pricing_insight(payload)

            insight = {
                "url": url,
                "competitor_signal": competitor["message"],
            }
            if market:
                insight["market_signal"] = market["message"]
            if pricing:
                insight["pricing_alert"] = pricing["message"]
            outputs.append(insight)

    if not outputs:
        # No scraped content — return ready state with company context
        return {
            "status": "success",
            "output": (
                "Intelligence Agent listo. "
                + (f"Empresa activa: {company_name}. " if company_name else "")
                + "Proporciona URLs en contexto['scrape_urls'] para análisis competitivo en tiempo real."
            ),
            "insights": [
                "Captura señales de competidores, precios y tendencias de mercado vía web.",
                "Resultado depende de las URLs proporcionadas para scraping.",
                f"Contexto empresa: {company_notes[:100]}" if company_notes else "Sin notas de empresa.",
            ],
            "intelligence_outputs": [],
        }

    summary_lines = [f"URL: {o['url'][:60]} — {o['competitor_signal'][:80]}" for o in outputs[:3]]
    return {
        "status": "success",
        "output": f"Inteligencia generada para {len(outputs)} fuentes web.",
        "insights": summary_lines
        + [o.get("pricing_alert", "") for o in outputs if o.get("pricing_alert")][:2],
        "intelligence_outputs": outputs,
    }
