# PR: Archive checked-in build artifacts

Summary
- Copies common checked-in build artifacts (`dist/`, `public/`, `Adaptive Sales Engine - Lovable_files/`) into `Architecture/outputs/archives/<timestamp>/` for manual review and archival, and updates `.gitignore` to prevent future commits.

What it includes
- `run_archive.py` - identifies and copies known build artifact folders into an archive.
- `README.md` - instructions for dry-run and apply.
- `.gitignore` update to ignore `dist/`, `public/`, and related folders.

Notes
- Non-destructive: files are copied; originals remain in place for manual review. After review, create follow-up PRs to remove canonical build artifacts and, if needed, rewrite history.

Suggested review steps
1. Run `python Architecture/tools/repo_audit.py` to refresh the audit.
2. Run `python Architecture/migrations/archive-checked-in-builds-2026-06-28/run_archive.py --dry-run` to preview archives.
3. If acceptable, run with `--apply` to copy files into `Architecture/outputs/archives/<timestamp>/`.
