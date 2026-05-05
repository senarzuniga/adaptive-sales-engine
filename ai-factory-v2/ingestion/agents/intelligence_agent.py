"""Business intelligence agent for ingestion outputs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

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
