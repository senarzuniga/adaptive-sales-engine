#!/usr/bin/env python3
"""Run orchestrator using a company pack as context (local/demo mode).

Reads public/company-packs/IngecartDemo/ingecart_demo_pack.json and runs
all agents with a context that includes active_company and uploaded data.
Saves results to outputs/cascade_results_pack_<timestamp>.json
"""
from pathlib import Path
import json
import sys
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

PACK = ROOT / "public" / "company-packs" / "IngecartDemo" / "ingecart_demo_pack.json"
if not PACK.exists():
    raise SystemExit(f"Pack not found: {PACK}")

pack = json.loads(PACK.read_text(encoding="utf-8"))

# Build context
context = {
    "action": "cascade_all",
    "active_company": pack.get("companyProfile"),
    "saved_companies": [pack.get("companyProfile")] if pack.get("companyProfile") else [],
    "company_notes": (pack.get("companyProfile") or {}).get("additional_notes", ""),
    "uploaded_data": None,
    "productos_data": None,
    "oportunidades_data": None,
    "estrategia_data": None,
    "leads_data": None,
    "contacts_data": None,
}

try:
    import pandas as pd
    if pack.get("orders"):
        context["uploaded_data"] = pd.DataFrame(pack.get("orders"))
    if pack.get("products"):
        context["productos_data"] = pd.DataFrame(pack.get("products"))
    if pack.get("opportunities"):
        context["oportunidades_data"] = pd.DataFrame(pack.get("opportunities"))
    if pack.get("strategy"):
        context["estrategia_data"] = pd.DataFrame(pack.get("strategy"))
    if pack.get("leads"):
        context["leads_data"] = pd.DataFrame(pack.get("leads"))
    if pack.get("contacts"):
        context["contacts_data"] = pd.DataFrame(pack.get("contacts"))
except Exception:
    # If pandas not available, leave raw lists in context
    context["uploaded_data"] = pack.get("orders")
    context["productos_data"] = pack.get("products")
    context["oportunidades_data"] = pack.get("opportunities")
    context["estrategia_data"] = pack.get("strategy")
    context["leads_data"] = pack.get("leads")
    context["contacts_data"] = pack.get("contacts")

# Run orchestrator
from orchestrator import get_max_orchestrator
orch = get_max_orchestrator()
print(f"Running orchestrator with pack: {PACK}")
print(f"Active company: {context['active_company'].get('company_name') if context['active_company'] else 'None'}")

start = datetime.now()
results = orch.execute_all_agents(context, timeout_seconds=60)
elapsed = (datetime.now() - start).total_seconds()
print(f"Completed in {elapsed:.2f}s — agents: {len(orch.agents)}")

# Save results
out_dir = ROOT / "outputs"
out_dir.mkdir(parents=True, exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
out_path = out_dir / f"cascade_results_pack_{ts}.json"

# Make results JSON serializable (convert DataFrames to shapes)
import json as _json
import pandas as _pd
safe = {}
for k, v in results.items():
    if isinstance(v, _pd.DataFrame):
        safe[k] = f"<DataFrame {v.shape[0]}×{v.shape[1]}>"
    else:
        safe[k] = v

out_path.write_text(_json.dumps(safe, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
print(f"Saved results to: {out_path}")
