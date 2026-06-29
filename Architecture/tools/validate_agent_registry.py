#!/usr/bin/env python3
"""Validate `Architecture/Agents/agent_registry.json` vs agents on disk.

Exits with code 2 on mismatch to fail CI.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


REGISTRY = Path("Architecture") / "Agents" / "agent_registry.json"


def load_registry():
    if not REGISTRY.exists():
        print(f"Registry file not found: {REGISTRY}")
        return {}
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def discover_agents_dir():
    base = Path("agents")
    if not base.exists():
        return []
    return sorted([str(p) for p in base.glob("*.py") if p.is_file()])


def main():
    reg = load_registry()
    reg_agents = {a.get("path"): a for a in reg.get("agents", [])}

    disk = discover_agents_dir()

    missing_in_registry = [d for d in disk if d not in reg_agents]
    missing_on_disk = [p for p in reg_agents.keys() if p not in disk]

    if missing_in_registry:
        print("ERROR: Agents found on disk but missing from registry:")
        for m in missing_in_registry:
            print("  -", m)

    if missing_on_disk:
        print("ERROR: Agents referenced in registry but not found on disk:")
        for m in missing_on_disk:
            print("  -", m)

    if missing_in_registry or missing_on_disk:
        print("Please update Architecture/Agents/agent_registry.json to match disk. See ADR-0002.")
        sys.exit(2)

    print("Agent registry OK — registry matches disk agents folder.")
    sys.exit(0)


if __name__ == "__main__":
    main()
