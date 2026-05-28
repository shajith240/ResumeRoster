-- Linted 0013: professional reviewer identity, trust applications, and reviewer discovery.

alter table public.profiles
  add column if not exists community_role text not null default 'candidate',
  add column if not exists reviewer_type text,
  add column if not exists reviewer_headline text,
  add column if not exists reviewer_bio text,
  add column if not exists reviewer_expertise text[] not null default '{}'::text[],
  add column if not exists reviewer_verification_status text not null default 'none',
  add column if not exists reviewer_verified_at timestamptz,
  add column if not exists reviewer_verified_by uuid references public.profiles(id) on delete set null;

update public.profiles
set
  community_role = coalesce(community_role, 'candidate'),
  reviewer_expertise = coalesce(reviewer_expertise, '{}'::text[]),
  reviewer_verification_status = coalesce(reviewer_verification_status, 'none');

alter table public.profiles
  alter column community_role set default 'candidate',
  alter column community_role set not null,
  alter column reviewer_expertise set default '{}'::text[],
  alter column reviewer_expertise set not null,
  alter column reviewer_verification_status set default 'none',
  alter column reviewer_verification_status set not null,
  drop constraint if exists profiles_community_role_check,
  drop constraint if exists profiles_reviewer_type_check,
  drop constraint if exists profiles_reviewer_verification_status_check,
  drop constraint if exists profiles_reviewer_headline_length_check,
  drop constraint if exists profiles_reviewer_bio_length_check,
  drop constraint if exists profiles_reviewer_expertise_count_check,
  add constraint profiles_community_role_check
    check (community_role in ('candidate', 'reviewer', 'both')),
  add constraint profiles_reviewer_type_check
    check (
      reviewer_type is null
      or reviewer_type in (
        'student',
        'placed_professional',
        'recruiter',
        'hiring_manager',
        'engineer',
        'designer',
        'product_manager',
        'career_coach',
        'founder',
        'other'
      )
    ),
  add constraint profiles_reviewer_verification_status_check
    check (reviewer_verification_status in ('none', 'pending', 'verified', 'rejected')),
  add constraint profiles_reviewer_headline_length_check
    check (reviewer_headline is null or char_length(reviewer_headline) <= 90),
  add constraint profiles_reviewer_bio_length_check
    check (reviewer_bio is null or char_length(reviewer_bio) <= 280),
  add constraint profiles_reviewer_expertise_count_check
    check (cardinality(reviewer_expertise) <= 12);

create index if not exists profiles_reviewer_directory_idx
  on public.profiles (
    reviewer_verification_status,
    reviewer_type,
    roast_count desc,
    helpful_votes desc
  )
  where community_role in ('reviewer', 'both');

grant insert (
  community_role,
  reviewer_type,
  reviewer_headline,
  reviewer_bio,
  reviewer_expertise
) on public.profiles to authenticated;

grant update (
  community_role,
  reviewer_type,
  reviewer_headline,
  reviewer_bio,
  reviewer_expertise
) on public.profiles to authenticated;

create table if not exists public.reviewer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_type text not null,
  expertise text[] not null default '{}'::text[],
  proof_url text not null default '',
  note text not null default '',
  status text not null default 'pending',
  admin_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviewer_applications
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists requested_type text,
  add column if not exists expertise text[] not null default '{}'::text[],
  add column if not exists proof_url text not null default '',
  add column if not exists note text not null default '',
  add column if not exists status text not null default 'pending',
  add column if not exists admin_note text not null default '',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.reviewer_applications
set
  requested_type = coalesce(requested_type, 'other'),
  expertise = coalesce(expertise, '{}'::text[]),
  proof_url = coalesce(proof_url, ''),
  note = coalesce(note, ''),
  status = coalesce(status, 'pending'),
  admin_note = coalesce(admin_note, ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.reviewer_applications
  alter column user_id set not null,
  alter column requested_type set not null,
  alter column expertise set default '{}'::text[],
  alter column expertise set not null,
  alter column proof_url set default '',
  alter column proof_url set not null,
  alter column note set default '',
  alter column note set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column admin_note set default '',
  alter column admin_note set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists reviewer_applications_requested_type_check,
  drop constraint if exists reviewer_applications_status_check,
  drop constraint if exists reviewer_applications_proof_url_length_check,
  drop constraint if exists reviewer_applications_note_length_check,
  drop constraint if exists reviewer_applications_admin_note_length_check,
  drop constraint if exists reviewer_applications_expertise_count_check,
  add constraint reviewer_applications_requested_type_check
    check (
      requested_type in (
        'student',
        'placed_professional',
        'recruiter',
        'hiring_manager',
        'engineer',
        'designer',
        'product_manager',
        'career_coach',
        'founder',
        'other'
      )
    ),
  add constraint reviewer_applications_status_check
    check (status in ('pending', 'approved', 'rejected')),
  add constraint reviewer_applications_proof_url_length_check
    check (char_length(proof_url) <= 240),
  add constraint reviewer_applications_note_length_check
    check (char_length(note) <= 600),
  add constraint reviewer_applications_admin_note_length_check
    check (char_length(admin_note) <= 600),
  add constraint reviewer_applications_expertise_count_check
    check (cardinality(expertise) <= 12);

create unique index if not exists reviewer_applications_user_unique_idx
  on public.reviewer_applications (user_id);

create index if not exists reviewer_applications_status_updated_at_idx
  on public.reviewer_applications (status, updated_at desc);

alter table public.reviewer_applications enable row level security;

revoke all on table public.reviewer_applications from anon, authenticated;

drop policy if exists "Reviewer applications are private" on public.reviewer_applications;
create policy "Reviewer applications are private"
  on public.reviewer_applications for select
  to authenticated
  using (false);

create or replace function public.touch_reviewer_application_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_reviewer_application_updated on public.reviewer_applications;
create trigger on_reviewer_application_updated
  before update on public.reviewer_applications
  for each row execute procedure public.touch_reviewer_application_updated_at();

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check,
  drop constraint if exists moderation_actions_target_type_check,
  add constraint moderation_actions_action_check
    check (
      action in (
        'dismiss_report',
        'mark_report_reviewing',
        'mark_report_actioned',
        'remove_roast',
        'restore_roast',
        'close_resume',
        'reopen_resume',
        'hide_sticker',
        'show_sticker',
        'upload_sticker',
        'delete_sticker',
        'approve_reviewer',
        'reject_reviewer',
        'reset_reviewer'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (target_type in ('report', 'roast', 'resume', 'sticker', 'reviewer_application', 'profile'));

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
    (profiles.helpful_votes * 120 + profiles.roast_count * 60) desc,
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;

revoke all on function public.touch_reviewer_application_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';
