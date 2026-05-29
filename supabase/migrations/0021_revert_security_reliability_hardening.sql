-- Linted 0021: rollback for the 0020 security hardening deploy.
-- Restores the pre-Phase-1 storage read policy and removes the DB rate-limit
-- triggers/RPCs that were added in 0020.

drop policy if exists "Resume owners can read their own resume files" on storage.objects;
drop policy if exists "Authenticated users can read resume files" on storage.objects;
drop policy if exists "Users can read resumes in their own folder" on storage.objects;
drop policy if exists "Authenticated users can read visible resume files" on storage.objects;
create policy "Authenticated users can read visible resume files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.resumes
      where resumes.file_path = storage.objects.name
        and (resumes.status in ('open', 'closed') or resumes.user_id = auth.uid())
    )
  );

create or replace function public.report_content(
  report_target_type text,
  target_resume_id uuid default null,
  target_roast_id uuid default null,
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
  existing_report_id uuid;
  next_report record;
  resolved_resume_id uuid := target_resume_id;
  resolved_reported_user_id uuid;
begin
  if active_user is null then
    raise exception 'Sign in to report content.';
  end if;

  if normalized_target_type not in ('resume', 'roast') then
    raise exception 'Choose valid content to report.';
  end if;

  if normalized_reason not in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(normalized_details) > 800 then
    raise exception 'Keep report details under 800 characters.';
  end if;

  if normalized_target_type = 'resume' then
    if target_resume_id is null or target_roast_id is not null then
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
  else
    if target_roast_id is null then
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
    target_type,
    reason,
    details,
    report_count,
    last_reported_at
  )
  values (
    active_user,
    resolved_reported_user_id,
    resolved_resume_id,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
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

revoke all on function public.report_content(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, text, text) to authenticated;

drop trigger if exists enforce_roast_insert_rate_limit on public.roasts;
drop trigger if exists enforce_vote_insert_rate_limit on public.votes;
drop trigger if exists enforce_vote_update_rate_limit on public.votes;
drop trigger if exists enforce_saved_resume_insert_rate_limit on public.saved_resumes;
drop trigger if exists enforce_saved_resume_delete_rate_limit on public.saved_resumes;

drop function if exists public.guard_roast_insert_rate_limit();
drop function if exists public.guard_vote_write_rate_limit();
drop function if exists public.guard_saved_resume_rate_limit();
drop function if exists public.enforce_authenticated_rate_limit(text, int, int);
drop function if exists public.check_rate_limit(text, text, int, int);
drop table if exists public.request_rate_limits;

drop function if exists public.submit_reviewer_application(uuid, text, text, text[], text, text, text, text);
drop function if exists public.admin_review_reviewer_application(uuid, uuid, text, text);

notify pgrst, 'reload schema';
