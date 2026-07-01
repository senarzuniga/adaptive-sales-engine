from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import json


@dataclass
class ASEEvent:
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    event_type: str = ""
    event_category: Optional[str] = None
    actor: Dict[str, Any] = field(default_factory=dict)  # {type, id, role}
    context: Dict[str, Any] = field(default_factory=dict)  # tenant_id, module, workflow_id, correlation_id, trace_identity_refs
    payload: Dict[str, Any] = field(default_factory=dict)
    source: Dict[str, Any] = field(default_factory=dict)  # origin, source_system
    governance: Dict[str, Any] = field(default_factory=lambda: {
        "requires_fact_check": False,
        "fact_check_status": None,
        "confidence_score": None,
        "evidence_id": None,
        "raw_data_used": False,
        "bypassed_fact_checker": False,
        "missing_evidence_store": False,
        "unapproved_knowledge_used": False,
        "confidence_below_threshold": False
    })
    traceability: Dict[str, Any] = field(default_factory=lambda: {"inputs": [], "outputs": [], "decisions": []})
    impact: Dict[str, Any] = field(default_factory=lambda: {"business_impact": "low", "financial_impact": 0.0, "workflow_stage_change": None})

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)

    @staticmethod
    def from_dict(d: Dict[str, Any]):
        # allow constructing from dicts that may lack some fields
        base = {
            "event_id": d.get("event_id") or str(uuid.uuid4()),
            "timestamp": d.get("timestamp") or datetime.utcnow().isoformat(),
            "event_type": d.get("event_type", ""),
            "event_category": d.get("event_category"),
            "actor": d.get("actor", {}),
            "context": d.get("context", {}),
            "payload": d.get("payload", {}),
            "source": d.get("source", {}),
            "governance": d.get("governance", {}),
            "traceability": d.get("traceability", {}),
            "impact": d.get("impact", {}),
        }
        return ASEEvent(**base)

    @staticmethod
    def from_json(s: str):
        return ASEEvent.from_dict(json.loads(s))
