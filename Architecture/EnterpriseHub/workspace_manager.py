"""Enterprise Workspace Manager

Lightweight tool to register and validate repositories and organizations.
"""
from __future__ import annotations

import yaml
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent


def _read_yaml(p: Path) -> dict:
    if not p.exists():
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def _write_yaml(p: Path, data: dict) -> None:
    p.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def register_repository(repo_id: str, entry: dict) -> None:
    path = ROOT / "repository_registry.yaml"
    doc = _read_yaml(path)
    repos = doc.get("repositories") or []
    # replace if exists
    for i, r in enumerate(repos):
        if r.get("id") == repo_id:
            repos[i] = entry
            doc["repositories"] = repos
            _write_yaml(path, doc)
            return

    repos.append(entry)
    doc["repositories"] = repos
    _write_yaml(path, doc)


def get_repository(repo_id: str) -> Optional[dict]:
    path = ROOT / "repository_registry.yaml"
    doc = _read_yaml(path)
    for r in doc.get("repositories", []):
        if r.get("id") == repo_id:
            return r
    return None


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("repo_id")
    parser.add_argument("local_path")
    args = parser.parse_args()

    register_repository(args.repo_id, {
        "id": args.repo_id,
        "local_path": args.local_path,
        "status": "active",
    })
    print("Registered", args.repo_id)
