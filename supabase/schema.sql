-- openGym data model for Supabase. Run this once in the Supabase SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  admin boolean not null default false,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create table if not exists public.invites (
  code text primary key,
  note text not null default '',
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workout_states enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.invites enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "state own row" on public.workout_states;
create policy "state own row" on public.workout_states for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push own rows" on public.push_subscriptions;
create policy "push own rows" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "invite read" on public.invites;
create policy "invite read" on public.invites for select using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
