"""
Portfolio Risk Analyzer – Pareto 80/20 por cliente.
Calcula concentración de ventas y nivel de riesgo.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


def _detect_revenue_col(df: pd.DataFrame) -> Optional[str]:
    candidates = ["Selling Price", "revenue", "ventas", "importe", "amount", "total"]
    for c in candidates:
        if c.lower() in [col.lower() for col in df.columns]:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                return matched[0]
    # Fall back to first numeric column
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    return numeric_cols[0] if numeric_cols else None


def _detect_customer_col(df: pd.DataFrame) -> Optional[str]:
    candidates = ["Customer Name", "customer", "cliente", "company", "empresa"]
    for c in candidates:
        matched = [col for col in df.columns if col.lower() == c.lower()]
        if matched:
            return matched[0]
    cat_cols = df.select_dtypes(include="object").columns.tolist()
    return cat_cols[0] if cat_cols else None


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")

    if df is None:
        input_file = os.environ.get("AGENT_INPUT_FILE")
        if input_file and os.path.exists(input_file):
            try:
                df = pd.read_csv(input_file)
            except Exception:
                df = None

    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return {
            "status": "success",
            "output": "Sin datos. Sube histórico de ventas para análisis Pareto.",
            "insights": [
                "Identifica los clientes que generan el 80% del revenue (Pareto)",
                "Clasifica riesgo: Alto (>40% en 1 cliente), Medio, Bajo",
                "Lista clientes críticos con % de concentración",
            ],
            "risk_level": "unknown",
            "critical_clients": [],
            "pareto_threshold": 0.8,
        }

    revenue_col = _detect_revenue_col(df)
    customer_col = _detect_customer_col(df)

    if not revenue_col or not customer_col:
        return {
            "status": "error",
            "output": "No se detectaron columnas de cliente/revenue.",
            "insights": ["Verifica que el archivo tenga columnas de cliente y ventas"],
            "risk_level": "unknown",
            "critical_clients": [],
        }

    df_clean = df[[customer_col, revenue_col]].copy()
    df_clean[revenue_col] = pd.to_numeric(df_clean[revenue_col], errors="coerce").fillna(0)

    # Aggregate by customer
    by_customer = (
        df_clean.groupby(customer_col)[revenue_col]
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )
    total = by_customer[revenue_col].sum()
    if total == 0:
        return {
            "status": "error",
            "output": "Revenue total = 0. Verifica la columna de ventas.",
            "insights": ["Columna de revenue detectada pero suma = 0"],
            "risk_level": "unknown",
            "critical_clients": [],
        }

    by_customer["pct"] = by_customer[revenue_col] / total * 100
    by_customer["cumulative_pct"] = by_customer["pct"].cumsum()

    # Pareto: clients covering 80%
    pareto_clients = by_customer[by_customer["cumulative_pct"] <= 80]
    if pareto_clients.empty:
        pareto_clients = by_customer.head(1)

    n_pareto = len(pareto_clients)
    n_total = len(by_customer)
    top_client_pct = float(by_customer.iloc[0]["pct"])

    # Risk classification
    if top_client_pct > 40:
        risk_level = "ALTO"
        risk_emoji = "🔴"
    elif top_client_pct > 20 or n_pareto <= 3:
        risk_level = "MEDIO"
        risk_emoji = "🟡"
    else:
        risk_level = "BAJO"
        risk_emoji = "🟢"

    critical_clients: List[Dict] = []
    for _, row in pareto_clients.head(10).iterrows():
        critical_clients.append({
            "customer": str(row[customer_col]),
            "revenue": float(row[revenue_col]),
            "pct": round(float(row["pct"]), 1),
            "cumulative_pct": round(float(row["cumulative_pct"]), 1),
        })

    return {
        "status": "success",
        "output": (
            f"{risk_emoji} Riesgo de cartera: {risk_level}. "
            f"{n_pareto}/{n_total} clientes generan el 80% del revenue. "
            f"Top cliente: {float(by_customer.iloc[0]['pct']):.1f}%."
        ),
        "insights": [
            f"Concentración Pareto: {n_pareto} clientes = 80% revenue",
            f"Cliente principal: {by_customer.iloc[0][customer_col]} ({top_client_pct:.1f}%)",
            f"Nivel de riesgo: {risk_level}",
            f"Total clientes activos: {n_total}",
        ],
        "risk_level": risk_level,
        "critical_clients": critical_clients,
        "pareto_clients_count": n_pareto,
        "total_clients": n_total,
        "top_client_concentration_pct": round(top_client_pct, 1),
    }


if __name__ == "__main__":
    import json
    result = run()
    print(json.dumps({k: v for k, v in result.items() if k != "cleaned_data"}, indent=2, default=str))
