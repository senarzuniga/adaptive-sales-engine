"""Enterprise store abstraction (local JSON fallback).

Provides simple company persistence when Supabase is not configured.
Used by scripts and the ingestion UI to list, find and upsert companies.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPANIES_PATH = REPO_ROOT / "data" / "companies.json"


def _ensure_file() -> None:
    COMPANIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not COMPANIES_PATH.exists():
        COMPANIES_PATH.write_text("[]", encoding="utf-8")


def _load() -> List[Dict[str, Any]]:
    _ensure_file()
    try:
        return json.loads(COMPANIES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save(rows: List[Dict[str, Any]]) -> None:
    _ensure_file()
    COMPANIES_PATH.write_text(json.dumps(rows, indent=2), encoding="utf-8")


def _normalize(name: str) -> str:
    return "".join(ch for ch in (name or "").lower() if ch.isalnum() or ch.isspace()).strip()


def list_companies() -> List[Dict[str, Any]]:
    return _load()


def find_companies_by_name(name: str) -> List[Dict[str, Any]]:
    if not name:
        return []
    n = _normalize(name)
    out: List[Dict[str, Any]] = []
    for row in _load():
        cand = " ".join(filter(None, [row.get("commercial_name", ""), row.get("legal_name", "")] ))
        if n in _normalize(cand):
            out.append(row)
            continue
        # also check aliases
        for a in row.get("aliases", []):
            if n in _normalize(a):
                out.append(row)
                break
    return out


def get_company_by_id(company_id: str) -> Optional[Dict[str, Any]]:
    for row in _load():
        if row.get("id") == company_id:
            return row
    return None


def _make_id(name: str) -> str:
    return hashlib.sha256((name or "").strip().lower().encode()).hexdigest()[:24]


def upsert_company(data: Dict[str, Any]) -> Dict[str, Any]:
    rows = _load()
    # Attempt to find an existing company by normalized commercial/legal name
    name_to_check = (data.get("commercial_name") or data.get("legal_name") or "")
    norm = _normalize(name_to_check)
    existing_match_id = None
    for r in rows:
        if norm and (norm == _normalize(r.get("commercial_name", "")) or norm == _normalize(r.get("legal_name", ""))):
            existing_match_id = r.get("id")
            break
        for a in r.get("aliases", []):
            if norm and norm == _normalize(a):
                existing_match_id = r.get("id")
                break
        if existing_match_id:
            break

    cid = data.get("id") or existing_match_id or _make_id(data.get("commercial_name") or data.get("legal_name") or "")
    now = data.get("updated_at") or data.get("created_at")
    # find existing
    existing = None
    for i, r in enumerate(rows):
        if r.get("id") == cid:
            existing = (i, r)
            break
    if existing:
        idx, r = existing
        # merge fields but don't overwrite locked fields
        locked = set(r.get("locked_fields", []))
        for k, v in data.items():
            if k in ("id",):
                continue
            if k in locked:
                continue
            r[k] = v
        r["updated_at"] = now
        rows[idx] = r
        _save(rows)
        return r

    # create new
    new = {
        "id": cid,
        "commercial_name": data.get("commercial_name") or data.get("legal_name") or "",
        "legal_name": data.get("legal_name") or "",
        "aliases": data.get("aliases", []),
        "status": data.get("status", "active"),
        "source_of_truth": data.get("source_of_truth", "local"),
        "provenance": data.get("provenance", {}),
        "locked_fields": data.get("locked_fields", []),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
    }
    rows.append(new)
    _save(rows)
    return new


def merge_companies(primary_id: str, merge_ids: List[str]) -> Dict[str, Any]:
    rows = _load()
    primary = get_company_by_id(primary_id)
    if not primary:
        raise ValueError("Primary company not found")
    merged_aliases = set(primary.get("aliases", []))
    for mid in merge_ids:
        if mid == primary_id:
            continue
        other = get_company_by_id(mid)
        if not other:
            continue
        # accumulate aliases and names
        merged_aliases.add(other.get("commercial_name", ""))
        merged_aliases.add(other.get("legal_name", ""))
        for a in other.get("aliases", []):
            merged_aliases.add(a)
        # mark other as merged
        for i, r in enumerate(rows):
            if r.get("id") == mid:
                r["status"] = "merged"
                r["provenance"] = r.get("provenance", {})
                r["provenance"]["merged_into"] = primary_id
                rows[i] = r

    primary["aliases"] = sorted(x for x in merged_aliases if x)
    primary["updated_at"] = primary.get("updated_at")
    # save
    # replace primary row
    for i, r in enumerate(rows):
        if r.get("id") == primary_id:
            rows[i] = primary
            break
    _save(rows)
    return primary


def ensure_canonical_ingecart() -> Dict[str, Any]:
    """Audit existing companies and ensure a single canonical Ingecart record.

    Returns the canonical company dict.
    """
    canonical_commercial = "Ingecart"
    canonical_legal = "Ingecart 2018 SL"

    candidates = []
    # find by common variants
    for name in [canonical_commercial, canonical_legal, "inge cart", "inge-cart"]:
        candidates.extend(find_companies_by_name(name))
    # unique
    seen = {}
    for c in candidates:
        seen[c.get("id")] = c
    candidates = list(seen.values())

    if candidates:
        # choose the best candidate: prefer exact matches on legal_name or commercial_name
        primary = None
        for c in candidates:
            if (c.get("commercial_name", "").lower() == canonical_commercial.lower() or
                    c.get("legal_name", "").lower() == canonical_legal.lower()):
                primary = c
                break
        if not primary:
            primary = candidates[0]

        # ensure canonical names and merge others into primary
        primary_update = dict(primary)
        # do not overwrite locked fields
        locked = set(primary_update.get("locked_fields", []))
        if "commercial_name" not in locked:
            primary_update["commercial_name"] = canonical_commercial
        if "legal_name" not in locked:
            primary_update["legal_name"] = canonical_legal
        # ensure aliases include previous names
        aliases = set(primary_update.get("aliases", []))
        for c in candidates:
            aliases.add(c.get("commercial_name", ""))
            aliases.add(c.get("legal_name", ""))
            for a in c.get("aliases", []):
                aliases.add(a)

        primary_update["aliases"] = sorted(x for x in aliases if x and x.lower() not in (canonical_commercial.lower(), canonical_legal.lower()))
        upsert_company(primary_update)

        merge_ids = [c["id"] for c in candidates if c.get("id") != primary_update.get("id")]
        if merge_ids:
            merge_companies(primary_update.get("id"), merge_ids)

        return get_company_by_id(primary_update.get("id"))

    # no candidates: create canonical
    created = upsert_company({
        "commercial_name": canonical_commercial,
        "legal_name": canonical_legal,
        "aliases": [],
        "status": "active",
        "source_of_truth": "enterprise_master",
    })
    return created
