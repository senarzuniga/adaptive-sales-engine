import json
from typing import Any, Dict, List, Optional

import streamlit as st

from infrastructure import enterprise_store
from scripts import review_manager, ingestion_db


st.set_page_config(page_title="Ingestion Review Panel", layout="wide")
st.title("Ingestion Review — Review & Promote Candidates")

with st.sidebar:
    st.header("Reviewer & Enterprise")
    reviewer = st.text_input("Reviewer name", value="ingecart_reviewer")
    # Ensure canonical Ingecart exists
    companies = enterprise_store.list_companies()
    if not companies:
        enterprise_store.ensure_canonical_ingecart()
        companies = enterprise_store.list_companies()

    options = [f"{c.get('commercial_name')} ({c.get('legal_name')})" for c in companies]
    default_idx = 0
    for i, c in enumerate(companies):
        if c.get('commercial_name', '').lower() == 'inge cart' or c.get('commercial_name','').lower() == 'ingecart':
            default_idx = i
            break

    selected = st.selectbox("Select enterprise", options=options, index=default_idx)
    selected_idx = options.index(selected)
    selected_company = companies[selected_idx]
    st.write(selected_company.get('commercial_name'), "/", selected_company.get('legal_name'))

    st.markdown("---")
    st.header("Filters")
    # upload batches for this enterprise
    file_rows = [r for r in ingestion_db.fetch_all('file_ingestions', limit=500) if r.get('enterprise_id') == selected_company.get('id')]
    batches = sorted({r.get('upload_batch') or '' for r in file_rows})
    batch = st.selectbox("Upload batch", options=["(all)"] + batches)
    # object types
    candidates_all = ingestion_db.fetch_all('candidate_structured_data', limit=500)
    types = sorted({c.get('entity_type') or 'unknown' for c in candidates_all if (not selected_company.get('id') or c.get('enterprise_id') == selected_company.get('id'))})
    obj_type = st.selectbox("Object type", options=["(all)"] + types)
    status = st.selectbox("Review status", options=["(all)", "pending", "approved", "rejected"])    

st.markdown("---")

st.subheader("Candidates")

enterprise_id = selected_company.get('id')
batch_filter = None if batch == "(all)" else batch
entity_type_filter = None if obj_type == "(all)" else obj_type

candidates = review_manager.list_candidates(enterprise_id=enterprise_id, upload_batch=batch_filter, entity_type=entity_type_filter, limit=500)
if status != "(all)":
    filtered = []
    for c in candidates:
        ra = c.get('review_action')
        stt = 'pending' if not ra else ('approved' if ra and ra.startswith('APPROVE') else ('rejected' if ra == 'REJECT' else 'pending'))
        if stt == status:
            filtered.append(c)
    candidates = filtered

if not candidates:
    st.info("No candidates found for the selected filters.")
else:
    st.write(f"{len(candidates)} candidates")
    for c in candidates:
        cid = c.get('candidate_id')
        header = f"{c.get('title') or cid} — {c.get('entity_type')}"
        with st.expander(header, expanded=False):
            cols = st.columns([2, 1, 1, 1])
            cols[0].write("**Source / Provenance**")
            cols[0].write({
                "enterprise": c.get('enterprise_id'),
                "upload_batch": c.get('upload_batch'),
                "file_name": c.get('file_name'),
                "ingestion_created_at": c.get('ingestion_created_at'),
                "uploader": c.get('uploader'),
                "classification": c.get('classification'),
            })
            cols[1].write("**Confidence**")
            cols[1].metric("confidence", c.get('confidence') or "n/a")
            cols[2].write("**Review**")
            cols[2].write(c.get('review_action') or "pending")
            cols[3].write("**Actions**")

            details = review_manager.get_candidate_details(cid)
            st.markdown("**Candidate payload**")
            st.json(details.get('candidate').get('payload'))

            st.markdown("**Extraction / Normalization / Context**")
            if details.get('file_ingestion'):
                st.write("File ingestion:")
                st.json(details.get('file_ingestion'))
            if details.get('raw_extracts'):
                st.write("Raw extract (first block):")
                st.text(details.get('raw_extracts')[0].get('extracted_text')[:1000])
            if details.get('normalized'):
                st.write("Normalized:")
                st.json(details.get('normalized'))
            if details.get('contextual'):
                st.write("Contextualized:")
                st.json(details.get('contextual'))
            if details.get('fact_check_reports'):
                st.write("Fact checks:")
                st.json(details.get('fact_check_reports'))

            st.markdown("---")
            # Promotion controls
            col1, col2, col3 = st.columns(3)
            if col1.button("Approve → Create New", key=f"approve_new_{cid}"):
                res = review_manager.promote_candidate(cid, reviewer, "APPROVE_NEW")
                st.success(f"Promoted to final_structured_data (id={res.get('resulting_final_id')})")
                st.experimental_rerun()

            # Approve update existing
            final_objs = ingestion_db.fetch_all('final_structured_data', limit=500)
            final_opts = [f"{f.get('id')} · {json.loads(f.get('payload') if isinstance(f.get('payload'), str) else '{}').get('title','')[:40]}" for f in final_objs if f.get('enterprise_id') == enterprise_id]
            if final_opts:
                sel = col2.selectbox("Select existing to update/merge", options=["(none)"] + final_opts, key=f"sel_final_{cid}")
                if sel and sel != "(none)":
                    existing_id = sel.split(' ')[0]
                    override = col2.text_area("Fields override (JSON)", value=json.dumps(details.get('candidate').get('payload') or {}, indent=2), key=f"override_{cid}", height=120)
                    if col2.button("Approve → Update existing", key=f"approve_update_{cid}"):
                        try:
                            override_obj = json.loads(override) if override else None
                        except Exception:
                            st.error("Override JSON invalid")
                            override_obj = None
                        res = review_manager.promote_candidate(cid, reviewer, "APPROVE_UPDATE_EXISTING", linked_existing_entity_id=existing_id, fields_override=override_obj)
                        st.success(f"Updated existing final_structured_data (id={res.get('resulting_final_id')})")
                        st.experimental_rerun()
                    if col2.button("Approve → Merge into existing", key=f"approve_merge_{cid}"):
                        res = review_manager.promote_candidate(cid, reviewer, "APPROVE_MERGE", linked_existing_entity_id=existing_id)
                        st.success(f"Merged into final_structured_data (id={res.get('resulting_final_id')})")
                        st.experimental_rerun()

            # Reject / keep pending / request recheck
            reason = col3.text_area("Reason / notes", key=f"reason_{cid}", height=80)
            if col3.button("Reject", key=f"reject_{cid}"):
                review_manager.reject_candidate(cid, reviewer, reason=reason)
                st.warning("Candidate rejected")
                st.experimental_rerun()
            if col3.button("Keep pending", key=f"keep_{cid}"):
                review_manager.keep_pending(cid, reviewer, reason=reason)
                st.info("Kept pending")
                st.experimental_rerun()
            if col3.button("Request recheck", key=f"recheck_{cid}"):
                review_manager.request_recheck(cid, reviewer, reason=reason)
                st.info("Recheck requested")
                st.experimental_rerun()

            st.markdown("---")
            # Create action from gap
            with st.form(f"action_form_{cid}"):
                st.write("Create follow-up action")
                act_type = st.selectbox("Action type", options=["task", "call", "meeting", "follow_up"], key=f"atype_{cid}")
                owner = st.text_input("Owner", value=reviewer, key=f"owner_{cid}")
                due = st.text_input("Due date (optional)", key=f"due_{cid}")
                comments = st.text_area("Comments", key=f"comments_{cid}")
                submitted = st.form_submit_button("Create action")
                if submitted:
                    res = review_manager.create_action_from_gap(cid, reviewer, act_type, owner, due_date=due, comments=comments)
                    st.success("Action created and review recorded")
                    st.experimental_rerun()
