import asyncio
from typing import Dict, Any, List, Optional
from modules.ehri.event import ASEEvent
from modules.ehri.storage import Storage
from modules.ehri.service import EHRIService
from .registry import AgentRegistry
from .context import ContextBuilder, ContextPackage
from .providers import create_default_providers
from .fact_checker import FactCheckerEngine
from .traceability import TraceabilityEngine
from .decision import ExecutiveDecision
import time
import statistics


class IntentAnalyzer:
    def analyze(self, user_request: str) -> Dict[str, Any]:
        text = user_request.lower()
        # lightweight rule-based mapping
        if "proposal" in text or "submit" in text:
            intent = "proposal_generation"
        elif "price" in text or "pricing" in text:
            intent = "pricing_request"
        elif "opportunity" in text or "deal" in text:
            intent = "opportunity_assessment"
        elif "risk" in text:
            intent = "risk_assessment"
        elif "report" in text or "dashboard" in text:
            intent = "executive_reporting"
        else:
            intent = "commercial_analysis"
        return {"intent": intent, "confidence": 0.9}





class FusionEngine:
    def fuse(self, agent_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Merge outputs and compute global confidence
        merged = {}
        confidences = [r.get("confidence", 0) for r in agent_results]
        global_conf = statistics.mean(confidences) if confidences else 0.0
        # Merge reasoning summaries
        reasons = {r.get("agent_name"): r.get("reasoning") for r in agent_results}
        # Simple merge: collect outputs under agent name
        outputs = {r.get("agent_name"): r.get("output") for r in agent_results}
        evidence = [e for r in agent_results for e in (r.get("evidence") or [])]
        return {"outputs": outputs, "global_confidence": round(global_conf, 3), "reasons": reasons, "evidence": evidence}


class QualityAssessor:
    THRESHOLDS = {
        "evidence": 95.0,
        "business_accuracy": 90.0,
        "financial_consistency": 95.0,
        "reasoning": 90.0,
        "completeness": 90.0,
        "executive_value": 90.0,
        "confidence": 90.0,
    }

    def assess(self, fusion_output: Dict[str, Any], agent_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Compute simple scores based on presence of evidence and confidences
        evidence_count = len(fusion_output.get("evidence", []))
        participants = len(agent_results)
        evidence_score = min(100.0, (evidence_count / max(1, participants)) * 100)
        avg_conf = (sum([r.get("confidence", 0) for r in agent_results]) / max(1, participants)) * 100
        # placeholders for other metrics
        results = {
            "evidence_score": round(evidence_score, 2),
            "business_accuracy": 95.0,
            "financial_consistency": 96.0,
            "reasoning_quality": 92.0,
            "completeness": 95.0,
            "executive_value": 93.0,
            "confidence": round(avg_conf, 2),
        }
        # compute an overall quality score as weighted average
        weights = {"evidence_score": 0.2, "business_accuracy": 0.2, "financial_consistency": 0.15, "reasoning_quality": 0.15, "completeness": 0.15, "executive_value": 0.1, "confidence": 0.05}
        total = 0.0
        for k, w in weights.items():
            total += results.get(k, 0) * w
        results["quality_score"] = round(total, 2)
        results["meets_thresholds"] = all(results.get(k, 0) >= v for k, v in self.THRESHOLDS.items())
        return results


class Orchestrator:
    def __init__(self, storage: Optional[Storage] = None):
        self.service = EHRIService() if storage is None else None
        self.storage = storage if storage is not None else self.service.storage
        self.registry = AgentRegistry()
        self.intent_analyzer = IntentAnalyzer()
        # Build a ContextBuilder with default providers that centralize storage access
        providers = create_default_providers(self.storage)
        self.context_builder = ContextBuilder(providers=providers)
        self.fusion = FusionEngine()
        self.qa = QualityAssessor()
        self.fact_checker = FactCheckerEngine()
        self.traceability = TraceabilityEngine()

    async def execute(self, user_request: str, tenant_id: str = "ACME", user: Optional[Dict[str, Any]] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        user = user or {"id": "sys_user", "role": "cg officer"}
        # Intent detection
        intent = self.intent_analyzer.analyze(user_request)
        ev_intent = ASEEvent(event_type="AI_INTENT_DETECTED", payload={"request": user_request, "intent": intent})
        self.storage.append_event(ev_intent)

        # Context build -> produces an immutable ContextPackage
        context_pkg: ContextPackage = self.context_builder.build(tenant_id, user, intent, extra or {})
        ev_ctx = ASEEvent(event_type="AI_CONTEXT_BUILT", payload={"context_summary": context_pkg.summary()})
        self.storage.append_event(ev_ctx)

        # Select agents
        selected_agents = self.registry.find_by_intent(intent.get("intent"))
        ev_agents = ASEEvent(event_type="AI_AGENTS_SELECTED", payload={"agents": [a.name for a in selected_agents]})
        self.storage.append_event(ev_agents)

        # Execute agents in parallel; every agent receives the ContextPackage
        agent_tasks = []
        for ag in selected_agents:
            async def run_agent(agent, ctx_pkg):
                ev_start = ASEEvent(event_type="AI_AGENT_EXECUTION_STARTED", payload={"agent": agent.name})
                self.storage.append_event(ev_start)
                try:
                    res = await agent.execute(ctx_pkg, {})
                    # convert AgentResult to dict
                    rdict = {"agent_name": res.agent_name, "output": res.output, "confidence": res.confidence, "evidence": res.evidence, "execution_metadata": res.execution_metadata, "reasoning": res.reasoning}
                    ev_done = ASEEvent(event_type="AI_AGENT_EXECUTION_COMPLETED", payload={"agent": agent.name, "result": rdict})
                    self.storage.append_event(ev_done)
                    return rdict
                except Exception as e:
                    ev_err = ASEEvent(event_type="AI_AGENT_EXECUTION_FAILED", payload={"agent": agent.name, "error": str(e)})
                    self.storage.append_event(ev_err)
                    return {"agent_name": agent.name, "output": {}, "confidence": 0.0, "evidence": [], "execution_metadata": {"error": str(e)}, "reasoning": {}}

            agent_tasks.append(run_agent(ag, context_pkg))

        results = await asyncio.gather(*agent_tasks)

        # Fusion
        fusion_output = self.fusion.fuse(results)
        ev_fuse = ASEEvent(event_type="AI_FUSION_COMPLETED", payload={"fusion": fusion_output})
        self.storage.append_event(ev_fuse)

        # Fact checking (mandatory): validate fusion output and agent evidence
        fc_validation = self.fact_checker.validate(context_pkg, fusion_output, results, self.storage)
        ev_fc = ASEEvent(event_type="AI_FACT_CHECK_VALIDATION", payload={"validation": fc_validation})
        self.storage.append_event(ev_fc)

        # If fact-check fails, trigger replanning before producing an executive response
        if not fc_validation.get("passed"):
            ev_replan = ASEEvent(event_type="AI_REPLANNING", payload={"reason": "fact_check_failed", "issues": fc_validation.get("issues")})
            self.storage.append_event(ev_replan)
            # Re-run low-confidence agents to try to gather evidence
            to_rerun = [a for a in results if a.get("confidence", 0) < 0.8]
            rerun_agents = [self.registry.get_agent(r.get("agent_name")) for r in to_rerun if self.registry.get_agent(r.get("agent_name"))]
            rerun_tasks = [ag.execute(context_pkg, {}) for ag in rerun_agents]
            if rerun_tasks:
                rerun_results = await asyncio.gather(*rerun_tasks)
                rdicts = [{"agent_name": r.agent_name, "output": r.output, "confidence": r.confidence, "evidence": r.evidence, "execution_metadata": r.execution_metadata, "reasoning": r.reasoning} for r in rerun_results]
                results.extend(rdicts)
                fusion_output = self.fusion.fuse(results)
                # re-validate
                fc_validation = self.fact_checker.validate(context_pkg, fusion_output, results, self.storage)
                ev_fc2 = ASEEvent(event_type="AI_FACT_CHECK_VALIDATION", payload={"validation": fc_validation})
                self.storage.append_event(ev_fc2)

        # Quality assessment
        qa_result = self.qa.assess(fusion_output, results)
        ev_qa = ASEEvent(event_type="AI_QUALITY_VALIDATION", payload={"qa": qa_result})
        self.storage.append_event(ev_qa)

        # Auto improvement loop
        if not qa_result.get("meets_thresholds"):
            ev_replan = ASEEvent(event_type="AI_REPLANNING", payload={"reason": "quality thresholds not met"})
            self.storage.append_event(ev_replan)
            # Simple re-execution strategy: re-run agents with confidence < 0.8
            to_rerun = [a for a in results if a.get("confidence", 0) < 0.8]
            rerun_agents = [self.registry.get_agent(r.get("agent_name")) for r in to_rerun if self.registry.get_agent(r.get("agent_name"))]
            rerun_tasks = [ag.execute(context_pkg, {}) for ag in rerun_agents]
            if rerun_tasks:
                rerun_results = await asyncio.gather(*rerun_tasks)
                # convert rerun results
                rdicts = [{"agent_name": r.agent_name, "output": r.output, "confidence": r.confidence, "evidence": r.evidence, "execution_metadata": r.execution_metadata, "reasoning": r.reasoning} for r in rerun_results]
                results.extend(rdicts)
                fusion_output = self.fusion.fuse(results)
                qa_result = self.qa.assess(fusion_output, results)
                ev_remerge = ASEEvent(event_type="AI_REMERGE_COMPLETED", payload={"fusion": fusion_output, "qa": qa_result})
                self.storage.append_event(ev_remerge)

        # Build traceability artifact
        trace = self.traceability.trace(context_pkg, fusion_output, results, self.storage)

        # Build structured Executive Decision object
        decision = ExecutiveDecision(
            tenant_id=tenant_id,
            recommendation=fusion_output.get("outputs"),
            confidence=fusion_output.get("global_confidence") or 0.0,
            quality_score=qa_result.get("quality_score"),
            supporting_evidence=fusion_output.get("evidence"),
            participating_agents=[r.get("agent_name") for r in results],
            traceability=trace,
            metadata={"fact_check": fc_validation},
        )

        ev_decision = ASEEvent(event_type="AI_EXECUTIVE_DECISION", payload={"decision": decision.to_dict()})
        self.storage.append_event(ev_decision)

        # Feed ARE with execution metrics by computing ARS (ARE reads the same events)
        return decision.to_dict()
