-- Share only the girlfriend's mood, energy, period flow, and cravings with her partner.
-- Sleep, water, exercise, and supplement reminders remain private to her device/account.
create table if not exists public.relationship_daily_wellness (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  mood text,
  energy_level integer check (energy_level between 1 and 5),
  flow_intensity text check (flow_intensity in ('light', 'medium', 'heavy')),
  cravings text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- Preserve the shareable fields from existing girlfriend daily logs.
insert into public.relationship_daily_wellness (user_id, log_date, mood, energy_level, flow_intensity, cravings)
select logs.user_id, logs.log_date, logs.mood, logs.energy_level, logs.flow_intensity, logs.cravings
from public.cycle_daily_logs logs
join public.profiles p on p.id = logs.user_id and p.role::text = 'girlfriend'
on conflict (user_id, log_date) do nothing;

alter table public.relationship_daily_wellness enable row level security;
drop policy if exists relationship_daily_wellness_pair_read on public.relationship_daily_wellness;
create policy relationship_daily_wellness_pair_read on public.relationship_daily_wellness
  for select to authenticated
  using (user_id = private.current_account_user_id() or private.are_paired(user_id, private.current_account_user_id()));

drop policy if exists relationship_daily_wellness_girlfriend_write on public.relationship_daily_wellness;
create policy relationship_daily_wellness_girlfriend_write on public.relationship_daily_wellness
  for all to authenticated
  using (
    user_id = private.current_account_user_id()
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text = 'girlfriend')
  )
  with check (
    user_id = private.current_account_user_id()
    and exists (select 1 from public.profiles p where p.id = user_id and p.role::text = 'girlfriend')
  );

grant select, insert, update, delete on public.relationship_daily_wellness to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'relationship_daily_wellness'
    ) then
    alter publication supabase_realtime add table public.relationship_daily_wellness;
  end if;
end;
$$;
