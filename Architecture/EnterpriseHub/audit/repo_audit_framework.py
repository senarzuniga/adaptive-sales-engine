"""Repository Audit Framework (scaffold)

Provides the entrypoint for enterprise repository audits. Scans repositories listed
in repository_registry.yaml and collects high-level metadata.
"""
from __future__ import annotations

import yaml
from pathlib import Path
from typing import List, Dict
import os
import json

ROOT = Path(__file__).resolve().parent.parent


def _read_yaml(p: Path):
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def scan_repo(repo_entry: Dict) -> Dict:
    p = Path(repo_entry.get("local_path", ""))
    if not p.exists():
        return {"id": repo_entry.get("id"), "status": "missing"}

    # Basic metadata
    files = 0
    for root, dirs, filenames in os.walk(p):
        files += len(filenames)

    return {"id": repo_entry.get("id"), "path": str(p), "file_count": files}


def audit_all() -> List[Dict]:
    repo_yaml = _read_yaml(ROOT / "repository_registry.yaml")
    repos = repo_yaml.get("repositories", [])
    out = []
    for r in repos:
        out.append(scan_repo(r))
    return out


if __name__ == "__main__":
    out = audit_all()
    print(json.dumps(out, indent=2))
