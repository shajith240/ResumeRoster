-- Linted 0070: community comment static image support.
-- Reuses comment_attachments/comment-media so comments share the hardened
-- upload, storage, and scan pipeline already used by resume feedback.

alter table public.comment_attachments
  drop constraint if exists comment_attachments_mime_type_check;

alter table public.comment_attachments
  add constraint comment_attachments_mime_type_check
    check (
      mime_type is null
      or mime_type in ('image/png', 'image/jpeg', 'image/webp')
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-media',
  'comment-media',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

alter table public.community_post_comments
  add column if not exists attachment_id uuid
    references public.comment_attachments(id) on delete set null;

create index if not exists community_post_comments_attachment_id_idx
  on public.community_post_comments (attachment_id)
  where attachment_id is not null;

drop policy if exists "Community authors can create comments"
  on public.community_post_comments;
create policy "Community authors can create comments"
  on public.community_post_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status in ('active', 'held')
    and (
      attachment_id is null
      or exists (
        select 1
        from public.comment_attachments
        where comment_attachments.id = community_post_comments.attachment_id
          and comment_attachments.user_id = auth.uid()
          and comment_attachments.kind = 'image'
          and comment_attachments.source = 'upload'
          and comment_attachments.storage_path is not null
          and (
            comment_attachments.mime_type is null
            or comment_attachments.mime_type in (
              'image/png',
              'image/jpeg',
              'image/webp'
            )
          )
          and (
            comment_attachments.file_size is null
            or comment_attachments.file_size <= 2097152
          )
      )
    )
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_comments.post_id
        and community_posts.status = 'active'
    )
  );

drop function if exists public.submit_community_comment(uuid, uuid, text, uuid);

create or replace function public.submit_community_comment(
  target_user_id uuid,
  target_post_id uuid,
  comment_body text,
  parent_comment_id uuid default null,
  comment_attachment_id uuid default null
)
returns table (
  id uuid,
  post_id uuid,
  parent_id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  abuse_decision record;
  max_reply_depth constant int := 3;
  cleaned_body text := trim(coalesce(comment_body, ''));
  target_attachment record;
  target_post record;
  target_parent record;
  next_comment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community comment submission must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  if char_length(cleaned_body) < 2 or char_length(cleaned_body) > 6000 then
    raise exception 'Keep comments between 2 and 6000 characters.';
  end if;

  select
    community_posts.id,
    community_posts.status
  into target_post
  from public.community_posts
  where community_posts.id = target_post_id;

  if not found or target_post.status <> 'active' then
    raise exception 'This post is not open for comments.';
  end if;

  if parent_comment_id is not null then
    select
      community_post_comments.id,
      community_post_comments.post_id,
      community_post_comments.status,
      public.get_community_comment_depth(community_post_comments.id) as depth
    into target_parent
    from public.community_post_comments
    where community_post_comments.id = parent_comment_id;

    if not found
      or target_parent.post_id <> target_post_id
      or target_parent.status <> 'active' then
      raise exception 'Choose an active parent comment.';
    end if;

    if target_parent.depth >= max_reply_depth then
      raise exception 'This comment thread is too deep for more replies.';
    end if;
  end if;

  if comment_attachment_id is not null then
    select
      comment_attachments.id
    into target_attachment
    from public.comment_attachments
    where comment_attachments.id = comment_attachment_id
      and comment_attachments.user_id = target_user_id
      and comment_attachments.kind = 'image'
      and comment_attachments.source = 'upload'
      and comment_attachments.storage_path is not null
      and (
        comment_attachments.mime_type is null
        or comment_attachments.mime_type in (
          'image/png',
          'image/jpeg',
          'image/webp'
        )
      )
      and (
        comment_attachments.file_size is null
        or comment_attachments.file_size <= 2097152
      );

    if not found then
      raise exception 'Choose a valid image attachment.';
    end if;
  end if;

  select *
  into abuse_decision
  from public.get_community_abuse_decision(
    target_user_id,
    '',
    cleaned_body,
    'comment'
  );

  insert into public.community_post_comments (
    post_id,
    parent_id,
    author_id,
    attachment_id,
    body,
    status
  )
  values (
    target_post_id,
    parent_comment_id,
    target_user_id,
    comment_attachment_id,
    cleaned_body,
    abuse_decision.next_status
  )
  returning
    community_post_comments.id,
    community_post_comments.post_id,
    community_post_comments.parent_id,
    community_post_comments.status,
    community_post_comments.created_at
  into next_comment;

  if next_comment.status = 'held' then
    insert into public.content_reports (
      reporter_id,
      reported_user_id,
      target_type,
      community_post_id,
      community_comment_id,
      reason,
      details,
      status,
      report_count,
      last_reported_at
    )
    values (
      target_user_id,
      target_user_id,
      'community_comment',
      next_comment.post_id,
      next_comment.id,
      'spam',
      'Crowd-control held this comment for moderator review.',
      'pending',
      1,
      now()
    );
  end if;

  id := next_comment.id;
  post_id := next_comment.post_id;
  parent_id := next_comment.parent_id;
  status := next_comment.status;
  created_at := next_comment.created_at;
  return next;
end;
$$;

revoke all on function public.submit_community_comment(uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_community_comment(uuid, uuid, text, uuid, uuid)
  to service_role;

create or replace function public.soft_delete_community_comment(
  target_user_id uuid,
  target_comment_id uuid
)
returns table (
  id uuid,
  status text,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment record;
  changed_comment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community comment deletes must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  select
    community_post_comments.id,
    community_post_comments.author_id,
    community_post_comments.status,
    community_posts.status as post_status
  into target_comment
  from public.community_post_comments
  join public.community_posts
    on community_posts.id = community_post_comments.post_id
  where community_post_comments.id = target_comment_id
  for update of community_post_comments;

  if not found
    or target_comment.status <> 'active'
    or target_comment.post_status not in ('active', 'locked') then
    raise exception 'This community comment is not available.';
  end if;

  if target_comment.author_id <> target_user_id then
    raise exception 'Only the author can delete this comment.';
  end if;

  update public.community_post_comments
  set
    attachment_id = null,
    body = '[deleted]',
    status = 'deleted',
    deleted_at = coalesce(community_post_comments.deleted_at, now())
  where community_post_comments.id = target_comment_id
  returning
    community_post_comments.id,
    community_post_comments.status,
    community_post_comments.deleted_at
  into changed_comment;

  id := changed_comment.id;
  status := changed_comment.status;
  deleted_at := changed_comment.deleted_at;
  return next;
end;
$$;

revoke all on function public.soft_delete_community_comment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.soft_delete_community_comment(uuid, uuid)
  to service_role;

comment on function public.submit_community_comment(uuid, uuid, text, uuid, uuid) is
  'Service-role-only root or threaded community comment creation contract with optional uploaded static image attachments.';

notify pgrst, 'reload schema';
