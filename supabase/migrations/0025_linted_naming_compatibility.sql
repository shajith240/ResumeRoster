-- Linted 0025: non-breaking naming compatibility layer.
-- These views and RPCs expose Linted product language while the physical
-- production tables keep their legacy names for RLS, triggers, and deployed
-- client compatibility.

create or replace view public.resume_reviews
with (security_invoker = true)
as
select
  roasts.id,
  roasts.resume_id,
  roasts.parent_id as parent_review_id,
  roasts.author_id as reviewer_id,
  roasts.content,
  roasts.attachment_id,
  roasts.content_format,
  roasts.sticker_id,
  roasts.helpful_votes as lint_points,
  roasts.dislike_count,
  roasts.reply_count,
  roasts.is_deleted,
  roasts.deleted_at,
  roasts.created_at
from public.roasts;

grant select on public.resume_reviews to anon, authenticated;

create or replace view public.review_votes
with (security_invoker = true)
as
select
  votes.id,
  votes.roast_id as review_id,
  votes.voter_id,
  votes.reaction,
  votes.created_at
from public.votes;

grant select on public.review_votes to authenticated;

drop function if exists public.get_active_reviewer_count(int);

create or replace function public.get_active_reviewer_count(
  window_seconds int default 120
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.get_active_roaster_count(window_seconds);
$$;

grant execute on function public.get_active_reviewer_count(int) to authenticated;

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
  community_role text,
  reviewer_type text,
  reviewer_headline text,
  reviewer_expertise text[],
  reviewer_verification_status text,
  review_count int,
  lint_points int
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
    profiles.roast_count as review_count,
    profiles.helpful_votes as lint_points
  from public.profiles
  where profiles.roast_count > 0 or profiles.helpful_votes > 0
  order by
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 100));
$$;

grant execute on function public.get_reviewer_leaderboard(int) to anon, authenticated;

drop function if exists public.get_public_profile_reviews(uuid, int);

create or replace function public.get_public_profile_reviews(
  profile_id uuid,
  limit_count int default 20
)
returns table (
  id uuid,
  resume_id uuid,
  resume_title text,
  resume_status text,
  content text,
  lint_points int,
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
    roasts.helpful_votes as lint_points,
    roasts.created_at
  from public.roasts
  join public.resumes on resumes.id = roasts.resume_id
  where roasts.author_id = profile_id
    and roasts.is_deleted = false
  order by roasts.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_public_profile_reviews(uuid, int) to anon, authenticated;

drop function if exists public.report_content(text, uuid, uuid, uuid, text, text);

create or replace function public.report_content(
  report_target_type text,
  target_resume_id uuid default null,
  target_roast_id uuid default null,
  target_profile_id uuid default null,
  report_reason text default 'other',
  report_details text default ''
)
returns table (
  id uuid,
  status text,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  raw_target_type text := lower(trim(coalesce(report_target_type, '')));
  normalized_target_type text := case
    when raw_target_type in ('review', 'resume_review') then 'roast'
    else raw_target_type
  end;
  normalized_reason text := lower(trim(coalesce(report_reason, 'other')));
  normalized_details text := trim(coalesce(report_details, ''));
  target_resume record;
  target_roast record;
  target_profile record;
  existing_report_id uuid;
  next_report record;
  resolved_resume_id uuid := target_resume_id;
  resolved_profile_id uuid := target_profile_id;
  resolved_reported_user_id uuid;
begin
  if active_user is null then
    raise exception 'Sign in to report content.';
  end if;

  if normalized_target_type not in ('resume', 'roast', 'profile') then
    raise exception 'Choose valid content to report.';
  end if;

  if normalized_reason not in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(normalized_details) > 800 then
    raise exception 'Keep report details under 800 characters.';
  end if;

  if normalized_target_type = 'resume' then
    if target_resume_id is null or target_roast_id is not null or target_profile_id is not null then
      raise exception 'Choose one resume to report.';
    end if;

    select resumes.id, resumes.user_id, resumes.status
    into target_resume
    from public.resumes
    where resumes.id = target_resume_id
      and resumes.status in ('open', 'closed');

    if not found then
      raise exception 'This resume is not available to report.';
    end if;

    if target_resume.user_id = active_user then
      raise exception 'You cannot report your own resume.';
    end if;

    resolved_reported_user_id := target_resume.user_id;
  elsif normalized_target_type = 'roast' then
    if target_roast_id is null or target_profile_id is not null then
      raise exception 'Choose one review to report.';
    end if;

    select
      roasts.id,
      roasts.resume_id,
      roasts.author_id,
      roasts.is_deleted,
      resumes.status as resume_status
    into target_roast
    from public.roasts
    join public.resumes on resumes.id = roasts.resume_id
    where roasts.id = target_roast_id;

    if not found
      or target_roast.is_deleted
      or target_roast.resume_status not in ('open', 'closed') then
      raise exception 'This review is not available to report.';
    end if;

    if target_roast.author_id = active_user then
      raise exception 'You cannot report your own review.';
    end if;

    resolved_resume_id := target_roast.resume_id;
    resolved_reported_user_id := target_roast.author_id;
  else
    if target_profile_id is null or target_resume_id is not null or target_roast_id is not null then
      raise exception 'Choose one profile to report.';
    end if;

    select profiles.id
    into target_profile
    from public.profiles
    where profiles.id = target_profile_id;

    if not found then
      raise exception 'This profile is not available to report.';
    end if;

    if target_profile.id = active_user then
      raise exception 'You cannot report your own profile.';
    end if;

    resolved_profile_id := target_profile.id;
    resolved_reported_user_id := target_profile.id;
  end if;

  select content_reports.id
  into existing_report_id
  from public.content_reports
  where content_reports.reporter_id = active_user
    and content_reports.status = 'pending'
    and (
      (
        normalized_target_type = 'resume'
        and content_reports.target_type = 'resume'
        and content_reports.resume_id = target_resume_id
      )
      or (
        normalized_target_type = 'roast'
        and content_reports.target_type = 'roast'
        and content_reports.roast_id = target_roast_id
      )
      or (
        normalized_target_type = 'profile'
        and content_reports.target_type = 'profile'
        and content_reports.profile_id = target_profile_id
      )
    )
  limit 1
  for update;

  if existing_report_id is not null then
    update public.content_reports
    set
      reason = normalized_reason,
      details = normalized_details,
      report_count = content_reports.report_count + 1,
      last_reported_at = now()
    where content_reports.id = existing_report_id
    returning content_reports.id, content_reports.status
    into next_report;

    id := next_report.id;
    status := next_report.status;
    was_duplicate := true;
    return next;
    return;
  end if;

  insert into public.content_reports (
    reporter_id,
    reported_user_id,
    resume_id,
    roast_id,
    profile_id,
    target_type,
    reason,
    details,
    report_count,
    last_reported_at
  )
  values (
    active_user,
    resolved_reported_user_id,
    case when normalized_target_type = 'resume' then resolved_resume_id when normalized_target_type = 'roast' then resolved_resume_id else null end,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
    case when normalized_target_type = 'profile' then resolved_profile_id else null end,
    normalized_target_type,
    normalized_reason,
    normalized_details,
    1,
    now()
  )
  returning content_reports.id, content_reports.status
  into next_report;

  id := next_report.id;
  status := next_report.status;
  was_duplicate := false;
  return next;
end;
$$;

revoke all on function public.report_content(text, uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
