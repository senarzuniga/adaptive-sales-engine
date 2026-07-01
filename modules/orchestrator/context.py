from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Mapping, Optional
from datetime import datetime, timezone
import uuid
import json


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ContextObject:
    name: str
    data: Dict[str, Any]
    provenance: str
    freshness_seconds: float = 0.0
    confidence: float = 0.8
    source: str = "local"
    timestamp: str = field(default_factory=now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "data": self.data,
            "provenance": self.provenance,
            "freshness_seconds": self.freshness_seconds,
            "confidence": self.confidence,
            "source": self.source,
            "timestamp": self.timestamp,
        }


class ContextPackage(Mapping):
    """
    Immutable container for multiple ContextObject instances.
    Implements a mapping interface so existing agents can call `.get()` or `[]`.
    """

    def __init__(self, tenant_id: str, contexts: Iterable[ContextObject]):
        self.package_id = str(uuid.uuid4())
        self.tenant_id = tenant_id
        self.created_at = now_iso()
        # store contexts in a dict keyed by name
        self._contexts: Dict[str, ContextObject] = {c.name: c for c in contexts}
        # build a flattened view for convenience (merge context.data under their names)
        flat = {name: obj.data for name, obj in self._contexts.items()}
        # Provide a convenience 'entities' map for backward compatibility with existing agents
        entities = {}
        for k in ("company", "opportunity", "product", "project"):
            val = flat.get(k)
            if isinstance(val, dict):
                # try common id fields
                id_fields = [f"{k}_id", "id", "company_id", "profile_id"]
                found = None
                for f in id_fields:
                    if f in val and val.get(f):
                        found = val.get(f)
                        break
                entities[k] = found
            else:
                entities[k] = val
        flat["entities"] = entities

        # Build a 'knowledge' convenience map (e.g., ehri) for agents expecting a 'knowledge' namespace
        knowledge = {}
        comp = flat.get("company") or {}
        if isinstance(comp, dict) and comp.get("ehri_profile"):
            knowledge["ehri"] = comp.get("ehri_profile")
        # include knowledge_hub summary if present
        kh = flat.get("knowledge_hub") or {}
        if isinstance(kh, dict):
            knowledge["hub_summary"] = {"documents": kh.get("documents"), "approved": kh.get("approved")}
        flat["knowledge"] = knowledge

        flat["tenant_id"] = tenant_id
        self._flat = flat
        # freeze
        self._frozen = True

    # Mapping protocol
    def __getitem__(self, key: str) -> Any:
        return self._flat[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self._flat.get(key, default)

    def __iter__(self):
        return iter(self._flat)

    def __len__(self) -> int:
        return len(self._flat)

    def items(self):
        return self._flat.items()

    def contexts(self) -> Dict[str, ContextObject]:
        return dict(self._contexts)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_id": self.package_id,
            "tenant_id": self.tenant_id,
            "created_at": self.created_at,
            "contexts": {n: c.to_dict() for n, c in self._contexts.items()},
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)

    def summary(self) -> Dict[str, Any]:
        # small summary for event logging
        return {
            "package_id": self.package_id,
            "tenant_id": self.tenant_id,
            "created_at": self.created_at,
            "contexts": {n: {"provenance": c.provenance, "freshness_seconds": c.freshness_seconds, "confidence": c.confidence, "source": c.source, "timestamp": c.timestamp} for n, c in self._contexts.items()},
        }


class ContextBuilder:
    """
    Builds a ContextPackage by invoking lightweight providers. Providers may wrap
    repository access but ContextBuilder centralizes and standardizes context assembly.
    """

    DEFAULT_CONTEXTS = [
        "session",
        "user",
        "company",
        "crm",
        "opportunity",
        "product",
        "project",
        "enterprise_memory",
        "truth_graph",
        "knowledge_hub",
        "business_rules",
        "market",
        "conversation",
    ]

    def __init__(self, providers: Optional[Dict[str, Any]] = None):
        # providers is a map of context_name -> callable that returns a dict
        self.providers = providers or {}

    def _make_context(self, name: str, tenant_id: str, user: Dict[str, Any], intent: Dict[str, Any], extra: Dict[str, Any]) -> ContextObject:
        # Call provider if available, otherwise return a stubbed context
        provider = self.providers.get(name)
        try:
            data = provider(tenant_id=tenant_id, user=user, intent=intent, extra=extra) if provider else {}
            provenance = data.get("provenance", "stub")
            confidence = float(data.get("confidence", 0.8))
            freshness = float(data.get("freshness_seconds", 0.0))
            source = data.get("source", "local_stub")
        except Exception:
            data = {}
            provenance = "error"
            confidence = 0.0
            freshness = 0.0
            source = "error"

        return ContextObject(name=name, data=data, provenance=provenance, freshness_seconds=freshness, confidence=confidence, source=source)

    def build(self, tenant_id: str, user: Dict[str, Any], intent: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> ContextPackage:
        extra = extra or {}
        contexts = []
        for name in self.DEFAULT_CONTEXTS:
            contexts.append(self._make_context(name, tenant_id, user, intent, extra))
        pkg = ContextPackage(tenant_id=tenant_id, contexts=contexts)
        return pkg
