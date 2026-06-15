"""Package marker for ingestion modules.

Creating this file makes the ``ingestion`` package importable when
``ai-factory-v2`` is added to ``sys.path`` (the orchestrator adds that
path dynamically). This helps fix "No module named 'ingestion'" errors
when agents import ``ingestion.*``.

Keep this file minimal — export common submodules here if needed.
"""

__all__ = []
"""Multi-agent ingestion system for Adaptive Sales Engine + AI-FACTORY-v2."""
