from __future__ import annotations

from typing import Callable, Dict, Any
import uuid
from datetime import datetime, timezone
import json

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_default_providers(storage) -> Dict[str, Callable[..., Dict[str, Any]]]:
    """
    Returns a mapping of provider_name -> provider_callable(tenant_id, user, intent, extra)
    Providers centralize repository access; agents must not call storage directly.
    """

    def session_provider(tenant_id, user, intent, extra):
        return {
            "session_id": extra.get("session_id") or str(uuid.uuid4()),
            "last_active": now_iso(),
            "provenance": "session_store",
            "confidence": 0.95,
            "freshness_seconds": 0.0,
            "source": "runtime",
        }

    def user_provider(tenant_id, user, intent, extra):
        return {
            "user_id": user.get("id"),
            "role": user.get("role"),
            "provenance": "request",
            "confidence": 0.95,
            "freshness_seconds": 0.0,
            "source": "request_payload",
        }

    def company_provider(tenant_id, user, intent, extra):
        company = extra.get("company")
        out = {"company_id": company}
        # try to attach latest EHRI profile if available (safe read via storage)
        try:
            if company:
                profile = storage.get_profile(company, company)
                if profile:
                    out["ehri_profile"] = {"profile_id": profile.profile_id, "version": profile.version, "approved": profile.approval_status}
            out.update({"provenance": "ehri_storage", "confidence": 0.8, "freshness_seconds": 0.0, "source": "ehri_db"})
        except Exception:
            out.update({"provenance": "ehri_error", "confidence": 0.0, "freshness_seconds": 0.0, "source": "ehri_db"})
        return out

    def crm_provider(tenant_id, user, intent, extra):
        # aggregate recent CRM-related events (lightweight)
        try:
            events = storage.get_events()
            recent = [e for e in events if (e.get("context") or {}).get("module") == "crm"]
            return {"recent_events_count": len(recent), "sample": recent[-3:], "provenance": "event_store", "confidence": 0.8, "freshness_seconds": 0.0, "source": "events_db"}
        except Exception:
            return {"provenance": "error", "confidence": 0.0}

    def opportunity_provider(tenant_id, user, intent, extra):
        opp = extra.get("opportunity_id")
        out = {"opportunity_id": opp}
        if opp:
            try:
                events = storage.get_events()
                related = [e for e in events if any((r.get("entity_type") == "opportunity" and r.get("entity_id") == opp) for r in ((e.get("context") or {}).get("trace_identity_refs") or []))]
                out.update({"history_count": len(related), "sample": related[-3:]})
            except Exception:
                out.update({"history_count": 0})
        out.update({"provenance": "event_store", "confidence": 0.8, "freshness_seconds": 0.0, "source": "events_db"})
        return out

    def product_provider(tenant_id, user, intent, extra):
        return {"products": [], "provenance": "stub", "confidence": 0.5}

    def project_provider(tenant_id, user, intent, extra):
        return {"projects": [], "provenance": "stub", "confidence": 0.5}

    def enterprise_memory_provider(tenant_id, user, intent, extra):
        try:
            events = storage.get_events()
            knowledge = [e for e in events if e.get("event_type") in ("DOCUMENT_INGESTED", "KNOWLEDGE_APPROVED")]
            return {"knowledge_count": len(knowledge), "recent": knowledge[-3:], "provenance": "events", "confidence": 0.8}
        except Exception:
            return {"knowledge_count": 0, "provenance": "error", "confidence": 0.0}

    def truth_graph_provider(tenant_id, user, intent, extra):
        # placeholder truth graph metadata
        return {"nodes": [], "edges": [], "provenance": "stub", "confidence": 0.5}

    def knowledge_hub_provider(tenant_id, user, intent, extra):
        try:
            events = storage.get_events()
            docs = [e for e in events if e.get("event_type") == "DOCUMENT_INGESTED"]
            approved = [e for e in events if e.get("event_type") == "KNOWLEDGE_APPROVED"]
            return {"documents": len(docs), "approved": len(approved), "provenance": "events", "confidence": 0.85}
        except Exception:
            return {"documents": 0, "approved": 0, "provenance": "error", "confidence": 0.0}

    def business_rules_provider(tenant_id, user, intent, extra):
        # rules may be stored externally; placeholder
        return {"rules": [], "provenance": "stub", "confidence": 0.5}

    def market_provider(tenant_id, user, intent, extra):
        return {"benchmarks": storage.get_benchmarks(tenant_id) if hasattr(storage, "get_benchmarks") else [], "provenance": "ehri", "confidence": 0.6}

    def conversation_provider(tenant_id, user, intent, extra):
        return {"history": extra.get("conversation", []), "provenance": "request", "confidence": 0.9}

    return {
        "session": session_provider,
        "user": user_provider,
        "company": company_provider,
        "crm": crm_provider,
        "opportunity": opportunity_provider,
        "product": product_provider,
        "project": project_provider,
        "enterprise_memory": enterprise_memory_provider,
        "truth_graph": truth_graph_provider,
        "knowledge_hub": knowledge_hub_provider,
        "business_rules": business_rules_provider,
        "market": market_provider,
        "conversation": conversation_provider,
    }
