import asyncio
from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import time
import uuid


@dataclass
class AgentResult:
    agent_name: str
    output: Dict[str, Any]
    confidence: float
    evidence: List[Dict[str, Any]]
    execution_metadata: Dict[str, Any]
    reasoning: Dict[str, Any]


class BaseAgent:
    name = "base-agent"

    def input_contract(self) -> Dict[str, Any]:
        return {}

    def output_contract(self) -> Dict[str, Any]:
        return {}

    async def execute(self, context: Dict[str, Any], payload: Dict[str, Any]) -> AgentResult:
        # default stub: sleep and return neutral result
        start = time.time()
        await asyncio.sleep(0.01)
        end = time.time()
        return AgentResult(
            agent_name=self.name,
            output={"note": "stub"},
            confidence=0.5,
            evidence=[],
            execution_metadata={"duration": end - start, "id": str(uuid.uuid4())},
            reasoning={"summary": "stub"}
        )


class CRMIntelligenceAgent(BaseAgent):
    name = "crm-intel"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        # produce structured insights referencing opportunities/leads
        opp = (context.get("entities") or {}).get("opportunity")
        output = {"opportunity_health": "good" if opp else "unknown"}
        evidence = []
        if opp:
            evidence.append({"type": "opportunity_record", "id": opp})
        return AgentResult(self.name, output, 0.85, evidence, {"duration": end - start}, {"summary": "CRM indicators evaluated"})


class OpportunityIntelligenceAgent(BaseAgent):
    name = "opportunity-intel"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        opp = (context.get("entities") or {}).get("opportunity")
        output = {"opportunity_score": 0.7}
        evidence = [{"type": "opportunity_history", "id": opp}] if opp else []
        return AgentResult(self.name, output, 0.8, evidence, {"duration": end - start}, {"summary": "Opportunity signals computed"})


class PricingIntelligenceAgent(BaseAgent):
    name = "pricing-intel"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        # Pricing agent must reference knowledge hub (EHRI) via context (not direct DB calls here)
        output = {"pricing_recommendation": {"recommended_price": None, "reason": "requires EHRI"}}
        evidence = []
        # if EHRI profile present in context, reference it
        ehri = (context.get("knowledge") or {}).get("ehri")
        if ehri:
            output["pricing_recommendation"]["recommended_price"] = 10000
            evidence.append({"type": "ehri_profile", "profile_id": ehri.get("profile_id")})
        return AgentResult(self.name, output, 0.75, evidence, {"duration": end - start}, {"summary": "Pricing signals computed"})


class FinancialIntelligenceAgent(BaseAgent):
    name = "financial-intel"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        output = {"financial_risk": "low"}
        evidence = []
        return AgentResult(self.name, output, 0.9, evidence, {"duration": end - start}, {"summary": "Financial metrics checked"})


class RiskIntelligenceAgent(BaseAgent):
    name = "risk-intel"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        output = {"risk_level": "medium"}
        return AgentResult(self.name, output, 0.7, [], {"duration": end - start}, {"summary": "Risk factors evaluated"})


class ExecutiveAdvisorAgent(BaseAgent):
    name = "executive-advisor"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.02)
        end = time.time()
        output = {"recommendation": "Proceed with caution"}
        return AgentResult(self.name, output, 0.88, [], {"duration": end - start}, {"summary": "Executive synthesis"})


class FactCheckerAgent(BaseAgent):
    name = "fact-checker"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.01)
        end = time.time()
        # validate evidence references present in the event store via context hint
        evidence = payload.get("evidence_refs", [])
        # Simulate checking: mark as approved if any evidence exists
        status = "approved" if evidence else "rejected"
        return AgentResult(self.name, {"fact_check_status": status}, 0.95 if evidence else 0.1, evidence, {"duration": end - start}, {"summary": "Fact check executed"})


class QualityAssuranceAgent(BaseAgent):
    name = "quality-assurance"

    async def execute(self, context, payload):
        start = time.time()
        await asyncio.sleep(0.01)
        end = time.time()
        # compute simple QA metrics
        participants = payload.get("participants", [])
        evidence_coverage = sum(1 for p in participants if p.get('evidence')) / max(1, len(participants))
        qa = {"evidence_score": round(evidence_coverage * 100, 2), "confidence": sum(p.get('confidence', 0) for p in participants) / max(1, len(participants))}
        return AgentResult(self.name, qa, qa.get("confidence", 0.5), [], {"duration": end - start}, {"summary": "QA metrics"})


ALL_AGENTS = [CRMIntelligenceAgent, OpportunityIntelligenceAgent, PricingIntelligenceAgent, FinancialIntelligenceAgent, RiskIntelligenceAgent, ExecutiveAdvisorAgent, FactCheckerAgent, QualityAssuranceAgent]
