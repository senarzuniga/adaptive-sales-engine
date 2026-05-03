begin;

create table if not exists public.offer_cost_concepts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  concept_name varchar(255) not null,
  total_cost numeric(15,2) not null,
  cost_type varchar(50) default 'direct',
  supplier_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_offer_cost_concepts_offer
  on public.offer_cost_concepts(offer_id, created_at);

create table if not exists public.offer_supplier_payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  cost_concept_id uuid references public.offer_cost_concepts(id) on delete cascade,
  milestone_number integer not null,
  milestone_title varchar(255) not null,
  percentage_of_concept numeric(5,2) not null check (percentage_of_concept >= 0 and percentage_of_concept <= 100),
  amount numeric(15,2),
  expected_days_after_contract integer,
  supplier_name varchar(255),
  payment_terms varchar(100),
  description text,
  sort_order integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_offer_supplier_payments_offer
  on public.offer_supplier_payments(offer_id, coalesce(sort_order, milestone_number));

create index if not exists idx_offer_supplier_payments_concept
  on public.offer_supplier_payments(cost_concept_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entities'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    begin
      alter table public.offer_cost_concepts
        add constraint fk_offer_cost_concepts_supplier_entity
        foreign key (supplier_id) references public.entities(id) on delete set null;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

commit;
