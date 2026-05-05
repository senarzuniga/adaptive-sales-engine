from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class IntelligenceOutput:
    output_type: str
    title: str
    description: str
    impact: str
    suggested_action: str
    source_url: str
    source_id: str
    created_at: datetime
    payload: dict[str, Any] = field(default_factory=dict)
