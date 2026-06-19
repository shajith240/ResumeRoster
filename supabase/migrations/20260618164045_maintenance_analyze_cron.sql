-- Nightly ANALYZE cron job to keep planner statistics fresh.
-- Supabase free tier shares autovacuum/autoanalyze with other tenants so
-- stale statistics are common. This runs at 3am UTC every night.
--
-- VACUUM cannot run inside a plpgsql function body (requires a top-level command);
-- ANALYZE can. Vacuum jobs are scheduled as separate direct SQL cron entries.

create or replace function public.run_maintenance_analyze()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  analyze public.profiles;
  analyze public.resumes;
  analyze public.roasts;
  analyze public.votes;
  analyze public.saved_resumes;
  analyze public.push_subscriptions;
  analyze public.notifications;
  analyze public.community_posts;
  analyze public.community_post_comments;
  analyze public.community_post_votes;
  analyze public.community_comment_votes;
  analyze public.community_post_attachments;
  analyze public.community_post_poll_options;
  analyze public.community_post_poll_votes;
  analyze public.resume_reads;
  analyze public.moderation_actions;
  analyze public.reviewer_applications;
  analyze public.app_presence_sessions;
  analyze public.active_user_sessions;
  analyze public.request_rate_limits;
  analyze public.upload_security_events;
end;
$$;

select cron.schedule(
  'linted-nightly-analyze',
  '0 3 * * *',
  'select public.run_maintenance_analyze()'
);
