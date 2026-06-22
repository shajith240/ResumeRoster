-- Removes all bypass logic from create_resume_with_review_queue.
--
-- Previous migrations introduced two bypasses that were both wrong:
--   1. "no viable resumes → force active"  — fired when all queue resumes were already
--      reviewed by this user, but recalculate counts reviews on ACTIVE resumes too, so
--      a user can always earn credits by reviewing active resumes in the feed.
--   2. "earned_credits = 0 → force active"  — fired for first-time uploaders when the
--      queue was empty.  This let brand-new accounts skip the queue entirely.
--
-- Correct logic:
--   required_reviews = 2  when any other open resume exists on the platform.
--   required_reviews = 0  only when the platform has zero other open resumes
--                         (bootstrap case — nothing to review, don't block forever).
--   Always call recalculate_guided_review_queue (debt-aware).
--   Resume activates iff effective_credits (earned − debt) ≥ required_reviews.
--
-- This means:
--   • A genuinely new user (0 earned, 0 debt) stays 'waiting' and must review 2
--     other resumes in the feed (which may be active OR waiting — both count).
--   • A re-uploader after delete stays 'waiting' because their debt cancels their
--     stale credits and they must earn 2 fresh ones.
--   • A legitimate pre-banker (earned 2 reviews before their first upload, 0 debt)
--     activates immediately via recalculate.
--
-- Also fixes the wisebuilder test resume that was wrongly force-activated.

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
  created_resume_id  uuid;
  required_reviews   int;
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

  -- Bootstrap guard: if no other open resumes exist on the platform, require 0
  -- reviews so the uploader (or sole user) is never permanently blocked.
  -- In all normal cases, require 2 reviews.
  select case
    when exists (
      select 1 from public.resumes r
      where r.user_id <> target_user_id
        and r.status = 'open'
    ) then 2
    else 0
  end
  into required_reviews;

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

  -- Apply debt-aware credits. If required_reviews = 0 the resume activates
  -- immediately inside recalculate (zero-required branch). If required_reviews = 2
  -- the resume only activates if effective_credits (earned − debt) ≥ 2.
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

comment on function public.create_resume_with_review_queue(uuid,text,text,boolean,text,text,text) is
  'Service-role-only resume insert. Sets activation_reviews_required = 2 whenever any '
  'other open resume exists (so the uploader must give 2 guided reviews), or 0 on an '
  'empty platform (bootstrap). Always calls recalculate_guided_review_queue with '
  'debt-aware credit logic — no bypass paths.';

-- ── Fix the wisebuilder test resume that was wrongly force-activated ──────────
-- Reset it to 'waiting' with 0 completed so the user can verify the fix
-- by giving 2 guided reviews and watching it activate normally.
update public.resumes
set
  review_queue_status          = 'waiting',
  activation_reviews_required  = 2,
  activation_reviews_completed = 0
where id = 'a40b5b28-58d7-46ac-bf3a-d28335e5f2a1';

notify pgrst, 'reload schema';
