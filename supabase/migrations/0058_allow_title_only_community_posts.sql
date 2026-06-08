-- Linted 0058: allow title-only community posts.
-- Reddit-style posts can have optional body text, so keep the title required
-- while allowing community_posts.body to be an empty string.

alter table public.community_posts
  drop constraint if exists community_posts_body_length_check,
  add constraint community_posts_body_length_check
    check (char_length(body) <= 12000);

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

  if char_length(cleaned_body) > 12000 then
    raise exception 'Keep the post body under 12000 characters.';
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
  on conflict on constraint profiles_pkey do nothing;

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

comment on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb) is
  'Service-role-only community post creation contract with optional body text, media, and crowd-control status.';

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

  if char_length(cleaned_body) > 12000 then
    raise exception 'Keep post bodies under 12000 characters.';
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

notify pgrst, 'reload schema';
