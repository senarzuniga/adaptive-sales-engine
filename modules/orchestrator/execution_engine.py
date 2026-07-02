import asyncio
from typing import Any, Dict, List


class ExecutionEngine:
    """Executes a plan produced by the ExecutionPlanner.

    For now this is a thin wrapper around asyncio.gather with simple
    parallel group handling and execution metrics collection.
    """

    async def execute_plan(self, plan: Dict[str, Any], registry, context_package) -> Dict[str, Any]:
        agents = plan.get("agents", [])
        results = []
        # execute all agents in parallel for now
        tasks = []
        for name in agents:
            ag = registry.get_agent(name)
            if not ag:
                continue

            async def run(a, ctx):
                try:
                    r = await a.execute(ctx, {})
                    return {"agent_name": r.agent_name, "output": r.output, "confidence": r.confidence, "evidence": r.evidence, "reasoning": r.reasoning}
                except Exception as e:
                    return {"agent_name": a.name, "output": {}, "confidence": 0.0, "evidence": [], "reasoning": {"error": str(e)}}

            tasks.append(run(ag, context_package))

        if tasks:
            results = await asyncio.gather(*tasks)

        return {"plan": plan, "results": results}
