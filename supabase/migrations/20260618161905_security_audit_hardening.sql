-- Linted 0075: security audit hardening.
-- Fixes identified via live DB audit on 2026-06-18.
--
-- Changes:
--   1. Revoke PUBLIC/anon/authenticated execute on rls_auto_enable (SECURITY DEFINER DDL function)
--   2. Drop redundant resumes SELECT policy that bypasses review_queue_status for authenticated users
--   3. Drop redundant roasts SELECT policy that bypasses review_queue_status for authenticated users
--   4. Fix community_posts UPDATE policy — authors can no longer unlock mod-locked posts
--   5. Revoke anon execute on refresh_community_poll_option_vote_count (DoS vector)
--   6. Revoke anon execute on touch_user_feedback_updated_at (unnecessary public exposure)
--   7. Fix clean_presence_session_id mutable search_path lint

-- 1. rls_auto_enable: this is an event trigger function that should never be
--    callable via the REST API. Revoke from all user-facing roles.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- 2. resumes: drop the looser authenticated-only SELECT policy.
--    The existing anon+authenticated policy already covers:
--      - Owners always see their own resumes (regardless of queue status)
--      - Everyone sees open/closed resumes with review_queue_status = 'active'
--    The second policy allowed authenticated users to bypass review_queue_status entirely,
--    exposing resumes that should be hidden from the feed (e.g. waiting, paused).
drop policy if exists "Visible resumes are readable by authenticated users" on public.resumes;

-- 3. roasts: same bypass — drop the authenticated-only SELECT policy.
--    The anon+authenticated policy already covers the resume owner, roast author,
--    and all roasts on active-queue resumes.
drop policy if exists "Roasts are readable by authenticated users" on public.roasts;

-- 4. community_posts: fix UPDATE policy so authors cannot modify mod-locked posts
--    or change status to/from 'locked'.
--    Previous qual allowed updating posts with status IN ('active','locked','held').
--    Previous with_check allowed setting status to any of those values.
--    Attack: author calls PATCH /rest/v1/community_posts to set status = 'active'
--            on a post a moderator had set to 'locked' — bypassing the mod action.
drop policy if exists "Community authors can edit active posts" on public.community_posts;
create policy "Community authors can edit active posts"
  on public.community_posts for update
  to authenticated
  using (
    (auth.uid() = author_id)
    and (status = any (array['active'::text, 'held'::text]))
  )
  with check (
    (auth.uid() = author_id)
    and (status = any (array['active'::text, 'held'::text]))
    and (post_type = any (array['question'::text, 'discussion'::text, 'resource'::text]))
  );

-- 5. refresh_community_poll_option_vote_count: no reason for anon to trigger
--    a full vote count recalculation. DoS risk via unauthenticated repeated calls.
revoke execute on function public.refresh_community_poll_option_vote_count() from public;
revoke execute on function public.refresh_community_poll_option_vote_count() from anon;

-- 6. touch_user_feedback_updated_at: internal trigger-style function, not a public API.
revoke execute on function public.touch_user_feedback_updated_at() from public;
revoke execute on function public.touch_user_feedback_updated_at() from anon;

-- 7. clean_presence_session_id: fix mutable search_path lint.
--    Function itself is IMMUTABLE and harmless; this silences the advisor warning
--    and follows the pinned search_path convention used across all other functions.
create or replace function public.clean_presence_session_id(raw_session_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(left(regexp_replace(coalesce(raw_session_id, ''), '[^a-zA-Z0-9:_-]+', '', 'g'), 120), '')
$$;

notify pgrst, 'reload schema';
