begin;

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  panel_key text not null,
  prompt_key text not null,
  prompt text not null,
  intent text not null,
  action_taken text not null,
  context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  feedback text,
  confidence numeric(5,4) not null default 0,
  auto_apply boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_memory_company_panel
  on public.agent_memory(company_id, panel_key, created_at desc);

create index if not exists idx_agent_memory_prompt
  on public.agent_memory(panel_key, prompt_key, auto_apply);

create table if not exists public.panel_changes_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  panel text not null,
  panel_key text not null,
  prompt text not null,
  change text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  agent_confidence numeric(5,4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_panel_changes_log_company_panel
  on public.panel_changes_log(company_id, panel_key, created_at desc);

create table if not exists public.goa_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null default 'pending',
  updated_patterns integer not null default 0,
  updated_rules integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (run_date)
);

commit;
