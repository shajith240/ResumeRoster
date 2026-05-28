-- Linted submit flow backend fix.
-- Run this in Supabase SQL editor if new users can sign in but cannot post resumes.
-- It repairs profile creation, resume insert policies, resume context columns,
-- and the private resume storage bucket/policies.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  avatar_path text,
  college text,
  target_role text,
  current_position text,
  app_status text not null default 'online' check (app_status in ('online', 'focus', 'offline')),
  roast_count int not null default 0,
  helpful_votes int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text unique,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists college text,
  add column if not exists target_role text,
  add column if not exists current_position text,
  add column if not exists app_status text not null default 'online',
  add column if not exists roast_count int not null default 0,
  add column if not exists helpful_votes int not null default 0,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  job_description text,
  post_description text,
  is_anonymous boolean not null default true,
  status text not null default 'open' check (status in ('open', 'roasted', 'closed')),
  roast_count int not null default 0,
  read_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.resumes
  add column if not exists job_description text,
  add column if not exists post_description text,
  add column if not exists read_count int not null default 0;

alter table public.resumes
  drop constraint if exists resumes_job_description_length;

alter table public.resumes
  add constraint resumes_job_description_length
  check (
    job_description is null
    or char_length(job_description) between 20 and 8000
  );

alter table public.resumes
  drop constraint if exists resumes_post_description_length;

alter table public.resumes
  add constraint resumes_post_description_length
  check (
    post_description is null
    or char_length(post_description) between 10 and 4000
  );

create index if not exists resumes_status_created_at_idx
  on public.resumes (status, created_at desc);

create index if not exists resumes_user_id_idx
  on public.resumes (user_id);

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;

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
