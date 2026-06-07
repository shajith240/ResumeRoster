-- Linted 0049: guided review credits are reversible.
-- Queue activation is derived from current qualifying guided reviews, so
-- deleting or moderating a review removes the credit and can re-hide resumes.

drop trigger if exists on_guided_review_credit_created on public.roasts;
drop trigger if exists on_guided_review_credit_updated on public.roasts;
drop trigger if exists on_guided_review_credit_deleted on public.roasts;
drop function if exists public.apply_guided_review_credit();

create or replace function public.recalculate_guided_review_queue(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  earned_credits int := 0;
  remaining_credits int := 0;
  queue_resume record;
  next_completed int := 0;
begin
  if target_user_id is null then
    return;
  end if;

  perform 1
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    return;
  end if;

  select count(*)::int
  into earned_credits
  from (
    select roasts.resume_id
    from public.roasts
    join public.resumes reviewed_resumes on reviewed_resumes.id = roasts.resume_id
    where roasts.author_id = target_user_id
      and roasts.parent_id is null
      and roasts.is_deleted = false
      and coalesce(roasts.is_guided_review, false)
      and roasts.guided_issue_type in (
        'clarity',
        'missing_impact',
        'weak_project',
        'too_generic',
        'ordering',
        'formatting',
        'role_fit'
      )
      and char_length(trim(coalesce(roasts.content, ''))) >= 160
      and reviewed_resumes.user_id <> target_user_id
    group by roasts.resume_id
  ) qualifying_reviews;

  remaining_credits := greatest(earned_credits, 0);

  update public.resumes
  set
    activation_reviews_completed = 0,
    review_queue_status = 'active'
  where resumes.user_id = target_user_id
    and resumes.activation_reviews_required = 0
    and (
      resumes.activation_reviews_completed <> 0
      or resumes.review_queue_status <> 'active'
    );

  for queue_resume in
    select
      resumes.id,
      greatest(resumes.activation_reviews_required, 0) as required_reviews
    from public.resumes
    where resumes.user_id = target_user_id
      and resumes.activation_reviews_required > 0
    order by resumes.created_at asc, resumes.id asc
    for update
  loop
    next_completed := least(queue_resume.required_reviews, remaining_credits);
    remaining_credits := greatest(remaining_credits - next_completed, 0);

    update public.resumes
    set
      activation_reviews_completed = next_completed,
      review_queue_status = case
        when next_completed >= queue_resume.required_reviews then 'active'
        else 'waiting'
      end
    where resumes.id = queue_resume.id;
  end loop;

  update public.profiles
  set review_credit_balance = remaining_credits
  where profiles.id = target_user_id;
end;
$$;

create or replace function public.sync_guided_review_queue_from_roast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_guided_review_queue(new.author_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.author_id is distinct from new.author_id then
      perform public.recalculate_guided_review_queue(old.author_id);
    end if;

    perform public.recalculate_guided_review_queue(new.author_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.recalculate_guided_review_queue(old.author_id);
    return old;
  end if;

  return null;
end;
$$;

create trigger on_guided_review_credit_created
  after insert on public.roasts
  for each row execute procedure public.sync_guided_review_queue_from_roast();

create trigger on_guided_review_credit_updated
  after update of
    author_id,
    content,
    guided_issue_type,
    is_deleted,
    is_guided_review,
    parent_id,
    resume_id
  on public.roasts
  for each row execute procedure public.sync_guided_review_queue_from_roast();

create trigger on_guided_review_credit_deleted
  after delete on public.roasts
  for each row execute procedure public.sync_guided_review_queue_from_roast();

create or replace function public.create_resume_with_review_queue(
  target_user_id uuid,
  resume_title text,
  resume_file_path text,
  resume_is_anonymous boolean,
  resume_privacy_mode text,
  resume_job_description text,
  resume_post_description text
)
returns table (
  id uuid,
  review_queue_status text,
  activation_reviews_required int,
  activation_reviews_completed int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_resume_id uuid;
  required_reviews int := 2;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Resume queue creation must use the service role.';
  end if;

  perform 1
  from public.profiles
  where profiles.id = target_user_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  insert into public.resumes (
    file_path,
    is_anonymous,
    job_description,
    post_description,
    privacy_mode,
    title,
    user_id,
    review_queue_status,
    activation_reviews_required,
    activation_reviews_completed
  )
  values (
    resume_file_path,
    resume_is_anonymous,
    resume_job_description,
    resume_post_description,
    resume_privacy_mode,
    resume_title,
    target_user_id,
    'waiting',
    required_reviews,
    0
  )
  returning resumes.id into created_resume_id;

  perform public.recalculate_guided_review_queue(target_user_id);

  return query
  select
    resumes.id,
    resumes.review_queue_status,
    resumes.activation_reviews_required,
    resumes.activation_reviews_completed
  from public.resumes
  where resumes.id = created_resume_id;
end;
$$;

revoke all on function public.recalculate_guided_review_queue(uuid) from public, anon, authenticated;
revoke all on function public.sync_guided_review_queue_from_roast() from public, anon, authenticated;

revoke all on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) to service_role;

do $$
declare
  queue_user record;
begin
  for queue_user in
    select profiles.id
    from public.profiles
    where profiles.review_credit_balance <> 0
      or exists (
        select 1
        from public.resumes
        where resumes.user_id = profiles.id
          and resumes.activation_reviews_required > 0
      )
      or exists (
        select 1
        from public.roasts
        where roasts.author_id = profiles.id
          and coalesce(roasts.is_guided_review, false)
      )
  loop
    perform public.recalculate_guided_review_queue(queue_user.id);
  end loop;
end;
$$;

comment on function public.recalculate_guided_review_queue(uuid) is
  'Recomputes reversible guided review credits from current qualifying non-deleted top-level reviews and reapplies them to queued resumes.';

comment on function public.sync_guided_review_queue_from_roast() is
  'Keeps guided review credits and resume queue visibility in sync when qualifying review rows are inserted, edited, soft-deleted, restored, or hard-deleted.';

comment on function public.create_resume_with_review_queue(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text
) is
  'Service-role-only resume insert that recalculates the derived guided review queue after creating a queued resume.';

notify pgrst, 'reload schema';
