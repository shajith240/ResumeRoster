-- Revoke PUBLIC/anon execute on run_maintenance_analyze.
-- The function was created as SECURITY DEFINER without revoking public access,
-- leaving it callable by unauthenticated users via the REST API.
-- Only the pg_cron job needs to call it (runs as the DB owner, not via PostgREST).

revoke execute on function public.run_maintenance_analyze() from public;
revoke execute on function public.run_maintenance_analyze() from anon;
