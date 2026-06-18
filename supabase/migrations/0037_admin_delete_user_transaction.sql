-- Linted 0037: transactional admin account data deletion.
-- Keeps destructive database cleanup inside one audited RPC. Storage objects are
-- removed by the server route only after this transaction commits.

create or replace function public.admin_delete_user_app_data(
  target_user_id uuid,
  deletion_audit_log_id uuid
)
returns table (
  audit_log_id uuid,
  avatar_paths text[],
  resume_paths text[],
  comment_media_paths text[],
  deleted_counts jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_resume_ids uuid[] := array[]::uuid[];
  target_roast_ids uuid[] := array[]::uuid[];
  target_attachment_ids uuid[] := array[]::uuid[];
  audit_row_id uuid;
  profile_exists boolean := false;
  rows_deleted int := 0;
  notifications_removed int := 0;
  reviewer_reviewed_by_cleared int := 0;
  table_counts jsonb := '{}'::jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Admin account deletion must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Target user id is required.';
  end if;

  if deletion_audit_log_id is null then
    raise exception 'Deletion audit log id is required.';
  end if;

  select moderation_actions.id
  into audit_row_id
  from public.moderation_actions
  where moderation_actions.id = deletion_audit_log_id
    and moderation_actions.action = 'delete_user_account'
    and moderation_actions.target_type = 'user'
    and moderation_actions.target_id = target_user_id
  for update;

  if audit_row_id is null then
    raise exception 'Deletion audit log was not found.';
  end if;

  perform 1
  from public.profiles
  where profiles.id = target_user_id
  for update;

  profile_exists := found;

  select coalesce(array_agg(distinct profiles.avatar_path), array[]::text[])
  into avatar_paths
  from public.profiles
  where profiles.id = target_user_id
    and nullif(trim(profiles.avatar_path), '') is not null;

  select
    coalesce(array_agg(distinct resumes.id), array[]::uuid[]),
    coalesce(
      array_agg(distinct resumes.file_path)
        filter (where nullif(trim(resumes.file_path), '') is not null),
      array[]::text[]
    )
  into target_resume_ids, resume_paths
  from public.resumes
  where resumes.user_id = target_user_id;

  with recursive roasts_to_delete(id) as (
    select roasts.id
    from public.roasts
    where roasts.author_id = target_user_id
       or roasts.resume_id = any(target_resume_ids)

    union

    select child.id
    from public.roasts child
    join roasts_to_delete parent on child.parent_id = parent.id
  )
  select coalesce(array_agg(distinct roasts_to_delete.id), array[]::uuid[])
  into target_roast_ids
  from roasts_to_delete;

  select
    coalesce(array_agg(distinct comment_attachments.id), array[]::uuid[]),
    coalesce(
      array_agg(distinct comment_attachments.storage_path)
        filter (where nullif(trim(comment_attachments.storage_path), '') is not null),
      array[]::text[]
    )
  into target_attachment_ids, comment_media_paths
  from public.comment_attachments
  where comment_attachments.user_id = target_user_id
     or (
       comment_attachments.id in (
         select roasts.attachment_id
         from public.roasts
         where roasts.id = any(target_roast_ids)
           and roasts.attachment_id is not null
       )
       and not exists (
         select 1
         from public.roasts outside_roast
         where outside_roast.attachment_id = comment_attachments.id
           and outside_roast.id <> all(target_roast_ids)
       )
     );

  delete from public.votes
  where votes.voter_id = target_user_id
     or votes.roast_id = any(target_roast_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('votes', rows_deleted);

  delete from public.saved_resumes
  where saved_resumes.user_id = target_user_id
     or saved_resumes.resume_id = any(target_resume_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('savedResumes', rows_deleted);

  delete from public.resume_reads
  where resume_reads.reader_id = target_user_id
     or resume_reads.resume_id = any(target_resume_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('resumeReads', rows_deleted);

  delete from public.content_reports
  where content_reports.reporter_id = target_user_id
     or content_reports.reported_user_id = target_user_id
     or content_reports.profile_id = target_user_id
     or content_reports.resume_id = any(target_resume_ids)
     or content_reports.roast_id = any(target_roast_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('contentReports', rows_deleted);

  delete from public.notifications
  where notifications.recipient_id = target_user_id
     or notifications.actor_id = target_user_id
     or notifications.related_user_id = target_user_id
     or notifications.resume_id = any(target_resume_ids)
     or notifications.roast_id = any(target_roast_ids)
     or notifications.parent_roast_id = any(target_roast_ids);
  get diagnostics notifications_removed = row_count;
  table_counts := table_counts || jsonb_build_object('notifications', notifications_removed);

  delete from public.comment_attachments
  where comment_attachments.id = any(target_attachment_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('commentAttachments', rows_deleted);

  delete from public.roasts
  where roasts.id = any(target_roast_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('reviews', rows_deleted);

  delete from public.resumes
  where resumes.id = any(target_resume_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('submittedResumes', rows_deleted);

  delete from public.active_user_sessions
  where active_user_sessions.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('activeSessions', rows_deleted);

  delete from public.app_presence_sessions
  where app_presence_sessions.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('presenceSessions', rows_deleted);

  delete from public.push_subscriptions
  where push_subscriptions.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('pushSubscriptions', rows_deleted);

  delete from public.notification_preferences
  where notification_preferences.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('notificationPreferences', rows_deleted);

  delete from public.profile_onboarding
  where profile_onboarding.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('onboarding', rows_deleted);

  update public.reviewer_applications
  set reviewed_by = null
  where reviewer_applications.reviewed_by = target_user_id;
  get diagnostics reviewer_reviewed_by_cleared = row_count;

  delete from public.reviewer_applications
  where reviewer_applications.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object(
    'reviewerApplications',
    rows_deleted,
    'reviewerApplicationReviewerLinksCleared',
    reviewer_reviewed_by_cleared
  );

  update public.profiles
  set
    avatar_path = null,
    avatar_url = null,
    resume_highlight_id = null
  where profiles.id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('profilePreparedForAuthDelete', rows_deleted);

  deleted_counts := table_counts || jsonb_build_object(
    'profileExisted',
    profile_exists,
    'storagePathsCaptured',
    jsonb_build_object(
      'avatars',
      coalesce(array_length(avatar_paths, 1), 0),
      'commentMedia',
      coalesce(array_length(comment_media_paths, 1), 0),
      'resumes',
      coalesce(array_length(resume_paths, 1), 0)
    )
  );

  update public.moderation_actions
  set metadata = coalesce(moderation_actions.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'delete_status',
      'db_completed_storage_pending',
      'db_transaction_committed_at',
      now(),
      'profile_existed',
      profile_exists,
      'removed_table_rows',
      deleted_counts,
      'storage_cleanup',
      jsonb_build_object('status', 'pending')
    )
  where moderation_actions.id = deletion_audit_log_id;

  audit_log_id := deletion_audit_log_id;
  return next;
end;
$$;

revoke all on function public.admin_delete_user_app_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user_app_data(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
