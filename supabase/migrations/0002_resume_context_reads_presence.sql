-- ResumeRoster 0002: resume context, read tracking, and active roaster presence.
-- Preserves existing rows and only adds/updates forward-compatible structures.

alter table public.resumes
  add column if not exists job_description text,
  add column if not exists post_description text,
  add column if not exists read_count int not null default 0;

update public.resumes
set read_count = coalesce(read_count, 0);

alter table public.resumes
  alter column read_count set default 0,
  alter column read_count set not null;

alter table public.resumes
  drop constraint if exists resumes_job_description_length;

alter table public.resumes
  add constraint resumes_job_description_length
  check (
    job_description is null
    or char_length(job_description) between 20 and 8000
  ) not valid;

alter table public.resumes
  drop constraint if exists resumes_post_description_length;

alter table public.resumes
  add constraint resumes_post_description_length
  check (
    post_description is null
    or char_length(post_description) between 10 and 4000
  ) not valid;

create table if not exists public.resume_reads (
  resume_id uuid not null references public.resumes(id) on delete cascade,
  reader_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (resume_id, reader_id)
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'resume_reads_reader_id_fkey'
      and conrelid = 'public.resume_reads'::regclass
  ) then
    alter table public.resume_reads
      drop constraint resume_reads_reader_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'resume_reads_reader_id_auth_users_fkey'
      and conrelid = 'public.resume_reads'::regclass
  ) then
    alter table public.resume_reads
      add constraint resume_reads_reader_id_auth_users_fkey
      foreign key (reader_id) references auth.users(id) on delete cascade
      not valid;
  end if;
end $$;

create index if not exists resume_reads_reader_id_idx
  on public.resume_reads (reader_id, created_at desc);

alter table public.resume_reads enable row level security;

drop policy if exists "Users can see their own resume read events"
  on public.resume_reads;

create policy "Users can see their own resume read events"
  on public.resume_reads for select
  to authenticated
  using (reader_id = auth.uid());

update public.resumes
set read_count = greatest(public.resumes.read_count, read_counts.total)
from (
  select resume_id, count(*)::int as total
  from public.resume_reads
  group by resume_id
) as read_counts
where public.resumes.id = read_counts.resume_id;

drop function if exists public.record_resume_read(uuid);

create function public.record_resume_read(target_resume_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  active_user uuid := auth.uid();
  resume_owner uuid;
  inserted_rows int := 0;
  next_count int := 0;
begin
  select user_id, read_count
  into resume_owner, next_count
  from public.resumes
  where id = target_resume_id;

  if resume_owner is null then
    return 0;
  end if;

  if active_user is null or resume_owner = active_user then
    return coalesce(next_count, 0);
  end if;

  insert into public.resume_reads (resume_id, reader_id)
  values (target_resume_id, active_user)
  on conflict (resume_id, reader_id) do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows > 0 then
    update public.resumes
    set read_count = read_count + 1
    where id = target_resume_id
    returning read_count into next_count;
  else
    select read_count
    into next_count
    from public.resumes
    where id = target_resume_id;
  end if;

  return coalesce(next_count, 0);
end;
$$;

revoke all on function public.record_resume_read(uuid) from public;
grant execute on function public.record_resume_read(uuid) to authenticated;

create table if not exists public.app_presence_sessions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'online' check (status in ('online', 'focus', 'offline')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_presence_sessions_last_seen_at_idx
  on public.app_presence_sessions (last_seen_at desc);

create index if not exists app_presence_sessions_user_id_idx
  on public.app_presence_sessions (user_id);

alter table public.app_presence_sessions enable row level security;

revoke all on public.app_presence_sessions from anon;
revoke all on public.app_presence_sessions from authenticated;

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
