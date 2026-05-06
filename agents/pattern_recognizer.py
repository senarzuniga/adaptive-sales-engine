"""
Pattern Recognizer – Detecta estacionalidad, ciclos, tendencias y anomalías.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import pandas as pd


def _detect_date_col(df: pd.DataFrame) -> Optional[str]:
    for col in df.columns:
        if any(kw in col.lower() for kw in ["date", "fecha", "month", "mes", "year", "año", "quarter"]):
            return col
    return None


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
            "output": "Sin datos históricos. Sube datos de ventas para detectar patrones.",
            "insights": [
                "Detecta estacionalidad mensual/trimestral en ventas",
                "Identifica tendencias crecientes/decrecientes por segmento",
                "Señala anomalías (valores atípicos ±2σ)",
            ],
            "patterns": [],
            "anomalies": [],
            "trend": "unknown",
        }

    date_col = _detect_date_col(df)
    value_col = _detect_numeric_col(df)
    patterns: List[str] = []
    anomalies: List[Dict] = []
    trend = "neutral"

    if not value_col:
        return {
            "status": "error",
            "output": "No se detectó columna numérica de ventas/revenue.",
            "insights": ["Verifica que el archivo contenga columnas numéricas"],
            "patterns": [],
            "anomalies": [],
            "trend": "unknown",
        }

    series = pd.to_numeric(df[value_col], errors="coerce").dropna()

    if len(series) < 4:
        return {
            "status": "success",
            "output": f"Datos insuficientes para análisis de patrones ({len(series)} puntos).",
            "insights": ["Se necesitan al menos 4 puntos de datos"],
            "patterns": [],
            "anomalies": [],
            "trend": "unknown",
        }

    mean_val = float(series.mean())
    std_val = float(series.std())
    cv = (std_val / mean_val * 100) if mean_val else 0

    # Trend detection (simple linear comparison)
    first_half = series.iloc[: len(series) // 2].mean()
    second_half = series.iloc[len(series) // 2:].mean()
    if second_half > first_half * 1.05:
        trend = "creciente 📈"
        patterns.append("Tendencia creciente detectada en la segunda mitad del período")
    elif second_half < first_half * 0.95:
        trend = "decreciente 📉"
        patterns.append("Tendencia decreciente detectada — revisar causas")
    else:
        trend = "estable ➡️"
        patterns.append("Tendencia estable a lo largo del período analizado")

    # Seasonality (if date col present and enough data)
    if date_col and len(df) >= 12:
        try:
            tmp = df[[date_col, value_col]].copy()
            tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
            tmp = tmp.dropna(subset=[date_col])
            tmp["month"] = tmp[date_col].dt.month
            monthly = tmp.groupby("month")[value_col].mean()
            peak_month = int(monthly.idxmax())
            trough_month = int(monthly.idxmin())
            month_names = {1:"Ene",2:"Feb",3:"Mar",4:"Abr",5:"May",6:"Jun",
                           7:"Jul",8:"Ago",9:"Sep",10:"Oct",11:"Nov",12:"Dic"}
            patterns.append(
                f"Pico estacional en {month_names.get(peak_month, peak_month)}; "
                f"valle en {month_names.get(trough_month, trough_month)}"
            )
        except Exception:
            pass

    # Anomaly detection (±2σ)
    upper = mean_val + 2 * std_val
    lower = mean_val - 2 * std_val
    anomaly_mask = (series > upper) | (series < lower)
    n_anomalies = int(anomaly_mask.sum())
    if n_anomalies:
        patterns.append(f"{n_anomalies} valor(es) anómalo(s) detectados (±2σ)")
        anomalies = [{"index": int(i), "value": float(v)} for i, v in series[anomaly_mask].items()]

    # Volatility
    if cv > 50:
        patterns.append(f"Alta volatilidad (CV={cv:.0f}%) — negocio irregular")
    elif cv > 20:
        patterns.append(f"Volatilidad moderada (CV={cv:.0f}%)")
    else:
        patterns.append(f"Baja volatilidad (CV={cv:.0f}%) — negocio predecible")

    return {
        "status": "success",
        "output": (
            f"Tendencia {trend}. {len(patterns)} patrones detectados. "
            f"{n_anomalies} anomalías."
        ),
        "insights": patterns[:5],
        "patterns": patterns,
        "anomalies": anomalies[:10],
        "trend": trend,
        "statistics": {
            "mean": round(mean_val, 2),
            "std": round(std_val, 2),
            "cv_pct": round(cv, 1),
            "n_anomalies": n_anomalies,
        },
    }


if __name__ == "__main__":
    import json
    print(json.dumps(run(), indent=2, default=str))
