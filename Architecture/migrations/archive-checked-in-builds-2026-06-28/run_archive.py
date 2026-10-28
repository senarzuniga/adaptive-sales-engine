#!/usr/bin/env python3
"""
Archive checked-in build artifacts into Architecture/outputs/archives/<timestamp>/

This script is conservative and non-destructive: it copies matching folders/files into an archive folder for manual review.
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path
import shutil
import time

ROOT = Path(__file__).resolve().parents[3]
TARGETS = [
    ROOT / "adaptive-sales-engine" / "dist",
    ROOT / "adaptive-sales-engine" / "public",
    ROOT / "dist",
    ROOT / "public",
    ROOT / "Adaptive Sales Engine - Lovable_files",
]
OUTPUT_BASE = ROOT / "Architecture" / "outputs" / "archives"


def find_existing_targets():
    return [p for p in TARGETS if p.exists()]


def copy_to_archive(paths, apply=False):
    ts = int(time.time())
    dest = OUTPUT_BASE / str(ts)
    logging.info(f"Archive destination: {dest}")
    if not apply:
        logging.info("Dry-run: the following would be copied:")
        for p in paths:
            logging.info(f"  - {p}")
        return dest

    dest.mkdir(parents=True, exist_ok=True)
    copied = 0
    for p in paths:
        if p.is_dir():
            target = dest / p.name
            try:
                shutil.copytree(p, target)
                copied += 1
            except Exception as e:
                logging.error(f"Failed to copy {p} -> {target}: {e}")
        elif p.is_file():
            try:
                shutil.copy2(p, dest / p.name)
                copied += 1
            except Exception as e:
                logging.error(f"Failed to copy {p} -> {dest}: {e}")

    logging.info(f"Copied {copied} items to {dest}")
    return dest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Copy files into archive")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be archived")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    existing = find_existing_targets()
    if not existing:
        logging.info("No known build artifact targets found. Nothing to do.")
        return

    if args.dry_run or not args.apply:
        copy_to_archive(existing, apply=False)
        logging.info("Dry-run complete. Rerun with --apply to perform copies.")
        return

    copy_to_archive(existing, apply=True)


if __name__ == "__main__":
    main()
