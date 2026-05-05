begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  department text not null default 'Commercial',
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_department_check check (department in ('Administration', 'Commercial', 'Engineering', 'Project Management', 'Service')),
  constraint profiles_role_check check (role in ('admin', 'user'))
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_department on public.profiles(department);

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb;
  resolved_name text;
  resolved_department text;
  resolved_role text;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name := nullif(trim(coalesce(metadata->>'name', split_part(coalesce(new.email, ''), '@', 1))), '');
  resolved_department := coalesce(nullif(metadata->>'department', ''), case when lower(coalesce(new.email, '')) like 'administracion%' then 'Administration' else 'Commercial' end);
  resolved_role := coalesce(nullif(metadata->>'role', ''), case when lower(coalesce(new.email, '')) like 'administracion%' then 'admin' else 'user' end);

  insert into public.profiles (id, email, name, department, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(resolved_name, 'Usuario'),
    case when resolved_department in ('Administration', 'Commercial', 'Engineering', 'Project Management', 'Service') then resolved_department else 'Commercial' end,
    case when resolved_role in ('admin', 'user') then resolved_role else 'user' end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    department = excluded.department,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_profile on auth.users;
create trigger on_auth_user_created_sync_profile
after insert or update on auth.users
for each row
execute function public.sync_profile_from_auth();

insert into public.profiles (id, email, name, department, role)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    nullif(trim(coalesce(users.raw_user_meta_data->>'name', split_part(coalesce(users.email, ''), '@', 1))), ''),
    'Usuario'
  ) as name,
  case
    when coalesce(users.raw_user_meta_data->>'department', '') in ('Administration', 'Commercial', 'Engineering', 'Project Management', 'Service')
      then users.raw_user_meta_data->>'department'
    when lower(coalesce(users.email, '')) like 'administracion%'
      then 'Administration'
    else 'Commercial'
  end as department,
  case
    when coalesce(users.raw_user_meta_data->>'role', '') in ('admin', 'user')
      then users.raw_user_meta_data->>'role'
    when lower(coalesce(users.email, '')) like 'administracion%'
      then 'admin'
    else 'user'
  end as role
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  department = excluded.department,
  role = excluded.role,
  updated_at = now();

commit;