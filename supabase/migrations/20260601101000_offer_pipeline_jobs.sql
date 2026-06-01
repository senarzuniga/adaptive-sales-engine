-- Offer/request pipeline support
-- Creates request pool table (if missing), pipeline queue table and offer-change trigger.

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null default '',
  contact_name text default '',
  contact_email text default '',
  contact_phone text default '',
  description text default '',
  received_date date default current_date,
  deadline_preliminary_budget date,
  status text not null default 'new',
  decline_reason text,
  created_by uuid,
  converted_offer_id uuid references public.offers(id) on delete set null,
  linked_offer_id uuid references public.offers(id) on delete set null,
  source_app text default 'streamlit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_requests enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_requests'
      and policyname = 'Allow all access to customer_requests'
  ) then
    create policy "Allow all access to customer_requests"
      on public.customer_requests
      for all
      using (true)
      with check (true);
  end if;
end
$$;

create index if not exists idx_customer_requests_status
  on public.customer_requests(status);
create index if not exists idx_customer_requests_linked_offer
  on public.customer_requests(linked_offer_id);
create index if not exists idx_customer_requests_deadline
  on public.customer_requests(deadline_preliminary_budget);

-- Queue table used to decouple UI writes from agent processing.
create table if not exists public.pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  entity_type text not null,
  entity_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  source_app text not null default 'unknown',
  status text not null default 'pending',
  priority integer not null default 50,
  attempts integer not null default 0,
  not_before timestamptz,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pipeline_jobs enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pipeline_jobs'
      and policyname = 'Allow all access to pipeline_jobs'
  ) then
    create policy "Allow all access to pipeline_jobs"
      on public.pipeline_jobs
      for all
      using (true)
      with check (true);
  end if;
end
$$;

create index if not exists idx_pipeline_jobs_status_priority
  on public.pipeline_jobs(status, priority desc, created_at asc);
create index if not exists idx_pipeline_jobs_entity
  on public.pipeline_jobs(entity_type, entity_id);
create index if not exists idx_pipeline_jobs_company
  on public.pipeline_jobs(company_id);

drop trigger if exists update_customer_requests_updated_at on public.customer_requests;
create trigger update_customer_requests_updated_at
before update on public.customer_requests
for each row execute function public.update_updated_at_column();

drop trigger if exists update_pipeline_jobs_updated_at on public.pipeline_jobs;
create trigger update_pipeline_jobs_updated_at
before update on public.pipeline_jobs
for each row execute function public.update_updated_at_column();

create or replace function public.enqueue_offer_pipeline_job()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.pipeline_jobs (
    job_type,
    entity_type,
    entity_id,
    company_id,
    source_app,
    status,
    priority,
    payload
  ) values (
    case when tg_op = 'INSERT' then 'offer_saved' else 'offer_updated' end,
    'offer',
    new.id,
    new.company_id,
    'database_trigger',
    'pending',
    50,
    jsonb_build_object(
      'offer_number', coalesce(new.offer_number, ''),
      'status', coalesce(new.status, ''),
      'operation', tg_op,
      'changed_at', now()
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_offer_pipeline_job on public.offers;
create trigger trg_enqueue_offer_pipeline_job
after insert or update on public.offers
for each row execute function public.enqueue_offer_pipeline_job();
