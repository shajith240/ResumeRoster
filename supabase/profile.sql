-- Public roaster profile RPCs.
-- Run this once in Supabase SQL Editor after the core schema.

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  username text,
  college text,
  target_role text,
  roast_count int,
  helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.username,
    profiles.college,
    profiles.target_role,
    profiles.roast_count,
    profiles.helpful_votes,
    profiles.created_at
  from public.profiles
  where profiles.id = profile_id
  limit 1;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

create or replace function public.get_public_profile_roasts(
  profile_id uuid,
  limit_count int default 12
)
returns table (
  id uuid,
  resume_id uuid,
  resume_title text,
  resume_status text,
  content text,
  helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    roasts.id,
    roasts.resume_id,
    resumes.title as resume_title,
    resumes.status as resume_status,
    roasts.content,
    roasts.helpful_votes,
    roasts.created_at
  from public.roasts
  join public.resumes on resumes.id = roasts.resume_id
  where roasts.author_id = profile_id
    and resumes.status in ('open', 'closed')
  order by roasts.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_public_profile_roasts(uuid, int) to anon, authenticated;
