-- Public leaderboard RPC.
-- Run this once in Supabase SQL Editor after the core schema.

drop function if exists public.get_roaster_leaderboard(int);

create or replace function public.get_roaster_leaderboard(limit_count int default 10)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
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
    profiles.roast_count,
    profiles.helpful_votes
  from public.profiles
  where profiles.roast_count > 0 or profiles.helpful_votes > 0
  order by
    (profiles.helpful_votes * 120 + profiles.roast_count * 60) desc,
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;
