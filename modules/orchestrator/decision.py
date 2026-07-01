from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List
from datetime import datetime, timezone
import uuid


def now_iso():
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ExecutiveDecision:
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    created_at: str = field(default_factory=now_iso)
    recommendation: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    quality_score: float = 0.0
    supporting_evidence: List[Dict[str, Any]] = field(default_factory=list)
    participating_agents: List[str] = field(default_factory=list)
    traceability: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
