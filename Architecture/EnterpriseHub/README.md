# Enterprise Architecture Hub — CTA Enterprise AI OS

This folder contains the canonical Enterprise Architecture Foundation artifacts for the CTA Enterprise AI Operating System.

Purpose
- Provide a single source of truth for organizational registries, repository registry, module and agent registries.
- Host governance policies, ADR templates, and the architecture audit framework.
- Provide lightweight tooling to manage the enterprise architecture lifecycle (scanning, validation, reporting).

Scope
- Phase 1 (this directory): scaffold registries, chief architect framework, workspace manager, governance engine, and audit framework.
- Phase 2+ (separate tasks): repository analysis, ADR creation, refactoring and platform services.

Quick start
1. Inspect registries in `Architecture/EnterpriseHub/*.yaml`.
2. Use `workspace_manager.py` to register or validate repositories and organizations.
3. Review governance policies in `governance/policies.yaml` and run `governance/validator.py` for basic checks.
4. Use `audit/repo_audit_framework.py` to start a repository audit (scaffold only).

Location of key artifacts
- Organization registry: `Architecture/EnterpriseHub/organization_registry.yaml`
- Repository registry: `Architecture/EnterpriseHub/repository_registry.yaml`
- Module registry: `Architecture/EnterpriseHub/module_registry.yaml`
- Agent registry: `Architecture/EnterpriseHub/agent_registry.yaml`
- Governance policies & validator: `Architecture/EnterpriseHub/governance/`
- Chief Architect framework and ADR template: `Architecture/EnterpriseHub/CHIEF_ARCHITECT_FRAMEWORK.md`, `ADR_TEMPLATE.md`
- Audit framework scaffold: `Architecture/EnterpriseHub/audit/repo_audit_framework.py`

Governance first
- This hub establishes governance and registries only — it intentionally does not implement business features.
