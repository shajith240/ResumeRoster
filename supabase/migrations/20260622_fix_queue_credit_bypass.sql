-- Fixes: delete-and-reupload bypassing the guided review queue.
--
-- Root cause: create_resume_with_review_queue called recalculate_guided_review_queue
-- unconditionally after every insert. Credits earned for a previous resume persist in
-- the roasts table even after that resume is deleted, so re-uploading immediately
-- consumed those banked credits and promoted the new resume to 'active'.
--
-- New logic:
--   1. Insert the resume as 'waiting' (same as before).
--   2. Check whether the queue contains any resumes this user can actually review
--      (not their own, and not ones they have already given a guided review to).
--   3. If viable resumes EXIST → hold the new resume in 'waiting'. Credits are not
--      consumed now; they will be applied by the trigger the next time the user
--      gives a guided review (sync_guided_review_queue_from_roast →
--      recalculate_guided_review_queue fires automatically).
--   4. If NO viable resumes → promote the new resume directly to 'active' (queue is
--      empty or this user has already reviewed every waiting resume).

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

  -- A resume is "viable" for this user to review if:
  --   • it is currently waiting for guided reviews,
  --   • it is open (not closed/removed),
  --   • it belongs to a different user (no self-review), and
  --   • this user has not already submitted a qualifying guided review for it.
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
    -- Queue has resumes this user can review.
    -- Keep the new resume in 'waiting'; credits from earlier reviews are held.
    -- The trigger (sync_guided_review_queue_from_roast) will call
    -- recalculate_guided_review_queue the next time the user submits a review,
    -- which may then promote this resume automatically.
    null;
  else
    -- Nothing left to review (queue empty or all already reviewed by this user).
    -- Promote directly to 'active' so the user is not permanently blocked.
    update public.resumes
    set
      review_queue_status        = 'active',
      activation_reviews_completed = required_reviews
    where resumes.id = created_resume_id;
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

comment on function public.create_resume_with_review_queue(
  uuid, text, text, boolean, text, text, text
) is
  'Service-role-only resume insert. Holds new resume in the queue when viable '
  'resumes exist for the uploader to review; bypasses the queue only when the '
  'uploader has already reviewed every waiting resume (or the queue is empty).';
