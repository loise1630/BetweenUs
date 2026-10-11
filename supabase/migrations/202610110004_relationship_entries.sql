-- Shared user-written entries for the Between Us feature collection.
create table if not exists public.relationship_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('unsaid', 'little_things', 'love_hate', 'bucket_list')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relationship_entries_type_created_idx
  on public.relationship_entries(entry_type, created_at desc);

alter table public.relationship_entries enable row level security;

drop policy if exists relationship_entries_read_pair on public.relationship_entries;
create policy relationship_entries_read_pair on public.relationship_entries
  for select to authenticated
  using (
    user_id = private.current_account_user_id()
    or private.are_paired(user_id, private.current_account_user_id())
  );

drop policy if exists relationship_entries_insert_owner on public.relationship_entries;
create policy relationship_entries_insert_owner on public.relationship_entries
  for insert to authenticated
  with check (user_id = private.current_account_user_id());

drop policy if exists relationship_entries_delete_owner on public.relationship_entries;
create policy relationship_entries_delete_owner on public.relationship_entries
  for delete to authenticated
  using (user_id = private.current_account_user_id());

grant select, insert, delete on public.relationship_entries to authenticated;

alter table public.relationship_notifications
  drop constraint if exists relationship_notifications_kind_check;
alter table public.relationship_notifications
  add constraint relationship_notifications_kind_check
  check (kind in (
    'message', 'reply', 'shared_checkin', 'shared_want', 'shared_cycle',
    'shared_symptom', 'shared_entry'
  ));

alter table public.relationship_notifications
  drop constraint if exists relationship_notifications_source_table_check;
alter table public.relationship_notifications
  add constraint relationship_notifications_source_table_check
  check (source_table in (
    'partner_messages', 'relationship_checkins', 'relationship_wants',
    'period_logs', 'period_symptoms', 'relationship_entries'
  ));

create or replace function private.notify_shared_relationship_entry()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_partner_id uuid;
begin
  v_partner_id := private.partner_user_id(new.user_id);
  if v_partner_id is not null then
    insert into public.relationship_notifications
      (recipient_id, actor_id, kind, source_table, source_id, dedupe_key)
    values
      (v_partner_id, new.user_id, 'shared_entry', 'relationship_entries', new.id,
       'entry:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_shared_relationship_entry on public.relationship_entries;
create trigger notify_shared_relationship_entry
  after insert on public.relationship_entries
  for each row execute function private.notify_shared_relationship_entry();
