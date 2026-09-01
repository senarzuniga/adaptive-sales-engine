"""
Company service for Streamlit UI flows.

This service keeps demo-company lifecycle, local persistence and pack loading
out of page modules.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from application.services.company_packs import (
    PACKS_RELATIVE_DIR,
    build_company_record_from_pack,
    merge_company_records,
    pack_display_label,
    write_demo_packs,
)
from config import APP_ROOT, SUPABASE_CONFIGURED
from infrastructure.supabase_client import get_supabase


COMPANY_TABLE_FIELDS = {
    "company_name",
    "industry",
    "sub_sector",
    "headquarters",
    "operating_regions",
    "employee_count",
    "annual_revenue",
    "main_products",
    "main_customer_segments",
    "main_competitors",
    "sales_team_size",
    "kam_count",
    "sales_channels",
    "current_challenges",
    "strategic_goals",
    "additional_notes",
}

DATAFRAME_PACK_MAPPING = {
    "orders": "uploaded_data_universal",
    "products": "productos_data",
    "opportunities": "oportunidades_data",
    "strategy": "estrategia_data",
    "leads": "leads_data",
    "contacts": "contacts_data",
    "tasks": "tasks_data",
}

WORKSPACE_TABLE_KEYS = [
    "company_contacts",
    "social_media_accounts",
    "marketing_content",
    "business_intelligence_reports",
    "cost_rates",
    "offers",
    "offer_items",
    "cost_breakdowns",
    "offer_scenarios",
    "offer_scores",
    "installed_base_assets",
    "service_contracts",
    "after_sales_opportunities",
    "spare_parts",
]

SUPABASE_WORKSPACE_TABLES = [
    "company_contacts",
    "social_media_accounts",
    "marketing_content",
    "business_intelligence_reports",
    "cost_rates",
    "offers",
    "installed_base_assets",
    "service_contracts",
    "after_sales_opportunities",
    "spare_parts",
]

WORKSPACE_ROW_EXCLUDE_FIELDS = ("id", "company_id", "created_at", "updated_at")


def _st():
    import streamlit as st

    return st


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _workspace_session_key(table_name: str) -> str:
    return f"workspace_{table_name}"


def _normalize_name(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _current_profile() -> Dict[str, Any]:
    st = _st()
    return st.session_state.get("profile") or {}


def _current_local_auth_email() -> str:
    profile = _current_profile()
    if profile.get("_local_auth"):
        return str(profile.get("email", "")).strip().lower()
    return ""


def _load_local_workspace_companies() -> Dict[str, Any]:
    email = _current_local_auth_email()
    if not email:
        return {}
    try:
        from users_storage import load_workspace

        return load_workspace(email) or {}
    except Exception:
        return {}


def _save_local_workspace_companies() -> None:
    email = _current_local_auth_email()
    if not email:
        return
    st = _st()
    try:
        from users_storage import load_workspace, save_workspace

        workspace = load_workspace(email) or {}
        workspace["saved_companies"] = st.session_state.get("saved_companies", [])
        workspace["active_company"] = st.session_state.get("active_company")
        save_workspace(email, workspace)
    except Exception:
        return


def _load_pack_file(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _list_pack_paths() -> List[Path]:
    pack_root = APP_ROOT / PACKS_RELATIVE_DIR
    if not pack_root.exists():
        return []
    return sorted(path for path in pack_root.glob("*/*_pack.json") if path.is_file())


def _merge_company_list(companies: List[Dict[str, Any]], company: Dict[str, Any]) -> List[Dict[str, Any]]:
    incoming_id = str(company.get("id", "")).strip()
    incoming_key = str(company.get("company_key", "")).strip().lower()
    incoming_name = _normalize_name(company.get("company_name", company.get("name", "")))
    merged: List[Dict[str, Any]] = []
    replaced = False

    for current in companies:
        current_id = str(current.get("id", "")).strip()
        current_key = str(current.get("company_key", "")).strip().lower()
        current_name = _normalize_name(current.get("company_name", current.get("name", "")))
        same_record = bool(
            (incoming_id and current_id and incoming_id == current_id)
            or (incoming_key and current_key and incoming_key == current_key)
            or (incoming_name and current_name and incoming_name == current_name)
        )
        if same_record:
            merged.append(merge_company_records(current, company))
            replaced = True
        else:
            merged.append(current)

    if not replaced:
        merged.append(company)
    return merged


def _supabase_core_payload(company: Dict[str, Any]) -> Dict[str, Any]:
    payload = {field: company.get(field, "") for field in COMPANY_TABLE_FIELDS}
    if company.get("id"):
        payload["id"] = company["id"]
    return payload


def _sync_company_to_supabase(company: Dict[str, Any]) -> Dict[str, Any]:
    if not SUPABASE_CONFIGURED:
        return company

    supabase = get_supabase()
    if supabase is None:
        return company

    payload = _supabase_core_payload(company)
    try:
        company_id = payload.get("id")
        if company_id:
            result = supabase.table("companies").update(payload).eq("id", company_id).execute()
        else:
            result = supabase.table("companies").insert(payload).execute()
        rows = result.data or []
        if rows:
            synced = dict(company)
            synced["id"] = rows[0].get("id", company.get("id"))
            return synced
    except Exception:
        return company
    return company


def _load_supabase_companies() -> List[Dict[str, Any]]:
    if not SUPABASE_CONFIGURED:
        return []
    supabase = get_supabase()
    if supabase is None:
        return []
    try:
        result = supabase.table("companies").select("*").order("company_name").execute()
        return result.data or []
    except Exception:
        return []


def _persist_workspace_to_session(workspace: Dict[str, Any]) -> None:
    st = _st()
    for table_name in WORKSPACE_TABLE_KEYS:
        st.session_state[_workspace_session_key(table_name)] = workspace.get(table_name, []) or []


def _hydrate_workspace_supabase(company_id: str, workspace: Dict[str, Any]) -> None:
    if not SUPABASE_CONFIGURED:
        return
    supabase = get_supabase()
    if supabase is None:
        return
    for table_name in SUPABASE_WORKSPACE_TABLES:
        rows = workspace.get(table_name) or []
        if not isinstance(rows, list) or not rows:
            continue
        payload_rows: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            payload = {k: v for k, v in row.items() if k not in WORKSPACE_ROW_EXCLUDE_FIELDS}
            payload["company_id"] = company_id
            payload_rows.append(payload)
        if not payload_rows:
            continue
        try:
            supabase.table(table_name).insert(payload_rows).execute()
        except Exception:
            continue


def ensure_company_workspace_loaded() -> None:
    st = _st()
    if st.session_state.get("company_workspace_loaded"):
        return

    companies = list(st.session_state.get("saved_companies", []))
    workspace = _load_local_workspace_companies()
    for company in workspace.get("saved_companies", []) or []:
        companies = _merge_company_list(companies, company)

    if not _list_pack_paths():
        write_demo_packs(APP_ROOT)

    for pack_path in _list_pack_paths():
        pack = _load_pack_file(pack_path)
        company = build_company_record_from_pack(pack, str(pack_path))
        companies = _merge_company_list(companies, company)

    for company in _load_supabase_companies():
        companies = _merge_company_list(companies, company)

    companies = sorted(
        companies,
        key=lambda row: (
            0 if row.get("record_stage") == "empresa validada" else 1,
            pack_display_label(row).lower(),
        ),
    )
    st.session_state["saved_companies"] = companies
    st.session_state["company_workspace_loaded"] = True

    active_company = st.session_state.get("active_company")
    if not active_company:
        workspace_active = workspace.get("active_company")
        if workspace_active:
            active_company = workspace_active
        elif companies:
            active_company = companies[0]
    if active_company:
        activate_company(active_company)


def list_companies() -> List[Dict[str, Any]]:
    ensure_company_workspace_loaded()
    st = _st()
    return list(st.session_state.get("saved_companies", []))


def list_pack_manifests() -> List[Dict[str, Any]]:
    ensure_company_workspace_loaded()
    manifests: List[Dict[str, Any]] = []
    for pack_path in _list_pack_paths():
        pack = _load_pack_file(pack_path)
        company = build_company_record_from_pack(pack, str(pack_path))
        manifests.append(
            {
                "company_key": company.get("company_key", ""),
                "company_name": company.get("company_name", ""),
                "record_stage": company.get("record_stage", "demo version"),
                "path": str(pack_path),
                "data_inventory": company.get("data_inventory", {}),
                "source_registry": company.get("source_registry", {}),
            }
        )
    return manifests


def get_company(identifier: str) -> Optional[Dict[str, Any]]:
    key = identifier.strip().lower()
    for company in list_companies():
        if str(company.get("id", "")).strip().lower() == key:
            return company
        if str(company.get("company_key", "")).strip().lower() == key:
            return company
        if _normalize_name(company.get("company_name", company.get("name", ""))) == _normalize_name(identifier):
            return company
    return None


def save_company(company: Dict[str, Any]) -> Dict[str, Any]:
    ensure_company_workspace_loaded()
    st = _st()
    existing = get_company(str(company.get("id") or company.get("company_key") or company.get("company_name", "")))
    merged = merge_company_records(existing or {}, company)
    merged.setdefault("record_stage", "demo version")
    merged.setdefault("validation_status", "ready_for_review")
    merged.setdefault("updated_at", _utcnow_iso())
    if not merged.get("created_at"):
        merged["created_at"] = _utcnow_iso()

    synced = _sync_company_to_supabase(merged)
    st.session_state["saved_companies"] = _merge_company_list(st.session_state.get("saved_companies", []), synced)
    active_company = st.session_state.get("active_company") or {}
    active_id = str(active_company.get("id", "")).strip()
    active_key = str(active_company.get("company_key", "")).strip().lower()
    synced_id = str(synced.get("id", "")).strip()
    synced_key = str(synced.get("company_key", "")).strip().lower()
    if (active_id and synced_id and active_id == synced_id) or (active_key and synced_key and active_key == synced_key):
        activate_company(synced)
    _save_local_workspace_companies()
    return synced


def activate_company(company_or_identifier: Dict[str, Any] | str) -> Optional[Dict[str, Any]]:
    ensure_company_workspace_loaded()
    st = _st()
    company = company_or_identifier if isinstance(company_or_identifier, dict) else get_company(company_or_identifier)
    if not company:
        return None
    st.session_state["active_company"] = company
    st.session_state["company_notes"] = company.get("additional_notes", company.get("notes", ""))
    st.session_state["company_action_queue"] = company.get("recommended_action_queue", []) or []
    st.session_state["company_source_registry"] = company.get("source_registry", {}) or {}
    st.session_state["company_data_inventory"] = company.get("data_inventory", {}) or {}
    _save_local_workspace_companies()
    return company


def validate_company(identifier: str) -> Optional[Dict[str, Any]]:
    company = get_company(identifier)
    if not company:
        return None
    company = dict(company)
    company["record_stage"] = "empresa validada"
    company["validation_status"] = "validated"
    company["validated_at"] = _utcnow_iso()
    return save_company(company)


def delete_company(identifier: str) -> bool:
    ensure_company_workspace_loaded()
    st = _st()
    company = get_company(identifier)
    if not company:
        return False
    remaining: List[Dict[str, Any]] = []
    target_id = str(company.get("id", "")).strip()
    target_key = str(company.get("company_key", "")).strip().lower()
    target_name = _normalize_name(company.get("company_name", company.get("name", "")))
    for current in st.session_state.get("saved_companies", []):
        current_id = str(current.get("id", "")).strip()
        current_key = str(current.get("company_key", "")).strip().lower()
        current_name = _normalize_name(current.get("company_name", current.get("name", "")))
        same = bool(
            (target_id and current_id and target_id == current_id)
            or (target_key and current_key and target_key == current_key)
            or (target_name and current_name == target_name)
        )
        if not same:
            remaining.append(current)
    st.session_state["saved_companies"] = remaining

    active_company = st.session_state.get("active_company") or {}
    if active_company and (
        str(active_company.get("id", "")).strip() == target_id
        or str(active_company.get("company_key", "")).strip().lower() == target_key
    ):
        st.session_state["active_company"] = remaining[0] if remaining else None
        if remaining:
            activate_company(remaining[0])
        else:
            st.session_state["company_notes"] = ""
            st.session_state["company_action_queue"] = []
            st.session_state["company_source_registry"] = {}
            st.session_state["company_data_inventory"] = {}

    if target_id and SUPABASE_CONFIGURED:
        supabase = get_supabase()
        if supabase is not None:
            try:
                supabase.table("companies").delete().eq("id", target_id).execute()
            except Exception:
                pass

    _save_local_workspace_companies()
    return True


def load_company_pack_into_session(identifier: str) -> Optional[Dict[str, Any]]:
    ensure_company_workspace_loaded()
    company = get_company(identifier)
    if not company:
        return None
    pack_file = company.get("pack_file")
    if not pack_file:
        activate_company(company)
        return company

    pack = _load_pack_file(Path(pack_file))
    st = _st()
    for pack_key, session_key in DATAFRAME_PACK_MAPPING.items():
        rows = pack.get(pack_key) or []
        st.session_state[session_key] = pd.DataFrame(rows) if rows else None

    entity_registries = dict(pack.get("entityRegistries") or {})
    source_registry = pack.get("sourceRegistry") or entity_registries.get("sourceRegistry", {})
    entity_registries["sourceRegistry"] = source_registry
    st.session_state["entity_registries"] = entity_registries
    st.session_state["company_action_queue"] = pack.get("recommendedActionQueue") or []
    st.session_state["company_source_registry"] = source_registry
    st.session_state["company_data_inventory"] = company.get("data_inventory", {})

    workspace = pack.get("workspace", {}) or {}
    _persist_workspace_to_session(workspace)
    synced_company = activate_company(company) or company
    company_id = str((synced_company or {}).get("id", "")).strip()
    if company_id:
        _hydrate_workspace_supabase(company_id, workspace)
    return synced_company


def regenerate_demo_company_packs() -> List[str]:
    st = _st()
    written = write_demo_packs(APP_ROOT)
    st.session_state["company_workspace_loaded"] = False
    ensure_company_workspace_loaded()
    _save_local_workspace_companies()
    return [str(path) for path in written]
