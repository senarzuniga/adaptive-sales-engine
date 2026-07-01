"""Manage Enterprise Knowledge Sources (CLI).

Stores sources under `Architecture/EnterpriseHub/sources.yaml` and provides
simple commands to add/list/remove sources. This is the programmatic
complement to the UI manager page.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict, List

from config import APP_ROOT


SOURCES_PATH = APP_ROOT / "Architecture" / "EnterpriseHub" / "sources.yaml"


def load_sources() -> Dict[str, Any]:
    if not SOURCES_PATH.exists():
        return {"sources": []}
    try:
        import yaml

        return yaml.safe_load(SOURCES_PATH.read_text(encoding="utf-8")) or {"sources": []}
    except Exception:
        return {"sources": []}


def save_sources(data: Dict[str, Any]) -> None:
    try:
        import yaml

        SOURCES_PATH.parent.mkdir(parents=True, exist_ok=True)
        SOURCES_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    except Exception:
        SOURCES_PATH.parent.mkdir(parents=True, exist_ok=True)
        SOURCES_PATH.write_text(str(data), encoding="utf-8")


def main(argv: List[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="manage_sources")
    p.add_argument("--list", action="store_true")
    p.add_argument("--add", action="store_true")
    p.add_argument("--remove", help="id of source to remove")
    p.add_argument("--id", help="source id when adding")
    p.add_argument("--name", help="display name when adding")
    p.add_argument("--type", help="type (folder, git, sharepoint, csv, zip)")
    p.add_argument("--path", help="path or url")
    p.add_argument("--owner", help="owner")
    p.add_argument("--frequency", help="sync frequency")
    p.add_argument("--priority", help="priority")
    args = p.parse_args(argv)

    data = load_sources()
    sources: List[Dict[str, Any]] = data.get("sources", [])

    if args.list:
        import json

        print(json.dumps(data, indent=2, ensure_ascii=False))
        return 0

    if args.add:
        if not args.id or not args.path or not args.type:
            print("--id, --type and --path are required to add a source")
            return 2
        src = {
            "id": args.id,
            "name": args.name or args.id,
            "type": args.type,
            "path": args.path,
            "owner": args.owner or "",
            "frequency": args.frequency or "manual",
            "priority": args.priority or "normal",
            "rules": {},
            "last_sync": None,
            "last_status": None,
        }
        sources.append(src)
        data["sources"] = sources
        save_sources(data)
        print(f"Source added: {args.id}")
        return 0

    if args.remove:
        before = len(sources)
        sources = [s for s in sources if s.get("id") != args.remove]
        data["sources"] = sources
        save_sources(data)
        print(f"Removed {before - len(sources)} sources with id {args.remove}")
        return 0

    p.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
