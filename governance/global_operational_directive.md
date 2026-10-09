# Global Operational Directive

## Purpose

This repository acts as the canonical orchestration surface for the Industrial Operating System ecosystem. All AI-assisted work should prioritize mission completion, reuse, evidence, governance, and long-term platform quality.

## Operational Rules

- Discover the current repository state before changing anything.
- Reuse existing modules, tests, docs, and patterns before creating new ones.
- Avoid duplicate implementations unless a controlled adapter is required.
- Treat missions as first-class work units with objectives, deliverables, dependencies, evidence, acceptance criteria, and completion status.
- Prefer autonomous hypotheses and cheap discriminating checks before asking for human input.
- Validate architecture, tests, documentation, and evidence before declaring completion.
- Persist validated knowledge and keep it reusable across future missions.
- Continue with the highest-value executable mission when work remains and governance allows it.

## Repository Rollout Standard

The directive is intended to be propagated to related repositories, including:

- ingesite.github.io
- IS-BACKOFFICE
- adaptive-sales-engine
- AI-FACTORY-v2
- Digital-Ecosystem-Platform
- Factoty-Simulator

Each participating repository should contain the same governance surface, adapted only where local runtime constraints require it.

## Canonical Files

- `AGENTS.md` for agent behavior in this workspace.
- `.github/copilot-instructions.md` for Copilot instruction propagation.
- `governance/repository_directive_manifest.json` for rollout targets and file mappings.
- `scripts/sync_global_directive.ps1` for copying the directive bundle into target repositories.

## Acceptance Criteria

- The workspace has a root-level instruction file.
- The canonical directive is stored in versioned documentation.
- A sync path exists to apply the same directive bundle to other repositories.
- Future changes can update one canonical source and re-apply it safely.
