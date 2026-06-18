-- Linted 0046: readiness health checks.
-- Exposes safe service-role-only operational state for the public health route.

create or replace function public.get_temporary_data_cleanup_health(
  max_success_age_seconds int default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  cleanup_job_id bigint;
  cleanup_active boolean := false;
  cleanup_schedule text;
  last_run_status text;
  last_run_started_at timestamptz;
  last_run_finished_at timestamptz;
  last_success_started_at timestamptz;
  last_success_finished_at timestamptz;
  max_success_age interval := make_interval(
    secs => least(greatest(coalesce(max_success_age_seconds, 1800), 60), 86400)
  );
  run_history_available boolean := to_regclass('cron.job_run_details') is not null;
  is_healthy boolean := false;
  last_run_ok boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Health readiness checks must use the service role.';
  end if;

  if to_regclass('cron.job') is null then
    return jsonb_build_object(
      'active', false,
      'configured', false,
      'healthy', false,
      'last_run_status', null,
      'last_run_started_at', null,
      'last_success_started_at', null,
      'message', 'Supabase Cron is not installed.',
      'run_history_available', false
    );
  end if;

  select jobid, active, schedule
  into cleanup_job_id, cleanup_active, cleanup_schedule
  from cron.job
  where jobname = 'linted-temporary-data-cleanup'
  limit 1;

  if cleanup_job_id is null then
    return jsonb_build_object(
      'active', false,
      'configured', false,
      'healthy', false,
      'last_run_status', null,
      'last_run_started_at', null,
      'last_success_started_at', null,
      'message', 'Temporary data cleanup cron job is missing.',
      'run_history_available', run_history_available
    );
  end if;

  if run_history_available then
    select status, start_time, end_time
    into last_run_status, last_run_started_at, last_run_finished_at
    from cron.job_run_details
    where jobid = cleanup_job_id
    order by start_time desc
    limit 1;

    select start_time, end_time
    into last_success_started_at, last_success_finished_at
    from cron.job_run_details
    where jobid = cleanup_job_id
      and lower(coalesce(status, '')) in ('completed', 'succeeded', 'success')
    order by start_time desc
    limit 1;
  end if;

  last_run_ok := last_run_started_at is null
    or lower(coalesce(last_run_status, '')) in ('completed', 'succeeded', 'success');

  is_healthy := coalesce(cleanup_active, false)
    and last_run_ok
    and (
      last_success_started_at is null
      or last_success_started_at >= now() - max_success_age
    );

  return jsonb_build_object(
    'active', cleanup_active,
    'configured', true,
    'healthy', is_healthy,
    'last_run_status', last_run_status,
    'last_run_started_at', last_run_started_at,
    'last_run_finished_at', last_run_finished_at,
    'last_success_started_at', last_success_started_at,
    'last_success_finished_at', last_success_finished_at,
    'message',
      case
        when not coalesce(cleanup_active, false) then 'Temporary data cleanup cron job is inactive.'
        when not last_run_ok then 'Temporary data cleanup cron job last run failed.'
        when last_success_started_at is not null
          and last_success_started_at < now() - max_success_age then 'Temporary data cleanup cron job has not succeeded recently.'
        else 'Temporary data cleanup cron job is scheduled.'
      end,
    'run_history_available', run_history_available,
    'schedule', cleanup_schedule
  );
end;
$$;

revoke all on function public.get_temporary_data_cleanup_health(int)
  from public, anon, authenticated;
grant execute on function public.get_temporary_data_cleanup_health(int)
  to service_role;

comment on function public.get_temporary_data_cleanup_health(int) is
  'Service-role-only readiness state for the linted-temporary-data-cleanup Supabase Cron job.';

notify pgrst, 'reload schema';
