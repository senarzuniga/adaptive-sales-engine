"""
KAM Mapper Agent – Mapea stakeholders, influencia y plan de valor para cuentas clave.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


_STAKEHOLDER_ROLES = [
    {"role": "Economic Buyer", "influence": "Alta", "focus": "ROI y presupuesto"},
    {"role": "Technical Buyer", "influence": "Alta", "focus": "Especificaciones y compliance"},
    {"role": "User Buyer", "influence": "Media", "focus": "Usabilidad y soporte"},
    {"role": "Champion/Coach", "influence": "Alta", "focus": "Aliado interno — facilitador"},
    {"role": "Blocker", "influence": "Media", "focus": "Resistencia al cambio — gestionar"},
]

_VALUE_ACTIONS = [
    "Organizar workshop técnico con equipo de ingeniería",
    "Presentar business case con ROI cuantificado",
    "Proponer prueba piloto de bajo riesgo",
    "Compartir caso de éxito de cliente similar",
    "Establecer reunión ejecutiva C-level a C-level",
    "Proponer acuerdo marco / contrato plurianual",
    "Crear joint business plan para los próximos 12 meses",
]


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")
    saved_companies: List[Dict] = context.get("saved_companies", []) or []

    if df is None:
        input_file = os.environ.get("AGENT_INPUT_FILE")
        if input_file and os.path.exists(input_file):
            try:
                df = pd.read_csv(input_file)
            except Exception:
                df = None

    # Identify key accounts
    key_accounts: List[str] = []

    if df is not None and isinstance(df, pd.DataFrame) and not df.empty:
        cust_col = None
        rev_col = None
        for c in ["Customer Name", "customer", "cliente", "company"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                cust_col = matched[0]
                break
        for c in ["Selling Price", "revenue", "ventas", "amount", "importe"]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                rev_col = matched[0]
                break

        if cust_col and rev_col:
            tmp = df[[cust_col, rev_col]].copy()
            tmp[rev_col] = pd.to_numeric(tmp[rev_col], errors="coerce").fillna(0)
            top = tmp.groupby(cust_col)[rev_col].sum().sort_values(ascending=False).head(5)
            key_accounts = [str(k) for k in top.index]
        elif cust_col:
            key_accounts = df[cust_col].dropna().astype(str).value_counts().head(5).index.tolist()

    if not key_accounts and saved_companies:
        for comp in saved_companies[:5]:
            name = comp.get("name") or comp.get("company_name")
            if name:
                key_accounts.append(str(name))

    if not key_accounts:
        key_accounts = ["Cuenta Clave A", "Cuenta Estratégica B"]

    # Build stakeholder maps for top accounts
    account_maps: List[Dict] = []
    for account in key_accounts[:3]:
        stakeholders = []
        for role_def in _STAKEHOLDER_ROLES:
            stakeholders.append({
                "account": account,
                "role": role_def["role"],
                "influence": role_def["influence"],
                "focus": role_def["focus"],
                "contact_identified": False,  # Would be True if linked to CRM data
            })

        actions = _VALUE_ACTIONS[:4]

        account_maps.append({
            "account": account,
            "stakeholders": stakeholders,
            "recommended_actions": actions,
            "relationship_score": "Medio",  # Would calculate from interaction history
            "next_milestone": "Reunión de descubrimiento de necesidades",
        })

    insights = [
        f"Cuentas clave mapeadas: {len(account_maps)}",
        f"Roles de stakeholder identificados: {len(_STAKEHOLDER_ROLES)} por cuenta",
        "Prioridad: Economic Buyer + Champion/Coach son los perfiles clave",
        "Acción inmediata: identificar y confirmar contactos por rol en cada cuenta",
        f"Total acciones recomendadas: {len(account_maps) * 4}",
    ]

    return {
        "status": "success",
        "output": f"KAM maps generados para {len(account_maps)} cuentas clave.",
        "insights": insights,
        "account_maps": account_maps,
        "total_accounts": len(key_accounts),
        "stakeholder_roles": [r["role"] for r in _STAKEHOLDER_ROLES],
    }


if __name__ == "__main__":
    import json
    res = run()
    print(json.dumps(res, indent=2, default=str))
