"""Enterprise helpers for company persistence and registry management.

These helpers are intentionally lightweight and safe to call from CLI
scripts. They do not perform network operations by default; they only
create local files and update the enterprise registry under
`Architecture/EnterpriseHub/enterprise_registry.yaml`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any, Optional

from config import APP_ROOT


REGISTRY_PATH: Path = APP_ROOT / "Architecture" / "EnterpriseHub" / "enterprise_registry.yaml"
COMPANIES_DIR: Path = APP_ROOT / "enterprise" / "companies"
INGESTION_DIR: Path = APP_ROOT / "Architecture" / "EnterpriseHub" / "ingestion_reports"


def load_registry() -> Dict[str, Any]:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        import yaml

        return yaml.safe_load(REGISTRY_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def save_registry(reg: Dict[str, Any]) -> None:
    try:
        import yaml

        REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        REGISTRY_PATH.write_text(yaml.safe_dump(reg, sort_keys=False), encoding="utf-8")
    except Exception:
        # Fall back to writing JSON (last resort)
        REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        REGISTRY_PATH.write_text(json.dumps(reg, indent=2, ensure_ascii=False), encoding="utf-8")


def ensure_companies_dir() -> Path:
    COMPANIES_DIR.mkdir(parents=True, exist_ok=True)
    return COMPANIES_DIR


def write_company_txt(org_id: str, content: str) -> Path:
    ensure_companies_dir()
    p = COMPANIES_DIR / f"{org_id}.company.txt"
    p.write_text(content, encoding="utf-8")
    return p


def ensure_ingestion_dir(org_id: str) -> Path:
    d = INGESTION_DIR / org_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def update_registry_org(org_id: str, name: str, status: str = "active", extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    reg = load_registry()
    orgs = reg.get("organizations") or []
    existing = next((o for o in orgs if o.get("id") == org_id), None)
    if existing:
        existing.update({"id": org_id, "name": name, "status": status})
        if extra:
            existing.update(extra)
    else:
        obj = {"id": org_id, "name": name, "status": status}
        if extra:
            obj.update(extra)
        orgs.append(obj)
    reg["organizations"] = orgs
    save_registry(reg)
    return reg


def get_default_organization() -> Optional[str]:
    reg = load_registry()
    default = reg.get("default_organization")
    if default:
        return default
    orgs = reg.get("organizations") or []
    if orgs:
        return orgs[0].get("id")
    return None


def read_entities(org_id: str) -> Dict[str, Any]:
    p = INGESTION_DIR / org_id / "entities.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_ingestion_meta(org_id: str, payload: Dict[str, Any]) -> Path:
    d = ensure_ingestion_dir(org_id)
    p = d / "ingestion_meta.json"
    p.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return p
