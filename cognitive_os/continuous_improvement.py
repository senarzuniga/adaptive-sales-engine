"""Continuous Mission Optimization Engine governance repository manager."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class ObjectiveSpec:
    objective_id: str
    title: str
    priority: str
    dependencies: list[str]
    expected_value: str
    acceptance_criteria: list[str]
    kpis: list[str]
    owner: str
    target_architecture: str


class ContinuousImprovementRepository:
    """Maintains Architecture/ContinuousImprovement as the single source of truth."""

    def __init__(self, root_dir: str | None = None) -> None:
        self._root = Path(root_dir or "Architecture/ContinuousImprovement")
        self._objectives_file = self._root / "01_OBJECTIVES.md"
        self._current_file = self._root / "02_CURRENT_STATE.md"
        self._gaps_file = self._root / "03_GAP_ANALYSIS.md"
        self._backlog_file = self._root / "04_EXECUTION_BACKLOG.md"
        self._history_file = self._root / "05_PROGRESS_HISTORY.md"

    def ensure_repository(self) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        if not self._objectives_file.exists():
            self._objectives_file.write_text(self._default_objectives_markdown(), encoding="utf-8")
        if not self._history_file.exists():
            self._history_file.write_text("# Progress History\n\n", encoding="utf-8")

    def repository_path(self) -> str:
        return str(self._root)

    def refresh(self, state: dict[str, Any], mission_event: dict[str, Any]) -> dict[str, Any]:
        self.ensure_repository()
        objective_specs = self._objective_specs()
        current = self._build_current_state(state)
        gaps = self._build_gap_analysis(objective_specs, current)
        backlog = self._build_execution_backlog(gaps)

        self._current_file.write_text(current, encoding="utf-8")
        self._gaps_file.write_text(gaps, encoding="utf-8")
        self._backlog_file.write_text(backlog, encoding="utf-8")
        self._append_history(mission_event, state, gaps)

        unresolved = self._count_unresolved_gaps(gaps)
        return {
            "repository": str(self._root),
            "updated_at": _now(),
            "unresolved_gaps": unresolved,
            "idle_permitted": unresolved == 0,
        }

    def _objective_specs(self) -> list[ObjectiveSpec]:
        return [
            ObjectiveSpec(
                objective_id="OBJ-M013-001",
                title="Universal CAD ingestion",
                priority="critical",
                dependencies=[],
                expected_value="CAD-independent layout ingestion across enterprise",
                acceptance_criteria=["Pluggable providers active", "DWG failover active", "Intermediate model mandatory"],
                kpis=["supported_formats>=8", "provider_failover=true"],
                owner="AI Coordinator",
                target_architecture="cognitive_os.layout_import_framework",
            ),
            ObjectiveSpec(
                objective_id="OBJ-M013-002",
                title="Persistent layout versioning",
                priority="critical",
                dependencies=["OBJ-M013-001"],
                expected_value="Reproducible snapshots and scenario branches",
                acceptance_criteria=["snapshot persistence", "diff and rollback"],
                kpis=["revision_history=true", "rollback=true"],
                owner="Mission Manager",
                target_architecture="cognitive_os.layout_versioning",
            ),
            ObjectiveSpec(
                objective_id="OBJ-M013-003",
                title="Automatic knowledge and evidence synchronization",
                priority="high",
                dependencies=["OBJ-M013-001"],
                expected_value="No engineering knowledge loss",
                acceptance_criteria=["object evidence generated", "knowledge synchronized"],
                kpis=["evidence_per_object>=1", "sync_cycle_success>=0.95"],
                owner="Knowledge Core",
                target_architecture="cognitive_os.sdk + knowledge_core",
            ),
            ObjectiveSpec(
                objective_id="OBJ-CMOE-001",
                title="Continuous Mission Optimization Engine",
                priority="critical",
                dependencies=["OBJ-M013-001", "OBJ-M013-002", "OBJ-M013-003"],
                expected_value="No idle state while executable work exists",
                acceptance_criteria=["governance docs auto-updated", "gap-driven backlog auto-generated"],
                kpis=["idle_state=false", "backlog_refresh_per_mission=1"],
                owner="AI Coordinator",
                target_architecture="Architecture/ContinuousImprovement",
            ),
        ]

    def _default_objectives_markdown(self) -> str:
        lines = [
            "# Objectives",
            "",
            "Automatically maintained objective baseline for CMOE.",
            "",
        ]
        for spec in self._objective_specs():
            lines.extend(
                [
                    f"## {spec.objective_id} — {spec.title}",
                    f"- Priority: {spec.priority}",
                    f"- Dependencies: {', '.join(spec.dependencies) if spec.dependencies else 'None'}",
                    f"- Expected Value: {spec.expected_value}",
                    f"- Acceptance Criteria: {'; '.join(spec.acceptance_criteria)}",
                    f"- KPIs: {'; '.join(spec.kpis)}",
                    "- Completion Percentage: 0%",
                    "- Required Evidence: runtime evidence + tests + docs",
                    f"- Owner: {spec.owner}",
                    f"- Target Architecture: {spec.target_architecture}",
                    "",
                ]
            )
        return "\n".join(lines)

    def _build_current_state(self, state: dict[str, Any]) -> str:
        mission_registry = state.get("mission_registry", {})
        missions = mission_registry.get("missions", [])
        capabilities = state.get("capabilities", [])
        platforms = state.get("platforms", [])
        truth = state.get("knowledge", {}).get("truth", [])
        evidence = state.get("knowledge", {}).get("evidence", [])

        status = "Working" if capabilities and platforms else "Partially Working"
        lines = [
            "# Current State",
            "",
            f"Generated At: {_now()}",
            "",
            "## Repository Classification",
            f"- Cognitive OS Runtime: {status}",
            f"- Mission Manager: {'Working' if missions else 'Partially Working'}",
            f"- Capability Registry: {'Working' if capabilities else 'Unknown'}",
            f"- Platform Registry: {'Working' if platforms else 'Unknown'}",
            f"- Evidence Runtime: {'Working' if evidence else 'Partially Working'}",
            f"- Knowledge Graph Runtime: {'Working' if truth else 'Partially Working'}",
            "",
            "## Coverage",
            f"- Missions: {len(missions)}",
            f"- Capabilities: {len(capabilities)}",
            f"- Platforms: {len(platforms)}",
            f"- Evidence Records: {len(evidence)}",
            f"- Truth Assertions: {len(truth)}",
            "",
            "## Architecture Health",
            f"- Readiness: {'production-candidate' if len(capabilities) >= 10 else 'in-progress'}",
            f"- Technical Debt: {'medium' if len(capabilities) < 20 else 'low'}",
            f"- Evidence Integrity: {'good' if evidence else 'partial'}",
        ]
        return "\n".join(lines) + "\n"

    def _build_gap_analysis(self, objectives: list[ObjectiveSpec], current_markdown: str) -> str:
        current_lower = current_markdown.lower()
        gaps: list[str] = []
        for item in objectives:
            missing = []
            for requirement in item.acceptance_criteria:
                if requirement.lower() not in current_lower:
                    missing.append(requirement)
            if missing:
                gaps.append(f"- {item.objective_id} ({item.title}): missing {', '.join(missing)}")

        if not gaps:
            gaps.append("- No unresolved governance gaps detected.")

        block = [
            "# Gap Analysis",
            "",
            f"Generated At: {_now()}",
            "",
            *gaps,
            "",
        ]
        return "\n".join(block) + "\n"

    def _build_execution_backlog(self, gaps_markdown: str) -> str:
        lines = [
            "# Execution Backlog",
            "",
            "## Priority Queue",
            "",
        ]
        for line in gaps_markdown.splitlines():
            if line.strip().startswith("-") and "No unresolved" not in line:
                lines.append(f"- [ ] {line.strip()[2:]}")
        if len(lines) == 4:
            lines.append("- [ ] Confirm governance cycle remains healthy.")
        lines.append("")
        return "\n".join(lines) + "\n"

    def _append_history(self, mission_event: dict[str, Any], state: dict[str, Any], gaps: str) -> None:
        entry = [
            "## Mission Event",
            "",
            f"- Timestamp: {_now()}",
            f"- Mission: {mission_event.get('event', 'unknown')}",
            f"- Mission ID: {mission_event.get('mission_id', 'unknown')}",
            f"- Agents: {', '.join(mission_event.get('agents', [])) or 'n/a'}",
            f"- Capabilities: {len(state.get('capabilities', []))}",
            f"- Platforms: {len(state.get('platforms', []))}",
            "",
            "### Gap Summary",
            "",
            gaps,
            "",
        ]
        with self._history_file.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(entry))

    def _count_unresolved_gaps(self, gaps_markdown: str) -> int:
        count = 0
        for line in gaps_markdown.splitlines():
            if line.strip().startswith("-") and "No unresolved" not in line:
                count += 1
        return count
