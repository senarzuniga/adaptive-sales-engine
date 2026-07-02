from typing import Dict, Any, List


class ExecutionPlanner:
    """Lightweight execution planner that selects agents and orders them.

    This planner is a placeholder that uses the AgentRegistry externally
    to decide a simple plan. It returns a plan dict suitable for the
    Execution Engine.
    """

    def plan(self, intent: Dict[str, Any], registry, context_package) -> Dict[str, Any]:
        # find candidate agents
        candidates = registry.find_by_intent(intent.get("intent"))
        # naive ordering: quality agents last
        ordered = sorted(candidates, key=lambda a: a.name)
        plan = {
            "intent": intent,
            "agents": [a.name for a in ordered],
            "parallel_groups": [[a.name for a in ordered]],
            "metadata": {"planner_version": "0.1"},
        }
        return plan
