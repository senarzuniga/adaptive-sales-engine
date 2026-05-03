create table if not exists public.regeneration_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  initiated_by text,
  reason text not null default 'regeneration_after_protocol_upgrade',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'waiting_manual_resolution', 'completed', 'failed', 'rolled_back', 'dry_run')),
  keep_templates boolean not null default false,
  dry_run boolean not null default false,
  purge_mode text not null default 'hard' check (purge_mode in ('soft', 'hard')),
  pre_entity_count integer not null default 0,
  post_entity_count integer not null default 0,
  pre_document_count integer not null default 0,
  post_document_count integer not null default 0,
  entities_processed integer not null default 0,
  documents_processed integer not null default 0,
  contradictions_found integer not null default 0,
  contradictions_resolved_automatically integer not null default 0,
  unresolved_contradictions integer not null default 0,
  agents_executed jsonb not null default '[]'::jsonb,
  execution_log jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_regeneration_logs_company_started
  on public.regeneration_logs(company_id, started_at desc);

create table if not exists public.regeneration_backups (
  id uuid primary key default gen_random_uuid(),
  regeneration_id uuid not null references public.regeneration_logs(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  backup_tag text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_regeneration_backups_regeneration
  on public.regeneration_backups(regeneration_id);

alter table public.regeneration_logs enable row level security;
alter table public.regeneration_backups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'regeneration_logs' and policyname = 'Allow all access to regeneration logs'
  ) then
    create policy "Allow all access to regeneration logs"
      on public.regeneration_logs for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'regeneration_backups' and policyname = 'Allow all access to regeneration backups'
  ) then
    create policy "Allow all access to regeneration backups"
      on public.regeneration_backups for all using (true) with check (true);
  end if;
end
$$;
