import json
import os
from collections import defaultdict
from modules.ehri.service import EHRIService
from modules.ehri.are import WORKFLOW_DEFS, AREngine


def analyze():
    svc = EHRIService()
    engine = AREngine(svc.storage)
    ars = engine.compute_ars()

    events = svc.storage.get_events()
    events_by_type = defaultdict(list)
    for e in events:
        events_by_type[e.get('event_type')].append(e)

    events_by_corr = svc.storage.get_events_by_correlation()

    # Failed workflows
    failed_workflows = []
    workflow_coverage = {}
    total_required = 0
    total_present = 0
    for wf, reqs in WORKFLOW_DEFS.items():
        present = [r for r in reqs if r in events_by_type]
        missing = [r for r in reqs if r not in events_by_type]
        workflow_coverage[wf] = {"required": len(reqs), "present": len(present), "missing": missing}
        total_required += len(reqs)
        total_present += len(present)
        if missing:
            failed_workflows.append({"workflow": wf, "missing": missing})

    coverage_pct = (total_present / total_required * 100) if total_required else 100.0

    # Governance and knowledge checks
    hard_fails = []
    knowledge_violations = []
    warnings = []
    missing_evidence_chains = []
    missing_confidence_scores = []
    traceability_gaps = []

    # collect opportunities
    opps = set()
    for ev in events_by_type.get('OPPORTUNITY_CREATED', []):
        for ref in (ev.get('context') or {}).get('trace_identity_refs', []) or []:
            if ref.get('entity_type') == 'opportunity' and ref.get('entity_id'):
                opps.add(ref.get('entity_id'))

    # entity duplication
    entity_map = defaultdict(set)
    for ev in events:
        for ref in (ev.get('context') or {}).get('trace_identity_refs', []) or []:
            if ref.get('entity_id'):
                entity_map[ref.get('entity_id')].add(ref.get('entity_type'))
    entity_duplications = [ {"entity_id": eid, "types": list(types)} for eid, types in entity_map.items() if len([t for t in types if t]) > 1]

    # check document ingestion chains by correlation
    for corr, evs in events_by_corr.items():
        docs = [e for e in evs if e.get('event_type') == 'DOCUMENT_INGESTED']
        if docs:
            for d in docs:
                doc_id = (d.get('payload') or {}).get('doc_id')
                has_evidence = any(e.get('event_type') == 'EVIDENCE_STORED' for e in evs)
                has_fact = any(e.get('event_type') == 'FACT_CHECK_COMPLETED' for e in evs)
                has_approve = any(e.get('event_type') == 'KNOWLEDGE_APPROVED' for e in evs)
                if not (has_evidence and has_fact and has_approve):
                    missing_evidence_chains.append({"doc_id": doc_id, "corr": corr, "has_evidence": has_evidence, "has_fact": has_fact, "has_approved": has_approve})
                # missing confidence
                for e in evs:
                    if e.get('event_type') == 'FACT_CHECK_COMPLETED':
                        if not ((e.get('governance') or {}).get('confidence_score') is not None):
                            missing_confidence_scores.append({"doc_id": doc_id, "event": e})

    # traceability gaps for offers
    for offer in events_by_type.get('OFFER_GENERATED', []):
        trace = (offer.get('traceability') or {}).get('inputs') or []
        for inp in trace:
            if inp.get('entity_type') == 'opportunity':
                if inp.get('entity_id') not in opps:
                    traceability_gaps.append({"offer_id": (offer.get('payload') or {}).get('offer_id'), "missing_opportunity": inp.get('entity_id')})

    # evaluate hard-fails and warnings
    for ev in events:
        gov = ev.get('governance') or {}
        if gov.get('raw_data_used'):
            hard_fails.append({"type": "raw_data_used", "event": ev})
        if gov.get('bypassed_fact_checker'):
            hard_fails.append({"type": "bypassed_fact_checker", "event": ev})
        if gov.get('missing_evidence_store'):
            knowledge_violations.append({"type": "missing_evidence_store", "event": ev})
        if gov.get('unapproved_knowledge_used'):
            knowledge_violations.append({"type": "unapproved_knowledge_used", "event": ev})
        # warnings: low confidence
        if gov.get('confidence_score') is not None and gov.get('confidence_score') < 0.7:
            warnings.append({"type": "low_confidence", "score": gov.get('confidence_score'), "event": ev})
        # missing evidence when requires_fact_check
        if gov.get('requires_fact_check') and not gov.get('evidence_id'):
            warnings.append({"type": "missing_evidence_id", "event": ev})

    # architecture violations from ARS violations list
    architecture_violations = [v for v in ars.get('violations', []) if v.get('type') == 'structural_duplication']

    # modules exercised
    exercised_modules = set([(e.get('context') or {}).get('module') for e in events if (e.get('context') or {}).get('module')])
    expected_modules = set(['company', 'ingestion', 'crm', 'commercial', 'delivery', 'execution', 'reporting', 'analytics', 'product'])
    modules_not_exercised = sorted(list(expected_modules - exercised_modules))

    # readiness by business domain mapping
    domain_map = {
        'CRM': ['LEAD_CREATED', 'LEAD_QUALIFIED', 'OPPORTUNITY_CREATED', 'CUSTOMER_CREATED'],
        'Commercial': ['OFFER_GENERATED', 'OFFER_APPROVED', 'PRICE_CALCULATED', 'MARGIN_COMPUTED'],
        'Projects': ['PROJECT_CREATED'],
        'Knowledge': ['DOCUMENT_INGESTED', 'EVIDENCE_STORED', 'FACT_CHECK_COMPLETED', 'KNOWLEDGE_APPROVED'],
        'Execution Console': ['DAILY_EXECUTION_GENERATED', 'TASK_GENERATED', 'NEXT_BEST_ACTION_CREATED'],
        'Reporting': ['COMPANY_SNAPSHOT_GENERATED']
    }

    readiness_by_domain = {}
    for domain, evtypes in domain_map.items():
        req = len(evtypes)
        pres = sum(1 for t in evtypes if t in events_by_type)
        pct = (pres / req * 100) if req else 100.0
        readiness_by_domain[domain] = {"required": req, "present": pres, "coverage_pct": round(pct,2)}

    summary = {
        'ars': ars,
        'coverage_pct': round(coverage_pct,2),
        'failed_workflows': failed_workflows,
        'warnings': warnings,
        'hard_fails': hard_fails,
        'architecture_violations': architecture_violations,
        'knowledge_violations': knowledge_violations,
        'traceability_gaps': traceability_gaps,
        'entity_duplications': entity_duplications,
        'missing_evidence_chains': missing_evidence_chains,
        'missing_confidence_scores': missing_confidence_scores,
        'modules_not_exercised': modules_not_exercised,
        'readiness_by_domain': readiness_by_domain,
        'total_events': len(events),
    }

    # write detailed JSON and MD
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'reports')
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    jpath = os.path.join(out_dir, 'ARE_Detailed_Baseline_Analysis.json')
    mpath = os.path.join(out_dir, 'ARE_Detailed_Baseline_Analysis.md')
    with open(jpath, 'w', encoding='utf-8') as jf:
        json.dump(summary, jf, indent=2)

    with open(mpath, 'w', encoding='utf-8') as mf:
        mf.write('# ARE Detailed Baseline Analysis\n\n')
        mf.write(f"Total captured events: {len(events)}\n\n")
        mf.write('## ASE Readiness Score (ARS)\n\n')
        mf.write(json.dumps(ars, indent=2))
        mf.write('\n\n')
        mf.write('## Coverage (workflows)\n\n')
        mf.write(f"Overall workflow coverage: {round(coverage_pct,2)}%\n\n")
        mf.write('## Failed Workflows\n\n')
        if failed_workflows:
            for f in failed_workflows:
                mf.write(f"- {f['workflow']}: missing {f['missing']}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Warnings\n\n')
        if warnings:
            for w in warnings:
                mf.write(f"- {w}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Hard-fail violations\n\n')
        if hard_fails:
            for h in hard_fails:
                mf.write(f"- {h}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Architecture violations\n\n')
        if architecture_violations:
            for a in architecture_violations:
                mf.write(f"- {a}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Knowledge Governance violations\n\n')
        if knowledge_violations:
            for k in knowledge_violations:
                mf.write(f"- {k}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Traceability gaps\n\n')
        if traceability_gaps:
            for t in traceability_gaps:
                mf.write(f"- {t}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Entity duplication findings\n\n')
        if entity_duplications:
            for e in entity_duplications:
                mf.write(f"- {e}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Missing evidence chains\n\n')
        if missing_evidence_chains:
            for me in missing_evidence_chains:
                mf.write(f"- {me}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Missing confidence scores\n\n')
        if missing_confidence_scores:
            for mc in missing_confidence_scores:
                mf.write(f"- {mc}\n")
        else:
            mf.write('- None\n')
        mf.write('\n## Modules not exercised by the harness\n\n')
        for m in modules_not_exercised:
            mf.write(f"- {m}\n")
        mf.write('\n## Code coverage of business workflows (approx.)\n\n')
        mf.write(f"- {round(coverage_pct,2)}%\n\n")
        mf.write('## Readiness by business domain\n\n')
        for d, v in readiness_by_domain.items():
            mf.write(f"- {d}: {v['coverage_pct']}% ({v['present']}/{v['required']})\n")

    # print a short summary
    print(json.dumps({
        'ars': ars,
        'coverage_pct': round(coverage_pct,2),
        'failed_workflows': failed_workflows,
        'warnings_count': len(warnings),
        'hard_fails_count': len(hard_fails),
        'modules_not_exercised': modules_not_exercised,
    }, indent=2))


if __name__ == '__main__':
    analyze()
