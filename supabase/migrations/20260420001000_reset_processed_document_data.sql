-- =============================================================================
-- Reset legacy processed document data so existing loaded documents can be
-- reprocessed with the latest section-scoped validation pipeline.
--
-- Scope: companies that already have uploaded documents.
-- =============================================================================

begin;

create temporary table _document_companies on commit drop as
select distinct company_id
from public.company_documents
where company_id is not null;

create temporary table _company_documents on commit drop as
select id, company_id
from public.company_documents
where company_id in (select company_id from _document_companies);

-- -----------------------------------------------------------------------------
-- Remove pipeline artifacts derived from prior processing runs
-- -----------------------------------------------------------------------------

delete from public.enrichment_logs
where company_id in (select company_id from _document_companies);

delete from public.actions
where company_id in (select company_id from _document_companies)
  and source_module = 'cascade-analysis';

delete from public.entities_raw_extracted
where company_id in (select company_id from _document_companies);

delete from public.knowledge_relationships
where document_id in (select id from _company_documents);

delete from public.knowledge_insights
where document_id in (select id from _company_documents);

delete from public.knowledge_data_points
where document_id in (select id from _company_documents);

delete from public.knowledge_entities
where document_id in (select id from _company_documents);

delete from public.document_chunks
where document_id in (select id from _company_documents);

delete from public.document_sections
where document_id in (select id from _company_documents);

delete from public.document_ingestion_runs
where document_id in (select id from _company_documents);

-- -----------------------------------------------------------------------------
-- Remove canonical/company records for companies with uploaded documents.
-- This guarantees a full clean rebuild from the loaded source documents.
-- -----------------------------------------------------------------------------

delete from public.orders
where company_id in (select company_id from _document_companies);

delete from public.opportunities
where company_id in (select company_id from _document_companies);

delete from public.offers
where company_id in (select company_id from _document_companies);

delete from public.customers
where company_id in (select company_id from _document_companies);

delete from public.company_contacts
where company_id in (select company_id from _document_companies);

delete from public.competitors
where company_id in (select company_id from _document_companies);

delete from public.products
where company_id in (select company_id from _document_companies);

delete from public.strategy
where company_id in (select company_id from _document_companies);

-- -----------------------------------------------------------------------------
-- Reset loaded documents so the latest pipeline can process them again.
-- -----------------------------------------------------------------------------

update public.company_documents d
set
  processing_status = 'pending',
  pipeline_stage = 'ingested',
  upload_section = coalesce(d.upload_section, d.category),
  extracted_data = '{}'::jsonb,
  raw_text = null,
  cleaned_text = null,
  parsed_structure = '{}'::jsonb,
  semantic_summary = '{}'::jsonb,
  quality_score = null,
  processing_trace = '{}'::jsonb
where d.company_id in (select company_id from _document_companies);

commit;
