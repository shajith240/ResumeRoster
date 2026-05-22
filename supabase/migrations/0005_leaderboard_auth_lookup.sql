-- ResumeRoster 0005: leaderboard and secure auth email lookup RPCs.

drop function if exists public.get_roaster_leaderboard(int);

create or replace function public.get_roaster_leaderboard(limit_count int default 100)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  roast_count int,
  helpful_votes int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.college,
    profiles.target_role,
    profiles.roast_count,
    profiles.helpful_votes
  from public.profiles
  where profiles.roast_count > 0 or profiles.helpful_votes > 0
  order by
    (profiles.helpful_votes * 120 + profiles.roast_count * 60) desc,
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;

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

notify pgrst, 'reload schema';
