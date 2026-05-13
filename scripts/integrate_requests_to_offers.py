"""
integrate_requests_to_offers.py — Sincroniza solicitudes procesadas con el pool de ofertas
============================================================================================
Lee solicitudes clasificadas como 'oferta' y crea entradas en el pool de ofertas
con datos estructurados extraídos por el Request Management Agent.

Uso:
    python scripts/integrate_requests_to_offers.py
    python scripts/integrate_requests_to_offers.py --requests-file data/requests.json
    python scripts/integrate_requests_to_offers.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DATA_DIR    = ROOT / "data"
OUTPUTS_DIR = ROOT / "outputs"


def _load_requests(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Load requests from JSON file or scan outputs for recent cascade results."""
    if path and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    # Scan outputs for cascade_results or request data
    if OUTPUTS_DIR.exists():
        files = sorted(OUTPUTS_DIR.glob("cascade_results_*.json"), reverse=True)
        for f in files[:5]:
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                req_data = data.get("request_management_agent", {})
                if isinstance(req_data, dict):
                    processed = req_data.get("processed_request")
                    if processed:
                        return [processed]
            except Exception:
                continue

    return []


def _request_to_offer(req: Dict[str, Any], serial: int) -> Dict[str, Any]:
    """Convert a processed request into an offer draft."""
    classification = req.get("classification", {})
    extracted      = req.get("extracted_data", req)

    now = datetime.now()
    offer_number = f"OF-{now.year}-{serial:04d}"

    return {
        "offer_number":   offer_number,
        "serial":         serial,
        "status":         "draft",
        "created_at":     now.isoformat(),
        "source":         "request_management_agent",
        "company":        extracted.get("company") or req.get("company", ""),
        "contact":        extracted.get("contact") or req.get("contact", ""),
        "contact_email":  extracted.get("email") or req.get("email", ""),
        "budget":         extracted.get("budget") or req.get("budget"),
        "deadline":       extracted.get("deadline") or req.get("deadline", ""),
        "requirements":   extracted.get("requirements") or req.get("requirements", []),
        "category":       classification.get("category", "oferta"),
        "confidence":     classification.get("confidence", 0),
        "requires_engineering": req.get("requires_engineering", False),
        "engineering_email":    req.get("engineering_email"),
        "lines":          [],
        "total":          0.0,
        "margin":         0.0,
        "notes":          "",
    }


def _save_offers(offers: List[Dict[str, Any]], dry_run: bool = False) -> Path:
    """Persist offer pool to data/offers_pool.json."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    offers_file = DATA_DIR / "offers_pool.json"
    existing: List[Dict[str, Any]] = []

    if offers_file.exists():
        try:
            existing = json.loads(offers_file.read_text(encoding="utf-8"))
        except Exception:
            existing = []

    # Avoid duplicates by offer_number
    existing_numbers = {o.get("offer_number") for o in existing}
    new_offers = [o for o in offers if o.get("offer_number") not in existing_numbers]
    merged = existing + new_offers

    if not dry_run:
        offers_file.write_text(
            json.dumps(merged, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    return offers_file


def main() -> None:
    parser = argparse.ArgumentParser(description="ACS Request → Offer Integrator")
    parser.add_argument("--requests-file", default=None, help="Path to requests JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without writing")
    args = parser.parse_args()

    req_path = Path(args.requests_file) if args.requests_file else None

    print(f"\n{'='*55}")
    print("  ACS: Sincronización Solicitudes → Ofertas")
    print(f"{'='*55}")

    requests = _load_requests(req_path)

    if not requests:
        print("ℹ️  No se encontraron solicitudes procesadas.")
        print("   Ejecute primero: python scripts/cascade_agents.py")
        sys.exit(0)

    # Filter to oferta category or process all
    offer_requests = [r for r in requests if r.get("classification", {}).get("category") == "oferta"]
    if not offer_requests:
        offer_requests = requests  # process all if no strict filter

    print(f"📋 Solicitudes encontradas: {len(requests)} total, {len(offer_requests)} para ofertas\n")

    # Determine next serial
    offers_file = DATA_DIR / "offers_pool.json"
    next_serial = 1
    if offers_file.exists():
        try:
            existing = json.loads(offers_file.read_text(encoding="utf-8"))
            if existing:
                max_serial = max(o.get("serial", 0) for o in existing)
                next_serial = max_serial + 1
        except Exception:
            pass

    new_offers: List[Dict[str, Any]] = []
    for i, req in enumerate(offer_requests):
        offer = _request_to_offer(req, next_serial + i)
        new_offers.append(offer)
        print(f"  ✅ {offer['offer_number']} — {offer['company'] or 'Sin empresa'} ({offer['category'].upper()})")
        if offer["budget"]:
            print(f"      💰 Presupuesto: {offer['budget']:,.0f} €")
        if offer["requires_engineering"]:
            print("      📧 Email a ingeniería pendiente de envío")

    if args.dry_run:
        print(f"\n[DRY-RUN] {len(new_offers)} oferta(s) se crearían (no guardadas)")
    else:
        out_path = _save_offers(new_offers, dry_run=False)
        print(f"\n✅ {len(new_offers)} oferta(s) añadida(s) al pool → {out_path}")

    print(f"\n{'='*55}\n")


if __name__ == "__main__":
    main()
