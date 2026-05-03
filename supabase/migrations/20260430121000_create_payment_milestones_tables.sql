begin;

create table if not exists public.offer_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  milestone_number integer not null,
  milestone_title varchar(255) not null,
  percentage numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  offer_total_snapshot numeric(15,2) not null default 0,
  amount numeric(15,2) generated always as (offer_total_snapshot * percentage / 100) stored,
  expected_days_after_contract integer,
  description text,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (offer_id, milestone_number)
);

create index if not exists idx_offer_payment_milestones_offer
  on public.offer_payment_milestones(offer_id, coalesce(sort_order, milestone_number));

create or replace function public.sync_offer_milestone_total_snapshot()
returns trigger
language plpgsql
as $$
begin
  select coalesce(o.total_amount, 0)
    into new.offer_total_snapshot
  from public.offers o
  where o.id = new.offer_id;

  return new;
end;
$$;

create or replace function public.refresh_offer_milestones_from_offer_total()
returns trigger
language plpgsql
as $$
begin
  update public.offer_payment_milestones
     set offer_total_snapshot = coalesce(new.total_amount, 0)
   where offer_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_offer_payment_milestones_sync_total on public.offer_payment_milestones;
create trigger trg_offer_payment_milestones_sync_total
before insert or update of offer_id, percentage
on public.offer_payment_milestones
for each row
execute function public.sync_offer_milestone_total_snapshot();

drop trigger if exists trg_offers_refresh_payment_milestones on public.offers;
create trigger trg_offers_refresh_payment_milestones
after update of total_amount
on public.offers
for each row
execute function public.refresh_offer_milestones_from_offer_total();

commit;
