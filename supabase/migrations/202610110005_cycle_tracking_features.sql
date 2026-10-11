-- Private girlfriend health/activity logs. Only the owner can read or write these rows.
create table if not exists public.cycle_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  mood text,
  energy_level integer check (energy_level between 1 and 5),
  flow_intensity text check (flow_intensity in ('light', 'medium', 'heavy')),
  cravings text[] not null default '{}',
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  water_glasses integer not null default 0 check (water_glasses between 0 and 100),
  exercise_minutes integer not null default 0 check (exercise_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
alter table public.cycle_daily_logs enable row level security;
drop policy if exists cycle_daily_logs_owner_all on public.cycle_daily_logs;
create policy cycle_daily_logs_owner_all on public.cycle_daily_logs
  for all to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());
grant select, insert, update, delete on public.cycle_daily_logs to authenticated;

-- The girlfriend's quick status is intentionally partner-visible; health logs above are not.
create table if not exists public.relationship_daily_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  status text not null check (status in ('Need cuddles', 'Need space', 'Feeling great', 'Low energy')),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);
alter table public.relationship_daily_status enable row level security;
drop policy if exists relationship_daily_status_pair_read on public.relationship_daily_status;
create policy relationship_daily_status_pair_read on public.relationship_daily_status
  for select to authenticated
  using (user_id = private.current_account_user_id() or private.are_paired(user_id, private.current_account_user_id()));
drop policy if exists relationship_daily_status_owner_write on public.relationship_daily_status;
create policy relationship_daily_status_owner_write on public.relationship_daily_status
  for all to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());
grant select, insert, update, delete on public.relationship_daily_status to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cycle_daily_logs') then
      alter publication supabase_realtime add table public.cycle_daily_logs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relationship_daily_status') then
      alter publication supabase_realtime add table public.relationship_daily_status;
    end if;
  end if;
end;
$$;
