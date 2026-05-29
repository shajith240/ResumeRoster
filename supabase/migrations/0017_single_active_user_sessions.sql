-- Linted 0017: app-level single active browser session per user.

create table if not exists public.active_user_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  session_id text not null,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  constraint active_user_sessions_session_id_check
    check (
      char_length(session_id) between 16 and 128
      and session_id ~ '^[A-Za-z0-9:_-]+$'
    )
);

create index if not exists active_user_sessions_expires_at_idx
  on public.active_user_sessions (expires_at);

alter table public.active_user_sessions enable row level security;

revoke all on table public.active_user_sessions from anon, authenticated;

create or replace function public.clean_active_session_id(raw_session_id text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text := left(trim(coalesce(raw_session_id, '')), 128);
begin
  if cleaned ~ '^[A-Za-z0-9:_-]{16,128}$' then
    return cleaned;
  end if;

  return null;
end;
$$;

create or replace function public.claim_active_user_session(client_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_session_id text := public.clean_active_session_id(client_session_id);
begin
  if current_user_id is null or clean_session_id is null then
    return false;
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  delete from public.active_user_sessions
  where expires_at < now() - interval '10 minutes';

  insert into public.active_user_sessions (
    user_id,
    session_id,
    claimed_at,
    last_seen_at,
    expires_at
  )
  values (
    current_user_id,
    clean_session_id,
    now(),
    now(),
    now() + interval '2 minutes'
  )
  on conflict (user_id) do update
  set
    session_id = excluded.session_id,
    claimed_at = excluded.claimed_at,
    last_seen_at = excluded.last_seen_at,
    expires_at = excluded.expires_at;

  return true;
end;
$$;

create or replace function public.verify_active_user_session(client_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_session_id text := public.clean_active_session_id(client_session_id);
  existing_session_id text;
  existing_expires_at timestamptz;
begin
  if current_user_id is null or clean_session_id is null then
    return false;
  end if;

  select session_id, expires_at
  into existing_session_id, existing_expires_at
  from public.active_user_sessions
  where user_id = current_user_id;

  if not found then
    insert into public.active_user_sessions (
      user_id,
      session_id,
      claimed_at,
      last_seen_at,
      expires_at
    )
    values (
      current_user_id,
      clean_session_id,
      now(),
      now(),
      now() + interval '2 minutes'
    );

    return true;
  end if;

  if existing_session_id = clean_session_id or existing_expires_at <= now() then
    update public.active_user_sessions
    set
      session_id = clean_session_id,
      last_seen_at = now(),
      expires_at = now() + interval '2 minutes'
    where user_id = current_user_id;

    return true;
  end if;

  update public.active_user_sessions
  set
    last_seen_at = now(),
    expires_at = now() + interval '2 minutes'
  where user_id = current_user_id
    and session_id = clean_session_id
    and expires_at > now();

  return false;
end;
$$;

create or replace function public.release_active_user_session(client_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_session_id text := public.clean_active_session_id(client_session_id);
begin
  if current_user_id is null or clean_session_id is null then
    return;
  end if;

  delete from public.active_user_sessions
  where user_id = current_user_id
    and session_id = clean_session_id;
end;
$$;

revoke all on function public.clean_active_session_id(text) from public, anon, authenticated;
revoke all on function public.claim_active_user_session(text) from public, anon, authenticated;
revoke all on function public.verify_active_user_session(text) from public, anon, authenticated;
revoke all on function public.release_active_user_session(text) from public, anon, authenticated;

grant execute on function public.claim_active_user_session(text) to authenticated;
grant execute on function public.verify_active_user_session(text) to authenticated;
grant execute on function public.release_active_user_session(text) to authenticated;

notify pgrst, 'reload schema';
