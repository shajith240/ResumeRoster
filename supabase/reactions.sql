-- Linted comment reactions.
-- Run this once in the Supabase SQL editor before deploying reaction toggles.

alter table public.roasts
  add column if not exists dislike_count int not null default 0;

alter table public.votes
  add column if not exists reaction text not null default 'like';

alter table public.votes
  drop constraint if exists votes_reaction_check;

alter table public.votes
  add constraint votes_reaction_check
  check (reaction in ('like', 'dislike'));

create or replace function public.apply_roast_reaction_delta(
  target_roast_id uuid,
  target_reaction text,
  delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author_id uuid;
begin
  if target_reaction = 'like' then
    update public.roasts
    set helpful_votes = greatest(helpful_votes + delta, 0)
    where id = target_roast_id
    returning author_id into target_author_id;

    if target_author_id is not null then
      update public.profiles
      set helpful_votes = greatest(helpful_votes + delta, 0)
      where id = target_author_id;
    end if;
  elsif target_reaction = 'dislike' then
    update public.roasts
    set dislike_count = greatest(dislike_count + delta, 0)
    where id = target_roast_id;
  end if;
end;
$$;

create or replace function public.handle_roast_reaction_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_roast_reaction_delta(new.roast_id, new.reaction, 1);
  return new;
end;
$$;

create or replace function public.handle_roast_reaction_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_roast_reaction_delta(old.roast_id, old.reaction, -1);
  return old;
end;
$$;

create or replace function public.handle_roast_reaction_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reaction <> new.reaction then
    perform public.apply_roast_reaction_delta(old.roast_id, old.reaction, -1);
    perform public.apply_roast_reaction_delta(new.roast_id, new.reaction, 1);
  end if;

  return new;
end;
$$;

drop trigger if exists on_vote_created on public.votes;
create trigger on_vote_created
  after insert on public.votes
  for each row execute procedure public.handle_roast_reaction_created();

drop trigger if exists on_vote_deleted on public.votes;
create trigger on_vote_deleted
  after delete on public.votes
  for each row execute procedure public.handle_roast_reaction_deleted();

drop trigger if exists on_vote_updated on public.votes;
create trigger on_vote_updated
  after update of reaction on public.votes
  for each row execute procedure public.handle_roast_reaction_updated();

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

-- Reaction counters are maintained by security-definer triggers.
-- Do not let roast authors directly update their own roast rows and tamper with counts.
drop policy if exists "Roast authors can update their own roasts" on public.roasts;

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
where roasts.id = reaction_counts.roast_id;
