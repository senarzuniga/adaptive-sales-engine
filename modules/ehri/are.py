import os
from typing import List, Dict, Any
from .storage import Storage
from .event import ASEEvent
import json


WORKFLOW_DEFS = {
    "company_lifecycle": ["COMPANY_CREATED", "COMPANY_UPDATED", "COMPANY_SNAPSHOT_GENERATED"],
    "lead_to_project": ["LEAD_CREATED", "LEAD_QUALIFIED", "OPPORTUNITY_CREATED", "OFFER_GENERATED", "PRICE_CALCULATED", "MARGIN_COMPUTED", "OFFER_APPROVED", "PROJECT_CREATED"],
    "knowledge_ingestion": ["DOCUMENT_INGESTED", "EVIDENCE_STORED", "FACT_CHECK_COMPLETED", "KNOWLEDGE_APPROVED"],
    "daily_execution": ["DAILY_EXECUTION_GENERATED", "TASK_GENERATED", "NEXT_BEST_ACTION_CREATED"],
}


class AREngine:
    def __init__(self, storage: Storage):
        self.storage = storage

    def compute_ars(self) -> Dict[str, Any]:
        events = [ASEEvent.from_dict(e) for e in self.storage.get_events()]
        total_events = len(events)
        violations = []

        # Helper: map event types seen
        types_seen = set(e.event_type for e in events)

        # Workflow Completion (25%)
        wf_scores = []
        for wf, reqs in WORKFLOW_DEFS.items():
            present = sum(1 for t in reqs if t in types_seen)
            pct = present / len(reqs) if reqs else 1.0
            wf_scores.append(pct)
        workflow_completion_score = 25.0 * (sum(wf_scores) / len(wf_scores) if wf_scores else 1.0)

        # Knowledge Governance Integrity (25%)
        requires = [e for e in events if (e.governance or {}).get("requires_fact_check")]
        approved = [e for e in events if (e.governance or {}).get("fact_check_status") == "approved"]
        kg_integrity_score = 25.0 * ((len(approved) / len(requires)) if requires else 1.0)

        # Entity Consistency (15%) - detect if same entity_id appears with multiple entity_type
        entity_map = {}
        for e in events:
            refs = (e.context or {}).get("trace_identity_refs") or []
            for r in refs:
                et = r.get("entity_type")
                eid = r.get("entity_id")
                if not eid:
                    continue
                entity_map.setdefault(eid, set()).add(et)
        conflicts = sum(1 for eid, types in entity_map.items() if len([t for t in types if t]) > 1)
        total_entities = len(entity_map)
        entity_consistency_score = 15.0 * (1.0 - (conflicts / total_entities) if total_entities else 1.0)
        if conflicts > 0:
            violations.append({"type": "structural_duplication", "count": conflicts})

        # Execution Layer Effectiveness (15%) - check daily execution sequences
        daily_execs = [e for e in events if e.event_type == "DAILY_EXECUTION_GENERATED"]
        exec_success = 0
        for de in daily_execs:
            corr = (de.context or {}).get("correlation_id")
            related = [e for e in events if (e.context or {}).get("correlation_id") == corr]
            types = set(r.event_type for r in related)
            if "TASK_GENERATED" in types and "NEXT_BEST_ACTION_CREATED" in types:
                exec_success += 1
        execution_layer_score = 15.0 * ((exec_success / len(daily_execs)) if daily_execs else 1.0)

        # Traceability (10%) - offers must have traceability inputs pointing to opportunity
        offers = [e for e in events if e.event_type == "OFFER_GENERATED"]
        trace_ok = 0
        for o in offers:
            inputs = (o.traceability or {}).get("inputs") or []
            found = False
            for inp in inputs:
                if inp.get("entity_type") == "opportunity" and inp.get("entity_id"):
                    # check existence
                    exists = any((ev.context or {}).get("trace_identity_refs") and any((ref.get("entity_type") == "opportunity" and ref.get("entity_id") == inp.get("entity_id")) for ref in (ev.context or {}).get("trace_identity_refs")) for ev in events)
                    if exists:
                        found = True
                        break
            if found:
                trace_ok += 1
        traceability_score = 10.0 * ((trace_ok / len(offers)) if offers else 1.0)
        if offers and trace_ok < len(offers):
            violations.append({"type": "untraceable_offer", "total_offers": len(offers), "untraceable": len(offers) - trace_ok})

        # Architecture Purity (10%) - simple heuristic: if violations include structural_duplication -> low
        architecture_score = 10.0
        if any(v.get("type") == "structural_duplication" for v in violations):
            architecture_score = 0.0

        # Governance violations (hard fail conditions)
        hard_fail_conditions = []
        for e in events:
            gov = e.governance or {}
            if gov.get("raw_data_used"):
                hard_fail_conditions.append({"type": "raw_data_used", "event_id": e.event_id})
            if gov.get("bypassed_fact_checker"):
                hard_fail_conditions.append({"type": "bypassed_fact_checker", "event_id": e.event_id})
            if gov.get("missing_evidence_store"):
                hard_fail_conditions.append({"type": "missing_evidence_store", "event_id": e.event_id})
            if gov.get("unapproved_knowledge_used"):
                hard_fail_conditions.append({"type": "unapproved_knowledge_used", "event_id": e.event_id})

        # Compute aggregated score
        breakdown = {
            "workflow_completion": workflow_completion_score,
            "knowledge_governance_integrity": kg_integrity_score,
            "entity_consistency": entity_consistency_score,
            "execution_layer": execution_layer_score,
            "traceability": traceability_score,
            "architecture_purity": architecture_score,
        }

        total_score = sum(breakdown.values())

        # If hard fails -> override to 0 and include violations
        if hard_fail_conditions:
            violations.extend(hard_fail_conditions)
            result = {
                "score": 0,
                "breakdown": breakdown,
                "violations": violations,
                "total_events": total_events,
            }
            return result

        result = {
            "score": round(total_score, 2),
            "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
            "violations": violations,
            "total_events": total_events,
        }
        return result

    def generate_reports(self, output_dir: str = None, ars_result: Dict[str, Any] = None) -> None:
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(output_dir, exist_ok=True)
        if ars_result is None:
            ars_result = self.compute_ars()

        # Operational Readiness
        opath = os.path.join(output_dir, "ARE_Operational_Readiness_Report.md")
        with open(opath, "w", encoding="utf-8") as f:
            f.write(f"# ARE Operational Readiness Report\n\nScore: {ars_result.get('score')} / 100\n\n")
            f.write("## Breakdown\n\n")
            for k, v in ars_result.get("breakdown", {}).items():
                f.write(f"- **{k}**: {v}\n")
            f.write("\n## Violations\n\n")
            if ars_result.get("violations"):
                for v in ars_result.get("violations"):
                    f.write(f"- {v}\n")
            else:
                f.write("- None\n")

        # Knowledge Governance Report
        kpath = os.path.join(output_dir, "ARE_Knowledge_Governance_Report.md")
        with open(kpath, "w", encoding="utf-8") as f:
            f.write("# ARE Knowledge Governance Report\n\n")
            f.write("This report summarizes knowledge governance coverage detected in events.\n\n")
            f.write("- Total events: %d\n" % ars_result.get("total_events", 0))
            f.write("- Violations: %s\n" % (json.dumps(ars_result.get("violations", []), indent=2)))

        # Workflow Validation Matrix (execution-based)
        wpath = os.path.join(output_dir, "ARE_Workflow_Validation_Matrix.md")
        with open(wpath, "w", encoding="utf-8") as f:
            f.write("# ARE Workflow Validation Matrix\n\n")
            f.write("This matrix is generated from observed events.\n\n")
            for wf, reqs in WORKFLOW_DEFS.items():
                present = [r for r in reqs if any(ev.get('event_type') == r for ev in self.storage.get_events())]
                f.write(f"## {wf}\n- Required events: {len(reqs)}\n- Present: {len(present)}\n\n")

        # Architecture Compliance Report
        apath = os.path.join(output_dir, "ARE_Architecture_Compliance_Report.md")
        with open(apath, "w", encoding="utf-8") as f:
            f.write("# ARE Architecture Compliance Report\n\n")
            f.write("Architecture purity heuristic applied. See violations for structural duplication.\n\n")
            f.write("- Violations: %s\n" % (json.dumps([v for v in ars_result.get("violations", []) if v.get('type') == 'structural_duplication'], indent=2)))

        # Platform Readiness Score
        ppath = os.path.join(output_dir, "ARE_Platform_Readiness_Score.md")
        with open(ppath, "w", encoding="utf-8") as f:
            f.write("# ARE Platform Readiness Score\n\n")
            f.write(f"Total ARS: {ars_result.get('score')}\n\n")
            f.write("Breakdown:\n")
            for k, v in ars_result.get("breakdown", {}).items():
                f.write(f"- {k}: {v}\n")
