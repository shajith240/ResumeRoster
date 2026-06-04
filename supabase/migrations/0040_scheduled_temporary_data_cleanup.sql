-- Linted 0040: scheduled cleanup for temporary database state.
-- Moves high-churn, non-user-content cleanup out of opportunistic RPC paths and
-- into a single pg_cron job with observable run history.

create extension if not exists pg_cron;

create or replace function public.run_temporary_data_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  presence_rows_removed integer := 0;
  active_session_rows_removed integer := 0;
  rate_limit_rows_removed integer := 0;
  cron_history_rows_removed integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('linted_temporary_data_cleanup'), 0) then
    return jsonb_build_object(
      'status', 'skipped_locked',
      'ran_at', now()
    );
  end if;

  delete from public.app_presence_sessions
  where app_presence_sessions.last_seen_at < now() - interval '5 minutes';
  get diagnostics presence_rows_removed = row_count;

  delete from public.active_user_sessions
  where active_user_sessions.expires_at < now() - interval '10 minutes';
  get diagnostics active_session_rows_removed = row_count;

  delete from public.request_rate_limits
  where request_rate_limits.updated_at < now() - interval '7 days';
  get diagnostics rate_limit_rows_removed = row_count;

  if to_regclass('cron.job_run_details') is not null then
    delete from cron.job_run_details
    where job_run_details.start_time < now() - interval '14 days';
    get diagnostics cron_history_rows_removed = row_count;
  end if;

  return jsonb_build_object(
    'active_session_rows_removed', active_session_rows_removed,
    'cron_history_rows_removed', cron_history_rows_removed,
    'presence_rows_removed', presence_rows_removed,
    'ran_at', now(),
    'rate_limit_rows_removed', rate_limit_rows_removed,
    'status', 'completed'
  );
end;
$$;

revoke all on function public.run_temporary_data_cleanup()
  from public, anon, authenticated;
grant execute on function public.run_temporary_data_cleanup()
  to service_role;

comment on function public.run_temporary_data_cleanup() is
  'Deletes expired app presence rows, expired active session locks, stale rate-limit buckets, and old pg_cron run history.';

comment on table public.app_presence_sessions is
  'Short-lived app presence heartbeats; stale rows are removed by linted-temporary-data-cleanup.';

comment on table public.active_user_sessions is
  'Short-lived single-browser session locks; expired rows are removed by linted-temporary-data-cleanup.';

comment on table public.request_rate_limits is
  'Private DB-backed rate limit buckets for authenticated write actions; buckets older than 7 days are removed by linted-temporary-data-cleanup.';

select cron.schedule(
  'linted-temporary-data-cleanup',
  '*/5 * * * *',
  $$select public.run_temporary_data_cleanup();$$
);

notify pgrst, 'reload schema';
