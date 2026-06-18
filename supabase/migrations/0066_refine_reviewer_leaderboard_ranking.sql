-- Linted 0066: quality-first reviewer leaderboard ranking.
-- Ranks from live review rows so leaderboard state cannot drift from profile counters.

create index if not exists roasts_live_created_author_helpful_idx
  on public.roasts (created_at desc, author_id)
  include (helpful_votes)
  where is_deleted = false;

create index if not exists roasts_live_author_helpful_created_idx
  on public.roasts (author_id, helpful_votes desc, created_at desc)
  include (resume_id, content)
  where is_deleted = false;

drop function if exists public.get_reviewer_leaderboard(int);

create or replace function public.get_reviewer_leaderboard(limit_count int default 100)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  current_position text,
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  review_count int,
  helpful_votes int,
  lint_points int
)
language sql
stable
security definer
set search_path = public
as $$
  with reviewer_stats as (
    select
      roasts.author_id,
      count(roasts.id)::int as review_count,
      coalesce(sum(roasts.helpful_votes), 0)::int as helpful_votes
    from public.roasts
    where roasts.is_deleted = false
    group by roasts.author_id
  )
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.college,
    profiles.target_role,
    coalesce(profiles.current_position, profiles.target_role) as current_position,
    profiles.community_role,
    profiles.reviewer_type,
    profiles.reviewer_headline,
    profiles.reviewer_expertise,
    profiles.reviewer_verification_status,
    reviewer_stats.review_count,
    reviewer_stats.helpful_votes,
    (reviewer_stats.helpful_votes * 5 + least(reviewer_stats.review_count, 50))::int as lint_points
  from reviewer_stats
  join public.profiles on profiles.id = reviewer_stats.author_id
  where reviewer_stats.review_count > 0 or reviewer_stats.helpful_votes > 0
  order by
    (reviewer_stats.helpful_votes * 5 + least(reviewer_stats.review_count, 50)) desc,
    reviewer_stats.helpful_votes desc,
    reviewer_stats.review_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_reviewer_leaderboard(int) to anon, authenticated;

drop function if exists public.get_reviewer_leaderboard_since(timestamptz, int);

create or replace function public.get_reviewer_leaderboard_since(
  since_at timestamptz,
  limit_count int default 100
)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  current_position text,
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  review_count int,
  helpful_votes int,
  lint_points int
)
language sql
stable
security definer
set search_path = public
as $$
  with reviewer_stats as (
    select
      roasts.author_id,
      count(roasts.id)::int as review_count,
      coalesce(sum(roasts.helpful_votes), 0)::int as helpful_votes
    from public.roasts
    where roasts.is_deleted = false
      and roasts.created_at >= since_at
    group by roasts.author_id
  )
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.college,
    profiles.target_role,
    coalesce(profiles.current_position, profiles.target_role) as current_position,
    profiles.community_role,
    profiles.reviewer_type,
    profiles.reviewer_headline,
    profiles.reviewer_expertise,
    profiles.reviewer_verification_status,
    reviewer_stats.review_count,
    reviewer_stats.helpful_votes,
    (reviewer_stats.helpful_votes * 5 + least(reviewer_stats.review_count, 50))::int as lint_points
  from reviewer_stats
  join public.profiles on profiles.id = reviewer_stats.author_id
  where reviewer_stats.review_count > 0 or reviewer_stats.helpful_votes > 0
  order by
    (reviewer_stats.helpful_votes * 5 + least(reviewer_stats.review_count, 50)) desc,
    reviewer_stats.helpful_votes desc,
    reviewer_stats.review_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_reviewer_leaderboard_since(timestamptz, int) to anon, authenticated;

notify pgrst, 'reload schema';
