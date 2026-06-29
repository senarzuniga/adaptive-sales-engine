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
    # Normalize to POSIX-style relative paths (agents/filename.py)
    return sorted([p.as_posix() for p in base.glob("*.py") if p.is_file()])


def normalize_registry_paths(reg):
    agents = reg.get("agents", [])
    normalized = []
    for a in agents:
        p = a.get("path", "")
        if not p:
            continue
        # Normalize any platform-specific separators and remove redundant ./
        normalized.append(Path(p).as_posix())
    return normalized


def main():
    reg = load_registry()
    reg_paths = set(normalize_registry_paths(reg))

    disk = set(discover_agents_dir())

    missing_in_registry = sorted(disk - reg_paths)
    missing_on_disk = sorted(reg_paths - disk)

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
