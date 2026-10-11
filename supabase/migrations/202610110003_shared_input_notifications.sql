-- Only create partner notifications after a user actually submits shared data.
-- This extends the existing notifications table to include wants and cycle logs.

alter table public.relationship_notifications
  drop constraint if exists relationship_notifications_kind_check;
alter table public.relationship_notifications
  add constraint relationship_notifications_kind_check
  check (kind in (
    'message',
    'reply',
    'shared_checkin',
    'shared_want',
    'shared_cycle',
    'shared_symptom'
  ));

alter table public.relationship_notifications
  drop constraint if exists relationship_notifications_source_table_check;
alter table public.relationship_notifications
  add constraint relationship_notifications_source_table_check
  check (source_table in (
    'partner_messages',
    'relationship_checkins',
    'relationship_wants',
    'period_logs',
    'period_symptoms'
  ));

create or replace function private.notify_shared_want()
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
      (v_partner_id, new.user_id, 'shared_want', 'relationship_wants', new.id,
       'want:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_shared_want on public.relationship_wants;
create trigger notify_shared_want
  after insert on public.relationship_wants
  for each row execute function private.notify_shared_want();

create or replace function private.notify_shared_period_log()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_partner_id uuid;
  v_dedupe_key text;
begin
  if tg_op = 'UPDATE'
     and old.start_date is not distinct from new.start_date
     and old.end_date is not distinct from new.end_date
     and old.notes is not distinct from new.notes then
    return new;
  end if;

  v_partner_id := private.partner_user_id(new.user_id);
  if v_partner_id is not null then
    v_dedupe_key := 'cycle:' || new.id::text || ':' ||
      coalesce(new.updated_at, now())::text;
    insert into public.relationship_notifications
      (recipient_id, actor_id, kind, source_table, source_id, dedupe_key)
    values
      (v_partner_id, new.user_id, 'shared_cycle', 'period_logs', new.id, v_dedupe_key)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_shared_period_log on public.period_logs;
create trigger notify_shared_period_log
  after insert or update on public.period_logs
  for each row execute function private.notify_shared_period_log();

create or replace function private.notify_shared_period_symptom()
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
      (v_partner_id, new.user_id, 'shared_symptom', 'period_symptoms', new.id,
       'symptom:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_shared_period_symptom on public.period_symptoms;
create trigger notify_shared_period_symptom
  after insert on public.period_symptoms
  for each row execute function private.notify_shared_period_symptom();

revoke all on function private.notify_shared_want() from public, anon, authenticated;
revoke all on function private.notify_shared_period_log() from public, anon, authenticated;
revoke all on function private.notify_shared_period_symptom() from public, anon, authenticated;
