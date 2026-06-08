-- Linted 0054: community post images and comment submit RPCs.
-- Keeps media normalized and keeps browser writes behind narrow server APIs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-media',
  'community-post-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

alter table public.upload_security_events
  drop constraint if exists upload_security_events_upload_kind_check,
  add constraint upload_security_events_upload_kind_check
    check (upload_kind in ('avatar', 'comment-media', 'community-post-media', 'resume'));

create table if not exists public.community_post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'image',
  source text not null default 'upload',
  storage_path text not null,
  title text not null default 'Post image',
  alt_text text not null default 'Post image',
  mime_type text not null,
  file_size int not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.community_post_attachments
  add column if not exists post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists kind text not null default 'image',
  add column if not exists source text not null default 'upload',
  add column if not exists storage_path text,
  add column if not exists title text not null default 'Post image',
  add column if not exists alt_text text not null default 'Post image',
  add column if not exists mime_type text not null default 'image/png',
  add column if not exists file_size int not null default 1,
  add column if not exists display_order int not null default 0,
  add column if not exists created_at timestamptz not null default now();

update public.community_post_attachments
set
  kind = 'image',
  source = 'upload',
  storage_path = nullif(trim(coalesce(storage_path, '')), ''),
  title = left(nullif(regexp_replace(trim(coalesce(title, '')), '\s+', ' ', 'g'), ''), 120),
  alt_text = left(nullif(regexp_replace(trim(coalesce(alt_text, '')), '\s+', ' ', 'g'), ''), 180),
  display_order = greatest(coalesce(display_order, 0), 0),
  created_at = coalesce(created_at, now());

update public.community_post_attachments
set
  title = coalesce(title, 'Post image'),
  alt_text = coalesce(alt_text, 'Post image');

alter table public.community_post_attachments
  alter column post_id set not null,
  alter column user_id set not null,
  alter column kind set default 'image',
  alter column kind set not null,
  alter column source set default 'upload',
  alter column source set not null,
  alter column storage_path set not null,
  alter column title set default 'Post image',
  alter column title set not null,
  alter column alt_text set default 'Post image',
  alter column alt_text set not null,
  alter column mime_type set not null,
  alter column file_size set not null,
  alter column display_order set default 0,
  alter column display_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  drop constraint if exists community_post_attachments_kind_check,
  drop constraint if exists community_post_attachments_source_check,
  drop constraint if exists community_post_attachments_storage_path_check,
  drop constraint if exists community_post_attachments_mime_type_check,
  drop constraint if exists community_post_attachments_file_size_check,
  drop constraint if exists community_post_attachments_text_length_check,
  drop constraint if exists community_post_attachments_display_order_check,
  add constraint community_post_attachments_kind_check
    check (kind = 'image'),
  add constraint community_post_attachments_source_check
    check (source = 'upload'),
  add constraint community_post_attachments_storage_path_check
    check (
      char_length(storage_path) between 3 and 500
      and storage_path !~ '(^/|//|\.\.)'
    ),
  add constraint community_post_attachments_mime_type_check
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  add constraint community_post_attachments_file_size_check
    check (file_size > 0 and file_size <= 5242880),
  add constraint community_post_attachments_text_length_check
    check (char_length(title) <= 120 and char_length(alt_text) <= 180),
  add constraint community_post_attachments_display_order_check
    check (display_order >= 0);

create unique index if not exists community_post_attachments_storage_path_unique_idx
  on public.community_post_attachments (storage_path);

create index if not exists community_post_attachments_post_order_idx
  on public.community_post_attachments (post_id, display_order asc, created_at asc);

create index if not exists community_post_attachments_user_created_idx
  on public.community_post_attachments (user_id, created_at desc);

alter table public.community_post_attachments enable row level security;

revoke all on table public.community_post_attachments from anon, authenticated;
grant select on table public.community_post_attachments to authenticated;

drop policy if exists "Visible community post attachments are readable"
  on public.community_post_attachments;
create policy "Visible community post attachments are readable"
  on public.community_post_attachments for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_attachments.post_id
        and community_posts.status in ('active', 'locked')
    )
  );

drop function if exists public.submit_community_post(uuid, uuid, text, text, text, text[]);
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
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
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
  created_at := next_post.created_at;
  return next;
end;
$$;

revoke all on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb)
  to service_role;

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
  cleaned_body text := trim(coalesce(comment_body, ''));
  target_post record;
  target_parent record;
  next_comment record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community comment submission must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Sign in before commenting.';
  end if;

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
      community_post_comments.status
    into target_parent
    from public.community_post_comments
    where community_post_comments.id = parent_comment_id;

    if not found
      or target_parent.post_id <> target_post_id
      or target_parent.status <> 'active' then
      raise exception 'Choose an active parent comment.';
    end if;
  end if;

  insert into public.profiles (id, username)
  values (target_user_id, public.make_linted_username(target_user_id))
  on conflict (id) do nothing;

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

comment on table public.community_post_attachments is
  'Uploaded image attachments for community posts; post text remains in community_posts.';
comment on function public.submit_community_post(uuid, uuid, text, text, text, text[], jsonb) is
  'Service-role-only community post creation contract with optional uploaded image attachments.';
comment on function public.submit_community_comment(uuid, uuid, text, uuid) is
  'Service-role-only root or threaded community comment creation contract.';

notify pgrst, 'reload schema';
