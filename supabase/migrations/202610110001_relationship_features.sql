-- Relationship check-ins, wants, persistent in-app notifications and push settings.
-- The existing couples, couple_members, account_sessions and partner_messages
-- tables remain the source of account and message ownership.

create schema if not exists private;

create or replace function private.current_account_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select s.account_user_id
      from public.account_sessions s
      where s.device_user_id = auth.uid()
      order by s.updated_at desc nulls last
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function private.are_paired(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_a is not null
    and p_user_b is not null
    and p_user_a <> p_user_b
    and exists (
      select 1
      from public.couple_members a
      join public.couple_members b on b.couple_id = a.couple_id
      where a.user_id = p_user_a and b.user_id = p_user_b
    );
$$;

create or replace function private.partner_user_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select partner.user_id
  from public.couple_members mine
  join public.couple_members partner
    on partner.couple_id = mine.couple_id
   and partner.user_id <> mine.user_id
  where mine.user_id = p_user_id
  limit 1;
$$;

create or replace function private.current_account_role()
returns text
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select member.role::text
  from public.couple_members member
  where member.user_id = private.current_account_user_id()
  limit 1;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.current_account_user_id() to authenticated;
grant execute on function private.are_paired(uuid, uuid) to authenticated;
grant execute on function private.partner_user_id(uuid) to authenticated;
grant execute on function private.current_account_role() to authenticated;

create table if not exists public.relationship_wants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('affection', 'date', 'gift', 'food', 'care')),
  note text not null default '' check (char_length(note) <= 500),
  fulfilled boolean not null default false,
  fulfilled_by uuid references auth.users(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relationship_wants_user_created_idx
  on public.relationship_wants(user_id, created_at desc);

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

create table if not exists public.relationship_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('message', 'reply', 'shared_checkin')),
  source_table text not null check (source_table in ('partner_messages', 'relationship_checkins')),
  source_id uuid not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists relationship_notifications_recipient_created_idx
  on public.relationship_notifications(recipient_id, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  message_alerts boolean not null default true,
  reply_alerts boolean not null default true,
  shared_update_alerts boolean not null default true,
  preview_on_lock_screen boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.relationship_notifications(id) on delete cascade,
  token_hash text not null,
  expo_ticket_id text,
  status text not null check (status in ('sending', 'sent', 'error')),
  attempt_count integer not null default 1,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (notification_id, token_hash)
);

alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from anon, authenticated;
grant select, insert, update, delete on public.push_delivery_log to service_role;

alter table public.relationship_wants enable row level security;
alter table public.relationship_checkins enable row level security;
alter table public.relationship_notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists relationship_wants_read_pair on public.relationship_wants;
create policy relationship_wants_read_pair on public.relationship_wants
  for select to authenticated
  using (
    user_id = private.current_account_user_id()
    or private.are_paired(user_id, private.current_account_user_id())
  );
drop policy if exists relationship_wants_write_owner on public.relationship_wants;
create policy relationship_wants_write_owner on public.relationship_wants
  for all to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());

drop policy if exists relationship_checkins_read_shared on public.relationship_checkins;
create policy relationship_checkins_read_shared on public.relationship_checkins
  for select to authenticated
  using (
    user_id = private.current_account_user_id()
    or (share_with_partner and private.are_paired(user_id, private.current_account_user_id()))
  );
drop policy if exists relationship_checkins_write_owner on public.relationship_checkins;
create policy relationship_checkins_write_owner on public.relationship_checkins
  for all to authenticated
  using (
    user_id = private.current_account_user_id()
    and private.current_account_role() = 'girlfriend'
  )
  with check (
    user_id = private.current_account_user_id()
    and private.current_account_role() = 'girlfriend'
  );

drop policy if exists relationship_notifications_read_recipient on public.relationship_notifications;
create policy relationship_notifications_read_recipient on public.relationship_notifications
  for select to authenticated
  using (recipient_id = private.current_account_user_id());

drop policy if exists notification_preferences_owner on public.notification_preferences;
create policy notification_preferences_owner on public.notification_preferences
  for all to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());

drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens
  for all to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());

grant select, insert, delete on public.relationship_wants to authenticated;
grant select, insert, update, delete on public.relationship_checkins to authenticated;
grant select on public.relationship_notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;

create or replace function public.toggle_partner_want_fulfilled(p_want_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := private.current_account_user_id();
begin
  update public.relationship_wants w
     set fulfilled = not w.fulfilled,
         fulfilled_by = case when not w.fulfilled then v_user_id else null end,
         fulfilled_at = case when not w.fulfilled then now() else null end,
         updated_at = now()
   where w.id = p_want_id
     and (w.user_id = v_user_id or private.are_paired(w.user_id, v_user_id));
  if not found then raise exception 'Want not found for this couple'; end if;
end;
$$;

create or replace function public.mark_relationship_notifications_read(p_notification_ids uuid[])
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update public.relationship_notifications
     set read_at = coalesce(read_at, now())
   where id = any(coalesce(p_notification_ids, '{}'::uuid[]))
     and recipient_id = private.current_account_user_id();
$$;

revoke all on function public.toggle_partner_want_fulfilled(uuid) from public;
revoke all on function public.mark_relationship_notifications_read(uuid[]) from public;
grant execute on function public.toggle_partner_want_fulfilled(uuid) to authenticated;
grant execute on function public.mark_relationship_notifications_read(uuid[]) to authenticated;

create or replace function private.notify_new_partner_message()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_kind text;
begin
  if new.sender_id is null or new.recipient_id is null
     or new.sender_id = new.recipient_id
     or not private.are_paired(new.sender_id, new.recipient_id) then
    raise exception 'Messages must be between paired accounts';
  end if;

  v_kind := case when new.parent_id is null then 'message' else 'reply' end;
  insert into public.relationship_notifications
    (recipient_id, actor_id, kind, source_table, source_id, dedupe_key)
  values
    (new.recipient_id, new.sender_id, v_kind, 'partner_messages', new.id,
     'message:' || new.id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notify_new_partner_message on public.partner_messages;
create trigger notify_new_partner_message
  after insert on public.partner_messages
  for each row execute function private.notify_new_partner_message();

create or replace function private.notify_shared_checkin()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_partner_id uuid;
begin
  if tg_op = 'INSERT' and new.share_with_partner then
    v_partner_id := private.partner_user_id(new.user_id);
    if v_partner_id is not null then
      insert into public.relationship_notifications
        (recipient_id, actor_id, kind, source_table, source_id, dedupe_key)
      values
        (v_partner_id, new.user_id, 'shared_checkin', 'relationship_checkins', new.id,
         'checkin:' || new.id::text || ':' || extract(epoch from new.updated_at)::text)
      on conflict (dedupe_key) do nothing;
    end if;
  elsif tg_op = 'UPDATE'
     and new.share_with_partner
     and (old.share_with_partner is distinct from new.share_with_partner
          or old.feeling is distinct from new.feeling
          or old.note is distinct from new.note
          or old.intensity is distinct from new.intensity) then
    v_partner_id := private.partner_user_id(new.user_id);
    if v_partner_id is not null then
      insert into public.relationship_notifications
        (recipient_id, actor_id, kind, source_table, source_id, dedupe_key)
      values
        (v_partner_id, new.user_id, 'shared_checkin', 'relationship_checkins', new.id,
         'checkin:' || new.id::text || ':' || extract(epoch from new.updated_at)::text)
      on conflict (dedupe_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_shared_checkin on public.relationship_checkins;
create trigger notify_shared_checkin
  after insert or update on public.relationship_checkins
  for each row execute function private.notify_shared_checkin();

-- Guard existing partner message access even if older permissive policies remain.
alter table public.partner_messages enable row level security;
drop policy if exists partner_messages_app_select on public.partner_messages;
create policy partner_messages_app_select on public.partner_messages
  for select to authenticated using (true);
drop policy if exists partner_messages_app_insert on public.partner_messages;
create policy partner_messages_app_insert on public.partner_messages
  for insert to authenticated with check (true);
drop policy if exists partner_messages_app_update on public.partner_messages;
create policy partner_messages_app_update on public.partner_messages
  for update to authenticated using (true) with check (true);

drop policy if exists partner_messages_pair_select_guard on public.partner_messages;
create policy partner_messages_pair_select_guard on public.partner_messages
  as restrictive for select to authenticated
  using (
    private.are_paired(sender_id, recipient_id)
    and (sender_id = private.current_account_user_id()
         or recipient_id = private.current_account_user_id())
  );
drop policy if exists partner_messages_pair_insert_guard on public.partner_messages;
create policy partner_messages_pair_insert_guard on public.partner_messages
  as restrictive for insert to authenticated
  with check (
    sender_id = private.current_account_user_id()
    and private.are_paired(sender_id, recipient_id)
  );
drop policy if exists partner_messages_recipient_update_guard on public.partner_messages;
create policy partner_messages_recipient_update_guard on public.partner_messages
  as restrictive for update to authenticated
  using (recipient_id = private.current_account_user_id()
         and private.are_paired(sender_id, recipient_id))
  with check (recipient_id = private.current_account_user_id()
              and private.are_paired(sender_id, recipient_id));

revoke update, delete on public.partner_messages from authenticated;
grant select, insert on public.partner_messages to authenticated;
grant update (read_at) on public.partner_messages to authenticated;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['partner_messages', 'relationship_notifications', 'relationship_checkins'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
