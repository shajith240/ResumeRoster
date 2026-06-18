-- Linted 0053: controlled community post submit RPC.
-- Keeps direct browser writes closed while allowing the Next.js API route to
-- create text community posts through a narrow service-role contract.

alter table public.community_tags
  drop constraint if exists community_tags_slug_format_check,
  add constraint community_tags_slug_format_check
    check (
      char_length(slug) between 2 and 40
      and slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
    );

create or replace function public.submit_community_post(
  target_user_id uuid,
  selected_topic_id uuid,
  post_kind text,
  post_title text,
  post_body text,
  tag_names text[] default '{}'::text[]
)
returns table (
  id uuid,
  topic_id uuid,
  post_type text,
  title text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_topic record;
  cleaned_body text := trim(coalesce(post_body, ''));
  cleaned_title text := trim(coalesce(post_title, ''));
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
    'active',
    now()
  )
  returning
    community_posts.id,
    community_posts.topic_id,
    community_posts.post_type,
    community_posts.title,
    community_posts.created_at
  into next_post;

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

  id := next_post.id;
  topic_id := next_post.topic_id;
  post_type := next_post.post_type;
  title := next_post.title;
  created_at := next_post.created_at;
  return next;
end;
$$;

revoke all on function public.submit_community_post(uuid, uuid, text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.submit_community_post(uuid, uuid, text, text, text, text[])
  to service_role;

comment on function public.submit_community_post(uuid, uuid, text, text, text, text[]) is
  'Service-role-only community text post creation contract used by the Next.js API route.';

notify pgrst, 'reload schema';
