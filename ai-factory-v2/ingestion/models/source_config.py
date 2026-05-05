from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class SourceTier(str, Enum):
    TIER1_CRITICAL = "tier1"
    TIER2_IMPORTANT = "tier2"
    TIER3_MONITORING = "tier3"


class ScrapingPriority(str, Enum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


@dataclass
class SourceConfig:
    id: str
    name: str
    url: str
    tier: SourceTier
    scraping_frequency_hours: int = 24
    priority: ScrapingPriority = ScrapingPriority.NORMAL
    scraper_type: str = "static"
    selectors: dict[str, str] = field(default_factory=dict)
    last_scraped: datetime | None = None
    is_active: bool = True
    event_triggers: list[str] = field(default_factory=list)
    data_type: str = "product"
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SourceConfig":
        data = dict(payload)
        data["tier"] = SourceTier(data["tier"])
        data["priority"] = ScrapingPriority(data.get("priority", "normal"))
        if data.get("last_scraped") and isinstance(data["last_scraped"], str):
            data["last_scraped"] = datetime.fromisoformat(data["last_scraped"])
        return cls(**data)


@dataclass
class ScrapingJob:
    source_id: str
    source_name: str
    url: str
    scraper_type: str
    priority: ScrapingPriority
    triggered_by: str
    scheduled_at: datetime
    selectors: dict[str, str] = field(default_factory=dict)
    data_type: str = "product"


PRIORITY_WEIGHT: dict[ScrapingPriority, int] = {
    ScrapingPriority.HIGH: 0,
    ScrapingPriority.NORMAL: 1,
    ScrapingPriority.LOW: 2,
}
