-- Repair deployments where the app is present but the check-in table is not.
-- The relationship feature migration creates this table too; keeping this
-- idempotent repair makes applying migrations safe for databases with drift.

create table if not exists public.relationship_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  feeling text not null check (char_length(feeling) between 1 and 60),
  emoji text not null default '💛',
  intensity smallint not null default 5 check (intensity between 1 and 5),
  note text not null default '' check (char_length(note) <= 500),
  share_with_partner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relationship_checkins_user_updated_idx
  on public.relationship_checkins(user_id, updated_at desc);

alter table public.relationship_checkins enable row level security;

drop policy if exists relationship_checkins_read_shared
  on public.relationship_checkins;
create policy relationship_checkins_read_shared
  on public.relationship_checkins
  for select to authenticated
  using (
    user_id = private.current_account_user_id()
    or (
      share_with_partner
      and private.are_paired(user_id, private.current_account_user_id())
    )
  );

drop policy if exists relationship_checkins_write_owner
  on public.relationship_checkins;
create policy relationship_checkins_write_owner
  on public.relationship_checkins
  for all to authenticated
  using (
    user_id = private.current_account_user_id()
    and private.current_account_role() = 'girlfriend'
  )
  with check (
    user_id = private.current_account_user_id()
    and private.current_account_role() = 'girlfriend'
  );

grant select, insert, update, delete
  on public.relationship_checkins to authenticated;

notify pgrst, 'reload schema';
