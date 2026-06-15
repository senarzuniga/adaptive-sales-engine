"""
ING_SupportAgent — Orchestrator HTTP service

Provides a lightweight HTTP API to control the `MaximumOrchestrator` from
the workspace. Intended for local autonomous execution and simple integration
with the Streamlit UI or external tools.

Run with:
    python -m uvicorn ing_support_agent.orchestrator_service:app --port 8000

Environment variables:
  ING_SUPPORT_SCHEDULE_SECONDS  — if >0, runs the orchestrator periodically (seconds)
  ING_SUPPORT_PORT              — default port when run as script

"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Try to import existing orchestrator from repo
try:
    from orchestrator import get_max_orchestrator
except Exception as exc:  # pragma: no cover - safe fallback
    get_max_orchestrator = None  # type: ignore


app = FastAPI(title="ING_SupportAgent Orchestrator")

orch = get_max_orchestrator() if get_max_orchestrator else None


def _serialize_value(v: Any) -> Any:
    """Convert common non-JSON types (DataFrame, sets) into serializable forms."""
    try:
        if isinstance(v, pd.DataFrame):
            return {"__dataframe__": {"shape": v.shape, "head": v.head(10).to_dict(orient="records")}}
        if isinstance(v, dict):
            return {k: _serialize_value(val) for k, val in v.items()}
        if isinstance(v, (list, tuple, set)):
            return [_serialize_value(x) for x in list(v)]
        # JSON serializable as-is?
        json.dumps(v)
        return v
    except Exception:
        return str(v)


def _serialize_results(results: Dict[str, Any]) -> Dict[str, Any]:
    return {k: _serialize_value(v) for k, v in results.items()}


@app.get("/")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "agent_count": len(orch.agents) if orch else 0}


@app.get("/agents")
async def list_agents() -> Dict[str, Any]:
    if not orch:
        raise HTTPException(500, "Orchestrator not available")
    agents = [
        {"name": a["name"], "folder": a.get("folder"), "file": a.get("file"), "load_error": a.get("load_error")} for a in orch.agents
    ]
    return {"agents": agents}


class ExecuteRequest(BaseModel):
    action: str
    context: Optional[Dict[str, Any]] = None
    timeout_seconds: Optional[int] = 60


@app.post("/execute")
async def execute(req: ExecuteRequest) -> Dict[str, Any]:
    if not orch:
        raise HTTPException(500, "Orchestrator not available")
    ctx = req.context or {}
    ctx["action"] = req.action
    results = orch.execute_all_agents(ctx, timeout_seconds=int(req.timeout_seconds or 60))
    return _serialize_results(results)


@app.post("/reload")
async def reload_agents() -> Dict[str, Any]:
    if not orch:
        raise HTTPException(500, "Orchestrator not available")
    n = orch.reload_agents()
    return {"reloaded": n}


@app.post("/agent/{agent_name}/run")
async def run_agent(agent_name: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not orch:
        raise HTTPException(500, "Orchestrator not available")
    agent = next((a for a in orch.agents if a["name"] == agent_name), None)
    if not agent:
        raise HTTPException(404, "Agent not found")
    out = orch._safe_run_agent(agent, context or {"action": f"manual_run_{agent_name}"})
    if isinstance(out, dict):
        return _serialize_results(out)
    return {"result": str(out)}


# -------------------- Background scheduler (optional) --------------------
SCHEDULE_SECONDS = int(os.getenv("ING_SUPPORT_SCHEDULE_SECONDS", "0"))


def _scheduler_loop() -> None:
    while True:
        time.sleep(max(10, SCHEDULE_SECONDS))
        try:
            results = orch.execute_all_agents({"action": "scheduled_cycle"}, timeout_seconds=60)
            out_path = Path("outputs") / f"scheduled_{int(time.time())}.json"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(_serialize_results(results), ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:  # pragma: no cover - background error handling
            print("Scheduled run error:", exc)


if SCHEDULE_SECONDS > 0 and orch:
    t = threading.Thread(target=_scheduler_loop, daemon=True)
    t.start()


if __name__ == "__main__":
    # Allow running this module directly (use uvicorn recommended in production)
    import uvicorn

    port = int(os.getenv("ING_SUPPORT_PORT", "8000"))
    uvicorn.run("ing_support_agent.orchestrator_service:app", host="127.0.0.1", port=port)
