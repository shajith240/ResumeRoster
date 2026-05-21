-- Resume read tracking.
-- Run this in the Supabase SQL editor to enable real read counts in the feed.

alter table public.resumes
  add column if not exists read_count int not null default 0;

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
      foreign key (reader_id) references auth.users(id) on delete cascade;
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
