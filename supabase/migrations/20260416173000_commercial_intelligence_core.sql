alter table public.orders
  add column if not exists truth_source text not null default 'sales_document';

alter table public.opportunities
  add column if not exists truth_source text not null default 'sales_document';

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

alter table public.offers
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists truth_source text not null default 'sales_document',
  add column if not exists total_value double precision default 0,
  add column if not exists value_confidence numeric(5,2),
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null;

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

create index if not exists idx_offer_products_offer on public.offer_products(offer_id);

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
