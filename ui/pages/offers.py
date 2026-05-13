"""Offer & Pricing pages — manual creation, from request, document upload, listing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

from config import SUPABASE_CONFIGURED
from domain.pricing import (
    PREDEFINED_COST_MODULES,
    FREIGHT_BASE_RATES,
    calculate_freight_cost,
    calculate_total_cost,
)
from application.services.offer_service import (
    create_offer,
    list_offers,
    next_offer_serial,
    update_offer_status,
    archive_offer,
)
from ui.components import _field, safe_execute, get_deadline_priority, _render_orchestrator_panel


# ──────────────────────────────────────────────────────────────
# Cost engine block (reusable UI component)
# ──────────────────────────────────────────────────────────────


def page_cost_engine_block(default_materials: float = 0.0) -> Dict[str, Any]:
    st.subheader("⚙️ Cost Module Engine")

    material_cost = st.number_input(
        "Materiales (€)", min_value=0.0, step=100.0, value=float(default_materials), key="ce_material"
    )
    packaging = st.number_input("Packaging (€)", min_value=0.0, step=50.0, value=0.0, key="ce_pack")

    destination = st.selectbox("Destino", list(FREIGHT_BASE_RATES.keys()), key="ce_destination")
    mode = st.selectbox("Transporte", ["truck", "maritime"], key="ce_mode")
    container = st.selectbox("Contenedor", ["20ft", "40ft"], key="ce_container")
    qty = st.number_input("Cantidad viajes/contenedores", min_value=1, max_value=100, value=1, key="ce_qty")

    freight = calculate_freight_cost(destination, "truck" if mode == "truck" else "maritime", container, int(qty))

    st.write("Selecciona módulos de coste")
    selected_lines: List[Dict[str, Any]] = []
    for mod in PREDEFINED_COST_MODULES:
        checked = st.checkbox(f"{mod['name']} ({mod['rate']} {mod['unit']})", key=f"ce_mod_{mod['id']}")
        if checked:
            q = st.number_input(
                f"Cantidad {mod['name']}", min_value=0.0, step=1.0, value=1.0, key=f"ce_qty_{mod['id']}"
            )
            selected_lines.append({"module_id": mod["id"], "quantity": q})

    calc = calculate_total_cost(selected_lines, material_cost, freight, packaging)
    st.metric("Total estimado", f"€ {calc['total']:,.2f}")
    return calc


# ──────────────────────────────────────────────────────────────
# Request pool (Commercial only)
# ──────────────────────────────────────────────────────────────


def page_requests() -> None:
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()

    profile = st.session_state.profile or {}
    if not SUPABASE_CONFIGURED or supabase is None:
        st.warning("Esta sección requiere conexión a Supabase.")
        return
    if profile.get("department") != "Commercial":
        st.warning("Esta vista es solo para el departamento Commercial")
        return

    st.subheader("📥 Request Pool")

    with st.expander("➕ Nueva solicitud", expanded=False):
        with st.form("request_create"):
            company = st.text_input("Empresa")
            contact_name = st.text_input("Contacto")
            contact_email = st.text_input("Email contacto")
            contact_phone = st.text_input("Teléfono contacto")
            description = st.text_area("Descripción")
            days_to_deadline = st.number_input("Días para deadline", min_value=1, max_value=180, value=7)
            submitted = st.form_submit_button("Guardar", use_container_width=True)

            if submitted:
                now = datetime.now(timezone.utc)
                payload = {
                    "company": company,
                    "contact_name": contact_name,
                    "contact_email": contact_email,
                    "contact_phone": contact_phone,
                    "description": description,
                    "received_date": now.date().isoformat(),
                    "deadline_preliminary_budget": (
                        now + timedelta(days=int(days_to_deadline))
                    ).date().isoformat(),
                    "status": "new",
                    "created_by": st.session_state.user.id,
                }
                try:
                    supabase.table("customer_requests").insert(payload).execute()
                    st.success("Solicitud creada")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Error creando solicitud: {exc}")

    try:
        rows = (
            supabase.table("customer_requests")
            .select("*")
            .order("deadline_preliminary_budget", desc=False)
            .execute()
            .data or []
        )
    except Exception as exc:
        st.error(f"No se pudo cargar request pool: {exc}")
        rows = []

    st.subheader("Solicitudes")
    for req in rows:
        if _field(req, "status") == "declined":
            continue
        css_class, emoji, days_left = get_deadline_priority(
            str(_field(req, "deadline_preliminary_budget", default=""))
        )
        with st.container():
            st.markdown(f'<div class="{css_class}">', unsafe_allow_html=True)
            c1, c2, c3 = st.columns([4, 1, 1])
            company_name = _field(req, "company", default="")
            contact = _field(req, "contact", "contact_name", default="")
            desc = _field(req, "description", default="")
            deadline_txt = _field(req, "deadline_preliminary_budget", default="")

            c1.markdown(f"**{emoji} {company_name}**")
            c1.caption(desc)
            c1.write(f"Contacto: {contact}")
            c1.write(f"Deadline: {deadline_txt} ({days_left} días)")
            c1.write(f"Estado: {_field(req, 'status', default='new')}")

            if c2.button("Procesar", key=f"req_process_{req['id']}", use_container_width=True):
                st.session_state.current_request = req
                st.session_state.offer_mode = "from_request"
                st.rerun()

            if c3.button("Declinar", key=f"req_decline_btn_{req['id']}", use_container_width=True):
                st.session_state[f"declining_{req['id']}"] = True

            if st.session_state.get(f"declining_{req['id']}"):
                reason = st.text_input("Motivo", key=f"req_decline_reason_{req['id']}")
                if st.button("Confirmar declinar", key=f"req_decline_ok_{req['id']}"):
                    if not reason:
                        st.warning("Escribe un motivo")
                    else:
                        supabase.table("customer_requests").update(
                            {"status": "declined", "decline_reason": reason}
                        ).eq("id", req["id"]).execute()
                        st.session_state[f"declining_{req['id']}"] = False
                        st.rerun()

            st.markdown("</div>", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────
# Offer sub-pages
# ──────────────────────────────────────────────────────────────


def page_create_offer_manual() -> None:
    st.subheader("📝 Crear oferta manual")
    with st.form("offer_manual_form"):
        title = st.text_input("Nombre de oferta")
        customer_company = st.text_input("Empresa cliente")
        customer_contact = st.text_input("Contacto")
        description = st.text_area("Descripción")
        valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60)
        submitted = st.form_submit_button("Continuar a cálculo", use_container_width=True)

    if submitted:
        st.session_state.manual_offer_draft = {
            "title": title,
            "company": customer_company,
            "contact": customer_contact,
            "description": description,
            "valid_days": int(valid_days),
        }

    draft = st.session_state.get("manual_offer_draft")
    if draft:
        calc = page_cost_engine_block(default_materials=0.0)
        if st.button("Guardar oferta", use_container_width=True):
            payload = {
                "serial_number": next_offer_serial(),
                "title": draft["title"],
                "description": draft["description"],
                "version": 1,
                "version_group_id": st.session_state.user.id,
                "status_v2": "draft",
                "total_amount": calc["total"],
                "currency": "EUR",
                "cost_breakdown": calc,
                "delivery_terms": {},
                "customer_name": draft["company"],
                "customer_contact": draft["contact"],
                "valid_until": (
                    datetime.now(timezone.utc) + timedelta(days=draft["valid_days"])
                ).date().isoformat(),
                "created_from": "manual",
                "warnings": [],
                "is_deleted": False,
                "offer_data": {},
                "created_by": st.session_state.user.id,
            }
            try:
                create_offer(payload)
                st.success("Oferta creada")
                st.session_state.offer_mode = None
                st.session_state.manual_offer_draft = None
                st.rerun()
            except Exception as exc:
                st.error(f"Error creando oferta: {exc}")


def page_select_request_for_offer() -> None:
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    st.subheader("📥 Seleccionar solicitud")
    rows = safe_execute(
        lambda: supabase.table("customer_requests")
        .select("*")
        .eq("status", "new")
        .order("deadline_preliminary_budget")
        .execute()
        .data or [],
        [],
    )
    if not rows:
        st.info("No hay solicitudes nuevas")
        return
    for req in rows:
        with st.expander(
            f"{_field(req, 'company', default='(sin empresa)')} · {_field(req, 'description', default='')[:90]}"
        ):
            st.write(f"Contacto: {_field(req, 'contact_name', 'contact', default='')}")
            st.write(f"Deadline: {_field(req, 'deadline_preliminary_budget', default='')}")
            if st.button("Usar solicitud", key=f"offer_use_req_{req['id']}"):
                st.session_state.current_request = req
                st.session_state.offer_mode = "from_request"
                st.rerun()


def page_create_offer_from_request() -> None:
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    req = st.session_state.current_request
    if not req:
        st.warning("No hay solicitud seleccionada")
        return

    st.subheader(f"📄 Oferta desde request · {_field(req, 'company', default='')}")
    default_name = f"Oferta para {_field(req, 'company', default='cliente')}"
    title = st.text_input("Nombre oferta", value=default_name)
    description = st.text_area("Descripción", value=str(_field(req, "description", default="")))
    valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60, key="req_valid_days")

    calc = page_cost_engine_block(default_materials=0.0)

    c1, c2 = st.columns(2)
    if c1.button("Crear oferta desde solicitud", use_container_width=True):
        try:
            created = create_offer({
                "serial_number": next_offer_serial(),
                "title": title,
                "description": description,
                "version": 1,
                "version_group_id": st.session_state.user.id,
                "status_v2": "draft",
                "total_amount": calc["total"],
                "currency": "EUR",
                "cost_breakdown": calc,
                "delivery_terms": {},
                "customer_name": _field(req, "company", default=""),
                "customer_contact": _field(req, "contact_name", "contact", default=""),
                "valid_until": (
                    datetime.now(timezone.utc) + timedelta(days=int(valid_days))
                ).date().isoformat(),
                "created_from": "request_pool",
                "warnings": ["filled from request, verify all data"],
                "is_deleted": False,
                "offer_data": {},
                "created_by": st.session_state.user.id,
            })
            if supabase:
                supabase.table("customer_requests").update(
                    {"status": "converted_to_offer", "converted_offer_id": created["id"]}
                ).eq("id", req["id"]).execute()
            st.success("Oferta creada y request actualizada")
            st.session_state.current_request = None
            st.session_state.offer_mode = None
            st.rerun()
        except Exception as exc:
            st.error(f"Error: {exc}")

    if c2.button("Cancelar", use_container_width=True):
        st.session_state.current_request = None
        st.session_state.offer_mode = None
        st.rerun()


def page_upload_offer_document() -> None:
    st.subheader("📎 Subir documento de oferta")
    st.caption("Flujo upload: extracción inicial + revisión humana")

    uploaded = st.file_uploader(
        "Archivo (pdf/docx/xlsx/csv/txt)", type=["pdf", "docx", "xlsx", "csv", "txt"]
    )
    if uploaded is None:
        return

    extracted = {"title": f"Oferta desde {uploaded.name}", "company": "", "contact": "", "description": ""}
    try:
        if uploaded.name.lower().endswith(".csv"):
            df = pd.read_csv(uploaded)
            if not df.empty:
                extracted["description"] = "; ".join(df.columns.tolist())
        elif uploaded.name.lower().endswith(".xlsx"):
            df = pd.read_excel(uploaded, sheet_name=0)
            if not df.empty:
                extracted["description"] = "; ".join(df.columns.tolist())
    except Exception:
        pass

    st.info("Revisa/edita los campos extraídos antes de crear la oferta")
    title = st.text_input("Nombre oferta", value=extracted["title"], key="up_title")
    company = st.text_input("Empresa cliente", value=extracted["company"], key="up_company")
    contact = st.text_input("Contacto", value=extracted["contact"], key="up_contact")
    description = st.text_area("Descripción", value=extracted["description"], key="up_desc")
    valid_days = st.number_input("Validez (días)", min_value=1, max_value=365, value=60, key="up_valid_days")

    calc = page_cost_engine_block(default_materials=0.0)

    if st.button("Crear oferta desde upload", use_container_width=True):
        try:
            create_offer({
                "serial_number": next_offer_serial(),
                "title": title,
                "description": description,
                "version": 1,
                "version_group_id": st.session_state.user.id,
                "status_v2": "draft",
                "total_amount": calc["total"],
                "currency": "EUR",
                "cost_breakdown": calc,
                "delivery_terms": {},
                "customer_name": company,
                "customer_contact": contact,
                "valid_until": (
                    datetime.now(timezone.utc) + timedelta(days=int(valid_days))
                ).date().isoformat(),
                "created_from": "document_upload",
                "warnings": ["source document uploaded", "verify extraction"],
                "is_deleted": False,
                "offer_data": {"source_file": uploaded.name},
                "created_by": st.session_state.user.id,
            })
            st.success("Oferta creada desde documento")
            st.session_state.offer_mode = None
            st.rerun()
        except Exception as exc:
            st.error(f"Error creando oferta: {exc}")


def page_list_offers() -> None:
    st.subheader("Listado de ofertas")
    from infrastructure.supabase_client import get_supabase
    supabase = get_supabase()
    rows = safe_execute(lambda: list_offers(), [])

    if not rows:
        st.info("No hay ofertas")
        return

    for offer in rows[:50]:
        serial = _field(offer, "serial_number", "offer_number", default="OFF-NA")
        title = _field(offer, "title", "name", default="(sin nombre)")
        status = _field(offer, "status_v2", "status", default="draft")
        total = float(_field(offer, "total_amount", "total_price", default=0.0))

        with st.expander(f"{serial} · {title} · {status}"):
            st.write(f"Cliente: {_field(offer, 'customer_name', 'customer_company', default='')}")
            st.write(f"Total: € {total:,.2f}")
            st.write(f"Válida hasta: {_field(offer, 'valid_until', default='')}")
            st.write(f"Versión: {_field(offer, 'version', default=1)}")

            c1, c2, c3 = st.columns(3)
            statuses = ["draft", "in_review", "sent", "negotiated", "accepted", "rejected", "expired", "archived"]
            current_idx = statuses.index(status) if status in statuses else 0
            new_status = c1.selectbox("Estado", statuses, index=current_idx, key=f"off_status_{offer['id']}")
            if new_status != status:
                update_offer_status(offer["id"], new_status)
                st.rerun()

            if c2.button("Nueva versión", key=f"off_version_{offer['id']}", use_container_width=True):
                try:
                    new_payload = dict(offer)
                    for remove_key in ["id", "created_at", "updated_at"]:
                        new_payload.pop(remove_key, None)
                    new_payload["version"] = int(_field(offer, "version", default=1)) + 1
                    new_payload["serial_number"] = next_offer_serial()
                    new_payload["status_v2"] = "draft"
                    new_payload["created_by"] = st.session_state.user.id
                    create_offer(new_payload)
                    st.success("Versión creada")
                    st.rerun()
                except Exception as exc:
                    st.error(f"No se pudo versionar: {exc}")

            if c3.button("Archivar", key=f"off_archive_{offer['id']}", use_container_width=True):
                archive_offer(offer["id"])
                st.rerun()


def page_offers() -> None:
    st.title("💼 Offer & Pricing")

    # ── Dynamic Pricing recommendations ────────────────────────
    last = st.session_state.get("last_analysis_results") or {}
    dp = last.get("dynamic_pricing") or {}
    if dp and dp.get("status") not in ("error", "timeout", "load_error"):
        rec = dp.get("recommendation", {})
        if rec:
            with st.expander("💲 Recomendaciones de Dynamic Pricing", expanded=True):
                c1, c2, c3 = st.columns(3)
                c1.metric("Precio recomendado", f"€ {rec.get('price', 0):,.0f}")
                c2.metric("Estrategia", rec.get("strategy", "—"))
                c3.metric("Confianza", f"{rec.get('confidence', 0):.0%}")
                if rec.get("justification"):
                    st.caption(rec["justification"])
                all_strats = dp.get("all_strategies", [])
                if all_strats:
                    st.dataframe(pd.DataFrame(all_strats), use_container_width=True)
        elif dp.get("output"):
            with st.expander("💲 Dynamic Pricing"):
                st.markdown(dp["output"])

    if not SUPABASE_CONFIGURED:
        st.warning("Funcionalidad completa requiere Supabase.")
        st.subheader("💰 Calculadora de costes (modo demo)")
        page_cost_engine_block()
        st.divider()
        _render_orchestrator_panel(action="offer_pricing")
        return

    m1, m2, m3 = st.columns(3)
    if m1.button("📝 Crear manual", use_container_width=True):
        st.session_state.offer_mode = "manual"
    if m2.button("📥 Desde request", use_container_width=True):
        st.session_state.offer_mode = "from_request_select"
    if m3.button("📎 Upload", use_container_width=True):
        st.session_state.offer_mode = "upload"

    mode = st.session_state.get("offer_mode")
    if mode == "manual":
        page_create_offer_manual()
    elif mode == "from_request_select":
        page_select_request_for_offer()
    elif mode == "from_request":
        page_create_offer_from_request()
    elif mode == "upload":
        page_upload_offer_document()
    else:
        page_list_offers()

    st.divider()
    _render_orchestrator_panel(action="offer_pricing")
