import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from modules.ehri.storage import Storage
from modules.ehri.are import AREngine

s = Storage()
engine = AREngine(s)
ars = engine.compute_ars()

events = s.get_events()
total = len(events)

evidence_types = {"EVIDENCE_STORED", "DOCUMENT_INGESTED", "FACT_CHECK_COMPLETED", "KNOWLEDGE_APPROVED"}
evidence_events = [e for e in events if (e.get('event_type') in evidence_types) or ((e.get('governance') or {}).get('evidence_id'))]
evidence_coverage = round(100.0 * len(evidence_events) / total, 2) if total else 0.0

reasoning_events = [e for e in events if 'REASONING' in (e.get('event_type') or '') or 'AI_REASONING' in (e.get('event_type') or '')]
reasoning_coverage = round(100.0 * len(reasoning_events) / total, 2) if total else 0.0

# blocked decisions count
blocked_events = [e for e in events if e.get('event_type') == 'AI_EXECUTIVE_DECISION_BLOCKED']
blocked_decision_count = len(blocked_events)

bypass_events = [e for e in events if (e.get('governance') or {}).get('bypassed_fact_checker') or (e.get('governance') or {}).get('raw_data_used')]
bypass_modules = sorted(list({(e.get('context') or {}).get('module') for e in bypass_events if (e.get('context') or {}).get('module')}))

# workflows still using raw assistant-style outputs: heuristic -> events that contain 'raw_ai_output' or 'assistant_output' in payload
raw_assistant_workflows = [e for e in events if isinstance(e.get('payload'), dict) and any(k in e['payload'] for k in ('raw_ai_output','assistant_output','raw_output'))]
raw_assistant_workflows_count = len(raw_assistant_workflows)

# missing traces: offers without traceability inputs mapping to opportunity
offers = [e for e in events if e.get('event_type') == 'OFFER_GENERATED']
missing_trace_offers = []
for o in offers:
    inputs = (o.get('traceability') or {}).get('inputs') or []
    if not inputs:
        missing_trace_offers.append(o)
    else:
        found = False
        for inp in inputs:
            if inp.get('entity_type') == 'opportunity' and inp.get('entity_id'):
                # check existence
                exists = any(((ev.get('context') or {}).get('trace_identity_refs') or []) and any((ref.get('entity_type') == 'opportunity' and ref.get('entity_id') == inp.get('entity_id')) for ref in (ev.get('context') or {}).get('trace_identity_refs')) for ev in events)
                if exists:
                    found = True
                    break
        if not found:
            missing_trace_offers.append(o)

missing_trace_count = len(missing_trace_offers)

# missing evidence links: evidence references that don't map to DOCUMENT_INGESTED or EVIDENCE_STORED
all_doc_ids = { (e.get('payload') or {}).get('doc_id') for e in events if e.get('event_type') in ('DOCUMENT_INGESTED','EVIDENCE_STORED') }
referenced_doc_ids = set()
for e in events:
    payload = e.get('payload') or {}
    for k in ('doc_id','id','profile_id'):
        if payload.get(k):
            referenced_doc_ids.add(payload.get(k))

missing_evidence_links = sorted(list(referenced_doc_ids - set([d for d in all_doc_ids if d])))

# ARS delta vs baseline 88.54
baseline = 88.54
ars_delta = round(ars.get('score', 0.0) - baseline, 2)

print('ARS score:', ars.get('score'))
print('ARS delta vs baseline 88.54:', ars_delta)
print('Evidence coverage (% events):', evidence_coverage)
print('Reasoning validation coverage (% events):', reasoning_coverage)
print('Blocked decision count:', blocked_decision_count)
print('Workflows with raw assistant-style outputs (heuristic count):', raw_assistant_workflows_count)
print('Modules bypassing cognitive pipeline (governance flags):', bypass_modules)
print('Missing traceable offers count:', missing_trace_count)
print('Missing evidence links (sample ids):', missing_evidence_links[:10])

# quick list of workflows still returning raw assistant outputs (sample)
if raw_assistant_workflows:
    print('\nSample raw assistant workflow events (first 5):')
    for e in raw_assistant_workflows[:5]:
        print('-', e.get('event_type'), (e.get('context') or {}).get('module'))
