from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .actions_validator import validate_repository

MODULE_DIR = Path(__file__).resolve().parent
REPOSITORY_PATH = MODULE_DIR / "actions_repository.json"


def _flatten_actions(repository: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    for stage in repository.get("lifecycle_stages", []):
        for action in stage.get("actions", []):
            enriched = dict(action)
            enriched["stage"] = stage.get("stage")
            actions.append(enriched)
    return actions


def load_repository(existing_actions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    repository = json.loads(REPOSITORY_PATH.read_text(encoding="utf-8"))
    report = validate_repository(repository)
    if not report["valid"]:
        raise ValueError(f"Repository validation failed: {report['issues']}")

    if not existing_actions:
        return repository

    actions_by_id = {a["id"]: dict(a) for a in _flatten_actions(repository)}
    for action in existing_actions:
        action_id = action.get("id")
        if not action_id:
            continue
        actions_by_id[action_id] = {**actions_by_id.get(action_id, {}), **action}

    merged_actions = list(actions_by_id.values())
    stage_names = {s.get("stage") for s in repository.get("lifecycle_stages", [])}
    regrouped: Dict[str, List[Dict[str, Any]]] = {s: [] for s in stage_names if s}
    for action in merged_actions:
        stage = action.get("stage") or "PIPELINE_EXECUTION"
        regrouped.setdefault(stage, []).append({k: v for k, v in action.items() if k != "stage"})

    for stage in repository.get("lifecycle_stages", []):
        stage_name = stage.get("stage")
        stage["actions"] = regrouped.get(stage_name, [])
    return repository


def get_actions_by_stage(stage: str) -> List[Dict[str, Any]]:
    repository = load_repository()
    for stage_node in repository.get("lifecycle_stages", []):
        if stage_node.get("stage") == stage:
            return stage_node.get("actions", [])
    return []


def get_next_best_action(context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    repository = load_repository()
    ranked: List[Dict[str, Any]] = []
    for action in _flatten_actions(repository):
        score = float(action.get("importance_score", 0)) + float(action.get("strategy_alignment", 0)) * 0.25
        if context.get("health_score", 100) < 60 and action.get("id") == "PLAN_MEJORA":
            score += 25
        if context.get("usage_growth", 0) >= 20 and action.get("id") == "IDENTIFICAR_UPSELL":
            score += 20
        if context.get("churn_risk", 0) >= 0.7 and "customer_success" in action.get("ai_tags", []):
            score += 20
        ranked.append({**action, "computed_score": round(score, 2)})

    ranked.sort(key=lambda a: a["computed_score"], reverse=True)
    return ranked[0] if ranked else None


def trigger_actions(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    repository = load_repository()
    triggered: List[Dict[str, Any]] = []
    event_name = str(event.get("event") or "")

    for action in _flatten_actions(repository):
        for trigger in action.get("triggers", []):
            if trigger.get("event") != event_name:
                continue
            logic = str(trigger.get("logic", "")).strip().lower()
            if logic in {"true", "always"}:
                triggered.append(action)
                break
            if "health_score < 60" in logic and float(event.get("health_score", 100)) < 60:
                triggered.append(action)
                break
            if "usage_growth >= 20" in logic and float(event.get("usage_growth", 0)) >= 20:
                triggered.append(action)
                break
            if "churn_model_score >= 0.7" in logic and float(event.get("churn_model_score", 0)) >= 0.7:
                triggered.append(action)
                break
            if "nps_score < 30" in logic and float(event.get("nps_score", 100)) < 30:
                triggered.append(action)
                break

    # Global rule shortcuts
    if float(event.get("health_score", 100)) < float(event.get("health_threshold", 60)):
        plan_mejora = next((a for a in _flatten_actions(repository) if a.get("id") == "PLAN_MEJORA"), None)
        if plan_mejora and plan_mejora not in triggered:
            triggered.append(plan_mejora)

    if float(event.get("usage_growth", 0)) >= 20:
        upsell = next((a for a in _flatten_actions(repository) if a.get("id") == "IDENTIFICAR_UPSELL"), None)
        if upsell and upsell not in triggered:
            triggered.append(upsell)

    return triggered


def evaluate_kpis(action_id: str, observed: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    observed = observed or {}
    repository = load_repository()
    action = next((a for a in _flatten_actions(repository) if a.get("id") == action_id), None)
    if not action:
        return {"action_id": action_id, "status": "not_found", "kpis": []}

    results: List[Dict[str, Any]] = []
    for kpi in action.get("kpis", []):
        name = kpi.get("name")
        target = float(kpi.get("target", 0))
        current = float(observed.get(name, 0))
        ratio = (current / target * 100) if target else 0
        results.append(
            {
                "name": name,
                "target": target,
                "current": current,
                "unit": kpi.get("unit", ""),
                "achievement": round(ratio, 2),
                "status": "on_track" if ratio >= 100 else "below_target",
            }
        )

    return {
        "action_id": action_id,
        "status": "ok",
        "kpis": results,
    }
