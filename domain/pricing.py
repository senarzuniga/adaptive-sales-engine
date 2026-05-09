"""
Pricing domain — cost modules, freight rates and calculation logic.

Previously embedded in the middle of streamlit_app.py.  Moving here makes the
pricing logic independently testable and reusable by any service.
"""
from __future__ import annotations

from typing import Any, Dict, List


# ──────────────────────────────────────────────────────────────
# Cost module catalogue
# ──────────────────────────────────────────────────────────────

PREDEFINED_COST_MODULES: List[Dict[str, Any]] = [
    {"id": "eng_hour",            "name": "Engineering Cost",      "rate": 65,   "unit": "hour",  "is_percentage": False, "category": "labor"},
    {"id": "assembly_hour",       "name": "Assembly Cost",         "rate": 45,   "unit": "hour",  "is_percentage": False, "category": "labor"},
    {"id": "quality_hour",        "name": "Quality Inspection",    "rate": 65,   "unit": "hour",  "is_percentage": False, "category": "labor"},
    {"id": "automation_hour",     "name": "Automation Cost",       "rate": 65,   "unit": "hour",  "is_percentage": False, "category": "labor"},
    {"id": "mech_day",            "name": "Mechanical Support",    "rate": 650,  "unit": "day",   "is_percentage": False, "category": "labor"},
    {"id": "elec_day",            "name": "Electrical Support",    "rate": 650,  "unit": "day",   "is_percentage": False, "category": "labor"},
    {"id": "auto_day",            "name": "Automation Support",    "rate": 750,  "unit": "day",   "is_percentage": False, "category": "labor"},
    {"id": "eng_day",             "name": "Engineering Support",   "rate": 750,  "unit": "day",   "is_percentage": False, "category": "labor"},
    {"id": "accommodation_spain", "name": "Accommodation Spain",   "rate": 120,  "unit": "day",   "is_percentage": False, "category": "accommodation"},
    {"id": "accommodation_europe","name": "Accommodation Europe",  "rate": 180,  "unit": "day",   "is_percentage": False, "category": "accommodation"},
    {"id": "accommodation_usa",   "name": "Accommodation USA",     "rate": 250,  "unit": "day",   "is_percentage": False, "category": "accommodation"},
    {"id": "travel_spain",        "name": "Travel Spain",          "rate": 200,  "unit": "trip",  "is_percentage": False, "category": "travel"},
    {"id": "travel_europe",       "name": "Travel Europe",         "rate": 400,  "unit": "trip",  "is_percentage": False, "category": "travel"},
    {"id": "travel_usa",          "name": "Travel USA",            "rate": 1200, "unit": "trip",  "is_percentage": False, "category": "travel"},
    {"id": "warranty",            "name": "Warranty",              "rate": 3.0,  "unit": "%",     "is_percentage": True, "percentage_of": "total_excluding_warranty", "category": "fee"},
    {"id": "contingency",         "name": "Contingency Fee",       "rate": 1.5,  "unit": "%",     "is_percentage": True, "percentage_of": "total", "category": "fee"},
    {"id": "material_fee",        "name": "Material Fee",          "rate": 3.0,  "unit": "%",     "is_percentage": True, "percentage_of": "materials", "category": "fee"},
    {"id": "delivery_insurance",  "name": "Delivery Insurance",    "rate": 0.1,  "unit": "%",     "is_percentage": True, "percentage_of": "goods", "category": "fee"},
]

FREIGHT_BASE_RATES: Dict[str, Dict[str, float]] = {
    "ALEMANIA - BERLIN":  {"truck": 2625, "20ft": 3200, "40ft": 4800},
    "ESPAÑA - BARCELONA": {"truck": 695,  "20ft": 1900, "40ft": 1900},
    "FRANCE - PARIS":     {"truck": 1850, "20ft": 2800, "40ft": 3900},
    "USA - NEW YORK":     {"truck": 0,    "20ft": 4800, "40ft": 7200},
}


# ──────────────────────────────────────────────────────────────
# Calculation functions
# ──────────────────────────────────────────────────────────────


def calculate_freight_cost(
    destination: str,
    transport_mode: str,
    container_type: str = "20ft",
    quantity: int = 1,
) -> float:
    rates = FREIGHT_BASE_RATES.get(destination.upper(), {})
    if transport_mode == "truck":
        return float(rates.get("truck", 0)) * quantity
    key = "20ft" if container_type == "20ft" else "40ft"
    return float(rates.get(key, 0)) * quantity


def calculate_total_cost(
    lines: List[Dict[str, Any]],
    material_cost: float,
    freight_cost: float,
    packaging_cost: float,
) -> Dict[str, Any]:
    module_map = {m["id"]: m for m in PREDEFINED_COST_MODULES}
    subtotal = float(material_cost) + float(freight_cost) + float(packaging_cost)
    breakdown: Dict[str, float] = {
        "materials":  float(material_cost),
        "freight":    float(freight_cost),
        "packaging":  float(packaging_cost),
    }

    # Non-percentage modules first
    for line in lines:
        module_id = line.get("module_id")
        quantity  = float(line.get("quantity", 0))
        mod = module_map.get(module_id)
        if not mod or mod.get("is_percentage"):
            continue
        amount = float(mod.get("rate", 0)) * quantity
        subtotal += amount
        breakdown[module_id] = amount

    total = subtotal

    # Percentage modules
    warranty   = 0.0
    contingency = 0.0
    material_fee = 0.0
    insurance  = 0.0

    for line in lines:
        module_id = line.get("module_id")
        mod = module_map.get(module_id)
        if not mod or not mod.get("is_percentage"):
            continue

        base_type = mod.get("percentage_of", "total")
        if base_type == "materials":
            base = float(material_cost)
        elif base_type == "goods":
            base = float(material_cost) + float(freight_cost)
        elif base_type == "total_excluding_warranty":
            base = subtotal
        else:
            base = total

        amount = base * (float(mod.get("rate", 0)) / 100.0)
        total += amount
        breakdown[module_id] = amount

        if module_id == "warranty":
            warranty = amount
        elif module_id == "contingency":
            contingency = amount
        elif module_id == "material_fee":
            material_fee = amount
        elif module_id == "delivery_insurance":
            insurance = amount

    return {
        "labor":            {k: v for k, v in breakdown.items() if "hour" in k or "_day" in k},
        "materials":        float(material_cost),
        "freight":          float(freight_cost),
        "packaging":        float(packaging_cost),
        "warranty":         warranty,
        "contingency":      contingency,
        "material_fee":     material_fee,
        "delivery_insurance": insurance,
        "incoterms":        {},
        "total":            total,
        "detail":           breakdown,
    }
