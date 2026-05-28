-- Linted active roaster heartbeat.
-- Run this in Supabase to count users currently using the app.

create table if not exists public.app_presence_sessions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'focus', 'offline')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_presence_sessions_last_seen_at_idx
  on public.app_presence_sessions (last_seen_at desc);

create index if not exists app_presence_sessions_user_id_idx
  on public.app_presence_sessions (user_id);

alter table public.app_presence_sessions enable row level security;

revoke all on public.app_presence_sessions from anon;
revoke all on public.app_presence_sessions from authenticated;

create or replace function public.clean_presence_session_id(raw_session_id text)
returns text
language sql
immutable
as $$
  select nullif(left(regexp_replace(coalesce(raw_session_id, ''), '[^a-zA-Z0-9:_-]+', '', 'g'), 120), '')
$$;

create or replace function public.record_app_presence(
  session_id text,
  app_status text default 'online'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_session_id text := public.clean_presence_session_id(session_id);
  normalized_status text := case
    when app_status in ('online', 'focus', 'offline') then app_status
    else 'online'
  end;
begin
  if auth.uid() is null or clean_session_id is null then
    return;
  end if;

  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;

  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  insert into public.app_presence_sessions (id, user_id, status, last_seen_at)
  values (clean_session_id, auth.uid(), normalized_status, now())
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    status = excluded.status,
    last_seen_at = now();
end;
$$;

create or replace function public.clear_app_presence(session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_session_id text := public.clean_presence_session_id(session_id);
begin
  if auth.uid() is null or clean_session_id is null then
    return;
  end if;

  delete from public.app_presence_sessions
  where id = clean_session_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.get_active_roaster_count(
  window_seconds int default 120
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window interval := make_interval(secs => least(greatest(coalesce(window_seconds, 120), 30), 600));
  active_count int;
begin
  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  select count(distinct user_id)::int
  into active_count
  from public.app_presence_sessions
  where last_seen_at >= now() - active_window;

  return coalesce(active_count, 0);
end;
$$;

grant execute on function public.record_app_presence(text, text) to authenticated;
grant execute on function public.clear_app_presence(text) to authenticated;
grant execute on function public.get_active_roaster_count(int) to authenticated;

notify pgrst, 'reload schema';
