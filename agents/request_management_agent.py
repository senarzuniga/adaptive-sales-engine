"""
Request Management Agent — Procesamiento inteligente de solicitudes entrantes
=============================================================================
• Procesamiento de texto libre y documentos (PDF, DOCX, TXT)
• Clasificación automática (oferta, ingeniería, administración, postventa)
• Extracción de datos estructurados (empresa, contacto, presupuesto, requisitos)
• Email automático a ingeniería cuando corresponde
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Classification keywords ────────────────────────────────────
_CLASSIFICATION_RULES: Dict[str, List[str]] = {
    "oferta": [
        "oferta", "cotización", "presupuesto", "precio", "quote",
        "propuesta comercial", "solicitud de oferta", "rfq",
    ],
    "ingenieria": [
        "especificación técnica", "planos", "diseño", "ingeniería",
        "engineering", "technical spec", "requisito técnico",
        "proceso", "instalación", "puesta en marcha", "commissioning",
    ],
    "administracion": [
        "factura", "albarán", "pago", "transferencia", "invoice",
        "pedido", "orden de compra", "purchase order", "po ",
        "contrato", "condiciones de pago",
    ],
    "postventa": [
        "avería", "reparación", "mantenimiento", "incidencia",
        "garantía", "spare", "repuesto", "servicio técnico",
        "after sales", "breakdown", "failure", "fallo",
    ],
}

# ── Data extraction patterns ───────────────────────────────────
_COMPANY_PATTERNS = [
    r"empresa[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s,\.]+)(?:\n|,|\.)",
    r"company[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s,\.]+)(?:\n|,|\.)",
    r"de parte de[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s,\.]+)(?:\n|,|\.)",
    r"en representación de[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s,\.]+)(?:\n|,)",
]

_CONTACT_PATTERNS = [
    r"contacto[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s]+)(?:\n|,|\.)",
    r"nombre[:\s]+([A-Za-záéíóúÁÉÍÓÚñÑ\w\s]+)(?:\n|,|\.)",
    r"contact[:\s]+([A-Za-z\w\s]+)(?:\n|,|\.)",
]

_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

_BUDGET_PATTERNS = [
    r"presupuesto[:\s]*([\d\.,]+)\s*(€|eur|euros?|usd|\$)",
    r"budget[:\s]*([\d\.,]+)\s*(€|eur|euros?|usd|\$)",
    r"([\d\.,]+)\s*(€|eur|euros?)\s*(?:de presupuesto|disponibles?)",
    r"hasta\s*([\d\.,]+)\s*(€|eur|euros?|usd)",
]

_DEADLINE_PATTERNS = [
    r"plazo[:\s]+([^\n,\.]{3,40})",
    r"para el[:\s]+([^\n,\.]{3,30})",
    r"deadline[:\s]+([^\n,\.]{3,30})",
    r"entrega[:\s]+([^\n,\.]{3,40})",
]


def _classify_request(text: str) -> Dict[str, Any]:
    """Return classification + confidence scores."""
    text_lower = text.lower()
    scores: Dict[str, int] = {cat: 0 for cat in _CLASSIFICATION_RULES}

    for category, keywords in _CLASSIFICATION_RULES.items():
        for kw in keywords:
            if kw in text_lower:
                scores[category] += 1

    total = sum(scores.values()) or 1
    best_cat = max(scores, key=lambda c: scores[c])
    confidence = round(scores[best_cat] / total * 100, 1) if total > 0 else 0

    return {
        "category": best_cat,
        "confidence": confidence,
        "scores": scores,
    }


def _extract_company(text: str) -> Optional[str]:
    for pattern in _COMPANY_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:80]
    return None


def _extract_contact(text: str) -> Optional[str]:
    for pattern in _CONTACT_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:60]
    return None


def _extract_email(text: str) -> Optional[str]:
    m = _EMAIL_PATTERN.search(text)
    return m.group(0) if m else None


def _extract_budget(text: str) -> Optional[float]:
    for pattern in _BUDGET_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                raw = m.group(1).replace(".", "").replace(",", ".")
                return float(raw)
            except ValueError:
                continue
    return None


def _extract_deadline(text: str) -> Optional[str]:
    for pattern in _DEADLINE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:50]
    return None


def _extract_requirements(text: str) -> List[str]:
    """Extract key requirement sentences from text."""
    requirements: List[str] = []
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    req_keywords = [
        "requiere", "necesita", "debe", "specifications", "requisito",
        "condición", "capacidad", "potencia", "presión", "temperatura",
        "material", "normativa", "certificación", "norma",
    ]
    for line in lines:
        if any(kw in line.lower() for kw in req_keywords):
            requirements.append(line[:200])
    return requirements[:10]


def _compose_engineering_email(
    company: Optional[str],
    contact: Optional[str],
    category: str,
    requirements: List[str],
    budget: Optional[float],
    deadline: Optional[str],
    raw_text: str,
) -> str:
    """Build the engineering email body."""
    subject = f"Nueva solicitud {category.upper()} — {company or 'Cliente desconocido'}"
    req_block = "\n".join(f"  • {r}" for r in requirements) if requirements else "  (ver texto completo adjunto)"
    budget_line = f"  Presupuesto indicado: {budget:,.0f} €" if budget else "  Presupuesto: no especificado"
    deadline_line = f"  Plazo requerido: {deadline}" if deadline else "  Plazo: no especificado"

    return (
        f"Para: andrea.tapia@estudiantat.upc.edu\n"
        f"Asunto: {subject}\n\n"
        f"Estimada Andrea,\n\n"
        f"Se ha recibido una nueva solicitud de tipo {category.upper()} que requiere revisión técnica.\n\n"
        f"DATOS EXTRAÍDOS AUTOMÁTICAMENTE:\n"
        f"  Empresa: {company or 'No detectada'}\n"
        f"  Contacto: {contact or 'No detectado'}\n"
        f"{budget_line}\n"
        f"{deadline_line}\n\n"
        f"REQUISITOS TÉCNICOS IDENTIFICADOS:\n"
        f"{req_block}\n\n"
        f"TEXTO COMPLETO DE LA SOLICITUD:\n"
        f"{'—'*50}\n"
        f"{raw_text[:1500]}{'...' if len(raw_text) > 1500 else ''}\n"
        f"{'—'*50}\n\n"
        f"Este email fue generado automáticamente por el Adaptive Sales Engine.\n"
        f"Por favor, procese la solicitud y contacte al cliente en el menor tiempo posible.\n\n"
        f"Saludos,\nSistema ACS"
    )


def _process_text(text: str) -> Dict[str, Any]:
    """Core extraction pipeline for a text request."""
    classification = _classify_request(text)
    company = _extract_company(text)
    contact = _extract_contact(text)
    email = _extract_email(text)
    budget = _extract_budget(text)
    deadline = _extract_deadline(text)
    requirements = _extract_requirements(text)

    eng_email = None
    if classification["category"] in ("oferta", "ingenieria"):
        eng_email = _compose_engineering_email(
            company=company,
            contact=contact,
            category=classification["category"],
            requirements=requirements,
            budget=budget,
            deadline=deadline,
            raw_text=text,
        )

    return {
        "classification": classification,
        "company": company,
        "contact": contact,
        "email": email,
        "budget": budget,
        "deadline": deadline,
        "requirements": requirements,
        "engineering_email": eng_email,
        "requires_engineering": bool(eng_email),
        "word_count": len(text.split()),
    }


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point for the MaximumOrchestrator."""
    try:
        # Accept text from various context keys
        raw_text: Optional[str] = (
            context.get("request_text")
            or context.get("email_text")
            or context.get("document_text")
        )

        # Also process notes if no dedicated text
        if not raw_text:
            raw_text = context.get("company_notes", "")

        if not raw_text or not raw_text.strip():
            return {
                "status": "success",
                "output": "Request Management Agent: No hay texto de solicitud en el contexto. Proporcione un texto de solicitud.",
                "insights": [
                    "📝 Añada el texto de la solicitud en 'Notas de empresa' o use el campo dedicado",
                    "📄 Compatible con texto libre, emails y documentos",
                ],
                "processed_request": None,
            }

        result = _process_text(raw_text)
        cat = result["classification"]["category"]
        conf = result["classification"]["confidence"]

        insights = [
            f"📋 Clasificación: {cat.upper()} (confianza {conf:.0f}%)",
            f"🏢 Empresa detectada: {result['company'] or 'No detectada'}",
            f"👤 Contacto: {result['contact'] or 'No detectado'}",
        ]
        if result["budget"]:
            insights.append(f"💰 Presupuesto detectado: {result['budget']:,.0f} €")
        if result["deadline"]:
            insights.append(f"⏰ Plazo detectado: {result['deadline']}")
        if result["requirements"]:
            insights.append(f"📐 {len(result['requirements'])} requisito(s) técnico(s) extraído(s)")
        if result["requires_engineering"]:
            insights.append("📧 Email a ingeniería generado automáticamente (andrea.tapia@estudiantat.upc.edu)")

        return {
            "status": "success",
            "output": (
                f"Request Management: solicitud clasificada como {cat.upper()} "
                f"(conf. {conf:.0f}%). "
                f"{'Email a ingeniería generado.' if result['requires_engineering'] else ''}"
            ),
            "insights": insights,
            "processed_request": result,
            "classification": result["classification"],
            "extracted_data": {
                "company":      result["company"],
                "contact":      result["contact"],
                "email":        result["email"],
                "budget":       result["budget"],
                "deadline":     result["deadline"],
                "requirements": result["requirements"],
            },
            "engineering_email": result.get("engineering_email"),
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("RequestManagement error: %s", exc)
        return {
            "status": "error",
            "output": f"Error en Request Management Agent: {exc}",
            "insights": [],
        }
