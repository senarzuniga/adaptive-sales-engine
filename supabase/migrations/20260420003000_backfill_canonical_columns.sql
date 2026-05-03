begin;

alter table public.orders
  add column if not exists truth_source text not null default 'sales_document';

alter table public.offers
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists truth_source text not null default 'sales_document',
  add column if not exists total_value double precision default 0,
  add column if not exists value_confidence numeric(5,2),
  add column if not exists source_document_id uuid references public.company_documents(id) on delete set null;

commit;
