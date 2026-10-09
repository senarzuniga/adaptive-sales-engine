"""Agente raíz de coordinación y mejora continua.

Es la primera capa de acción del ecosistema digital del repositorio.
Su responsabilidad es gobernar, priorizar, coordinar y mantener una mejora
continua sin crear duplicación ni arquitecturas paralelas.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from cognitive_os.continuous_improvement import ContinuousImprovementRepository


@dataclass(slots=True)
class MissionAction:
    id: str
    title: str
    description: str
    owner: str
    priority: str = "medium"
    status: str = "pending"
    tags: list[str] = field(default_factory=list)


class RootCoordinationAgent:
    """Capa 1 de coordinación y mejora continua.

    Descubre el ecosistema del repositorio, valida los artefactos de gobernanza,
    prioriza la ejecución y mantiene un backlog continuo de mejoras.
    """

    def __init__(self, repo_root: str | Path | None = None) -> None:
        self.repo_root = Path(repo_root or Path(__file__).resolve().parent)
        self.governance_dir = self.repo_root / "governance"
        self.continuous_improvement = ContinuousImprovementRepository(
            root_dir=str(self.repo_root / "Architecture" / "ContinuousImprovement")
        )

    def discover_ecosystem(self) -> dict[str, Any]:
        """Inventario mínimo del repositorio para una coordinación efectiva."""
        candidates = {
            "root_files": [
                "AGENTS.md",
                ".github",
                "governance",
                "agents",
                "scripts",
                "cognitive_os",
                "api",
                "docs",
                "tests",
            ],
            "directories": [],
        }

        for path in sorted(self.repo_root.iterdir()):
            if path.name.startswith(".") and path.name not in {".github"}:
                continue
            if path.is_dir():
                candidates["directories"].append(path.name)

        governance_files = {
            "global_directive": self.governance_dir / "global_operational_directive.md",
            "instruction_agent": self.repo_root / "AGENTS.md",
            "copilot_instruction": self.repo_root / ".github" / "copilot-instructions.md",
        }

        return {
            "repo_root": str(self.repo_root),
            "key_files": {name: str(path) for name, path in governance_files.items()},
            "files_present": {name: path.exists() for name, path in governance_files.items()},
            "directory_inventory": candidates["directories"],
            "summary": (
                "Repositorio identificado y listo para gobernanza, coordinación y "
                "mejora continua."
            ),
        }

    def validate_governance(self) -> dict[str, Any]:
        discovery = self.discover_ecosystem()
        checks = {
            "root_instruction_present": discovery["files_present"]["instruction_agent"],
            "global_directive_present": discovery["files_present"]["global_directive"],
            "copilot_instructions_present": discovery["files_present"]["copilot_instruction"],
            "sync_script_present": (self.repo_root / "scripts" / "sync_global_directive.ps1").exists(),
        }
        return {
            "checks": checks,
            "governance_ready": all(checks.values()),
        }

    def build_action_plan(self, mission: str, objective: str, context: dict[str, Any] | None = None) -> list[MissionAction]:
        """Convierte una misión en un plan accionable en primera capa."""
        base_context = context or {}
        actions = [
            MissionAction(
                id="A1",
                title="Inventario del ecosistema",
                description=(
                    "Identificar plataformas, agents, scripts, APIs, workflows, knowledge y "
                    "capabilities relevantes para la misión."
                ),
                owner="AI Coordinator",
                priority="critical",
                tags=["ecosystem", "discovery"],
            ),
            MissionAction(
                id="A2",
                title="Validación de reutilización",
                description=(
                    "Comprobar si ya existe una solución reutilizable antes de crear una nueva "
                    "arquitectura o flujo paralelo."
                ),
                owner="Architecture Governance",
                priority="critical",
                tags=["reuse", "governance"],
            ),
            MissionAction(
                id="A3",
                title="Evaluación de duplicación y deuda",
                description=(
                    "Detectar duplicación, dependencia innecesaria, deuda técnica y puntos de riesgo "
                    "que afecten al ecosistema."
                ),
                owner="Mission Control",
                priority="high",
                tags=["duplication", "risk"],
            ),
            MissionAction(
                id="A4",
                title="Priorización y coordinación de ejecución",
                description=(
                    "Asignar la ejecución al componente correcto y mantener control de dependencias, "
                    "críticas, riesgos y evidencia."
                ),
                owner="AI Coordinator",
                priority="high",
                tags=["coordination", "execution"],
            ),
            MissionAction(
                id="A5",
                title="Mejora continua y cierre",
                description=(
                    "Actualizar backlog, historial de progreso y evidencia para cerrar la misión con "
                    "aprendizaje reutilizable."
                ),
                owner="Continuous Improvement",
                priority="medium",
                tags=["improvement", "evidence"],
            ),
        ]

        mission_lower = mission.lower()
        objective_lower = objective.lower()
        if "analizar" in mission_lower or "analizar" in objective_lower:
            actions[0].priority = "critical"
        if "propuesta" in mission_lower or "oferta" in objective_lower:
            actions[3].priority = "critical"
        if base_context.get("risk") == "high":
            actions[2].priority = "critical"
        return actions

    def refresh_continuous_improvement(self, state: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
        """Mantiene la repo de mejora continua actualizada."""
        return self.continuous_improvement.refresh(state=state, mission_event=event)

    def run(
        self,
        mission: str,
        objective: str,
        context: dict[str, Any] | None = None,
        state: dict[str, Any] | None = None,
        event: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Ejecución principal del agente raíz."""
        discovery = self.discover_ecosystem()
        governance = self.validate_governance()
        plan = self.build_action_plan(mission, objective, context or {})

        mission_state = state or {
            "platforms": [{"id": "AI-FACTORY-v2"}],
            "capabilities": [{"id": "coordination-root"}, {"id": "continuous-improvement"}],
            "mission_registry": {"missions": [{"id": "ROOT-COORDINATION"}]},
            "knowledge": {"evidence": [{"id": "e-root-001"}], "truth": [{"id": "t-root-001"}]},
        }
        mission_event = event or {
            "mission_id": "ROOT-COORDINATION",
            "event": mission,
            "agents": ["RootCoordinationAgent"],
        }

        improvement = self.refresh_continuous_improvement(mission_state, mission_event)
        return {
            "status": "ok",
            "mission": mission,
            "objective": objective,
            "ecosystem": discovery,
            "governance": governance,
            "action_plan": [asdict(action) for action in plan],
            "continuous_improvement": improvement,
            "recommendation": (
                "Primero reutiliza, luego integra, y solo crea si la necesidad es demostrada y "
                "la arquitectura vigente no resuelve el problema."
            ),
        }


CoordinadorAgent = RootCoordinationAgent


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Agente raíz de coordinación y mejora continua.")
    parser.add_argument("--mission", default="Gobernanza del ecosistema", help="Nombre de la misión")
    parser.add_argument("--objective", default="Asegurar coordinación y mejora continua del repositorio", help="Objetivo principal")
    parser.add_argument("--context", default="{}", help="Contexto JSON opcional")
    args = parser.parse_args()

    context = json.loads(args.context) if args.context else {}
    agent = RootCoordinationAgent()
    result = agent.run(args.mission, args.objective, context=context)
    print(json.dumps(result, ensure_ascii=False, indent=2))
