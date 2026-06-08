-- Linted 0060: community polls.
-- Polls are normalized away from community_posts so text/image posts stay stable.

create table if not exists public.community_post_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  question text not null,
  duration_days int not null default 7,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_post_polls_post_unique unique (post_id),
  constraint community_post_polls_question_length_check
    check (char_length(question) between 8 and 300),
  constraint community_post_polls_duration_check
    check (duration_days in (1, 3, 7, 14, 30)),
  constraint community_post_polls_closes_after_create_check
    check (closes_at > created_at)
);

create table if not exists public.community_post_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_post_polls(id) on delete cascade,
  option_text text not null,
  display_order int not null,
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_post_poll_options_text_length_check
    check (char_length(option_text) between 1 and 120),
  constraint community_post_poll_options_order_check
    check (display_order >= 0 and display_order < 6),
  constraint community_post_poll_options_vote_count_check
    check (vote_count >= 0),
  constraint community_post_poll_options_poll_order_unique
    unique (poll_id, display_order)
);

create table if not exists public.community_post_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_post_polls(id) on delete cascade,
  option_id uuid not null references public.community_post_poll_options(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_post_poll_votes_one_vote_per_poll unique (poll_id, voter_id)
);

create index if not exists community_post_poll_options_poll_order_idx
  on public.community_post_poll_options (poll_id, display_order asc);

create index if not exists community_post_poll_votes_poll_idx
  on public.community_post_poll_votes (poll_id, created_at desc);

create index if not exists community_post_poll_votes_voter_idx
  on public.community_post_poll_votes (voter_id, created_at desc);

drop trigger if exists community_post_polls_touch_updated_at on public.community_post_polls;
create trigger community_post_polls_touch_updated_at
  before update on public.community_post_polls
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists community_post_poll_options_touch_updated_at on public.community_post_poll_options;
create trigger community_post_poll_options_touch_updated_at
  before update on public.community_post_poll_options
  for each row execute procedure public.touch_community_updated_at();

drop trigger if exists community_post_poll_votes_touch_updated_at on public.community_post_poll_votes;
create trigger community_post_poll_votes_touch_updated_at
  before update on public.community_post_poll_votes
  for each row execute procedure public.touch_community_updated_at();

create or replace function public.refresh_community_poll_option_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.community_post_poll_options
    set vote_count = (
      select count(*)::int
      from public.community_post_poll_votes
      where community_post_poll_votes.option_id = new.option_id
    )
    where community_post_poll_options.id = new.option_id;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    update public.community_post_poll_options
    set vote_count = (
      select count(*)::int
      from public.community_post_poll_votes
      where community_post_poll_votes.option_id = old.option_id
    )
    where community_post_poll_options.id = old.option_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists community_post_poll_votes_refresh_counts on public.community_post_poll_votes;
create trigger community_post_poll_votes_refresh_counts
  after insert or update or delete on public.community_post_poll_votes
  for each row execute procedure public.refresh_community_poll_option_vote_count();

create or replace function public.submit_community_poll_post(
  target_user_id uuid,
  selected_topic_id uuid,
  post_kind text,
  post_title text,
  post_body text,
  poll_option_labels text[],
  poll_duration_days int default 7
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
  cleaned_body text := trim(coalesce(post_body, ''));
  cleaned_title text := trim(coalesce(post_title, ''));
  label_index int;
  next_poll_id uuid;
  next_post record;
  normalized_options text[] := '{}'::text[];
  normalized_post_type text := lower(trim(coalesce(post_kind, '')));
  option_label text;
  option_key text;
  option_keys text[] := '{}'::text[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'Community poll submission must use the service role.';
  end if;

  if target_user_id is null then
    raise exception 'Sign in before posting.';
  end if;

  if normalized_post_type not in ('question', 'discussion', 'resource') then
    raise exception 'Choose a valid post type.';
  end if;

  if char_length(cleaned_title) < 8 or char_length(cleaned_title) > 300 then
    raise exception 'Keep the title between 8 and 300 characters.';
  end if;

  if char_length(cleaned_body) > 12000 then
    raise exception 'Keep the post body under 12000 characters.';
  end if;

  if poll_duration_days not in (1, 3, 7, 14, 30) then
    raise exception 'Choose a valid poll duration.';
  end if;

  foreach option_label in array coalesce(poll_option_labels, '{}'::text[]) loop
    option_label := regexp_replace(trim(coalesce(option_label, '')), '\s+', ' ', 'g');
    option_key := lower(option_label);

    if option_label <> '' then
      if char_length(option_label) > 120 then
        raise exception 'Keep poll options under 120 characters.';
      end if;

      if option_key = any(option_keys) then
        raise exception 'Poll options must be unique.';
      end if;

      normalized_options := array_append(normalized_options, option_label);
      option_keys := array_append(option_keys, option_key);
    end if;
  end loop;

  if coalesce(array_length(normalized_options, 1), 0) < 2 then
    raise exception 'Add at least 2 poll options.';
  end if;

  if coalesce(array_length(normalized_options, 1), 0) > 6 then
    raise exception 'Use at most 6 poll options.';
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

  insert into public.community_post_polls (
    post_id,
    question,
    duration_days,
    closes_at
  )
  values (
    next_post.id,
    cleaned_title,
    poll_duration_days,
    now() + make_interval(days => poll_duration_days)
  )
  returning community_post_polls.id into next_poll_id;

  for label_index in 1..array_length(normalized_options, 1) loop
    insert into public.community_post_poll_options (
      poll_id,
      option_text,
      display_order
    )
    values (
      next_poll_id,
      normalized_options[label_index],
      label_index - 1
    );
  end loop;

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
      'Crowd-control held this poll for moderator review.',
      'pending',
      1,
      now()
    );
  end if;

  id := next_post.id;
  topic_id := next_post.topic_id;
  post_type := next_post.post_type;
  title := next_post.title;
  status := next_post.status;
  created_at := next_post.created_at;
  return next;
end;
$$;

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
  on conflict (poll_id, voter_id) do update
  set
    option_id = excluded.option_id,
    updated_at = now();

  poll_id := target_poll_id;
  option_id := selected_option_id;
  return next;
end;
$$;

revoke all on table public.community_post_polls from anon, authenticated;
revoke all on table public.community_post_poll_options from anon, authenticated;
revoke all on table public.community_post_poll_votes from anon, authenticated;
grant select on table public.community_post_polls to authenticated;
grant select on table public.community_post_poll_options to authenticated;
grant select on table public.community_post_poll_votes to authenticated;

alter table public.community_post_polls enable row level security;
alter table public.community_post_poll_options enable row level security;
alter table public.community_post_poll_votes enable row level security;

drop policy if exists "community poll select visible posts" on public.community_post_polls;
create policy "community poll select visible posts"
  on public.community_post_polls for select
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts
      where community_posts.id = community_post_polls.post_id
        and (
          community_posts.status in ('active', 'locked')
          or community_posts.author_id = auth.uid()
        )
    )
  );

drop policy if exists "community poll option select visible posts" on public.community_post_poll_options;
create policy "community poll option select visible posts"
  on public.community_post_poll_options for select
  to authenticated
  using (
    exists (
      select 1
      from public.community_post_polls
      join public.community_posts
        on community_posts.id = community_post_polls.post_id
      where community_post_polls.id = community_post_poll_options.poll_id
        and (
          community_posts.status in ('active', 'locked')
          or community_posts.author_id = auth.uid()
        )
    )
  );

drop policy if exists "community poll vote select own" on public.community_post_poll_votes;
create policy "community poll vote select own"
  on public.community_post_poll_votes for select
  to authenticated
  using (voter_id = auth.uid());

revoke all on function public.submit_community_poll_post(uuid, uuid, text, text, text, text[], int)
  from public, anon, authenticated;
grant execute on function public.submit_community_poll_post(uuid, uuid, text, text, text, text[], int)
  to service_role;

revoke all on function public.vote_community_post_poll(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.vote_community_post_poll(uuid, uuid, uuid)
  to service_role;

comment on table public.community_post_polls is
  'Normalized poll metadata for community posts.';
comment on table public.community_post_poll_options is
  'Ordered options for community post polls with repairable cached vote counts.';
comment on table public.community_post_poll_votes is
  'Source-of-truth single-choice votes for community post polls.';
comment on function public.submit_community_poll_post(uuid, uuid, text, text, text, text[], int) is
  'Service-role-only transactional community poll creation contract.';
comment on function public.vote_community_post_poll(uuid, uuid, uuid) is
  'Service-role-only community poll voting contract with one active vote per user.';

notify pgrst, 'reload schema';
