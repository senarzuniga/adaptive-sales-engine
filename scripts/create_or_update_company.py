"""CLI: Create or update a company definition for the Adaptive Sales Engine.

This script writes a company descriptor file under `enterprise/companies/` and
updates the enterprise registry at `Architecture/EnterpriseHub/enterprise_registry.yaml`.

By default the script only creates the structure and does not run ingestion
pipelines. To run an onboard pipeline automatically use `--deep_analysis --force`.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
import json

from scripts.enterprise_helpers import (
    write_company_txt,
    update_registry_org,
    ensure_ingestion_dir,
    write_ingestion_meta,
)
from config import APP_ROOT


COMPANIES_DIR = APP_ROOT / "enterprise" / "companies"


TEMPLATE = """
[ENTITY]
type = COMPANY
id = {id}
commercial_name = {commercial_name}
legal_name = {legal_name}
active = {active}
default = {default}

[CLASSIFICATION]
sector = {sector}
business_model = {business_model}
currency = {currency}
country = {country}

[CGO_PROFILE]
stage = {stage}
risk_level = {risk_level}
financial_stress = {financial_stress}
operational_complexity = {operational_complexity}

[FINANCE]
revenue_estimate = {revenue_estimate}
pipeline_estimate = {pipeline_estimate}
cash_position = {cash_position}
cash_burn_risk = {cash_burn_risk}
financing_need = {financing_need}

[CASHFLOW]
model_enabled = {model_enabled}
sc_curve_enabled = {sc_curve_enabled}
max_financing_required = {max_financing_required}
payment_terms_avg = {payment_terms_avg}
customer_advances = {customer_advances}

[PROJECT_PORTFOLIO]
model_type = {model_type}
lines = {lines}

[CLIENT_PORTFOLIO]
clients = {clients}

[CONTRACT_PROFILE]
advance_payment = {advance_payment}
milestones = {milestones}
retention = {retention}
warranty = {warranty}
penalties = {penalties}
risk_contract_level = {risk_contract_level}

[RISK]
cashflow = {risk_cashflow}
client_concentration = {risk_client_concentration}
execution = {risk_execution}
contractual = {risk_contractual}
geographic = {risk_geographic}

[CGO_FLAGS]
enable_cgo_panel = {enable_cgo_panel}
enable_nba_engine = {enable_nba_engine}
enable_cashflow_simulation = {enable_cashflow_simulation}
enable_risk_matrix = {enable_risk_matrix}
enable_business_line_model = {enable_business_line_model}

[INGESTION]
source_path = {source_path}
status = {status}
governance = {governance}

[METADATA]
created_at = {created_at}
updated_at = {updated_at}
"""


def bool_like(v: str | bool) -> str:
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if not v:
        return "FALSE"
    return "TRUE" if str(v).lower() in ("1", "true", "yes") else "FALSE"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="CREATE_OR_UPDATE_COMPANY")
    p.add_argument("--id", required=True, help="Organization id (eg. ingecart)")
    p.add_argument("--commercial_name", default="", help="Commercial name")
    p.add_argument("--legal_name", default="", help="Legal name")
    p.add_argument("--mode", default="STRUCTURE_ONLY", choices=["STRUCTURE_ONLY", "FULL_ONBOARDING", "REINDEX"], help="Operation mode")
    p.add_argument("--source", default="", help="Source file or folder to register")
    p.add_argument("--governance", default="CHIEF_ARCHITECT_CONTROLLED", help="Governance tag")
    p.add_argument("--deep_analysis", nargs="?", const="true", default="false", help="Run deep analysis after creation (pass flag or TRUE)")
    p.add_argument("--force", nargs="?", const="true", default="false", help="Force execution of pipelines (use with caution)")

    args = p.parse_args(argv)

    org_id = args.id
    commercial_name = args.commercial_name or args.id.title()
    legal_name = args.legal_name or commercial_name
    mode = args.mode
    source = args.source or ""
    governance = args.governance

    deep_analysis = str(args.deep_analysis).lower() in ("1", "true", "yes")
    force = str(args.force).lower() in ("1", "true", "yes")

    created_at = datetime.now(timezone.utc).isoformat()
    updated_at = created_at

    # Build a conservative default template payload — values can be edited later.
    content = TEMPLATE.format(
        id=org_id,
        commercial_name=commercial_name,
        legal_name=legal_name,
        active="TRUE",
        default="FALSE",
        sector="Industrial Engineering / Automation / Intralogistics",
        business_model="Project-Based + Service + Industrial Integration",
        currency="EUR",
        country="Spain",
        stage="SCALE_UP_TRANSITION",
        risk_level="HIGH",
        financial_stress="HIGH",
        operational_complexity="HIGH",
        revenue_estimate="2000000",
        pipeline_estimate="15000000-17000000",
        cash_position="UNKNOWN",
        cash_burn_risk="HIGH",
        financing_need="SHORT_TERM_CRITICAL",
        model_enabled="TRUE",
        sc_curve_enabled="TRUE",
        max_financing_required="UNKNOWN",
        payment_terms_avg="60-90",
        customer_advances="30%",
        model_type="BUSINESS_LINES",
        lines="- Robot Palletizer\n- INGEPACK\n- System Retal\n- AMRs\n- INGETRANS\n- Automated Loading\n- Retrofit\n- Engineering\n- Consulting\n- After Sales",
        clients="- International Paper\n- Sterner\n- Pacific Southwest\n- President Container\n- Cascades\n- DS Smith",
        advance_payment="VARIABLE",
        milestones="FAT / SAT / Delivery",
        retention="TRUE",
        warranty="TRUE",
        penalties="TRUE",
        risk_contract_level="HIGH",
        risk_cashflow="CRITICAL",
        risk_client_concentration="HIGH",
        risk_execution="MEDIUM",
        risk_contractual="HIGH",
        risk_geographic="USA_EXPOSURE",
        enable_cgo_panel="TRUE",
        enable_nba_engine="TRUE",
        enable_cashflow_simulation="TRUE",
        enable_risk_matrix="TRUE",
        enable_business_line_model="TRUE",
        source_path=source or "",
        status=("PROCESSED" if (mode == "FULL_ONBOARDING" and deep_analysis and force) else ("QUEUED" if mode == "FULL_ONBOARDING" else "STRUCTURE_ONLY")),
        governance=governance,
        created_at=created_at,
        updated_at=updated_at,
    )

    # Persist company file
    company_path = write_company_txt(org_id, content)
    print(f"Company file written: {company_path}")

    # Update registry
    update_registry_org(org_id, commercial_name, status="active", extra={"registered_at": created_at})
    print(f"Registry updated for org: {org_id}")

    # Ensure ingestion reports folder exists and write ingestion metadata
    ensure_ingestion_dir(org_id)
    meta = {
        "org_id": org_id,
        "mode": mode,
        "source": source,
        "governance": governance,
        "status": "QUEUED" if mode == "FULL_ONBOARDING" else mode,
        "requested_at": created_at,
    }
    meta_path = write_ingestion_meta(org_id, meta)
    print(f"Ingestion metadata written: {meta_path}")

    # Optionally run onboarding pipelines if explicitly requested
    if mode == "FULL_ONBOARDING" and deep_analysis:
        if not force:
            print("Deep analysis requested but not forced. Skipping execution. To run: pass --force True")
        else:
            # Try to find candidate onboarding scripts and run first match
            import subprocess
            candidates = [
                APP_ROOT / "scripts" / f"onboard_{org_id}.py",
                APP_ROOT / "scripts" / "onboard.py",
                APP_ROOT / "scripts" / "generate_onboarding_reports.py",
            ]
            executed = False
            for c in candidates:
                if c.exists():
                    print(f"Executing onboarding script: {c}")
                    try:
                        subprocess.run([sys.executable, str(c)], check=False)
                        executed = True
                        break
                    except Exception as exc:
                        print(f"Failed to run {c}: {exc}")
            if not executed:
                print("No onboarding script found. Ingestion queued; run pipelines manually when ready.")

    print("CREATE_OR_UPDATE_COMPANY completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
