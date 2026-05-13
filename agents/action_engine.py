"""
Action Engine — Sistema de Acciones Inteligentes en Cascada
===========================================================
Genera automáticamente acciones priorizadas a partir de eventos de negocio.

Scoring: urgencia × importancia × impacto_negocio
Prioridades: CRITICAL(5) > HIGH(4) > MEDIUM(3) > LOW(2) > PLANNED(1)
Roles: administracion, gestion_proyecto, ingenieria, postventa,
       comercial, gerencia, calidad, logistica
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ── Priority constants ─────────────────────────────────────────
CRITICAL = 5
HIGH     = 4
MEDIUM   = 3
LOW      = 2
PLANNED  = 1

_PRIORITY_LABELS = {
    CRITICAL: "CRITICAL",
    HIGH:     "HIGH",
    MEDIUM:   "MEDIUM",
    LOW:      "LOW",
    PLANNED:  "PLANNED",
}

# ── Cascade action templates ───────────────────────────────────
_CASCADE_TEMPLATES: List[Dict[str, Any]] = [
    # ── Offer accepted → project creation ────────────────────────
    {
        "trigger": "offer_accepted",
        "actions": [
            {
                "title": "Crear ficha de proyecto en sistema",
                "role": "gestion_proyecto",
                "priority": CRITICAL,
                "due_days": 1,
                "description": "Registrar el proyecto derivado de la oferta aceptada con todos los parámetros comerciales.",
            },
            {
                "title": "Informar al departamento de ingeniería del nuevo pedido",
                "role": "ingenieria",
                "priority": HIGH,
                "due_days": 1,
                "description": "Transferir especificaciones técnicas y condiciones acordadas con el cliente.",
            },
            {
                "title": "Confirmar condiciones de entrega con logística",
                "role": "logistica",
                "priority": HIGH,
                "due_days": 2,
                "description": "Verificar disponibilidad de recursos y plazos de entrega comprometidos.",
            },
            {
                "title": "Registrar pedido en sistema administrativo y emitir proforma",
                "role": "administracion",
                "priority": HIGH,
                "due_days": 2,
                "description": "Alta del pedido, condiciones de pago y facturación acordada.",
            },
            {
                "title": "Comunicar al cliente la confirmación del pedido",
                "role": "comercial",
                "priority": MEDIUM,
                "due_days": 1,
                "description": "Email de confirmación con número de pedido y próximos pasos.",
            },
        ],
    },
    # ── Offer rejected ──────────────────────────────────────────
    {
        "trigger": "offer_rejected",
        "actions": [
            {
                "title": "Analizar motivo de rechazo y documentar lecciones aprendidas",
                "role": "comercial",
                "priority": HIGH,
                "due_days": 2,
                "description": "Registrar causas de pérdida: precio, plazo, competidor, especificaciones.",
            },
            {
                "title": "Revisar estrategia de pricing con gerencia",
                "role": "gerencia",
                "priority": MEDIUM,
                "due_days": 5,
                "description": "Evaluar si la pérdida revela una brecha de competitividad sistémica.",
            },
            {
                "title": "Mantener cliente en ciclo de seguimiento",
                "role": "comercial",
                "priority": LOW,
                "due_days": 30,
                "description": "Programar contacto de reenganche en 30 días.",
            },
        ],
    },
    # ── New request received ─────────────────────────────────────
    {
        "trigger": "request_received",
        "actions": [
            {
                "title": "Clasificar y enriquecer solicitud entrante",
                "role": "comercial",
                "priority": HIGH,
                "due_days": 1,
                "description": "Identificar tipo (oferta / ingeniería / admin / postventa) y extraer datos clave.",
            },
            {
                "title": "Asignar responsable de oferta",
                "role": "administracion",
                "priority": HIGH,
                "due_days": 1,
                "description": "Designar KAM o comercial según territorio y perfil del cliente.",
            },
            {
                "title": "Preparar oferta técnico-económica",
                "role": "ingenieria",
                "priority": HIGH,
                "due_days": 5,
                "description": "Elaborar propuesta técnica en base a requisitos extraídos.",
            },
        ],
    },
    # ── Client at risk (no contact > 60 days) ───────────────────
    {
        "trigger": "client_at_risk",
        "actions": [
            {
                "title": "Contacto urgente con cliente en riesgo de abandono",
                "role": "comercial",
                "priority": CRITICAL,
                "due_days": 1,
                "description": "Cliente sin contacto superior a 60 días — recuperar relación comercial.",
            },
            {
                "title": "Revisar historial de incidencias de postventa",
                "role": "postventa",
                "priority": HIGH,
                "due_days": 2,
                "description": "Verificar si existe insatisfacción no resuelta que explique el distanciamiento.",
            },
            {
                "title": "Preparar propuesta de valor personalizada",
                "role": "comercial",
                "priority": MEDIUM,
                "due_days": 5,
                "description": "Diseñar oferta de fidelización basada en historial de compras del cliente.",
            },
        ],
    },
    # ── After-sales opportunity detected ────────────────────────
    {
        "trigger": "aftersales_opportunity",
        "actions": [
            {
                "title": "Proponer contrato de mantenimiento preventivo",
                "role": "postventa",
                "priority": HIGH,
                "due_days": 5,
                "description": "Presentar contrato de servicio basado en antigüedad y uso del equipo instalado.",
            },
            {
                "title": "Identificar consumibles y recambios recurrentes",
                "role": "logistica",
                "priority": MEDIUM,
                "due_days": 7,
                "description": "Preparar catálogo de repuestos recomendados para el parque instalado.",
            },
        ],
    },
    # ── Portfolio risk detected ──────────────────────────────────
    {
        "trigger": "portfolio_risk",
        "actions": [
            {
                "title": "Revisar concentración de cartera con gerencia",
                "role": "gerencia",
                "priority": CRITICAL,
                "due_days": 3,
                "description": "La cartera supera umbral de concentración (80/20). Planificar diversificación.",
            },
            {
                "title": "Activar plan de prospección de nuevas cuentas",
                "role": "comercial",
                "priority": HIGH,
                "due_days": 7,
                "description": "Identificar 10 cuentas target para reducir dependencia de cuentas clave.",
            },
        ],
    },
    # ── Forecast deviation ───────────────────────────────────────
    {
        "trigger": "forecast_deviation",
        "actions": [
            {
                "title": "Revisión de pipeline vs objetivo anual",
                "role": "gerencia",
                "priority": HIGH,
                "due_days": 3,
                "description": "El forecast actual se desvía >15% del objetivo. Revisar acciones correctivas.",
            },
            {
                "title": "Activar oportunidades en estado 'pausado'",
                "role": "comercial",
                "priority": HIGH,
                "due_days": 5,
                "description": "Reactivar oportunidades detenidas para recuperar el pipeline.",
            },
            {
                "title": "Informe de desviación para dirección",
                "role": "administracion",
                "priority": MEDIUM,
                "due_days": 5,
                "description": "Preparar informe ejecutivo de situación comercial vs plan.",
            },
        ],
    },
]


def _score_action(urgency: int, importance: int, business_impact: int) -> float:
    """Weighted score: urgency × 0.4 + importance × 0.35 + impact × 0.25."""
    return urgency * 0.40 + importance * 0.35 + business_impact * 0.25


def _generate_actions_for_event(
    trigger: str, context: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate action list for a given trigger event."""
    actions: List[Dict[str, Any]] = []
    now = datetime.now()

    for template in _CASCADE_TEMPLATES:
        if template["trigger"] != trigger:
            continue

        for tpl_action in template["actions"]:
            due_date = (now + timedelta(days=tpl_action["due_days"])).strftime(
                "%Y-%m-%d"
            )
            action = {
                "trigger": trigger,
                "title": tpl_action["title"],
                "role": tpl_action["role"],
                "priority": tpl_action["priority"],
                "priority_label": _PRIORITY_LABELS[tpl_action["priority"]],
                "due_date": due_date,
                "description": tpl_action["description"],
                "context_ref": context.get("ref", ""),
                "company": context.get(
                    "company",
                    context.get("active_company", {}).get("name", "") if isinstance(context.get("active_company"), dict) else "",
                ),
                "created_at": now.isoformat(),
                "status": "pending",
            }
            actions.append(action)

    return actions


def _detect_triggers(context: Dict[str, Any]) -> List[str]:
    """Auto-detect triggers from context data."""
    triggers: List[str] = []

    # Explicit trigger
    explicit = context.get("action", "")
    if explicit:
        triggers.append(explicit)

    # Portfolio risk
    portfolio_risk = context.get("portfolio_risk")
    if isinstance(portfolio_risk, dict):
        level = portfolio_risk.get("risk_level", "")
        if level in ("ALTO", "CRÍTICO", "HIGH", "CRITICAL"):
            if "portfolio_risk" not in triggers:
                triggers.append("portfolio_risk")

    # Forecast deviation: compare forecast vs strategy target
    oportunidades = context.get("oportunidades_data")
    estrategia = context.get("estrategia_data")
    if oportunidades is not None and estrategia is not None:
        try:
            pipeline_total = float(
                pd.to_numeric(oportunidades.get("Est Revenue", oportunidades.get("revenue", 0)), errors="coerce").fillna(0).sum()
                if isinstance(oportunidades, pd.DataFrame)
                else 0
            )
            target_total = float(
                pd.to_numeric(estrategia.get("Est Revenue", estrategia.get("target", 0)), errors="coerce").fillna(0).sum()
                if isinstance(estrategia, pd.DataFrame)
                else 0
            )
            if target_total > 0 and abs(pipeline_total - target_total) / target_total > 0.15:
                triggers.append("forecast_deviation")
        except Exception:
            pass

    return triggers


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        triggers = _detect_triggers(context)
        if not triggers:
            return {
                "status": "success",
                "output": "No se detectaron disparadores de acciones en el contexto actual.",
                "insights": [],
                "actions": [],
            }

        all_actions: List[Dict[str, Any]] = []
        for trigger in triggers:
            actions = _generate_actions_for_event(trigger, context)
            all_actions.extend(actions)

        # Sort by priority desc, then due_date asc
        all_actions.sort(key=lambda a: (-a["priority"], a["due_date"]))

        critical = [a for a in all_actions if a["priority"] == CRITICAL]
        high     = [a for a in all_actions if a["priority"] == HIGH]

        insights = [
            f"⚡ {len(all_actions)} acciones generadas para {len(triggers)} disparador(es): {', '.join(triggers)}",
        ]
        if critical:
            insights.append(f"🔴 {len(critical)} acciones CRITICAL requieren atención inmediata")
        if high:
            insights.append(f"🟡 {len(high)} acciones HIGH en las próximas 48h")

        roles = {}
        for a in all_actions:
            roles[a["role"]] = roles.get(a["role"], 0) + 1
        insights.append("📋 Distribución por rol: " + ", ".join(f"{r}: {c}" for r, c in sorted(roles.items())))

        return {
            "status": "success",
            "output": f"Action Engine generó {len(all_actions)} acciones en cascada desde {len(triggers)} evento(s).",
            "insights": insights,
            "actions": all_actions,
            "triggers": triggers,
            "summary": {
                "total": len(all_actions),
                "by_priority": {
                    label: len([a for a in all_actions if a["priority_label"] == label])
                    for label in _PRIORITY_LABELS.values()
                },
                "by_role": roles,
            },
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("ActionEngine error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Action Engine: {exc}",
            "insights": [],
            "actions": [],
        }
