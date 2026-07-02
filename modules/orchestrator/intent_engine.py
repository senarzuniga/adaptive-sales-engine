from typing import Dict, Any


class IntentUnderstandingEngine:
    """Simple intent understanding engine.

    This is a lightweight, rule-based placeholder that can be replaced
    by a richer model later. It detects intent, reports confidence and
    a simple ambiguity flag.
    """

    def analyze(self, user_request: str) -> Dict[str, Any]:
        text = (user_request or "").lower()
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

        ambiguous = len(text.split()) < 3
        return {"intent": intent, "confidence": 0.9, "ambiguous": ambiguous}
