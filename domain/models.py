"""
Domain models — typed contracts for all business entities.

Every agent, service and workflow works with these models so that data
flows through the system in a consistent, validated way.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel, Field
    _PYDANTIC_AVAILABLE = True
except ImportError:  # pragma: no cover — pydantic is in requirements.txt
    from dataclasses import dataclass, field as Field  # type: ignore[assignment]
    BaseModel = object  # type: ignore[assignment,misc]
    _PYDANTIC_AVAILABLE = False

import pandas as pd

# ──────────────────────────────────────────────────────────────
# Enums y modelos auxiliares para acciones y feedback
# ──────────────────────────────────────────────────────────────
from enum import Enum

class EntityType(str, Enum):
    ACCOUNT = "account"
    OPPORTUNITY = "opportunity"
    OFFER = "offer"
    PROJECT = "project"
    SERVICE = "service"
    SUPPLIER = "supplier"
    PART = "part"
    USER = "user"

class ActionType(str, Enum):
    TASK = "task"
    CALL = "call"
    MEETING = "meeting"
    EMAIL = "email"
    OFFER = "offer"
    PURCHASE = "purchase"
    COST = "cost"
    PROJECT = "project"
    SERVICE = "service"
    MONITORING = "monitoring"
    ALLIANCE = "alliance"

class ActionStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    CLOSED = "closed"
    ESCALATED = "escalated"

class FeedbackType(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    IMPROVEMENT = "improvement"

class Feedback(BaseModel):
    action_id: str
    user: str
    feedback_type: FeedbackType
    comments: str = ""
    created_at: Optional[datetime] = None

class Scoring(BaseModel):
    action_id: str
    score: int = 0
    rationale: str = ""
    created_at: Optional[datetime] = None


# ──────────────────────────────────────────────────────────────
# Core business entities
# ──────────────────────────────────────────────────────────────


class Account(BaseModel):
    """A customer or prospect account."""

    id: str = ""
    name: str
    country: str = ""
    sector: str = ""
    segment: str = ""
    notes: str = ""
    revenue: float = 0.0
    risk_score: float = 0.0
    created_at: Optional[datetime] = None


class Company(BaseModel):
    """Canonical enterprise/company record.

    Supports both commercial and legal names, aliases and governance metadata.
    """

    id: str = ""
    commercial_name: str
    legal_name: str = ""
    aliases: List[str] = Field(default_factory=list)
    status: str = "active"  # active | archived | merged
    source_of_truth: str = "local"  # e.g. 'local' | 'supabase' | 'erp'
    provenance: Dict[str, Any] = Field(default_factory=dict)
    locked_fields: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Opportunity(BaseModel):
    """A sales opportunity linked to an account."""

    id: str = ""
    account_name: str
    title: str = ""
    value: float = 0.0
    probability: float = 0.5
    risk_score: float = 0.0
    stage: str = "open"
    expected_close: Optional[datetime] = None
    assigned_to: str = ""


class Risk(BaseModel):
    """A detected commercial or operational risk."""

    account: str
    level: str  # "high" | "medium" | "low"
    concentration_pct: float = 0.0
    description: str = ""


class Forecast(BaseModel):
    """Revenue forecast output."""

    quarterly: Optional[float] = None
    half_year: Optional[float] = None
    annual: Optional[float] = None
    confidence: str = "N/A"
    r_squared: float = 0.0


class Action(BaseModel):
    """A commercial action or task."""

    id: str = ""
    name: str
    goal: str = ""
    description: str = ""
    department: str = ""
    assigned_to: str = ""
    status: str = "open"
    comments: str = ""
    importance_score: int = 70
    strategy_alignment: int = 70
    estimated_hours: float = 0.0
    created_by: str = ""
    created_at: Optional[datetime] = None
    last_modified: Optional[datetime] = None


class Offer(BaseModel):
    """A sales offer / proposal."""

    id: str = ""
    serial_number: str = ""
    title: str
    description: str = ""
    version: int = 1
    status: str = "draft"
    total_amount: float = 0.0
    currency: str = "EUR"
    customer_name: str = ""
    customer_contact: str = ""
    valid_until: Optional[str] = None
    created_from: str = "manual"
    created_by: str = ""
    warnings: List[str] = Field(default_factory=list)
    cost_breakdown: Dict[str, Any] = Field(default_factory=dict)
    is_deleted: bool = False


class CustomerRequest(BaseModel):
    """An inbound customer request/inquiry."""

    id: str = ""
    company: str = ""
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    description: str = ""
    received_date: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "new"
    decline_reason: str = ""
    created_by: str = ""


class WeeklyTask(BaseModel):
    """A task generated by the weekly planner agent."""

    priority: int = 1
    account: str = ""
    action: str = ""
    rationale: str = ""
    effort: str = "medium"
    impact: str = "high"


class MarketSignal(BaseModel):
    """A market intelligence signal."""

    source: str = ""
    signal_type: str = ""  # "competitor" | "trend" | "regulation"
    description: str = ""
    relevance: float = 0.5
    detected_at: Optional[datetime] = None


# ──────────────────────────────────────────────────────────────
# AI / Agent contracts
# ──────────────────────────────────────────────────────────────


class AgentResult(BaseModel):
    """Standardised output every agent should return."""

    agent_name: str = ""
    status: str = "success"  # "success" | "error" | "timeout" | "no_data"

    # Human-readable outputs
    output: str = ""
    insights: List[str] = Field(default_factory=list)

    # Structured outputs
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    risks: List[Dict[str, Any]] = Field(default_factory=list)
    opportunities: List[Dict[str, Any]] = Field(default_factory=list)
    tasks: List[Dict[str, Any]] = Field(default_factory=list)

    # Quality metrics
    confidence: float = 0.0
    reasoning: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)

    # Observability
    duration_ms: int = 0
    tokens_used: int = 0
    error: str = ""

    # Backward-compat passthrough for arbitrary agent data
    extra: Dict[str, Any] = Field(default_factory=dict)


class BusinessContext(BaseModel):
    """Unified context shared by all agents and services.

    Replaces the ad-hoc ``_build_context()`` dict that previously coupled the
    UI layer to the AI layer.
    """

    # Trigger info
    action: str = ""

    # Core data
    uploaded_data: Optional[Any] = None          # pd.DataFrame — excluded from serialisation
    estrategia_data: Optional[Any] = None        # pd.DataFrame
    productos_data: Optional[Any] = None         # pd.DataFrame
    oportunidades_data: Optional[Any] = None     # pd.DataFrame

    # Company / account state
    active_company: Optional[Dict[str, Any]] = None
    saved_companies: List[Dict[str, Any]] = Field(default_factory=list)
    company_notes: str = ""
    portfolio_risk: Optional[Dict[str, Any]] = None

    # Derived signals
    accounts: List[Account] = Field(default_factory=list)
    opportunities: List[Opportunity] = Field(default_factory=list)
    risks: List[Risk] = Field(default_factory=list)
    market_signals: List[MarketSignal] = Field(default_factory=list)

    # Strategy
    strategy: Dict[str, Any] = Field(default_factory=dict)
    history: List[Dict[str, Any]] = Field(default_factory=list)

    # Metadata
    user_id: str = ""
    user_role: str = ""
    extra: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True  # allow pd.DataFrame fields
