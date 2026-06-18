-- Fix ambiguous PL/pgSQL references in community post/comment vote RPCs.
-- The returns-table columns are named post_id/comment_id, so ON CONFLICT
-- must target a named constraint instead of bare column names.

do $$
declare
  existing_constraint text;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.community_post_votes'::regclass
      and conname = 'community_post_votes_one_vote_per_user'
  ) then
    select pg_constraint.conname
    into existing_constraint
    from pg_constraint
    where pg_constraint.conrelid = 'public.community_post_votes'::regclass
      and pg_constraint.contype = 'u'
      and (
        select array_agg(pg_attribute.attname::text order by key_column.ordinality)
        from unnest(pg_constraint.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute
          on pg_attribute.attrelid = pg_constraint.conrelid
         and pg_attribute.attnum = key_column.attnum
      ) = array['post_id', 'voter_id']
    limit 1;

    if existing_constraint is null then
      alter table public.community_post_votes
        add constraint community_post_votes_one_vote_per_user
        unique (post_id, voter_id);
    else
      execute format(
        'alter table public.community_post_votes rename constraint %I to community_post_votes_one_vote_per_user',
        existing_constraint
      );
    end if;
  end if;
end $$;

do $$
declare
  existing_constraint text;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.community_comment_votes'::regclass
      and conname = 'community_comment_votes_one_vote_per_user'
  ) then
    select pg_constraint.conname
    into existing_constraint
    from pg_constraint
    where pg_constraint.conrelid = 'public.community_comment_votes'::regclass
      and pg_constraint.contype = 'u'
      and (
        select array_agg(pg_attribute.attname::text order by key_column.ordinality)
        from unnest(pg_constraint.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute
          on pg_attribute.attrelid = pg_constraint.conrelid
         and pg_attribute.attnum = key_column.attnum
      ) = array['comment_id', 'voter_id']
    limit 1;

    if existing_constraint is null then
      alter table public.community_comment_votes
        add constraint community_comment_votes_one_vote_per_user
        unique (comment_id, voter_id);
    else
      execute format(
        'alter table public.community_comment_votes rename constraint %I to community_comment_votes_one_vote_per_user',
        existing_constraint
      );
    end if;
  end if;
end $$;

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
    on conflict on constraint community_post_votes_one_vote_per_user
      do update set reaction = excluded.reaction;
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
    on conflict on constraint community_comment_votes_one_vote_per_user
      do update set reaction = excluded.reaction;
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

comment on function public.set_community_post_vote(uuid, uuid, text) is
  'Service-role-only community post voting contract with named conflict constraints to avoid PL/pgSQL output-column ambiguity.';

comment on function public.set_community_comment_vote(uuid, uuid, text) is
  'Service-role-only community comment voting contract with named conflict constraints to avoid PL/pgSQL output-column ambiguity.';
