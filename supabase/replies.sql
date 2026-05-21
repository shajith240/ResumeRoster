-- ResumeRoster nested roast replies.
-- Run or rerun this in the Supabase SQL editor before deploying comment replies.

alter table public.roasts
  add column if not exists parent_id uuid references public.roasts(id) on delete cascade;

alter table public.roasts
  add column if not exists reply_count int not null default 0;

alter table public.roasts
  drop constraint if exists roasts_parent_not_self;

alter table public.roasts
  add constraint roasts_parent_not_self
  check (parent_id is null or parent_id <> id);

create index if not exists roasts_resume_parent_created_at_idx
  on public.roasts (resume_id, parent_id, created_at asc);

create index if not exists roasts_parent_created_at_idx
  on public.roasts (parent_id, created_at asc);

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
        and (
          (
            roasts.parent_id is null
            and resumes.user_id <> auth.uid()
          )
          or roasts.parent_id is not null
        )
    )
  );

create or replace function public.validate_roast_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_resume_id uuid;
  parent_author_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select roasts.resume_id, roasts.author_id
  into parent_resume_id, parent_author_id
  from public.roasts
  where roasts.id = new.parent_id;

  if parent_resume_id is null then
    raise exception 'Parent roast does not exist.';
  end if;

  if parent_resume_id <> new.resume_id then
    raise exception 'Replies must belong to the same resume thread as their parent.';
  end if;

  if parent_author_id = new.author_id then
    raise exception 'You cannot reply to your own roast.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_roast_parent_before_insert on public.roasts;
create trigger validate_roast_parent_before_insert
  before insert on public.roasts
  for each row execute procedure public.validate_roast_parent();

create or replace function public.increment_roast_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    update public.roasts
    set reply_count = reply_count + 1
    where id = new.parent_id;
  end if;

  return new;
end;
$$;

create or replace function public.decrement_roast_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.parent_id is not null then
    update public.roasts
    set reply_count = greatest(reply_count - 1, 0)
    where id = old.parent_id;
  end if;

  return old;
end;
$$;

drop trigger if exists on_roast_reply_created on public.roasts;
create trigger on_roast_reply_created
  after insert on public.roasts
  for each row execute procedure public.increment_roast_reply_count();

drop trigger if exists on_roast_reply_deleted on public.roasts;
create trigger on_roast_reply_deleted
  after delete on public.roasts
  for each row execute procedure public.decrement_roast_reply_count();

update public.roasts as parent
set reply_count = coalesce(child_counts.reply_count, 0)
from (
  select parent_id, count(*)::int as reply_count
  from public.roasts
  where parent_id is not null
  group by parent_id
) as child_counts
where parent.id = child_counts.parent_id;
