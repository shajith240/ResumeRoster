-- ResumeRoster Step 0 schema.
-- Run this in the Supabase SQL editor before building Phase 1.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  app_status text not null default 'online' check (app_status in ('online', 'focus', 'offline')),
  roast_count int not null default 0,
  helpful_votes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  job_description text check (job_description is null or char_length(job_description) between 20 and 8000),
  post_description text check (post_description is null or char_length(post_description) between 10 and 4000),
  is_anonymous boolean not null default true,
  status text not null default 'open' check (status in ('open', 'roasted', 'closed')),
  roast_count int not null default 0,
  read_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.roasts (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 10 and 4000),
  helpful_votes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  roast_id uuid not null references public.roasts(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (roast_id, voter_id)
);

create table if not exists public.app_presence_sessions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'focus', 'offline')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists resumes_status_created_at_idx
  on public.resumes (status, created_at desc);

create index if not exists resumes_user_id_idx
  on public.resumes (user_id);

create index if not exists roasts_resume_id_created_at_idx
  on public.roasts (resume_id, created_at desc);

create index if not exists roasts_author_id_idx
  on public.roasts (author_id);

create index if not exists votes_roast_id_idx
  on public.votes (roast_id);

create index if not exists app_presence_sessions_last_seen_at_idx
  on public.app_presence_sessions (last_seen_at desc);

create index if not exists app_presence_sessions_user_id_idx
  on public.app_presence_sessions (user_id);

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.roasts enable row level security;
alter table public.votes enable row level security;
alter table public.app_presence_sessions enable row level security;

revoke all on public.app_presence_sessions from anon;
revoke all on public.app_presence_sessions from authenticated;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Visible resumes are publicly readable"
  on public.resumes for select
  to anon, authenticated
  using (status in ('open', 'closed') or auth.uid() = user_id);

create policy "Users can create their own resumes"
  on public.resumes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own resumes"
  on public.resumes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own resumes"
  on public.resumes for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Roasts are publicly readable"
  on public.roasts for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.resumes
      where resumes.id = roasts.resume_id
        and resumes.status = 'open'
        and resumes.user_id <> auth.uid()
    )
  );

create policy "Roast authors can update their own roasts"
  on public.roasts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Roast authors can delete their own roasts"
  on public.roasts for delete
  to authenticated
  using (auth.uid() = author_id);

create policy "Votes are readable by authenticated users"
  on public.votes for select
  to authenticated
  using (true);

create policy "Authenticated users can vote once per roast"
  on public.votes for insert
  to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.roasts
      join public.resumes on resumes.id = roasts.resume_id
      where roasts.id = votes.roast_id
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
    )
  );

create policy "Users can remove their own votes"
  on public.votes for delete
  to authenticated
  using (auth.uid() = voter_id);

create or replace function public.make_unique_username(
  base_username text,
  profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  candidate text;
  suffix int := 0;
begin
  normalized := lower(
    regexp_replace(
      coalesce(nullif(trim(base_username), ''), 'roaster'),
      '[^a-z0-9_-]+',
      '-',
      'g'
    )
  );
  normalized := trim(both '-' from normalized);

  if normalized = '' then
    normalized := 'roaster';
  end if;

  candidate := left(normalized, 32);

  while exists (
    select 1
    from public.profiles
    where username = candidate
      and id <> profile_id
  ) loop
    suffix := suffix + 1;
    candidate :=
      left(normalized, greatest(1, 32 - char_length(suffix::text) - 1))
      || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  base_username text;
  avatar text;
begin
  display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );
  base_username := coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    split_part(new.email, '@', 1),
    'roaster'
  );
  avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );

  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    display_name,
    public.make_unique_username(base_username, new.id),
    avatar
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.get_auth_email_state(target_email text)
returns table (
  account_exists boolean,
  providers text[],
  email_confirmed boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(target_email));
begin
  if normalized_email is null
    or normalized_email = ''
    or char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return query select false, array[]::text[], false;
    return;
  end if;

  return query
    select
      true as account_exists,
      coalesce(
        array_agg(distinct identities.provider order by identities.provider)
          filter (where identities.provider is not null),
        array[]::text[]
      ) as providers,
      users.email_confirmed_at is not null as email_confirmed
    from auth.users
    left join auth.identities
      on identities.user_id = users.id
    where lower(users.email) = normalized_email
    group by users.id, users.email_confirmed_at
    limit 1;

  if not found then
    return query select false, array[]::text[], false;
  end if;
end;
$$;

revoke all on function public.get_auth_email_state(text) from public;
revoke all on function public.get_auth_email_state(text) from anon;
revoke all on function public.get_auth_email_state(text) from authenticated;
grant execute on function public.get_auth_email_state(text) to service_role;

create or replace function public.clean_presence_session_id(raw_session_id text)
returns text
language sql
immutable
as $$
  select nullif(left(regexp_replace(coalesce(raw_session_id, ''), '[^a-zA-Z0-9:_-]+', '', 'g'), 120), '')
$$;

create or replace function public.record_app_presence(
  session_id text,
  app_status text default 'online'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_session_id text := public.clean_presence_session_id(session_id);
  normalized_status text := case
    when app_status in ('online', 'focus', 'offline') then app_status
    else 'online'
  end;
begin
  if auth.uid() is null or clean_session_id is null then
    return;
  end if;

  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;

  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  insert into public.app_presence_sessions (id, user_id, status, last_seen_at)
  values (clean_session_id, auth.uid(), normalized_status, now())
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    status = excluded.status,
    last_seen_at = now();
end;
$$;

create or replace function public.clear_app_presence(session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_session_id text := public.clean_presence_session_id(session_id);
begin
  if auth.uid() is null or clean_session_id is null then
    return;
  end if;

  delete from public.app_presence_sessions
  where id = clean_session_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.get_active_roaster_count(
  window_seconds int default 120
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  active_window interval := make_interval(secs => least(greatest(coalesce(window_seconds, 120), 30), 600));
  active_count int;
begin
  delete from public.app_presence_sessions
  where last_seen_at < now() - interval '5 minutes';

  select count(distinct user_id)::int
  into active_count
  from public.app_presence_sessions
  where last_seen_at >= now() - active_window;

  return coalesce(active_count, 0);
end;
$$;

grant execute on function public.record_app_presence(text, text) to authenticated;
grant execute on function public.clear_app_presence(text) to authenticated;
grant execute on function public.get_active_roaster_count(int) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.increment_resume_roast_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
  set roast_count = roast_count + 1
  where id = new.resume_id;

  update public.profiles
  set roast_count = roast_count + 1
  where id = new.author_id;

  return new;
end;
$$;

create or replace function public.decrement_resume_roast_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
  set roast_count = greatest(roast_count - 1, 0)
  where id = old.resume_id;

  update public.profiles
  set roast_count = greatest(roast_count - 1, 0)
  where id = old.author_id;

  return old;
end;
$$;

drop trigger if exists on_roast_created on public.roasts;
create trigger on_roast_created
  after insert on public.roasts
  for each row execute procedure public.increment_resume_roast_count();

drop trigger if exists on_roast_deleted on public.roasts;
create trigger on_roast_deleted
  after delete on public.roasts
  for each row execute procedure public.decrement_resume_roast_count();

create or replace function public.increment_roast_helpful_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.roasts
  set helpful_votes = helpful_votes + 1
  where id = new.roast_id;

  update public.profiles
  set helpful_votes = helpful_votes + 1
  where id = (
    select author_id
    from public.roasts
    where id = new.roast_id
  );

  return new;
end;
$$;

create or replace function public.decrement_roast_helpful_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.roasts
  set helpful_votes = greatest(helpful_votes - 1, 0)
  where id = old.roast_id;

  update public.profiles
  set helpful_votes = greatest(helpful_votes - 1, 0)
  where id = (
    select author_id
    from public.roasts
    where id = old.roast_id
  );

  return old;
end;
$$;

drop trigger if exists on_vote_created on public.votes;
create trigger on_vote_created
  after insert on public.votes
  for each row execute procedure public.increment_roast_helpful_votes();

drop trigger if exists on_vote_deleted on public.votes;
create trigger on_vote_deleted
  after delete on public.votes
  for each row execute procedure public.decrement_roast_helpful_votes();

create or replace function public.get_roaster_leaderboard(limit_count int default 10)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  roast_count int,
  helpful_votes int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.username,
    profiles.full_name,
    profiles.avatar_url,
    profiles.avatar_path,
    profiles.college,
    profiles.target_role,
    profiles.roast_count,
    profiles.helpful_votes
  from public.profiles
  where profiles.roast_count > 0 or profiles.helpful_votes > 0
  order by
    (profiles.helpful_votes * 120 + profiles.roast_count * 60) desc,
    profiles.helpful_votes desc,
    profiles.roast_count desc,
    profiles.created_at asc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_roaster_leaderboard(int) to anon, authenticated;

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  username text,
  college text,
  target_role text,
  roast_count int,
  helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.username,
    profiles.college,
    profiles.target_role,
    profiles.roast_count,
    profiles.helpful_votes,
    profiles.created_at
  from public.profiles
  where profiles.id = profile_id
  limit 1;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

create or replace function public.get_public_profile_roasts(
  profile_id uuid,
  limit_count int default 12
)
returns table (
  id uuid,
  resume_id uuid,
  resume_title text,
  resume_status text,
  content text,
  helpful_votes int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    roasts.id,
    roasts.resume_id,
    resumes.title as resume_title,
    resumes.status as resume_status,
    roasts.content,
    roasts.helpful_votes,
    roasts.created_at
  from public.roasts
  join public.resumes on resumes.id = roasts.resume_id
  where roasts.author_id = profile_id
    and resumes.status in ('open', 'closed')
  order by roasts.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_public_profile_roasts(uuid, int) to anon, authenticated;

-- Storage setup:
-- 1. Create a private bucket named "resumes" in Supabase Storage.
-- 2. Use signed URLs in the app when showing resume files.
