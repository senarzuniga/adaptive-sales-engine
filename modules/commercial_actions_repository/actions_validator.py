from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Set


REQUIRED_ACTION_FIELDS = {
    "id",
    "description",
    "role",
    "inputs",
    "outputs",
    "triggers",
    "kpis",
    "ai_tags",
}


def _flatten(repository: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    for stage in repository.get("lifecycle_stages", []):
        for action in stage.get("actions", []):
            actions.append({**action, "_stage": stage.get("stage")})
    return actions


def validate_json_structure(repository: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    if not isinstance(repository.get("lifecycle_stages"), list) or not repository["lifecycle_stages"]:
        issues.append("lifecycle_stages must be a non-empty array")
        return issues

    for stage in repository["lifecycle_stages"]:
        if not stage.get("stage"):
            issues.append("each lifecycle stage must define stage")
        if not isinstance(stage.get("processes"), list):
            issues.append(f"stage {stage.get('stage', '<unknown>')} must define processes[]")
        if not isinstance(stage.get("actions"), list):
            issues.append(f"stage {stage.get('stage', '<unknown>')} must define actions[]")
            continue

        for action in stage.get("actions", []):
            missing = REQUIRED_ACTION_FIELDS - set(action.keys())
            if missing:
                issues.append(f"action {action.get('id', '<unknown>')} missing fields: {sorted(missing)}")
            if not str(action.get("role", "")).strip():
                issues.append(f"action {action.get('id', '<unknown>')} has empty role")
            for trigger in action.get("triggers", []):
                if not str(trigger.get("event", "")).strip() or not str(trigger.get("logic", "")).strip():
                    issues.append(f"action {action.get('id', '<unknown>')} has invalid trigger logic")
    return issues


def validate_unique_action_ids(repository: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    seen: Set[str] = set()
    for action in _flatten(repository):
        action_id = action.get("id")
        if action_id in seen:
            issues.append(f"duplicate action id detected: {action_id}")
        seen.add(action_id)
    return issues


def validate_dependencies(repository: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    output_index = defaultdict(set)
    for action in _flatten(repository):
        for output in action.get("outputs", []):
            output_index[output].add(action.get("id"))

    for action in _flatten(repository):
        for input_key in action.get("inputs", []):
            if input_key in {"market_signals", "crm_data", "historical_data", "external_signals"}:
                continue
            if not output_index.get(input_key):
                issues.append(f"action {action.get('id')} input '{input_key}' has no producer output")
    return issues


def detect_orphan_actions(repository: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    actions = _flatten(repository)
    referenced_ids: Set[str] = set()
    for action in actions:
        for trigger in action.get("triggers", []):
            for dep in trigger.get("depends_on", []) or []:
                referenced_ids.add(dep)

    action_ids = {a.get("id") for a in actions}
    for action in actions:
        has_dep = any((trigger.get("depends_on") or []) for trigger in action.get("triggers", []))
        if not has_dep and action.get("id") not in referenced_ids and action.get("id") not in {"IDENTIFICAR_NUEVO_LEAD", "PRIORIZAR_POR_SCORE"}:
            issues.append(f"orphan action detected: {action.get('id')}")
        for trigger in action.get("triggers", []):
            for dep in trigger.get("depends_on", []) or []:
                if dep not in action_ids:
                    issues.append(f"action {action.get('id')} depends on unknown action '{dep}'")
    return issues


def detect_circular_triggers(repository: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    graph: Dict[str, List[str]] = {}
    for action in _flatten(repository):
        graph[action.get("id")] = []
        for trigger in action.get("triggers", []):
            graph[action.get("id")].extend(trigger.get("depends_on", []) or [])

    visiting: Set[str] = set()
    visited: Set[str] = set()

    def dfs(node: str) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for nxt in graph.get(node, []):
            if dfs(nxt):
                return True
        visiting.remove(node)
        visited.add(node)
        return False

    for node in graph:
        if dfs(node):
            issues.append(f"circular trigger dependency detected at action '{node}'")
            break

    return issues


def validate_repository(repository: Dict[str, Any]) -> Dict[str, Any]:
    issues = []
    issues.extend(validate_json_structure(repository))
    issues.extend(validate_unique_action_ids(repository))
    issues.extend(validate_dependencies(repository))
    issues.extend(detect_orphan_actions(repository))
    issues.extend(detect_circular_triggers(repository))

    return {
        "valid": len(issues) == 0,
        "issues": issues,
    }
