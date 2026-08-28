#!/usr/bin/env python3
"""
Safe migration staging for duplicated files detected by Architecture/tools/repo_audit.py

Usage:
  - Dry run (default): lists actions
  - --apply: copy duplicates into a timestamped staging dir under Architecture/outputs/duplicates/
  - --top N: limit to top N duplicate basenames (default 25)

This tool is intentionally conservative: it copies files for manual review, it does not delete or modify originals.
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
import shutil
import time

ROOT = Path(__file__).resolve().parents[3]
AUDIT = ROOT / "Architecture" / "tools" / "repo_audit.json"
OUTPUT_BASE = ROOT / "Architecture" / "outputs" / "duplicates"


def load_audit(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def top_duplicates(audit: dict, top_n: int = 25):
    dup = audit.get("duplicates", {})
    items = sorted(dup.items(), key=lambda kv: -len(kv[1]))
    return items[:top_n]


def sanitize_name(p: Path) -> str:
    # replace colon or backslash for Windows-safe filenames
    return str(p).replace(":", "_").replace("\\", "_").replace("/", "_")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=25, help="Top N duplicated basenames to stage")
    parser.add_argument("--apply", action="store_true", help="Copy duplicates into staging folder")
    parser.add_argument("--audit", type=str, default=str(AUDIT), help="Path to repo_audit.json")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    audit_path = Path(args.audit)
    if not audit_path.exists():
        logging.error(f"Audit file not found: {audit_path}")
        return

    audit = load_audit(audit_path)
    items = top_duplicates(audit, top_n=args.top)

    ts = int(time.time())
    staging_dir = OUTPUT_BASE / str(ts)

    logging.info(f"Found {len(audit.get('duplicates', {}))} duplicated basenames in audit")
    logging.info(f"Preparing top {len(items)} duplicates")

    planned = []
    for basename, paths in items:
        planned.append((basename, paths))

    for basename, paths in planned:
        logging.info(f"\n- Basename: {basename} ({len(paths)} occurrences)")
        for p in paths:
            logging.info(f"    • {p}")

    if not args.apply:
        logging.info("\nDry-run complete. To stage copies for manual review, rerun with --apply")
        return

    # Apply: copy files into staging_dir
    staging_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for basename, paths in planned:
        target_sub = staging_dir / basename
        target_sub.mkdir(parents=True, exist_ok=True)
        for p in paths:
            src = ROOT / Path(p)
            if not src.exists():
                logging.warning(f"Source missing, skipping: {src}")
                continue
            # create a sanitized copy name to avoid collisions
            copy_name = sanitize_name(Path(p))
            dest = target_sub / copy_name
            try:
                shutil.copy2(src, dest)
                copied += 1
            except Exception as e:
                logging.error(f"Failed to copy {src} -> {dest}: {e}")

    logging.info(f"\nStaging complete: {copied} files copied to {staging_dir}")
    logging.info("Review staged copies and create follow-up PRs to canonicalize or remove duplicates.")


if __name__ == "__main__":
    main()
