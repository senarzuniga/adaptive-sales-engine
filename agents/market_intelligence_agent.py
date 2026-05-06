"""
Market Intelligence Agent – Informe ejecutivo de mercado.
En modo demo genera un análisis estructurado con los datos disponibles.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd


# B2B industrial market signals (demo/static knowledge base)
_MARKET_SIGNALS: List[Dict] = [
    {
        "sector": "Automatización Industrial",
        "trend": "Inversión en robótica colaborativa +18% YoY",
        "opportunity": "Clientes con líneas de producción legacy — modernización",
        "threat": "Competencia asiática con precios 30% menores",
    },
    {
        "sector": "Energía & Utilities",
        "trend": "Descarbonización impulsa proyectos de eficiencia energética",
        "opportunity": "Auditorías energéticas + soluciones de monitorización",
        "threat": "Ciclos de compra largos (18-36 meses)",
    },
    {
        "sector": "Food & Beverage",
        "trend": "Demanda de trazabilidad y seguridad alimentaria",
        "opportunity": "Sistemas de visión artificial y control de calidad",
        "threat": "Presión en márgenes por inflación de materias primas",
    },
    {
        "sector": "Automoción",
        "trend": "Transición a vehículo eléctrico redefine proveedores",
        "opportunity": "Integración en nuevas cadenas de valor EV",
        "threat": "Reducción de pedidos en powertrain tradicional",
    },
    {
        "sector": "Construcción & Infraestructura",
        "trend": "Fondos EU para infraestructura digital (PERTE, Next Gen)",
        "opportunity": "Contratos plurianuales de mantenimiento y operación",
        "threat": "Retrasos administrativos en proyectos públicos",
    },
]


def run(context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if context is None:
        context = {}

    df: Optional[pd.DataFrame] = context.get("uploaded_data")
    saved_companies: List[Dict] = context.get("saved_companies", []) or []

    # Derive sector context from data columns / companies
    sectors_detected: List[str] = []

    if df is not None and isinstance(df, pd.DataFrame) and not df.empty:
        seg_candidates = ["Segment", "segmento", "industry", "sector"]
        for c in seg_candidates:
            matched = [col for col in df.columns if col.lower() == c.lower()]
            if matched:
                vals = df[matched[0]].dropna().astype(str).unique().tolist()
                sectors_detected.extend(vals[:5])
                break

    if saved_companies:
        for comp in saved_companies[:5]:
            sector = comp.get("sector") or comp.get("industry") or comp.get("segment")
            if sector:
                sectors_detected.append(str(sector))

    sectors_detected = list(set(sectors_detected))[:5]

    # Select relevant market signals
    relevant = _MARKET_SIGNALS[:3]

    # Build executive report
    report_lines: List[str] = [
        f"## Informe de Inteligencia de Mercado — {datetime.utcnow().strftime('%Y-%m-%d')}",
        "",
        "### 📊 Tendencias clave B2B Industrial",
    ]
    for sig in relevant:
        report_lines.append(
            f"- **{sig['sector']}**: {sig['trend']} | "
            f"Oportunidad: {sig['opportunity']} | ⚠️ {sig['threat']}"
        )

    if sectors_detected:
        report_lines.append("")
        report_lines.append(f"### 🏭 Sectores detectados en tus datos: {', '.join(sectors_detected)}")

    report_lines += [
        "",
        "### 💡 Recomendaciones estratégicas",
        "1. Priorizar propuestas de valor en eficiencia y ROI medible",
        "2. Desarrollar casos de éxito cuantificados por sector",
        "3. Alinear roadmap de producto con tendencias de automatización",
        "4. Establecer alianzas con integradores locales en mercados clave",
    ]

    report_text = "\n".join(report_lines)

    insights = [
        f"{relevant[0]['sector']}: {relevant[0]['trend']}",
        f"Oportunidad prioritaria: {relevant[0]['opportunity']}",
        f"Riesgo principal: {relevant[1]['threat']}",
        "Fuente: Base de conocimiento sectorial B2B industrial",
    ]
    if sectors_detected:
        insights.append(f"Sectores en cartera: {', '.join(sectors_detected[:3])}")

    return {
        "status": "success",
        "output": f"Informe de mercado generado. {len(relevant)} sectores analizados.",
        "insights": insights,
        "report": report_text,
        "market_signals": relevant,
        "sectors_in_portfolio": sectors_detected,
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import json
    res = run()
    print(res["report"])
    print("\nInsights:", json.dumps(res["insights"], indent=2))
