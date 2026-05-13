"""
Pillar 0 — Análisis 360° de Ventas
====================================
Análisis completo de resultados comerciales: períodos, KAMs, regiones,
clientes, productos, lead time, patrones, forecast y regla 80/20.

Adaptive Commercial System — Pilar 0
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _period_filter(df: pd.DataFrame, period: str, date_col: str) -> pd.DataFrame:
    """Filter DataFrame by period: month, quarter, year, or 'all'."""
    if date_col not in df.columns or period == "all":
        return df
    try:
        dates = pd.to_datetime(df[date_col], errors="coerce")
        now = pd.Timestamp.now()
        if period == "month":
            mask = dates >= (now - pd.DateOffset(months=1))
        elif period == "quarter":
            mask = dates >= (now - pd.DateOffset(months=3))
        elif period == "year":
            mask = dates >= (now - pd.DateOffset(years=1))
        else:
            return df
        return df[mask.fillna(False)].copy()
    except Exception:
        return df


# ── Sub-analyses ───────────────────────────────────────────────


def _total_sales(df: pd.DataFrame) -> Dict[str, Any]:
    revenue_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas", "importe"])),
        None,
    )
    margin_col = next(
        (c for c in df.columns if "margin" in c.lower()),
        None,
    )
    if revenue_col is None:
        return {"total_revenue": 0, "total_margin": 0, "avg_margin_pct": 0, "n_transactions": 0}

    revenues = _safe_numeric(df[revenue_col])
    total_rev = revenues.sum()
    total_margin = _safe_numeric(df[margin_col]).sum() if margin_col else 0.0
    avg_margin_pct = (total_margin / total_rev * 100) if total_rev > 0 else 0.0

    return {
        "total_revenue": round(total_rev, 2),
        "total_margin": round(total_margin, 2),
        "avg_margin_pct": round(avg_margin_pct, 1),
        "n_transactions": int(len(df)),
    }


def _by_kam(df: pd.DataFrame) -> List[Dict[str, Any]]:
    kam_col = next((c for c in df.columns if "kam" in c.lower()), None)
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not kam_col or not rev_col:
        return []
    grouped = (
        df.groupby(df[kam_col].fillna("Desconocido"))[rev_col]
        .apply(lambda s: _safe_numeric(s).sum())
        .reset_index()
    )
    grouped.columns = ["kam", "revenue"]
    grouped = grouped.sort_values("revenue", ascending=False)
    return grouped.round(2).to_dict("records")


def _by_region(df: pd.DataFrame) -> List[Dict[str, Any]]:
    region_col = next((c for c in df.columns if any(k in c.lower() for k in ["region", "país", "pais", "country"])), None)
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not region_col or not rev_col:
        return []
    grouped = (
        df.groupby(df[region_col].fillna("Sin región"))[rev_col]
        .apply(lambda s: _safe_numeric(s).sum())
        .reset_index()
    )
    grouped.columns = ["region", "revenue"]
    grouped = grouped.sort_values("revenue", ascending=False)
    return grouped.round(2).to_dict("records")


def _by_client(df: pd.DataFrame, top_n: int = 20) -> List[Dict[str, Any]]:
    client_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["customer", "cliente", "company"])),
        None,
    )
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not client_col or not rev_col:
        return []
    grouped = (
        df.groupby(df[client_col].fillna("Desconocido"))[rev_col]
        .apply(lambda s: _safe_numeric(s).sum())
        .reset_index()
    )
    grouped.columns = ["client", "revenue"]
    grouped = grouped.sort_values("revenue", ascending=False).head(top_n)
    return grouped.round(2).to_dict("records")


def _by_product(df: pd.DataFrame, top_n: int = 20) -> List[Dict[str, Any]]:
    prod_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["product", "producto", "familia", "family"])),
        None,
    )
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not prod_col or not rev_col:
        return []
    grouped = (
        df.groupby(df[prod_col].fillna("Desconocido"))[rev_col]
        .apply(lambda s: _safe_numeric(s).sum())
        .reset_index()
    )
    grouped.columns = ["product", "revenue"]
    grouped = grouped.sort_values("revenue", ascending=False).head(top_n)
    return grouped.round(2).to_dict("records")


def _lead_time(df: pd.DataFrame) -> Dict[str, Any]:
    """Days from first offer date to PO date."""
    offer_col = next((c for c in df.columns if "first offer" in c.lower() or "fecha oferta" in c.lower()), None)
    po_col    = next((c for c in df.columns if "po date" in c.lower() or "fecha pedido" in c.lower()), None)
    if not offer_col or not po_col:
        return {"avg_lead_time_days": None, "min_days": None, "max_days": None}
    try:
        dates_offer = pd.to_datetime(df[offer_col], errors="coerce")
        dates_po    = pd.to_datetime(df[po_col], errors="coerce")
        delta = (dates_po - dates_offer).dt.days.dropna()
        delta = delta[delta >= 0]
        if delta.empty:
            return {"avg_lead_time_days": None, "min_days": None, "max_days": None}
        return {
            "avg_lead_time_days": round(float(delta.mean()), 1),
            "min_days": int(delta.min()),
            "max_days": int(delta.max()),
            "median_days": round(float(delta.median()), 1),
        }
    except Exception:
        return {"avg_lead_time_days": None, "min_days": None, "max_days": None}


def _portfolio_risk_8020(df: pd.DataFrame) -> Dict[str, Any]:
    """Identify clients representing 80% of revenue (Pareto 80/20)."""
    client_data = _by_client(df, top_n=len(df))
    if not client_data:
        return {"risk_level": "UNKNOWN", "pareto_clients": [], "total_clients": 0}

    total = sum(r["revenue"] for r in client_data)
    if total == 0:
        return {"risk_level": "UNKNOWN", "pareto_clients": [], "total_clients": 0}

    cumulative = 0.0
    pareto = []
    for r in client_data:
        cumulative += r["revenue"]
        pareto.append(r)
        if cumulative / total >= 0.80:
            break

    n = len(pareto)
    if n < 5:
        risk = "ALTO"
    elif n < 10:
        risk = "MEDIO"
    else:
        risk = "BAJO"

    return {
        "risk_level": risk,
        "pareto_clients": n,
        "pareto_revenue_pct": round(cumulative / total * 100, 1),
        "total_clients": len(client_data),
        "top_pareto": pareto[:5],
    }


def _seasonality(df: pd.DataFrame) -> Dict[str, Any]:
    """Detect monthly seasonality patterns."""
    date_col = next((c for c in df.columns if any(k in c.lower() for k in ["po date", "fecha", "date"])), None)
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not date_col or not rev_col:
        return {}
    try:
        df2 = df.copy()
        df2["_date"] = pd.to_datetime(df2[date_col], errors="coerce")
        df2["_month"] = df2["_date"].dt.month
        df2["_rev"] = _safe_numeric(df2[rev_col])
        monthly = df2.groupby("_month")["_rev"].sum().reset_index()
        monthly.columns = ["month", "revenue"]
        peak_month = int(monthly.loc[monthly["revenue"].idxmax(), "month"])
        return {
            "monthly_breakdown": monthly.round(2).to_dict("records"),
            "peak_month": peak_month,
        }
    except Exception:
        return {}


def _forecast(df: pd.DataFrame, horizons: List[int] = [3, 6, 12]) -> Dict[str, Any]:
    """Simple linear trend forecast for given month horizons."""
    date_col = next((c for c in df.columns if any(k in c.lower() for k in ["po date", "fecha", "date"])), None)
    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["selling price", "revenue", "ventas"])),
        None,
    )
    if not date_col or not rev_col:
        return {}
    try:
        df2 = df.copy()
        df2["_date"] = pd.to_datetime(df2[date_col], errors="coerce")
        df2["_rev"] = _safe_numeric(df2[rev_col])
        df2 = df2.dropna(subset=["_date"]).sort_values("_date")
        df2["_month_idx"] = (
            (df2["_date"].dt.year - df2["_date"].dt.year.min()) * 12
            + df2["_date"].dt.month
        )
        monthly = df2.groupby("_month_idx")["_rev"].sum().reset_index()
        if len(monthly) < 2:
            avg = float(df2["_rev"].mean()) if not df2["_rev"].empty else 0
            return {h: round(avg * h, 2) for h in horizons}

        x = monthly["_month_idx"].values
        y = monthly["_rev"].values
        # Linear regression (numpy-free using manual formula)
        n = len(x)
        sx = float(sum(x))
        sy = float(sum(y))
        sxy = float(sum(xi * yi for xi, yi in zip(x, y)))
        sx2 = float(sum(xi ** 2 for xi in x))
        denom = n * sx2 - sx ** 2
        slope = (n * sxy - sx * sy) / denom if denom != 0 else 0
        intercept = (sy - slope * sx) / n

        last_month = int(x[-1])
        forecasts = {}
        for h in horizons:
            projected = sum(
                max(0, intercept + slope * (last_month + m)) for m in range(1, h + 1)
            )
            forecasts[f"{h}m_forecast"] = round(projected, 2)
        return forecasts
    except Exception:
        return {}


# ── Main entry point ───────────────────────────────────────────

def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        df: Optional[pd.DataFrame] = context.get("uploaded_data")

        # Also accept historical/sales data from named slots
        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            df = context.get("oportunidades_data")

        if df is None or not isinstance(df, pd.DataFrame) or df.empty:
            return {
                "status": "success",
                "output": "Pilar 0 — No se encontraron datos de ventas. Cargue el histórico de ventas para análisis 360°.",
                "insights": [
                    "📂 Cargue datos usando la plantilla templates/sales_results_template.csv",
                    "📊 Campos mínimos: PO date, Customer name, Selling price, Margin, KAM",
                ],
                "period_analyzed": "sin datos",
            }

        period = context.get("period", "year")
        date_col = next((c for c in df.columns if any(k in c.lower() for k in ["po date", "fecha", "date"])), "")
        df_filtered = _period_filter(df, period, date_col)

        totals = _total_sales(df_filtered)
        by_kam_data = _by_kam(df_filtered)
        by_region_data = _by_region(df_filtered)
        by_client_data = _by_client(df_filtered)
        by_product_data = _by_product(df_filtered)
        lead_time_data = _lead_time(df_filtered)
        portfolio = _portfolio_risk_8020(df_filtered)
        seasonality = _seasonality(df_filtered)
        forecast = _forecast(df_filtered)

        insights = [
            f"📊 Período analizado: {period} | {len(df_filtered)} transacciones",
            f"💰 Revenue total: {totals['total_revenue']:,.0f} € | Margen: {totals['avg_margin_pct']:.1f}%",
        ]
        if lead_time_data.get("avg_lead_time_days"):
            insights.append(f"⏱️ Lead time medio: {lead_time_data['avg_lead_time_days']} días (min: {lead_time_data['min_days']}, max: {lead_time_data['max_days']})")

        risk = portfolio.get("risk_level", "UNKNOWN")
        risk_emoji = "🔴" if risk == "ALTO" else ("🟡" if risk == "MEDIO" else "🟢")
        insights.append(
            f"{risk_emoji} Riesgo cartera: {risk} — {portfolio.get('pareto_clients', '?')} clientes = {portfolio.get('pareto_revenue_pct', '?')}% del revenue"
        )
        if by_kam_data:
            top_kam = by_kam_data[0]
            insights.append(f"🏆 Top KAM: {top_kam['kam']} ({top_kam['revenue']:,.0f} €)")
        if forecast:
            insights.append(
                "📈 Forecast: " + " | ".join(f"{k}: {v:,.0f} €" for k, v in forecast.items())
            )

        output_summary = (
            f"Análisis 360° Pilar 0 completado — {totals['n_transactions']} transacciones, "
            f"revenue {totals['total_revenue']:,.0f} €, margen {totals['avg_margin_pct']:.1f}%, "
            f"riesgo cartera {risk}."
        )

        return {
            "status": "success",
            "output": output_summary,
            "insights": insights,
            "totals": totals,
            "by_kam": by_kam_data,
            "by_region": by_region_data,
            "by_client": by_client_data,
            "by_product": by_product_data,
            "lead_time": lead_time_data,
            "portfolio_risk": portfolio,
            "seasonality": seasonality,
            "forecast": forecast,
            "period_analyzed": period,
            "n_rows": len(df_filtered),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("Pillar0_360 error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Análisis 360°: {exc}",
            "insights": [],
        }
