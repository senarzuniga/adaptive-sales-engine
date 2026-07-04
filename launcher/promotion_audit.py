import json
from typing import Any, Dict, List, Optional

import streamlit as st

from infrastructure import enterprise_store
from scripts import review_manager, ingestion_db


st.set_page_config(page_title="Promotion Audit — Compact View", layout="wide")
st.title("Promotion Audit — Compact View")

with st.sidebar:
    st.header("Context & Filters")
    # Ensure canonical Ingecart exists
    companies = enterprise_store.list_companies()
    if not companies:
        enterprise_store.ensure_canonical_ingecart()
        companies = enterprise_store.list_companies()

    # Default to canonical Ingecart
    default_idx = 0
    for i, c in enumerate(companies):
        name = (c.get('commercial_name') or '').lower()
        legal = (c.get('legal_name') or '').lower()
        if 'ingecart' in name or 'ingecart' in legal:
            default_idx = i
            break

    company_options = [f"{c.get('commercial_name')} ({c.get('id')})" for c in companies]
    selected = st.selectbox("Enterprise", options=company_options, index=default_idx)
    selected_idx = company_options.index(selected)
    selected_company = companies[selected_idx]
    enterprise_id = selected_company.get('id')

    st.markdown("---")
    # Gather filter values
    file_rows = ingestion_db.fetch_all('file_ingestions', limit=2000)
    batches = sorted({r.get('upload_batch') or '' for r in file_rows if r.get('enterprise_id') == enterprise_id})
    batch = st.selectbox("Upload batch", options=["(all)"] + batches)

    candidates_all = ingestion_db.fetch_all('candidate_structured_data', limit=2000)
    types = sorted({c.get('entity_type') or 'unknown' for c in candidates_all if c.get('enterprise_id') == enterprise_id})
    obj_type = st.selectbox("Object type", options=["(all)"] + types)

    status = st.selectbox("Review status", options=["(all)", "APPROVED_NEW", "APPROVED_UPDATE_EXISTING", "APPROVED_MERGE", "REJECTED", "PENDING", "BLOCKED"])    
    duplicate = st.selectbox("Duplicate/Merge outcome", options=["(any)", "created_new", "updated_existing", "merged_existing", "none"]) 
    search = st.text_input("Search candidate id / file / title", value="")

st.markdown("---")

st.write(f"Showing promotions for enterprise: **{selected_company.get('commercial_name')}** — `{enterprise_id}`")

# Fetch candidate listing from review manager (includes review_action preview)
batch_filter = None if batch == "(all)" else batch
entity_filter = None if obj_type == "(all)" else obj_type
candidates = review_manager.list_candidates(enterprise_id=enterprise_id, upload_batch=batch_filter, entity_type=entity_filter, limit=2000)

# Fetch latest review decisions and final objects to join
decisions = ingestion_db.fetch_all('review_decisions', limit=5000)
dec_by_candidate = {}
for d in decisions:
    cid = d.get('candidate_id')
    if not cid:
        continue
    # keep latest by timestamp if present
    prev = dec_by_candidate.get(cid)
    if not prev:
        dec_by_candidate[cid] = d
    else:
        if d.get('timestamp', '') > prev.get('timestamp', ''):
            dec_by_candidate[cid] = d

finals = ingestion_db.fetch_all('final_structured_data', limit=5000)
final_by_id = {f.get('id'): f for f in finals}

# Build compact rows
rows: List[Dict[str, Any]] = []
for c in candidates:
    cid = c.get('candidate_id')
    if search and search.lower() not in (json.dumps(c).lower()):
        continue
    d = dec_by_candidate.get(cid)
    action = d.get('review_action') if d else (c.get('review_action') or None)
    status_label = action or 'PENDING'
    # map to compact outcome
    outcome = 'none'
    resulting_final = None
    reviewer = None
    review_ts = None
    linked_existing = None
    if d:
        resulting_final = d.get('resulting_final_id')
        reviewer = d.get('reviewer')
        review_ts = d.get('timestamp')
        linked_existing = d.get('linked_existing_entity_id')
        if action == 'APPROVE_NEW':
            outcome = 'created_new'
        elif action == 'APPROVE_UPDATE_EXISTING':
            outcome = 'updated_existing'
        elif action == 'APPROVE_MERGE':
            outcome = 'merged_existing'
        elif action == 'REJECT' or action == 'REJECTED':
            outcome = 'rejected'
        elif action == 'BLOCKED':
            outcome = 'blocked'

    # quality / provenance
    details = review_manager.get_candidate_details(cid)
    file_ing = details.get('file_ingestion') or {}
    raw = details.get('raw_extracts') or []
    fact_checks = details.get('fact_check_reports') or []
    confidence = c.get('confidence') or (raw[0].get('confidence') if raw else None)
    fact_status = (fact_checks[0].get('status') if fact_checks else None)
    evidence_present = bool(raw)
    blocked_reason = d.get('reason') if d and (d.get('review_action') in ('BLOCKED','REJECT')) else ''

    row = {
        'enterprise': f"{selected_company.get('commercial_name')} ({enterprise_id})",
        'candidate_id': cid,
        'object_type': c.get('entity_type'),
        'upload_batch': c.get('upload_batch'),
        'file_name': file_ing.get('file_name') or c.get('file_name') or '',
        'ingestion_ts': c.get('ingestion_created_at') or file_ing.get('created_at'),
        'status': status_label,
        'final_id': resulting_final,
        'action': action,
        'outcome': outcome,
        'linked_existing': linked_existing,
        'reviewer': reviewer,
        'review_ts': review_ts,
        'confidence': confidence,
        'fact_check_status': fact_status,
        'evidence_present': evidence_present,
        'blocked_reason': blocked_reason,
    }

    # apply additional filters
    if status != "(all)" and status != row['status']:
        continue
    if duplicate != "(any)":
        if duplicate == 'none' and row['outcome'] != 'none':
            continue
        if duplicate == 'created_new' and row['outcome'] != 'created_new':
            continue
        if duplicate == 'updated_existing' and row['outcome'] != 'updated_existing':
            continue
        if duplicate == 'merged_existing' and row['outcome'] != 'merged_existing':
            continue

    rows.append(row)

# Show counts and compact table
st.markdown(f"**Candidates shown:** {len(rows)} (filtered)")

try:
    import pandas as pd

    df = pd.DataFrame(rows)
    # format columns
    if not df.empty:
        df = df[['enterprise','candidate_id','object_type','upload_batch','file_name','ingestion_ts','status','outcome','final_id','linked_existing','reviewer','review_ts','confidence','fact_check_status','evidence_present','blocked_reason']]
    st.dataframe(df)
except Exception:
    st.table(rows)

st.markdown('---')
st.subheader('Inspect candidate provenance')
sel = st.selectbox('Select candidate to inspect', options=[r.get('candidate_id') for r in rows] + [None])
if sel:
    st.write('Candidate ID:', sel)
    prov = review_manager.get_candidate_details(sel)
    dec = dec_by_candidate.get(sel)
    final = final_by_id.get(dec.get('resulting_final_id')) if dec else None

    with st.expander('Provenance JSON', expanded=True):
        st.json({
            'candidate': prov.get('candidate'),
            'file_ingestion': prov.get('file_ingestion'),
            'raw_extracts_count': len(prov.get('raw_extracts') or []),
            'normalized': prov.get('normalized'),
            'contextualized': prov.get('contextual'),
            'fact_checks': prov.get('fact_check_reports'),
            'latest_review_decision': dec,
            'final_structured_data': final,
        })

    st.markdown('**Quick links**')
    if prov.get('file_ingestion'):
        st.write('File path:', prov.get('file_ingestion').get('file_path'))
        st.write('Ingestion id:', prov.get('file_ingestion').get('id'))
    if prov.get('raw_extracts'):
        st.write('Raw extract sample:')
        st.text((prov.get('raw_extracts')[0].get('extracted_text') or '')[:1000])
