# Archive: Checked-in Build Artifacts (2026-06-28)

Purpose
- Move large checked-in build artifacts into a non-destructive archive folder under `Architecture/outputs/archives/` so they can be reviewed and removed from the repository history in follow-up work.

What this migration does
- Identifies common build artifact folders: `adaptive-sales-engine/dist/`, `adaptive-sales-engine/public/`, `dist/`, `public/`, and `Adaptive Sales Engine - Lovable_files/`.
- Copies them into `Architecture/outputs/archives/<timestamp>/` for manual review.
- Updates `.gitignore` to prevent future commits of these build artifacts.

Usage
1. Dry-run:
```powershell
& ".venv\Scripts\python.exe" Architecture/migrations/archive-checked-in-builds-2026-06-28/run_archive.py --dry-run
```
2. Apply:
```powershell
& ".venv\Scripts\python.exe" Architecture/migrations/archive-checked-in-builds-2026-06-28/run_archive.py --apply
```

Notes
- This is non-destructive: files are copied into an archive folder; originals are not deleted.
- After review, create follow-up PRs to remove archives from the repository and (optionally) rewrite history using `git filter-repo` or `git filter-branch`.

Owner: CTA Enterprise Chief Architect
