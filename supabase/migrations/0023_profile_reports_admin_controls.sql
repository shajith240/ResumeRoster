-- Linted 0023: profile reporting and admin profile controls.
-- Adds profile reports as a first-class moderation target while keeping resume
-- report support for older/admin-only flows.

alter table public.content_reports
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

update public.content_reports
set profile_id = reported_user_id
where target_type = 'profile'
  and profile_id is null
  and reported_user_id is not null;

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check,
  drop constraint if exists content_reports_target_shape_check,
  add constraint content_reports_target_type_check
    check (target_type in ('resume', 'roast', 'profile')),
  add constraint content_reports_target_shape_check
    check (
      (
        target_type = 'resume'
        and resume_id is not null
        and roast_id is null
        and profile_id is null
      )
      or (
        target_type = 'roast'
        and resume_id is not null
        and roast_id is not null
        and profile_id is null
      )
      or (
        target_type = 'profile'
        and profile_id is not null
        and resume_id is null
        and roast_id is null
      )
    );

create index if not exists content_reports_profile_id_idx
  on public.content_reports (profile_id)
  where profile_id is not null;

create unique index if not exists content_reports_pending_profile_unique_idx
  on public.content_reports (reporter_id, profile_id)
  where target_type = 'profile'
    and status = 'pending';

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
        'reset_reviewer',
        'reset_reviewer_trust',
        'clear_public_profile_text',
        'clear_reviewer_profile'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (target_type in ('report', 'roast', 'resume', 'sticker', 'reviewer_application', 'profile'));

drop function if exists public.report_content(text, uuid, uuid, text, text);
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
  normalized_target_type text := lower(trim(coalesce(report_target_type, '')));
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
      raise exception 'Choose one roast to report.';
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
      raise exception 'This roast is not available to report.';
    end if;

    if target_roast.author_id = active_user then
      raise exception 'You cannot report your own roast.';
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
