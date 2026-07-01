"""Enterprise Architecture Governance Engine (scaffold)

Provides APIs to query and validate registries and apply governance policies.
"""
from __future__ import annotations

import yaml
from pathlib import Path
from typing import Dict

ROOT = Path(__file__).resolve().parent


def _read_yaml(p: Path) -> Dict:
    if not p.exists():
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


class GovernanceEngine:
    def __init__(self):
        self.orgs = _read_yaml(ROOT / "organization_registry.yaml")
        self.repos = _read_yaml(ROOT / "repository_registry.yaml")
        self.modules = _read_yaml(ROOT / "module_registry.yaml")
        self.agents = _read_yaml(ROOT / "agent_registry.yaml")

    def list_organizations(self):
        return self.orgs.get("organizations", [])

    def list_repositories(self):
        return self.repos.get("repositories", [])

    def validate_policies(self):
        from governance.validator import validate

        return validate()


if __name__ == "__main__":
    ge = GovernanceEngine()
    print("Organizations:", len(ge.list_organizations()))
    print("Repositories:", len(ge.list_repositories()))
    print("Policy check:", ge.validate_policies())
