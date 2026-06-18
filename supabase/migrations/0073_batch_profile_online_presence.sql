create or replace function public.get_online_profile_ids(
  profile_ids uuid[],
  window_seconds int default 120
)
returns table(user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window interval := make_interval(secs => least(greatest(coalesce(window_seconds, 120), 30), 600));
begin
  if profile_ids is null or cardinality(profile_ids) = 0 then
    return;
  end if;

  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  return query
  with requested_profiles as (
    select distinct requested.id
    from unnest(profile_ids) as requested(id)
    where requested.id is not null
    limit 200
  )
  select distinct sessions.user_id
  from requested_profiles
  join public.app_presence_sessions as sessions
    on sessions.user_id = requested_profiles.id
  where sessions.status <> 'offline'
    and sessions.last_seen_at >= now() - active_window;
end;
$$;

revoke all on function public.get_online_profile_ids(uuid[], int) from public, anon, authenticated;
grant execute on function public.get_online_profile_ids(uuid[], int) to authenticated;

notify pgrst, 'reload schema';
