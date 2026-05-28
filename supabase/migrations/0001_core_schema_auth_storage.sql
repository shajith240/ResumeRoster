-- Linted 0001: core schema, auth profile bootstrap, and resume storage.
-- Idempotent by design: safe on an existing production database and on a fresh local reset.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  app_status text not null default 'online',
  roast_count int not null default 0,
  helpful_votes int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists college text,
  add column if not exists target_role text,
  add column if not exists app_status text,
  add column if not exists roast_count int not null default 0,
  add column if not exists helpful_votes int not null default 0,
  add column if not exists created_at timestamptz not null default now();

update public.profiles
set
  roast_count = coalesce(roast_count, 0),
  helpful_votes = coalesce(helpful_votes, 0),
  created_at = coalesce(created_at, now());

alter table public.profiles
  alter column roast_count set default 0,
  alter column roast_count set not null,
  alter column helpful_votes set default 0,
  alter column helpful_votes set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

update public.profiles
set app_status = 'online'
where app_status is null
  or app_status not in ('online', 'focus', 'offline');

alter table public.profiles
  alter column app_status set default 'online',
  alter column app_status set not null;

alter table public.profiles
  drop constraint if exists profiles_app_status_check;

alter table public.profiles
  add constraint profiles_app_status_check
  check (app_status in ('online', 'focus', 'offline'));

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  is_anonymous boolean not null default true,
  status text not null default 'open',
  roast_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.resumes
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists title text,
  add column if not exists file_path text,
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists status text not null default 'open',
  add column if not exists roast_count int not null default 0,
  add column if not exists created_at timestamptz not null default now();

update public.resumes
set
  is_anonymous = coalesce(is_anonymous, true),
  status = case
    when status in ('open', 'roasted', 'closed') then status
    else 'open'
  end,
  roast_count = coalesce(roast_count, 0),
  created_at = coalesce(created_at, now());

alter table public.resumes
  alter column is_anonymous set default true,
  alter column is_anonymous set not null,
  alter column status set default 'open',
  alter column status set not null,
  alter column roast_count set default 0,
  alter column roast_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.resumes
  drop constraint if exists resumes_status_check;

alter table public.resumes
  add constraint resumes_status_check
  check (status in ('open', 'roasted', 'closed'));

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

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.roasts enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Open resumes are readable by authenticated users" on public.resumes;
drop policy if exists "Open resumes are publicly readable" on public.resumes;
drop policy if exists "Visible resumes are publicly readable" on public.resumes;
create policy "Visible resumes are publicly readable"
  on public.resumes for select
  to anon, authenticated
  using (status in ('open', 'closed') or auth.uid() = user_id);

drop policy if exists "Users can create their own resumes" on public.resumes;
create policy "Users can create their own resumes"
  on public.resumes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own resumes" on public.resumes;
create policy "Users can update their own resumes"
  on public.resumes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own resumes" on public.resumes;
create policy "Users can delete their own resumes"
  on public.resumes for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Roasts are publicly readable" on public.roasts;
create policy "Roasts are publicly readable"
  on public.roasts for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can create roasts" on public.roasts;
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

drop policy if exists "Roast authors can update their own roasts" on public.roasts;
create policy "Roast authors can update their own roasts"
  on public.roasts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Roast authors can delete their own roasts" on public.roasts;
create policy "Roast authors can delete their own roasts"
  on public.roasts for delete
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "Votes are readable by authenticated users" on public.votes;
create policy "Votes are readable by authenticated users"
  on public.votes for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can vote once per roast" on public.votes;
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

drop policy if exists "Users can remove their own votes" on public.votes;
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

insert into public.profiles (id, full_name, username, avatar_url)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name'
  ),
  public.make_unique_username(
    coalesce(
      users.raw_user_meta_data ->> 'user_name',
      users.raw_user_meta_data ->> 'preferred_username',
      split_part(users.email, '@', 1),
      'roaster'
    ) || '-' || left(users.id::text, 8),
    users.id
  ),
  coalesce(
    users.raw_user_meta_data ->> 'avatar_url',
    users.raw_user_meta_data ->> 'picture'
  )
from auth.users
where not exists (
  select 1
  from public.profiles
  where profiles.id = users.id
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload resumes into their own folder" on storage.objects;
create policy "Users can upload resumes into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read resumes in their own folder" on storage.objects;
drop policy if exists "Authenticated users can read resume files" on storage.objects;
create policy "Authenticated users can read resume files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes');

drop policy if exists "Users can update resumes in their own folder" on storage.objects;
create policy "Users can update resumes in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete resumes in their own folder" on storage.objects;
create policy "Users can delete resumes in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
