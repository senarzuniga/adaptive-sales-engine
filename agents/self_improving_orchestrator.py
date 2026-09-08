"""Compatibility wrapper: the project now uses a single orchestrator pattern.

Legacy panel-specific agents remain as reference only and are not the active
execution model. The canonical implementation lives in agents/orchestrator.py.
"""

from agents.orchestrator import AdaptiveSalesOrchestrator, get_orchestrator, run

SelfHealingOrchestrator = AdaptiveSalesOrchestrator

__all__ = ["AdaptiveSalesOrchestrator", "SelfHealingOrchestrator", "get_orchestrator", "run"]
