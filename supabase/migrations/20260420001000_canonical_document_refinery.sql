begin;

create extension if not exists vector;

create table if not exists public.document_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_version text not null default 'v2-multi-agent',
  status text not null default 'processing',
  quality_score numeric(5,2),
  issues jsonb not null default '[]'::jsonb,
  summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.document_sections (
  id text primary key,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  heading text not null,
  level integer not null default 1,
  section_type text not null,
  content text not null,
  semantic_context text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id text primary key,
  run_id uuid not null references public.document_ingestion_runs(id) on delete cascade,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  section_id text references public.document_sections(id) on delete cascade,
  chunk_type text not null,
  content text not null,
  context text,
  semantic_context text,
  source_ref text,
  confidence numeric(5,4),
  embedding vector(16),
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_entities (
  id text primary key,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  canonical_name text not null,
  entity_type text not null,
  aliases jsonb not null default '[]'::jsonb,
  confidence numeric(5,4),
  source_chunk_id text references public.document_chunks(id) on delete set null,
  source_section_ref text,
  semantic_context text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_relationships (
  id text primary key,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  from_entity_id text not null references public.knowledge_entities(id) on delete cascade,
  to_entity_id text not null references public.knowledge_entities(id) on delete cascade,
  relation_type text not null,
  evidence text,
  confidence numeric(5,4),
  source_chunk_id text references public.document_chunks(id) on delete set null,
  semantic_context text,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_insights (
  id text primary key,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  insight_type text not null,
  summary text not null,
  evidence text,
  confidence numeric(5,4),
  source_chunk_id text references public.document_chunks(id) on delete set null,
  semantic_context text,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_data_points (
  id text primary key,
  document_id uuid not null references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_name text not null,
  metric_value_text text,
  metric_value_num double precision,
  unit text,
  confidence numeric(5,4),
  source_chunk_id text references public.document_chunks(id) on delete set null,
  semantic_context text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_name text not null,
  account_tier text,
  strategic_importance numeric(5,2),
  growth_potential numeric(5,2),
  relationship_strength numeric(5,2),
  operating_region text,
  sector text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_company_name on public.customers(company_id, customer_name);

create table if not exists public.offer_products (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  external_product_name text,
  manufacturer_name text,
  line_type text not null default 'product',
  quantity double precision not null default 1,
  unit_price double precision default 0,
  total_price double precision default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint offer_products_has_reference check (product_id is not null or external_product_name is not null)
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competitor_name text not null,
  product_family text,
  positioning text,
  price_positioning text,
  value_proposition text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium',
  expected_impact double precision default 0,
  required_effort text default 'medium',
  status text not null default 'todo',
  source_module text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  insight_type text not null,
  title text not null,
  summary text not null,
  confidence numeric(5,2),
  source_module text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.documents_raw (
  document_id uuid primary key references public.company_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  file_path text not null,
  upload_section text not null,
  uploaded_by uuid,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.entities_raw_extracted (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  section text not null,
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,4) not null default 0,
  source_document_id uuid not null references public.company_documents(id) on delete cascade,
  source_type text not null default 'document_upload',
  extraction_timestamp timestamptz not null default now(),
  uploaded_section text,
  completeness_score numeric(5,4) not null default 0,
  consistency_score numeric(5,4) not null default 0,
  validation_status text not null default 'raw_extracted',
  validation_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table if not exists public.enrichment_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_document_id uuid references public.company_documents(id) on delete set null,
  entity_table text,
  entity_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  confidence_after numeric(5,4),
  created_at timestamptz not null default now()
);

alter table public.company_documents
  add column if not exists raw_text text,
  add column if not exists cleaned_text text,
  add column if not exists parsed_structure jsonb default '{}'::jsonb,
  add column if not exists semantic_summary jsonb default '{}'::jsonb,
  add column if not exists quality_score numeric(5,2),
  add column if not exists processing_trace jsonb default '{}'::jsonb;

create index if not exists idx_documents_raw_company on public.documents_raw(company_id, timestamp desc);
create index if not exists idx_entities_raw_extracted_doc on public.entities_raw_extracted(source_document_id, section);
create index if not exists idx_entities_raw_extracted_company on public.entities_raw_extracted(company_id, validation_status);
create index if not exists idx_enrichment_logs_company on public.enrichment_logs(company_id, created_at desc);

alter table public.company_contacts
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.customers
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.offers
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.products
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.strategy
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

alter table public.competitors
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null,
  add column if not exists source_type text not null default 'document_upload',
  add column if not exists extraction_timestamp timestamptz not null default now(),
  add column if not exists uploaded_section text,
  add column if not exists confidence_score numeric(5,4) not null default 0,
  add column if not exists completeness_score numeric(5,4) not null default 0,
  add column if not exists consistency_score numeric(5,4) not null default 0,
  add column if not exists validation_status text not null default 'raw_extracted',
  add column if not exists version integer not null default 1,
  add column if not exists data_maturity text not null default 'validated',
  add column if not exists ai_insights jsonb not null default '{}'::jsonb,
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
  add column if not exists historical_tracking jsonb not null default '[]'::jsonb;

create or replace view public.documents_status as
select
  d.id as document_id,
  d.company_id,
  d.file_name,
  d.file_path,
  d.category as upload_section,
  d.processing_status,
  d.quality_score,
  coalesce(count(e.id), 0) as extracted_records,
  coalesce(sum(case when e.validation_status = 'validated' then 1 else 0 end), 0) as validated_records,
  coalesce(sum(case when e.validation_status in ('rejected', 'flagged') then 1 else 0 end), 0) as blocked_records,
  max(d.created_at) as created_at
from public.company_documents d
left join public.entities_raw_extracted e on e.source_document_id = d.id
group by d.id;

create or replace view public.data_validation_report as
select
  company_id,
  section,
  count(*) as total_records,
  sum(case when validation_status = 'validated' then 1 else 0 end) as validated,
  sum(case when validation_status = 'rejected' then 1 else 0 end) as rejected,
  avg(confidence_score) as avg_confidence
from public.entities_raw_extracted
group by company_id, section;

create or replace view public.data_enrichment_status as
select company_id, 'company_contacts' as entity_table, data_maturity, count(*) as records from public.company_contacts group by company_id, data_maturity
union all
select company_id, 'customers' as entity_table, data_maturity, count(*) as records from public.customers group by company_id, data_maturity
union all
select company_id, 'orders' as entity_table, data_maturity, count(*) as records from public.orders group by company_id, data_maturity
union all
select company_id, 'offers' as entity_table, data_maturity, count(*) as records from public.offers group by company_id, data_maturity
union all
select company_id, 'products' as entity_table, data_maturity, count(*) as records from public.products group by company_id, data_maturity
union all
select company_id, 'strategy' as entity_table, data_maturity, count(*) as records from public.strategy group by company_id, data_maturity
union all
select company_id, 'competitors' as entity_table, data_maturity, count(*) as records from public.competitors group by company_id, data_maturity;

create or replace view public.data_conflicts as
select
  company_id,
  source_document_id,
  entity_table,
  entity_id,
  action,
  details,
  confidence_after,
  created_at
from public.enrichment_logs
where action ilike '%conflict%'
   or action ilike '%flag%'
   or details ? 'alternative_values';

commit;
