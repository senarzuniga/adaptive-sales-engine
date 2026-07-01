"""Run a lightweight CGO Panel for an organization.

Usage (examples):
  python scripts/run_cgo_panel.py --scope ACTIVE_ORGANIZATION --mode FULL_INTELLIGENCE --layers FINANCE,PROJECTS,SALES
  python scripts/run_cgo_panel.py --org-id ingecart --mode EXECUTIVE_DASHBOARD

The script gathers available ingestion/report artifacts under
`Architecture/EnterpriseHub/ingestion_reports/<org>` and emits a JSON summary
under `outputs/cgo_panel/`.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from config import APP_ROOT
from scripts.enterprise_helpers import load_registry, get_default_organization, read_entities


REPORT_FILES = {
    "executive_summary": "executive_summary.md",
    "onboarding_report": "onboarding_report.json",
    "knowledge_index": "knowledge_index.json",
    "inventory": "inventory.json",
    "data_quality": "data_quality.md",
    "ai_readiness": "ai_readiness.md",
    "architecture_compliance": "architecture_compliance.md",
    "operational_readiness": "operational_readiness.md",
    "platform_stress_test": "platform_stress_test.md",
}


def _read_text(p: Path):
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def _read_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="RUN_CGO_PANEL")
    parser.add_argument("--scope", default="ACTIVE_ORGANIZATION", help="Scope (ACTIVE_ORGANIZATION or ORG)")
    parser.add_argument("--org-id", default="", help="Organization id override")
    parser.add_argument("--mode", default="FULL_INTELLIGENCE", help="Panel mode")
    parser.add_argument("--layers", default="", help="Comma-separated layers to include")
    args = parser.parse_args(argv)

    # resolve org id
    org_id = None
    if args.org_id:
        org_id = args.org_id
    else:
        if args.scope == "ACTIVE_ORGANIZATION":
            # Check registry default
            org_id = get_default_organization()
        else:
            org_id = None

    if not org_id:
        print("No organization resolved. Provide --org-id or set default_organization in registry.")
        return 2

    reports_dir = APP_ROOT / "Architecture" / "EnterpriseHub" / "ingestion_reports" / org_id
    if not reports_dir.exists():
        print(f"Reports folder not found for org '{org_id}': {reports_dir}")
        return 3

    layers = [l.strip() for l in args.layers.split(",") if l.strip()] if args.layers else []

    panel = {
        "org_id": org_id,
        "mode": args.mode,
        "layers": layers,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "OK",
        "evidence": {},
        "metrics": {},
        "recommendations": [],
    }

    # Load available reports
    for key, fname in REPORT_FILES.items():
        p = reports_dir / fname
        if p.exists():
            if p.suffix.lower() == ".md":
                panel["evidence"][key] = _read_text(p)
            else:
                panel["evidence"][key] = _read_json(p)
        else:
            panel["evidence"][key] = None

    # Basic metrics
    entities = read_entities(org_id) or {}
    pipeline_count = 0
    if isinstance(entities, dict):
        pipeline_count = len(entities.get("opportunities", []) or [])

    panel["metrics"]["pipeline_count"] = pipeline_count

    # Try to extract simple cash information from onboarding report
    onboarding = panel["evidence"].get("onboarding_report")
    cash_info = None
    if isinstance(onboarding, dict):
        # look for common keys
        cash_info = onboarding.get("cash_position") or onboarding.get("cashflow") or onboarding.get("financials")

    panel["metrics"]["cash_summary"] = cash_info

    # Risk indicators
    risk_flags = []
    if not panel["evidence"].get("architecture_compliance"):
        risk_flags.append("missing_architecture_compliance_report")
    if not panel["evidence"].get("data_quality"):
        risk_flags.append("missing_data_quality_report")
    if not panel["evidence"].get("ai_readiness"):
        risk_flags.append("missing_ai_readiness_report")

    if pipeline_count == 0:
        risk_flags.append("empty_pipeline")

    panel["metrics"]["risk_flags"] = risk_flags

    # Recommendations (NBAs)
    recs = panel["recommendations"]
    if not cash_info:
        recs.append("Run cashflow simulation and populate cash_position in onboarding report")
    if "missing_data_quality_report" in risk_flags:
        recs.append("Run deeper content extraction and data-quality checks")
    if "missing_ai_readiness_report" in risk_flags:
        recs.append("Configure vector-store and run semantic indexing (ai-factory-v2)")
    if pipeline_count == 0:
        recs.append("Populate opportunities: run agents or import projects/marketing under governance")

    # Outputs folder
    out_dir = APP_ROOT / "outputs" / "cgo_panel"
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_file = out_dir / f"{org_id}_{args.mode}_{ts}.json"
    out_file.write_text(json.dumps(panel, indent=2, ensure_ascii=False), encoding="utf-8")

    # Print concise summary
    print(f"CGO Panel: org={org_id} mode={args.mode} generated={panel['generated_at']}")
    print(f"Pipeline count: {pipeline_count}")
    print(f"Risk flags: {risk_flags}")
    print(f"Recommendations: {recs}")
    print(f"Output written to: {out_file}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
