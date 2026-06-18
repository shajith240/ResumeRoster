-- Linted 0074: production backend integrity hardening.
-- Closes lifecycle gaps introduced after the original account-deletion RPC,
-- aligns community poll ownership with profile-owned app data, narrows direct
-- profile column grants, and makes destructive media cleanup DB-first.

do $$
declare
  orphan_vote_count integer := 0;
begin
  select count(*)::integer
  into orphan_vote_count
  from public.community_post_poll_votes as poll_votes
  left join public.profiles
    on profiles.id = poll_votes.voter_id
  where profiles.id is null;

  if orphan_vote_count > 0 then
    raise exception
      'Cannot move community poll votes to profiles FK: % vote row(s) have no profile.',
      orphan_vote_count;
  end if;
end $$;

do $$
declare
  existing_constraint name;
begin
  for existing_constraint in
    select constraints.conname
    from pg_constraint as constraints
    join pg_class as source_table
      on source_table.oid = constraints.conrelid
    join pg_namespace as source_schema
      on source_schema.oid = source_table.relnamespace
    join pg_class as target_table
      on target_table.oid = constraints.confrelid
    join pg_namespace as target_schema
      on target_schema.oid = target_table.relnamespace
    where constraints.contype = 'f'
      and source_schema.nspname = 'public'
      and source_table.relname = 'community_post_poll_votes'
      and target_schema.nspname = 'auth'
      and target_table.relname = 'users'
  loop
    execute format(
      'alter table public.community_post_poll_votes drop constraint %I',
      existing_constraint
    );
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_post_poll_votes_voter_profile_fkey'
      and conrelid = 'public.community_post_poll_votes'::regclass
  ) then
    alter table public.community_post_poll_votes
      add constraint community_post_poll_votes_voter_profile_fkey
      foreign key (voter_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.community_post_poll_votes
  validate constraint community_post_poll_votes_voter_profile_fkey;

revoke select on table public.profiles from authenticated;
grant select (
  id,
  username,
  full_name,
  avatar_url,
  avatar_path,
  college,
  target_role,
  app_status,
  roast_count,
  helpful_votes,
  created_at,
  tagline,
  current_position,
  college_location,
  about,
  skills,
  resume_highlight_id,
  community_role,
  reviewer_type,
  reviewer_headline,
  reviewer_bio,
  reviewer_expertise,
  reviewer_verification_status
) on table public.profiles to authenticated;

drop function if exists public.hard_delete_community_post(uuid, uuid, boolean);

create or replace function public.hard_delete_community_post(
  target_user_id uuid,
  target_post_id uuid,
  requesting_user_is_admin boolean default false
)
returns table (
  id uuid,
  deleted_at timestamptz,
  community_post_media_paths text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post record;
  deletion_time timestamptz := now();
  rows_changed int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community post hard deletes must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  select
    community_posts.id,
    community_posts.author_id,
    community_posts.status
  into target_post
  from public.community_posts
  where community_posts.id = target_post_id
  for update;

  if not found then
    raise exception 'This community post is not available.';
  end if;

  if target_post.author_id <> target_user_id
    and not coalesce(requesting_user_is_admin, false) then
    raise exception 'Only the author or an admin can delete this post.';
  end if;

  select coalesce(
    array_agg(distinct community_post_attachments.storage_path)
      filter (
        where nullif(trim(community_post_attachments.storage_path), '') is not null
      ),
    array[]::text[]
  )
  into community_post_media_paths
  from public.community_post_attachments
  where community_post_attachments.post_id = target_post_id;

  delete from public.community_posts
  where community_posts.id = target_post_id;

  get diagnostics rows_changed = row_count;
  if rows_changed <> 1 then
    raise exception 'Community post hard delete failed.';
  end if;

  if coalesce(requesting_user_is_admin, false)
    and target_post.author_id <> target_user_id then
    insert into public.moderation_actions (
      admin_user_id,
      action,
      target_type,
      target_id,
      reason,
      metadata
    )
    values (
      target_user_id,
      'hard_delete_community_post',
      'community_post',
      target_post_id,
      'Admin permanently deleted community post.',
      jsonb_build_object(
        'author_id', target_post.author_id,
        'previous_status', target_post.status,
        'hard_deleted', true
      )
    );
  end if;

  id := target_post_id;
  deleted_at := deletion_time;
  return next;
end;
$$;

revoke all on function public.hard_delete_community_post(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.hard_delete_community_post(uuid, uuid, boolean)
  to service_role;

comment on function public.hard_delete_community_post(uuid, uuid, boolean) is
  'Service-role-only permanent community post deletion that returns storage paths for post-commit cleanup.';

drop function if exists public.delete_unclaimed_comment_attachment(uuid, uuid);

create or replace function public.delete_unclaimed_comment_attachment(
  target_user_id uuid,
  target_attachment_id uuid
)
returns table (
  id uuid,
  storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attachment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Comment media deletion must use the service role.';
  end if;

  if target_user_id is null or target_attachment_id is null then
    raise exception 'Choose a valid image.';
  end if;

  select
    comment_attachments.id,
    comment_attachments.storage_path,
    comment_attachments.user_id
  into target_attachment
  from public.comment_attachments
  where comment_attachments.id = target_attachment_id
  for update;

  if not found or target_attachment.user_id is distinct from target_user_id then
    raise exception 'Comment media was not found.';
  end if;

  if exists (
    select 1
    from public.roasts
    where roasts.attachment_id = target_attachment_id
  ) or exists (
    select 1
    from public.community_post_comments
    where community_post_comments.attachment_id = target_attachment_id
  ) then
    raise exception 'Comment media is already attached.';
  end if;

  delete from public.comment_attachments
  where comment_attachments.id = target_attachment_id;

  id := target_attachment.id;
  storage_path := target_attachment.storage_path;
  return next;
end;
$$;

revoke all on function public.delete_unclaimed_comment_attachment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_unclaimed_comment_attachment(uuid, uuid)
  to service_role;

comment on function public.delete_unclaimed_comment_attachment(uuid, uuid) is
  'Deletes an owned, unreferenced comment attachment row and returns the storage path for post-commit cleanup.';

drop function if exists public.admin_delete_user_app_data(uuid, uuid);

create or replace function public.admin_delete_user_app_data(
  target_user_id uuid,
  deletion_audit_log_id uuid
)
returns table (
  audit_log_id uuid,
  avatar_paths text[],
  resume_paths text[],
  comment_media_paths text[],
  community_post_media_paths text[],
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
  target_community_post_ids uuid[] := array[]::uuid[];
  target_community_comment_ids uuid[] := array[]::uuid[];
  target_community_poll_ids uuid[] := array[]::uuid[];
  audit_row_id uuid;
  profile_exists boolean := false;
  rows_deleted int := 0;
  notifications_removed int := 0;
  reviewer_reviewed_by_cleared int := 0;
  feedback_assigned_to_cleared int := 0;
  feedback_reviewed_by_cleared int := 0;
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

  select coalesce(array_agg(distinct community_posts.id), array[]::uuid[])
  into target_community_post_ids
  from public.community_posts
  where community_posts.author_id = target_user_id;

  with recursive comments_to_delete(id) as (
    select community_post_comments.id
    from public.community_post_comments
    where community_post_comments.author_id = target_user_id
       or community_post_comments.post_id = any(target_community_post_ids)

    union

    select child.id
    from public.community_post_comments child
    join comments_to_delete parent on child.parent_id = parent.id
  )
  select coalesce(array_agg(distinct comments_to_delete.id), array[]::uuid[])
  into target_community_comment_ids
  from comments_to_delete;

  select coalesce(array_agg(distinct community_post_polls.id), array[]::uuid[])
  into target_community_poll_ids
  from public.community_post_polls
  where community_post_polls.post_id = any(target_community_post_ids);

  select coalesce(
    array_agg(distinct community_post_attachments.storage_path)
      filter (
        where nullif(trim(community_post_attachments.storage_path), '') is not null
      ),
    array[]::text[]
  )
  into community_post_media_paths
  from public.community_post_attachments
  where community_post_attachments.user_id = target_user_id
     or community_post_attachments.post_id = any(target_community_post_ids);

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
       and not exists (
         select 1
         from public.community_post_comments outside_comment
         where outside_comment.attachment_id = comment_attachments.id
           and outside_comment.id <> all(target_community_comment_ids)
       )
     )
     or (
       comment_attachments.id in (
         select community_post_comments.attachment_id
         from public.community_post_comments
         where community_post_comments.id = any(target_community_comment_ids)
           and community_post_comments.attachment_id is not null
       )
       and not exists (
         select 1
         from public.roasts outside_roast
         where outside_roast.attachment_id = comment_attachments.id
           and outside_roast.id <> all(target_roast_ids)
       )
       and not exists (
         select 1
         from public.community_post_comments outside_comment
         where outside_comment.attachment_id = comment_attachments.id
           and outside_comment.id <> all(target_community_comment_ids)
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

  delete from public.community_post_poll_votes
  where community_post_poll_votes.voter_id = target_user_id
     or community_post_poll_votes.poll_id = any(target_community_poll_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityPollVotes', rows_deleted);

  delete from public.community_comment_votes
  where community_comment_votes.voter_id = target_user_id
     or community_comment_votes.comment_id = any(target_community_comment_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityCommentVotes', rows_deleted);

  delete from public.community_post_votes
  where community_post_votes.voter_id = target_user_id
     or community_post_votes.post_id = any(target_community_post_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityPostVotes', rows_deleted);

  delete from public.content_reports
  where content_reports.reporter_id = target_user_id
     or content_reports.reported_user_id = target_user_id
     or content_reports.profile_id = target_user_id
     or content_reports.resume_id = any(target_resume_ids)
     or content_reports.roast_id = any(target_roast_ids)
     or content_reports.community_post_id = any(target_community_post_ids)
     or content_reports.community_comment_id = any(target_community_comment_ids);
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

  delete from public.community_post_attachments
  where community_post_attachments.user_id = target_user_id
     or community_post_attachments.post_id = any(target_community_post_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityPostAttachments', rows_deleted);

  delete from public.community_post_comments
  where community_post_comments.id = any(target_community_comment_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityComments', rows_deleted);

  delete from public.community_posts
  where community_posts.id = any(target_community_post_ids);
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object('communityPosts', rows_deleted);

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

  update public.user_feedback
  set assigned_admin_id = null
  where user_feedback.assigned_admin_id = target_user_id;
  get diagnostics feedback_assigned_to_cleared = row_count;

  update public.user_feedback
  set reviewed_by = null
  where user_feedback.reviewed_by = target_user_id;
  get diagnostics feedback_reviewed_by_cleared = row_count;

  delete from public.user_feedback
  where user_feedback.user_id = target_user_id;
  get diagnostics rows_deleted = row_count;
  table_counts := table_counts || jsonb_build_object(
    'userFeedback',
    rows_deleted,
    'userFeedbackAssignedLinksCleared',
    feedback_assigned_to_cleared,
    'userFeedbackReviewedLinksCleared',
    feedback_reviewed_by_cleared
  );

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
      'communityPostMedia',
      coalesce(array_length(community_post_media_paths, 1), 0),
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

revoke all on function public.admin_delete_user_app_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_user_app_data(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
