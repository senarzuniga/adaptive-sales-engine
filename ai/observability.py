"""
AI Observability — structured logging for all agent executions.

Replaces scattered print/warning calls with a consistent record that can be
shipped to any monitoring backend (LangSmith, Helicone, OpenTelemetry, etc.).
"""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional

_root_logger = logging.getLogger("ai.observability")


class AgentExecution:
    """Holds metrics for a single agent run."""

    def __init__(self, agent_name: str, action: str) -> None:
        self.agent_name = agent_name
        self.action = action
        self.started_at: datetime = datetime.now(timezone.utc)
        self.ended_at: Optional[datetime] = None
        self.duration_ms: int = 0
        self.status: str = "running"
        self.tokens_used: int = 0
        self.error: str = ""
        self.insights_count: int = 0
        self.extra: Dict[str, Any] = {}

    def finish(self, status: str = "success", error: str = "", tokens: int = 0, insights: int = 0) -> None:
        self.ended_at = datetime.now(timezone.utc)
        self.duration_ms = int((self.ended_at - self.started_at).total_seconds() * 1000)
        self.status = status
        self.error = error
        self.tokens_used = tokens
        self.insights_count = insights

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent":        self.agent_name,
            "action":       self.action,
            "started_at":   self.started_at.isoformat(),
            "ended_at":     self.ended_at.isoformat() if self.ended_at else None,
            "duration_ms":  self.duration_ms,
            "status":       self.status,
            "tokens":       self.tokens_used,
            "insights":     self.insights_count,
            "error":        self.error,
        }


class AIObservabilityLogger:
    """Singleton logger for AI operations.

    Usage::

        obs = AIObservabilityLogger.get()
        with obs.trace("forecaster_agent", "dashboard") as exec_ctx:
            result = agent.run(context)
            exec_ctx.insights_count = len(result.get("insights", []))
    """

    _instance: Optional["AIObservabilityLogger"] = None
    _executions: List[AgentExecution] = []

    @classmethod
    def get(cls) -> "AIObservabilityLogger":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @contextmanager
    def trace(self, agent_name: str, action: str) -> Generator[AgentExecution, None, None]:
        """Context manager that records timing and status for one agent run."""
        execution = AgentExecution(agent_name, action)
        self._executions.append(execution)
        try:
            yield execution
            if execution.status == "running":
                execution.finish("success")
        except Exception as exc:
            execution.finish("error", error=str(exc))
            raise
        finally:
            self._emit(execution)

    def _emit(self, execution: AgentExecution) -> None:
        """Write a structured log record.  Override to ship to external systems."""
        level = logging.WARNING if execution.status == "error" else logging.INFO
        _root_logger.log(
            level,
            "agent_execution | %s",
            execution.to_dict(),
            extra={"agent_exec": execution.to_dict()},
        )

    def get_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return the most recent executions as plain dicts."""
        return [e.to_dict() for e in self._executions[-limit:]]

    def get_summary(self) -> Dict[str, Any]:
        """Aggregate stats across all executions."""
        total = len(self._executions)
        if total == 0:
            return {"total": 0}
        success = sum(1 for e in self._executions if e.status == "success")
        errors  = sum(1 for e in self._executions if e.status == "error")
        avg_ms  = int(sum(e.duration_ms for e in self._executions) / total)
        return {
            "total":       total,
            "success":     success,
            "errors":      errors,
            "avg_duration_ms": avg_ms,
        }


# Module-level singleton shortcut
observability = AIObservabilityLogger.get()
