"""Adaptive Sales Engine orchestration package.

The canonical execution model is one score-based orchestrator shared across the
application. Legacy isolated agent files are kept only as compatibility or
reference layers.
"""

from .orchestrator import AdaptiveSalesOrchestrator, get_orchestrator, run

__all__ = ["AdaptiveSalesOrchestrator", "get_orchestrator", "run"]
