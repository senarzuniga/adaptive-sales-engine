"""
Data Cleaner Agent – Normaliza datos de ventas.
Adapta nombres de columnas, maneja nulos, unifica formatos.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import pandas as pd


# Column-name synonyms → canonical name
_COLUMN_MAP: Dict[str, str] = {
    # Date variants
    "po date": "PO date",
    "podate": "PO date",
    "purchase order date": "PO date",
    "order date": "PO date",
    "fecha pedido": "PO date",
    # Customer
    "cliente": "Customer Name",
    "customer": "Customer Name",
    "company": "Customer Name",
    "empresa": "Customer Name",
    # Revenue
    "revenue": "Selling Price",
    "ventas": "Selling Price",
    "importe": "Selling Price",
    "amount": "Selling Price",
    "precio venta": "Selling Price",
    # Margin
    "margen": "Margin",
    "gross margin": "Margin",
    "margin %": "Margin",
    # KAM
    "kam": "KAM",
    "commercial": "KAM",
    "sales rep": "KAM",
    "vendedor": "KAM",
    # Segment
    "segmento": "Segment",
    "industry": "Segment",
    "industria": "Segment",
    # Product family
    "familia": "Scope product Family",
    "product family": "Scope product Family",
    "familia producto": "Scope product Family",
}


def _normalise_column_names(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    renamed: list[str] = []
    new_cols: Dict[str, str] = {}
    for col in df.columns:
        canonical = _COLUMN_MAP.get(col.strip().lower())
        if canonical and canonical != col:
            new_cols[col] = canonical
            renamed.append(f"'{col}' → '{canonical}'")
    if new_cols:
        df = df.rename(columns=new_cols)
    return df, renamed


def _fill_nulls(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    null_before = int(df.isnull().sum().sum())
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].fillna("N/A")
        else:
            df[col] = df[col].fillna(0)
    null_after = int(df.isnull().sum().sum())
    return df, null_before - null_after


def _unify_date_formats(df: pd.DataFrame) -> list[str]:
    changes: list[str] = []
    date_cols = [c for c in df.columns if "date" in c.lower() or "fecha" in c.lower()]
    for col in date_cols:
        try:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")
            changes.append(col)
        except Exception:
            pass
    return changes


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Normalise a DataFrame from context['uploaded_data']."""
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")

    # Fallback: try reading from AGENT_INPUT_FILE env var (CLI execution)
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
            "output": "No hay datos cargados. Sube un Excel/CSV para limpiar.",
            "insights": [
                "Detecta y renombra columnas usando sinónimos del sector comercial",
                "Rellena nulos: texto → 'N/A', numéricos → 0",
                "Unifica formatos de fecha a YYYY-MM-DD",
            ],
            "cleaned_data": None,
            "changes_report": [],
        }

    df = df.copy()
    report: list[str] = []

    # 1. Normalise column names
    df, renamed = _normalise_column_names(df)
    if renamed:
        report.append(f"Columnas renombradas: {renamed}")

    # 2. Handle nulls
    df, nulls_filled = _fill_nulls(df)
    report.append(f"Valores nulos rellenados: {nulls_filled}")

    # 3. Unify date formats
    date_cols_changed = _unify_date_formats(df)
    if date_cols_changed:
        report.append(f"Fechas unificadas en: {date_cols_changed}")

    # 4. Strip whitespace from string columns
    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].astype(str).str.strip()
    report.append(f"Espacios eliminados en {len(str_cols)} columnas de texto")

    return {
        "status": "success",
        "output": f"Datos limpios: {df.shape[0]} filas × {df.shape[1]} columnas. {len(report)} operaciones.",
        "insights": [r for r in report[:5]],
        "cleaned_data": df,
        "changes_report": report,
        "shape": {"rows": df.shape[0], "cols": df.shape[1]},
    }


if __name__ == "__main__":
    print(run())
