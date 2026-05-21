-- ResumeRoster profile feature expansion.
-- Run this in the Supabase SQL editor before using editable profile details.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists tagline text,
  add column if not exists current_position text,
  add column if not exists college_location text,
  add column if not exists about text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists resume_highlight_id uuid references public.resumes(id) on delete set null;

update public.profiles
set current_position = target_role
where current_position is null
  and target_role is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar files are public" on storage.objects;
create policy "Avatar files are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

drop function if exists public.get_public_profile(uuid);

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
    select
      count(*)::int as submitted_count,
      count(*) filter (where status = 'closed')::int as closed_count
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
  ),
  best_roasts as (
    select count(*)::int as best_roast_count
    from (
      select
        roasts.author_id,
        rank() over (
          partition by roasts.resume_id
          order by roasts.helpful_votes desc, roasts.created_at asc
        ) as roast_rank,
        roasts.helpful_votes
      from public.roasts
      where roasts.helpful_votes > 0
        and roasts.is_deleted = false
    ) ranked_roasts
    where ranked_roasts.author_id = profile_id
      and ranked_roasts.roast_rank = 1
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
    coalesce(profiles.current_position, profiles.target_role) as current_position,
    profiles.college_location,
    profiles.about,
    profiles.skills,
    profiles.resume_highlight_id,
    profiles.roast_count,
    profiles.helpful_votes,
    (profiles.helpful_votes * 120 + profiles.roast_count * 60)::int as roast_points,
    case
      when coalesce(resume_stats.submitted_count, 0) = 0 then 0
      else least(
        96,
        greatest(
          0,
          round(
            (
              coalesce(received_stats.received_roast_count, 0) * 4
              + coalesce(received_stats.received_helpful_votes, 0) * 6
              + coalesce(resume_stats.closed_count, 0) * 10
            )::numeric / greatest(1, coalesce(resume_stats.submitted_count, 0))
          )::int
        )
      )
    end as resume_improvement,
    coalesce(resume_stats.submitted_count, 0)::int as resumes_submitted_count,
    profiles.roast_count as resumes_roasted_count,
    coalesce(best_roasts.best_roast_count, 0)::int as best_roast_count,
    coalesce(received_stats.received_roast_count, 0)::int as received_roast_count,
    coalesce(received_stats.received_helpful_votes, 0)::int as received_helpful_votes,
    profiles.created_at
  from public.profiles
  cross join resume_stats
  cross join received_stats
  cross join best_roasts
  where profiles.id = profile_id
  limit 1;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop function if exists public.get_public_profile_resumes(uuid, integer);

create or replace function public.get_public_profile_resumes(
  profile_id uuid,
  limit_count int default 12
)
returns table (
  id uuid,
  title text,
  status text,
  roast_count int,
  created_at timestamptz,
  is_highlight boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    resumes.id,
    resumes.title,
    resumes.status,
    resumes.roast_count,
    resumes.created_at,
    resumes.id = profiles.resume_highlight_id as is_highlight
  from public.resumes
  join public.profiles on profiles.id = resumes.user_id
  where resumes.user_id = profile_id
    and resumes.status in ('open', 'closed')
  order by
    (resumes.id = profiles.resume_highlight_id) desc,
    resumes.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_public_profile_resumes(uuid, int) to anon, authenticated;
