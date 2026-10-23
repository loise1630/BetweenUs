-- Let each partner edit their own shared entries while keeping partner entries read-only.
drop policy if exists relationship_entries_update_owner on public.relationship_entries;
create policy relationship_entries_update_owner on public.relationship_entries
  for update to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());

grant update (title, body, updated_at) on public.relationship_entries to authenticated;
