"""
Forecaster Agent – Predicción trimestral, semestral y anual de ventas.
Usa regresión lineal simple sobre datos históricos.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd


def _detect_numeric_col(df: pd.DataFrame) -> Optional[str]:
    for candidate in ["Selling Price", "revenue", "ventas", "importe", "amount"]:
        matched = [c for c in df.columns if c.lower() == candidate.lower()]
        if matched:
            return matched[0]
    nums = df.select_dtypes(include="number").columns.tolist()
    return nums[0] if nums else None


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
            "output": "Sin datos históricos. Sube datos para generar forecast.",
            "insights": [
                "Proyección trimestral basada en tendencia histórica",
                "Forecast semestral con intervalo de confianza",
                "Predicción anual con nivel de confianza por R²",
            ],
            "forecast": {"Q": None, "H": None, "Y": None},
            "confidence": "N/A",
        }

    value_col = _detect_numeric_col(df)
    if not value_col:
        return {
            "status": "error",
            "output": "No se detectó columna numérica.",
            "insights": ["Asegúrate de incluir una columna de ventas/revenue"],
            "forecast": {},
            "confidence": "N/A",
        }

    series = pd.to_numeric(df[value_col], errors="coerce").dropna()
    n = len(series)

    if n < 3:
        return {
            "status": "success",
            "output": f"Datos insuficientes para forecast ({n} puntos). Se necesitan al menos 3.",
            "insights": ["Sube más períodos históricos para mejorar la predicción"],
            "forecast": {},
            "confidence": "N/A",
        }

    # Simple linear regression on data point index.
    # Assumes evenly-spaced observations (each row = one time period of equal length).
    # The quality of the forecast improves with consistent, evenly-spaced data.
    x = np.arange(n, dtype=float)
    y = series.values.astype(float)
    x_mean = x.mean()
    y_mean = y.mean()
    cov = float(np.sum((x - x_mean) * (y - y_mean)))
    var_x = float(np.sum((x - x_mean) ** 2))
    slope = cov / var_x if var_x else 0.0
    intercept = y_mean - slope * x_mean

    # R² (goodness of fit)
    y_pred = slope * x + intercept
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y_mean) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    r2 = max(0.0, min(1.0, r2))

    # Average period value
    avg = float(series.mean())

    # Project forward (periods are in same units as the data points)
    q_periods = max(1, n // 4)   # ~1 quarter worth
    h_periods = max(1, n // 2)
    y_periods = n

    q_forecast = float(slope * (n + q_periods) + intercept) * q_periods
    h_forecast = float(slope * (n + h_periods) + intercept) * h_periods
    y_forecast = float(slope * (n + y_periods) + intercept) * y_periods

    # Confidence label
    if r2 >= 0.80:
        confidence = "Alta (R²≥0.80)"
    elif r2 >= 0.50:
        confidence = "Media (R²≥0.50)"
    else:
        confidence = "Baja (R²<0.50) — datos dispersos"

    growth_pct = (slope / avg * 100) if avg else 0.0

    return {
        "status": "success",
        "output": (
            f"Forecast generado. Tendencia: {slope:+.2f}/período. "
            f"Crecimiento estimado: {growth_pct:+.1f}%. Confianza: {confidence}."
        ),
        "insights": [
            f"Proyección trimestral: {q_forecast:,.0f}",
            f"Proyección semestral: {h_forecast:,.0f}",
            f"Proyección anual: {y_forecast:,.0f}",
            f"Crecimiento por período: {growth_pct:+.1f}%",
            f"Nivel de confianza: {confidence}",
        ],
        "forecast": {
            "quarterly": round(q_forecast, 2),
            "half_year": round(h_forecast, 2),
            "annual": round(y_forecast, 2),
        },
        "confidence": confidence,
        "r2": round(r2, 3),
        "slope": round(slope, 4),
        "growth_pct_per_period": round(growth_pct, 2),
        "historical_mean": round(avg, 2),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run(), indent=2, default=str))
