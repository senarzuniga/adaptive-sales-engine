from .event import ASEEvent
from .storage import Storage
import uuid


def _mk_ctx(tenant_id: str, module: str, workflow_id: str, correlation_id: str, trace_refs=None):
    return {"tenant_id": tenant_id, "module": module, "workflow_id": workflow_id, "correlation_id": correlation_id, "trace_identity_refs": trace_refs or []}


def run_company_onboarding(storage: Storage, tenant_id: str = "ACME"):
    corr = str(uuid.uuid4())
    # COMPANY_CREATED
    ev = ASEEvent(event_type="COMPANY_CREATED", context=_mk_ctx(tenant_id, "company", "company_lifecycle", corr), payload={"name": "ACME Ltd"}, actor={"type": "user", "id": "onboarder"})
    storage.append_event(ev)

    # COMPANY_SNAPSHOT_GENERATED
    ev2 = ASEEvent(event_type="COMPANY_SNAPSHOT_GENERATED", context=_mk_ctx(tenant_id, "company", "company_lifecycle", corr), payload={"snapshot": {"kpis": {}}}, actor={"type": "system"})
    storage.append_event(ev2)

    # Knowledge bootstrap: ingest a doc and approve
    doc_corr = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    ev3 = ASEEvent(event_type="DOCUMENT_INGESTED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", doc_corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "raw_data_used": False})
    storage.append_event(ev3)

    ev4 = ASEEvent(event_type="EVIDENCE_STORED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", doc_corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "evidence_id": str(uuid.uuid4())})
    storage.append_event(ev4)

    ev5 = ASEEvent(event_type="FACT_CHECK_COMPLETED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", doc_corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "fact_check_status": "approved", "confidence_score": 0.95})
    storage.append_event(ev5)

    ev6 = ASEEvent(event_type="KNOWLEDGE_APPROVED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", doc_corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "fact_check_status": "approved"})
    storage.append_event(ev6)

    return {"company_corr": corr, "doc_corr": doc_corr}


def run_lead_to_project(storage: Storage, tenant_id: str = "ACME"):
    corr = str(uuid.uuid4())
    # LEAD_CREATED
    lead_id = str(uuid.uuid4())
    ev1 = ASEEvent(event_type="LEAD_CREATED", context=_mk_ctx(tenant_id, "crm", "lead_flow", corr, trace_refs=[{"entity_type": "lead", "entity_id": lead_id}]), payload={"lead_id": lead_id})
    storage.append_event(ev1)

    # LEAD_QUALIFIED
    ev2 = ASEEvent(event_type="LEAD_QUALIFIED", context=_mk_ctx(tenant_id, "crm", "lead_flow", corr, trace_refs=[{"entity_type": "lead", "entity_id": lead_id}]), payload={"lead_id": lead_id})
    storage.append_event(ev2)

    # OPPORTUNITY_CREATED
    opp_id = str(uuid.uuid4())
    ev3 = ASEEvent(event_type="OPPORTUNITY_CREATED", context=_mk_ctx(tenant_id, "crm", "opportunity_flow", corr, trace_refs=[{"entity_type": "opportunity", "entity_id": opp_id}]), payload={"opportunity_id": opp_id})
    storage.append_event(ev3)

    # OFFER_GENERATED (traceability inputs to opportunity)
    offer_id = str(uuid.uuid4())
    ev4 = ASEEvent(event_type="OFFER_GENERATED", context=_mk_ctx(tenant_id, "commercial", "offer_flow", corr, trace_refs=[{"entity_type": "opportunity", "entity_id": opp_id}, {"entity_type": "offer", "entity_id": offer_id}]), payload={"offer_id": offer_id, "amount": 10000}, traceability={"inputs": [{"entity_type": "opportunity", "entity_id": opp_id}], "outputs": [{"entity_type": "offer", "entity_id": offer_id}]}, governance={"requires_fact_check": False})
    storage.append_event(ev4)

    # PRICE_CALCULATED and MARGIN_COMPUTED
    ev5 = ASEEvent(event_type="PRICE_CALCULATED", context=_mk_ctx(tenant_id, "commercial", "offer_flow", corr, trace_refs=[{"entity_type": "offer", "entity_id": offer_id}]), payload={"offer_id": offer_id, "price": 10000})
    storage.append_event(ev5)
    ev6 = ASEEvent(event_type="MARGIN_COMPUTED", context=_mk_ctx(tenant_id, "commercial", "offer_flow", corr, trace_refs=[{"entity_type": "offer", "entity_id": offer_id}]), payload={"offer_id": offer_id, "margin": 0.25})
    storage.append_event(ev6)

    # OFFER_APPROVED
    ev7 = ASEEvent(event_type="OFFER_APPROVED", context=_mk_ctx(tenant_id, "commercial", "offer_flow", corr, trace_refs=[{"entity_type": "offer", "entity_id": offer_id}]), payload={"offer_id": offer_id}, governance={"requires_fact_check": False, "fact_check_status": "approved"})
    storage.append_event(ev7)

    # PROJECT_CREATED
    project_id = str(uuid.uuid4())
    ev8 = ASEEvent(event_type="PROJECT_CREATED", context=_mk_ctx(tenant_id, "delivery", "project_flow", corr, trace_refs=[{"entity_type": "project", "entity_id": project_id}, {"entity_type": "offer", "entity_id": offer_id}]), payload={"project_id": project_id, "origin_offer": offer_id})
    storage.append_event(ev8)

    return {"lead_corr": corr, "opportunity_id": opp_id, "offer_id": offer_id, "project_id": project_id}


def run_document_ingestion_flow(storage: Storage, tenant_id: str = "ACME"):
    corr = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    ev1 = ASEEvent(event_type="DOCUMENT_INGESTED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "raw_data_used": False})
    storage.append_event(ev1)
    ev2 = ASEEvent(event_type="EVIDENCE_STORED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "evidence_id": str(uuid.uuid4())})
    storage.append_event(ev2)
    ev3 = ASEEvent(event_type="FACT_CHECK_COMPLETED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "fact_check_status": "approved", "confidence_score": 0.9})
    storage.append_event(ev3)
    ev4 = ASEEvent(event_type="KNOWLEDGE_APPROVED", context=_mk_ctx(tenant_id, "ingestion", "knowledge_ingestion", corr), payload={"doc_id": doc_id}, governance={"requires_fact_check": True, "fact_check_status": "approved"})
    storage.append_event(ev4)
    return {"doc_corr": corr, "doc_id": doc_id}


def run_daily_execution_flow(storage: Storage, tenant_id: str = "ACME"):
    corr = str(uuid.uuid4())
    ev1 = ASEEvent(event_type="DAILY_EXECUTION_GENERATED", context=_mk_ctx(tenant_id, "execution", "daily_execution", corr), payload={"date": "today"})
    storage.append_event(ev1)
    task_id = str(uuid.uuid4())
    ev2 = ASEEvent(event_type="TASK_GENERATED", context=_mk_ctx(tenant_id, "execution", "daily_execution", corr), payload={"task_id": task_id}, actor={"type": "system"})
    storage.append_event(ev2)
    ev3 = ASEEvent(event_type="NEXT_BEST_ACTION_CREATED", context=_mk_ctx(tenant_id, "execution", "daily_execution", corr), payload={"task_id": task_id}, actor={"type": "ai_agent"})
    storage.append_event(ev3)
    return {"daily_corr": corr, "task_id": task_id}


def run_all(storage: Storage):
    res = {}
    res.update(run_company_onboarding(storage))
    res.update(run_lead_to_project(storage))
    res.update(run_document_ingestion_flow(storage))
    res.update(run_daily_execution_flow(storage))
    return res
