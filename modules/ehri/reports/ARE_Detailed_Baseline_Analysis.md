# ARE Detailed Baseline Analysis

Total captured events: 36

## ASE Readiness Score (ARS)

{
  "score": 88.54,
  "breakdown": {
    "workflow_completion": 22.92,
    "knowledge_governance_integrity": 15.62,
    "entity_consistency": 15.0,
    "execution_layer": 15.0,
    "traceability": 10.0,
    "architecture_purity": 10.0
  },
  "violations": [],
  "total_events": 36
}

## Coverage (workflows)

Overall workflow coverage: 94.44%

## Failed Workflows

- company_lifecycle: missing ['COMPANY_UPDATED']

## Warnings

- {'type': 'missing_evidence_id', 'event': {'event_id': 'e8963985-53ce-4fde-9391-df241b016cba', 'timestamp': '2026-07-01T12:36:03.351104', 'event_type': 'DOCUMENT_INGESTED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': '9f855018-5cc3-4272-b548-1e2862269003', 'trace_identity_refs': []}, 'payload': {'doc_id': '8f4ecd66-608c-4987-a97b-407253a7703e'}, 'source': {}, 'governance': {'requires_fact_check': True, 'raw_data_used': False}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}
- {'type': 'missing_evidence_id', 'event': {'event_id': '32d8b97d-0650-4846-a25f-b6ab3c76905e', 'timestamp': '2026-07-01T12:36:03.376123', 'event_type': 'FACT_CHECK_COMPLETED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': '9f855018-5cc3-4272-b548-1e2862269003', 'trace_identity_refs': []}, 'payload': {'doc_id': '8f4ecd66-608c-4987-a97b-407253a7703e'}, 'source': {}, 'governance': {'requires_fact_check': True, 'fact_check_status': 'approved', 'confidence_score': 0.95}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}
- {'type': 'missing_evidence_id', 'event': {'event_id': 'ee0779e1-2ad4-4570-8bd3-dc7349931afd', 'timestamp': '2026-07-01T12:36:03.384742', 'event_type': 'KNOWLEDGE_APPROVED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': '9f855018-5cc3-4272-b548-1e2862269003', 'trace_identity_refs': []}, 'payload': {'doc_id': '8f4ecd66-608c-4987-a97b-407253a7703e'}, 'source': {}, 'governance': {'requires_fact_check': True, 'fact_check_status': 'approved'}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}
- {'type': 'missing_evidence_id', 'event': {'event_id': 'f92b7581-8393-4622-ba79-b23c500e224e', 'timestamp': '2026-07-01T12:36:03.511434', 'event_type': 'DOCUMENT_INGESTED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': 'b5cf2563-4fc5-4c54-888d-053fdad46af3', 'trace_identity_refs': []}, 'payload': {'doc_id': 'bf6a1c48-0897-4fab-83b1-186027a0fade'}, 'source': {}, 'governance': {'requires_fact_check': True, 'raw_data_used': False}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}
- {'type': 'missing_evidence_id', 'event': {'event_id': '7e7eed01-5976-4201-8129-ba96e07f7c6e', 'timestamp': '2026-07-01T12:36:03.556452', 'event_type': 'FACT_CHECK_COMPLETED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': 'b5cf2563-4fc5-4c54-888d-053fdad46af3', 'trace_identity_refs': []}, 'payload': {'doc_id': 'bf6a1c48-0897-4fab-83b1-186027a0fade'}, 'source': {}, 'governance': {'requires_fact_check': True, 'fact_check_status': 'approved', 'confidence_score': 0.9}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}
- {'type': 'missing_evidence_id', 'event': {'event_id': 'de253092-9d64-4d04-bf29-b01e0840ee1a', 'timestamp': '2026-07-01T12:36:03.577268', 'event_type': 'KNOWLEDGE_APPROVED', 'event_category': None, 'actor': {}, 'context': {'tenant_id': 'ACME', 'module': 'ingestion', 'workflow_id': 'knowledge_ingestion', 'correlation_id': 'b5cf2563-4fc5-4c54-888d-053fdad46af3', 'trace_identity_refs': []}, 'payload': {'doc_id': 'bf6a1c48-0897-4fab-83b1-186027a0fade'}, 'source': {}, 'governance': {'requires_fact_check': True, 'fact_check_status': 'approved'}, 'traceability': {'inputs': [], 'outputs': [], 'decisions': []}, 'impact': {'business_impact': 'low', 'financial_impact': 0.0, 'workflow_stage_change': None}}}

## Hard-fail violations

- None

## Architecture violations

- None

## Knowledge Governance violations

- None

## Traceability gaps

- None

## Entity duplication findings

- None

## Missing evidence chains

- None

## Missing confidence scores

- None

## Modules not exercised by the harness

- analytics
- product
- reporting

## Code coverage of business workflows (approx.)

- 94.44%

## Readiness by business domain

- CRM: 75.0% (3/4)
- Commercial: 100.0% (4/4)
- Projects: 100.0% (1/1)
- Knowledge: 100.0% (4/4)
- Execution Console: 100.0% (3/3)
- Reporting: 100.0% (1/1)
