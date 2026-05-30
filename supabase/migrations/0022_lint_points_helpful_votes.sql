-- Linted 0022: make lint points equal helpful votes.
-- Helpful votes are user-given likes on reviews, so profile and leaderboard
-- reputation should not include weighted placeholder scoring.

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  tagline text,
  college text,
  target_role text,
  current_position text,
  college_location text,
  about text,
  skills text[],
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_bio text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  reviewer_verified_at timestamptz,
  reviewer_verified_by uuid,
  resume_highlight_id uuid,
  roast_count int,
  helpful_votes int,
  roast_points int,
  resume_improvement int,
  resumes_submitted_count int,
  resumes_roasted_count int,
  best_roast_count int,
  received_roast_count int,
  received_helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with resume_stats as (
    select count(*)::int as submitted_count
    from public.resumes
    where user_id = profile_id
  ),
  received_stats as (
    select
      count(roasts.id)::int as received_roast_count,
      coalesce(sum(roasts.helpful_votes), 0)::int as received_helpful_votes
    from public.resumes
    left join public.roasts
      on roasts.resume_id = resumes.id
      and roasts.is_deleted = false
    where resumes.user_id = profile_id
  )
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.tagline,
    profiles.college,
    profiles.target_role,
    profiles.current_position,
    profiles.college_location,
    profiles.about,
    profiles.skills,
    profiles.community_role,
    profiles.reviewer_type,
    profiles.reviewer_headline,
    profiles.reviewer_bio,
    profiles.reviewer_expertise,
    profiles.reviewer_verification_status,
    profiles.reviewer_verified_at,
    profiles.reviewer_verified_by,
    profiles.resume_highlight_id,
    profiles.roast_count,
    profiles.helpful_votes,
    profiles.helpful_votes as roast_points,
    0::int as resume_improvement,
    coalesce(resume_stats.submitted_count, 0)::int as resumes_submitted_count,
    profiles.roast_count as resumes_roasted_count,
    0::int as best_roast_count,
    coalesce(received_stats.received_roast_count, 0)::int as received_roast_count,
    coalesce(received_stats.received_helpful_votes, 0)::int as received_helpful_votes,
    profiles.created_at
  from public.profiles
  cross join resume_stats
  cross join received_stats
  where profiles.id = profile_id
  limit 1;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop function if exists public.get_roaster_leaderboard(int);

create or replace function public.get_roaster_leaderboard(limit_count int default 100)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  roast_count int,
  helpful_votes int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.college,
    profiles.target_role,
    profiles.community_role,
    profiles.reviewer_type,
    profiles.reviewer_headline,
    profiles.reviewer_expertise,
    profiles.reviewer_verification_status,
    profiles.roast_count,
    profiles.helpful_votes
  from public.profiles
  where profiles.roast_count > 0 or profiles.helpful_votes > 0
  order by
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;

notify pgrst, 'reload schema';
