-- =============================================================================
-- Activity Log  —  shared cross-user event stream ("open office")
-- Every significant user action (save company, run agents, add contact…)
-- is written here so the whole team can see what is happening in real time.
-- =============================================================================

create table if not exists public.activity_log (
    id           bigserial primary key,
    user_id      text        not null,
    user_email   text        not null default '',
    user_name    text        not null default '',
    action_type  text        not null,         -- e.g. company_saved, agents_run, action_created
    description  text        not null default '',
    entity_type  text,                         -- e.g. company, action, insight, offer
    entity_id    text,                         -- uuid of the affected entity
    company_id   uuid        references public.companies(id) on delete set null,
    metadata     jsonb       not null default '{}'::jsonb,
    created_at   timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx  on public.activity_log (created_at desc);
create index if not exists activity_log_user_id_idx     on public.activity_log (user_id);
create index if not exists activity_log_company_id_idx  on public.activity_log (company_id);
create index if not exists activity_log_action_type_idx on public.activity_log (action_type);

-- RLS: all authenticated users can read and insert (no update/delete)
alter table public.activity_log enable row level security;

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select"
    on public.activity_log for select
    to authenticated
    using (true);

drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert"
    on public.activity_log for insert
    to authenticated
    with check (true);

-- Also allow service-role writes (for admin / orchestrator paths)
drop policy if exists "activity_log_service_insert" on public.activity_log;
create policy "activity_log_service_insert"
    on public.activity_log for insert
    to service_role
    with check (true);

-- =============================================================================
-- Add company_id to companies RLS (make it readable by all authenticated users)
-- =============================================================================
alter table public.companies enable row level security;

drop policy if exists "companies_select" on public.companies;
create policy "companies_select"
    on public.companies for select
    to authenticated
    using (true);

drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert"
    on public.companies for insert
    to authenticated
    with check (true);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update"
    on public.companies for update
    to authenticated
    using (true)
    with check (true);

-- Allow service_role full access
drop policy if exists "companies_service_all" on public.companies;
create policy "companies_service_all"
    on public.companies for all
    to service_role
    using (true)
    with check (true);
