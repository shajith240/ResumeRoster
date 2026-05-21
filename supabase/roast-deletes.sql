-- ResumeRoster roast/reply deletion.
-- Run this in the Supabase SQL editor to let users delete their own roasts/replies.

alter table public.roasts
  add column if not exists is_deleted boolean not null default false;

alter table public.roasts
  add column if not exists deleted_at timestamptz;

create index if not exists roasts_active_resume_created_at_idx
  on public.roasts (resume_id, created_at desc)
  where is_deleted = false;

create index if not exists roasts_active_author_created_at_idx
  on public.roasts (author_id, created_at desc)
  where is_deleted = false;

drop policy if exists "Roast authors can update their own roasts" on public.roasts;
drop policy if exists "Roast authors can delete their own roasts" on public.roasts;

drop policy if exists "Authenticated users can create roasts" on public.roasts;
create policy "Authenticated users can create roasts"
  on public.roasts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and is_deleted = false
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
        and roasts.is_deleted = false
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
    )
  );

drop policy if exists "Users can change their own votes" on public.votes;
create policy "Users can change their own votes"
  on public.votes for update
  to authenticated
  using (auth.uid() = voter_id)
  with check (
    auth.uid() = voter_id
    and exists (
      select 1
      from public.roasts
      join public.resumes on resumes.id = roasts.resume_id
      where roasts.id = votes.roast_id
        and roasts.is_deleted = false
        and roasts.author_id <> auth.uid()
        and resumes.user_id <> auth.uid()
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
  parent_is_deleted boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  select roasts.resume_id, roasts.author_id, roasts.is_deleted
  into parent_resume_id, parent_author_id, parent_is_deleted
  from public.roasts
  where roasts.id = new.parent_id;

  if parent_resume_id is null then
    raise exception 'Parent roast does not exist.';
  end if;

  if parent_is_deleted then
    raise exception 'You cannot reply to a deleted roast.';
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

create or replace function public.handle_roast_soft_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_deleted = false and new.is_deleted = true then
    update public.resumes
    set roast_count = greatest(roast_count - 1, 0)
    where id = new.resume_id;

    update public.profiles
    set roast_count = greatest(roast_count - 1, 0)
    where id = new.author_id;
  elsif old.is_deleted = true and new.is_deleted = false then
    update public.resumes
    set roast_count = roast_count + 1
    where id = new.resume_id;

    update public.profiles
    set roast_count = roast_count + 1
    where id = new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_roast_soft_deleted on public.roasts;
create trigger on_roast_soft_deleted
  after update of is_deleted on public.roasts
  for each row execute procedure public.handle_roast_soft_deleted();

create or replace function public.delete_roast(target_roast_id uuid)
returns table (
  action text,
  roast_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roast record;
  has_children boolean;
  ancestor_to_check uuid;
  next_ancestor uuid;
begin
  select *
  into target_roast
  from public.roasts
  where id = target_roast_id
  for update;

  if target_roast.id is null then
    raise exception 'Roast not found.';
  end if;

  if auth.uid() is null or target_roast.author_id <> auth.uid() then
    raise exception 'Only the roast author can delete this roast.';
  end if;

  if target_roast.is_deleted then
    action := 'already_deleted';
    roast_id := target_roast_id;
    return next;
    return;
  end if;

  select exists (
    select 1
    from public.roasts
    where parent_id = target_roast_id
  )
  into has_children;

  if has_children then
    delete from public.votes
    where votes.roast_id = target_roast_id;

    update public.roasts
    set
      is_deleted = true,
      deleted_at = now(),
      content = 'This roast was deleted by its author.',
      helpful_votes = 0,
      dislike_count = 0
    where id = target_roast_id;

    action := 'soft_deleted';
    roast_id := target_roast_id;
    return next;
    return;
  end if;

  ancestor_to_check := target_roast.parent_id;

  delete from public.votes
  where votes.roast_id = target_roast_id;

  delete from public.roasts
  where id = target_roast_id;

  action := 'hard_deleted';
  roast_id := target_roast_id;
  return next;

  while ancestor_to_check is not null loop
    select parent_id
    into next_ancestor
    from public.roasts
    where id = ancestor_to_check
      and is_deleted = true
      and not exists (
        select 1
        from public.roasts child
        where child.parent_id = ancestor_to_check
      )
    for update;

    if not found then
      exit;
    end if;

    delete from public.roasts
    where id = ancestor_to_check;

    action := 'pruned_deleted_parent';
    roast_id := ancestor_to_check;
    return next;

    ancestor_to_check := next_ancestor;
  end loop;
end;
$$;

grant execute on function public.delete_roast(uuid) to authenticated;

update public.roasts as parent
set reply_count = coalesce(child_counts.reply_count, 0)
from (
  select parent_id, count(*)::int as reply_count
  from public.roasts
  where parent_id is not null
  group by parent_id
) as child_counts
where parent.id = child_counts.parent_id;

update public.roasts
set reply_count = 0
where not exists (
  select 1
  from public.roasts child
  where child.parent_id = roasts.id
);

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

update public.roasts
set
  helpful_votes = coalesce(reaction_counts.like_count, 0),
  dislike_count = coalesce(reaction_counts.dislike_count, 0)
from (
  select
    roast_id,
    count(*) filter (where reaction = 'like')::int as like_count,
    count(*) filter (where reaction = 'dislike')::int as dislike_count
  from public.votes
  group by roast_id
) as reaction_counts
where roasts.id = reaction_counts.roast_id
  and roasts.is_deleted = false;

update public.roasts
set helpful_votes = 0, dislike_count = 0
where is_deleted = true;

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
    and roasts.is_deleted = false
    and resumes.status in ('open', 'closed')
  order by roasts.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

grant execute on function public.get_public_profile_roasts(uuid, int) to anon, authenticated;
