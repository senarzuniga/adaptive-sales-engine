"""Simple governance validator for the Enterprise Architecture Hub.

This validator checks presence of required registries and basic policy conformance.
"""
from __future__ import annotations

import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read(p: Path):
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def validate() -> dict:
    out = {"ok": True, "errors": []}

    # Required files
    required = [
        ROOT / "organization_registry.yaml",
        ROOT / "repository_registry.yaml",
        ROOT / "agent_registry.yaml",
        ROOT / "module_registry.yaml",
    ]
    for r in required:
        if not r.exists():
            out["ok"] = False
            out["errors"].append(f"Missing required registry: {r.name}")

    # Basic policy checks
    pol = _read(ROOT / "governance" / "policies.yaml")
    if not pol.get("policies"):
        out["ok"] = False
        out["errors"].append("No governance policies defined.")

    return out


if __name__ == "__main__":
    import json

    res = validate()
    print(json.dumps(res, indent=2))
