-- Expand products model to support rich catalog ingestion and pricing/stock metadata.
alter table public.products
  add column if not exists sku text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists brand text,
  add column if not exists description text,
  add column if not exists currency text default 'EUR',
  add column if not exists list_price numeric default 0,
  add column if not exists unit_cost numeric default 0,
  add column if not exists selling_price numeric default 0,
  add column if not exists average_margin numeric default 0,
  add column if not exists stock_quantity numeric default 0,
  add column if not exists stock_unit text,
  add column if not exists lead_time_days integer,
  add column if not exists moq numeric,
  add column if not exists packaging text,
  add column if not exists attributes jsonb default '{}'::jsonb,
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists markets text[] default '{}'::text[],
  add column if not exists lifecycle_stage text default 'core',
  add column if not exists status text default 'active',
  add column if not exists is_active boolean default true,
  add column if not exists source_document text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists confidence_score numeric default 0,
  add column if not exists last_seen_at timestamptz default now();

create unique index if not exists products_company_sku_unique_idx
  on public.products (company_id, sku)
  where sku is not null and btrim(sku) <> '';

create index if not exists products_company_status_idx
  on public.products (company_id, status);

create index if not exists products_company_category_idx
  on public.products (company_id, category);
