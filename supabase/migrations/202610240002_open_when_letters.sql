create table if not exists public.open_when_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 100),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists open_when_letters_owner_created_idx
  on public.open_when_letters(user_id, created_at desc);

alter table public.open_when_letters enable row level security;

drop policy if exists open_when_letters_pair_read on public.open_when_letters;
create policy open_when_letters_pair_read on public.open_when_letters
  for select to authenticated
  using (
    user_id = private.current_account_user_id()
    or private.are_paired(user_id, private.current_account_user_id())
  );

drop policy if exists open_when_letters_owner_insert on public.open_when_letters;
create policy open_when_letters_owner_insert on public.open_when_letters
  for insert to authenticated
  with check (user_id = private.current_account_user_id());

drop policy if exists open_when_letters_owner_update on public.open_when_letters;
create policy open_when_letters_owner_update on public.open_when_letters
  for update to authenticated
  using (user_id = private.current_account_user_id())
  with check (user_id = private.current_account_user_id());

drop policy if exists open_when_letters_owner_delete on public.open_when_letters;
create policy open_when_letters_owner_delete on public.open_when_letters
  for delete to authenticated
  using (user_id = private.current_account_user_id());

grant select, insert, update, delete on public.open_when_letters to authenticated;
