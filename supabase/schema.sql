-- ResumeRoster Step 0 schema.
-- Run this in the Supabase SQL editor before building Phase 1.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  college text,
  target_role text,
  roast_count int not null default 0,
  helpful_votes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  is_anonymous boolean not null default true,
  status text not null default 'open' check (status in ('open', 'roasted', 'closed')),
  roast_count int not null default 0,
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

create policy "Open resumes are readable by authenticated users"
  on public.resumes for select
  to authenticated
  using (status = 'open' or auth.uid() = user_id);

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

create policy "Roasts are readable by authenticated users"
  on public.roasts for select
  to authenticated
  using (true);

create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (auth.uid() = author_id);

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
  with check (auth.uid() = voter_id);

create policy "Users can remove their own votes"
  on public.votes for delete
  to authenticated
  using (auth.uid() = voter_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage setup:
-- 1. Create a private bucket named "resumes" in Supabase Storage.
-- 2. Use signed URLs in the app when showing resume files.
