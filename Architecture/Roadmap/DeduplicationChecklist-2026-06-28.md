# Deduplication Checklist — 2026-06-28

Purpose
- Provide a concise, reviewable checklist of proposed canonical locations and next actions for the top duplicated items detected by the automated audit.

Staging folder (for manual review):
- `Architecture/outputs/duplicates/1782634383`

Top duplicate groups (proposed canonical location)
- `index.ts` (Supabase functions): canonical -> `supabase/functions/<function>/index.ts` (root `supabase/`). Rationale: serverless functions belong under the `supabase` function tree.
- `use-toast.ts` (UI hook): canonical -> `src/hooks/use-toast.ts` (root). Rationale: hooks belong under `src/hooks` and should be consumed by components.
- `client.ts` (supabase client): canonical -> `src/integrations/supabase/client.ts` (root) or `src/utils/supabase/client.ts` — pick one and consolidate.
- `dist/`, `public/`, `Adaptive Sales Engine - Lovable_files/` (build artifacts): canonical -> do not track; remove from source and rely on CI/build outputs. Add to `.gitignore`.
- `.env`, `.env.local`: canonical -> not tracked; add `.env.example`; rotate any exposed secrets immediately.
- `package.json` / `package-lock.json`: review and decide per-package vs repo root responsibility (leave both if they serve different packages, otherwise consolidate).
- `README.md`, `index.html`, `favicon.ico`, `robots.txt`, `placeholder.svg`: decide canonical source (prefer root `public/` or `templates/`) and remove checked-in copies in `dist/`.
- `__init__.py` and other package-level files: KEEP as-is (expected per-package files).

Action plan (high level)
1. Review staged copies under `Architecture/outputs/duplicates/1782634383` and mark canonical file for each group.
2. For each group, create a focused PR that either:
   - Moves and canonicalizes (git mv) the chosen file into the canonical path and updates imports, or
   - Removes checked-in build artifacts and adds appropriate `.gitignore` entries.
3. Run tests and CI for each PR; verify TypeScript/JS imports and Python imports still resolve.
4. When canonicalization is complete, update `Architecture/Agents/agent_registry.json` and ADRs if architecture boundaries changed.

Commands & tips
- Refresh the audit: `python Architecture/tools/repo_audit.py`.
- Re-run staging (dry-run):
  ```powershell
  & ".venv\Scripts\python.exe" Architecture/migrations/deduplicate-top-duplicates-2026-06-27/run_migration_staging.py --top 50
  ```
- Search for imports to update (example):
  ```powershell
  git grep -n "adaptive-sales-engine/src/components" || true
  ```
- Use `git mv` to relocate canonical files and `git rm` for removals; keep changes focused to make reviews easy.

Owners
- Owner: CTA Enterprise Chief Architect

Next steps (this PR set)
- Open a focused PR to archive/remove checked-in build artifacts (created by the Architecture Assistant).
- Open focused PRs for UI component consolidation (follow-up).
