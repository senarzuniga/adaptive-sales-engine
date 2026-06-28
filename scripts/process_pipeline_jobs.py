"""
process_pipeline_jobs.py
========================
Lightweight worker for offer/request pipeline jobs.

What it does:
- Claims pending jobs from public.pipeline_jobs
- For offer jobs, syncs customer_requests from the offer data
- Creates a follow-up commercial action when needed (best-effort)
- Marks jobs completed/failed with result metadata

Usage:
  python scripts/process_pipeline_jobs.py
  python scripts/process_pipeline_jobs.py --limit 20 --once
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from infrastructure.supabase_client import get_supabase

logger = logging.getLogger("pipeline_worker")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_jobs(limit: int) -> List[Dict[str, Any]]:
    sb = get_supabase()
    if sb is None:
        return []

    try:
        rows = (
            sb.table("pipeline_jobs")
            .select("*")
            .eq("status", "pending")
            .order("priority", desc=True)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning("Could not load pipeline jobs: %s", exc)
        return []

    claimed: List[Dict[str, Any]] = []
    for row in rows:
        try:
            updated = (
                sb.table("pipeline_jobs")
                .update(
                    {
                        "status": "processing",
                        "attempts": int(row.get("attempts") or 0) + 1,
                        "claimed_at": _utc_now(),
                    }
                )
                .eq("id", row["id"])
                .eq("status", "pending")
                .execute()
            )
            if updated.data:
                claimed.append(updated.data[0])
        except Exception:
            continue

    return claimed


def _upsert_customer_request_from_offer(sb: Any, offer: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "company": offer.get("customer_name") or "",
        "description": offer.get("project_description") or offer.get("title") or "",
        "status": "new",
        "linked_offer_id": offer.get("id"),
        "source_app": "pipeline_worker",
        "updated_at": _utc_now(),
    }

    existing = (
        sb.table("customer_requests")
        .select("id,status")
        .eq("linked_offer_id", offer.get("id"))
        .maybe_single()
        .execute()
        .data
    )

    if not existing:
        created = (
            sb.table("customer_requests")
            .insert(
                {
                    **payload,
                    "received_date": datetime.now(timezone.utc).date().isoformat(),
                    "contact_name": "",
                    "contact_email": "",
                    "contact_phone": "",
                }
            )
            .execute()
            .data
            or []
        )
        return {"request_created": bool(created)}

    if existing.get("status") == "declined":
        return {"request_created": False, "request_skipped": "declined"}

    sb.table("customer_requests").update(payload).eq("id", existing["id"]).execute()
    return {"request_updated": True}


def _create_followup_action(sb: Any, offer: Dict[str, Any]) -> Dict[str, Any]:
    title = f"Review offer {offer.get('offer_number') or offer.get('id')}"
    description = f"Validate pricing and next action for {offer.get('customer_name') or 'customer'}"

    # Handle deployments with different action schemas.
    try:
        row = (
            sb.table("actions")
            .insert(
                {
                    "company_id": offer.get("company_id"),
                    "title": title,
                    "description": description,
                    "priority": "medium",
                    "status": "todo",
                    "source_module": "offer_pipeline",
                    "metadata": {"offer_id": offer.get("id")},
                }
            )
            .execute()
            .data
            or []
        )
        return {"action_created": bool(row)}
    except Exception:
        try:
            row = (
                sb.table("actions")
                .insert(
                    {
                        "name": title,
                        "goal": description,
                        "description": description,
                        "department": "Commercial",
                        "status": "open",
                        "importance_score": 70,
                        "strategy_alignment": 70,
                        "estimated_hours": 2,
                        "comments": "",
                        "supportive_content": {"offer_id": offer.get("id")},
                    }
                )
                .execute()
                .data
                or []
            )
            return {"action_created": bool(row)}
        except Exception as exc:
            logger.warning("Could not create follow-up action: %s", exc)
            return {"action_created": False}


def _process_offer_job(sb: Any, job: Dict[str, Any]) -> Dict[str, Any]:
    offer_id = job.get("entity_id")
    if not offer_id:
        return {"skipped": "missing_offer_id"}

    offer = (
        sb.table("offers").select("*").eq("id", offer_id).maybe_single().execute().data
    )
    if not offer:
        return {"skipped": "offer_not_found"}

    result: Dict[str, Any] = {}
    result.update(_upsert_customer_request_from_offer(sb, offer))

    status = (offer.get("status") or "").lower()
    if status in {"draft", "in_review", "sent", "negotiated"}:
        result.update(_create_followup_action(sb, offer))

    return result


def _complete_job(sb: Any, job_id: str, result: Dict[str, Any]) -> None:
    sb.table("pipeline_jobs").update(
        {
            "status": "completed",
            "completed_at": _utc_now(),
            "result": result,
            "error_message": None,
        }
    ).eq("id", job_id).execute()


def _fail_job(sb: Any, job: Dict[str, Any], exc: Exception) -> None:
    attempts = int(job.get("attempts") or 1)
    final_status = "failed" if attempts >= 5 else "pending"
    sb.table("pipeline_jobs").update(
        {
            "status": final_status,
            "error_message": str(exc)[:1200],
            "not_before": _utc_now(),
        }
    ).eq("id", job["id"]).execute()


def run(limit: int) -> int:
    sb = get_supabase()
    if sb is None:
        logger.warning("Supabase not configured; worker cannot run.")
        return 0

    jobs = _load_jobs(limit=limit)
    if not jobs:
        logger.info("No pending pipeline jobs.")
        return 0

    processed = 0
    for job in jobs:
        try:
            if str(job.get("entity_type")) == "offer":
                result = _process_offer_job(sb, job)
            else:
                result = {"skipped": "unsupported_entity_type"}

            _complete_job(sb, job["id"], result)
            processed += 1
        except Exception as exc:
            logger.exception("Job %s failed", job.get("id"))
            _fail_job(sb, job, exc)

    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Process pending offer pipeline jobs")
    parser.add_argument("--limit", type=int, default=15, help="Max jobs to claim per run")
    parser.add_argument("--once", action="store_true", help="Run a single batch and exit")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.once:
        run(limit=max(1, args.limit))
        return

    # Default behavior is also a single run to keep execution predictable.
    run(limit=max(1, args.limit))


if __name__ == "__main__":
    main()
