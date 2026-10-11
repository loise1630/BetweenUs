-- Allow a girlfriend to share a short custom status alongside the suggested values.
alter table public.relationship_daily_status
  drop constraint if exists relationship_daily_status_status_check;

alter table public.relationship_daily_status
  add constraint relationship_daily_status_status_check
  check (char_length(btrim(status)) between 1 and 60);
