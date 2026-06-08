-- Phase 4: discussion actions for community posts and threaded comments.

create or replace function public.ensure_community_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    raise exception 'Sign in before continuing.';
  end if;

  insert into public.profiles (id, username)
  values (target_user_id, public.make_linted_username(target_user_id))
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_community_profile(uuid)
  from public, anon, authenticated;

create or replace function public.get_community_comment_depth(target_comment_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with recursive ancestors as (
    select
      community_post_comments.id,
      community_post_comments.parent_id,
      0 as depth
    from public.community_post_comments
    where community_post_comments.id = target_comment_id

    union all

    select
      parent_comments.id,
      parent_comments.parent_id,
      ancestors.depth + 1
    from public.community_post_comments as parent_comments
    join ancestors on ancestors.parent_id = parent_comments.id
    where ancestors.depth < 50
  )
  select coalesce(max(depth), -1)::int
  from ancestors;
$$;

revoke all on function public.get_community_comment_depth(uuid)
  from public, anon, authenticated;

create or replace function public.validate_community_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_reply_depth constant int := 3;
  target_post_status text;
  target_parent record;
begin
  select community_posts.status
  into target_post_status
  from public.community_posts
  where community_posts.id = new.post_id;

  if target_post_status is null then
    raise exception 'Community post does not exist.';
  end if;

  if tg_op = 'INSERT'
    and new.status = 'active'
    and target_post_status <> 'active' then
    raise exception 'This community post is not open for comments.';
  end if;

  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select
        community_post_comments.id,
        community_post_comments.parent_id
      from public.community_post_comments
      where community_post_comments.id = new.parent_id

      union all

      select
        parent_comments.id,
        parent_comments.parent_id
      from public.community_post_comments as parent_comments
      join ancestors on ancestors.parent_id = parent_comments.id
      where ancestors.parent_id is not null
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception 'Community comments cannot reference themselves through a reply chain.';
  end if;

  select
    community_post_comments.id,
    community_post_comments.post_id,
    community_post_comments.status,
    public.get_community_comment_depth(community_post_comments.id) as depth
  into target_parent
  from public.community_post_comments
  where community_post_comments.id = new.parent_id;

  if not found then
    raise exception 'Parent comment does not exist.';
  end if;

  if target_parent.post_id <> new.post_id then
    raise exception 'Replies must belong to the same community post.';
  end if;

  if target_parent.status <> 'active' then
    raise exception 'You cannot reply to a removed community comment.';
  end if;

  if target_parent.depth >= max_reply_depth then
    raise exception 'This comment thread is too deep for more replies.';
  end if;

  return new;
end;
$$;

create or replace function public.submit_community_comment(
  target_user_id uuid,
  target_post_id uuid,
  comment_body text,
  parent_comment_id uuid default null
)
returns table (
  id uuid,
  post_id uuid,
  parent_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  max_reply_depth constant int := 3;
  cleaned_body text := trim(coalesce(comment_body, ''));
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

  insert into public.community_post_comments (
    post_id,
    parent_id,
    author_id,
    body,
    status
  )
  values (
    target_post_id,
    parent_comment_id,
    target_user_id,
    cleaned_body,
    'active'
  )
  returning
    community_post_comments.id,
    community_post_comments.post_id,
    community_post_comments.parent_id,
    community_post_comments.created_at
  into next_comment;

  id := next_comment.id;
  post_id := next_comment.post_id;
  parent_id := next_comment.parent_id;
  created_at := next_comment.created_at;
  return next;
end;
$$;

revoke all on function public.submit_community_comment(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_community_comment(uuid, uuid, text, uuid)
  to service_role;

create or replace function public.set_community_post_vote(
  target_user_id uuid,
  target_post_id uuid,
  next_reaction text default null
)
returns table (
  post_id uuid,
  reaction text,
  upvote_count int,
  downvote_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reaction text := nullif(lower(trim(coalesce(next_reaction, ''))), '');
  target_post record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community votes must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  if normalized_reaction is not null
    and normalized_reaction not in ('upvote', 'downvote') then
    raise exception 'Choose a valid vote.';
  end if;

  select
    community_posts.id,
    community_posts.author_id,
    community_posts.status
  into target_post
  from public.community_posts
  where community_posts.id = target_post_id
  for update;

  if not found or target_post.status not in ('active', 'locked') then
    raise exception 'This community post is not available.';
  end if;

  if target_post.author_id = target_user_id then
    raise exception 'You cannot vote on your own post.';
  end if;

  if normalized_reaction is null then
    delete from public.community_post_votes
    where community_post_votes.post_id = target_post_id
      and community_post_votes.voter_id = target_user_id;
  else
    insert into public.community_post_votes (
      post_id,
      voter_id,
      reaction
    )
    values (
      target_post_id,
      target_user_id,
      normalized_reaction
    )
    on conflict (post_id, voter_id) do update
      set reaction = excluded.reaction;
  end if;

  select
    community_posts.id,
    community_post_votes.reaction,
    community_posts.upvote_count,
    community_posts.downvote_count
  into post_id, reaction, upvote_count, downvote_count
  from public.community_posts
  left join public.community_post_votes
    on community_post_votes.post_id = community_posts.id
    and community_post_votes.voter_id = target_user_id
  where community_posts.id = target_post_id;

  return next;
end;
$$;

revoke all on function public.set_community_post_vote(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_community_post_vote(uuid, uuid, text)
  to service_role;

create or replace function public.set_community_comment_vote(
  target_user_id uuid,
  target_comment_id uuid,
  next_reaction text default null
)
returns table (
  comment_id uuid,
  reaction text,
  upvote_count int,
  downvote_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reaction text := nullif(lower(trim(coalesce(next_reaction, ''))), '');
  target_comment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community votes must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  if normalized_reaction is not null
    and normalized_reaction not in ('upvote', 'downvote') then
    raise exception 'Choose a valid vote.';
  end if;

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

  if target_comment.author_id = target_user_id then
    raise exception 'You cannot vote on your own comment.';
  end if;

  if normalized_reaction is null then
    delete from public.community_comment_votes
    where community_comment_votes.comment_id = target_comment_id
      and community_comment_votes.voter_id = target_user_id;
  else
    insert into public.community_comment_votes (
      comment_id,
      voter_id,
      reaction
    )
    values (
      target_comment_id,
      target_user_id,
      normalized_reaction
    )
    on conflict (comment_id, voter_id) do update
      set reaction = excluded.reaction;
  end if;

  select
    community_post_comments.id,
    community_comment_votes.reaction,
    community_post_comments.upvote_count,
    community_post_comments.downvote_count
  into comment_id, reaction, upvote_count, downvote_count
  from public.community_post_comments
  left join public.community_comment_votes
    on community_comment_votes.comment_id = community_post_comments.id
    and community_comment_votes.voter_id = target_user_id
  where community_post_comments.id = target_comment_id;

  return next;
end;
$$;

revoke all on function public.set_community_comment_vote(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_community_comment_vote(uuid, uuid, text)
  to service_role;

create or replace function public.update_community_post_content(
  target_user_id uuid,
  target_post_id uuid,
  next_title text,
  next_body text
)
returns table (
  id uuid,
  title text,
  body text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_title text := trim(coalesce(next_title, ''));
  cleaned_body text := trim(coalesce(next_body, ''));
  target_post record;
  changed_post record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community post edits must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  if char_length(cleaned_title) < 8 or char_length(cleaned_title) > 180 then
    raise exception 'Keep titles between 8 and 180 characters.';
  end if;

  if char_length(cleaned_body) < 20 or char_length(cleaned_body) > 12000 then
    raise exception 'Keep post bodies between 20 and 12000 characters.';
  end if;

  select
    community_posts.id,
    community_posts.author_id,
    community_posts.status
  into target_post
  from public.community_posts
  where community_posts.id = target_post_id
  for update;

  if not found or target_post.status not in ('active', 'locked') then
    raise exception 'This community post is not available.';
  end if;

  if target_post.author_id <> target_user_id then
    raise exception 'Only the author can edit this post.';
  end if;

  update public.community_posts
  set
    title = cleaned_title,
    body = cleaned_body
  where community_posts.id = target_post_id
  returning
    community_posts.id,
    community_posts.title,
    community_posts.body,
    community_posts.status,
    community_posts.updated_at
  into changed_post;

  id := changed_post.id;
  title := changed_post.title;
  body := changed_post.body;
  status := changed_post.status;
  updated_at := changed_post.updated_at;
  return next;
end;
$$;

revoke all on function public.update_community_post_content(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_community_post_content(uuid, uuid, text, text)
  to service_role;

create or replace function public.soft_delete_community_post(
  target_user_id uuid,
  target_post_id uuid
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
  target_post record;
  changed_post record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community post deletes must use the service role.';
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

  if not found or target_post.status not in ('active', 'locked') then
    raise exception 'This community post is not available.';
  end if;

  if target_post.author_id <> target_user_id then
    raise exception 'Only the author can delete this post.';
  end if;

  update public.community_posts
  set
    title = 'Deleted community post',
    body = 'This post was deleted by its author.',
    status = 'deleted',
    deleted_at = coalesce(community_posts.deleted_at, now())
  where community_posts.id = target_post_id
  returning
    community_posts.id,
    community_posts.status,
    community_posts.deleted_at
  into changed_post;

  id := changed_post.id;
  status := changed_post.status;
  deleted_at := changed_post.deleted_at;
  return next;
end;
$$;

revoke all on function public.soft_delete_community_post(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.soft_delete_community_post(uuid, uuid)
  to service_role;

create or replace function public.update_community_comment_content(
  target_user_id uuid,
  target_comment_id uuid,
  next_body text
)
returns table (
  id uuid,
  body text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_body text := trim(coalesce(next_body, ''));
  target_comment record;
  changed_comment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community comment edits must use the service role.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  if char_length(cleaned_body) < 2 or char_length(cleaned_body) > 6000 then
    raise exception 'Keep comments between 2 and 6000 characters.';
  end if;

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
    raise exception 'Only the author can edit this comment.';
  end if;

  update public.community_post_comments
  set body = cleaned_body
  where community_post_comments.id = target_comment_id
  returning
    community_post_comments.id,
    community_post_comments.body,
    community_post_comments.status,
    community_post_comments.updated_at
  into changed_comment;

  id := changed_comment.id;
  body := changed_comment.body;
  status := changed_comment.status;
  updated_at := changed_comment.updated_at;
  return next;
end;
$$;

revoke all on function public.update_community_comment_content(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_community_comment_content(uuid, uuid, text)
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

create or replace function public.set_community_post_lock(
  target_admin_id uuid,
  target_post_id uuid,
  should_lock boolean
)
returns table (
  id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post record;
  next_status text := case when should_lock then 'locked' else 'active' end;
  next_action text := case when should_lock then 'lock_community_post' else 'unlock_community_post' end;
  changed_post record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community moderation must use the service role.';
  end if;

  perform public.ensure_community_profile(target_admin_id);

  select
    community_posts.id,
    community_posts.status
  into target_post
  from public.community_posts
  where community_posts.id = target_post_id
  for update;

  if not found or target_post.status not in ('active', 'locked') then
    raise exception 'This community post is not available.';
  end if;

  if target_post.status <> next_status then
    update public.community_posts
    set status = next_status
    where community_posts.id = target_post_id
    returning
      community_posts.id,
      community_posts.status,
      community_posts.updated_at
    into changed_post;

    insert into public.moderation_actions (
      admin_user_id,
      action,
      target_type,
      target_id,
      reason,
      metadata
    )
    values (
      target_admin_id,
      next_action,
      'community_post',
      target_post_id,
      'Admin community post lock toggle.',
      jsonb_build_object(
        'previous_status', target_post.status,
        'next_status', next_status
      )
    );
  else
    select
      community_posts.id,
      community_posts.status,
      community_posts.updated_at
    into changed_post
    from public.community_posts
    where community_posts.id = target_post_id;
  end if;

  id := changed_post.id;
  status := changed_post.status;
  updated_at := changed_post.updated_at;
  return next;
end;
$$;

revoke all on function public.set_community_post_lock(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_community_post_lock(uuid, uuid, boolean)
  to service_role;

drop policy if exists "Visible community comments are readable"
  on public.community_post_comments;
create policy "Visible community comments are readable"
  on public.community_post_comments for select
  to authenticated
  using (
    (
      status in ('active', 'deleted')
      or author_id = auth.uid()
    )
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_comments.post_id
        and (
          community_posts.status in ('active', 'locked')
          or community_posts.author_id = auth.uid()
        )
    )
  );

comment on function public.get_community_comment_depth(uuid) is
  'Returns zero-based community comment depth for enforcing finite discussion nesting.';
comment on function public.set_community_post_vote(uuid, uuid, text) is
  'Service-role-only upvote/downvote toggle for community posts.';
comment on function public.set_community_comment_vote(uuid, uuid, text) is
  'Service-role-only upvote/downvote toggle for community comments.';
comment on function public.set_community_post_lock(uuid, uuid, boolean) is
  'Admin-gated community post lock toggle called through the service role.';

notify pgrst, 'reload schema';
