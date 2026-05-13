"""
Excel Processor Agent — Limpieza y estandarización inteligente de Excel
======================================================================
Limpia, estandariza y valida cualquier archivo Excel cargado.
• Mapeo automático de nombres de columnas
• Manejo de valores nulos sin errores
• Validación de campos requeridos según tipo
• Output: DataFrame limpio + reporte de calidad
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# ── Column alias maps ──────────────────────────────────────────
_ALIAS_MAP: Dict[str, List[str]] = {
    # Sales results
    "po_date":           ["po date", "fecha pedido", "order date", "fecha po"],
    "first_offer_date":  ["first offer date", "fecha oferta", "offer date"],
    "customer_name":     ["customer name", "cliente", "customer", "company", "empresa"],
    "selling_price":     ["selling price", "precio venta", "revenue", "importe", "amount"],
    "margin":            ["margin", "margen", "gross margin", "margen bruto"],
    "kam":               ["kam", "sales rep", "comercial", "vendedor", "account manager"],
    # Opportunities
    "opp_number":        ["opp/offer number", "opp number", "numero oferta", "offer number", "referencia"],
    "status":            ["status", "estado", "stage", "etapa"],
    "est_revenue":       ["est revenue", "estimated revenue", "valor estimado", "potential revenue"],
    "contract_prob":     ["contract prob", "probability", "probabilidad", "win rate", "probabilidad cierre"],
    # Products
    "product_name":      ["name", "nombre", "product name", "producto"],
    "average_value":     ["average value", "valor medio", "avg price", "precio medio"],
    "positioning":       ["commodity/innovation", "positioning", "posicionamiento", "tipo"],
    "lifecycle_stage":   ["lifecycle_stage", "lifecycle stage", "ciclo de vida", "stage"],
    # Strategy
    "product_family":    ["product family", "familia producto", "familia", "category"],
    "strategic_priority":["strategic priority", "prioridad estratégica", "priority"],
    # Company info
    "company_name":      ["company name", "nombre empresa", "empresa", "company"],
    "industry":          ["industry", "sector", "industria"],
    "company_size":      ["size", "tamaño", "employees", "empleados"],
    "budget_1y":         ["budget 1y", "presupuesto 1 año", "annual budget"],
    "budget_3y":         ["budget 3y", "presupuesto 3 años", "3 year budget"],
}

# ── Required fields per template type ─────────────────────────
_REQUIRED_FIELDS: Dict[str, List[str]] = {
    "sales_results":  ["customer_name", "selling_price"],
    "opportunities":  ["opp_number", "status", "est_revenue"],
    "products":       ["product_name"],
    "strategy":       ["product_family"],
    "company_info":   ["company_name"],
}


def _normalize_col_name(col: str) -> str:
    return re.sub(r"\s+", " ", str(col).strip().lower())


def _map_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Rename columns using alias map. Returns (df_renamed, mapping_report)."""
    mapping: Dict[str, str] = {}
    rename: Dict[str, str] = {}

    norm_cols = {_normalize_col_name(c): c for c in df.columns}

    for canonical, aliases in _ALIAS_MAP.items():
        for alias in aliases:
            norm_alias = _normalize_col_name(alias)
            if norm_alias in norm_cols:
                original = norm_cols[norm_alias]
                if original != canonical:
                    rename[original] = canonical
                    mapping[canonical] = original
                break

    if rename:
        df = df.rename(columns=rename)

    return df, mapping


def _detect_template_type(df: pd.DataFrame) -> str:
    """Infer template type from present columns."""
    cols = set(df.columns)
    scores = {
        "sales_results":  sum(1 for c in ["po_date", "selling_price", "kam", "margin"] if c in cols),
        "opportunities":  sum(1 for c in ["opp_number", "status", "est_revenue", "contract_prob"] if c in cols),
        "products":       sum(1 for c in ["product_name", "average_value", "lifecycle_stage"] if c in cols),
        "strategy":       sum(1 for c in ["product_family", "est_revenue", "strategic_priority"] if c in cols),
        "company_info":   sum(1 for c in ["company_name", "industry", "budget_1y"] if c in cols),
    }
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "unknown"


def _clean_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Clean a DataFrame: handle nulls, strip whitespace, coerce types."""
    original_rows = len(df)
    report: Dict[str, Any] = {}

    # Drop fully empty rows
    df = df.dropna(how="all")
    report["empty_rows_removed"] = original_rows - len(df)

    # Strip string columns
    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].astype(str).str.strip().replace({"nan": "", "None": "", "NaT": ""})
        df[col] = df[col].replace("", pd.NA)

    # Numeric coercion for known numeric columns
    numeric_hints = [
        "selling_price", "margin", "est_revenue", "contract_prob",
        "average_value", "budget_1y", "budget_3y",
    ]
    coerced: List[str] = []
    for col in numeric_hints:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            coerced.append(col)
    report["numeric_cols_coerced"] = coerced

    # Date coercion for known date columns
    date_hints = ["po_date", "first_offer_date"]
    date_coerced: List[str] = []
    for col in date_hints:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
            date_coerced.append(col)
    report["date_cols_coerced"] = date_coerced

    # Fill remaining nulls with sensible defaults
    for col in df.columns:
        if df[col].dtype == "object" or str(df[col].dtype) == "string":
            df[col] = df[col].fillna("N/D")
        elif pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(0)

    report["final_rows"] = len(df)
    report["final_cols"] = len(df.columns)
    return df, report


def _validate_required_fields(df: pd.DataFrame, template_type: str) -> List[str]:
    """Return list of missing required fields for the detected template type."""
    required = _REQUIRED_FIELDS.get(template_type, [])
    return [f for f in required if f not in df.columns]


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        df: Optional[pd.DataFrame] = context.get("uploaded_data")

        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return {
                "status": "success",
                "output": "Excel Processor — No hay datos cargados. Suba un archivo Excel para procesarlo.",
                "insights": ["📂 Use el uploader principal para cargar cualquier archivo Excel o CSV"],
                "cleaned_data": None,
            }

        original_shape = df.shape

        # 1. Map columns to canonical names
        df, mapping_report = _map_columns(df)

        # 2. Detect template type
        template_type = _detect_template_type(df)

        # 3. Clean data
        df_clean, clean_report = _clean_dataframe(df)

        # 4. Validate required fields
        missing_fields = _validate_required_fields(df_clean, template_type)

        # 5. Data quality score (0-100)
        non_null_pct = (df_clean.notna().sum().sum() / max(df_clean.size, 1)) * 100
        quality_score = round(non_null_pct, 1)

        insights = [
            f"✅ Tipo de plantilla detectado: {template_type}",
            f"📐 Dimensiones: {original_shape[0]}×{original_shape[1]} → {clean_report['final_rows']}×{clean_report['final_cols']}",
            f"🧹 Filas vacías eliminadas: {clean_report['empty_rows_removed']}",
            f"📊 Calidad de datos: {quality_score:.0f}%",
        ]

        if mapping_report:
            insights.append(f"🔄 Columnas renombradas: {', '.join(f'{v}→{k}' for k, v in list(mapping_report.items())[:5])}")
        if clean_report["numeric_cols_coerced"]:
            insights.append(f"🔢 Campos numéricos procesados: {', '.join(clean_report['numeric_cols_coerced'])}")
        if missing_fields:
            insights.append(f"⚠️ Campos requeridos faltantes: {', '.join(missing_fields)}")

        return {
            "status": "success",
            "output": (
                f"Excel Processor: {clean_report['final_rows']} filas limpias ({template_type}), "
                f"calidad {quality_score:.0f}%."
            ),
            "insights": insights,
            "cleaned_data": df_clean,
            "template_type": template_type,
            "column_mapping": mapping_report,
            "quality_score": quality_score,
            "missing_required_fields": missing_fields,
            "clean_report": clean_report,
            "original_shape": list(original_shape),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("ExcelProcessor error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Excel Processor: {exc}",
            "insights": [],
            "cleaned_data": None,
        }
