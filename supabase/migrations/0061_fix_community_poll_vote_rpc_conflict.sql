-- Fix poll voting RPC ambiguity caused by output column names colliding with
-- community_post_poll_votes.poll_id in the upsert conflict target.

create or replace function public.vote_community_post_poll(
  target_user_id uuid,
  target_poll_id uuid,
  selected_option_id uuid
)
returns table (
  poll_id uuid,
  option_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_poll record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community poll voting must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Sign in before voting.';
  end if;

  perform public.ensure_community_profile(target_user_id);

  select
    community_post_polls.id,
    community_post_polls.closes_at,
    community_posts.status
  into target_poll
  from public.community_post_polls
  join public.community_posts
    on community_posts.id = community_post_polls.post_id
  join public.community_post_poll_options
    on community_post_poll_options.poll_id = community_post_polls.id
  where community_post_polls.id = target_poll_id
    and community_post_poll_options.id = selected_option_id;

  if not found then
    raise exception 'Choose a valid poll option.';
  end if;

  if target_poll.status not in ('active', 'locked') then
    raise exception 'This poll is not open.';
  end if;

  if target_poll.closes_at <= now() then
    raise exception 'This poll is closed.';
  end if;

  insert into public.community_post_poll_votes (
    poll_id,
    option_id,
    voter_id
  )
  values (
    target_poll_id,
    selected_option_id,
    target_user_id
  )
  on conflict on constraint community_post_poll_votes_one_vote_per_poll
  do update
  set
    option_id = excluded.option_id,
    updated_at = now();

  return query
  select target_poll_id, selected_option_id;
end;
$$;

revoke all on function public.vote_community_post_poll(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.vote_community_post_poll(uuid, uuid, uuid)
  to service_role;
