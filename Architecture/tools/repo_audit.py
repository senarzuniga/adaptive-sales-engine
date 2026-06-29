#!/usr/bin/env python3
"""
Lightweight repository audit that writes Architecture/tools/repo_audit.json.

This intentionally excludes `Architecture/outputs/` and large virtual envs.
"""
from __future__ import annotations

import json
import re
import time
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "repo_audit.json"

EXCLUDE_DIRS = {".git", ".venv", "venv", "node_modules", "Architecture/outputs", "Architecture/outputs/archives"}

PATTERNS = ["TODO", "FIXME", "EXPERIMENTAL", "DEPRECATED"]


def is_excluded(path: Path) -> bool:
    try:
        rel = path.relative_to(ROOT)
    except Exception:
        return True
    s = rel.as_posix()
    for ex in EXCLUDE_DIRS:
        if s == ex or s.startswith(ex + "/"):
            return True
    return False


def scan():
    duplicates = defaultdict(list)
    patterns = {p: [] for p in PATTERNS}
    package_files = []
    requirements = set()
    imports_sample = set()
    total_files = 0

    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if is_excluded(p):
            continue
        rel = p.relative_to(ROOT).as_posix()
        name = p.name
        duplicates[name].append(rel)
        total_files += 1

        # detect package files
        if name in ("package.json", "package-lock.json", "requirements.txt", "pyproject.toml", "setup.py"):
            package_files.append(rel)

        # try reading text content for patterns and imports
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            text = ""

        for pat in PATTERNS:
            if pat in text:
                patterns[pat].append(rel)

        if name.endswith("requirements.txt"):
            for line in text.splitlines():
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                requirements.add(s)

        # cheap import sampling for Python/TS/JS files
        if p.suffix in {".py", ".ts", ".tsx", ".js", ".jsx"}:
            # avoid ambiguous hyphen ranges inside character classes
            for m in re.finditer(r"\bfrom\s+([\w\./-]+)|import\s+([\w\./-]+)", text):
                grp = m.group(1) or m.group(2)
                if grp:
                    imports_sample.add(grp)

    # filter duplicates to only those with more than one occurrence
    dup_filtered = {k: v for k, v in duplicates.items() if len(v) > 1}

    result = {
        "summary": {
            "total_files": total_files,
            "total_duplicates": len(dup_filtered),
            "scanned_root": str(ROOT),
            "timestamp": int(time.time()),
        },
        "duplicates": dup_filtered,
        "patterns": patterns,
        "package_files": package_files,
        "requirements": sorted(requirements),
        "imports_sample": sorted(list(imports_sample))[:200],
    }

    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Audit complete. Results written to {OUT}")


if __name__ == "__main__":
    scan()
