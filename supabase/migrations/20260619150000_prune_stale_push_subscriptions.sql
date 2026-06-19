-- pg_cron job: prune stale and revoked push subscriptions.
--
-- Deletes rows that are:
--   (a) explicitly revoked (revoked_at IS NOT NULL), OR
--   (b) not seen in 30 days (last_seen_at < now - 30 days)
--
-- Runs daily at 03:00 UTC — low-traffic window, once per day is enough.
-- Does not interfere with the Vercel Hobby 1/day limit (pg_cron runs in Supabase Postgres).

create or replace function public.prune_stale_push_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions
  where revoked_at is not null
     or last_seen_at < now() - interval '30 days';
end;
$$;

revoke all on function public.prune_stale_push_subscriptions() from public;
revoke all on function public.prune_stale_push_subscriptions() from anon;
revoke all on function public.prune_stale_push_subscriptions() from authenticated;

-- Idempotent unschedule before scheduling.
select cron.unschedule('linted-prune-push-subscriptions')
where exists (
  select 1 from cron.job where jobname = 'linted-prune-push-subscriptions'
);

select cron.schedule(
  'linted-prune-push-subscriptions',
  '0 3 * * *',
  $cron$select public.prune_stale_push_subscriptions();$cron$
);
