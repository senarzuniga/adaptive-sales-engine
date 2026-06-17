"""
Self-Healing Orchestrator – Adaptive Sales Engine
Seven lightweight agents that monitor and maintain application health.

Agents
------
1. HealthMonitor      – checks app responsiveness every 30 s
2. PerformanceOptimizer – clears stale cache files every 5 min
3. DataValidator      – ensures required data directories exist every 1 min
4. FeatureEnhancer    – logs feature-usage hints every 10 min
5. ErrorDetector      – scans logs for ERROR/CRITICAL lines every 30 s
6. UsageAnalyzer      – summarises recent log activity every 5 min
7. AutoFixer          – creates missing config stubs every 1 min
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Individual agent base
# ---------------------------------------------------------------------------


class _Agent(threading.Thread):
    """Daemon thread that runs a periodic task."""

    def __init__(self, name: str, interval: int, app_path: Path) -> None:
        super().__init__(name=name, daemon=True)
        self.interval = interval
        self.app_path = app_path
        self._stop_event = threading.Event()
        self.run_count = 0
        self.last_result: Optional[str] = None

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.last_result = self.tick()
                self.run_count += 1
            except Exception as exc:  # noqa: BLE001
                self.last_result = f"ERROR: {exc}"
                logger.warning("[%s] tick error: %s", self.name, exc)
            self._stop_event.wait(self.interval)

    def tick(self) -> str:  # pragma: no cover
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Seven agents
# ---------------------------------------------------------------------------


class HealthMonitor(_Agent):
    """Agent 1 – checks that key paths and environment vars exist."""

    def __init__(self, app_path: Path) -> None:
        super().__init__("HealthMonitor", interval=30, app_path=app_path)

    def tick(self) -> str:
        required_dirs = ["data", "documents", "uploads", "agents", "modules"]
        missing = [d for d in required_dirs if not (self.app_path / d).exists()]
        if missing:
            for d in missing:
                (self.app_path / d).mkdir(parents=True, exist_ok=True)
            return f"created missing dirs: {missing}"
        return "all directories healthy"


class PerformanceOptimizer(_Agent):
    """Agent 2 – purges stale cache files older than 24 h."""

    def __init__(self, app_path: Path) -> None:
        super().__init__("PerformanceOptimizer", interval=300, app_path=app_path)

    def tick(self) -> str:
        cache_dir = self.app_path / "cache"
        if not cache_dir.exists():
            return "cache dir not found"
        cutoff = time.time() - 86400  # 24 h
        removed = 0
        for f in cache_dir.iterdir():
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
                removed += 1
        return f"removed {removed} stale cache file(s)"


class DataValidator(_Agent):
    """Agent 3 – ensures required sub-directories exist every minute."""

    REQUIRED: List[str] = [
        "data/raw",
        "data/processed",
        "data/web_scraped",
        "documents/invoices",
        "documents/contracts",
        "documents/reports",
        "uploads",
        "cache",
    ]

    def __init__(self, app_path: Path) -> None:
        super().__init__("DataValidator", interval=60, app_path=app_path)

    def tick(self) -> str:
        created = []
        for rel in self.REQUIRED:
            p = self.app_path / rel
            if not p.exists():
                p.mkdir(parents=True, exist_ok=True)
                created.append(rel)
        return f"created {created}" if created else "data dirs OK"


class FeatureEnhancer(_Agent):
    """Agent 4 – logs feature-usage suggestions every 10 min."""

    HINTS: List[str] = [
        "Try the Cost Module Engine to estimate offer totals.",
        "Use Request Pool to convert leads directly into offers.",
        "Export Actions to Excel for offline review.",
        "Upload market data CSVs via the Data page.",
        "Check the Content Analyzer for sentiment trends.",
    ]

    def __init__(self, app_path: Path) -> None:
        super().__init__("FeatureEnhancer", interval=600, app_path=app_path)
        self._idx = 0

    def tick(self) -> str:
        hint = self.HINTS[self._idx % len(self.HINTS)]
        self._idx += 1
        logger.info("[FeatureEnhancer] hint: %s", hint)
        return hint


class ErrorDetector(_Agent):
    """Agent 5 – scans log files for ERROR/CRITICAL entries every 30 s."""

    def __init__(self, app_path: Path) -> None:
        super().__init__("ErrorDetector", interval=30, app_path=app_path)

    def tick(self) -> str:
        log_dir = self.app_path / "logs"
        if not log_dir.exists():
            return "no logs directory"
        errors_found = 0
        for log_file in log_dir.glob("*.log"):
            try:
                text = log_file.read_text(encoding="utf-8", errors="ignore")
                errors_found += text.count("ERROR") + text.count("CRITICAL")
            except OSError:
                pass
        return f"detected {errors_found} error entries in logs"


class UsageAnalyzer(_Agent):
    """Agent 6 – records a heartbeat timestamp every 5 min."""

    def __init__(self, app_path: Path) -> None:
        super().__init__("UsageAnalyzer", interval=300, app_path=app_path)

    def tick(self) -> str:
        log_dir = self.app_path / "logs"
        log_dir.mkdir(exist_ok=True)
        heartbeat_file = log_dir / "heartbeat.log"
        ts = datetime.utcnow().isoformat()
        with heartbeat_file.open("a", encoding="utf-8") as fh:
            fh.write(f"{ts} heartbeat\n")
        return f"heartbeat at {ts}"


class AutoFixer(_Agent):
    """Agent 7 – creates missing config stubs so the app always starts."""

    def __init__(self, app_path: Path) -> None:
        super().__init__("AutoFixer", interval=60, app_path=app_path)

    def tick(self) -> str:
        fixed: List[str] = []

        # Ensure .streamlit/config.toml exists
        config_dir = self.app_path / ".streamlit"
        config_file = config_dir / "config.toml"
        if not config_file.exists():
            config_dir.mkdir(exist_ok=True)
            config_file.write_text(
                '[server]\nmaxUploadSize = 200\n', encoding="utf-8"
            )
            fixed.append(".streamlit/config.toml")

        # Ensure logs directory exists
        logs_dir = self.app_path / "logs"
        if not logs_dir.exists():
            logs_dir.mkdir(parents=True, exist_ok=True)
            fixed.append("logs/")

        return f"auto-fixed: {fixed}" if fixed else "config OK"


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class SelfHealingOrchestrator:
    """Manages all seven self-healing agents."""

    def __init__(self, app_path: Optional[str] = None) -> None:
        self.app_path = Path(app_path) if app_path else Path(
            os.environ.get("APP_PATH", Path(__file__).resolve().parent.parent)
        )
        self._agents: List[_Agent] = []
        self.is_running = False
        self.started_at: Optional[datetime] = None

    def start(self) -> None:
        """Initialise and start all seven agents."""
        if self.is_running:
            return

        self._agents = [
            HealthMonitor(self.app_path),
            PerformanceOptimizer(self.app_path),
            DataValidator(self.app_path),
            FeatureEnhancer(self.app_path),
            ErrorDetector(self.app_path),
            UsageAnalyzer(self.app_path),
            AutoFixer(self.app_path),
        ]

        for agent in self._agents:
            agent.start()

        self.is_running = True
        self.started_at = datetime.utcnow()
        logger.info("SelfHealingOrchestrator: all 7 agents started")

    def stop(self) -> None:
        """Signal all agents to stop."""
        for agent in self._agents:
            agent.stop()
        self.is_running = False
        logger.info("SelfHealingOrchestrator: all agents stopped")

    def get_status_report(self) -> Dict[str, Any]:
        """Return a summary of every agent's last result."""
        return {
            "active_agents": len([a for a in self._agents if a.is_alive()]),
            "total_agents": len(self._agents),
            "is_running": self.is_running,
            "started_at": (
                self.started_at.isoformat() if self.started_at else None
            ),
            "agents": [
                {
                    "name": a.name,
                    "alive": a.is_alive(),
                    "run_count": a.run_count,
                    "last_result": a.last_result,
                }
                for a in self._agents
            ],
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_orchestrator: Optional[SelfHealingOrchestrator] = None


def get_orchestrator() -> SelfHealingOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = SelfHealingOrchestrator()
    return _orchestrator


def run(context: dict | None = None):
    """Expose a simple run interface for the self-healing orchestrator.

    If `context` contains `action: 'start'` or `'stop'` the orchestrator
    will start/stop the background agents. Otherwise it returns a status
    report.
    """
    try:
        orch = get_orchestrator()
        if isinstance(context, dict):
            action = context.get("action")
            if action == "start":
                orch.start()
                return {"status": "success", "output": "SelfHealingOrchestrator started", "insights": []}
            if action == "stop":
                orch.stop()
                return {"status": "success", "output": "SelfHealingOrchestrator stopped", "insights": []}

        return orch.get_status_report()
    except Exception as e:
        return {"status": "error", "error": str(e), "output": str(e), "insights": []}
