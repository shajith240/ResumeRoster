-- Fixes: delete-and-reupload still bypassing the guided review queue even when
-- the queue is empty, because credits consumed by deleted resumes are not tracked.
--
-- Root cause:
--   • recalculate_guided_review_queue counts ALL earned credits (reviews in roasts
--     that still exist) but never subtracts credits that were already consumed by
--     now-deleted resumes.  When a user deletes their resume and re-uploads, the
--     2 reviews they gave to earn their first activation are still in roasts, so
--     recalculate gives them "free" activation credits again.
--   • The previous migration's "no viable resumes → force active" bypass makes this
--     worse: even with zero viable resumes to review, re-uploaders got immediate
--     activation because the queue was empty.
--
-- Fix:
--   1. Add deleted_resume_credit_debt to profiles — accumulates activation_reviews_completed
--      from each physically-deleted resume.
--   2. Seed retroactive debt for existing users using:
--         max(earned_credits - review_credit_balance - sum(completed for live resumes), 0)
--   3. BEFORE DELETE trigger updates the debt column when a resume is deleted.
--   4. recalculate_guided_review_queue uses effective_credits = max(earned - debt, 0)
--      so stale credits from deleted resumes no longer count.
--   5. create_resume_with_review_queue (replaces previous migration's version) uses
--      the debt-aware logic for the "empty queue" path:
--        • has_viable_resumes  → wait (unchanged)
--        • no viable + earned=0 → force active (first-time user, truly empty queue)
--        • no viable + effective≥required → recalculate (has genuine fresh credits)
--        • no viable + earned>0 + effective<required → stay waiting (stale credits)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists deleted_resume_credit_debt int not null default 0;

comment on column public.profiles.deleted_resume_credit_debt is
  'Cumulative activation_reviews_completed from resumes physically deleted by this '
  'user.  Subtracted from earned credits in recalculate_guided_review_queue so that '
  'credits already consumed by deleted resumes cannot be reused on re-upload.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Retroactive debt seed for existing users
--
--    Formula: max(earned − review_credit_balance − sum(completed for live resumes), 0)
--
--    Rationale:
--      earned = all qualifying guided reviews ever given (still in roasts)
--      review_credit_balance = credits banked in profile (not yet used by any resume)
--      sum(completed) = credits already consumed by still-live resumes
--      Anything left over represents credits that "went into" now-deleted resumes.
-- ─────────────────────────────────────────────────────────────────────────────

update public.profiles p
set deleted_resume_credit_debt = greatest(
  (
    select count(distinct ro.resume_id)::int
    from public.roasts ro
    join public.resumes r on r.id = ro.resume_id
    where ro.author_id = p.id
      and ro.parent_id is null
      and ro.is_deleted = false
      and coalesce(ro.is_guided_review, false) = true
      and ro.guided_issue_type in (
        'clarity','missing_impact','weak_project',
        'too_generic','ordering','formatting','role_fit'
      )
      and char_length(trim(coalesce(ro.content, ''))) >= 160
      and r.user_id <> p.id
  )
  - p.review_credit_balance
  - coalesce((
      select sum(r2.activation_reviews_completed)
      from public.resumes r2
      where r2.user_id = p.id
        and r2.activation_reviews_required > 0
        and r2.activation_reviews_completed > 0
    ), 0)
  , 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: accumulate debt when a resume is physically deleted
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.track_resume_delete_credit_debt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.activation_reviews_completed > 0 then
    update public.profiles
    set deleted_resume_credit_debt =
          deleted_resume_credit_debt + old.activation_reviews_completed
    where profiles.id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_resume_deleted_track_credit_debt on public.resumes;

create trigger on_resume_deleted_track_credit_debt
  before delete on public.resumes
  for each row execute procedure public.track_resume_delete_credit_debt();

comment on function public.track_resume_delete_credit_debt() is
  'Records the activation_reviews_completed from each deleted resume as credit debt '
  'so those credits cannot be reused on the next upload.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. recalculate_guided_review_queue — subtract debt from earned credits
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recalculate_guided_review_queue(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  earned_credits  int := 0;
  credit_debt     int := 0;
  remaining_credits int := 0;
  queue_resume    record;
  next_completed  int := 0;
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

  -- Count distinct resumes this user has given a qualifying guided review to.
  select count(distinct roasts.resume_id)::int
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

  -- Subtract credits already consumed by now-deleted resumes so they cannot
  -- be recycled into a new upload after delete-and-reupload.
  select coalesce(profiles.deleted_resume_credit_debt, 0)
  into credit_debt
  from public.profiles
  where profiles.id = target_user_id;

  remaining_credits := greatest(earned_credits - credit_debt, 0);

  -- Immediately activate any resumes that require zero reviews.
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

  -- Apply effective credits to the user's waiting/queued resumes in order.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. create_resume_with_review_queue — debt-aware upload logic
-- ─────────────────────────────────────────────────────────────────────────────

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
  created_resume_id   uuid;
  required_reviews    int     := 2;
  has_viable_resumes  boolean;
  earned_credits      int     := 0;
  credit_debt         int     := 0;
  effective_credits   int     := 0;
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

  -- ── Gate 1: are there resumes in the queue this user can still review? ──
  --
  -- A resume is "viable" if it is waiting, open, belongs to someone else,
  -- and this user has not already given it a qualifying guided review.
  select exists (
    select 1
    from public.resumes r
    where r.review_queue_status = 'waiting'
      and r.status = 'open'
      and r.user_id <> target_user_id
      and r.id <> created_resume_id
      and not exists (
        select 1
        from public.roasts ro
        where ro.resume_id = r.id
          and ro.author_id = target_user_id
          and coalesce(ro.is_guided_review, false) = true
          and ro.is_deleted = false
          and ro.parent_id is null
      )
  ) into has_viable_resumes;

  if has_viable_resumes then
    -- Queue has resumes this user can review.  Hold new resume in 'waiting'.
    -- Credits are NOT applied now; the trigger (sync_guided_review_queue_from_roast
    -- → recalculate_guided_review_queue) will handle it on the next review.
    null;

  else
    -- Queue is empty (or this user already reviewed everything in it).
    -- Decide based on effective credits (earned minus debt from deleted resumes).

    select count(distinct ro.resume_id)::int
    into earned_credits
    from public.roasts ro
    join public.resumes r on r.id = ro.resume_id
    where ro.author_id = target_user_id
      and ro.parent_id is null
      and ro.is_deleted = false
      and coalesce(ro.is_guided_review, false) = true
      and ro.guided_issue_type in (
        'clarity','missing_impact','weak_project',
        'too_generic','ordering','formatting','role_fit'
      )
      and char_length(trim(coalesce(ro.content, ''))) >= 160
      and r.user_id <> target_user_id;

    select coalesce(profiles.deleted_resume_credit_debt, 0)
    into credit_debt
    from public.profiles
    where profiles.id = target_user_id;

    effective_credits := greatest(earned_credits - credit_debt, 0);

    if earned_credits = 0 then
      -- Genuinely new user who has never reviewed anything: queue is also empty,
      -- so there is nothing they can do.  Let them through.
      update public.resumes
      set
        review_queue_status        = 'active',
        activation_reviews_completed = required_reviews
      where resumes.id = created_resume_id;

    elsif effective_credits >= required_reviews then
      -- Has genuine fresh credits (earned minus debt meets the bar).
      -- Let recalculate apply them properly.
      perform public.recalculate_guided_review_queue(target_user_id);

    else
      -- Has credit debt from deleted resumes that exceeds available credits.
      -- Must contribute fresh reviews to the queue before this resume activates.
      -- Stays in 'waiting'; the trigger fires on their next review and recalculates.
      null;

    end if;
  end if;

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

comment on function public.recalculate_guided_review_queue(uuid) is
  'Recomputes reversible guided review credits — now subtracting deleted_resume_credit_debt '
  'so credits consumed by deleted resumes are not recycled into new uploads.';

comment on function public.create_resume_with_review_queue(uuid,text,text,boolean,text,text,text) is
  'Service-role-only resume insert.  Uses three-path logic for the empty-queue case: '
  '(1) new user with no reviews → force active, (2) effective credits ≥ required → '
  'recalculate, (3) stale credits from deleted resumes → hold in waiting.';

notify pgrst, 'reload schema';
