"""Minimal Enterprise Ingestion Pipeline runner (trace-only scaffold).

This runner implements the governed pipeline steps as traceable operations.
It is intentionally non-destructive: no knowledge is published automatically
and validation is required before any update step is considered final.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import APP_ROOT


class Pipeline:
    STEPS = [
        "discover",
        "classify",
        "validate",
        "extract",
        "normalize",
        "link_entities",
        "index",
        "generate_actions",
        "update_modules",
        "generate_report",
    ]

    def __init__(self, org_id: str, sources: Optional[List[Dict[str, Any]]] = None, dry_run: bool = True):
        self.org_id = org_id
        self.sources = sources or []
        self.dry_run = dry_run
        self.output_root = APP_ROOT / "outputs" / "ingestion" / org_id
        self.output_root.mkdir(parents=True, exist_ok=True)
        self.trace: List[Dict[str, Any]] = []

    def _write_trace(self, step_name: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out = self.output_root / f"trace_{step_name}_{ts}.json"
        out.write_text(json.dumps({"step": step_name, "trace": self.trace}, indent=2, ensure_ascii=False), encoding="utf-8")

    def run(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {"org_id": self.org_id, "started_at": datetime.now(timezone.utc).isoformat(), "steps": {}}
        for step in self.STEPS:
            fn = getattr(self, step)
            result = fn()
            self.trace.append({"step": step, "result": result, "timestamp": datetime.now(timezone.utc).isoformat()})
            summary["steps"][step] = result
            # persist trace per step for auditability
            try:
                self._write_trace(step)
            except Exception:
                pass
            # stop pipeline if validation says manual review required
            if step == "validate" and result.get("requires_manual_validation"):
                summary["status"] = "PAUSED_AWAITING_MANUAL_VALIDATION"
                return summary

        summary["status"] = "COMPLETED"
        summary["finished_at"] = datetime.now(timezone.utc).isoformat()
        # final trace file
        try:
            final = self.output_root / f"pipeline_summary_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            final.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
        return summary

    # Pipeline steps (scaffolded with traceable behaviour)
    def discover(self) -> Dict[str, Any]:
        # For each declared source produce evidence list (non-destructive)
        evidence = []
        for s in self.sources:
            t = s.get("type", "unknown")
            path = s.get("path")
            evidence.append({"source_id": s.get("id"), "type": t, "path": path, "noted_at": datetime.now(timezone.utc).isoformat()})
        return {"status": "OK", "evidence_count": len(evidence), "evidence": evidence}

    def classify(self) -> Dict[str, Any]:
        # Heuristic classification placeholder
        classifications = {"offers": 0, "contracts": 0, "presentations": 0, "other": 0}
        for s in self.sources:
            p = s.get("path", "")
            if str(p).lower().endswith(".pdf"):
                classifications["contracts"] += 1
            elif str(p).lower().endswith(('.pptx', '.ppt')):
                classifications["presentations"] += 1
            else:
                classifications["other"] += 1
        return {"status": "OK", "classifications": classifications}

    def validate(self) -> Dict[str, Any]:
        # Governance: validation must be manual by default (Architecture Assistant)
        return {"status": "REQUIRES_MANUAL_VALIDATION", "requires_manual_validation": True, "reason": "Governed pipeline requires Architecture Assistant validation"}

    def extract(self) -> Dict[str, Any]:
        # Produce lightweight metadata extraction
        extracted = []
        for s in self.sources:
            extracted.append({"source_id": s.get("id"), "title": s.get("name") or Path(str(s.get("path", ""))).name, "metadata": {}})
        return {"status": "OK", "extracted_count": len(extracted), "extracted": extracted}

    def normalize(self) -> Dict[str, Any]:
        # Normalization placeholder
        return {"status": "OK", "notes": "Normalization applied (scaffold)"}

    def link_entities(self) -> Dict[str, Any]:
        # Entity linking placeholder
        return {"status": "OK", "linked_entities": []}

    def index(self) -> Dict[str, Any]:
        # Indexing placeholder - write a minimal index file
        idx = {"indexed_at": datetime.now(timezone.utc).isoformat(), "items": []}
        try:
            p = self.output_root / "index.json"
            p.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
        return {"status": "OK", "index_count": 0}

    def generate_actions(self) -> Dict[str, Any]:
        # Generate non-destructive action suggestions
        actions = [{"type": "review", "message": "Validate extracted offers"}]
        return {"status": "OK", "actions_suggested": actions}

    def update_modules(self) -> Dict[str, Any]:
        # Do not perform updates automatically; generate update plan
        plan = {"modules_to_update": [], "note": "Updates require manual approval"}
        return {"status": "PLAN_CREATED", "plan": plan}

    def generate_report(self) -> Dict[str, Any]:
        report = {"summary": "Pipeline executed (scaffold) - manual validation required before publish"}
        try:
            p = self.output_root / f"report_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            p.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
        return {"status": "OK", "report_written": True}


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="RUN_INGESTION_PIPELINE")
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--source-ids", default="", help="Comma-separated source ids to consider (optional)")
    args = parser.parse_args(argv)

    # For this scaffold we load declared sources from Architecture/EnterpriseHub/sources.yaml if present
    sources_path = APP_ROOT / "Architecture" / "EnterpriseHub" / "sources.yaml"
    sources = []
    if sources_path.exists():
        try:
            import yaml

            doc = yaml.safe_load(sources_path.read_text(encoding="utf-8")) or {}
            sources = doc.get("sources", [])
        except Exception:
            sources = []

    # Optionally filter by provided ids
    if args.source_ids:
        ids = [s.strip() for s in args.source_ids.split(",") if s.strip()]
        sources = [s for s in sources if s.get("id") in ids]

    p = Pipeline(args.org_id, sources=sources, dry_run=args.dry_run)
    summary = p.run()
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
