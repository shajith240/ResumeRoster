-- Linted 0030: qualify pgcrypto in write rate limits.
-- Supabase installs pgcrypto in the extensions schema. The rate-limit trigger
-- function must call extensions.digest explicitly so comment, vote, report, and
-- saved-resume writes do not fail at runtime.

create schema if not exists extensions;

do $$
declare
  current_extension_schema text;
begin
  select n.nspname
  into current_extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if current_extension_schema is null then
    create extension if not exists pgcrypto with schema extensions;
  elsif current_extension_schema <> 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end $$;

create or replace function public.enforce_authenticated_rate_limit(
  target_action text,
  window_seconds int,
  max_requests int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  active_role text := auth.role();
  limit_row record;
begin
  if active_role = 'service_role' then
    return;
  end if;

  if active_user is null then
    raise exception 'Sign in to continue.';
  end if;

  select *
  into limit_row
  from public.check_rate_limit(
    encode(extensions.digest('user:' || active_user::text, 'sha256'), 'hex'),
    target_action,
    window_seconds,
    max_requests
  );

  if not coalesce(limit_row.allowed, false) then
    raise exception 'Too many requests. Try again soon.';
  end if;
end;
$$;

revoke all on function public.enforce_authenticated_rate_limit(text, int, int) from public, anon, authenticated;
