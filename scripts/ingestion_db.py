"""Simple SQLite-backed storage for the ingestion pipeline.

This module creates the required tables and exposes helpers to insert records.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional, List

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = REPO_ROOT / "data" / "ingestion.db"


def _ensure_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS file_ingestions (
        id TEXT PRIMARY KEY,
        file_name TEXT,
        file_path TEXT,
        upload_batch TEXT,
        file_type TEXT,
        file_hash TEXT,
        classification TEXT,
        upload_context TEXT,
        enterprise_id TEXT,
        uploader TEXT,
        ingestion_status TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS raw_extracts (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        extracted_text TEXT,
        extracted_tables TEXT,
        parser TEXT,
        confidence REAL,
        ocr_diagnostics TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS normalized_data (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        normalized_json TEXT,
        schema_mapping TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS contextualized_data (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        context_links TEXT,
        duplicate_candidates TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_check_reports (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        confidence REAL,
        issues TEXT,
        status TEXT,
        evidence_links TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS final_structured_data (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        entity_type TEXT,
        payload TEXT,
        enterprise_id TEXT,
        provenance TEXT,
        approval_status TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS candidate_structured_data (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        entity_type TEXT,
        payload TEXT,
        enterprise_id TEXT,
        provenance TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        ingestion_id TEXT,
        action_type TEXT,
        owner TEXT,
        due_date TEXT,
        status TEXT,
        comments TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        candidate_id TEXT,
        enterprise_id TEXT,
        reviewer TEXT,
        review_action TEXT,
        reason TEXT,
        linked_existing_entity_id TEXT,
        resulting_final_id TEXT,
        notes TEXT,
        timestamp TEXT
    )
    """)

    conn.commit()
    return conn


def insert(table: str, row: Dict[str, Any]) -> None:
    conn = _ensure_db()
    cur = conn.cursor()
    keys = list(row.keys())
    placeholders = ",".join(["?"] * len(keys))
    cur.execute(f"INSERT OR REPLACE INTO {table} ({','.join(keys)}) VALUES ({placeholders})", [json.dumps(v) if isinstance(v, (dict, list)) else v for v in row.values()])
    conn.commit()
    conn.close()


def fetch_one(table: str, key: str, value: Any) -> Optional[Dict[str, Any]]:
    conn = _ensure_db()
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table} WHERE {key} = ?", (value,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    cols = [c[0] for c in cur.description]
    res = dict(zip(cols, row))
    # try to decode JSON fields
    for k, v in res.items():
        if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
            try:
                res[k] = json.loads(v)
            except Exception:
                pass
    conn.close()
    return res


def fetch_all(table: str, limit: int = 100) -> List[Dict[str, Any]]:
    conn = _ensure_db()
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table} ORDER BY rowid DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    cols = [c[0] for c in cur.description]
    out: List[Dict[str, Any]] = []
    for row in rows:
        res = dict(zip(cols, row))
        for k, v in res.items():
            if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                try:
                    res[k] = json.loads(v)
                except Exception:
                    pass
        out.append(res)
    conn.close()
    return out


def insert_review_decision(decision: Dict[str, Any]) -> None:
    """Insert a review decision record into the DB."""
    insert("review_decisions", decision)


def get_latest_review_for_candidate(candidate_id: str) -> Optional[Dict[str, Any]]:
    conn = _ensure_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM review_decisions WHERE candidate_id = ? ORDER BY timestamp DESC LIMIT 1", (candidate_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    cols = [c[0] for c in cur.description]
    res = dict(zip(cols, row))
    # try decode JSON fields
    for k, v in res.items():
        if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
            try:
                res[k] = json.loads(v)
            except Exception:
                pass
    conn.close()
    return res


def get_reviews_for_candidate(candidate_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = _ensure_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM review_decisions WHERE candidate_id = ? ORDER BY timestamp DESC LIMIT ?", (candidate_id, limit))
    rows = cur.fetchall()
    cols = [c[0] for c in cur.description]
    out: List[Dict[str, Any]] = []
    for row in rows:
        res = dict(zip(cols, row))
        for k, v in res.items():
            if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                try:
                    res[k] = json.loads(v)
                except Exception:
                    pass
        out.append(res)
    conn.close()
    return out
