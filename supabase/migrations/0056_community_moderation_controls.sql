-- Phase 5: community moderation controls, crowd control, and admin audit actions.

alter table public.community_posts
  drop constraint if exists community_posts_status_check,
  drop constraint if exists community_posts_deleted_at_check,
  add constraint community_posts_status_check
    check (status in ('active', 'locked', 'held', 'deleted', 'removed')),
  add constraint community_posts_deleted_at_check
    check (
      (
        status in ('active', 'locked', 'held')
        and deleted_at is null
      )
      or (
        status in ('deleted', 'removed')
        and deleted_at is not null
      )
    );

alter table public.community_post_comments
  drop constraint if exists community_post_comments_status_check,
  drop constraint if exists community_post_comments_deleted_at_check,
  add constraint community_post_comments_status_check
    check (status in ('active', 'held', 'deleted', 'removed')),
  add constraint community_post_comments_deleted_at_check
    check (
      (
        status in ('active', 'held')
        and deleted_at is null
      )
      or (
        status in ('deleted', 'removed')
        and deleted_at is not null
      )
    );

create index if not exists community_posts_held_review_idx
  on public.community_posts (updated_at asc)
  where status = 'held';

create index if not exists community_post_comments_held_review_idx
  on public.community_post_comments (updated_at asc)
  where status = 'held';

drop policy if exists "Community authors can create posts" on public.community_posts;
create policy "Community authors can create posts"
  on public.community_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status in ('active', 'held')
    and post_type in ('question', 'discussion', 'resource')
    and exists (
      select 1
      from public.community_topics
      where community_topics.id = community_posts.topic_id
        and community_topics.is_active = true
    )
  );

drop policy if exists "Community authors can edit active posts" on public.community_posts;
create policy "Community authors can edit active posts"
  on public.community_posts for update
  to authenticated
  using (
    auth.uid() = author_id
    and status in ('active', 'locked', 'held')
  )
  with check (
    auth.uid() = author_id
    and status in ('active', 'locked', 'held')
    and post_type in ('question', 'discussion', 'resource')
  );

drop policy if exists "Community authors can create comments"
  on public.community_post_comments;
create policy "Community authors can create comments"
  on public.community_post_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status in ('active', 'held')
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_comments.post_id
        and community_posts.status = 'active'
    )
  );

drop policy if exists "Community authors can edit active comments"
  on public.community_post_comments;
create policy "Community authors can edit active comments"
  on public.community_post_comments for update
  to authenticated
  using (
    auth.uid() = author_id
    and status in ('active', 'held')
  )
  with check (
    auth.uid() = author_id
    and status in ('active', 'held')
  );

drop policy if exists "Visible community post tags are readable"
  on public.community_post_tags;
create policy "Visible community post tags are readable"
  on public.community_post_tags for select
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_tags.post_id
        and (
          community_posts.status in ('active', 'locked')
          or community_posts.author_id = auth.uid()
        )
    )
    and exists (
      select 1
      from public.community_tags
      where community_tags.id = community_post_tags.tag_id
        and community_tags.status = 'active'
    )
  );

create or replace function public.get_community_abuse_decision(
  target_user_id uuid,
  content_title text default '',
  content_body text default '',
  content_kind text default 'post'
)
returns table (
  next_status text,
  reason text,
  is_low_trust boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  combined_text text := lower(trim(coalesce(content_title, '') || ' ' || coalesce(content_body, '')));
  link_count int := 0;
  profile_row record;
  recent_comments int := 0;
  recent_posts int := 0;
  recent_reports int := 0;
  total_comments int := 0;
  total_posts int := 0;
  suspicion_score int := 0;
begin
  if target_user_id is null then
    next_status := 'held';
    reason := 'missing_user';
    is_low_trust := true;
    return next;
    return;
  end if;

  select
    profiles.id,
    profiles.created_at,
    profiles.helpful_votes,
    profiles.roast_count
  into profile_row
  from public.profiles
  where profiles.id = target_user_id;

  select count(*)::int
  into total_posts
  from public.community_posts
  where community_posts.author_id = target_user_id
    and community_posts.status in ('active', 'locked');

  select count(*)::int
  into total_comments
  from public.community_post_comments
  where community_post_comments.author_id = target_user_id
    and community_post_comments.status = 'active';

  select count(*)::int
  into recent_posts
  from public.community_posts
  where community_posts.author_id = target_user_id
    and community_posts.created_at > now() - interval '1 hour';

  select count(*)::int
  into recent_comments
  from public.community_post_comments
  where community_post_comments.author_id = target_user_id
    and community_post_comments.created_at > now() - interval '1 hour';

  select count(*)::int
  into recent_reports
  from public.content_reports
  where content_reports.reported_user_id = target_user_id
    and content_reports.status in ('pending', 'reviewing', 'actioned')
    and content_reports.last_reported_at > now() - interval '14 days';

  select count(*)::int
  into link_count
  from regexp_matches(combined_text, '(https?://|www\.)', 'g');

  is_low_trust := (
    profile_row.id is null
    or profile_row.created_at > now() - interval '72 hours'
    or (
      coalesce(profile_row.roast_count, 0) = 0
      and coalesce(profile_row.helpful_votes, 0) = 0
      and total_posts = 0
      and total_comments = 0
    )
  );

  if link_count >= 4 then
    suspicion_score := suspicion_score + 2;
  elsif link_count >= 2 then
    suspicion_score := suspicion_score + 1;
  end if;

  if combined_text ~ '(crypto|forex|airdrop|earn money|guaranteed placement|click here|dm me|whatsapp|telegram|buy now|limited offer)' then
    suspicion_score := suspicion_score + 2;
  end if;

  if combined_text ~ '(.)\1{12,}' then
    suspicion_score := suspicion_score + 1;
  end if;

  if char_length(trim(coalesce(content_body, ''))) < 40 then
    suspicion_score := suspicion_score + 1;
  end if;

  if recent_reports >= 3 then
    suspicion_score := suspicion_score + 2;
  elsif recent_reports >= 1 then
    suspicion_score := suspicion_score + 1;
  end if;

  if content_kind = 'comment' and recent_comments >= 20 then
    suspicion_score := suspicion_score + 2;
  elsif content_kind <> 'comment' and recent_posts >= 5 then
    suspicion_score := suspicion_score + 2;
  end if;

  if suspicion_score >= 4 or (is_low_trust and suspicion_score >= 2) then
    next_status := 'held';
    reason := 'crowd_control';
  else
    next_status := 'active';
    reason := 'clear';
  end if;

  return next;
end;
$$;

revoke all on function public.get_community_abuse_decision(uuid, text, text, text)
  from public, anon, authenticated;

comment on function public.get_community_abuse_decision(uuid, text, text, text) is
  'Conservative crowd-control decision helper for community posts and comments.';

drop function if exists public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb);

create or replace function public.submit_community_post(
  target_user_id uuid,
  selected_topic_id uuid,
  post_kind text,
  post_title text,
  post_body text,
  tag_names text[] default '{}'::text[],
  attachment_payload jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  topic_id uuid,
  post_type text,
  title text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  abuse_decision record;
  active_topic record;
  attachment_count int := 0;
  attachment_item jsonb;
  cleaned_body text := trim(coalesce(post_body, ''));
  cleaned_title text := trim(coalesce(post_title, ''));
  image_alt text;
  image_file_size int;
  image_file_size_text text;
  image_index int := 0;
  image_mime_type text;
  image_storage_path text;
  image_title text;
  normalized_attachments jsonb := coalesce(attachment_payload, '[]'::jsonb);
  normalized_post_type text := lower(trim(coalesce(post_kind, '')));
  normalized_tag_names text[] := '{}'::text[];
  normalized_tag_slugs text[] := '{}'::text[];
  raw_tag text;
  tag_count int := 0;
  tag_index int;
  tag_name text;
  tag_slug text;
  next_post record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community post submission must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Sign in before posting.';
  end if;

  if normalized_post_type not in ('question', 'discussion', 'resource') then
    raise exception 'Choose a valid post type.';
  end if;

  if char_length(cleaned_title) < 8 or char_length(cleaned_title) > 180 then
    raise exception 'Keep the title between 8 and 180 characters.';
  end if;

  if char_length(cleaned_body) < 20 or char_length(cleaned_body) > 12000 then
    raise exception 'Keep the post body between 20 and 12000 characters.';
  end if;

  if jsonb_typeof(normalized_attachments) <> 'array' then
    raise exception 'Post attachments must be an array.';
  end if;

  attachment_count := jsonb_array_length(normalized_attachments);

  if attachment_count > 4 then
    raise exception 'Attach at most 4 images.';
  end if;

  select
    community_topics.id,
    community_topics.is_active
  into active_topic
  from public.community_topics
  where community_topics.id = selected_topic_id;

  if not found or not active_topic.is_active then
    raise exception 'Choose an active topic.';
  end if;

  insert into public.profiles (id, username)
  values (target_user_id, public.make_linted_username(target_user_id))
  on conflict (id) do nothing;

  foreach raw_tag in array coalesce(tag_names, '{}'::text[]) loop
    tag_name := regexp_replace(trim(coalesce(raw_tag, '')), '\s+', ' ', 'g');

    if tag_name <> '' then
      tag_slug := trim(
        both '-'
        from regexp_replace(lower(tag_name), '[^a-z0-9]+', '-', 'g')
      );

      if char_length(tag_name) < 2
        or char_length(tag_slug) < 2
        or char_length(tag_slug) > 40
        or tag_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' then
        raise exception 'Use simple tag names between 2 and 40 characters.';
      end if;

      if not tag_slug = any(normalized_tag_slugs) then
        tag_count := tag_count + 1;

        if tag_count > 5 then
          raise exception 'Use at most 5 tags.';
        end if;

        normalized_tag_names := array_append(normalized_tag_names, tag_name);
        normalized_tag_slugs := array_append(normalized_tag_slugs, tag_slug);
      end if;
    end if;
  end loop;

  select *
  into abuse_decision
  from public.get_community_abuse_decision(
    target_user_id,
    cleaned_title,
    cleaned_body,
    normalized_post_type
  );

  insert into public.community_posts (
    author_id,
    topic_id,
    post_type,
    title,
    body,
    status,
    last_activity_at
  )
  values (
    target_user_id,
    active_topic.id,
    normalized_post_type,
    cleaned_title,
    cleaned_body,
    abuse_decision.next_status,
    now()
  )
  returning
    community_posts.id,
    community_posts.topic_id,
    community_posts.post_type,
    community_posts.title,
    community_posts.status,
    community_posts.created_at
  into next_post;

  if next_post.status = 'held' then
    insert into public.content_reports (
      reporter_id,
      reported_user_id,
      target_type,
      community_post_id,
      reason,
      details,
      status,
      report_count,
      last_reported_at
    )
    values (
      target_user_id,
      target_user_id,
      'community_post',
      next_post.id,
      'spam',
      'Crowd-control held this post for moderator review.',
      'pending',
      1,
      now()
    );
  end if;

  if tag_count > 0 then
    for tag_index in 1..tag_count loop
      insert into public.community_tags (
        slug,
        name,
        status
      )
      values (
        normalized_tag_slugs[tag_index],
        normalized_tag_names[tag_index],
        'active'
      )
      on conflict (slug) do nothing;
    end loop;

    insert into public.community_post_tags (post_id, tag_id)
    select
      next_post.id,
      community_tags.id
    from public.community_tags
    where community_tags.slug = any(normalized_tag_slugs)
      and community_tags.status = 'active'
    on conflict (post_id, tag_id) do nothing;

    get diagnostics tag_index = row_count;
    if tag_index <> tag_count then
      raise exception 'One or more tags are unavailable.';
    end if;
  end if;

  for attachment_item in
    select value
    from jsonb_array_elements(normalized_attachments)
  loop
    image_index := image_index + 1;
    image_storage_path := trim(coalesce(attachment_item->>'storage_path', ''));
    image_title := regexp_replace(trim(coalesce(attachment_item->>'title', 'Post image')), '\s+', ' ', 'g');
    image_alt := regexp_replace(trim(coalesce(attachment_item->>'alt_text', image_title)), '\s+', ' ', 'g');
    image_mime_type := lower(trim(coalesce(attachment_item->>'mime_type', '')));
    image_file_size_text := trim(coalesce(attachment_item->>'file_size', ''));

    if image_title = '' then
      image_title := 'Post image';
    end if;

    if image_alt = '' then
      image_alt := image_title;
    end if;

    if image_file_size_text !~ '^[0-9]+$' then
      raise exception 'Choose a valid image.';
    end if;

    image_file_size := image_file_size_text::int;

    if image_storage_path = ''
      or image_storage_path not like target_user_id::text || '/%'
      or image_storage_path ~ '(^/|//|\.\.)'
      or char_length(image_storage_path) > 500 then
      raise exception 'Choose a valid image.';
    end if;

    if image_mime_type not in ('image/png', 'image/jpeg', 'image/webp') then
      raise exception 'Upload a PNG, JPG, or WebP image.';
    end if;

    if image_file_size <= 0 or image_file_size > 5242880 then
      raise exception 'Keep post images under 5MB.';
    end if;

    if char_length(image_title) > 120 or char_length(image_alt) > 180 then
      raise exception 'Image text is too long.';
    end if;

    insert into public.community_post_attachments (
      post_id,
      user_id,
      kind,
      source,
      storage_path,
      title,
      alt_text,
      mime_type,
      file_size,
      display_order
    )
    values (
      next_post.id,
      target_user_id,
      'image',
      'upload',
      image_storage_path,
      image_title,
      image_alt,
      image_mime_type,
      image_file_size,
      image_index - 1
    );
  end loop;

  id := next_post.id;
  topic_id := next_post.topic_id;
  post_type := next_post.post_type;
  title := next_post.title;
  status := next_post.status;
  created_at := next_post.created_at;
  return next;
end;
$$;

revoke all on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb)
  to service_role;

drop function if exists public.submit_community_comment(uuid, uuid, text, uuid);

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
    body,
    status
  )
  values (
    target_post_id,
    parent_comment_id,
    target_user_id,
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

revoke all on function public.submit_community_comment(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_community_comment(uuid, uuid, text, uuid)
  to service_role;

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
  audit_metadata jsonb := '{}'::jsonb;
  audit_target_id uuid;
  audit_target_type text := 'report';
  current_report record;
  latest_previous_body text;
  latest_previous_content text;
  latest_previous_deleted_at timestamptz;
  latest_previous_status text;
  latest_previous_title text;
  latest_previous_votes jsonb := '[]'::jsonb;
  normalized_action text := lower(trim(coalesce(report_action, '')));
  normalized_note text := left(trim(coalesce(moderation_note, '')), 800);
  previous_votes jsonb := '[]'::jsonb;
  next_status text;
  rows_changed int := 0;
  target_community_comment record;
  target_community_post record;
  target_profile record;
  target_profile_id uuid;
  target_resume_id uuid;
  target_roast record;
  updated_report record;
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
    'clear_reviewer_profile',
    'remove_community_post',
    'restore_community_post',
    'lock_community_post',
    'unlock_community_post',
    'remove_community_comment',
    'restore_community_comment'
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
    content_reports.community_post_id,
    content_reports.community_comment_id,
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

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'created_at', votes.created_at,
          'reaction', votes.reaction,
          'voter_id', votes.voter_id
        )
        order by votes.created_at asc, votes.id asc
      ),
      '[]'::jsonb
    )
    into previous_votes
    from public.votes
    where votes.roast_id = current_report.roast_id;

    audit_metadata := jsonb_build_object(
      'previous_content', target_roast.content,
      'previous_dislike_count', coalesce(target_roast.dislike_count, 0),
      'previous_helpful_votes', coalesce(target_roast.helpful_votes, 0),
      'previous_votes', previous_votes,
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

    select
      moderation_actions.metadata->>'previous_content',
      coalesce(moderation_actions.metadata->'previous_votes', '[]'::jsonb)
    into latest_previous_content, latest_previous_votes
    from public.moderation_actions
    where moderation_actions.action = 'remove_roast'
      and moderation_actions.target_type = 'roast'
      and moderation_actions.target_id = current_report.roast_id
      and coalesce(moderation_actions.metadata->>'was_deleted', 'false') <> 'true'
    order by moderation_actions.created_at desc
    limit 1;

    if nullif(latest_previous_content, '') is null then
      ok := false;
      error_code := 'restore_history_missing';
      report := null;
      return next;
      return;
    end if;

    delete from public.votes
    where votes.roast_id = current_report.roast_id;

    update public.roasts
    set
      content = latest_previous_content,
      deleted_at = null,
      dislike_count = 0,
      helpful_votes = 0,
      is_deleted = false
    where roasts.id = current_report.roast_id;

    get diagnostics rows_changed = row_count;
    if rows_changed <> 1 then
      raise exception 'Review restoration failed.';
    end if;

    perform set_config('app.suppress_vote_notifications', 'on', true);

    insert into public.votes (
      roast_id,
      voter_id,
      reaction,
      created_at
    )
    select
      current_report.roast_id,
      (vote_item->>'voter_id')::uuid,
      case
        when vote_item->>'reaction' in ('like', 'dislike') then vote_item->>'reaction'
        else 'like'
      end,
      coalesce((vote_item->>'created_at')::timestamptz, now())
    from jsonb_array_elements(coalesce(latest_previous_votes, '[]'::jsonb)) as vote_item
    where vote_item->>'voter_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    on conflict (roast_id, voter_id) do update
    set reaction = excluded.reaction;

    perform set_config('app.suppress_vote_notifications', 'off', true);

    audit_metadata := jsonb_build_object(
      'restored_content', true,
      'restored_vote_count', jsonb_array_length(coalesce(latest_previous_votes, '[]'::jsonb))
    );
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
    'remove_community_post',
    'restore_community_post',
    'lock_community_post',
    'unlock_community_post'
  ) then
    if current_report.community_post_id is null then
      ok := false;
      error_code := 'community_post_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'community_post';
    audit_target_id := current_report.community_post_id;
    next_status := 'actioned';

    if normalized_action = 'restore_community_post' then
      select
        moderation_actions.metadata->>'previous_title',
        moderation_actions.metadata->>'previous_body',
        moderation_actions.metadata->>'previous_status',
        nullif(moderation_actions.metadata->>'previous_deleted_at', '')::timestamptz
      into
        latest_previous_title,
        latest_previous_body,
        latest_previous_status,
        latest_previous_deleted_at
      from public.moderation_actions
      where moderation_actions.action = 'remove_community_post'
        and moderation_actions.target_type = 'community_post'
        and moderation_actions.target_id = current_report.community_post_id
        and coalesce(moderation_actions.metadata->>'was_already_removed', 'false') <> 'true'
      order by moderation_actions.created_at desc
      limit 1;

      if nullif(latest_previous_title, '') is null
        or nullif(latest_previous_body, '') is null then
        select
          community_posts.id,
          community_posts.status
        into target_community_post
        from public.community_posts
        where community_posts.id = current_report.community_post_id
        for update;

        if not found then
          ok := false;
          error_code := 'community_post_not_found';
          report := null;
          return next;
          return;
        end if;

        if target_community_post.status <> 'held' then
          ok := false;
          error_code := 'restore_history_missing';
          report := null;
          return next;
          return;
        end if;

        update public.community_posts
        set status = 'active'
        where community_posts.id = current_report.community_post_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community post approval failed.';
        end if;

        audit_metadata := jsonb_build_object(
          'approved_held_content', true,
          'previous_status', 'held',
          'next_status', 'active'
        );
      else
        perform 1
        from public.community_posts
        where community_posts.id = current_report.community_post_id
        for update;

        if not found then
          ok := false;
          error_code := 'community_post_not_found';
          report := null;
          return next;
          return;
        end if;

        update public.community_posts
        set
          title = latest_previous_title,
          body = latest_previous_body,
          status = case
            when latest_previous_status in ('active', 'locked', 'held') then latest_previous_status
            else 'active'
          end,
          deleted_at = null
        where community_posts.id = current_report.community_post_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community post restoration failed.';
        end if;

        audit_metadata := jsonb_build_object(
          'restored_content', true,
          'restored_status', case
            when latest_previous_status in ('active', 'locked', 'held') then latest_previous_status
            else 'active'
          end,
          'previous_deleted_at', latest_previous_deleted_at
        );
      end if;
    else
      select
        community_posts.id,
        community_posts.title,
        community_posts.body,
        community_posts.status,
        community_posts.deleted_at
      into target_community_post
      from public.community_posts
      where community_posts.id = current_report.community_post_id
      for update;

      if not found then
        ok := false;
        error_code := 'community_post_not_found';
        report := null;
        return next;
        return;
      end if;

      if normalized_action = 'remove_community_post' then
        audit_metadata := jsonb_build_object(
          'previous_title', target_community_post.title,
          'previous_body', target_community_post.body,
          'previous_status', target_community_post.status,
          'previous_deleted_at', target_community_post.deleted_at,
          'was_already_removed', target_community_post.status = 'removed'
        );

        if target_community_post.status <> 'removed' then
          update public.community_posts
          set
            title = 'Removed community post',
            body = 'This post was removed by moderation.',
            status = 'removed',
            deleted_at = coalesce(community_posts.deleted_at, now())
          where community_posts.id = current_report.community_post_id;

          get diagnostics rows_changed = row_count;
          if rows_changed <> 1 then
            raise exception 'Community post removal failed.';
          end if;
        end if;
      else
        if target_community_post.status not in ('active', 'locked') then
          ok := false;
          error_code := 'community_post_not_found';
          report := null;
          return next;
          return;
        end if;

        update public.community_posts
        set status = case
          when normalized_action = 'lock_community_post' then 'locked'
          else 'active'
        end
        where community_posts.id = current_report.community_post_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community post lock update failed.';
        end if;

        audit_metadata := jsonb_build_object(
          'previous_status', target_community_post.status,
          'next_status', case
            when normalized_action = 'lock_community_post' then 'locked'
            else 'active'
          end
        );
      end if;
    end if;
  elsif normalized_action in ('remove_community_comment', 'restore_community_comment') then
    if current_report.community_comment_id is null then
      ok := false;
      error_code := 'community_comment_target_missing';
      report := null;
      return next;
      return;
    end if;

    audit_target_type := 'community_comment';
    audit_target_id := current_report.community_comment_id;
    next_status := 'actioned';

    if normalized_action = 'restore_community_comment' then
      select
        moderation_actions.metadata->>'previous_body',
        moderation_actions.metadata->>'previous_status',
        nullif(moderation_actions.metadata->>'previous_deleted_at', '')::timestamptz
      into
        latest_previous_body,
        latest_previous_status,
        latest_previous_deleted_at
      from public.moderation_actions
      where moderation_actions.action = 'remove_community_comment'
        and moderation_actions.target_type = 'community_comment'
        and moderation_actions.target_id = current_report.community_comment_id
        and coalesce(moderation_actions.metadata->>'was_already_removed', 'false') <> 'true'
      order by moderation_actions.created_at desc
      limit 1;

      if nullif(latest_previous_body, '') is null then
        select
          community_post_comments.id,
          community_post_comments.status
        into target_community_comment
        from public.community_post_comments
        where community_post_comments.id = current_report.community_comment_id
        for update;

        if not found then
          ok := false;
          error_code := 'community_comment_not_found';
          report := null;
          return next;
          return;
        end if;

        if target_community_comment.status <> 'held' then
          ok := false;
          error_code := 'restore_history_missing';
          report := null;
          return next;
          return;
        end if;

        update public.community_post_comments
        set status = 'active'
        where community_post_comments.id = current_report.community_comment_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community comment approval failed.';
        end if;

        audit_metadata := jsonb_build_object(
          'approved_held_content', true,
          'previous_status', 'held',
          'next_status', 'active'
        );
      else
        perform 1
        from public.community_post_comments
        where community_post_comments.id = current_report.community_comment_id
        for update;

        if not found then
          ok := false;
          error_code := 'community_comment_not_found';
          report := null;
          return next;
          return;
        end if;

        update public.community_post_comments
        set
          body = latest_previous_body,
          status = case
            when latest_previous_status in ('active', 'held') then latest_previous_status
            else 'active'
          end,
          deleted_at = null
        where community_post_comments.id = current_report.community_comment_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community comment restoration failed.';
        end if;

        audit_metadata := jsonb_build_object(
          'restored_content', true,
          'restored_status', case
            when latest_previous_status in ('active', 'held') then latest_previous_status
            else 'active'
          end,
          'previous_deleted_at', latest_previous_deleted_at
        );
      end if;
    else
      select
        community_post_comments.id,
        community_post_comments.body,
        community_post_comments.status,
        community_post_comments.deleted_at
      into target_community_comment
      from public.community_post_comments
      where community_post_comments.id = current_report.community_comment_id
      for update;

      if not found then
        ok := false;
        error_code := 'community_comment_not_found';
        report := null;
        return next;
        return;
      end if;

      audit_metadata := jsonb_build_object(
        'previous_body', target_community_comment.body,
        'previous_status', target_community_comment.status,
        'previous_deleted_at', target_community_comment.deleted_at,
        'was_already_removed', target_community_comment.status = 'removed'
      );

      if target_community_comment.status <> 'removed' then
        update public.community_post_comments
        set
          body = '[removed]',
          status = 'removed',
          deleted_at = coalesce(community_post_comments.deleted_at, now())
        where community_post_comments.id = current_report.community_comment_id;

        get diagnostics rows_changed = row_count;
        if rows_changed <> 1 then
          raise exception 'Community comment removal failed.';
        end if;
      end if;
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

revoke all on function public.admin_apply_report_action(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_apply_report_action(uuid, uuid, text, text)
  to service_role;

comment on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb) is
  'Service-role-only community post creation contract with media and crowd-control status.';
comment on function public.submit_community_comment(uuid, uuid, text, uuid) is
  'Service-role-only root or threaded community comment creation contract with crowd-control status.';
comment on function public.admin_apply_report_action(uuid, uuid, text, text) is
  'Service-role-only transaction for admin content report decisions, target mutations, and audit rows.';

notify pgrst, 'reload schema';
