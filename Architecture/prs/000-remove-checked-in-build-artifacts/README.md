Remove checked-in build artifacts
================================

This folder contains helper scripts and a PR description to remove checked-in build artifacts
from the repository and ensure they are ignored going forward.

Rationale
--------
- Several generated site artifacts (for example `Adaptive Sales Engine - Lovable_files/` and
  `Adaptive Sales Engine - Lovable.html`) are currently present in the repository. They should
  be produced by the build pipeline and not tracked in Git. Keeping them in the repo creates
  noise and increases repository size.

What the scripts do
-------------------
- `remove-built-artifacts.ps1` — PowerShell script to untrack common built artifact paths using
  `git rm --cached` (keeps local files). It will optionally commit the change if there are
  staged modifications.
- `remove-built-artifacts.sh` — POSIX shell version of the same logic.

Paths targeted (examples)
-------------------------
- `Adaptive Sales Engine - Lovable_files/`
- `Adaptive Sales Engine - Lovable.html`
- `dist/`
- `public/`

Usage (recommended)
--------------------
1. Create a focused branch:

   git checkout -b remove-built-artifacts

2. Run the script appropriate for your platform. For PowerShell (Windows):

   pwsh Architecture/prs/000-remove-checked-in-build-artifacts/remove-built-artifacts.ps1

   For Linux/macOS:

   bash Architecture/prs/000-remove-checked-in-build-artifacts/remove-built-artifacts.sh

3. Inspect changes, run tests, then commit/push and open a PR.

Notes
-----
- The repository `.gitignore` already contains many of these patterns; the scripts only
  untrack files that are currently present in the index. If `git` is not available in your
  environment the scripts will print the commands you need to run manually.
