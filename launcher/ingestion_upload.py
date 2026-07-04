import os
from pathlib import Path
from typing import List

import streamlit as st

from infrastructure import enterprise_store
from scripts import ingest_pipeline


st.set_page_config(page_title="Ingestion Upload", layout="wide")

st.title("Ingestion Upload — Bulk / Fast intake")
st.caption("Upload files, folders or point to a local path and provide contextual instructions for the ingestion pipeline.")

with st.sidebar:
    st.header("Company context")
    companies = enterprise_store.list_companies()
    options = [f"{c.get('commercial_name')} ({c.get('legal_name')})" for c in companies]
    selected_idx = st.selectbox("Select company (or create)", options=["-- Create/Ensure Ingecart canonical --"] + options)
    if selected_idx == "-- Create/Ensure Ingecart canonical --":
        if st.button("Ensure canonical Ingecart"):
            canonical = enterprise_store.ensure_canonical_ingecart()
            st.success(f"Ensured canonical company: {canonical.get('commercial_name')} / {canonical.get('legal_name')}")
            st.experimental_rerun()
    else:
        # find company id
        idx = options.index(selected_idx)
        company = companies[idx]
        st.write("Selected:")
        st.json({"id": company.get("id"), "commercial_name": company.get("commercial_name"), "legal_name": company.get("legal_name")})

st.subheader("Upload options")
mode = st.radio("Upload mode", ["file", "folder", "path"], horizontal=True)

uploaded_files = []
path_to_ingest = ""

if mode == "file":
    uploaded = st.file_uploader("Select files (multiple)", accept_multiple_files=True)
    if uploaded:
        # save to local raw data folder
        saved_paths = []
        raw_dir = Path("data") / "raw" / "uploads"
        raw_dir.mkdir(parents=True, exist_ok=True)
        for f in uploaded:
            dest = raw_dir / f.name
            with dest.open("wb") as out:
                out.write(f.getbuffer())
            saved_paths.append(str(dest))
        uploaded_files = saved_paths
        st.info(f"Saved {len(saved_paths)} files to {raw_dir}")

elif mode == "folder":
    st.info("Choose a local folder path to ingest all files recursively (server must have access).")
    path_to_ingest = st.text_input("Folder path", value="data/raw")
    if path_to_ingest and Path(path_to_ingest).exists():
        # list files
        files = [str(p) for p in Path(path_to_ingest).rglob("*") if p.is_file()]
        st.write(f"{len(files)} files found")
        uploaded_files = files

else:
    st.info("Provide a local path (file or folder) to ingest. Server must have filesystem access.")
    path_to_ingest = st.text_input("Local path to file or folder", value="")
    if path_to_ingest:
        p = Path(path_to_ingest)
        if p.exists():
            if p.is_file():
                uploaded_files = [str(p)]
            else:
                uploaded_files = [str(x) for x in p.rglob("*") if x.is_file()]
            st.write(f"{len(uploaded_files)} files found at {path_to_ingest}")

st.subheader("Ingestion metadata")
context = st.text_area("Context / instructions for this batch", placeholder="e.g. 'Customer offers 2024–2026'", height=120)
category = st.selectbox("Document category (optional)", options=["","offers","products","specs","market_reports","projects","finance","other"])
date_range = st.text_input("Date range (optional)")
confidential = st.selectbox("Confidentiality", options=["internal","external","confidential"]) 
target = st.selectbox("Target destination hint", options=["offers","products","customers","specs","market_intelligence","projects","finance","other"]) 

if st.button("Start ingestion"):
    if not uploaded_files:
        st.error("No files to ingest. Select files or provide a valid path.")
    else:
        st.info(f"Starting ingestion for {len(uploaded_files)} files")
        progress = st.progress(0)
        results = []
        for i, fp in enumerate(uploaded_files):
            try:
                # determine enterprise id from selected company if any
                enterprise_id = None
                if 'company' in locals() and company:
                    enterprise_id = company.get('id')
                res = ingest_pipeline.process_file(fp, enterprise_id=enterprise_id, uploader="web_uploader", upload_context=context, upload_batch=str(int(time.time())))
                results.append(res)
            except Exception as exc:
                st.warning(f"Failed to ingest {fp}: {exc}")
            progress.progress(int((i+1)/len(uploaded_files)*100))

        st.success("Ingestion finished")
        st.write({
            "files_processed": len(results),
            "first_ingestion_id": results[0]["ingestion_id"] if results else None,
        })

        # Show a summary table
        for r in results[:20]:
            st.write(r["file_row"]["file_name"], "→", r["final_row"]["approval_status"]) 
