from typing import Dict, Any, List, Type
from .agents import ALL_AGENTS


class AgentRegistry:
    def __init__(self):
        self._agents: Dict[str, Type] = {}
        for a in ALL_AGENTS:
            inst = a()
            self._agents[inst.name] = a

    def list_agents(self) -> List[str]:
        return list(self._agents.keys())

    def get_agent(self, name: str):
        cls = self._agents.get(name)
        return cls() if cls else None

    def find_by_intent(self, intent: str):
        # very simple mapping rules
        mapping = {
            "commercial_analysis": ["pricing-intel", "opportunity-intel", "financial-intel", "executive-advisor"],
            "opportunity_assessment": ["opportunity-intel", "crm-intel", "risk-intel"],
            "proposal_generation": ["pricing-intel", "proposal-intel"],
            "pricing_request": ["pricing-intel", "financial-intel"],
            "risk_assessment": ["risk-intel", "financial-intel"],
            "executive_reporting": ["executive-advisor", "quality-assurance"],
            "meeting_summarization": ["crm-intel"],
            "customer_strategy": ["account-strategy"],
            "pipeline_prioritization": ["opportunity-intel", "crm-intel"],
            "forecasting": ["financial-intel"],
            "product_analysis": ["market-intel"],
            "knowledge_retrieval": ["fact-checker"]
        }
        names = mapping.get(intent, [])
        agents = [self.get_agent(n) for n in names if self.get_agent(n) is not None]
        # always include fact-checker and QA
        fc = self.get_agent("fact-checker")
        qa = self.get_agent("quality-assurance")
        if fc:
            agents.append(fc)
        if qa:
            agents.append(qa)
        return [a for a in agents if a]
