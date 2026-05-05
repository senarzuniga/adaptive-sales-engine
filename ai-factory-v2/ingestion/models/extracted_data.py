from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ExtractedData:
    source_id: str
    source_name: str
    url: str
    data_type: str
    extracted_at: datetime
    content: dict[str, Any]
    confidence_score: float
    content_hash: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedData:
    source_id: str
    source_name: str
    url: str
    data_type: str
    normalized_at: datetime
    normalized_content: dict[str, Any]
    confidence_score: float
    dedupe_key: str
    metadata: dict[str, Any] = field(default_factory=dict)
