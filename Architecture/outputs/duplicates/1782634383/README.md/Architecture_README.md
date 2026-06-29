# Architecture Hub — Adaptive Sales Engine

This hub is the single source of truth for architectural decisions, governance and platform evolution.

Purpose
- Consolidate architecture artifacts, ADRs, standards and governance.
- Provide a single place to run automated repository audits.
- Enforce documentation-first and architecture-first workflows.

Structure (top-level)
- `Vision/`
- `Product/`
- `Architecture/`
- `Core/`
- `BusinessModules/`
- `Agents/`
- `Data/`
- `Reports/`
- `Quality/`
- `ADR/`
- `Roadmap/`
- `AI/`
- `tools/`

Quickstart
1. Register every AI agent in `Agents/agent_registry.json` and `Agents/AgentRegistry.md`.
2. Create an ADR for every important architectural decision under `ADR/`.
3. Run the repository audit: `python Architecture/tools/repo_audit.py`.

Owner: CTA Enterprise Chief Architect
Status: Draft

## Latest Automated Audit

- **Run:** `Architecture/tools/repo_audit.py`
- **Scanned files:** 991
- **Duplicate basenames detected:** 154
- **Notable duplicates:** `.env`, `.env.local`, `README.md`, `index.html`, `package.json`, `package-lock.json`, UI components duplicated under `src/` and `adaptive-sales-engine/src/`.
- **Patterns found:** `TODO` / `FIXME` / `EXPERIMENTAL` markers in multiple files (see audit for details).
- **Top remediation actions:** remove committed env files, canonicalize `adaptive-sales-engine/` vs repo root, remove checked-in build artifacts (`dist/`, `public/`), consolidate duplicated UI components.

Full details written to: `Architecture/tools/repo_audit.json` (timestamp: 1782545858).
