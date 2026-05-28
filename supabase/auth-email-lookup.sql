-- Linted signup account lookup.
-- Run this in Supabase, then set SUPABASE_SERVICE_ROLE_KEY in Vercel/local env.
-- The function is only granted to service_role and must be called server-side.

create or replace function public.get_auth_email_state(target_email text)
returns table (
  account_exists boolean,
  providers text[],
  email_confirmed boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(target_email));
begin
  if normalized_email is null
    or normalized_email = ''
    or char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return query select false, array[]::text[], false;
    return;
  end if;

  return query
    select
      true as account_exists,
      coalesce(
        array_agg(distinct identities.provider order by identities.provider)
          filter (where identities.provider is not null),
        array[]::text[]
      ) as providers,
      users.email_confirmed_at is not null as email_confirmed
    from auth.users
    left join auth.identities
      on identities.user_id = users.id
    where lower(users.email) = normalized_email
    group by users.id, users.email_confirmed_at
    limit 1;

  if not found then
    return query select false, array[]::text[], false;
  end if;
end;
$$;

revoke all on function public.get_auth_email_state(text) from public;
revoke all on function public.get_auth_email_state(text) from anon;
revoke all on function public.get_auth_email_state(text) from authenticated;
grant execute on function public.get_auth_email_state(text) to service_role;
