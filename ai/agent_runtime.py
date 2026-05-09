"""
Agent Runtime — standardised execution wrapper for all sales agents.

Wraps raw agent ``run()`` calls with:
  • Observability (structured logging via ai.observability)
  • Timeout handling
  • Error normalisation into AgentResult
  • Typed output contracts (domain.models.AgentResult)
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_S = 60

# Module-level shared thread pool — avoids per-call overhead of creating a new pool.
# max_workers matches the default orchestrator concurrency.
_SHARED_EXECUTOR = ThreadPoolExecutor(max_workers=12, thread_name_prefix="agent_runtime")


class AgentRuntime:
    """Executes agent functions with observability and error normalisation."""

    def __init__(self, timeout_s: int = _DEFAULT_TIMEOUT_S) -> None:
        self.timeout_s = timeout_s

    def run(
        self,
        agent_name: str,
        agent_fn: Callable[..., Dict[str, Any]],
        context: Dict[str, Any],
        action: str = "",
    ) -> Dict[str, Any]:
        """Execute ``agent_fn(context)`` and return a normalised result dict.

        The return dict always has ``status``, ``output``, and ``insights``
        keys so that the UI rendering code never needs to check for missing keys.
        """
        from ai.observability import observability

        with observability.trace(agent_name, action) as exec_ctx:
            result = self._execute_with_timeout(agent_fn, context)
            exec_ctx.finish(
                status=result.get("status", "success"),
                error=result.get("error", ""),
                insights=len(result.get("insights", [])),
            )

        return result

    def _execute_with_timeout(
        self,
        agent_fn: Callable[..., Dict[str, Any]],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Submit agent_fn to the shared thread pool with a timeout."""
        future = _SHARED_EXECUTOR.submit(agent_fn, context)
        try:
            raw = future.result(timeout=self.timeout_s)
            return self._normalise(raw)
        except FutureTimeout:
            future.cancel()
            return {
                "status": "timeout",
                "output": f"Agent exceeded {self.timeout_s}s timeout.",
                "insights": [],
                "error": "timeout",
            }
        except Exception as exc:
            return {
                "status": "error",
                "output": str(exc),
                "insights": [],
                "error": str(exc),
            }

    @staticmethod
    def _normalise(raw: Any) -> Dict[str, Any]:
        """Ensure raw agent output has the required keys."""
        if not isinstance(raw, dict):
            return {
                "status": "success",
                "output": str(raw),
                "insights": [],
            }
        result = {
            "status":   raw.get("status", "success"),
            "output":   raw.get("output", ""),
            "insights": raw.get("insights", []),
        }
        # Pass through all other keys
        for k, v in raw.items():
            if k not in result:
                result[k] = v
        return result


# Module-level default runtime
default_runtime = AgentRuntime()
