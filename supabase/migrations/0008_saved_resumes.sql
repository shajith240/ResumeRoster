-- ResumeRoster 0008: saved resumes.
-- Persists each user's private saved-resume list without exposing saves to
-- other users or adding public counters.

create table if not exists public.saved_resumes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resume_id)
);

alter table public.saved_resumes
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists resume_id uuid references public.resumes(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

update public.saved_resumes
set created_at = coalesce(created_at, now());

alter table public.saved_resumes
  alter column user_id set not null,
  alter column resume_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_resumes_pkey'
      and conrelid = 'public.saved_resumes'::regclass
  ) then
    alter table public.saved_resumes
      add constraint saved_resumes_pkey primary key (user_id, resume_id);
  end if;
end $$;

create index if not exists saved_resumes_user_created_at_idx
  on public.saved_resumes (user_id, created_at desc);

create index if not exists saved_resumes_resume_id_idx
  on public.saved_resumes (resume_id);

alter table public.saved_resumes enable row level security;

revoke all on table public.saved_resumes from anon, authenticated;
grant select on table public.saved_resumes to authenticated;
grant insert (
  user_id,
  resume_id
) on public.saved_resumes to authenticated;
grant delete on table public.saved_resumes to authenticated;

drop policy if exists "Users can read their own saved resumes"
  on public.saved_resumes;
create policy "Users can read their own saved resumes"
  on public.saved_resumes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can save visible resumes"
  on public.saved_resumes;
create policy "Users can save visible resumes"
  on public.saved_resumes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.resumes
      where resumes.id = saved_resumes.resume_id
        and (resumes.status in ('open', 'closed') or resumes.user_id = auth.uid())
    )
  );

drop policy if exists "Users can remove their own saved resumes"
  on public.saved_resumes;
create policy "Users can remove their own saved resumes"
  on public.saved_resumes for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
