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
    downvote_count = coalesce(counter_rows.downvote_count, 0)
  from (
    select
      community_posts.id,
      count(distinct community_post_comments.id)
        filter (where community_post_comments.status = 'active')::int as comment_count,
      count(distinct community_post_votes.id)
        filter (where community_post_votes.reaction = 'upvote')::int as upvote_count,
      count(distinct community_post_votes.id)
        filter (where community_post_votes.reaction = 'downvote')::int as downvote_count
    from public.community_posts
    left join public.community_post_comments
      on community_post_comments.post_id = community_posts.id
    left join public.community_post_votes
      on community_post_votes.post_id = community_posts.id
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

do $$
begin
  if to_regclass('public.community_post_saves') is not null then
    execute 'drop trigger if exists on_community_post_saved on public.community_post_saves';
    execute 'drop trigger if exists on_community_post_unsaved on public.community_post_saves';
    execute 'drop trigger if exists enforce_community_post_save_insert_rate_limit on public.community_post_saves';
    execute 'drop trigger if exists enforce_community_post_save_delete_rate_limit on public.community_post_saves';
  end if;
end;
$$;

drop function if exists public.handle_community_post_saved();
drop function if exists public.handle_community_post_unsaved();
drop function if exists public.guard_community_save_write_rate_limit();
drop table if exists public.community_post_saves cascade;

alter table public.community_posts
  drop constraint if exists community_posts_counter_check,
  drop column if exists save_count,
  add constraint community_posts_counter_check
    check (
      comment_count >= 0
      and upvote_count >= 0
      and downvote_count >= 0
    );
