PR: Remove checked-in build artifacts
===================================

Summary
-------
This PR removes generated website assets and other build artifacts that were checked into
the repository and ensures they are ignored going forward via `.gitignore`.

What changed
------------
- Untracked `Adaptive Sales Engine - Lovable_files/` and `Adaptive Sales Engine - Lovable.html`.
- Added a PR helper folder with scripts to untrack artifacts: `Architecture/prs/000-remove-checked-in-build-artifacts/`.
- Confirm `.gitignore` already contains many of the patterns; update if any leftover files are found.

Testing
-------
1. Run unit and integration tests.
2. Build the site locally and verify generated files are created but not tracked.

Notes
-----
- If this repository intentionally contains multiple package roots with their own `package.json`,
  ensure you don't remove necessary package manifests. The scripts only untrack files that
  are present in the index and match the patterns listed.
