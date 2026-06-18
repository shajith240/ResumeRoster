-- Linted 0064: permanently delete community posts from owner/admin actions.

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check,
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
        'clear_reviewer_profile',
        'delete_user_account',
        'send_admin_message',
        'remove_community_post',
        'restore_community_post',
        'lock_community_post',
        'unlock_community_post',
        'hard_delete_community_post',
        'remove_community_comment',
        'restore_community_comment'
      )
    );

drop function if exists public.soft_delete_community_post(uuid, uuid);
drop function if exists public.hard_delete_community_post(uuid, uuid, boolean);

create or replace function public.hard_delete_community_post(
  target_user_id uuid,
  target_post_id uuid,
  requesting_user_is_admin boolean default false
)
returns table (
  id uuid,
  deleted_at timestamptz
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
  'Service-role-only permanent community post deletion for authors and admins; related relational rows cascade from community_posts.';

notify pgrst, 'reload schema';
