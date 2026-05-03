-- Reset all processed, extracted, enriched, and analytical data derived from uploaded documents.
-- Raw uploaded documents in public.company_documents and storage remain untouched.

begin;

create temporary table _document_companies on commit drop as
select distinct company_id
from public.company_documents
where company_id is not null;

create temporary table _company_documents on commit drop as
select id, company_id
from public.company_documents
where company_id in (select company_id from _document_companies);

-- Remove generated analysis and enrichment artifacts.
delete from public.enrichment_logs
where company_id in (select company_id from _document_companies);

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

delete from public.actions
where company_id in (select company_id from _document_companies);

delete from public.insights
where company_id in (select company_id from _document_companies);

delete from public.business_intelligence_reports
where company_id in (select company_id from _document_companies);

-- Remove canonical entities derived from those documents.
delete from public.offer_products
where offer_id in (
  select id from public.offers where company_id in (select company_id from _document_companies)
);

delete from public.offers
where company_id in (select company_id from _document_companies);

delete from public.orders
where company_id in (select company_id from _document_companies);

delete from public.customers
where company_id in (select company_id from _document_companies);

delete from public.company_contacts
where company_id in (select company_id from _document_companies);

delete from public.products
where company_id in (select company_id from _document_companies);

delete from public.strategy
where company_id in (select company_id from _document_companies);

delete from public.competitors
where company_id in (select company_id from _document_companies);

-- Keep the loaded documents, but clear their prior derived traces so they can be rebuilt cleanly.
update public.company_documents
set
  processing_status = 'pending',
  extracted_data = '{}'::jsonb,
  parsed_structure = '{}'::jsonb,
  semantic_summary = '{}'::jsonb,
  quality_score = null,
  processing_trace = jsonb_build_object(
    'reset_at', now(),
    'reason', 'canonical-refinery-reset'
  )
where id in (select id from _company_documents);

commit;
