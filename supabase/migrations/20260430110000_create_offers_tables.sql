begin;

create table if not exists public.offer_serial_counters (
  year integer primary key,
  next_number integer not null default 100,
  updated_at timestamptz not null default now()
);

alter table public.offers
  add column if not exists serial_number varchar(32),
  add column if not exists version integer not null default 1,
  add column if not exists original_offer_id uuid references public.offers(id) on delete set null,
  add column if not exists version_group_id uuid default gen_random_uuid(),
  add column if not exists total_amount numeric(15,2) default 0,
  add column if not exists finalized_at timestamptz,
  add column if not exists valid_until date,
  add column if not exists offer_data jsonb not null default '{}'::jsonb,
  add column if not exists template_type varchar(30) default 'machine_selling',
  add column if not exists created_by text,
  add column if not exists last_modified_by text,
  add column if not exists client_entity_id text,
  add column if not exists client_entity_hash text;

update public.offers
set serial_number = coalesce(nullif(offer_number, ''), concat('OFF-', extract(year from created_at)::int, '-', lpad((row_number() over (order by created_at))::text, 3, '0')))
where serial_number is null;

alter table public.offers
  alter column serial_number set not null;

create unique index if not exists idx_offers_serial_number_unique
  on public.offers(serial_number);

create index if not exists idx_offers_version_group
  on public.offers(version_group_id, version desc);

create index if not exists idx_offers_client_entity_hash
  on public.offers(client_entity_hash);

create table if not exists public.offer_versions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  version_number integer not null,
  changes_summary text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_offer_versions_offer
  on public.offer_versions(offer_id, version_number desc);

create table if not exists public.offer_content_blocks (
  id uuid primary key default gen_random_uuid(),
  template_type varchar(50) not null,
  section_id varchar(100) not null,
  block_type varchar(50) not null default 'text',
  title varchar(255) not null,
  content text not null,
  variables jsonb not null default '{}'::jsonb,
  usage_count integer not null default 0,
  is_default boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_offer_content_blocks_template_section
  on public.offer_content_blocks(template_type, section_id);

create table if not exists public.offer_content_templates (
  id uuid primary key default gen_random_uuid(),
  template_name varchar(255) not null,
  template_type varchar(50) not null,
  structure jsonb not null,
  is_active boolean not null default true,
  version integer not null default 1
);

create or replace function public.get_next_offer_serial(p_year integer default null)
returns text
language plpgsql
as $$
declare
  target_year integer := coalesce(p_year, extract(year from now())::int);
  serial_number integer;
begin
  insert into public.offer_serial_counters(year, next_number)
  values (target_year, 100)
  on conflict (year) do nothing;

  update public.offer_serial_counters
     set next_number = next_number + 1,
         updated_at = now()
   where year = target_year
   returning next_number - 1 into serial_number;

  return format('OFF-%s-%s', target_year, lpad(serial_number::text, 3, '0'));
end;
$$;

create or replace function public.increment_offer_content_usage(p_block_id uuid)
returns void
language plpgsql
as $$
begin
  update public.offer_content_blocks
     set usage_count = usage_count + 1,
         last_used_at = now()
   where id = p_block_id;
end;
$$;

commit;
