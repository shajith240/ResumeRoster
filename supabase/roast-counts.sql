-- Resume and profile roast count repair.
-- Run this once in the Supabase SQL editor if feed cards do not reflect new roasts.

create or replace function public.increment_resume_roast_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_deleted then
    return new;
  end if;

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
  if old.is_deleted then
    return old;
  end if;

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

update public.resumes
set roast_count = coalesce(roast_counts.total, 0)
from (
  select resume_id, count(*)::int as total
  from public.roasts
  where is_deleted = false
  group by resume_id
) as roast_counts
where resumes.id = roast_counts.resume_id;

update public.resumes
set roast_count = 0
where not exists (
  select 1
  from public.roasts
  where roasts.resume_id = resumes.id
    and roasts.is_deleted = false
);

update public.profiles
set roast_count = coalesce(roast_counts.total, 0)
from (
  select author_id, count(*)::int as total
  from public.roasts
  where is_deleted = false
  group by author_id
) as roast_counts
where profiles.id = roast_counts.author_id;

update public.profiles
set roast_count = 0
where not exists (
  select 1
  from public.roasts
  where roasts.author_id = profiles.id
    and roasts.is_deleted = false
);
