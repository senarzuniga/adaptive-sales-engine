-- =============================================================================
-- Document Pipeline Refactor Migration
-- Implements 3-layer storage architecture:
--   Layer 1 — documents_raw (company_documents with extended columns)
--   Layer 2 — entities_raw_extracted (section-scoped, pre-canonical)
--   Layer 3 — canonical tables (with universal meta structure)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- LAYER 1: Extend company_documents with upload_section and source_user
-- ---------------------------------------------------------------------------
alter table public.company_documents
  add column if not exists upload_section text,
  add column if not exists source_user    text,
  add column if not exists pipeline_stage text not null default 'ingested';

-- Backfill upload_section from category for existing rows
update public.company_documents
   set upload_section = category
 where upload_section is null;

-- ---------------------------------------------------------------------------
-- LAYER 2: Section-scoped extracted records (intermediate, pre-canonical)
-- ---------------------------------------------------------------------------
create table if not exists public.entities_raw_extracted (
  id                  uuid    primary key default gen_random_uuid(),
  document_id         uuid    not null references public.company_documents(id) on delete cascade,
  company_id          uuid    not null references public.companies(id) on delete cascade,

  -- Section context (immutable once set)
  upload_section      text    not null,
  schema_version      text    not null default '1.0',

  -- Extracted payload
  extracted_fields    jsonb   not null default '{}',
  missing_fields      jsonb   not null default '[]',
  anomalies           jsonb   not null default '[]',

  -- Quality metrics
  confidence_score    numeric(5,4) not null default 0,
  completeness_score  numeric(5,4) not null default 0,
  consistency_score   numeric(5,4) not null default 0,

  -- Pipeline outcome
  validation_status   text    not null default 'raw',  -- raw|validated|rejected|flagged|enriched
  rejection_reason    text,

  -- Traceability
  extraction_timestamp timestamptz not null default now(),
  source_type         text    not null default 'document',

  created_at          timestamptz not null default now()
);

create index if not exists idx_entities_raw_extracted_document  on public.entities_raw_extracted(document_id);
create index if not exists idx_entities_raw_extracted_company   on public.entities_raw_extracted(company_id, upload_section);
create index if not exists idx_entities_raw_extracted_status    on public.entities_raw_extracted(validation_status);

-- ---------------------------------------------------------------------------
-- Enrichment audit log
-- ---------------------------------------------------------------------------
create table if not exists public.enrichment_logs (
  id              uuid primary key default gen_random_uuid(),
  entity_table    text not null,
  entity_id       uuid not null,
  company_id      uuid not null references public.companies(id) on delete cascade,

  action          text not null,   -- field_filled|entity_merged|metric_derived|conflict_resolved|ai_inferred
  field_name      text,
  old_value       text,
  new_value       text,
  source          text,            -- historical|related_entity|derived|ai_inference

  confidence      numeric(5,4),
  is_ai_generated boolean not null default false,

  enrichment_run_id uuid,
  created_at      timestamptz not null default now()
);

create index if not exists idx_enrichment_logs_entity on public.enrichment_logs(entity_table, entity_id);
create index if not exists idx_enrichment_logs_company on public.enrichment_logs(company_id);
create index if not exists idx_enrichment_logs_run     on public.enrichment_logs(enrichment_run_id);

-- ---------------------------------------------------------------------------
-- LAYER 3: Universal meta columns on all canonical tables
-- validation_status lifecycle: raw → validated → enriched (or rejected / flagged)
-- ---------------------------------------------------------------------------

-- orders
alter table public.orders
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists margin_percentage     numeric(10,4),
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- opportunities
alter table public.opportunities
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists margin_percentage     numeric(10,4),
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- offers
alter table public.offers
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists margin_percentage     numeric(10,4),
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- customers
alter table public.customers
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- company_contacts
alter table public.company_contacts
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- competitors
alter table public.competitors
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- products
alter table public.products
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- strategy
alter table public.strategy
  add column if not exists source_document_id    uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type           text not null default 'document',
  add column if not exists extraction_timestamp  timestamptz,
  add column if not exists uploaded_section      text,
  add column if not exists confidence_score      numeric(5,4),
  add column if not exists completeness_score    numeric(5,4),
  add column if not exists consistency_score     numeric(5,4),
  add column if not exists validation_status     text not null default 'raw',
  add column if not exists record_version        integer not null default 1,
  add column if not exists raw_extracted_id      uuid references public.entities_raw_extracted(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Pipeline status view (aggregated across all layers)
-- ---------------------------------------------------------------------------
create or replace view public.document_pipeline_status as
select
  d.id                              as document_id,
  d.company_id,
  d.file_name,
  d.category,
  d.upload_section,
  d.pipeline_stage,
  d.processing_status,
  d.quality_score,
  d.created_at                      as ingested_at,
  -- Layer 2 summary
  coalesce(ext.extracted_count, 0)  as extracted_records,
  coalesce(ext.validated_count, 0)  as validated_records,
  coalesce(ext.rejected_count, 0)   as rejected_records,
  coalesce(ext.flagged_count, 0)    as flagged_records,
  ext.avg_confidence,
  -- Layer 3 summary (knowledge graph)
  coalesce(s.section_count, 0)      as section_count,
  coalesce(c.chunk_count, 0)        as chunk_count,
  coalesce(e.entity_count, 0)       as entity_count
from public.company_documents d
left join lateral (
  select
    count(*)                                     as extracted_count,
    count(*) filter (where validation_status = 'validated')   as validated_count,
    count(*) filter (where validation_status = 'rejected')    as rejected_count,
    count(*) filter (where validation_status = 'flagged')     as flagged_count,
    avg(confidence_score)                        as avg_confidence
  from public.entities_raw_extracted
  where document_id = d.id
) ext on true
left join lateral (
  select count(*) as section_count
  from public.document_sections
  where document_id = d.id
) s on true
left join lateral (
  select count(*) as chunk_count
  from public.document_chunks
  where document_id = d.id
) c on true
left join lateral (
  select count(*) as entity_count
  from public.knowledge_entities
  where document_id = d.id
) e on true;

-- ---------------------------------------------------------------------------
-- Validation report view
-- ---------------------------------------------------------------------------
create or replace view public.data_validation_report as
select
  upload_section,
  schema_version,
  count(*)                                                as total_records,
  count(*) filter (where validation_status = 'validated') as validated,
  count(*) filter (where validation_status = 'rejected')  as rejected,
  count(*) filter (where validation_status = 'flagged')   as flagged,
  round(avg(confidence_score)::numeric, 4)                as avg_confidence,
  round(avg(completeness_score)::numeric, 4)              as avg_completeness,
  round(avg(consistency_score)::numeric, 4)               as avg_consistency,
  max(extraction_timestamp)                               as last_extracted
from public.entities_raw_extracted
group by upload_section, schema_version;

-- ---------------------------------------------------------------------------
-- Enrichment summary view
-- ---------------------------------------------------------------------------
create or replace view public.data_enrichment_status as
select
  entity_table,
  action,
  is_ai_generated,
  count(*)                    as log_count,
  max(created_at)             as last_enriched
from public.enrichment_logs
group by entity_table, action, is_ai_generated;
