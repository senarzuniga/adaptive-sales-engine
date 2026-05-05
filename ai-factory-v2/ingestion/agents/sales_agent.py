"""Sales enablement agent that materializes actions from intelligence."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ingestion.models.intelligence_output import IntelligenceOutput


class SalesAgent:
    def __init__(self, supabase_client: Any | None):
        self.supabase = supabase_client

    async def create_actions(self, outputs: list[IntelligenceOutput]) -> int:
        if not self.supabase:
            return 0

        created = 0
        for output in outputs:
            if output.impact not in {"high", "medium"}:
                continue
            payload = {
                "name": output.title,
                "goal": output.description,
                "description": output.suggested_action,
                "department": "Commercial",
                "status": "open",
                "importance_score": 90 if output.impact == "high" else 75,
                "strategy_alignment": 85,
                "estimated_hours": 2.0,
                "supportive_content": {
                    "source_url": output.source_url,
                    "intel_type": output.output_type,
                },
                "created_at": datetime.utcnow().isoformat(),
                "last_modified": datetime.utcnow().isoformat(),
            }
            try:
                self.supabase.table("actions").insert(payload).execute()
                created += 1
            except Exception:
                continue
        return created
