"""Audit and ensure a single canonical Ingecart company record.

Usage:
    python scripts/ensure_ingecart.py

This script will create or update the canonical company with:
  commercial_name = Ingecart
  legal_name = Ingecart 2018 SL

It updates the local companies store (`data/companies.json`).
"""
from __future__ import annotations

from pprint import pprint
import sys
from pathlib import Path

# Ensure repo root is on sys.path when run as a script
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from infrastructure import enterprise_store
from users_storage import list_users, save_workspace


def main() -> None:
    before = enterprise_store.list_companies()
    print("Companies before audit:")
    pprint(before)

    canonical = enterprise_store.ensure_canonical_ingecart()

    after = enterprise_store.list_companies()
    print("\nCompanies after audit:")
    pprint(after)

    print("\nCanonical company: ")
    pprint(canonical)

    # Try to add canonical company to any local user's workspace saved_companies
    users = list_users()
    for u in users:
        email = u.get("email")
        if not email:
            continue
        ws = u.get("workspace", {})
        saved = ws.get("saved_companies", [])
        # if not already present, append minimal company record
        if not any(c.get("id") == canonical.get("id") for c in saved):
            saved.append({
                "id": canonical.get("id"),
                "commercial_name": canonical.get("commercial_name"),
                "legal_name": canonical.get("legal_name"),
                "status": canonical.get("status"),
            })
            ws["saved_companies"] = saved
            save_workspace(email, ws)
            print(f"Added canonical company to workspace of {email}")


if __name__ == "__main__":
    main()
