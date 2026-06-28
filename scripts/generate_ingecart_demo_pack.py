#!/usr/bin/env python3
"""Genera public/company-packs/IngecartDemo/ingecart_demo_pack.json
a partir de INGECART_COMPANY_INFO_BACKUP.txt y plantillas disponibles.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent
pack_dir = ROOT / "public" / "company-packs" / "IngecartDemo"
pack_dir.mkdir(parents=True, exist_ok=True)

backup_txt = ROOT / "INGECART_COMPANY_INFO_BACKUP.txt"
if not backup_txt.exists():
    raise SystemExit(f"Backup file not found: {backup_txt}")

raw = backup_txt.read_text(encoding="utf-8")
start = raw.find("{")
end = raw.rfind("}")
if start == -1 or end == -1:
    raise SystemExit("Could not locate JSON object in INGECART_COMPANY_INFO_BACKUP.txt")

company_profile = json.loads(raw[start:end+1])

import pandas as pd

# Orders: prefer outputs/agent_input.csv if present
orders_csv = ROOT / "outputs" / "agent_input.csv"
if not orders_csv.exists():
    orders_csv = ROOT / "templates" / "sales_results_template.csv"

orders_df = pd.read_csv(orders_csv)
orders = orders_df.fillna("").to_dict(orient="records")

# Products
products_csv = ROOT / "templates" / "products_template.csv"
products = []
if products_csv.exists():
    products_df = pd.read_csv(products_csv)
    products = products_df.fillna("").to_dict(orient="records")

# Opportunities
opps_csv = ROOT / "templates" / "opportunities_template.csv"
opps = []
if opps_csv.exists():
    opps_df = pd.read_csv(opps_csv)
    opps = opps_df.fillna("").to_dict(orient="records")

# Strategy
strategy_csv = ROOT / "templates" / "strategy_template.csv"
strategy = []
if strategy_csv.exists():
    strat_df = pd.read_csv(strategy_csv)
    strategy = strat_df.fillna("").to_dict(orient="records")

pack = {
    "companyProfile": company_profile,
    "orders": orders,
    "products": products,
    "opportunities": opps,
    "strategy": strategy,
    "leads": [],
    "contacts": [],
    "tasks": [],
    "entityRegistries": {},
    "workspace": {},
}

out_file = pack_dir / "ingecart_demo_pack.json"
out_file.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
print("Wrote:", out_file)
