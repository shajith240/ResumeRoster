create or replace function public.is_profile_online(
  profile_id uuid,
  window_seconds int default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window interval := make_interval(secs => least(greatest(coalesce(window_seconds, 120), 30), 600));
  has_active_session boolean;
begin
  if profile_id is null then
    return false;
  end if;

  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  select exists (
    select 1
    from public.app_presence_sessions
    where user_id = profile_id
      and status <> 'offline'
      and last_seen_at >= now() - active_window
    limit 1
  )
  into has_active_session;

  return coalesce(has_active_session, false);
end;
$$;

revoke all on function public.is_profile_online(uuid, int) from public, anon, authenticated;
grant execute on function public.is_profile_online(uuid, int) to authenticated;

notify pgrst, 'reload schema';
