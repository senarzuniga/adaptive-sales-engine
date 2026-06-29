#!/usr/bin/env python3
"""Detect committed or untracked env files that may contain secrets.

Exits with code 2 if any *committed* env-like files are found (to fail CI).
Otherwise prints warnings for local untracked env files and exits 0.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
import json


def git_ls_files(args=None):
    cmd = ["git", "ls-files"]
    if args:
        cmd.extend(args)
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(p.stderr.strip())
        return []
    return [line.strip() for line in p.stdout.splitlines() if line.strip()]


def main():
    tracked = git_ls_files()
    tracked_envs = [f for f in tracked if Path(f).name.startswith(".env")]

    if tracked_envs:
        print("ERROR: Committed env-like files detected:")
        for f in tracked_envs:
            print("  -", f)
        print("Remove them from the repository and add to .gitignore. See Architecture/Roadmap/DeduplicationChecklist-2026-06-28.md for guidance.")
        sys.exit(2)

    # check for untracked env files (local copies)
    untracked = git_ls_files(["--others", "--exclude-standard"])
    local_envs = [f for f in untracked if Path(f).name.startswith(".env")]
    if local_envs:
        print("WARNING: Local untracked env files present (not committed):")
        for f in local_envs:
            print("  -", f)
        print("Ensure secrets are not committed; add appropriate entries to .gitignore.")

    print("No committed env-like files found.")
    sys.exit(0)


if __name__ == "__main__":
    main()
