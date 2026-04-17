create extension if not exists vector;

alter table public.company_documents
  add column if not exists raw_text text,
  add column if not exists cleaned_text text,
  add column if not exists parsed_structure jsonb default '{}'::jsonb,
  add column if not exists semantic_summary jsonb default '{}'::jsonb,
  add column if not exists quality_score numeric(5,2),
  add column if not exists processing_trace jsonb default '{}'::jsonb;

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

create index if not exists idx_document_ingestion_runs_document on public.document_ingestion_runs(document_id, started_at desc);
create index if not exists idx_document_sections_document on public.document_sections(document_id, order_index);
create index if not exists idx_document_chunks_document on public.document_chunks(document_id, chunk_type);
create index if not exists idx_knowledge_entities_document on public.knowledge_entities(document_id, entity_type);
create index if not exists idx_knowledge_relationships_document on public.knowledge_relationships(document_id, relation_type);
create index if not exists idx_knowledge_insights_document on public.knowledge_insights(document_id, insight_type);
create index if not exists idx_knowledge_data_points_document on public.knowledge_data_points(document_id, metric_name);

create or replace view public.document_ingestion_overview as
select
  d.id as document_id,
  d.company_id,
  d.file_name,
  d.category,
  d.processing_status,
  d.quality_score,
  d.created_at,
  coalesce((select count(*) from public.document_sections s where s.document_id = d.id), 0) as section_count,
  coalesce((select count(*) from public.document_chunks c where c.document_id = d.id), 0) as chunk_count,
  coalesce((select count(*) from public.knowledge_entities e where e.document_id = d.id), 0) as entity_count,
  coalesce((select count(*) from public.knowledge_relationships r where r.document_id = d.id), 0) as relationship_count,
  coalesce((select count(*) from public.knowledge_insights i where i.document_id = d.id), 0) as insight_count,
  coalesce((select count(*) from public.knowledge_data_points p where p.document_id = d.id), 0) as data_point_count
from public.company_documents d;
