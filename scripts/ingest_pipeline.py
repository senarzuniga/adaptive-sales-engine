"""Minimal implementation of the 7-stage ingestion pipeline.

This module provides `process_file()` which records pipeline stages in the
SQLite DB created by `scripts/ingestion_db.py` and uses the enterprise store
for company linking.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from scripts import ingestion_db
from infrastructure import enterprise_store


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _short_id() -> str:
    return uuid.uuid4().hex[:24]


def process_file(file_path: str, enterprise_id: Optional[str] = None, uploader: str = "local", upload_context: str = "", upload_batch: Optional[str] = None, auto_approve: bool = False) -> Dict[str, Any]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ingestion_id = _short_id()
    created_at = _now_iso()

    # Stage 1 — Detection & classification
    fhash = _file_hash(path)
    file_type = path.suffix.lower().lstrip('.')
    classification = "document"
    ingestion_row = {
        "id": ingestion_id,
        "file_name": path.name,
        "file_path": str(path.resolve()),
        "upload_batch": upload_batch or "manual",
        "file_type": file_type,
        "file_hash": fhash,
        "classification": classification,
        "upload_context": upload_context,
        "enterprise_id": enterprise_id,
        "uploader": uploader,
        "ingestion_status": "detected",
        "created_at": created_at,
    }
    ingestion_db.insert("file_ingestions", ingestion_row)

    # Stage 2 — Extraction & parsing (very small extractor)
    extracted_text = ""
    extracted_tables: List[Dict[str, Any]] = []
    parser = "simple_reader"
    confidence = 0.8
    try:
        if file_type in ("txt", "md", "csv", "json", "html", "htm"):
            extracted_text = path.read_text(encoding="utf-8", errors="ignore")
            if file_type == "csv":
                # extract first 20 lines as a simple table preview
                lines = extracted_text.splitlines()[:20]
                extracted_tables.append({"preview_lines": lines})
        else:
            # binary fallback: record size and simple hexdump length
            extracted_text = f"[binary file] size={path.stat().st_size}"
    except Exception as exc:
        extracted_text = f"[error reading file] {exc}"
        confidence = 0.0

    raw_row = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "extracted_text": extracted_text,
        "extracted_tables": json.dumps(extracted_tables),
        "parser": parser,
        "confidence": confidence,
        "ocr_diagnostics": "",
        "created_at": _now_iso(),
    }
    ingestion_db.insert("raw_extracts", raw_row)

    # Stage 3 — Normalization & structuring (placeholder logic)
    normalized = {
        "title": path.stem,
        "detected_type": classification,
        "text_length": len(extracted_text) if extracted_text else 0,
    }
    norm_row = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "normalized_json": json.dumps(normalized),
        "schema_mapping": json.dumps({}),
        "created_at": _now_iso(),
    }
    ingestion_db.insert("normalized_data", norm_row)

    # Stage 4 — Contextualization (link to enterprise entities)
    candidate_companies = []
    if extracted_text:
        # simple heuristic: look for company name mentions
        candidate_companies = enterprise_store.find_companies_by_name(extracted_text[:200])

    contextual_row = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "context_links": json.dumps({"candidate_companies": [c.get("id") for c in candidate_companies]}),
        "duplicate_candidates": json.dumps([]),
        "created_at": _now_iso(),
    }
    ingestion_db.insert("contextualized_data", contextual_row)

    # Stage 5 — Fact checking & validation (placeholder)
    fact_row = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "confidence": 0.0,
        "issues": json.dumps([]),
        "status": "review_required",
        "evidence_links": json.dumps([]),
        "created_at": _now_iso(),
    }
    ingestion_db.insert("fact_check_reports", fact_row)

    # Stage 6 — Enrichment & final insertion
    # Only insert into `final_structured_data` when auto_approve is True.
    # Otherwise insert into `candidate_structured_data` so objects remain
    # reviewable and are not considered enterprise truth.
    final_payload = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "entity_type": "document_evidence",
        "payload": json.dumps({"title": path.name, "text_snippet": extracted_text[:100]}),
        "enterprise_id": enterprise_id,
        "provenance": json.dumps({"file_ingestion_id": ingestion_id, "file_path": str(path)}),
        "created_at": _now_iso(),
    }
    if auto_approve:
        final_payload["approval_status"] = "approved"
        ingestion_db.insert("final_structured_data", final_payload)
        final_row = final_payload
    else:
        # candidate entry (not final truth)
        ingestion_db.insert("candidate_structured_data", final_payload)
        final_row = final_payload

    # Stage 7 — Action generation (create follow-up if blocked)
    action_row = {
        "id": _short_id(),
        "ingestion_id": ingestion_id,
        "action_type": "validation_review",
        "owner": uploader,
        "due_date": "",
        "status": "closed" if auto_approve else "open",
        "comments": "Auto-generated review action",
        "created_at": _now_iso(),
    }
    ingestion_db.insert("actions", action_row)

    return {
        "ingestion_id": ingestion_id,
        "file_row": ingestion_row,
        "raw_row": raw_row,
        "norm_row": norm_row,
        "contextual_row": contextual_row,
        "fact_row": fact_row,
        "final_row": final_row,
        "action_row": action_row,
    }
