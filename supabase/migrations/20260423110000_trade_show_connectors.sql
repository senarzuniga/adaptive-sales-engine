create table if not exists public.trade_show_events (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  trade_show_id text not null,
  status text not null default 'confirmed' check (status in ('planned', 'confirmed', 'executing', 'completed')),
  stand_size text not null default 'medium',
  location_within_event text,
  event_date date,
  venue text,
  objectives jsonb not null default '[]'::jsonb,
  key_messages jsonb not null default '[]'::jsonb,
  target_accounts jsonb not null default '[]'::jsonb,
  assigned_team jsonb not null default '[]'::jsonb,
  costs jsonb not null default '{}'::jsonb,
  roi jsonb not null default '{}'::jsonb,
  crm_export jsonb,
  linkedin_intelligence jsonb,
  travel_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_trade_show_events_company_trade_show
  on public.trade_show_events(company_id, trade_show_id);

create index if not exists idx_trade_show_events_company_date
  on public.trade_show_events(company_id, event_date desc nulls last);

create table if not exists public.trade_show_leads (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id text not null references public.trade_show_events(id) on delete cascade,
  name text not null,
  company text not null,
  role text,
  interest_level text not null default 'B' check (interest_level in ('A', 'B', 'C')),
  notes text,
  next_action text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_show_leads_company_event
  on public.trade_show_leads(company_id, event_id, created_at desc);

create table if not exists public.trade_show_history (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id text not null references public.trade_show_events(id) on delete cascade,
  action_type text not null,
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_show_history_company_event
  on public.trade_show_history(company_id, event_id, created_at desc);