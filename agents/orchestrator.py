from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional


@dataclass
class Hypothesis:
    name: str
    description: str
    score: Dict[str, float]
    action: Callable[["AdaptiveSalesOrchestrator"], Dict[str, Any]]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def total_score(self) -> float:
        weights = {
            "Mission Alignment": 0.35,
            "Engineering": 0.20,
            "Business": 0.15,
            "Risk": 0.10,
            "Knowledge": 0.10,
            "Architecture": 0.05,
            "Maintainability": 0.05,
        }
        total = 0.0
        for key, weight in weights.items():
            total += float(self.score.get(key, 0.0)) * weight
        return total


class AdaptiveSalesOrchestrator:
    """Single orchestration point for pipeline decisions, validations and execution."""

    def __init__(self) -> None:
        self._hypotheses: List[Hypothesis] = []

    def register_hypothesis(self, hypothesis: Hypothesis) -> None:
        self._hypotheses.append(hypothesis)

    def register_default_hypotheses(self) -> None:
        self._hypotheses = [
            Hypothesis(
                name="Primary-Product-Path",
                description="Keep the React/Vite app as the sole primary user-facing product and treat all additional folders as support assets.",
                score={
                    "Mission Alignment": 98,
                    "Engineering": 92,
                    "Business": 94,
                    "Risk": 88,
                    "Knowledge": 90,
                    "Architecture": 96,
                    "Maintainability": 91,
                },
                action=lambda orchestrator: {
                    "status": "selected",
                    "decision": "Use the main Vite app as operational product and keep supporting folders as reference/validation assets.",
                    "evidence": [
                        "App root has the active frontend under src/.",
                        "The repository includes multiple supporting folders but only one operational app path.",
                    ],
                },
            ),
            Hypothesis(
                name="Single-Orchestrator-Pattern",
                description="Use one orchestrator to coordinate all higher-level tasks instead of panel-isolated agents.",
                score={
                    "Mission Alignment": 96,
                    "Engineering": 90,
                    "Business": 92,
                    "Risk": 90,
                    "Knowledge": 88,
                    "Architecture": 95,
                    "Maintainability": 94,
                },
                action=lambda orchestrator: {
                    "status": "selected",
                    "decision": "All panel workflows are managed through one orchestrator operating by score and validation.",
                    "evidence": [
                        "Best practice file defines a single orchestrator pattern.",
                        "The app already has a central orchestration model in agents/self_improving_orchestrator.py.",
                    ],
                },
            ),
            Hypothesis(
                name="Highest-Score-Execution",
                description="Select the highest scoring option and validate it before continuing to avoid stalled or duplicated work.",
                score={
                    "Mission Alignment": 95,
                    "Engineering": 91,
                    "Business": 90,
                    "Risk": 89,
                    "Knowledge": 93,
                    "Architecture": 90,
                    "Maintainability": 93,
                },
                action=lambda orchestrator: {
                    "status": "selected",
                    "decision": "Evaluate all viable alternatives by weighted score and keep the winner with evidence.",
                    "evidence": [
                        "The best-practices guidance requires hypothesis ranking and higher-score execution.",
                    ],
                },
            ),
        ]

    def select_best_hypothesis(self) -> Optional[Hypothesis]:
        if not self._hypotheses:
            self.register_default_hypotheses()
        if not self._hypotheses:
            return None
        return max(self._hypotheses, key=lambda h: h.total_score())

    def run_best_hypothesis(self) -> Dict[str, Any]:
        hypothesis = self.select_best_hypothesis()
        if hypothesis is None:
            return {"status": "error", "detail": "No hypothesis registered"}
        result = hypothesis.action(self)
        return {
            "status": "success",
            "selected_hypothesis": hypothesis.name,
            "score": hypothesis.score,
            "total_score": hypothesis.total_score(),
            "result": result,
        }

    def run(self, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if context and isinstance(context, dict):
            action = context.get("action")
            if action == "reset":
                self._hypotheses = []
                self.register_default_hypotheses()
            if action == "list":
                return {
                    "status": "success",
                    "hypotheses": [
                        {
                            "name": h.name,
                            "total_score": h.total_score(),
                            "score": h.score,
                        }
                        for h in self._hypotheses
                    ],
                }
        return self.run_best_hypothesis()


_orchestrator: Optional[AdaptiveSalesOrchestrator] = None


def get_orchestrator() -> AdaptiveSalesOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AdaptiveSalesOrchestrator()
        _orchestrator.register_default_hypotheses()
    return _orchestrator


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return get_orchestrator().run(context)
