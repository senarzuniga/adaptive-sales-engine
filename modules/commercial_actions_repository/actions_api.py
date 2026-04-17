from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from .actions_engine import (
    evaluate_kpis,
    get_actions_by_stage,
    get_next_best_action,
    load_repository,
    trigger_actions,
)
from .actions_validator import validate_repository

router = APIRouter(prefix="/actions", tags=["commercial-actions-repository"])


@router.get("")
def get_actions() -> Dict[str, Any]:
    repo = load_repository()
    return repo


@router.get("/{stage}")
def get_actions_for_stage(stage: str) -> Dict[str, Any]:
    return {"stage": stage, "actions": get_actions_by_stage(stage)}


@router.post("")
def add_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    repo = load_repository(existing_actions=[payload])
    report = validate_repository(repo)
    if not report["valid"]:
        raise HTTPException(status_code=400, detail=report)
    return {"status": "ok", "repository": repo}


@router.put("/{action_id}")
def update_action(action_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    payload["id"] = action_id
    repo = load_repository(existing_actions=[payload])
    report = validate_repository(repo)
    if not report["valid"]:
        raise HTTPException(status_code=400, detail=report)
    return {"status": "ok", "repository": repo}


@router.post("/trigger")
def trigger(payload: Dict[str, Any]) -> Dict[str, Any]:
    triggered = trigger_actions(payload)
    return {"triggered": triggered}


@router.get("/next-best")
def next_best(context: Dict[str, Any]) -> Dict[str, Any]:
    action = get_next_best_action(context)
    return {"next_best_action": action}


@router.get("/kpi/{action_id}")
def kpi(action_id: str) -> Dict[str, Any]:
    return evaluate_kpis(action_id)
