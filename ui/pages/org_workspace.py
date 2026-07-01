"""Organization Workspace — Intelligence Reports explorer for an organization.

This page exposes the ingestion reports produced under
`Architecture/EnterpriseHub/ingestion_reports/<org_id>` and enables
lightweight in-platform annotations and linking to internal entities.

Requirements implemented:
- Load Markdown reports from the organization's reports folder
- Explorer UI with categories and internal search
- Search inside a report and create "insights" (annotations)
- Link insights to `task`, `lead`, `risk`, `opportunity` (minimal)
- Persist annotations to `annotations.json` next to the reports (internal only)

IMPORTANT: Reports are treated as internal inputs and are not exported.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import streamlit as st

from config import APP_ROOT, SUPABASE_CONFIGURED
from ui.components import _render_orchestrator_panel  # noqa: E402


def _load_registry() -> Dict:
    reg_path = APP_ROOT / "Architecture" / "EnterpriseHub" / "enterprise_registry.yaml"
    if not reg_path.exists():
        return {}
    try:
        import yaml

        return yaml.safe_load(reg_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _reports_dir_for_org(org_id: str) -> Path:
    return APP_ROOT / "Architecture" / "EnterpriseHub" / "ingestion_reports" / org_id


def _load_markdown_files(reports_dir: Path) -> List[Path]:
    if not reports_dir.exists():
        return []
    return sorted([p for p in reports_dir.iterdir() if p.suffix.lower() == ".md"], key=lambda p: p.stat().st_mtime, reverse=True)


def _categorize(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ("inventory", "onboarding", "ingestion", "knowledge_index", "knowledge_coverage")):
        return "Ingestion"
    if any(k in n for k in ("executive", "coverage", "knowledge", "crm")):
        return "CRM"
    if any(k in n for k in ("data_quality", "architecture_compliance", "duplicates", "risk")):
        return "Risk"
    if any(k in n for k in ("operational_readiness", "ai_readiness", "operational")):
        return "Operations"
    if "stress" in n:
        return "Stress Test"
    return "Other"


def _annotations_path(reports_dir: Path) -> Path:
    return reports_dir / "annotations.json"


def _load_annotations(reports_dir: Path) -> List[Dict]:
    ap = _annotations_path(reports_dir)
    if not ap.exists():
        return []
    try:
        return json.loads(ap.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_annotations(reports_dir: Path, notes: List[Dict]) -> None:
    ap = _annotations_path(reports_dir)
    ap.write_text(json.dumps(notes, indent=2, ensure_ascii=False), encoding="utf-8")


def _create_annotation(reports_dir: Path, file_path: str, snippet: str, importance: str, link_type: str, link_ref: str, created_by: str) -> Dict:
    notes = _load_annotations(reports_dir)
    ann = {
        "id": str(uuid.uuid4()),
        "file": file_path,
        "snippet": snippet,
        "importance": importance,
        "link_type": link_type,
        "link_ref": link_ref,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    notes.append(ann)
    _save_annotations(reports_dir, notes)
    return ann


def _entities_path(reports_dir: Path) -> Path:
    return reports_dir / "entities.json"


def _load_entities(reports_dir: Path) -> Dict[str, List[Dict]]:
    p = _entities_path(reports_dir)
    if not p.exists():
        return {"leads": [], "opportunities": [], "products": [], "projects": [], "marketing": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"leads": [], "opportunities": [], "products": [], "projects": [], "marketing": []}


def _save_entities(reports_dir: Path, data: Dict[str, List[Dict]]) -> None:
    p = _entities_path(reports_dir)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _create_entity_local(reports_dir: Path, kind: str, payload: Dict) -> Dict:
    data = _load_entities(reports_dir)
    data.setdefault(kind + "s" if not kind.endswith("s") else kind, [])
    lst = data.get(kind + "s" if not kind.endswith("s") else kind)
    lst.append(payload)
    _save_entities(reports_dir, data)
    return payload


def _create_entity_supabase(kind: str, payload: Dict) -> Dict:
    """Try to insert into Supabase table for the given kind. Returns dict with 'id' on success."""
    table_map = {
        "lead": "leads",
        "opportunity": "opportunities",
        "product": "products",
        "project": "projects",
        "marketing": "marketing_contents",
    }
    tbl = table_map.get(kind)
    if not tbl:
        raise ValueError("Unknown entity kind")
    from infrastructure.supabase_client import get_supabase

    sb = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    payload.setdefault("created_at", now_iso)
    payload.setdefault("last_modified", now_iso)
    res = sb.table(tbl).insert(payload).execute()
    try:
        if getattr(res, "data", None) and isinstance(res.data, list) and res.data:
            return res.data[0]
    except Exception:
        pass
    raise RuntimeError("Supabase insert did not return inserted row")


def page_org_workspace() -> None:
    st.title("🏢 Organization Workspace — Intelligence Reports")

    reg = _load_registry()
    orgs = reg.get("organizations", []) or []

    active = st.session_state.get("active_organization")
    active_id = None
    if active:
        # active may be a dict set by Organization Manager
        active_id = active.get("id") if isinstance(active, dict) else str(active)

    # Allow selection if none active
    if not active_id:
        st.info("Selecciona una organización desde Organization Manager o elige una aquí:")
        ids = [o.get("id") for o in orgs]
        chosen = st.selectbox("Organización", ["(ninguna)"] + ids, index=0)
        if chosen and chosen != "(ninguna)":
            sel = next((o for o in orgs if o.get("id") == chosen), None)
            if sel:
                st.session_state["active_organization"] = sel
                st.rerun()
        return

    org_id = active_id
    org_name = (active.get("name") if isinstance(active, dict) else org_id) or org_id

    reports_dir = _reports_dir_for_org(org_id)

    st.markdown(f"**Organización activa:** **{org_name}** — `{org_id}`")
    st.divider()

    md_files = _load_markdown_files(reports_dir)
    if not md_files:
        st.warning("No se encontraron informes Markdown para esta organización.")
        return

    # Build categories
    categories = {}
    for p in md_files:
        cat = _categorize(p.name)
        categories.setdefault(cat, []).append(p)

    left, right = st.columns([1, 3])

    with left:
        st.subheader("Explorer")
        q = st.text_input("Buscar en informes (títulos y contenido)" , key="org_reports_global_search")

        chosen_cat = st.selectbox("Categoría", sorted(list(categories.keys())), index=0)

        # filter file list by global query
        files_to_show = categories.get(chosen_cat, [])
        if q:
            ql = q.lower()
            files_to_show = [p for p in files_to_show if ql in p.name.lower() or ql in p.read_text(encoding="utf-8", errors="ignore").lower()]

        st.markdown(f"**{len(files_to_show)}** archivos en categoría *{chosen_cat}*")
        for p in files_to_show:
            mtime = datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()
            if st.button(f"{p.name}  — {mtime}", key=f"open_report_{p.name}"):
                st.session_state["selected_org_report"] = str(p)
                st.session_state["selected_org_report_name"] = p.name
                st.rerun()

        st.divider()
        st.subheader("Insights guardados")
        notes = _load_annotations(reports_dir)
        if notes:
            for n in sorted(notes, key=lambda x: x.get("created_at"), reverse=True)[:50]:
                st.markdown(f"- **{n.get('importance')}** — {n.get('snippet')[:120]} — _{n.get('link_type')}_")
        else:
            st.info("No hay insights guardados aún.")

    with right:
        sel = st.session_state.get("selected_org_report")
        if not sel:
            st.info("Selecciona un informe en el explorador para verlo aquí.")
            return

        p = Path(sel)
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            st.error(f"No se pudo leer el informe: {exc}")
            return

        st.subheader(p.name)
        st.markdown(content)

        st.divider()
        st.subheader("Buscar dentro del informe")
        q_in = st.text_input("Texto a buscar en este informe", key="org_report_search_in_file")
        matches: List[str] = []
        if q_in:
            ql = q_in.lower()
            idx = 0
            while True:
                idx = content.lower().find(ql, idx)
                if idx == -1:
                    break
                start = max(0, idx - 120)
                excerpt = content[start : start + 400].replace("\n", " ")
                matches.append(excerpt)
                idx += len(ql)

        if matches:
            st.info(f"{len(matches)} coincidencias encontradas")
            for i, m in enumerate(matches[:50]):
                st.markdown(f"**Coincidencia {i+1}**: {m}")
                if st.button(f"Marcar insight {i+1}", key=f"mark_insight_{i}"):
                    # prefill annotation form with this snippet
                    st.session_state["org_insight_prefill"] = m
                    st.rerun()

        st.divider()
        st.subheader("Crear insight manualmente")
        pre = st.session_state.get("org_insight_prefill", "")
        snippet = st.text_area("Texto insight (resumen o cita)", value=pre, height=120, key="org_insight_snippet")
        importance = st.selectbox("Importancia", ["High", "Medium", "Low"], index=1, key="org_insight_importance")
        link_type = st.selectbox("Vincular a", ["none", "task", "lead", "risk", "opportunity"], index=0, key="org_insight_link_type")
        link_ref = st.text_input("Referencia de entidad (ID, nombre, email) — opcional", key="org_insight_link_ref")
        create_task = st.checkbox("Crear tarea interna (si eliges 'task')", value=False, key="org_insight_create_task")

        if st.button("Guardar insight", key="org_insight_save"):
            if not snippet.strip():
                st.error("El texto del insight no puede estar vacío")
            else:
                created_by = (st.session_state.get("profile") or {}).get("email", "system")
                ann = _create_annotation(reports_dir, str(p.name), snippet.strip(), importance, link_type, link_ref, created_by)
                st.success("Insight guardado internamente")
                # Optionally create a task in Supabase
                if create_task and link_type == "task":
                    if SUPABASE_CONFIGURED:
                        try:
                            from infrastructure.supabase_client import get_supabase

                            sb = get_supabase()
                            now_iso = datetime.now(timezone.utc).isoformat()
                            payload = {
                                "name": f"Insight: {snippet.strip()[:80]}",
                                "goal": snippet.strip()[:400],
                                "description": snippet.strip(),
                                "assigned_to": (st.session_state.get("profile") or {}).get("email", ""),
                                "status": "open",
                                "importance_score": 75,
                                "strategy_alignment": 50,
                                "estimated_hours": 1.0,
                                "supportive_content": {"source_report": p.name, "annotation_id": ann.get("id")},
                                "created_by": (st.session_state.get("profile") or {}).get("id", "system"),
                                "created_at": now_iso,
                                "last_modified": now_iso,
                            }
                            res = sb.table("actions").insert(payload).execute()
                            action_id = None
                            try:
                                action_id = res.data[0].get("id") if res and getattr(res, "data", None) else None
                            except Exception:
                                action_id = None
                            if action_id:
                                # update annotation with created link_ref
                                notes = _load_annotations(reports_dir)
                                for n in notes:
                                    if n.get("id") == ann.get("id"):
                                        n["link_type"] = "task"
                                        n["link_ref"] = str(action_id)
                                _save_annotations(reports_dir, notes)
                                st.success(f"Tarea interna creada (id={action_id}) y vinculada al insight")
                            else:
                                st.warning("No se devolvió ID de tarea; revisa la tabla 'actions' en Supabase")
                        except Exception as exc:
                            st.error(f"No se pudo crear la tarea en Supabase: {exc}")
                    else:
                        st.warning("Supabase no configurado: la tarea se guarda solo como referencia local")

                # Create other entity types if requested
                if link_type in ("lead", "opportunity", "product", "project", "marketing"):
                    payload = {
                        "name": link_ref or snippet.strip()[:120],
                        "description": snippet.strip(),
                        "source_report": p.name,
                        "annotation_id": ann.get("id"),
                        "created_by": (st.session_state.get("profile") or {}).get("email", "system"),
                    }
                    if SUPABASE_CONFIGURED:
                        try:
                            created = _create_entity_supabase(link_type, payload)
                            # update annotation with link_ref
                            notes = _load_annotations(reports_dir)
                            for n in notes:
                                if n.get("id") == ann.get("id"):
                                    n["link_type"] = link_type
                                    # try best-effort to get id field
                                    ref_id = created.get("id") or created.get("uuid") or created.get("pk") or ""
                                    n["link_ref"] = str(ref_id)
                            _save_annotations(reports_dir, notes)
                            st.success(f"{link_type.title()} creado en Supabase y vinculado (id={ref_id})")
                        except Exception as exc:
                            st.warning(f"No se pudo crear {link_type} en Supabase: {exc}. Guardando localmente.")
                            _create_entity_local(reports_dir, link_type, payload)
                    else:
                        _create_entity_local(reports_dir, link_type, payload)

        st.divider()
        st.subheader("Insights para este informe")
        notes = _load_annotations(reports_dir)
        my_notes = [n for n in notes if n.get("file") == p.name]
        if my_notes:
            for n in sorted(my_notes, key=lambda x: x.get("created_at"), reverse=True):
                st.markdown(f"- **{n.get('importance')}** — {n.get('snippet')[:200]} — _{n.get('link_type')}: {n.get('link_ref')}_ — {n.get('created_by')}")
        else:
            st.info("No hay insights para este informe todavía.")

        # --- Entities management and project/marketing scan ---
        st.divider()
        st.subheader("Ecosistema: leads, opportunities, products, projects, marketing")
        cols = st.columns([2, 1])
        with cols[0]:
            st.markdown("**Explorar entidades**")
            tab = st.radio("Tipo", ["Leads", "Opportunities", "Products", "Projects", "Marketing"], index=0, horizontal=True)
            kind_map = {"Leads": "lead", "Opportunities": "opportunity", "Products": "product", "Projects": "project", "Marketing": "marketing"}
            kind = kind_map.get(tab)
            # Fetch entities
            entities = []
            if SUPABASE_CONFIGURED:
                try:
                    from infrastructure.supabase_client import get_supabase

                    sb = get_supabase()
                    table_name = {
                        "lead": "leads",
                        "opportunity": "opportunities",
                        "product": "products",
                        "project": "projects",
                        "marketing": "marketing_contents",
                    }.get(kind)
                    if table_name:
                        rows = sb.table(table_name).select("*").order("created_at", desc=True).execute().data or []
                        entities = rows
                except Exception:
                    entities = []
            if not entities:
                # fallback local
                local = _load_entities(reports_dir)
                entities = local.get(kind + "s" if not kind.endswith("s") else kind, [])
            st.markdown(f"**{len(entities)}** encontrados")
            if entities:
                try:
                    import pandas as pd

                    df = pd.DataFrame(entities)
                    st.dataframe(df.head(200), use_container_width=True)
                except Exception:
                    for e in entities[:200]:
                        st.write(e)

        with cols[1]:
            st.markdown("**Importar desde carpeta local**")
            default_proj = r"C:\Users\Inaki Senar\Documents\INGECART\COMMERCIAL\PROYECTOS"
            proj_path = st.text_input("Carpeta Proyectos (local)", value=default_proj, key="org_proj_path")
            if st.button("Escanear proyectos locales", key="scan_projects"):
                ppath = Path(proj_path)
                if not ppath.exists():
                    st.error("Carpeta no encontrada")
                else:
                    found = []
                    for d in sorted([x for x in ppath.iterdir() if x.is_dir()], key=lambda x: x.name):
                        found.append({"name": d.name, "path": str(d), "files": len(list(d.rglob("*.*")))})
                    if found:
                        st.success(f"{len(found)} proyectos encontrados")
                        st.dataframe(found)
                        if st.button("Importar proyectos a entities (local/Supabase)", key="import_projects"):
                            for fproj in found:
                                payload = {"name": fproj["name"], "description": f"Imported from {fproj['path']}", "source_report": p.name}
                                if SUPABASE_CONFIGURED:
                                    try:
                                        _create_entity_supabase("project", payload)
                                    except Exception:
                                        _create_entity_local(reports_dir, "project", payload)
                                else:
                                    _create_entity_local(reports_dir, "project", payload)
                            st.success("Import completed")
                    else:
                        st.info("No se encontraron subcarpetas en la ruta especificada")

        st.divider()
        st.subheader("Scan marketing contents (opcional)")
        default_mark = r"C:\Users\Inaki Senar\Documents\INGECART\COMMERCIAL\MARKETING"
        mark_path = st.text_input("Carpeta Marketing (local)", value=default_mark, key="org_mark_path")
        if st.button("Escanear marketing locales", key="scan_marketing"):
            mpath = Path(mark_path)
            if not mpath.exists():
                st.error("Carpeta no encontrada")
            else:
                found = []
                for fitem in sorted([x for x in mpath.rglob("*.*") if x.is_file()], key=lambda x: x.suffix):
                    found.append({"name": fitem.name, "path": str(fitem), "size": fitem.stat().st_size})
                st.markdown(f"{len(found)} contenidos encontrados")
                if found:
                    st.dataframe(found[:200])
                    if st.button("Importar marketing a entities", key="import_marketing"):
                        for fin in found:
                            payload = {"name": fin["name"], "description": f"Imported from {fin['path']}", "source_report": p.name}
                            if SUPABASE_CONFIGURED:
                                try:
                                    _create_entity_supabase("marketing", payload)
                                except Exception:
                                    _create_entity_local(reports_dir, "marketing", payload)
                            else:
                                _create_entity_local(reports_dir, "marketing", payload)
                        st.success("Import marketing completed")

        st.divider()
        st.subheader("Ecosystem: lanzar agentes y capacidades")
        st.markdown("Ejecuta todos los agentes para poblar acciones, oportunidades y actualizar el workspace con datos fresh.")
        _render_orchestrator_panel(action="org_workspace", button_label="🚀 Lanzar capacidades y agentes (ALL)")
