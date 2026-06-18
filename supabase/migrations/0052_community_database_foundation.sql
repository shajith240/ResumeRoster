-- Linted 0052: normalized community posting foundation.
-- Adds the career community data model without touching resume submissions,
-- resume reviews, or the existing resume feed routes.

create table if not exists public.community_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text not null default '',
  display_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_topics
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists display_order int not null default 100,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.community_topics
set
  slug = lower(trim(coalesce(slug, ''))),
  name = nullif(trim(coalesce(name, '')), ''),
  description = left(trim(coalesce(description, '')), 240),
  display_order = coalesce(display_order, 100),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.community_topics
  alter column slug set not null,
  alter column name set not null,
  alter column description set default '',
  alter column description set not null,
  alter column display_order set default 100,
  alter column display_order set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_topics_slug_format_check,
  drop constraint if exists community_topics_name_length_check,
  drop constraint if exists community_topics_description_length_check,
  add constraint community_topics_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  add constraint community_topics_name_length_check
    check (char_length(name) between 2 and 80),
  add constraint community_topics_description_length_check
    check (char_length(description) <= 240);

create unique index if not exists community_topics_slug_unique_idx
  on public.community_topics (slug);

create index if not exists community_topics_active_order_idx
  on public.community_topics (is_active, display_order asc, name asc);

insert into public.community_topics (
  slug,
  name,
  description,
  display_order,
  is_active
)
values
  ('placement', 'Placement', 'Campus placement doubts, preparation, and offer decisions.', 10, true),
  ('internship', 'Internship', 'Internship search, conversion, applications, and timelines.', 20, true),
  ('interview', 'Interview', 'Interview rounds, coding screens, HR rounds, and preparation.', 30, true),
  ('projects', 'Projects', 'Portfolio projects, project ideas, proof, and implementation feedback.', 40, true),
  ('tech', 'Tech', 'Programming, tools, system design, and technical learning questions.', 50, true),
  ('career', 'Career', 'Career growth, role choices, workplace decisions, and long-term direction.', 60, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.community_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_tags
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.community_tags
set
  slug = lower(trim(coalesce(slug, ''))),
  name = nullif(trim(coalesce(name, '')), ''),
  description = left(trim(coalesce(description, '')), 240),
  status = case when status in ('active', 'hidden') then status else 'active' end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.community_tags
  alter column slug set not null,
  alter column name set not null,
  alter column description set default '',
  alter column description set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_tags_slug_format_check,
  drop constraint if exists community_tags_name_length_check,
  drop constraint if exists community_tags_description_length_check,
  drop constraint if exists community_tags_status_check,
  add constraint community_tags_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  add constraint community_tags_name_length_check
    check (char_length(name) between 2 and 80),
  add constraint community_tags_description_length_check
    check (char_length(description) <= 240),
  add constraint community_tags_status_check
    check (status in ('active', 'hidden'));

create unique index if not exists community_tags_slug_unique_idx
  on public.community_tags (slug);

create index if not exists community_tags_active_name_idx
  on public.community_tags (status, name asc);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.community_topics(id) on delete restrict,
  post_type text not null default 'question',
  title text not null,
  body text not null,
  status text not null default 'active',
  comment_count int not null default 0,
  upvote_count int not null default 0,
  downvote_count int not null default 0,
  save_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_posts
  add column if not exists author_id uuid references public.profiles(id) on delete cascade,
  add column if not exists topic_id uuid references public.community_topics(id) on delete restrict,
  add column if not exists post_type text not null default 'question',
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists status text not null default 'active',
  add column if not exists comment_count int not null default 0,
  add column if not exists upvote_count int not null default 0,
  add column if not exists downvote_count int not null default 0,
  add column if not exists save_count int not null default 0,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.community_posts
set
  post_type = case
    when post_type in ('question', 'discussion', 'resource', 'announcement') then post_type
    else 'question'
  end,
  title = nullif(trim(coalesce(title, '')), ''),
  body = nullif(trim(coalesce(body, '')), ''),
  status = case
    when status in ('active', 'locked', 'deleted', 'removed') then status
    else 'active'
  end,
  comment_count = greatest(coalesce(comment_count, 0), 0),
  upvote_count = greatest(coalesce(upvote_count, 0), 0),
  downvote_count = greatest(coalesce(downvote_count, 0), 0),
  save_count = greatest(coalesce(save_count, 0), 0),
  last_activity_at = coalesce(last_activity_at, created_at, now()),
  deleted_at = case
    when status in ('deleted', 'removed') then coalesce(deleted_at, updated_at, now())
    else null
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.community_posts
  alter column author_id set not null,
  alter column topic_id set not null,
  alter column post_type set default 'question',
  alter column post_type set not null,
  alter column title set not null,
  alter column body set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column comment_count set default 0,
  alter column comment_count set not null,
  alter column upvote_count set default 0,
  alter column upvote_count set not null,
  alter column downvote_count set default 0,
  alter column downvote_count set not null,
  alter column save_count set default 0,
  alter column save_count set not null,
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_posts_post_type_check,
  drop constraint if exists community_posts_status_check,
  drop constraint if exists community_posts_title_length_check,
  drop constraint if exists community_posts_body_length_check,
  drop constraint if exists community_posts_counter_check,
  drop constraint if exists community_posts_deleted_at_check,
  add constraint community_posts_post_type_check
    check (post_type in ('question', 'discussion', 'resource', 'announcement')),
  add constraint community_posts_status_check
    check (status in ('active', 'locked', 'deleted', 'removed')),
  add constraint community_posts_title_length_check
    check (char_length(title) between 8 and 180),
  add constraint community_posts_body_length_check
    check (char_length(body) between 1 and 12000),
  add constraint community_posts_counter_check
    check (
      comment_count >= 0
      and upvote_count >= 0
      and downvote_count >= 0
      and save_count >= 0
    ),
  add constraint community_posts_deleted_at_check
    check (
      (
        status in ('active', 'locked')
        and deleted_at is null
      )
      or (
        status in ('deleted', 'removed')
        and deleted_at is not null
      )
    );

create index if not exists community_posts_status_created_at_idx
  on public.community_posts (status, created_at desc);

create index if not exists community_posts_topic_status_created_at_idx
  on public.community_posts (topic_id, status, created_at desc);

create index if not exists community_posts_author_created_at_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists community_posts_last_activity_idx
  on public.community_posts (status, last_activity_at desc);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  parent_id uuid references public.community_post_comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'active',
  reply_count int not null default 0,
  upvote_count int not null default 0,
  downvote_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_post_comments
  add column if not exists post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists parent_id uuid references public.community_post_comments(id) on delete cascade,
  add column if not exists author_id uuid references public.profiles(id) on delete cascade,
  add column if not exists body text,
  add column if not exists status text not null default 'active',
  add column if not exists reply_count int not null default 0,
  add column if not exists upvote_count int not null default 0,
  add column if not exists downvote_count int not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.community_post_comments
set
  body = nullif(trim(coalesce(body, '')), ''),
  status = case when status in ('active', 'deleted', 'removed') then status else 'active' end,
  reply_count = greatest(coalesce(reply_count, 0), 0),
  upvote_count = greatest(coalesce(upvote_count, 0), 0),
  downvote_count = greatest(coalesce(downvote_count, 0), 0),
  deleted_at = case
    when status in ('deleted', 'removed') then coalesce(deleted_at, updated_at, now())
    else null
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.community_post_comments
  alter column post_id set not null,
  alter column author_id set not null,
  alter column body set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column reply_count set default 0,
  alter column reply_count set not null,
  alter column upvote_count set default 0,
  alter column upvote_count set not null,
  alter column downvote_count set default 0,
  alter column downvote_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_post_comments_parent_not_self,
  drop constraint if exists community_post_comments_status_check,
  drop constraint if exists community_post_comments_body_length_check,
  drop constraint if exists community_post_comments_counter_check,
  drop constraint if exists community_post_comments_deleted_at_check,
  add constraint community_post_comments_parent_not_self
    check (parent_id is null or parent_id <> id),
  add constraint community_post_comments_status_check
    check (status in ('active', 'deleted', 'removed')),
  add constraint community_post_comments_body_length_check
    check (char_length(body) between 1 and 6000),
  add constraint community_post_comments_counter_check
    check (
      reply_count >= 0
      and upvote_count >= 0
      and downvote_count >= 0
    ),
  add constraint community_post_comments_deleted_at_check
    check (
      (
        status = 'active'
        and deleted_at is null
      )
      or (
        status in ('deleted', 'removed')
        and deleted_at is not null
      )
    );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_post_comments_id_post_id_key'
      and conrelid = 'public.community_post_comments'::regclass
  ) then
    alter table public.community_post_comments
      add constraint community_post_comments_id_post_id_key unique (id, post_id);
  end if;
end $$;

create index if not exists community_post_comments_post_parent_created_idx
  on public.community_post_comments (post_id, parent_id, created_at asc);

create index if not exists community_post_comments_active_post_created_idx
  on public.community_post_comments (post_id, created_at asc)
  where status = 'active';

create index if not exists community_post_comments_author_created_idx
  on public.community_post_comments (author_id, created_at desc);

create table if not exists public.community_post_tags (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  tag_id uuid not null references public.community_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);

alter table public.community_post_tags
  add column if not exists post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists tag_id uuid references public.community_tags(id) on delete restrict,
  add column if not exists created_at timestamptz not null default now();

alter table public.community_post_tags
  alter column post_id set not null,
  alter column tag_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists community_post_tags_tag_id_idx
  on public.community_post_tags (tag_id, post_id);

create table if not exists public.community_post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'upvote',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, voter_id)
);

alter table public.community_post_votes
  add column if not exists post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists voter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists reaction text not null default 'upvote',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.community_post_votes
  alter column post_id set not null,
  alter column voter_id set not null,
  alter column reaction set default 'upvote',
  alter column reaction set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_post_votes_reaction_check,
  add constraint community_post_votes_reaction_check
    check (reaction in ('upvote', 'downvote'));

create index if not exists community_post_votes_voter_created_idx
  on public.community_post_votes (voter_id, created_at desc);

create table if not exists public.community_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_post_comments(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'upvote',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comment_id, voter_id)
);

alter table public.community_comment_votes
  add column if not exists comment_id uuid references public.community_post_comments(id) on delete cascade,
  add column if not exists voter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists reaction text not null default 'upvote',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.community_comment_votes
  alter column comment_id set not null,
  alter column voter_id set not null,
  alter column reaction set default 'upvote',
  alter column reaction set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  drop constraint if exists community_comment_votes_reaction_check,
  add constraint community_comment_votes_reaction_check
    check (reaction in ('upvote', 'downvote'));

create index if not exists community_comment_votes_voter_created_idx
  on public.community_comment_votes (voter_id, created_at desc);

create table if not exists public.community_post_saves (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_post_saves
  add column if not exists post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.community_post_saves
  alter column post_id set not null,
  alter column user_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists community_post_saves_user_created_idx
  on public.community_post_saves (user_id, created_at desc);

create or replace function public.touch_community_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_community_topics_updated on public.community_topics;
create trigger touch_community_topics_updated
  before update on public.community_topics
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists touch_community_tags_updated on public.community_tags;
create trigger touch_community_tags_updated
  before update on public.community_tags
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists touch_community_posts_updated on public.community_posts;
create trigger touch_community_posts_updated
  before update on public.community_posts
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists touch_community_comments_updated on public.community_post_comments;
create trigger touch_community_comments_updated
  before update on public.community_post_comments
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists touch_community_post_votes_updated on public.community_post_votes;
create trigger touch_community_post_votes_updated
  before update on public.community_post_votes
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists touch_community_comment_votes_updated on public.community_comment_votes;
create trigger touch_community_comment_votes_updated
  before update on public.community_comment_votes
  for each row execute procedure public.touch_community_updated_at();

create or replace function public.validate_community_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

  select
    community_post_comments.id,
    community_post_comments.post_id,
    community_post_comments.status
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

  return new;
end;
$$;

drop trigger if exists validate_community_comment_parent_before_write
  on public.community_post_comments;
create trigger validate_community_comment_parent_before_write
  before insert or update of post_id, parent_id on public.community_post_comments
  for each row execute procedure public.validate_community_comment_parent();

create or replace function public.handle_community_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.community_posts
    set
      comment_count = comment_count + 1,
      last_activity_at = greatest(last_activity_at, new.created_at)
    where id = new.post_id;

    if new.parent_id is not null then
      update public.community_post_comments
      set reply_count = reply_count + 1
      where id = new.parent_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_community_comment_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' then
    update public.community_posts
    set comment_count = greatest(comment_count - 1, 0)
    where id = old.post_id;

    if old.parent_id is not null then
      update public.community_post_comments
      set reply_count = greatest(reply_count - 1, 0)
      where id = old.parent_id;
    end if;
  end if;

  return old;
end;
$$;

create or replace function public.handle_community_comment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    update public.community_posts
    set comment_count = greatest(comment_count - 1, 0)
    where id = new.post_id;

    if new.parent_id is not null then
      update public.community_post_comments
      set reply_count = greatest(reply_count - 1, 0)
      where id = new.parent_id;
    end if;
  elsif old.status <> 'active' and new.status = 'active' then
    update public.community_posts
    set
      comment_count = comment_count + 1,
      last_activity_at = greatest(last_activity_at, new.updated_at)
    where id = new.post_id;

    if new.parent_id is not null then
      update public.community_post_comments
      set reply_count = reply_count + 1
      where id = new.parent_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_community_comment_created on public.community_post_comments;
create trigger on_community_comment_created
  after insert on public.community_post_comments
  for each row execute procedure public.handle_community_comment_created();

drop trigger if exists on_community_comment_deleted on public.community_post_comments;
create trigger on_community_comment_deleted
  after delete on public.community_post_comments
  for each row execute procedure public.handle_community_comment_deleted();

drop trigger if exists on_community_comment_status_changed
  on public.community_post_comments;
create trigger on_community_comment_status_changed
  after update of status on public.community_post_comments
  for each row execute procedure public.handle_community_comment_status_changed();

create or replace function public.apply_community_post_vote_delta(
  target_post_id uuid,
  target_reaction text,
  delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_reaction = 'upvote' then
    update public.community_posts
    set upvote_count = greatest(upvote_count + delta, 0)
    where id = target_post_id
      and status in ('active', 'locked');
  elsif target_reaction = 'downvote' then
    update public.community_posts
    set downvote_count = greatest(downvote_count + delta, 0)
    where id = target_post_id
      and status in ('active', 'locked');
  end if;
end;
$$;

create or replace function public.apply_community_comment_vote_delta(
  target_comment_id uuid,
  target_reaction text,
  delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_reaction = 'upvote' then
    update public.community_post_comments
    set upvote_count = greatest(upvote_count + delta, 0)
    where id = target_comment_id
      and status = 'active';
  elsif target_reaction = 'downvote' then
    update public.community_post_comments
    set downvote_count = greatest(downvote_count + delta, 0)
    where id = target_comment_id
      and status = 'active';
  end if;
end;
$$;

create or replace function public.handle_community_post_vote_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_community_post_vote_delta(new.post_id, new.reaction, 1);
  return new;
end;
$$;

create or replace function public.handle_community_post_vote_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_community_post_vote_delta(old.post_id, old.reaction, -1);
  return old;
end;
$$;

create or replace function public.handle_community_post_vote_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reaction <> new.reaction then
    perform public.apply_community_post_vote_delta(old.post_id, old.reaction, -1);
    perform public.apply_community_post_vote_delta(new.post_id, new.reaction, 1);
  end if;

  return new;
end;
$$;

drop trigger if exists on_community_post_vote_created on public.community_post_votes;
create trigger on_community_post_vote_created
  after insert on public.community_post_votes
  for each row execute procedure public.handle_community_post_vote_created();

drop trigger if exists on_community_post_vote_deleted on public.community_post_votes;
create trigger on_community_post_vote_deleted
  after delete on public.community_post_votes
  for each row execute procedure public.handle_community_post_vote_deleted();

drop trigger if exists on_community_post_vote_updated on public.community_post_votes;
create trigger on_community_post_vote_updated
  after update of reaction on public.community_post_votes
  for each row execute procedure public.handle_community_post_vote_updated();

create or replace function public.handle_community_comment_vote_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_community_comment_vote_delta(new.comment_id, new.reaction, 1);
  return new;
end;
$$;

create or replace function public.handle_community_comment_vote_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_community_comment_vote_delta(old.comment_id, old.reaction, -1);
  return old;
end;
$$;

create or replace function public.handle_community_comment_vote_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reaction <> new.reaction then
    perform public.apply_community_comment_vote_delta(old.comment_id, old.reaction, -1);
    perform public.apply_community_comment_vote_delta(new.comment_id, new.reaction, 1);
  end if;

  return new;
end;
$$;

drop trigger if exists on_community_comment_vote_created
  on public.community_comment_votes;
create trigger on_community_comment_vote_created
  after insert on public.community_comment_votes
  for each row execute procedure public.handle_community_comment_vote_created();

drop trigger if exists on_community_comment_vote_deleted
  on public.community_comment_votes;
create trigger on_community_comment_vote_deleted
  after delete on public.community_comment_votes
  for each row execute procedure public.handle_community_comment_vote_deleted();

drop trigger if exists on_community_comment_vote_updated
  on public.community_comment_votes;
create trigger on_community_comment_vote_updated
  after update of reaction on public.community_comment_votes
  for each row execute procedure public.handle_community_comment_vote_updated();

create or replace function public.handle_community_post_saved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_posts
  set save_count = save_count + 1
  where id = new.post_id
    and status in ('active', 'locked');

  return new;
end;
$$;

create or replace function public.handle_community_post_unsaved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_posts
  set save_count = greatest(save_count - 1, 0)
  where id = old.post_id
    and status in ('active', 'locked');

  return old;
end;
$$;

drop trigger if exists on_community_post_saved on public.community_post_saves;
create trigger on_community_post_saved
  after insert on public.community_post_saves
  for each row execute procedure public.handle_community_post_saved();

drop trigger if exists on_community_post_unsaved on public.community_post_saves;
create trigger on_community_post_unsaved
  after delete on public.community_post_saves
  for each row execute procedure public.handle_community_post_unsaved();

create or replace function public.recalculate_community_counters()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community counter recalculation must use the service role.';
  end if;

  update public.community_posts
  set
    comment_count = coalesce(counter_rows.comment_count, 0),
    upvote_count = coalesce(counter_rows.upvote_count, 0),
    downvote_count = coalesce(counter_rows.downvote_count, 0),
    save_count = coalesce(counter_rows.save_count, 0)
  from (
    select
      community_posts.id,
      count(distinct community_post_comments.id)
        filter (where community_post_comments.status = 'active')::int as comment_count,
      count(distinct community_post_votes.id)
        filter (where community_post_votes.reaction = 'upvote')::int as upvote_count,
      count(distinct community_post_votes.id)
        filter (where community_post_votes.reaction = 'downvote')::int as downvote_count,
      count(distinct community_post_saves.user_id)::int as save_count
    from public.community_posts
    left join public.community_post_comments
      on community_post_comments.post_id = community_posts.id
    left join public.community_post_votes
      on community_post_votes.post_id = community_posts.id
    left join public.community_post_saves
      on community_post_saves.post_id = community_posts.id
    group by community_posts.id
  ) as counter_rows
  where community_posts.id = counter_rows.id;

  update public.community_post_comments
  set
    reply_count = coalesce(counter_rows.reply_count, 0),
    upvote_count = coalesce(counter_rows.upvote_count, 0),
    downvote_count = coalesce(counter_rows.downvote_count, 0)
  from (
    select
      community_post_comments.id,
      count(distinct child_comments.id)
        filter (where child_comments.status = 'active')::int as reply_count,
      count(distinct community_comment_votes.id)
        filter (where community_comment_votes.reaction = 'upvote')::int as upvote_count,
      count(distinct community_comment_votes.id)
        filter (where community_comment_votes.reaction = 'downvote')::int as downvote_count
    from public.community_post_comments
    left join public.community_post_comments as child_comments
      on child_comments.parent_id = community_post_comments.id
    left join public.community_comment_votes
      on community_comment_votes.comment_id = community_post_comments.id
    group by community_post_comments.id
  ) as counter_rows
  where community_post_comments.id = counter_rows.id;
end;
$$;

create or replace function public.guard_community_post_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('community_post_insert', 600, 12);
  return new;
end;
$$;

create or replace function public.guard_community_comment_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('community_comment_insert', 300, 60);
  return new;
end;
$$;

create or replace function public.guard_community_vote_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('community_vote_write', 300, 160);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.guard_community_save_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_authenticated_rate_limit('community_save_write', 300, 80);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_community_post_insert_rate_limit
  on public.community_posts;
create trigger enforce_community_post_insert_rate_limit
  before insert on public.community_posts
  for each row execute procedure public.guard_community_post_insert_rate_limit();

drop trigger if exists enforce_community_comment_insert_rate_limit
  on public.community_post_comments;
create trigger enforce_community_comment_insert_rate_limit
  before insert on public.community_post_comments
  for each row execute procedure public.guard_community_comment_insert_rate_limit();

drop trigger if exists enforce_community_post_vote_insert_rate_limit
  on public.community_post_votes;
create trigger enforce_community_post_vote_insert_rate_limit
  before insert on public.community_post_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_post_vote_update_rate_limit
  on public.community_post_votes;
create trigger enforce_community_post_vote_update_rate_limit
  before update of reaction on public.community_post_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_post_vote_delete_rate_limit
  on public.community_post_votes;
create trigger enforce_community_post_vote_delete_rate_limit
  before delete on public.community_post_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_comment_vote_insert_rate_limit
  on public.community_comment_votes;
create trigger enforce_community_comment_vote_insert_rate_limit
  before insert on public.community_comment_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_comment_vote_update_rate_limit
  on public.community_comment_votes;
create trigger enforce_community_comment_vote_update_rate_limit
  before update of reaction on public.community_comment_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_comment_vote_delete_rate_limit
  on public.community_comment_votes;
create trigger enforce_community_comment_vote_delete_rate_limit
  before delete on public.community_comment_votes
  for each row execute procedure public.guard_community_vote_write_rate_limit();

drop trigger if exists enforce_community_post_save_insert_rate_limit
  on public.community_post_saves;
create trigger enforce_community_post_save_insert_rate_limit
  before insert on public.community_post_saves
  for each row execute procedure public.guard_community_save_write_rate_limit();

drop trigger if exists enforce_community_post_save_delete_rate_limit
  on public.community_post_saves;
create trigger enforce_community_post_save_delete_rate_limit
  before delete on public.community_post_saves
  for each row execute procedure public.guard_community_save_write_rate_limit();

alter table public.content_reports
  add column if not exists community_post_id uuid references public.community_posts(id) on delete cascade,
  add column if not exists community_comment_id uuid references public.community_post_comments(id) on delete cascade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_reports_community_comment_post_fkey'
      and conrelid = 'public.content_reports'::regclass
  ) then
    alter table public.content_reports
      add constraint content_reports_community_comment_post_fkey
      foreign key (community_comment_id, community_post_id)
      references public.community_post_comments(id, post_id)
      on delete cascade;
  end if;
end $$;

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check,
  drop constraint if exists content_reports_target_shape_check,
  add constraint content_reports_target_type_check
    check (target_type in ('resume', 'roast', 'profile', 'community_post', 'community_comment')),
  add constraint content_reports_target_shape_check
    check (
      (
        target_type = 'resume'
        and resume_id is not null
        and roast_id is null
        and profile_id is null
        and community_post_id is null
        and community_comment_id is null
      )
      or (
        target_type = 'roast'
        and resume_id is not null
        and roast_id is not null
        and profile_id is null
        and community_post_id is null
        and community_comment_id is null
      )
      or (
        target_type = 'profile'
        and profile_id is not null
        and resume_id is null
        and roast_id is null
        and community_post_id is null
        and community_comment_id is null
      )
      or (
        target_type = 'community_post'
        and community_post_id is not null
        and community_comment_id is null
        and resume_id is null
        and roast_id is null
        and profile_id is null
      )
      or (
        target_type = 'community_comment'
        and community_post_id is not null
        and community_comment_id is not null
        and resume_id is null
        and roast_id is null
        and profile_id is null
      )
    );

create index if not exists content_reports_community_post_id_idx
  on public.content_reports (community_post_id)
  where community_post_id is not null;

create index if not exists content_reports_community_comment_id_idx
  on public.content_reports (community_comment_id)
  where community_comment_id is not null;

create unique index if not exists content_reports_pending_community_post_unique_idx
  on public.content_reports (reporter_id, community_post_id)
  where target_type = 'community_post'
    and status = 'pending';

create unique index if not exists content_reports_pending_community_comment_unique_idx
  on public.content_reports (reporter_id, community_comment_id)
  where target_type = 'community_comment'
    and status = 'pending';

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check,
  drop constraint if exists moderation_actions_target_type_check,
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
        'remove_community_comment',
        'restore_community_comment'
      )
    ),
  add constraint moderation_actions_target_type_check
    check (
      target_type in (
        'report',
        'roast',
        'resume',
        'sticker',
        'reviewer_application',
        'profile',
        'user',
        'broadcast',
        'community_post',
        'community_comment'
      )
    );

drop function if exists public.report_content(text, uuid, uuid, uuid, text, text);
drop function if exists public.report_content(text, uuid, uuid, uuid, uuid, uuid, text, text);

create or replace function public.report_content(
  report_target_type text,
  target_resume_id uuid default null,
  target_roast_id uuid default null,
  target_profile_id uuid default null,
  target_community_post_id uuid default null,
  target_community_comment_id uuid default null,
  report_reason text default 'other',
  report_details text default ''
)
returns table (
  id uuid,
  status text,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  raw_target_type text := lower(trim(coalesce(report_target_type, '')));
  normalized_target_type text := case
    when raw_target_type in ('review', 'resume_review') then 'roast'
    when raw_target_type in ('post', 'community_post') then 'community_post'
    when raw_target_type in ('comment', 'community_comment') then 'community_comment'
    else raw_target_type
  end;
  normalized_reason text := lower(trim(coalesce(report_reason, 'other')));
  normalized_details text := trim(coalesce(report_details, ''));
  target_resume record;
  target_roast record;
  target_profile record;
  target_community_post record;
  target_community_comment record;
  existing_report_id uuid;
  next_report record;
  resolved_resume_id uuid := target_resume_id;
  resolved_profile_id uuid := target_profile_id;
  resolved_community_post_id uuid := target_community_post_id;
  resolved_community_comment_id uuid := target_community_comment_id;
  resolved_reported_user_id uuid;
begin
  if active_user is null then
    raise exception 'Sign in to report content.';
  end if;

  perform public.enforce_authenticated_rate_limit('content_report', 3600, 20);

  if normalized_target_type not in ('resume', 'roast', 'profile', 'community_post', 'community_comment') then
    raise exception 'Choose valid content to report.';
  end if;

  if normalized_reason not in ('personal_info', 'harassment', 'spam', 'unsafe', 'off_topic', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(normalized_details) > 800 then
    raise exception 'Keep report details under 800 characters.';
  end if;

  if normalized_target_type = 'resume' then
    if target_resume_id is null
      or target_roast_id is not null
      or target_profile_id is not null
      or target_community_post_id is not null
      or target_community_comment_id is not null then
      raise exception 'Choose one resume to report.';
    end if;

    select resumes.id, resumes.user_id, resumes.status
    into target_resume
    from public.resumes
    where resumes.id = target_resume_id
      and resumes.status in ('open', 'closed');

    if not found then
      raise exception 'This resume is not available to report.';
    end if;

    if target_resume.user_id = active_user then
      raise exception 'You cannot report your own resume.';
    end if;

    resolved_reported_user_id := target_resume.user_id;
  elsif normalized_target_type = 'roast' then
    if target_roast_id is null
      or target_profile_id is not null
      or target_community_post_id is not null
      or target_community_comment_id is not null then
      raise exception 'Choose one review to report.';
    end if;

    select
      roasts.id,
      roasts.resume_id,
      roasts.author_id,
      roasts.is_deleted,
      resumes.status as resume_status
    into target_roast
    from public.roasts
    join public.resumes on resumes.id = roasts.resume_id
    where roasts.id = target_roast_id;

    if not found
      or target_roast.is_deleted
      or target_roast.resume_status not in ('open', 'closed') then
      raise exception 'This review is not available to report.';
    end if;

    if target_roast.author_id = active_user then
      raise exception 'You cannot report your own review.';
    end if;

    resolved_resume_id := target_roast.resume_id;
    resolved_reported_user_id := target_roast.author_id;
  elsif normalized_target_type = 'profile' then
    if target_profile_id is null
      or target_resume_id is not null
      or target_roast_id is not null
      or target_community_post_id is not null
      or target_community_comment_id is not null then
      raise exception 'Choose one profile to report.';
    end if;

    select profiles.id
    into target_profile
    from public.profiles
    where profiles.id = target_profile_id;

    if not found then
      raise exception 'This profile is not available to report.';
    end if;

    if target_profile.id = active_user then
      raise exception 'You cannot report your own profile.';
    end if;

    resolved_profile_id := target_profile.id;
    resolved_reported_user_id := target_profile.id;
  elsif normalized_target_type = 'community_post' then
    if target_community_post_id is null
      or target_resume_id is not null
      or target_roast_id is not null
      or target_profile_id is not null
      or target_community_comment_id is not null then
      raise exception 'Choose one community post to report.';
    end if;

    select
      community_posts.id,
      community_posts.author_id,
      community_posts.status
    into target_community_post
    from public.community_posts
    where community_posts.id = target_community_post_id;

    if not found
      or target_community_post.status not in ('active', 'locked') then
      raise exception 'This community post is not available to report.';
    end if;

    if target_community_post.author_id = active_user then
      raise exception 'You cannot report your own community post.';
    end if;

    resolved_community_post_id := target_community_post.id;
    resolved_reported_user_id := target_community_post.author_id;
  else
    if target_community_comment_id is null
      or target_resume_id is not null
      or target_roast_id is not null
      or target_profile_id is not null then
      raise exception 'Choose one community comment to report.';
    end if;

    select
      community_post_comments.id,
      community_post_comments.post_id,
      community_post_comments.author_id,
      community_post_comments.status,
      community_posts.status as post_status
    into target_community_comment
    from public.community_post_comments
    join public.community_posts
      on community_posts.id = community_post_comments.post_id
    where community_post_comments.id = target_community_comment_id;

    if not found
      or target_community_comment.status <> 'active'
      or target_community_comment.post_status not in ('active', 'locked') then
      raise exception 'This community comment is not available to report.';
    end if;

    if target_community_comment.author_id = active_user then
      raise exception 'You cannot report your own community comment.';
    end if;

    if target_community_post_id is not null
      and target_community_post_id <> target_community_comment.post_id then
      raise exception 'Community comment does not belong to that post.';
    end if;

    resolved_community_post_id := target_community_comment.post_id;
    resolved_community_comment_id := target_community_comment.id;
    resolved_reported_user_id := target_community_comment.author_id;
  end if;

  select content_reports.id
  into existing_report_id
  from public.content_reports
  where content_reports.reporter_id = active_user
    and content_reports.status = 'pending'
    and (
      (
        normalized_target_type = 'resume'
        and content_reports.target_type = 'resume'
        and content_reports.resume_id = target_resume_id
      )
      or (
        normalized_target_type = 'roast'
        and content_reports.target_type = 'roast'
        and content_reports.roast_id = target_roast_id
      )
      or (
        normalized_target_type = 'profile'
        and content_reports.target_type = 'profile'
        and content_reports.profile_id = target_profile_id
      )
      or (
        normalized_target_type = 'community_post'
        and content_reports.target_type = 'community_post'
        and content_reports.community_post_id = resolved_community_post_id
      )
      or (
        normalized_target_type = 'community_comment'
        and content_reports.target_type = 'community_comment'
        and content_reports.community_comment_id = resolved_community_comment_id
      )
    )
  limit 1
  for update;

  if existing_report_id is not null then
    update public.content_reports
    set
      reason = normalized_reason,
      details = normalized_details,
      report_count = content_reports.report_count + 1,
      last_reported_at = now()
    where content_reports.id = existing_report_id
    returning content_reports.id, content_reports.status
    into next_report;

    id := next_report.id;
    status := next_report.status;
    was_duplicate := true;
    return next;
    return;
  end if;

  insert into public.content_reports (
    reporter_id,
    reported_user_id,
    resume_id,
    roast_id,
    profile_id,
    community_post_id,
    community_comment_id,
    target_type,
    reason,
    details,
    report_count,
    last_reported_at
  )
  values (
    active_user,
    resolved_reported_user_id,
    case when normalized_target_type = 'resume' then resolved_resume_id when normalized_target_type = 'roast' then resolved_resume_id else null end,
    case when normalized_target_type = 'roast' then target_roast_id else null end,
    case when normalized_target_type = 'profile' then resolved_profile_id else null end,
    case when normalized_target_type in ('community_post', 'community_comment') then resolved_community_post_id else null end,
    case when normalized_target_type = 'community_comment' then resolved_community_comment_id else null end,
    normalized_target_type,
    normalized_reason,
    normalized_details,
    1,
    now()
  )
  returning content_reports.id, content_reports.status
  into next_report;

  id := next_report.id;
  status := next_report.status;
  was_duplicate := false;
  return next;
end;
$$;

alter table public.community_topics enable row level security;
alter table public.community_tags enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_comments enable row level security;
alter table public.community_post_tags enable row level security;
alter table public.community_post_votes enable row level security;
alter table public.community_comment_votes enable row level security;
alter table public.community_post_saves enable row level security;

revoke all on table public.community_topics from anon, authenticated;
revoke all on table public.community_tags from anon, authenticated;
revoke all on table public.community_posts from anon, authenticated;
revoke all on table public.community_post_comments from anon, authenticated;
revoke all on table public.community_post_tags from anon, authenticated;
revoke all on table public.community_post_votes from anon, authenticated;
revoke all on table public.community_comment_votes from anon, authenticated;
revoke all on table public.community_post_saves from anon, authenticated;

grant select on table public.community_topics to authenticated;
grant select on table public.community_tags to authenticated;
grant select on table public.community_posts to authenticated;
grant select on table public.community_post_comments to authenticated;
grant select on table public.community_post_tags to authenticated;
grant select on table public.community_post_votes to authenticated;
grant select on table public.community_comment_votes to authenticated;
grant select on table public.community_post_saves to authenticated;

drop policy if exists "Active community topics are readable" on public.community_topics;
create policy "Active community topics are readable"
  on public.community_topics for select
  to authenticated
  using (is_active = true);

drop policy if exists "Active community tags are readable" on public.community_tags;
create policy "Active community tags are readable"
  on public.community_tags for select
  to authenticated
  using (status = 'active');

drop policy if exists "Visible community posts are readable" on public.community_posts;
create policy "Visible community posts are readable"
  on public.community_posts for select
  to authenticated
  using (
    status in ('active', 'locked')
    or author_id = auth.uid()
  );

drop policy if exists "Community authors can create posts" on public.community_posts;
create policy "Community authors can create posts"
  on public.community_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status = 'active'
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
    and status in ('active', 'locked')
  )
  with check (
    auth.uid() = author_id
    and status in ('active', 'locked')
    and post_type in ('question', 'discussion', 'resource')
  );

drop policy if exists "Visible community comments are readable"
  on public.community_post_comments;
create policy "Visible community comments are readable"
  on public.community_post_comments for select
  to authenticated
  using (
    (
      status = 'active'
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

drop policy if exists "Community authors can create comments"
  on public.community_post_comments;
create policy "Community authors can create comments"
  on public.community_post_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and status = 'active'
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
    and status = 'active'
  )
  with check (
    auth.uid() = author_id
    and status = 'active'
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
        and community_posts.status in ('active', 'locked')
    )
    and exists (
      select 1
      from public.community_tags
      where community_tags.id = community_post_tags.tag_id
        and community_tags.status = 'active'
    )
  );

drop policy if exists "Users can read their own community post votes"
  on public.community_post_votes;
create policy "Users can read their own community post votes"
  on public.community_post_votes for select
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Users can vote on community posts"
  on public.community_post_votes;
create policy "Users can vote on community posts"
  on public.community_post_votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_votes.post_id
        and community_posts.status in ('active', 'locked')
        and community_posts.author_id <> auth.uid()
    )
  );

drop policy if exists "Users can change their community post votes"
  on public.community_post_votes;
create policy "Users can change their community post votes"
  on public.community_post_votes for update
  to authenticated
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_votes.post_id
        and community_posts.status in ('active', 'locked')
        and community_posts.author_id <> auth.uid()
    )
  );

drop policy if exists "Users can remove their community post votes"
  on public.community_post_votes;
create policy "Users can remove their community post votes"
  on public.community_post_votes for delete
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Users can read their own community comment votes"
  on public.community_comment_votes;
create policy "Users can read their own community comment votes"
  on public.community_comment_votes for select
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Users can vote on community comments"
  on public.community_comment_votes;
create policy "Users can vote on community comments"
  on public.community_comment_votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.community_post_comments
      join public.community_posts
        on community_posts.id = community_post_comments.post_id
      where community_post_comments.id = community_comment_votes.comment_id
        and community_post_comments.status = 'active'
        and community_post_comments.author_id <> auth.uid()
        and community_posts.status in ('active', 'locked')
    )
  );

drop policy if exists "Users can change their community comment votes"
  on public.community_comment_votes;
create policy "Users can change their community comment votes"
  on public.community_comment_votes for update
  to authenticated
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.community_post_comments
      join public.community_posts
        on community_posts.id = community_post_comments.post_id
      where community_post_comments.id = community_comment_votes.comment_id
        and community_post_comments.status = 'active'
        and community_post_comments.author_id <> auth.uid()
        and community_posts.status in ('active', 'locked')
    )
  );

drop policy if exists "Users can remove their community comment votes"
  on public.community_comment_votes;
create policy "Users can remove their community comment votes"
  on public.community_comment_votes for delete
  to authenticated
  using (auth.uid() = voter_id);

drop policy if exists "Users can read their own community post saves"
  on public.community_post_saves;
create policy "Users can read their own community post saves"
  on public.community_post_saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save community posts"
  on public.community_post_saves;
create policy "Users can save community posts"
  on public.community_post_saves for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_saves.post_id
        and community_posts.status in ('active', 'locked')
    )
  );

drop policy if exists "Users can remove their community post saves"
  on public.community_post_saves;
create policy "Users can remove their community post saves"
  on public.community_post_saves for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on function public.touch_community_updated_at()
  from public, anon, authenticated;
revoke all on function public.validate_community_comment_parent()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_created()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_deleted()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_status_changed()
  from public, anon, authenticated;
revoke all on function public.apply_community_post_vote_delta(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.apply_community_comment_vote_delta(uuid, text, int)
  from public, anon, authenticated;
revoke all on function public.handle_community_post_vote_created()
  from public, anon, authenticated;
revoke all on function public.handle_community_post_vote_deleted()
  from public, anon, authenticated;
revoke all on function public.handle_community_post_vote_updated()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_vote_created()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_vote_deleted()
  from public, anon, authenticated;
revoke all on function public.handle_community_comment_vote_updated()
  from public, anon, authenticated;
revoke all on function public.handle_community_post_saved()
  from public, anon, authenticated;
revoke all on function public.handle_community_post_unsaved()
  from public, anon, authenticated;
revoke all on function public.recalculate_community_counters()
  from public, anon, authenticated;
grant execute on function public.recalculate_community_counters()
  to service_role;
revoke all on function public.guard_community_post_insert_rate_limit()
  from public, anon, authenticated;
revoke all on function public.guard_community_comment_insert_rate_limit()
  from public, anon, authenticated;
revoke all on function public.guard_community_vote_write_rate_limit()
  from public, anon, authenticated;
revoke all on function public.guard_community_save_write_rate_limit()
  from public, anon, authenticated;
revoke all on function public.report_content(text, uuid, uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.report_content(text, uuid, uuid, uuid, uuid, uuid, text, text)
  to authenticated;

comment on table public.community_topics is
  'Controlled topic taxonomy for community career and tech discussions.';
comment on table public.community_tags is
  'Reusable normalized tags for community posts; tag membership lives in community_post_tags.';
comment on table public.community_posts is
  'Text-first community posts, separate from resume submissions and resume reviews.';
comment on table public.community_post_comments is
  'Threaded community comments for community_posts, separate from resume roasts.';
comment on table public.community_post_votes is
  'Source-of-truth user reactions for community posts; post counters are cached from this table.';
comment on table public.community_comment_votes is
  'Source-of-truth user reactions for community comments; comment counters are cached from this table.';
comment on table public.community_post_saves is
  'Source-of-truth saved community posts per user.';
comment on function public.recalculate_community_counters() is
  'Service-role repair function that rebuilds community post/comment counters from source vote, save, and comment rows.';

notify pgrst, 'reload schema';
