import sqlite3
import os
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import HourlyRateProfile, BenchmarkValue, EPISScore


class Storage:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), "data", "ehri.db")
        self.db_path = db_path
        # Create directory unless using in-memory sqlite
        if db_path != ":memory":
            dirpath = os.path.dirname(db_path)
            if dirpath:
                os.makedirs(dirpath, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_db()

    def init_db(self):
        cur = self.conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY,
                company_id TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                created_at TEXT,
                approval_status TEXT,
                data TEXT NOT NULL
            )
        """)
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_unique ON profiles(company_id, profile_id, version)")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS benchmarks (
                id INTEGER PRIMARY KEY,
                company_id TEXT,
                data TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS epis (
                id INTEGER PRIMARY KEY,
                company_id TEXT,
                profile_id TEXT,
                version INTEGER,
                value REAL,
                breakdown TEXT,
                computed_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                event_id TEXT NOT NULL,
                timestamp TEXT,
                event_type TEXT,
                correlation_id TEXT,
                data TEXT NOT NULL
            )
        """)
        self.conn.commit()

    def save_profile(self, profile: HourlyRateProfile):
        cur = self.conn.cursor()
        cur.execute(
            "INSERT INTO profiles (company_id, profile_id, version, created_at, approval_status, data) VALUES (?, ?, ?, ?, ?, ?)",
            (profile.company_id, profile.profile_id, profile.version, profile.created_at, profile.approval_status, profile.to_json())
        )
        self.conn.commit()

    def list_versions(self, company_id: str, profile_id: Optional[str] = None) -> List[Dict[str, Any]]:
        cur = self.conn.cursor()
        if profile_id:
            cur.execute("SELECT version, created_at, approval_status, data FROM profiles WHERE company_id=? AND profile_id=? ORDER BY version DESC", (company_id, profile_id))
        else:
            cur.execute("SELECT profile_id, version, created_at, approval_status FROM profiles WHERE company_id=? ORDER BY profile_id, version DESC", (company_id,))
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    def get_profile(self, company_id: str, profile_id: str, version: Optional[int] = None) -> Optional[HourlyRateProfile]:
        cur = self.conn.cursor()
        if version:
            cur.execute("SELECT data FROM profiles WHERE company_id=? AND profile_id=? AND version= ?", (company_id, profile_id, version))
        else:
            cur.execute("SELECT data FROM profiles WHERE company_id=? AND profile_id=? ORDER BY version DESC LIMIT 1", (company_id, profile_id))
        row = cur.fetchone()
        if not row:
            return None
        return HourlyRateProfile.from_json(row["data"])

    def get_latest_version_number(self, company_id: str, profile_id: str) -> int:
        cur = self.conn.cursor()
        cur.execute("SELECT MAX(version) as v FROM profiles WHERE company_id=? AND profile_id=?", (company_id, profile_id))
        row = cur.fetchone()
        return row["v"] if row and row["v"] is not None else 0

    def create_new_version(self, profile: HourlyRateProfile):
        latest = self.get_latest_version_number(profile.company_id, profile.profile_id)
        profile.version = latest + 1
        self.save_profile(profile)

    def approve_version(self, company_id: str, profile_id: str, version: int, approved_by: str):
        cur = self.conn.cursor()
        cur.execute("SELECT data FROM profiles WHERE company_id=? AND profile_id=? AND version=?", (company_id, profile_id, version))
        row = cur.fetchone()
        if not row:
            raise ValueError("version not found")
        profile = HourlyRateProfile.from_json(row["data"])
        profile.approved_by = approved_by
        profile.approved_at = datetime.utcnow().isoformat()
        profile.approval_status = "approved"
        cur.execute("UPDATE profiles SET approval_status=?, data=? WHERE company_id=? AND profile_id=? AND version=?",
                    (profile.approval_status, profile.to_json(), company_id, profile_id, version))
        self.conn.commit()

    def save_benchmark(self, company_id: str, benchmark: BenchmarkValue):
        cur = self.conn.cursor()
        cur.execute("INSERT INTO benchmarks (company_id, data) VALUES (?, ?)", (company_id, benchmark.to_json()))
        self.conn.commit()

    def get_benchmarks(self, company_id: str) -> List[BenchmarkValue]:
        cur = self.conn.cursor()
        cur.execute("SELECT data FROM benchmarks WHERE company_id=?", (company_id,))
        rows = cur.fetchall()
        return [BenchmarkValue.from_json(r["data"]) for r in rows]

    def save_epis(self, epis: EPISScore):
        cur = self.conn.cursor()
        cur.execute("INSERT INTO epis (company_id, profile_id, version, value, breakdown, computed_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (epis.company_id, epis.profile_id, epis.version, epis.value, json.dumps(epis.breakdown), epis.computed_at))
        self.conn.commit()

    def get_latest_epis(self, company_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
        cur = self.conn.cursor()
        cur.execute("SELECT value, breakdown, computed_at FROM epis WHERE company_id=? AND profile_id=? ORDER BY computed_at DESC LIMIT 1", (company_id, profile_id))
        row = cur.fetchone()
        if not row:
            return None
        return {"value": row["value"], "breakdown": json.loads(row["breakdown"]), "computed_at": row["computed_at"]}

    # Event Capture Layer (append-only)
    def append_event(self, event):
        """Append ASEEvent or dict to the events table (append-only)."""
        cur = self.conn.cursor()
        if hasattr(event, "to_json"):
            data = event.to_json()
            try:
                event_id = getattr(event, "event_id", None)
                timestamp = getattr(event, "timestamp", None)
                correlation = (event.context or {}).get("correlation_id")
            except Exception:
                event_id = None
                timestamp = None
                correlation = None
        else:
            # assume dict
            ed = event
            data = json.dumps(ed)
            event_id = ed.get("event_id")
            timestamp = ed.get("timestamp")
            correlation = (ed.get("context") or {}).get("correlation_id")

        cur.execute("INSERT INTO events (event_id, timestamp, event_type, correlation_id, data) VALUES (?, ?, ?, ?, ?)",
                    (event_id, timestamp, (getattr(event, "event_type", None) if hasattr(event, "event_type") else (ed.get("event_type") if isinstance(event, dict) else None)), correlation, data))
        self.conn.commit()

    def get_events(self, event_type: Optional[str] = None, correlation_id: Optional[str] = None) -> List[Dict[str, Any]]:
        cur = self.conn.cursor()
        if event_type and correlation_id:
            cur.execute("SELECT data FROM events WHERE event_type=? AND correlation_id=? ORDER BY id ASC", (event_type, correlation_id))
        elif event_type:
            cur.execute("SELECT data FROM events WHERE event_type=? ORDER BY id ASC", (event_type,))
        elif correlation_id:
            cur.execute("SELECT data FROM events WHERE correlation_id=? ORDER BY id ASC", (correlation_id,))
        else:
            cur.execute("SELECT data FROM events ORDER BY id ASC")
        rows = cur.fetchall()
        return [json.loads(r["data"]) for r in rows]

    def get_events_by_correlation(self) -> Dict[str, List[Dict[str, Any]]]:
        cur = self.conn.cursor()
        cur.execute("SELECT correlation_id, data FROM events ORDER BY id ASC")
        rows = cur.fetchall()
        out = {}
        for r in rows:
            corr = r["correlation_id"] or "_no_corr"
            out.setdefault(corr, []).append(json.loads(r["data"]))
        return out
