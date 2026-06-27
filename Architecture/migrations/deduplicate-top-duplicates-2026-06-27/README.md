# Migration: Deduplicate Top Duplicates (2026-06-27)

Purpose
- Provide a safe, reviewable starting point to deduplicate files flagged by the automated repository audit.

What this commit provides
- A dry-run script that enumerates top duplicated basenames and shows where copies exist.
- A safe `--apply` option that will copy duplicates into a staging folder under `Architecture/outputs/duplicates/<timestamp>/` for manual review. Originals are not deleted or modified.
- A `PR_DESCRIPTION.md` with the proposed migration plan and next steps.

How to use
1. Run a fresh audit: `python Architecture/tools/repo_audit.py`
2. Dry-run the migration to review proposed actions:

```powershell
& ".venv\Scripts\python.exe" Architecture/migrations/deduplicate-top-duplicates-2026-06-27/run_migration_staging.py --top 25
```

3. If you approve, run with `--apply` to copy duplicates into `Architecture/outputs/duplicates/<timestamp>/` for manual review:

```powershell
& ".venv\Scripts\python.exe" Architecture/migrations/deduplicate-top-duplicates-2026-06-27/run_migration_staging.py --top 25 --apply
```

Review & next steps
- Inspect `Architecture/outputs/duplicates/<timestamp>/` and choose canonical files.
- Create follow-up PRs to remove or consolidate duplicates once canonicalization decisions are made.

Owner: CTA Enterprise Chief Architect
Status: Draft migration
