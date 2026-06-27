# PR: Architecture — Add deduplication migration tooling

Summary
- Adds a safe, reviewable migration tool to stage duplicated files detected by the automated repository audit.

What it includes
- `run_migration_staging.py` - inspects `Architecture/tools/repo_audit.json`, lists top duplicated basenames, and (optionally) copies duplicates into `Architecture/outputs/duplicates/<timestamp>/` for manual review.
- `README.md` - instructions for running the tool and next steps.

Why non-destructive
- The tool performs a dry-run by default and only copies files when executed with `--apply`. No original files are deleted or modified by this PR.

Suggested review steps
1. Run `python Architecture/tools/repo_audit.py` to refresh the audit.
2. Run the tool in dry-run to confirm the proposed items.
3. If acceptable, run with `--apply` to stage copies.
4. Review staged copies and create targeted PRs to canonicalize or remove duplicates.

Next actions (follow-up PRs expected)
- Decide canonical locations for duplicated files (e.g., prefer root `src/` vs `adaptive-sales-engine/src/`).
- Replace imports/usages to point to canonical files.
- Remove duplicated artifacts (e.g., `adaptive-sales-engine/dist/`, `adaptive-sales-engine/public/`) where appropriate.

Owner: CTA Enterprise Chief Architect
