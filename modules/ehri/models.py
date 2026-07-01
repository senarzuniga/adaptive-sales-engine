from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from datetime import datetime, date
import uuid
import json


@dataclass
class HourlyRateProfile:
    company_id: str
    profile_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    effective_date: str = field(default_factory=lambda: date.today().isoformat())
    rates: Dict[str, float] = field(default_factory=dict)
    country_multipliers: Dict[str, float] = field(default_factory=dict)
    customer_multipliers: Dict[str, float] = field(default_factory=dict)
    strategic_pricing_rules: List[Dict[str, Any]] = field(default_factory=list)
    material_markups: Dict[str, float] = field(default_factory=dict)
    inflation_rules: Dict[str, Any] = field(default_factory=dict)
    revision_notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    created_by: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    approval_status: str = "draft"

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), default=str)

    @staticmethod
    def from_dict(data: Dict[str, Any]):
        return HourlyRateProfile(**data)

    @staticmethod
    def from_json(s: str):
        return HourlyRateProfile.from_dict(json.loads(s))


@dataclass
class BenchmarkValue:
    company_id: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None
    median: Optional[float] = None
    upper_quartile: Optional[float] = None
    lower_quartile: Optional[float] = None
    best_competitor: Optional[float] = None
    sample_size: Optional[int] = None
    confidence: Optional[float] = None
    source: Optional[str] = None
    date: Optional[str] = None
    geographical_scope: Optional[str] = None
    last_validation: Optional[str] = None

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), default=str)

    @staticmethod
    def from_dict(d: Dict[str, Any]):
        return BenchmarkValue(**d)

    @staticmethod
    def from_json(s: str):
        return BenchmarkValue.from_dict(json.loads(s))


@dataclass
class EPISScore:
    company_id: str
    profile_id: str
    version: int
    value: float
    breakdown: Dict[str, float] = field(default_factory=dict)
    computed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), default=str)

    @staticmethod
    def from_dict(d: Dict[str, Any]):
        return EPISScore(**d)

    @staticmethod
    def from_json(s: str):
        return EPISScore.from_dict(json.loads(s))
