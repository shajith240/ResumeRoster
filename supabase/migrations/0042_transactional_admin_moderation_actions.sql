-- Linted 0042: transactional admin moderation actions.
-- Keeps admin reviewer/report mutations and their audit rows in one database
-- transaction so late failures cannot leave changed state without audit.

create or replace function public.admin_review_reviewer_application(
  target_application_id uuid,
  reviewing_admin_user_id uuid,
  reviewer_action text,
  reviewer_admin_note text default ''
)
returns table (
  ok boolean,
  error_code text,
  application jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_application record;
  updated_application record;
  now_ts timestamptz := now();
  normalized_action text := lower(trim(coalesce(reviewer_action, '')));
  normalized_admin_note text := left(trim(coalesce(reviewer_admin_note, '')), 600);
  next_status text := 'pending';
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin reviewer actions must use the service role.';
  end if;

  if target_application_id is null then
    ok := false;
    error_code := 'application_not_found';
    application := null;
    return next;
    return;
  end if;

  if reviewing_admin_user_id is null then
    ok := false;
    error_code := 'admin_user_required';
    application := null;
    return next;
    return;
  end if;

  if normalized_action not in (
    'approve_reviewer',
    'reject_reviewer',
    'reset_reviewer'
  ) then
    ok := false;
    error_code := 'invalid_action';
    application := null;
    return next;
    return;
  end if;

  select
    reviewer_applications.id,
    reviewer_applications.user_id,
    reviewer_applications.requested_type,
    reviewer_applications.expertise,
    reviewer_applications.proof_url,
    reviewer_applications.note,
    reviewer_applications.status,
    reviewer_applications.admin_note,
    reviewer_applications.reviewed_by,
    reviewer_applications.reviewed_at,
    reviewer_applications.created_at,
    reviewer_applications.updated_at
  into target_application
  from public.reviewer_applications
  where reviewer_applications.id = target_application_id
  for update;

  if not found then
    ok := false;
    error_code := 'application_not_found';
    application := null;
    return next;
    return;
  end if;

  perform 1
  from public.profiles
  where profiles.id = target_application.user_id
  for update;

  if not found then
    ok := false;
    error_code := 'profile_not_found';
    application := null;
    return next;
    return;
  end if;

  if normalized_action = 'approve_reviewer' then
    next_status := 'approved';

    update public.profiles
    set
      reviewer_expertise = coalesce(target_application.expertise, '{}'::text[]),
      reviewer_type = target_application.requested_type,
      reviewer_verification_status = 'verified',
      reviewer_verified_at = now_ts,
      reviewer_verified_by = reviewing_admin_user_id
    where profiles.id = target_application.user_id;
  elsif normalized_action = 'reject_reviewer' then
    next_status := 'rejected';

    update public.profiles
    set
      reviewer_verification_status = 'rejected',
      reviewer_verified_at = null,
      reviewer_verified_by = null
    where profiles.id = target_application.user_id;
  else
    next_status := 'pending';

    update public.profiles
    set
      reviewer_verification_status = 'pending',
      reviewer_verified_at = null,
      reviewer_verified_by = null
    where profiles.id = target_application.user_id;
  end if;

  if not found then
    raise exception 'Reviewer profile update failed.';
  end if;

  update public.reviewer_applications
  set
    admin_note = normalized_admin_note,
    reviewed_at = case when normalized_action = 'reset_reviewer' then null else now_ts end,
    reviewed_by = case when normalized_action = 'reset_reviewer' then null else reviewing_admin_user_id end,
    status = next_status
  where reviewer_applications.id = target_application_id
  returning
    reviewer_applications.id,
    reviewer_applications.user_id,
    reviewer_applications.requested_type,
    reviewer_applications.expertise,
    reviewer_applications.proof_url,
    reviewer_applications.note,
    reviewer_applications.status,
    reviewer_applications.admin_note,
    reviewer_applications.reviewed_by,
    reviewer_applications.reviewed_at,
    reviewer_applications.created_at,
    reviewer_applications.updated_at
  into updated_application;

  if not found then
    raise exception 'Reviewer application update failed.';
  end if;

  insert into public.moderation_actions (
    action,
    admin_user_id,
    metadata,
    reason,
    target_id,
    target_type
  )
  values (
    normalized_action,
    reviewing_admin_user_id,
    jsonb_build_object(
      'application_status', next_status,
      'requested_type', target_application.requested_type,
      'user_id', target_application.user_id
    ),
    normalized_admin_note,
    target_application_id,
    'reviewer_application'
  );

  ok := true;
  error_code := null;
  application := to_jsonb(updated_application);
  return next;
end;
$$;

create or replace function public.admin_apply_report_action(
  target_report_id uuid,
  reviewing_admin_user_id uuid,
  report_action text,
  moderation_note text default ''
)
returns table (
  ok boolean,
  error_code text,
  report jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_report record;
  latest_previous_content text;
  normalized_action text := lower(trim(coalesce(report_action, '')));
  normalized_note text := left(trim(coalesce(moderation_note, '')), 800);
  next_status text;
  rows_changed int := 0;
  target_profile record;
  target_profile_id uuid;
  target_resume_id uuid;
  target_roast record;
  updated_report record;
  audit_metadata jsonb := '{}'::jsonb;
  audit_target_id uuid;
  audit_target_type text := 'report';
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin report actions must use the service role.';
  end if;

  if target_report_id is null then
    ok := false;
    error_code := 'report_not_found';
    report := null;
    return next;
    return;
  end if;

  if reviewing_admin_user_id is null then
    ok := false;
    error_code := 'admin_user_required';
    report := null;
    return next;
    return;
  end if;

  if normalized_action not in (
    'dismiss_report',
    'mark_report_reviewing',
    'mark_report_actioned',
    'remove_roast',
    'restore_roast',
    'close_resume',
    'reopen_resume',
    'reset_reviewer_trust',
    'clear_public_profile_text',
    'clear_reviewer_profile'
  ) then
    ok := false;
    error_code := 'invalid_action';
    report := null;
    return next;
    return;
  end if;

  select
    content_reports.id,
    content_reports.target_type,
    content_reports.resume_id,
    content_reports.roast_id,
    content_reports.profile_id,
    content_reports.reported_user_id,
    content_reports.status,
    content_reports.moderator_note,
    content_reports.report_count
  into current_report
  from public.content_reports
  where content_reports.id = target_report_id
  for update;

  if not found then
    ok := false;
    error_code := 'report_not_found';
    report := null;
    return next;
    return;
  end if;

  next_status := current_report.status;
  audit_target_id := current_report.id;

  if normalized_action = 'dismiss_report' then
    next_status := 'dismissed';
  elsif normalized_action = 'mark_report_reviewing' then
    next_status := 'reviewing';
  elsif normalized_action = 'mark_report_actioned' then
    next_status := 'actioned';
  elsif normalized_action = 'remove_roast' then
    if current_report.roast_id is null then
      ok := false;
      error_code := 'review_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'roast';
    audit_target_id := current_report.roast_id;
    next_status := 'actioned';

    select
      roasts.id,
      roasts.content,
      roasts.helpful_votes,
      roasts.dislike_count,
      roasts.is_deleted
    into target_roast
    from public.roasts
    where roasts.id = current_report.roast_id
    for update;

    if not found then
      ok := false;
      error_code := 'review_not_found';
      report := null;
      return next;
      return;
    end if;

    audit_metadata := jsonb_build_object(
      'previous_content', target_roast.content,
      'previous_dislike_count', coalesce(target_roast.dislike_count, 0),
      'previous_helpful_votes', coalesce(target_roast.helpful_votes, 0),
      'was_deleted', coalesce(target_roast.is_deleted, false)
    );

    if not coalesce(target_roast.is_deleted, false) then
      delete from public.votes
      where votes.roast_id = current_report.roast_id;

      update public.roasts
      set
        content = 'This review was removed by moderation.',
        deleted_at = now(),
        dislike_count = 0,
        helpful_votes = 0,
        is_deleted = true
      where roasts.id = current_report.roast_id;

      get diagnostics rows_changed = row_count;
      if rows_changed <> 1 then
        raise exception 'Review removal failed.';
      end if;
    end if;
  elsif normalized_action = 'restore_roast' then
    if current_report.roast_id is null then
      ok := false;
      error_code := 'review_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'roast';
    audit_target_id := current_report.roast_id;
    next_status := 'actioned';

    perform 1
    from public.roasts
    where roasts.id = current_report.roast_id
    for update;

    if not found then
      ok := false;
      error_code := 'review_not_found';
      report := null;
      return next;
      return;
    end if;

    select moderation_actions.metadata->>'previous_content'
    into latest_previous_content
    from public.moderation_actions
    where moderation_actions.action = 'remove_roast'
      and moderation_actions.target_type = 'roast'
      and moderation_actions.target_id = current_report.roast_id
    order by moderation_actions.created_at desc
    limit 1;

    if nullif(latest_previous_content, '') is null then
      ok := false;
      error_code := 'restore_history_missing';
      report := null;
      return next;
      return;
    end if;

    update public.roasts
    set
      content = latest_previous_content,
      deleted_at = null,
      is_deleted = false
    where roasts.id = current_report.roast_id;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Review restoration failed.';
    end if;

    audit_metadata := jsonb_build_object('restored_content', true);
  elsif normalized_action in ('close_resume', 'reopen_resume') then
    if current_report.resume_id is null then
      ok := false;
      error_code := 'resume_target_missing';
      report := null;
      return next;
      return;
    end if;

    target_resume_id := current_report.resume_id;
    audit_target_type := 'resume';
    audit_target_id := target_resume_id;
    next_status := 'actioned';

    perform 1
    from public.resumes
    where resumes.id = target_resume_id
    for update;

    if not found then
      ok := false;
      error_code := 'resume_not_found';
      report := null;
      return next;
      return;
    end if;

    update public.resumes
    set status = case when normalized_action = 'close_resume' then 'closed' else 'open' end
    where resumes.id = target_resume_id;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Resume moderation update failed.';
    end if;
  elsif normalized_action in (
    'reset_reviewer_trust',
    'clear_public_profile_text',
    'clear_reviewer_profile'
  ) then
    target_profile_id := coalesce(current_report.profile_id, current_report.reported_user_id);

    if target_profile_id is null then
      ok := false;
      error_code := 'profile_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'profile';
    audit_target_id := target_profile_id;
    next_status := 'actioned';

    select
      profiles.id,
      profiles.tagline,
      profiles.about,
      profiles.skills,
      profiles.community_role,
      profiles.reviewer_type,
      profiles.reviewer_headline,
      profiles.reviewer_bio,
      profiles.reviewer_expertise,
      profiles.reviewer_verification_status
    into target_profile
    from public.profiles
    where profiles.id = target_profile_id
    for update;

    if not found then
      ok := false;
      error_code := 'profile_not_found';
      report := null;
      return next;
      return;
    end if;

    audit_metadata := jsonb_build_object('previous_profile', to_jsonb(target_profile));

    if normalized_action = 'reset_reviewer_trust' then
      update public.profiles
      set
        reviewer_verification_status = 'none',
        reviewer_verified_at = null,
        reviewer_verified_by = null
      where profiles.id = target_profile_id;
    elsif normalized_action = 'clear_public_profile_text' then
      update public.profiles
      set
        about = null,
        skills = '{}'::text[],
        tagline = null
      where profiles.id = target_profile_id;
    else
      update public.profiles
      set
        community_role = 'candidate',
        reviewer_bio = null,
        reviewer_expertise = '{}'::text[],
        reviewer_headline = null,
        reviewer_type = null,
        reviewer_verification_status = 'none',
        reviewer_verified_at = null,
        reviewer_verified_by = null
      where profiles.id = target_profile_id;
    end if;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Profile moderation update failed.';
    end if;
  end if;

  update public.content_reports
  set
    moderator_note = case
      when normalized_note = '' then current_report.moderator_note
      else normalized_note
    end,
    reviewed_at = now(),
    reviewed_by = reviewing_admin_user_id,
    status = next_status
  where content_reports.id = current_report.id
  returning
    content_reports.id,
    content_reports.status
  into updated_report;

  if not found then
    raise exception 'Report moderation update failed.';
  end if;

  insert into public.moderation_actions (
    action,
    admin_user_id,
    metadata,
    reason,
    report_id,
    target_id,
    target_type
  )
  values (
    normalized_action,
    reviewing_admin_user_id,
    audit_metadata,
    normalized_note,
    current_report.id,
    audit_target_id,
    audit_target_type
  );

  ok := true;
  error_code := null;
  report := to_jsonb(updated_report);
  return next;
end;
$$;

revoke all on function public.admin_review_reviewer_application(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_review_reviewer_application(uuid, uuid, text, text)
  to service_role;

revoke all on function public.admin_apply_report_action(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_apply_report_action(uuid, uuid, text, text)
  to service_role;

comment on function public.admin_review_reviewer_application(uuid, uuid, text, text) is
  'Service-role-only transaction for admin reviewer application decisions and their moderation audit row.';

comment on function public.admin_apply_report_action(uuid, uuid, text, text) is
  'Service-role-only transaction for admin content report decisions, target mutations, and their moderation audit row.';

notify pgrst, 'reload schema';
