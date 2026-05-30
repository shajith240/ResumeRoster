-- Linted 0032: Web Push subscriptions.
-- Stores browser push endpoints per signed-in profile. The notifications table
-- remains the source of truth; this table only controls phone delivery.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 2048),
  constraint push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 20 and 512),
  constraint push_subscriptions_auth_length_check
    check (char_length(auth) between 10 and 256),
  constraint push_subscriptions_user_agent_length_check
    check (user_agent is null or char_length(user_agent) <= 300)
);

alter table public.push_subscriptions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists endpoint text,
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists expiration_time timestamptz,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists revoked_at timestamptz;

update public.push_subscriptions
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now());

alter table public.push_subscriptions
  alter column user_id set not null,
  alter column endpoint set not null,
  alter column p256dh set not null,
  alter column auth set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_endpoint_key'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_key unique (endpoint);
  end if;
end $$;

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, updated_at desc)
  where revoked_at is null;

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists "Users can read their own push subscriptions"
  on public.push_subscriptions;
create policy "Users can read their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own push subscriptions"
  on public.push_subscriptions;
create policy "Users can create their own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own push subscriptions"
  on public.push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own push subscriptions"
  on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
