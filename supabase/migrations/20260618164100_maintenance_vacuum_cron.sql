-- Nightly VACUUM cron jobs for high-write tables.
-- VACUUM must be issued as a direct SQL command (not inside a function), so each
-- table gets its own pg_cron entry starting at 3:30am UTC, one minute apart.
-- These reclaim dead tuple space that autovacuum deprioritises on the free tier.

select cron.schedule('linted-vacuum-saved-resumes',        '30 3 * * *', 'vacuum public.saved_resumes');
select cron.schedule('linted-vacuum-push-subscriptions',   '31 3 * * *', 'vacuum public.push_subscriptions');
select cron.schedule('linted-vacuum-community-post-votes', '32 3 * * *', 'vacuum public.community_post_votes');
select cron.schedule('linted-vacuum-profiles',             '33 3 * * *', 'vacuum public.profiles');
select cron.schedule('linted-vacuum-resumes',              '34 3 * * *', 'vacuum public.resumes');
select cron.schedule('linted-vacuum-roasts',               '35 3 * * *', 'vacuum public.roasts');
select cron.schedule('linted-vacuum-notifications',        '36 3 * * *', 'vacuum public.notifications');
select cron.schedule('linted-vacuum-votes',                '37 3 * * *', 'vacuum public.votes');
